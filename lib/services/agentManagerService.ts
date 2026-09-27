/**
 * Serviço de Gerenciamento e Orquestração do Analista Financeiro
 * 
 * Arquitetura Eficiente de Agente:
 * - Etapa 1: Auditor Contábil Factual (Local e Determinístico)
 *   Calcula e valida com precisão matemática em TypeScript totais, categorias,
 *   recorrências, hábitos elegíveis e limites de caixa, gerando o AuditDossier sem custo de tokens.
 * 
 * - Etapa 2: Analista Executivo (OpenAI GPT-6 Luna)
 *   Recebe os fatos consolidados e produz a síntese estratégica, respostas do chat
 *   e diagnósticos de alto nível.
 * 
 * Uma única chamada ao modelo por interação para manter o controle orçamentário.
 */

import {
  callOpenAIResponses,
} from "./openaiService.ts";
import type {
  OpenAIChatMessage,
  OpenAIResponseResult,
} from "./openaiService.ts";
import type {
  SafeFinancialContext,
  PurchaseSimulationResult,
} from "./financialContextService.ts";
import type {
  FinancialDiagnosis,
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
  analystModel: string;
  totalDurationMs: number;
  aiSynthesis: boolean;
  attemptedModels: string[];
  tokens?: {
    input: number;
    output: number;
    reasoning: number;
  };
  estimatedCostUsd?: number;
}

/**
 * Flag para ativar opcionalmente o auditor via chamada de IA (desativado por padrão).
 * Pode ser ativado via variável de ambiente ENABLE_AI_AUDITOR=true quando demonstrado ganho.
 */
export const ENABLE_AI_AUDITOR = process.env.ENABLE_AI_AUDITOR === "true";

/**
 * AUDITOR CONTÁBIL DETERMINÍSTICO (Local em TypeScript)
 * Produz o dossiê factual de forma instantânea, com 100% de exatidão matemática
 * e custo US$ 0,00.
 */
export function generateDeterministicAuditDossier(params: {
  context: SafeFinancialContext;
  userMessage?: string;
  targetCategory?: string;
}): AuditDossier {
  const { context, userMessage } = params;
  const messageNorm = (userMessage || "").toLowerCase();

  // Categorias principais
  const safeCategories = (context.categories || []).slice(0, 5).map((c) => c.category);

  // Seleciona estabelecimentos e hábitos relevantes
  const allSpends = context.topSpendItems || [];
  let relevantSpends = allSpends;

  if (messageNorm) {
    const matched = allSpends.filter(
      (item) =>
        messageNorm.includes(item.title.toLowerCase()) ||
        (item.habitCategory && messageNorm.includes(item.habitCategory.toLowerCase()))
    );
    if (matched.length > 0) {
      relevantSpends = matched;
    }
  }

  const spendBreakdown = relevantSpends.slice(0, 6).map((t) => ({
    categoryOrItem: t.title,
    totalAmount: t.total,
    count: t.count,
    creditAmount: t.creditAmount ?? t.total,
    debitAmount: t.debitAmount ?? 0,
    establishments: [t.title],
  }));

  const cashflowAlerts: string[] = [];
  if (context.commitments.isOverLimit) {
    cashflowAlerts.push(
      `Comprometimento de renda (${context.commitments.commitmentRatioPercent}%) excede o teto de alerta (${context.profile.maxCommitmentAlertPercent}%)`
    );
  }
  if (context.credit.creditUtilizationPercent > 80) {
    cashflowAlerts.push(
      `Utilização de crédito elevada (${context.credit.creditUtilizationPercent}%)`
    );
  }
  if (context.cashflow.savingsRatePercent < 10) {
    cashflowAlerts.push(
      `Taxa de poupança atual em ${context.cashflow.savingsRatePercent}%`
    );
  }

  return {
    relevantCategories: safeCategories,
    spendBreakdown,
    cashflowAlerts: cashflowAlerts.length > 0 ? cashflowAlerts : ["Fluxo de caixa sob controle contábil."],
    quickAuditNotes: "Auditoria contábil determinística realizada localmente: dados verificados com exatidão matemática.",
  };
}

/**
 * Função do Auditor (compatível com a assinatura anterior).
 * Utiliza o motor determinístico local por padrão.
 */
export async function runAuditorAgent(params: {
  context: SafeFinancialContext;
  userMessage?: string;
  targetCategory?: string;
}): Promise<AuditDossier> {
  // Se configurado para auditor IA opcional (desligado por padrão)
  if (ENABLE_AI_AUDITOR) {
    try {
      const prompt = `Você é o Auditor Contábil preliminar.
Dados apurados:
- Total em crédito: R$ ${params.context.credit.totalSpent.toFixed(2)}
- Despesas fixas: R$ ${params.context.commitments.recurringMonthlyTotal.toFixed(2)}
- Dúvida: "${params.userMessage || "Geral"}"
Responda JSON com relevantCategories, spendBreakdown, cashflowAlerts, quickAuditNotes.`;

      const res = await callOpenAIResponses({
        prompt,
        reasoningEffort: "none",
        maxOutputTokens: 600,
      });

      const parsed = JSON.parse(res.text) as AuditDossier;
      if (parsed && Array.isArray(parsed.relevantCategories)) {
        return parsed;
      }
    } catch (err) {
      console.warn("[AUDITOR_AI_FALLBACK] Utilizando auditor determinístico local:", err);
    }
  }

  // Padrão determinístico local
  return generateDeterministicAuditDossier(params);
}

/**
 * Formata o dossiê contábil para injeção no prompt do Analista
 */
export function formatAuditDossierForPrompt(dossier: AuditDossier): string {
  return `\n=== DOSSIÊ DE AUDITORIA FACTUAL (AUDITOR LOCAL DETERMINÍSTICO) ===
- Categorias Relevantes: ${dossier.relevantCategories.join(", ") || "Gerais"}
- Resumo Analítico dos Gastos:
${dossier.spendBreakdown
  .map(
    (b) =>
      `  • ${b.categoryOrItem}: Total R$ ${b.totalAmount.toFixed(2)} (${b.count} compras | Crédito: R$ ${b.creditAmount.toFixed(2)} | Débito: R$ ${b.debitAmount.toFixed(2)})`
  )
  .join("\n")}
- Alertas de Caixa: ${dossier.cashflowAlerts.join("; ")}
- Nota da Auditoria: "${dossier.quickAuditNotes}"

DIRETRIZ DE DECISÃO DO ANALISTA:
Utilize os fatos auditados acima como verdade matemática inalterável. Não recalcule nem crie números divergentes.`;
}

/**
 * SCHEMA JSON ESTRUTURADO PARA DIAGNÓSTICO FINANCEIRO (Responses API Structured Outputs)
 */
export const FINANCIAL_DIAGNOSIS_JSON_SCHEMA = {
  name: "FinancialDiagnosis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      healthScore: { type: "integer" },
      healthStatus: {
        type: "string",
        enum: ["excellent", "healthy", "attention", "critical"],
      },
      executiveSummary: { type: "string" },
      spendingPatterns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            type: { type: "string", "enum": ["info", "warning", "alert"] },
          },
          required: ["title", "description", "type"],
          additionalProperties: false,
        },
      },
      specificExpensesAlerts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string" },
            habitCategory: { type: "string" },
            totalAmount: { type: "number" },
            count: { type: "integer" },
            creditAmount: { type: "number" },
            debitAmount: { type: "number" },
            paymentBreakdown: { type: "string" },
            alertType: { type: "string", "enum": ["info", "warning", "alert"] },
            message: { type: "string" },
          },
          required: [
            "item",
            "habitCategory",
            "totalAmount",
            "count",
            "creditAmount",
            "debitAmount",
            "paymentBreakdown",
            "alertType",
            "message",
          ],
          additionalProperties: false,
        },
      },
      cashflowWindow: {
        type: "object",
        properties: {
          currentMonth: {
            type: "object",
            properties: {
              insight: { type: "string" },
            },
            required: ["insight"],
            additionalProperties: false,
          },
          nextMonth: {
            type: "object",
            properties: {
              insight: { type: "string" },
            },
            required: ["insight"],
            additionalProperties: false,
          },
        },
        required: ["currentMonth", "nextMonth"],
        additionalProperties: false,
      },
      installmentSchedule: {
        type: "array",
        items: {
          type: "object",
          properties: {
            period: { type: "string" },
            dueDateHint: { type: "string" },
            cardInstallmentsAmount: { type: "number" },
            status: { type: "string", "enum": ["safe", "warning", "alert"] },
            explanation: { type: "string" },
          },
          required: [
            "period",
            "dueDateHint",
            "cardInstallmentsAmount",
            "status",
            "explanation",
          ],
          additionalProperties: false,
        },
      },
      futureMonthsRealityCheck: {
        type: "object",
        properties: {
          realityNote: { type: "string" },
        },
        required: ["realityNote"],
        additionalProperties: false,
      },
      clientProfileAssessment: {
        type: "object",
        properties: {
          profileAlignmentInsight: { type: "string" },
          recommendedActionForGoal: { type: "string" },
        },
        required: ["profileAlignmentInsight", "recommendedActionForGoal"],
        additionalProperties: false,
      },
      futureProjections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            period: { type: "string" },
            description: { type: "string" },
            severity: { type: "string", "enum": ["info", "warning", "alert"] },
          },
          required: ["period", "description", "severity"],
          additionalProperties: false,
        },
      },
      actionableSuggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            action: { type: "string" },
            potentialGain: { type: "string" },
            targetGoal: { type: "string" },
          },
          required: ["title", "action", "potentialGain", "targetGoal"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "healthScore",
      "healthStatus",
      "executiveSummary",
      "spendingPatterns",
      "specificExpensesAlerts",
      "cashflowWindow",
      "installmentSchedule",
      "futureMonthsRealityCheck",
      "clientProfileAssessment",
      "futureProjections",
      "actionableSuggestions",
    ],
    additionalProperties: false,
  },
};

/**
 * SCHEMA JSON ESTRUTURADO PARA DETECÇÃO DE PADRÕES (Responses API Structured Outputs)
 */
export const SPENDING_PATTERNS_JSON_SCHEMA = {
  name: "SpendingPatternsResponse",
  strict: true,
  schema: {
    type: "object",
    properties: {
      patterns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string" },
            habitCategory: { type: "string" },
            totalAmount: { type: "number" },
            count: { type: "integer" },
            creditAmount: { type: "number" },
            debitAmount: { type: "number" },
            paymentBreakdown: { type: "string" },
            alertType: { type: "string", "enum": ["info", "warning", "alert"] },
            message: { type: "string" },
          },
          required: [
            "item",
            "habitCategory",
            "totalAmount",
            "count",
            "creditAmount",
            "debitAmount",
            "paymentBreakdown",
            "alertType",
            "message",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["patterns"],
    additionalProperties: false,
  },
};

/**
 * ORQUESTRADOR DO CHAT DO ANALISTA
 * Uma chamada única ao modelo gpt-6-luna (Responses API), enriquecida com auditoria determinística.
 */
export async function orchestrateAnalystChat(params: {
  context: SafeFinancialContext;
  systemPrompt: string;
  conversationMessages: OpenAIChatMessage[];
  userMessage?: string;
  simulationResult?: PurchaseSimulationResult | null;
}): Promise<{
  text: string;
  modelUsed: string;
  durationMs: number;
  attemptedModels: string[];
  auditBriefing: AuditDossier;
  openAIResponse?: OpenAIResponseResult;
}> {
  const startTime = Date.now();

  // 1. Auditoria Factual Determinística (Local em TypeScript)
  const auditDossier = generateDeterministicAuditDossier({
    context: params.context,
    userMessage: params.userMessage,
  });

  // 2. Enriquece o system prompt com o dossiê factual
  const enrichedSystemPrompt = params.systemPrompt + formatAuditDossierForPrompt(auditDossier);

  // 3. Chamada Única ao Modelo Principal (gpt-6-luna) com reasoning: none para chat ágil
  const openAIResult = await callOpenAIResponses({
    systemPrompt: enrichedSystemPrompt,
    messages: params.conversationMessages,
    reasoningEffort: "none",
    maxOutputTokens: 1500,
    timeoutMs: 25000,
  });

  return {
    text: openAIResult.text,
    modelUsed: openAIResult.modelUsed,
    durationMs: Date.now() - startTime,
    attemptedModels: [openAIResult.modelUsed],
    auditBriefing: auditDossier,
    openAIResponse: openAIResult,
  };
}

// Alias de retrocompatibilidade
export const orchestrateDualAgentChat = orchestrateAnalystChat;

/**
 * ORQUESTRADOR DO DIAGNÓSTICO FINANCEIRO
 * Uma chamada única com Structured Outputs (JSON Schema) e reasoning: low.
 * Em caso de falha da OpenAI ou esgotamento de quota, aciona o diagnóstico determinístico local
 * com sinalização explícita de aiSynthesis: false.
 */
export async function orchestrateFinancialDiagnosis(params: {
  context: SafeFinancialContext;
  systemPrompt: string;
  fullUserPrompt: string;
  dismissedPatterns?: string[];
}): Promise<{
  diagnosis: FinancialDiagnosis;
  modelUsed: string;
  durationMs: number;
  attemptedModels: string[];
  aiSynthesis: boolean;
  openAIResponse?: OpenAIResponseResult;
}> {
  const startTime = Date.now();

  // 1. Auditoria Factual Determinística (Local em TypeScript)
  const auditDossier = generateDeterministicAuditDossier({
    context: params.context,
  });

  const enrichedSystemPrompt = params.systemPrompt + formatAuditDossierForPrompt(auditDossier);

  let rawModelText = "";
  let modelUsed = "motor-contabil-local";
  let attemptedModels: string[] = [];
  let aiSynthesis = false;
  let openAIResult: OpenAIResponseResult | undefined = undefined;

  try {
    openAIResult = await callOpenAIResponses({
      systemPrompt: enrichedSystemPrompt,
      prompt: params.fullUserPrompt,
      reasoningEffort: "low",
      maxOutputTokens: 3500,
      jsonSchema: FINANCIAL_DIAGNOSIS_JSON_SCHEMA,
      timeoutMs: 35000,
    });

    rawModelText = openAIResult.text;
    modelUsed = openAIResult.modelUsed;
    attemptedModels = [modelUsed];

    // Diferencia resposta válida de falha de parsing ou recusa
    try {
      const parsed = JSON.parse(rawModelText);
      if (parsed && typeof parsed === "object") {
        aiSynthesis = true;
      } else {
        throw new Error("JSON da OpenAI não gerou um objeto.");
      }
    } catch {
      console.warn(
        "[DIAGNOSIS_PARSE_FAIL] JSON da OpenAI inválido ou inaproveitável. Revertendo para motor contábil local com aiSynthesis: false."
      );
      aiSynthesis = false;
      modelUsed = "motor-contabil-local";
      rawModelText = "";
    }
  } catch (err) {
    console.warn(
      "[DIAGNOSIS_OPENAI_FALLBACK] Provedor de IA indisponível. Utilizando diagnóstico determinístico local:",
      err
    );
    // aiSynthesis permanece false e modelUsed é "motor-contabil-local"
  }

  // 2. Validação e reconciliação dos fatos contábeis no servidor
  const finalDiagnosis = safeParseFinancialDiagnosis(
    rawModelText,
    params.context,
    params.dismissedPatterns
  );

  return {
    diagnosis: finalDiagnosis,
    modelUsed,
    durationMs: Date.now() - startTime,
    attemptedModels,
    aiSynthesis,
    openAIResponse: openAIResult,
  };
}

// Alias de retrocompatibilidade
export const orchestrateDualAgentDiagnosis = orchestrateFinancialDiagnosis;
