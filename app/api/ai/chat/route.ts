import { NextRequest, NextResponse } from "next/server";
import { callGeminiCascade, GeminiChatMessage } from "@/lib/services/geminiService";
import {
  synthesizeFinancialTelemetry,
  buildFinancialAnalystSystemPrompt,
  simulatePurchaseImpact,
  PurchaseSimulationInput,
} from "@/lib/services/financialContextService";

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

    let systemPrompt = buildFinancialAnalystSystemPrompt(telemetry);

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
- Comprometimento de Renda Antes: ${simulationResult.before.monthlyCommitmentPercent}% ➔ Depois: ${simulationResult.after.monthlyCommitmentPercent}% (Teto: ${telemetry.user.maxCommitmentAlertPercent}%)
- Limite Disponível no Cartão Antes: R$ ${simulationResult.before.cardAvailableLimit?.toFixed(2) ?? "N/A"} ➔ Depois: R$ ${simulationResult.after.cardAvailableLimit?.toFixed(2) ?? "N/A"}
- Veredito Matemático Preliminar: [${simulationResult.verdict.toUpperCase()}] - ${simulationResult.verdictMessage}

INSTRUÇÃO PARA AVALIAÇÃO DA COMPRA:
Apresente seu parecer de analista com clareza executiva:
1. Responda diretamente se é recomendável ou não realizar essa compra no momento;
2. Destaque o impacto no saldo líquido ou nas próximas faturas;
3. Mostre o efeito dessa compra nas metas ativas (se atrasará alguma meta);
4. Se o risco for alto ou alerta, sugira um plano alternativo (ex: esperar N meses, negociar desconto à vista, ou poupar R$ X antes).`;
    }

    // Monta o histórico de mensagens
    const conversationMessages: GeminiChatMessage[] = [];

    // Adiciona mensagens anteriores do chat (limita a últimas 8 para manter foco e tokens)
    const recentMessages = messages.slice(-8);
    for (const msg of recentMessages) {
      conversationMessages.push({
        role: msg.role === "assistant" ? "model" : (msg.role as "user" | "model"),
        content: msg.content,
      });
    }

    // Adiciona a mensagem atual se fornecida separadamente
    if (userMessage) {
      conversationMessages.push({
        role: "user",
        content: userMessage,
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
  } catch (error: unknown) {
    console.error("[API AI Chat Error]:", error);
    const message = error instanceof Error ? error.message : "Erro interno no processamento do chat";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
