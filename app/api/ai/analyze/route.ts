import { NextRequest, NextResponse } from "next/server";
import { callGeminiCascade } from "@/lib/services/geminiService";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  buildFinancialAnalystSystemPrompt,
  SafeFinancialContext,
  isExcludedFromHabitAnalysis,
  inferHabitCategory,
} from "@/lib/services/financialContextService";
import { verifyServerAuth } from "@/lib/auth/serverAuth";
import { checkRateLimit } from "@/lib/utils/rateLimiter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export * from "@/lib/services/financialDiagnosisService";
import {
  safeParseFinancialDiagnosis,
  type FinancialDiagnosis,
  type SpecificExpenseAlert,
  type SpendingPatternItem,
  type FutureProjectionItem,
  type ActionableSuggestionItem,
  type CashflowWindowSummary,
  type InstallmentScheduleItem,
  type ClientProfileAssessment,
  type FutureMonthsRealityCheck,
} from "@/lib/services/financialDiagnosisService";

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }

    // Rate Limiting anti-abuso e anti-Denial-of-Wallet (máx 5 análises profundas por minuto por usuário)
    const rateLimit = checkRateLimit(`ai-analyze:${authResult.user.uid}`, 5, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Muitas solicitações de diagnóstico financeiro em sequência. Aguarde ${rateLimit.retryAfterSec} segundos antes de solicitar uma nova análise.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSec),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const body = await req.json();
    const {
      userProfile,
      cards = [],
      transactions = [],
      recurringItems = [],
      goals = [],
      mainBalance = 0,
      monthIncome = 0,
      monthExpense = 0,
      monthlyProjections = [],
      dismissedPatterns = [],
    } = body;

    // Proteção de sobrecarga: limita o tamanho dos arrays processados pela IA
    const safeCards = Array.isArray(cards) ? cards.slice(0, 30) : [];
    const safeTransactions = Array.isArray(transactions) ? transactions.slice(0, 300) : [];
    const safeRecurring = Array.isArray(recurringItems) ? recurringItems.slice(0, 50) : [];
    const safeGoals = Array.isArray(goals) ? goals.slice(0, 30) : [];

    const telemetry = synthesizeFinancialTelemetry({
      userProfile,
      cards: safeCards,
      transactions: safeTransactions,
      recurringItems: safeRecurring,
      goals: safeGoals,
      mainBalance,
      monthIncome,
      monthExpense,
      monthlyProjections,
    });
    const safeContext = createSafeFinancialContext(telemetry);

    const systemPrompt = buildFinancialAnalystSystemPrompt(safeContext);

    const safeDismissed = Array.isArray(dismissedPatterns)
      ? dismissedPatterns.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const userPrompt = `Realize o DIAGNÓSTICO FINANCEIRO EXECUTIVO do usuário para apresentar no painel do aplicativo.

POSTURA DO ANALISTA (CFO PESSOAL):
- Atue como um ANALISTA FINANCEIRO PESSOAL trabalhando lado a lado com o usuário: objetivo, direto, cirúrgico e focado em números e hábitos reais.
- MENOS TEXTINHO E SEM BLÁ BLÁ BLÁ: Elimine introduções vazias, saudações clichês e parágrafos longos de autoajuda. Vá direto aos números e às conclusões práticas com valores em negrito.
- O "executiveSummary" deve ter no MÁXIMO 3 frases assertivas:
  1) Veredito da conta no mês atual: Entradas vs Saídas em conta e a sobra líquida real obtida.
  2) Impacto no mês seguinte: Fatura acumulada no cartão de crédito e quanto consumirá da renda no próximo vencimento.
  3) Principal padrão de atenção ou ralo financeiro identificado.

DIRETRIZES FUNDAMENTAIS DO DIAGNÓSTICO:
1. GASTOS ESPECÍFICOS & HÁBITOS DE CONSUMO (CRÉDITO vs DÉBITO):
   - Inspecione detalhadamente a Seção 9 (GRUPOS MACRO DE ESTILO DE VIDA) e a Seção 8 (ESTABELECIMENTOS MAIS FREQUENTES).
   - Para CADA grupo de hábitos na Seção 9 com repetição real (count >= 2, ex: "Lanches & Fast Food", "Sobremesas & Doces", "Cafés, Padarias & Cantinas") e estabelecimentos frequentes da Seção 8 (ex: "Gasolina", "McDonald's", "Chiquinho"):
     * Crie uma entrada em 'specificExpensesAlerts' com o total acumulado, contagem de compras (>= 2) e a divisão exata entre Crédito e Débito/PIX.
     * Crie também uma entrada correspondente em 'spendingPatterns' destacando o comportamento e seu impacto no orçamento (ex: "Consumo Recorrente de Sobremesas", "Foco em Fast Food", "Despesas com Combustível").
   - ZERO ALUCINAÇÃO & RIGOR DE REPETIÇÃO:
     * Um padrão de consumo EXIGE no MÍNIMO 2 compras reais no mesmo estabelecimento ou mesmo tipo de gasto (count >= 2).
     * NUNCA crie alertas para compras isoladas (1 compra), cursos/mensalidades esporádicas (ex: Inglês), notas manuais com múltiplas despesas somadas (ex: "Gastos (Inatel...)"), ajustes na conta ou faturas de cartão.
     * Se houver poucos ou nenhum padrão com repetição real, retorne a lista 'specificExpensesAlerts' VAZIA ([]). NÃO invente padrões.
     ${safeDismissed.length > 0 ? `* O usuário descartou os seguintes padrões no passado: ${JSON.stringify(safeDismissed)}. É PROIBIDO sugerir qualquer um deles novamente.` : ""}
   - EXCLUSÃO RIGOROSA DE TRANSAÇÕES OPERACIONAIS / AJUSTES:
     * 'Ajuste na conta', 'Ajuste de saldo', faturas de cartão consolidadas (ex: "Fatura Santander", "Fatura Nubank"), rifas, sorteios ou doações informais NÃO SÃO HÁBITOS DE CONSUMO DE ESTILO DE VIDA. É PROIBIDO incluí-los em 'specificExpensesAlerts'.
   - PRECISÃO NOMINAL DO TITULAR:
     * 'Vivo Easy' ou outras operadoras de celular pertencem a 'Telefonia & Internet', NUNCA delivery nem restaurantes.
     * Pipoca / Pipoquinha é lanche/snack.
     * 'Restaurantes & Delivery' deve ser utilizado estritamente para estabelecimentos reais de refeição ou entrega de comida (ex: iFood, restaurantes, pizzarias).
   - Padronize hábitos em categorias comportamentais (ex: "Sobremesas & Doces", "Lanches & Fast Food", "Cafés, Padarias & Cantinas", "Restaurantes & Delivery", "Telefonia & Internet", etc.) ou estabelecimentos específicos frequentes (ex: Chiquinho, sorveterias, McDonald's, padarias).
   - Preencha 'specificExpensesAlerts' informando obrigatoriamente:
     * 'item': nome do hábito ou estabelecimento
     * 'habitCategory': categoria comportamental padronizada
     * 'totalAmount': valor total acumulado
     * 'count': quantidade de transações (>= 2)
     * 'creditAmount': total no cartão de crédito
     * 'debitAmount': total no débito/PIX
     * 'paymentBreakdown': resumo textual (ex: "Crédito: R$ 80,00 | Débito: R$ 40,00")
     * 'message': frase assertiva apontando a soma e a divisão crédito vs débito
2. REGRA CONTÁBIL DE CAIXA vs CARTÃO:
   - Mês atual: analise o fluxo de caixa em conta (entradas - saídas em débito/PIX = sobra real).
   - Cartão de crédito: trate como compromisso que impacta APENAS NO MÊS SEGUINTE (quando a fatura é paga).
   - Preencha 'cashflowWindow' com insights diretos e números claros.
3. REALITY CHECK PARA MESES FUTUROS (Ex: Dezembro / Projeções):
   - Considere que o livro-caixa registra apenas parcelas e fixas agendadas. O usuário naturalmente continuará tendo gastos variáveis do dia a dia (baseline de ~R$ ${safeContext.historicalVariableBaseline.toFixed(2)}/mês).
   - Preencha 'futureMonthsRealityCheck' alertando de forma madura que a sobra real será menor que a sobra bruta nominal, sem tratar isso como verdade absoluta inflexível.
4. PERFIL DO CLIENTE & ALINHAMENTO:
   - Avalie o alinhamento entre a renda mensal base (R$ ${safeContext.profile.monthlyIncomeBase.toFixed(2)}), a persona (${safeContext.profile.persona}), o risco (${safeContext.profile.riskTolerance}) e a meta principal ("${safeContext.profile.primaryFocus}").
   - Preencha 'clientProfileAssessment'.
5. PARCELAS DILUÍDAS: Em 'installmentSchedule', mostre que parcelamentos futuros são normais se o saldo livre de cada mês se mantiver positivo.

RESPONDA ESTRITAMENTE EM FORMATO JSON com a seguinte estrutura:
{
  "healthScore": number, // pontuação inteira de 0 a 100
  "healthStatus": "excellent" | "healthy" | "attention" | "critical",
  "executiveSummary": "texto executivo direto do analista (máx 3 frases assertivas com valores)",
  "spendingPatterns": [
    {
      "title": "Sobremesas & Confeitarias",
      "description": "2 compras em docerias somando R$ 92,73 (100% no cartão de crédito).",
      "type": "info"
    },
    {
      "title": "Lanches & Fast Food",
      "description": "4 pedidos acumulando R$ 167,50 no crédito, aumentando a fatura seguinte.",
      "type": "warning"
    },
    {
      "title": "Abastecimento Frequente",
      "description": "2 abastecimentos somando R$ 90,20 pagos no débito/PIX com impacto direto no caixa.",
      "type": "info"
    }
  ],
  "specificExpensesAlerts": [
    {
      "item": "Lanches & Fast Food",
      "habitCategory": "Lanches & Fast Food",
      "totalAmount": 167.50,
      "count": 4,
      "creditAmount": 167.50,
      "debitAmount": 0.00,
      "paymentBreakdown": "100% no Crédito (R$ 167,50)",
      "alertType": "warning",
      "message": "Identificamos 4 compras com fast food somando R$ 167,50 totalmente no cartão de crédito."
    },
    {
      "item": "Sobremesas & Doces (ex: Chiquinho / Sorvete)",
      "habitCategory": "Sobremesas & Doces",
      "totalAmount": 92.73,
      "count": 2,
      "creditAmount": 92.73,
      "debitAmount": 0.00,
      "paymentBreakdown": "100% no Crédito (R$ 92,73)",
      "alertType": "info",
      "message": "Você teve 2 gastos com sobremesas e doces somando R$ 92,73 100% no crédito."
    },
    {
      "item": "Gasolina",
      "habitCategory": "Transporte & Mobilidade",
      "totalAmount": 90.20,
      "count": 2,
      "creditAmount": 0.00,
      "debitAmount": 90.20,
      "paymentBreakdown": "100% no Débito/PIX (R$ 90,20)",
      "alertType": "info",
      "message": "Foram 2 abastecimentos somando R$ 90,20 pagos diretamente no débito em conta."
    }
  ],
  "cashflowWindow": {
    "currentMonth": {
      "insight": "insight direto sobre a sobra líquida em conta deste mês"
    },
    "nextMonth": {
      "insight": "insight claro sobre a fatura do cartão e o saldo livre projetado mês que vem"
    }
  },
  "installmentSchedule": [
    {
      "period": "ex: Outubro/2026",
      "dueDateHint": "Vencimento em torno do dia 15",
      "cardInstallmentsAmount": 500.00,
      "status": "safe" | "warning" | "alert",
      "explanation": "explicação de que a parcela está distribuída no mês sem aperto"
    }
  ],
  "futureMonthsRealityCheck": {
    "realityNote": "orientação realista preventiva sobre gastos variáveis do dia a dia em meses futuros como Dezembro"
  },
  "clientProfileAssessment": {
    "profileAlignmentInsight": "como os gastos e fluxo atuais conversam com a renda base, arquétipo e meta do cliente",
    "recommendedActionForGoal": "ação tática para acelerar a meta principal"
  },
  "futureProjections": [
    {
      "period": "ex: Outubro/2026 ou Próximos 30 dias",
      "description": "previsão contábil do mês com base no saldo livre projetado, alertando se fecha no azul ou no vermelho",
      "severity": "info" | "warning" | "alert"
    }
  ],
  "actionableSuggestions": [
    {
      "title": "título da melhoria recomendada",
      "action": "ação tática prática e sem rodeios com valor estimado",
      "potentialGain": "ganho ou economia estimada (ex: R$ 200/mês)",
      "targetGoal": "meta beneficiada se houver"
    }
  ]
}

IMPORTANTE: Responda APENAS o JSON válido. Não coloque texto antes ou depois. Nunca use aspas duplas dentro dos valores de texto.`;

    const response = await callGeminiCascade({
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.25,
      jsonMode: true,
      maxOutputTokens: 3500,
    });

    const parsedDiagnosis = safeParseFinancialDiagnosis(response.text, safeContext, safeDismissed);
    const sanitizedDiagnosis = JSON.parse(JSON.stringify(parsedDiagnosis));

    return NextResponse.json({
      success: true,
      diagnosis: sanitizedDiagnosis,
      modelUsed: response.modelUsed,
      durationMs: response.durationMs,
      attemptedModels: response.attemptedModels,
    });
  } catch {
    console.error("[AI_ANALYZE_ERROR]", { errorCode: "AI_ANALYZE_FAILED" });
    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível concluir a análise financeira no momento.",
      },
      { status: 500 }
    );
  }
}
