import { NextRequest, NextResponse } from "next/server";
import { callGeminiCascade, GeminiChatMessage } from "@/lib/services/geminiService";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  buildFinancialAnalystSystemPrompt,
  simulatePurchaseImpact,
  PurchaseSimulationInput,
} from "@/lib/services/financialContextService";
import {
  redactKnownFinancialText,
  type FinancialTextPrivacyInput,
} from "@/lib/services/privacyService";
import { verifyServerAuth } from "@/lib/auth/serverAuth";
import { checkRateLimit } from "@/lib/utils/rateLimiter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 2_000;

function sanitizeChatMessage(
  content: unknown,
  privacyInput: FinancialTextPrivacyInput
): string {
  if (typeof content !== "string") return "";
  return redactKnownFinancialText(content, privacyInput).slice(0, MAX_MESSAGE_LENGTH).trim();
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }

    // Rate Limiting anti-abuso e anti-Denial-of-Wallet (máx 15 mensagens por minuto por usuário)
    const rateLimit = checkRateLimit(`ai-chat:${authResult.user.uid}`, 15, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Muitas mensagens em sequência. Aguarde ${rateLimit.retryAfterSec} segundos antes de enviar outra pergunta.`,
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
      messages = [],
      userMessage,
      simulation,
      userProfile,
      cards = [],
      transactions = [],
      recurringItems = [],
      goals = [],
      mainBalance = 0,
      monthIncome = 0,
      monthExpense = 0,
      monthlyProjections = [],
    } = body;

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

    let systemPrompt = buildFinancialAnalystSystemPrompt(safeContext);

    let simulationResult = null;
    if (simulation && typeof simulation.amount === "number" && simulation.amount > 0) {
      simulationResult = simulatePurchaseImpact(
        simulation as PurchaseSimulationInput,
        telemetry,
        cards
      );

      systemPrompt += `\n=== SIMULAÇÃO DE COMPRA ATIVA SOLICITADA PELO USUÁRIO ===
- Valor da Compra: R$ ${simulationResult.amount.toFixed(2)}
- Forma de Pagamento: ${simulationResult.method === "cash" ? "À vista (Débito/PIX)" : `Cartão de Crédito (${simulationResult.cardName})`}
- Parcelas: ${simulationResult.installments}x de R$ ${simulationResult.monthlyInstallmentAmount.toFixed(2)}
- Saldo em Conta Antes: R$ ${simulationResult.before.checkingBalance.toFixed(2)} ➔ Depois: R$ ${simulationResult.after.checkingBalance.toFixed(2)}
- Comprometimento de Renda Antes: ${simulationResult.before.monthlyCommitmentPercent}% ➔ Depois: ${simulationResult.after.monthlyCommitmentPercent}% (Teto: ${safeContext.profile.maxCommitmentAlertPercent}%)
- Limite Disponível no Cartão Antes: R$ ${simulationResult.before.cardAvailableLimit?.toFixed(2) ?? "N/A"} ➔ Depois: R$ ${simulationResult.after.cardAvailableLimit?.toFixed(2) ?? "N/A"}
- Veredito Matemático Preliminar: [${simulationResult.verdict.toUpperCase()}] - ${simulationResult.verdictMessage}

INSTRUÇÃO PARA AVALIAÇÃO DA COMPRA:
Apresente seu parecer de assistente com clareza e empatia:
1. Responda diretamente se é recomendável ou não realizar essa compra no momento;
2. Destaque o impacto no saldo líquido ou nas próximas faturas em números simples;
3. Mostre o efeito dessa compra nas metas ativas (se atrasará alguma meta);
4. Se o risco for alto ou alerta, sugira um plano alternativo (ex: esperar N meses, negociar desconto à vista, ou poupar R$ X antes).`;
    }

    systemPrompt += `\n=== INSTRUÇÕES DE ATENDIMENTO NO CHAT DO ANALISTA FINANCEIRO (CFO) ===
1. RESPOSTAS DIRETAS, SEM ENROLAÇÃO E SEM TEXTINHO:
   - Seja conciso, executivo e direto ao ponto. Use valores em negrito e listas com marcadores.
   - Responda sem rodeios, sem introduções vazias.
2. REGRA CONTÁBIL DE CAIXA vs CARTÃO DE CRÉDITO:
   - Se o usuário perguntar "quanto eu tenho ainda?", informe o saldo atual da conta corrente e a sobra líquida real em conta deste mês (entradas - saídas no débito/PIX).
   - Se o usuário perguntar "quanto eu tenho pra gastar mês que vem?", informe a fatura de cartão e compromissos que vencerão no próximo mês, calculando com clareza o Saldo Livre Projetado para Gastar mês que vem.
3. GASTOS ESPECÍFICOS, HÁBITOS DE CONSUMO E SEGREGAÇÃO CRÉDITO vs DÉBITO:
   - Inspecione tanto os gastos no CARTÃO DE CRÉDITO quanto no DÉBITO/PIX, identificando nominalmente os estabelecimentos e hábitos de consumo frequentes.
   - Agrupe e padronize por itens específicos (ex: Chiquinho, sorveterias, McDonald's, padarias) ou por categorias comportamentais (ex: Sobremesas & Doces, Lanches & Fast Food, Cafés & Cantinas, Restaurantes & Delivery).
   - Sempre quantifique o número de compras, o valor total e o detalhamento do meio de pagamento:
     * "Você teve X gastos com [Hábito/Item] totalizando R$ Y (sendo R$ A no cartão de crédito e R$ B no débito/PIX)."
   - Descubra os hábitos reais a partir do extrato do usuário.
4. REALITY CHECK PARA MESES FUTUROS (DEZEMBRO / PROJEÇÕES):
   - Se o usuário perguntar sobre o futuro (ex: final do ano, Dezembro ou meses à frente), lembre-se de que o livro-caixa registra apenas parcelas e contas já contratadas.
   - Pondere que despesas do dia a dia naturalmente continuarão existindo (baseline estimado em ~R$ ${safeContext.historicalVariableBaseline.toFixed(2)}/mês).
   - Oriente de forma equilibrada: informe a projeção contratada, mas alerte preventivamente que o saldo livre final real será reduzido pelas compras do cotidiano.
5. PARCELAMENTOS DILUÍDOS (SEM ALARMISMO):
   - Entenda que compras parceladas divididas nos próximos meses são normais. Mostre as competências de vencimento e declare que, enquanto o saldo livre projetado de cada mês for positivo, o fluxo está saudável.`;

    // Monta o histórico de mensagens
    const conversationMessages: GeminiChatMessage[] = [];
    const privacyInput: FinancialTextPrivacyInput = {
      userProfile,
      cards,
      transactions,
      recurringItems,
      goals,
      simulationDescription:
        simulation && typeof simulation.description === "string"
          ? simulation.description
          : undefined,
    };

    // Aceita apenas o contrato público do chat e mantém as oito entradas válidas mais recentes.
    const sanitizedHistory: GeminiChatMessage[] = [];
    if (Array.isArray(messages)) {
      for (const message of messages.slice(-MAX_HISTORY_MESSAGES)) {
        if (!message || typeof message !== "object") continue;
        const candidate = message as { role?: unknown; content?: unknown };
        if (
          candidate.role !== "user" &&
          candidate.role !== "assistant" &&
          candidate.role !== "model"
        ) {
          continue;
        }

        const content = sanitizeChatMessage(candidate.content, privacyInput);
        if (!content) continue;
        sanitizedHistory.push({
          role: candidate.role === "assistant" ? "model" : candidate.role,
          content,
        });
      }
    }
    conversationMessages.push(...sanitizedHistory);

    // Adiciona a mensagem atual se fornecida separadamente
    const sanitizedUserMessage = sanitizeChatMessage(userMessage, privacyInput);
    if (sanitizedUserMessage) {
      conversationMessages.push({
        role: "user",
        content: sanitizedUserMessage,
      });
    }

    if (conversationMessages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhuma mensagem enviada para o chat." },
        { status: 400 }
      );
    }

    const response = await callGeminiCascade({
      systemPrompt,
      messages: conversationMessages,
      temperature: 0.4,
      maxOutputTokens: 2048,
    });

    return NextResponse.json({
      success: true,
      message: response.text,
      modelUsed: response.modelUsed,
      durationMs: response.durationMs,
      attemptedModels: response.attemptedModels,
      simulationResult,
    });
  } catch {
    console.error("[AI_CHAT_ERROR]", { errorCode: "AI_CHAT_FAILED" });
    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível processar a conversa no momento.",
      },
      { status: 500 }
    );
  }
}
