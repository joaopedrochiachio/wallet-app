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
    } = body;

    const telemetry = synthesizeFinancialTelemetry({
      userProfile,
      cards,
      transactions,
      recurringItems,
      goals,
      mainBalance,
      monthIncome,
      monthExpense,
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
4. Se o risco for alto ou alerta, sugira um plano alternativo (ex: esperar N meses, negociar desconto à vista, ou poupar R$ X antes).

=== DIRETRIZ DE LINGUAGEM DO ASSISTENTE NO CHAT ===
- Converse de forma formal, porém acolhedora, natural e intuitiva.
- Trate o usuário com respeito e proximidade, explicando o 'porquê' de cada número sem jargões frios.
- Entregue a complexidade cruzada de forma simples e imediatamente compreensível.`;
    }

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
