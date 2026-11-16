import test from "node:test";
import assert from "node:assert/strict";
import { buildFinancialAnalytics, resolveReferenceDate, buildAnalyticsFromRequest } from "../lib/services/financialAnalyticsService.ts";
import { buildBriefingFacts, buildBriefingSignals, moodFromSignals, buildChatFactBlock } from "../lib/services/aiBriefingService.ts";
import { SCENARIOS } from "../evals/ai/scenarios.ts";

/**
 * Análise do mês que alimenta a IA. Cada teste trava um erro real visto em produção:
 * 1) "contas superam o saldo" ignorando o salário que ainda vai entrar;
 * 2) gasto com lazer somado de vários meses apresentado como deste mês;
 * 3) "sobra do mês" negativa no meio do mês tratada como resultado final.
 */

const realCase = SCENARIOS.find((s) => s.id === "salario-a-caminho");
const a = buildFinancialAnalytics(realCase.analyticsInput);
const facts = buildBriefingFacts(a);
const fact = (id) => facts.find((f) => f.id === id);
const signals = buildBriefingSignals(facts, a);

test("o fechamento do mês soma o que ainda vai entrar (igual à tela de Planejamento)", () => {
  assert.equal(a.cash.balanceToday, 5.65);
  assert.equal(a.cash.toReceive, 2133.08);
  assert.equal(a.cash.toPay, 764.04);
  assert.equal(a.cash.projectedClose, 1374.69);
  assert.equal(fact("saldo_fim_mes").value, 1374.69);
});

test("contas maiores que o saldo de hoje NÃO viram alerta crítico quando as entradas cobrem", () => {
  assert.notEqual(moodFromSignals(signals), "critico");
  assert.ok(!signals.some((s) => s.level === "critico"));
  assert.ok(signals.some((s) => s.level === "positivo" && s.factIds.includes("a_receber")), "as entradas a receber cobrem as contas");
});

test("a linha do tempo aponta o aperto de caixa por DATA: negativo no dia 17, coberto no dia 20", () => {
  assert.equal(a.timeline.negativeFromDay, 17);
  assert.equal(a.timeline.lowestBalance, -494.35);
  assert.equal(a.timeline.recoveryIncome?.day, 20);
  assert.equal(a.timeline.recoveryIncome?.title, "Salario (Adiantamento)");
  const timing = signals.find((s) => s.factIds.includes("dia_fica_negativo"));
  assert.equal(timing?.level, "atencao");
  assert.match(timing.text, /problema de data/);
});

test("categorias e hábitos contam só o mês atual (lazer de meses anteriores não entra)", () => {
  const lazer = a.spending.categories.find((c) => c.category === "Lazer & Hobbies");
  assert.equal(lazer.monthToDate, 46);
  assert.equal(lazer.count, 1);
  assert.ok(lazer.samePeriodAverage > 46, "a média dos meses anteriores fica separada, para comparação");
  assert.ok(!facts.some((f) => f.value > 1800 && /lazer/i.test(f.label)), "nenhum fato soma o lazer de vários meses");
});

test("contas fixas ficam fora do ritmo de gastos do dia a dia", () => {
  assert.equal(a.spending.fixedToDate, 1100); // aluguel
  assert.equal(a.spending.variableToDate, 982.61);
  assert.ok(a.spending.pacePercent < 100, "gastando menos que a média do mesmo período");
});

test("cada fato diz o período (hoje, até hoje, até o fim do mês)", () => {
  assert.match(fact("saldo_hoje").label, /hoje/);
  assert.match(fact("pago_mes").label, /Já pago/);
  assert.match(fact("a_receber").label, /até o fim/);
  assert.match(fact("gasto_dia_a_dia").label, /até hoje/);
});

test("mês que fecha negativo mesmo com as entradas continua crítico", () => {
  const red = buildFinancialAnalytics(SCENARIOS.find((s) => s.id === "mes-no-vermelho").analyticsInput);
  assert.equal(moodFromSignals(buildBriefingSignals(buildBriefingFacts(red), red)), "critico");
});

test("o chat recebe a mesma ficha, linha do tempo e regras de período", () => {
  const block = buildChatFactBlock(a);
  assert.match(block, /saldo_fim_mes \| Saldo previsto no fim de/);
  assert.match(block, /dia 17: sai/);
  assert.match(block, /Nunca compare o que falta pagar só com o saldo de hoje/);
  assert.equal(buildChatFactBlock(null), "");
});

test("data de referência do app só é aceita perto do relógio do servidor", () => {
  const server = new Date(2026, 10, 15, 23, 30);
  assert.equal(resolveReferenceDate("2026-11-16", server).getDate(), 16); // fuso diferente, mesma madrugada
  assert.equal(resolveReferenceDate("2020-01-01", server), server);
  assert.equal(resolveReferenceDate("lixo", server), server);
});

test("pedido sem dados vira análise vazia, sem quebrar", () => {
  const empty = buildAnalyticsFromRequest({}, new Date(2026, 10, 15, 12));
  assert.equal(empty.cash.projectedClose, 0);
  assert.equal(empty.spending.monthToDate, 0);
  assert.equal(empty.incomeKnown, false);
});
