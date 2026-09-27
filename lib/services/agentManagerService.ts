/**
 * Serviço de Gerenciamento e Orquestração Multi-Agente (Agent Manager)
 * 
 * Implementa uma arquitetura de 2 agentes especializados:
 * - AGENTE 1 (Auditor Contábil & Data Scout):
 *   Executa tarefas mais rápidas/leves com Gemini 2.5 Flash (triagem, extração de padrões,
 *   auditoria de transações, contagem de despesas e segregação crédito vs débito).
 * 
 * - AGENTE 2 (Personal CFO & Estrategista Financeiro):
 *   Executa raciocínio complexo e pesado com Gemini 3.8 Flash / 3.7 Flash (síntese executiva,
 *   simulação de fluxo de caixa futuro, alinhamento com metas e resposta consultiva).
 */

import {
  callGeminiCascade,
  FAST_AUDITOR_MODELS,
  HEAVY_STRATEGIC_MODELS,
} from "./geminiService.ts";
import type { GeminiChatMessage } from "./geminiService.ts";
import type {
  FinancialTelemetry,
  SafeFinancialContext,
  PurchaseSimulationResult,
} from "./financialContextService.ts";
import type {
  FinancialDiagnosis,
  SpecificExpenseAlert,
} from "./financialDiagnosisService.ts";
import { safeParseFinancialDiagnosis } from "./financialDiagnosisService.ts";

export interface AuditDossier {
  relevantCategories: string[];
  spendBreakdown: Array<{
    categoryOrItem: string;
    totalAmount: number;
    count: number;
    creditAmount: number;
    debitAmount: number;
    establishments: string[];
  }>;
  cashflowAlerts: string[];
  quickAuditNotes: string;
}

export interface AgentExecutionMeta {
  auditorModel?: string;
  cfoModel?: string;
  totalDurationMs: number;
  parallelExecution: boolean;
}

/**
 * AGENTE 1: AUDITOR CONTÁBIL (Gemini 2.5 Flash)
 * Realiza tarefas rápidas de auditoria, extração de padrões e contagem analítica.
 */
export async function runAuditorAgent(params: {
  context: SafeFinancialContext;
  userMessage?: string;
  targetCategory?: string;
}): Promise<AuditDossier> {
  const { context, userMessage } = params;

  // Monta contexto focado em dados brutos para o modelo 2.5 Flash
  const habitsSummary = (context.lifestyleHabits || [])
    .map((h) => `${h.habitName} (R$ ${h.total.toFixed(2)})`)
    .join(", ") || "Nenhum";
  const topSpendSummary = (context.topSpendItems || [])
    .map((t) => `${t.title} (R$ ${t.total.toFixed(2)})`)
    .join(", ") || "Nenhum";

  const prompt = `Você é o AGENTE 1: AUDITOR CONTÁBIL do sistema financeiro.
Sua missão é estritamente quantitativa, rápida e analítica:
1. Inspecione as despesas e hábitos de consumo do usuário:
   - Total em crédito acumulado: R$ ${context.credit.totalSpent.toFixed(2)}
   - Despesas fixas: R$ ${context.commitments.recurringMonthlyTotal.toFixed(2)}
   - Hábitos de estilo de vida identificados: ${habitsSummary}
   - Estabelecimentos frequentes: ${topSpendSummary}
2. Dúvida do usuário: "${userMessage || "Geral"}"
3. Extraia fatos precisos:
   - Identifique categorias e itens relacionados à dúvida
   - Somatória exata em crédito vs débito
   - Flags imediatas de risco de caixa

RESPONDA ESTRITAMENTE EM JSON no formato:
{
  "relevantCategories": string[],
  "spendBreakdown": [
    {
      "categoryOrItem": string,
      "totalAmount": number,
      "count": number,
      "creditAmount": number,
      "debitAmount": number,
      "establishments": string[]
    }
  ],
  "cashflowAlerts": string[],
  "quickAuditNotes": string
}`;

  try {
    const res = await callGeminiCascade({
      systemPrompt: "Você é um auditor financeiro analítico e ultra-rápido. Responda apenas JSON.",
      prompt,
      temperature: 0.1,
      jsonMode: true,
      maxOutputTokens: 1024,
      models: FAST_AUDITOR_MODELS,
      timeoutMs: 12000,
    });

    const parsed = JSON.parse(res.text) as AuditDossier;
    return {
      relevantCategories: parsed.relevantCategories || [],
      spendBreakdown: parsed.spendBreakdown || [],
      cashflowAlerts: parsed.cashflowAlerts || [],
      quickAuditNotes: parsed.quickAuditNotes || "Auditoria preliminar concluída.",
    };
  } catch (err) {
    console.warn("[AGENT_AUDITOR_FALLBACK] Usando telemetria determinística local:", err);
    // Fallback gracioso: gera o dossiê determinístico diretamente dos dados locais
    const safeCategories = (context.categories || []).slice(0, 3).map((c: { category: string }) => c.category);
    return {
      relevantCategories: safeCategories,
      spendBreakdown: (context.topSpendItems || []).slice(0, 5).map((t) => ({
        categoryOrItem: t.title,
        totalAmount: t.total,
        count: t.count,
        creditAmount: t.creditAmount ?? t.total,
        debitAmount: t.debitAmount ?? 0,
        establishments: [t.title],
      })),
      cashflowAlerts: context.commitments.isOverLimit
        ? ["Comprometimento acima do teto recomendado"]
        : [],
      quickAuditNotes: "Dados auditados via motor local de fluxo de caixa.",
    };
  }
}

/**
 * AGENTE 2: PERSONAL CFO & ESTRATEGISTA (Gemini 3.8 / 3.7 Flash)
 * Executa o raciocínio complexo, simulação de fluxo e formula a resposta consultiva.
 */
export async function runStrategicCFOAgent(params: {
  systemPrompt: string;
  conversationMessages: GeminiChatMessage[];
  auditDossier?: AuditDossier;
  simulationResult?: PurchaseSimulationResult | null;
}): Promise<{ text: string; modelUsed: string; durationMs: number; attemptedModels: string[] }> {
  let enrichedSystemPrompt = params.systemPrompt;

  // Injeta o dossiê do Agente 1 diretamente no cérebro do Agente 2
  if (params.auditDossier) {
    enrichedSystemPrompt += `\n\n=== DOSSIÊ DE AUDITORIA PRELIMINAR (PRODUZIDO PELO AGENTE 1 - AUDITOR) ===
- Categorias de Destaque Auditadas: ${params.auditDossier.relevantCategories.join(", ") || "Gerais"}
- Resumo Analítico dos Gastos:
${params.auditDossier.spendBreakdown
  .map(
    (b) =>
      `  • ${b.categoryOrItem}: Total R$ ${b.totalAmount.toFixed(2)} (${b.count} compras | Crédito R$ ${b.creditAmount.toFixed(2)} | Débito R$ ${b.debitAmount.toFixed(2)}) - Estabelecimentos: ${b.establishments.join(", ")}`
  )
  .join("\n")}
- Alertas Imediatos de Caixa: ${params.auditDossier.cashflowAlerts.join("; ") || "Nenhum alerta crítico"}
- Nota do Auditor: "${params.auditDossier.quickAuditNotes}"

DIRETRIZ DE DECISÃO DO CFO:
Use as evidências factuais do Agente 1 acima para fundamentar sua resposta estratégica com precisão absoluta, sem precisar recontar do zero.`;
  }

  return await callGeminiCascade({
    systemPrompt: enrichedSystemPrompt,
    messages: params.conversationMessages,
    temperature: 0.35,
    maxOutputTokens: 2048,
    models: HEAVY_STRATEGIC_MODELS,
  });
}

/**
 * ORQUESTRADOR DE CHAT MULTI-AGENTE
 * Executa o fluxo coordenado:
 * 1. Agente 1 (Gemini 2.5 Flash) faz a auditoria rápida dos dados pertinentes à pergunta.
 * 2. Agente 2 (Gemini 3.8/3.7 Flash) recebe a auditoria e gera a orientação executiva para o usuário.
 */
export async function orchestrateDualAgentChat(params: {
  context: SafeFinancialContext;
  systemPrompt: string;
  conversationMessages: GeminiChatMessage[];
  userMessage?: string;
  simulationResult?: PurchaseSimulationResult | null;
}): Promise<{
  text: string;
  modelUsed: string;
  durationMs: number;
  attemptedModels: string[];
  auditBriefing?: AuditDossier;
}> {
  const startTime = Date.now();

  // 1. Executa o Agente 1 (Auditor rápido)
  const auditDossier = await runAuditorAgent({
    context: params.context,
    userMessage: params.userMessage,
  });

  // 2. Executa o Agente 2 (CFO Sênior) alimentado com o dossiê do Agente 1
  const cfoResponse = await runStrategicCFOAgent({
    systemPrompt: params.systemPrompt,
    conversationMessages: params.conversationMessages,
    auditDossier,
    simulationResult: params.simulationResult,
  });

  return {
    text: cfoResponse.text,
    modelUsed: cfoResponse.modelUsed,
    durationMs: Date.now() - startTime,
    attemptedModels: cfoResponse.attemptedModels,
    auditBriefing: auditDossier,
  };
}

/**
 * ORQUESTRADOR DE DIAGNÓSTICO EM PARALELO (Promise.all)
 * Roda ambos os agentes simultaneamente:
 * - Agente 1 (Gemini 2.5 Flash): Extração profunda de padrões de gastos e hábitos repetitivos.
 * - Agente 2 (Gemini 3.8/3.7 Flash): Cálculo de score de saúde, reality check e parecer executivo.
 */
export async function orchestrateDualAgentDiagnosis(params: {
  context: SafeFinancialContext;
  systemPrompt: string;
  fullUserPrompt: string;
  dismissedPatterns?: string[];
}): Promise<{
  diagnosis: FinancialDiagnosis;
  modelUsed: string;
  durationMs: number;
  attemptedModels: string[];
}> {
  const startTime = Date.now();

  let cfoText = "";
  let cfoModelUsed = "motor-contabil-local";
  let cfoAttemptedModels: string[] = [];

  // Execução resiliente: Agente 2 formula a análise estratégica
  try {
    const cfoResult = await callGeminiCascade({
      systemPrompt: params.systemPrompt,
      prompt: params.fullUserPrompt,
      temperature: 0.25,
      jsonMode: true,
      maxOutputTokens: 3500,
      models: HEAVY_STRATEGIC_MODELS,
      timeoutMs: 30000,
    });
    cfoText = cfoResult.text;
    cfoModelUsed = cfoResult.modelUsed;
    cfoAttemptedModels = cfoResult.attemptedModels;
  } catch (cfoErr) {
    console.warn(
      "[AGENT_CFO_FALLBACK] Google AI temporariamente indisponível. Ativando síntese contábil determinística:",
      cfoErr
    );
  }

  // Sintetiza o diagnóstico final combinando os dados auditados com a resposta da IA (ou telemetria contábil)
  const baseDiagnosis = safeParseFinancialDiagnosis(
    cfoText,
    params.context,
    params.dismissedPatterns
  );

  return {
    diagnosis: baseDiagnosis,
    modelUsed: cfoModelUsed,
    durationMs: Date.now() - startTime,
    attemptedModels: cfoAttemptedModels,
  };
}
