import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { orchestrateAnalystChat } from "../lib/services/agentManagerService.ts";
import { OpenAIIntegrationError, resetOpenAIClient } from "../lib/services/openaiService.ts";

/**
 * O chat nunca pode responder com texto pronto fingindo ser a IA.
 * Quando o provedor falha, o erro precisa chegar até a rota/usuário.
 */

const context = {
  user: { persona: "optimizer", riskTolerance: "moderate", aiTone: "analytical", primaryFocus: "Reserva" },
  profile: { monthlyIncomeBase: 5000, maxCommitmentAlertPercent: 60, persona: "optimizer", riskTolerance: "moderate", primaryFocus: "Reserva" },
  credit: { totalLimit: 0, totalSpent: 0, availableCredit: 0, creditUtilizationPercent: 0, cardsSummary: [] },
  cashflow: { checkingBalance: 1000, monthIncomeRealized: 0, monthExpenseRealized: 0, netCashflow: 0, savingsRatePercent: 0 },
  commitments: { recurringMonthlyTotal: 0, commitmentRatioPercent: 0, isOverLimit: false, recurringItems: [] },
  categories: [],
  goals: [],
  historicalVariableBaseline: 0,
  topSpendItems: [],
  lifestyleHabits: [],
};

function withEnv(overrides, fn) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  resetOpenAIClient();
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetOpenAIClient();
  });
}

test("chat sem chave da OpenAI falha de forma explícita (sem resposta pronta)", async () => {
  await withEnv({ OPENAI_API_KEY: undefined, GEMINI_API_KEY: undefined }, async () => {
    await assert.rejects(
      orchestrateAnalystChat({
        context,
        systemPrompt: "Sistema",
        conversationMessages: [{ role: "user", content: "Quanto posso gastar hoje?" }],
        userMessage: "Quanto posso gastar hoje?",
      }),
      (err) => err instanceof OpenAIIntegrationError && err.code === "MISSING_OPENAI_API_KEY"
    );
  });
});

test("a chave da OpenAI só é lida de OPENAI_API_KEY (sem variantes públicas nem chave embutida)", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib/services/openaiService.ts"), "utf8");
  assert.doesNotMatch(source, /process\.env\.NEXT_PUBLIC_/);
  assert.doesNotMatch(source, /Object\.entries\(process\.env\)/, "não deve varrer todas as variáveis de ambiente");
  assert.doesNotMatch(source, /fromCharCode\(\s*\.\.\./, "não deve montar chaves a partir de códigos de caractere");
  assert.doesNotMatch(source, /sk-(proj-)?[A-Za-z0-9_-]{20,}/, "não deve conter chave literal");
});

test("rota do chat não devolve texto do motor local quando a IA falha", () => {
  const route = fs.readFileSync(path.join(process.cwd(), "app/api/ai/chat/route.ts"), "utf8");
  assert.doesNotMatch(route, /motor-contabil-local/);
  assert.match(route, /success: false, error: failure\.error/);
});
