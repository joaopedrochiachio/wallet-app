import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateExpression,
  verifyCalculations,
  validateReasonedAnswer,
  collectAllowedNumbers,
  runReasonedChat,
  ReasoningFailedError,
} from "../lib/services/cofiReasoningService.ts";
import {
  buildPatternCatalog,
  formatPatternsForPrompt,
  sanitizeMemoryInput,
  patternsWorthRaising,
  memoryForRequest,
} from "../lib/services/cofiPatterns.ts";

/** Análise do mês mínima, com um hábito acima da média e cartão quase no limite. */
function analytics(overrides = {}) {
  return {
    referenceDate: "2026-11-16",
    monthName: "novembro",
    nextMonthName: "dezembro",
    day: 16,
    daysInMonth: 30,
    daysLeft: 15,
    cash: { balanceToday: 1200, receivedToDate: 3000, paidToDate: 1800, toReceive: 0, toPay: 450, invoicesToPay: 300, projectedClose: 750 },
    target: { value: 700, gap: 50, dailyRoom: 3.33, dailyCut: 0 },
    timeline: { events: [], lowestBalance: 750, lowestDay: 30, negativeFromDay: null, recoveryIncome: null, untilNextIncome: null },
    spending: {
      monthToDate: 1500, monthToDateCredit: 600, monthToDateCash: 900, fixedToDate: 500, variableToDate: 1000,
      previousMonthsWithData: 3, samePeriodAverage: 700, fullMonthAverage: 1400, pacePercent: 142.9,
      categories: [], biggestIncrease: { category: "Delivery", monthToDate: 320, count: 8, samePeriodAverage: 180, changePercent: 77.8 },
      habits: [{ name: "iFood", total: 320, count: 8, previousAverage: 180 }],
      largestPurchases: [], transactionsThisMonth: 25,
    },
    credit: { limit: 5000, used: 4600, available: 400, usagePercent: 92 },
    nextMonth: { income: 3000, committed: 1200, installments: 400, projectedFree: 1800 },
    goals: [],
    incomeKnown: true,
    ...overrides,
  };
}

const facts = [
  { id: "saldo_hoje", label: "Saldo na conta hoje", value: 1200, kind: "brl" },
  { id: "a_pagar", label: "Ainda a pagar até o fim de novembro", value: 450, kind: "brl" },
  { id: "saldo_fim_mes", label: "Saldo previsto no fim de novembro", value: 750, kind: "brl" },
  { id: "habito_1", label: "Hábito em novembro até hoje: iFood", value: 320, kind: "brl" },
];

function goodRaw(extra = {}) {
  return {
    understanding: "Você quer saber se o mês fecha bem.",
    steps: [
      { title: "Conferi o saldo de hoje", detail: "Você tem R$ 1.200,00 na conta.", factIds: ["saldo_hoje"] },
      { title: "Descontei o que falta pagar", detail: "R$ 1.200,00 − R$ 450,00 = R$ 750,00.", factIds: ["a_pagar", "saldo_fim_mes"] },
    ],
    answer: "Sim, o mês fecha com **R$ 750,00**.\n\n**O que fazer:** Guarde R$ 50,00 da folga.",
    patterns: [{ key: "habito:ifood", observation: "8 compras de iFood até hoje." }],
    followUp: { question: "Quer que eu acompanhe o iFood com você?", patternKey: "habito:ifood" },
    ...extra,
  };
}

const ctx = (memory = []) => {
  const catalog = buildPatternCatalog(analytics());
  return { facts, allowed: collectAllowedNumbers(["Meta de R$ 50,00 de folga"], facts), catalog, memory };
};

/* ---------------------------- contas ---------------------------- */

test("avalia contas em pt-BR com precedência e porcentagem", () => {
  assert.equal(evaluateExpression("R$ 1.200,00 − R$ 450,00"), 750);
  assert.equal(evaluateExpression("R$ 200 x 6"), 1200);
  assert.equal(evaluateExpression("100 + 20 × 3"), 160);
  assert.equal(evaluateExpression("R$ 1.000 × 10%"), 100);
  assert.equal(evaluateExpression("R$ 300 ÷ 0"), null);
});

test("encontra contas certas e erradas no texto", () => {
  const checks = verifyCalculations("Saldo: R$ 1.200,00 − R$ 450,00 = R$ 750,00. E 6 x R$ 200 = R$ 1.100.");
  assert.equal(checks.length, 2);
  assert.equal(checks[0].ok, true);
  assert.equal(checks[1].ok, false);
  assert.equal(checks[1].expected, 1200);
});

/* --------------------------- conferência --------------------------- */

test("resposta com valores dos dados e conta certa passa na conferência", () => {
  const r = validateReasonedAnswer(goodRaw(), ctx());
  assert.deepEqual(r.blocking, []);
  assert.equal(r.output.steps.length, 2);
  assert.equal(r.output.steps[1].facts[0].id, "a_pagar");
  assert.equal(r.output.patterns[0].title, "iFood acima do costume");
  assert.equal(r.output.followUp.patternKey, "habito:ifood");
  assert.ok(r.numbersChecked >= 5);
  assert.equal(r.calculationsChecked, 1);
});

test("valor inventado e conta errada pedem para refazer", () => {
  const raw = goodRaw({
    steps: [{ title: "Somei", detail: "R$ 1.200,00 − R$ 450,00 = R$ 800,00.", factIds: ["saldo_hoje"] }],
    answer: "Você pode gastar R$ 987,65 este mês.",
  });
  const r = validateReasonedAnswer(raw, ctx());
  assert.ok(r.blocking.some((b) => b.includes("Conta errada") && b.includes("750")));
  assert.ok(r.blocking.some((b) => b.includes("987,65")));
});

test("ids de fatos e padrões inexistentes são removidos sem travar", () => {
  const raw = goodRaw({
    steps: [{ title: "Conferi", detail: "Saldo de R$ 1.200,00.", factIds: ["saldo_hoje", "fato_inventado"] }],
    patterns: [{ key: "padrao:inventado", observation: "x" }],
  });
  const r = validateReasonedAnswer(raw, ctx());
  assert.deepEqual(r.blocking, []);
  assert.equal(r.output.steps[0].facts.length, 1);
  assert.equal(r.output.patterns.length, 0);
  assert.ok(r.notes.some((n) => n.includes("fato_inventado")));
});

test("não pergunta de novo sobre padrão que a pessoa disse ser esperado ou ignorou", () => {
  const esperado = validateReasonedAnswer(goodRaw(), ctx([{ key: "habito:ifood", status: "esperado" }]));
  assert.equal(esperado.output.followUp, null);
  const ignorado = validateReasonedAnswer(goodRaw(), ctx([{ key: "habito:ifood", status: "ignorado" }]));
  assert.equal(ignorado.output.patterns.length, 0, "padrão ignorado nem aparece");
});

test("JSON sem resposta é recusado", () => {
  assert.equal(validateReasonedAnswer({ steps: [] }, ctx()).output, null);
  assert.equal(validateReasonedAnswer(null, ctx()).output, null);
});

/* ---------------------- execução com revisão ---------------------- */

const fakeResponse = (obj) => ({
  text: typeof obj === "string" ? obj : JSON.stringify(obj),
  modelUsed: "modelo-teste",
  durationMs: 5,
  inputTokens: 10,
  cachedInputTokens: 0,
  outputTokens: 10,
  reasoningTokens: 0,
  estimatedCostUsd: 0.0001,
  isCostEstimated: false,
  requestId: "req",
});

test("se um valor não bate, refaz uma vez com o problema apontado e mostra as etapas", async () => {
  const calls = [];
  const steps = [];
  const answers = [goodRaw({ answer: "Sobra R$ 987,65." }), goodRaw()];
  const result = await runReasonedChat({
    systemPrompt: "Saldo R$ 1.200,00",
    messages: [{ role: "user", content: "O mês fecha bem?" }],
    facts,
    catalog: buildPatternCatalog(analytics()),
    memory: [],
    allowedSources: ["Guarde R$ 50,00"],
    onStep: (s) => steps.push(`${s.id}:${s.status}`),
    call: async (p) => {
      calls.push(p);
      return fakeResponse(answers[calls.length - 1]);
    },
  });
  assert.equal(result.attempts, 2);
  assert.equal(result.verification.ok, true);
  assert.ok(calls[0].jsonSchema, "pede JSON estruturado");
  assert.match(calls[1].messages.at(-1).content, /987,65/, "a segunda tentativa recebe o problema");
  assert.ok(steps.includes("conferindo:warning"));
  assert.equal(steps.at(-1), "conferindo:done");
});

test("se a segunda versão ainda falha, a resposta sai com o aviso visível", async () => {
  const result = await runReasonedChat({
    systemPrompt: "Saldo R$ 1.200,00",
    messages: [{ role: "user", content: "O mês fecha bem?" }],
    facts,
    catalog: [],
    memory: [],
    allowedSources: [],
    call: async () => fakeResponse(goodRaw({ answer: "Sobra R$ 987,65.", patterns: [], followUp: { question: "", patternKey: "" } })),
  });
  assert.equal(result.verification.ok, false);
  assert.ok(result.verification.problems.some((p) => p.includes("987,65")));
});

test("JSON inutilizável duas vezes vira erro honesto", async () => {
  await assert.rejects(
    runReasonedChat({ systemPrompt: "", messages: [{ role: "user", content: "oi" }], facts, catalog: [], memory: [], allowedSources: [], call: async () => fakeResponse("isto não é json") }),
    ReasoningFailedError
  );
});

/* ---------------------------- padrões ---------------------------- */

test("catálogo de padrões tem chaves estáveis e números da análise", () => {
  const catalog = buildPatternCatalog(analytics());
  const keys = catalog.map((p) => p.key);
  assert.deepEqual(keys, ["ritmo_gastos", "categoria:delivery", "habito:ifood", "limite_cartao"]);
  const ifood = catalog.find((p) => p.key === "habito:ifood");
  assert.match(ifood.detail, /8 compras de iFood/);
  assert.match(ifood.detail, /R\$ 320,00/);
  assert.equal(ifood.metric.value, 320);
  assert.deepEqual(buildPatternCatalog(null), []);
});

test("memória: só aceita padrões e status válidos e respeita o que a pessoa descartou", () => {
  const catalog = buildPatternCatalog(analytics());
  const clean = sanitizeMemoryInput(
    [
      { key: "habito:ifood", status: "acompanhar", baselineValue: 250, baselineAt: "2026-11-02", baselinePeriod: "2026-11", lastObservation: "<b>oi</b>" },
      { key: "limite_cartao", status: "hackeado" },
      { key: "padrao:falso", status: "novo" },
    ],
    catalog
  );
  assert.equal(clean.length, 1);
  assert.equal(clean[0].lastObservation, "oi");

  const prompt = formatPatternsForPrompt(catalog, clean, "2026-11-16");
  assert.match(prompt, /habito:ifood/);
  assert.match(prompt, /PEDIU PARA ACOMPANHAR/);
  assert.match(prompt, /valor era R\$ 250,00; agora é R\$ 320,00/);

  const memory = { limite_cartao: { key: "limite_cartao", title: "x", status: "esperado", updatedAt: "2026-11-16", timesDiscussed: 1 } };
  assert.ok(!patternsWorthRaising(catalog, memory).some((p) => p.key === "limite_cartao"));
  assert.deepEqual(memoryForRequest(catalog, memory).map((m) => m.status), ["esperado"]);
});

/* ------------------------- telas de dinheiro ------------------------- */

import { buildCashSeries, buildAuditFindings } from "../lib/services/moneyViews.ts";

test("saldo dia a dia: muda no dia de cada entrada/conta e fecha no mesmo valor da linha do tempo", () => {
  const a = analytics({
    day: 16,
    cash: { balanceToday: 1000, receivedToDate: 0, paidToDate: 0, toReceive: 3000, toPay: 1200, invoicesToPay: 0, projectedClose: 2800 },
    timeline: {
      events: [
        { day: 18, title: "Aluguel", amount: 1200, direction: "out" },
        { day: 21, title: "Salário", amount: 3000, direction: "in" },
      ],
      lowestBalance: -200, lowestDay: 18, negativeFromDay: 18, recoveryIncome: null, untilNextIncome: null,
    },
  });
  const series = buildCashSeries(a);
  assert.equal(series[0].day, 16);
  assert.equal(series.at(-1).day, 30);
  assert.equal(series.find((p) => p.day === 17).balance, 1000);
  assert.equal(series.find((p) => p.day === 18).balance, -200);
  assert.equal(series.find((p) => p.day === 21).balance, 2800);
  assert.equal(series.at(-1).balance, a.cash.projectedClose);
});

test("auditoria: ponto do parecer e padrão do app sobre o mesmo assunto aparecem uma vez só", () => {
  const catalog = buildPatternCatalog(analytics());
  const briefing = {
    headline: "x", summary: "x", mood: "atencao", highlightFactIds: [],
    negatives: [{ title: "iFood pesando no mês", explanation: "8 compras.", evidenceFactIds: ["habito_1"], action: "Segure.", severity: "alta" }],
    positives: [],
    nextStep: { title: "x", detail: "x" }, lesson: { term: "x", explanation: "x" }, suggestedQuestions: [],
  };
  const { attention } = buildAuditFindings({ briefing, facts, catalog, memory: {} });
  const ifood = attention.filter((f) => f.patternKey === "habito:ifood");
  assert.equal(ifood.length, 1, "sem repetir o assunto");
  assert.equal(ifood[0].title, "iFood pesando no mês", "vale o texto do parecer");
  assert.equal(ifood[0].tone, "critico");
  assert.equal(attention[0].patternKey, "habito:ifood", "o mais grave vem primeiro");
  // Padrões que o parecer não cobriu entram calculados pelo app
  assert.ok(attention.some((f) => f.source === "app" && f.patternKey === "limite_cartao"));
  // O que a pessoa marcou como esperado sai da lista do app
  const hidden = buildAuditFindings({ briefing: null, facts, catalog, memory: { limite_cartao: { key: "limite_cartao", title: "x", status: "esperado", updatedAt: "2026-11-16", timesDiscussed: 0 } } });
  assert.ok(!hidden.attention.some((f) => f.patternKey === "limite_cartao"));
});
