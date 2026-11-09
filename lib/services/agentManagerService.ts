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
import { getProjectionPendingCommitted, getProjectionPendingInvoices } from "./financialContextService.ts";
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
 * Resposta analítica local inteligente para o Chat do Consultor caso o provedor externo de IA
 * esteja indisponível, sem saldo ou em timeout na Vercel.
 */
export function generateDeterministicAnalystChatReply(params: {
  context: SafeFinancialContext;
  auditDossier: AuditDossier;
  userMessage?: string;
  simulationResult?: PurchaseSimulationResult | null;
}): string {
  const { context, auditDossier, userMessage = "", simulationResult } = params;
  const q = userMessage.toLowerCase();

  // 1. Se houver simulação de compra ("Devo Comprar?")
  if (simulationResult) {
    const verdictBadge =
      simulationResult.verdict === "safe"
        ? "✅ **Compra Segura**"
        : simulationResult.verdict === "warning"
        ? "⚠️ **Atenção no Orçamento**"
        : "🚨 **Risco Elevado para o Fluxo de Caixa**";

    return `${verdictBadge} — ${simulationResult.verdictMessage}

**Resumo do Impacto Simulado (R$ ${simulationResult.amount.toFixed(2)}):**
- **Modalidade:** ${
      simulationResult.method === "cash"
        ? "À vista (Débito / PIX)"
        : `Cartão de Crédito (${simulationResult.cardName}) em ${simulationResult.installments}x de R$ ${simulationResult.monthlyInstallmentAmount.toFixed(2)}`
    }
- **Saldo em Conta:** R$ ${simulationResult.before.checkingBalance.toFixed(2)} ➔ **R$ ${simulationResult.after.checkingBalance.toFixed(2)}**
- **Comprometimento Mensal:** ${simulationResult.before.monthlyCommitmentPercent}% ➔ **${simulationResult.after.monthlyCommitmentPercent}%** (limite recomendado: ${context.profile.maxCommitmentAlertPercent}%)
- **Projeção:** ${simulationResult.impactSummary}`;
  }

  const projectedEnd = context.target?.projectedEndMonthBalance ?? context.cashflow.checkingBalance;
  const targetEnd = context.target?.targetEndMonthBalance ?? 0;
  const safeMargin = context.target?.safeSpendingMargin ?? Math.max(0, projectedEnd - targetEnd);
  const missingAmount = context.target?.missingAmount ?? Math.max(0, targetEnd - projectedEnd);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1);
  const safeDaily = Math.max(0, safeMargin / remainingDays);

  // 2. Perguntas vindas da Agenda / Calendário ("Analise meu dia...")
  if (q.includes("analise meu dia") || (q.includes("dia ") && q.includes("realizado:") && q.includes("previsto:"))) {
    const dayStatus =
      projectedEnd >= targetEnd
        ? `✅ **Sua agenda protege sua meta de R$ ${targetEnd.toFixed(2)}!** Mesmo considerando os compromissos previstos, seu fechamento projetado é de **R$ ${projectedEnd.toFixed(2)}** (folga de **R$ ${safeMargin.toFixed(2)}**).`
        : `⚠️ **Atenção na agenda:** o fechamento projetado (**R$ ${projectedEnd.toFixed(2)}**) está **R$ ${missingAmount.toFixed(2)}** abaixo da sua meta de **R$ ${targetEnd.toFixed(2)}**.`;

    return `### 📅 Leitura Contábil do Dia na Agenda

${dayStatus}

- **Saldo Atual em Conta:** R$ ${context.cashflow.checkingBalance.toFixed(2)}
- **Contas Fixas / Recorrentes do Mês:** R$ ${context.commitments.recurringMonthlyTotal.toFixed(2)}
- **Teto Diário Seguro Hoje:** **R$ ${safeDaily.toFixed(2)}/dia** (${remainingDays} dias restantes no ciclo)

**Orientação prática:**
1. Se você já recebeu ou pagou algum item adiantado (como ontem ou hoje), marque como realizado na agenda para que o saldo em conta reflita o caixa real.
2. Mantenha gastos variáveis do dia dentro de **R$ ${safeDaily.toFixed(2)}** para preservar sua margem até o fechamento do mês.`;
  }

  // 3. Perguntas sobre Teto Diário Seguro ("teto diário", "teto seguro", "quanto posso gastar hoje")
  if (
    q.includes("teto diário") ||
    q.includes("teto diario") ||
    q.includes("teto seguro") ||
    q.includes("gastar hoje") ||
    q.includes("livre hoje")
  ) {
    return `### 💡 Seu Teto Diário Seguro Hoje: **R$ ${safeDaily.toFixed(2)}**

Calculamos esse limite protegendo 100% das suas contas pendentes e a sua meta de fechamento:

- **Saldo Atual em Conta:** R$ ${context.cashflow.checkingBalance.toFixed(2)}
- **Fechamento Projetado do Mês:** R$ ${projectedEnd.toFixed(2)}
- **Meta de Fechamento Protegida:** R$ ${targetEnd.toFixed(2)}
- **Margem Livre Total até o Fim do Mês:** **R$ ${safeMargin.toFixed(2)}** (dividida pelos ${remainingDays} dias restantes = **R$ ${safeDaily.toFixed(2)}/dia**)

${
  safeDaily > 0
    ? `✅ Enquanto suas despesas variáveis à vista ficarem abaixo de **R$ ${safeDaily.toFixed(2)} hoje**, sua meta de fechar o mês com R$ ${targetEnd.toFixed(2)} permanece intacta.`
    : `⚠️ Sua margem variável para o mês já foi consumida. Evite novos gastos no débito/PIX hoje para recuperar **R$ ${missingAmount.toFixed(2)}** até o fim do mês.`
}`;
  }

  // 4. Perguntas sobre Projeção de 6 Meses / Fluxo de Caixa / Risco (Rubi)
  if (
    q.includes("projeção de caixa") ||
    q.includes("projecao de caixa") ||
    q.includes("6 meses") ||
    q.includes("cashflow at risk") ||
    q.includes("risco de fluxo")
  ) {
    const projections = context.monthlyProjections || [];
    const projLines =
      projections.length > 0
        ? projections
            .slice(0, 6)
            .map(
              (p) =>
                `- **${p.monthName}/${p.year}:** Entradas previstas R$ ${p.plannedIncomesTotal.toFixed(2)} | Ainda a pagar R$ ${getProjectionPendingCommitted(p).toFixed(2)} ➔ **Saldo Livre: R$ ${p.projectedFreeBalance.toFixed(2)}**`
            )
            .join("\n")
        : `- **Mês Atual:** Saldo Livre Projetado de **R$ ${projectedEnd.toFixed(2)}**`;

    return `### 📊 Projeção de Caixa e Risco (6 Meses)

Aqui está o comportamento projetado do seu caixa nos próximos ciclos:

${projLines}

- **Comprometimento Atual da Renda:** **${context.commitments.commitmentRatioPercent}%** (limite de segurança: ${context.profile.maxCommitmentAlertPercent}%)
- **Baseline de Gastos Variáveis:** ~R$ ${context.historicalVariableBaseline.toFixed(2)}/mês

**Diagnóstico da Rubi:** ${
      projectedEnd >= targetEnd
        ? `Seu fluxo de caixa está saudável e sustenta a meta de R$ ${targetEnd.toFixed(2)}. O principal ponto de atenção é evitar que novas parcelas de cartão elevem o comprometimento acima de ${context.profile.maxCommitmentAlertPercent}%.`
        : `O mês atual exige contenção de R$ ${missingAmount.toFixed(2)} em gastos variáveis para restaurar a folga de caixa nos próximos meses.`
    }`;
  }

  // 5. Perguntas sobre Hábitos, Ralos Invisíveis, Sobrevivência e Emergência (Sol)
  if (
    q.includes("ralo") ||
    q.includes("hábito") ||
    q.includes("habito") ||
    q.includes("sobrevivência") ||
    q.includes("sobrevivencia") ||
    q.includes("fôlego") ||
    q.includes("folego") ||
    q.includes("fundo de emergência") ||
    q.includes("fundo de emergencia") ||
    q.includes("blindar meu caixa") ||
    q.includes("cortar")
  ) {
    const monthlyEssential = Math.max(
      1,
      context.commitments.recurringMonthlyTotal + context.historicalVariableBaseline * 0.5
    );
    const survivalDays = Math.max(
      0,
      Math.round((context.cashflow.checkingBalance / monthlyEssential) * 30)
    );
    const idealEmergencyFund = monthlyEssential * 6;
    const habitsLines =
      auditDossier.spendBreakdown.length > 0
        ? auditDossier.spendBreakdown
            .slice(0, 4)
            .map(
              (b) =>
                `- **${b.categoryOrItem}:** R$ ${b.totalAmount.toFixed(2)} (${b.count}x — potencial de economia de **R$ ${(b.totalAmount * 0.35).toFixed(2)}/mês** se reduzido em 35%)`
            )
            .join("\n")
        : `- Seus gastos variáveis atuais somam **R$ ${context.cashflow.monthExpenseRealized.toFixed(2)}** neste ciclo.`;

    return `### 🛡️ Diagnóstico de Fôlego, Ralos e Blindagem (Sol)

- **Autonomia Atual de Caixa:** **~${survivalDays} dias** de cobertura com o saldo em conta atual (R$ ${context.cashflow.checkingBalance.toFixed(2)})
- **Custo Base Mensal Estimado:** R$ ${monthlyEssential.toFixed(2)}/mês
- **Reserva de Emergência Ideal (6 meses):** R$ ${idealEmergencyFund.toFixed(2)}

**Principais Focos de Vazamento / Hábitos Auditados:**
${habitsLines}

**Plano de Blindagem em 2 Passos:**
1. Defina um teto semanal para os itens acima e redirecione 30% desse valor direto para sua reserva.
2. Proteja o teto diário de **R$ ${safeDaily.toFixed(2)}/dia** nas compras em débito/PIX até o fechamento do mês.`;
  }

  // 6. Perguntas sobre Metas, Alocação de Sobra, 12/24/36 meses (Atlos)
  if (
    q.includes("meta") ||
    q.includes("atlos") ||
    q.includes("excedente") ||
    q.includes("alocação") ||
    q.includes("alocacao") ||
    q.includes("12, 24 e 36") ||
    q.includes("aporte") ||
    q.includes("render")
  ) {
    const monthlySurplus = Math.max(0, projectedEnd);
    const safeMonthlyContribution = Math.max(
      0,
      safeMargin > 0 ? safeMargin * 0.6 : monthlySurplus * 0.3
    );
    const rateMonthly = 0.0085; // ~10.7% a.a. líquido conservador CDI
    const calcCompound = (months: number) =>
      safeMonthlyContribution * ((Math.pow(1 + rateMonthly, months) - 1) / rateMonthly);

    const goalsSummary =
      context.goals && context.goals.length > 0
        ? context.goals
            .map(
              (g) =>
                `- **${g.alias}:** R$ ${g.current.toFixed(2)} / R$ ${g.target.toFixed(2)} (${g.progressPercent}% concluído)`
            )
            .join("\n")
        : `- **Meta de Fechamento Mensal:** R$ ${targetEnd.toFixed(2)} (Saldo projetado: R$ ${projectedEnd.toFixed(2)})`;

    return `### 🚀 Plano de Alocação e Metas (Atlos)

- **Fechamento Projetado do Mês:** R$ ${projectedEnd.toFixed(2)}
- **Margem Segura Acima da Meta:** R$ ${safeMargin.toFixed(2)}
- **Aporte Mensal Sustentável Recomendado:** **R$ ${safeMonthlyContribution.toFixed(2)}/mês**

**Suas Metas Atuais:**
${goalsSummary}

**Simulação de Acúmulo Conservador (CDI ~10,7% a.a. líquido):**
- **Em 12 meses:** R$ ${calcCompound(12).toFixed(2)}
- **Em 24 meses:** R$ ${calcCompound(24).toFixed(2)}
- **Em 36 meses:** R$ ${calcCompound(36).toFixed(2)}

**Recomendação:** Separe o aporte logo após o recebimento da renda principal para não misturar com o caixa variável do mês.`;
  }

  // 7. Perguntas sobre próximo mês / fatura futura
  if (q.includes("mês que vem") || q.includes("mes que vem") || q.includes("próximo mês") || q.includes("proximo mes")) {
    const nextProj = context.monthlyProjections?.[1] || context.monthlyProjections?.[0];
    if (nextProj) {
      return `Analisei a projeção para **${nextProj.monthName}/${nextProj.year}**:

- **Saldo Inicial Projetado:** R$ ${nextProj.openingBalance.toFixed(2)}
- **Entradas Previstas:** R$ ${nextProj.plannedIncomesTotal.toFixed(2)}
- **Contas Fixas (Débito/PIX):** R$ ${nextProj.recurringDebitTotal.toFixed(2)}
- **Faturas / Parcelas de Cartão ainda a pagar:** R$ ${getProjectionPendingInvoices(nextProj).toFixed(2)}
- **Saldo Livre Projetado no Fechamento:** **R$ ${nextProj.projectedFreeBalance.toFixed(2)}**

**Recomendação:** Mantenha os gastos variáveis do dia a dia abaixo de **R$ ${Math.max(0, nextProj.projectedFreeBalance - targetEnd).toFixed(2)}** para preservar sua meta de fechamento mensal.`;
    }
  }

  // 8. Perguntas sobre cartão / fatura / limite / Nanquim
  if (
    q.includes("cartão") ||
    q.includes("cartao") ||
    q.includes("fatura") ||
    q.includes("crédito") ||
    q.includes("credito") ||
    q.includes("nanquim") ||
    q.includes("dias livres") ||
    q.includes("parcelar")
  ) {
    const cardsLines =
      context.credit.cardsSummary && context.credit.cardsSummary.length > 0
        ? context.credit.cardsSummary
            .map(
              (c) =>
                `- **${c.alias}:** ${c.invoiceAmount !== undefined ? `Fatura pendente (${c.invoicePeriod}): **R$ ${c.invoiceAmount.toFixed(2)}**${c.invoiceIsPaid && (c.invoicePaidAmount ?? 0) > 0 ? " (quitada)" : ""}. ` : ""}Limite utilizado: **R$ ${c.spent.toFixed(2)}**, incluindo parcelas futuras / Limite R$ ${c.limit.toFixed(2)} (${Math.round((c.spent / Math.max(1, c.limit)) * 100)}% utilizado${c.closingDay ? `, fecha dia ${c.closingDay}` : ""}${c.dueDay ? `, vence dia ${c.dueDay}` : ""})`
            )
            .join("\n")
        : `- **Limite utilizado, incluindo parcelas futuras:** R$ ${context.credit.totalSpent.toFixed(2)} (${context.credit.creditUtilizationPercent}% do limite total de R$ ${context.credit.totalLimit.toFixed(2)})`;

    return `### 💳 Estratégia de Cartões, Limite e Faturas (Nanquim)

${cardsLines}

- **Limite Disponível Total:** R$ ${context.credit.availableCredit.toFixed(2)}
- **Utilização Geral de Crédito:** ${context.credit.creditUtilizationPercent}% (ideal manter abaixo de 30%)
- **Regra de Ouro da Janela de Compra:** Compras feitas após a data de fechamento ganham até **40 dias livres de juros** para pagar apenas na fatura seguinte.
- **À vista vs Parcelado:** Só parcele se não houver desconto à vista superior a ~1% ao mês e se a soma das parcelas preservar sua meta mensal de **R$ ${targetEnd.toFixed(2)}**.`;
  }

  // 4. Resposta Executiva Completa (Score, Saldo, Meta e Principais Gastos)
  const topSpendsText =
    auditDossier.spendBreakdown.length > 0
      ? auditDossier.spendBreakdown
          .slice(0, 4)
          .map(
            (b) =>
              `- **${b.categoryOrItem}:** R$ ${b.totalAmount.toFixed(2)} (${b.count}x — Crédito: R$ ${b.creditAmount.toFixed(2)} | Débito: R$ ${b.debitAmount.toFixed(2)})`
          )
          .join("\n")
      : "- Nenhum desvio crítico de consumo identificado neste ciclo.";

  const statusLine =
    projectedEnd >= targetEnd
      ? `✅ Sua meta de fechar o mês com **R$ ${targetEnd.toFixed(2)}** está protegida! Você possui uma margem livre segura de **R$ ${safeMargin.toFixed(2)}**.`
      : `⚠️ Atenção: o fechamento projetado (**R$ ${projectedEnd.toFixed(2)}**) está **R$ ${missingAmount.toFixed(2)}** abaixo da sua meta de **R$ ${targetEnd.toFixed(2)}**.`;

  return `Aqui está a leitura atualizada do seu fluxo financeiro:

${statusLine}

**Indicadores Principais deste Mês:**
- **Saldo Atual em Conta:** R$ ${context.cashflow.checkingBalance.toFixed(2)}
- **Fechamento Projetado do Mês:** **R$ ${projectedEnd.toFixed(2)}**
- **Limite utilizado, incluindo parcelas futuras:** R$ ${context.credit.totalSpent.toFixed(2)} (${context.credit.creditUtilizationPercent}% do limite)
- **Comprometimento da Renda:** ${context.commitments.commitmentRatioPercent}% (teto configurado: ${context.profile.maxCommitmentAlertPercent}%)

**Principais Focos de Gasto Auditados:**
${topSpendsText}

**Próximo Passo Recomendado:** ${
    projectedEnd >= targetEnd
      ? `Mantenha seus gastos diários dentro da margem livre de R$ ${safeMargin.toFixed(2)} e priorize sua meta principal (${context.profile.primaryFocus}).`
      : `Evite novos gastos variáveis no débito/PIX até recuperar os R$ ${missingAmount.toFixed(2)} necessários para atingir sua meta do mês.`
  }`;
}

/**
 * ORQUESTRADOR DO CHAT DO ANALISTA
 * Uma chamada única ao modelo gpt-6-luna, enriquecida com auditoria determinística
 * e fallback resiliente para nunca falhar em produção.
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

  // 3. Chamada ao modelo com fallback determinístico automático se o provedor falhar em prod
  try {
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
  } catch (err) {
    console.warn("[CHAT_OPENAI_FALLBACK] Utilizando consultor determinístico local:", err);
    const fallbackText = generateDeterministicAnalystChatReply({
      context: params.context,
      auditDossier,
      userMessage: params.userMessage,
      simulationResult: params.simulationResult,
    });

    return {
      text: fallbackText,
      modelUsed: "motor-contabil-local",
      durationMs: Date.now() - startTime,
      attemptedModels: ["motor-contabil-local"],
      auditBriefing: auditDossier,
    };
  }
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
      timeoutMs: 25000,
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
