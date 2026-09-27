import test from "node:test";
import assert from "node:assert/strict";
import {
  FAST_AUDITOR_MODELS,
  HEAVY_STRATEGIC_MODELS,
  MODEL_CASCADE,
} from "../lib/services/geminiService.ts";
import {
  runAuditorAgent,
} from "../lib/services/agentManagerService.ts";

test("Divisão de modelos entre agentes está configurada corretamente", () => {
  // Agente 1 (Auditor): tarefas leves/rápidas com Gemini Flash Lite ativo na liderança
  assert.equal(FAST_AUDITOR_MODELS[0], "gemini-3.5-flash-lite");
  assert.ok(FAST_AUDITOR_MODELS.includes("gemini-3.1-flash-lite"));
  assert.ok(FAST_AUDITOR_MODELS.includes("gemini-2.5-flash"));

  // Agente 2 (Strategic CFO): tarefas pesadas/complexas com Gemini 3.8 Flash e 3.7 Flash na liderança
  assert.equal(HEAVY_STRATEGIC_MODELS[0], "gemini-3.8-flash");
  assert.equal(HEAVY_STRATEGIC_MODELS[1], "gemini-3.7-flash");

  // Cascata global preservada
  assert.equal(MODEL_CASCADE.length, 8);
});

test("runAuditorAgent gera dossiê determinístico de fallback em caso de ausência de rede", async () => {
  const mockContext = {
    credit: { totalSpent: 750 },
    commitments: { recurringMonthlyTotal: 500, isOverLimit: false },
    lifestyleHabits: [
      { habitName: "Sobremesas", total: 90, count: 2, creditAmount: 90, debitAmount: 0, examples: ["Sorvete"] },
    ],
    topSpendItems: [
      { title: "Chiquinho Sorvetes", total: 90, count: 2, creditAmount: 90, debitAmount: 0 },
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
  assert.equal(dossier.spendBreakdown[0].categoryOrItem, "Chiquinho Sorvetes");
});
