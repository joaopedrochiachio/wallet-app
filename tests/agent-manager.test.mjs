import test from "node:test";
import assert from "node:assert/strict";
import {
  OPENAI_MODELS,
  MODEL_PRICING,
  resolveConfiguredModel,
  calculateEstimatedCostUsd,
} from "../lib/services/openaiService.ts";
import {
  runAuditorAgent,
  generateDeterministicAuditDossier,
  ENABLE_AI_AUDITOR,
  formatAuditDossierForPrompt,
} from "../lib/services/agentManagerService.ts";

test("Configuração de modelos OpenAI define Luna como principal e Sol como opcional", () => {
  // Modelo principal: gpt-6-luna
  assert.equal(OPENAI_MODELS.MAIN, "gpt-6-luna");
  // Modelo opcional: gpt-6-sol (preparado por configuração, desativado por padrão)
  assert.equal(OPENAI_MODELS.OPTIONAL, "gpt-6-sol");

  // Resolução padrão sem override
  assert.equal(resolveConfiguredModel(), "gpt-6-luna");

  // Resolução com override documentado
  assert.equal(resolveConfiguredModel("gpt-6-sol"), "gpt-6-sol");

  // Auditoria de IA desativada por padrão (auditor determinístico ativo)
  assert.equal(ENABLE_AI_AUDITOR, false);
});

test("Tabela de preços está documentada e calcula custos corretamente para Luna e Sol", () => {
  assert.ok(MODEL_PRICING["gpt-6-luna"]);
  assert.ok(MODEL_PRICING["gpt-6-sol"]);
  assert.equal(MODEL_PRICING["gpt-6-luna"].inputPerMillion, 0.15);
  assert.equal(MODEL_PRICING["gpt-6-luna"].outputPerMillion, 0.60);

  // Exemplo de cálculo: 1000 tokens de entrada e 500 de saída no gpt-6-luna
  const costResult = calculateEstimatedCostUsd("gpt-6-luna", {
    inputTokens: 1000,
    outputTokens: 500,
    reasoningTokens: 0,
  });

  // (1000 / 1M) * 0.15 = 0.00015
  // (500 / 1M) * 0.60 = 0.00030
  // Total = 0.00045 USD
  assert.equal(costResult.costUsd, 0.00045);
  assert.equal(costResult.isEstimated, false);
});

test("runAuditorAgent e generateDeterministicAuditDossier geram dossiê factual determinístico com dados locais", async () => {
  const mockContext = {
    credit: { totalSpent: 750, creditUtilizationPercent: 50 },
    cashflow: { savingsRatePercent: 25 },
    commitments: {
      recurringMonthlyTotal: 500,
      commitmentRatioPercent: 30,
      isOverLimit: false,
    },
    profile: { maxCommitmentAlertPercent: 60 },
    lifestyleHabits: [
      { habitName: "Sobremesas", total: 90, count: 2, creditAmount: 90, debitAmount: 0, examples: ["Sorvete"] },
    ],
    topSpendItems: [
      { title: "Chiquinho Sorvetes", total: 90, count: 2, creditAmount: 90, debitAmount: 0, habitCategory: "Sobremesas" },
      { title: "McDonald's", total: 120, count: 3, creditAmount: 80, debitAmount: 40, habitCategory: "Lanches" },
    ],
    categories: [{ category: "Alimentação" }],
  };

  const dossier = await runAuditorAgent({
    // @ts-expect-error Mock parcial para teste unitário
    context: mockContext,
    userMessage: "Quanto gastei com sobremesas?",
  });

  assert.ok(Array.isArray(dossier.relevantCategories));
  assert.ok(Array.isArray(dossier.spendBreakdown));
  assert.ok(dossier.spendBreakdown.length > 0);
  // O item de sobremesas deve ser priorizado pela busca da mensagem
  assert.equal(dossier.spendBreakdown[0].categoryOrItem, "Chiquinho Sorvetes");
  assert.equal(dossier.spendBreakdown[0].totalAmount, 90);
  assert.equal(dossier.spendBreakdown[0].count, 2);

  // Validação do formato de injeção no prompt do analista
  const promptText = formatAuditDossierForPrompt(dossier);
  assert.ok(promptText.includes("DOSSIÊ DE AUDITORIA FACTUAL"));
  assert.ok(promptText.includes("Chiquinho Sorvetes"));
  assert.ok(promptText.includes("Total R$ 90.00"));
});
