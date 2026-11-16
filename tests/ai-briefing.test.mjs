import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBriefingFacts,
  validateBriefing,
  generateAIBriefing,
  findUngroundedNumbers,
  BriefingGenerationError,
} from "../lib/services/aiBriefingService.ts";
import { buildFinancialAnalytics, resolveReferenceDate } from "../lib/services/financialAnalyticsService.ts";
import { SCENARIOS } from "../evals/ai/scenarios.ts";
import { gradeBriefing, gradeChatAnswer, summarize, startsWithImperative } from "../evals/ai/graders.ts";

/**
 * O informativo da IA só pode citar números da ficha de fatos, e a régua da
 * avaliação de inteligência precisa separar uma boa resposta de uma ruim.
 */

const scenario = SCENARIOS.find((s) => s.id === "mes-no-vermelho");
const analytics = buildFinancialAnalytics(scenario.analyticsInput);
const facts = buildBriefingFacts(analytics);
const fact = (id) => facts.find((f) => f.id === id);
const brl = (id) => `R$ ${fact(id).value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function goodBriefing() {
  return {
    headline: "Seu mês fecha no vermelho se nada mudar",
    summary: `O saldo previsto para o fim do mês é ${brl("saldo_fim_mes")}. Isso acontece porque ainda faltam ${brl("a_pagar")} em contas e faturas.`,
    mood: "critico",
    highlightFactIds: ["saldo_fim_mes", "a_pagar", "falta_meta"],
    positives: [
      { title: "Você recebeu sua renda", explanation: `Entraram ${brl("recebido_mes")} no mês, então você tem como reorganizar os pagamentos.`, evidenceFactIds: ["recebido_mes"], action: "Separe hoje o valor das contas que vencem primeiro." },
    ],
    negatives: [
      { title: "O mês fecha negativo", explanation: `Faltam ${brl("falta_meta")} para sua meta. Na prática, você vai entrar no próximo mês devendo.`, evidenceFactIds: ["falta_meta", "saldo_fim_mes", "a_pagar"], action: `Corte ${brl("corte_dia")} por dia até o fim do mês.`, severity: "alta" },
      { title: "Cartão quase sem limite", explanation: `Você usa ${fact("limite_uso_pct").value}% do limite, então sobra pouca folga para imprevistos.`, evidenceFactIds: ["limite_uso_pct"], action: "Evite novas compras no cartão nesta semana.", severity: "media" },
    ],
    nextStep: { title: "Priorize as contas fixas", detail: `Pague primeiro os ${brl("a_pagar")} de contas fixas.` },
    lesson: { term: "Saldo projetado", explanation: "É quanto sobra no fim do mês depois de pagar tudo o que já está marcado. Ele mostra hoje se o mês vai fechar no azul ou no vermelho." },
    suggestedQuestions: ["Quais contas eu pago primeiro?", "Onde eu posso cortar gastos?", "Quanto preciso economizar por dia?"],
  };
}

test("ficha de fatos traz os números-chave do mês e omite folga quando a meta está em risco", () => {
  assert.equal(fact("saldo_fim_mes").value, -940); // 320 de saldo + 0 a receber − 1.260 a pagar
  assert.equal(fact("falta_meta").value, 1440); // meta de 500
  assert.equal(fact("folga_meta"), undefined);
  assert.equal(fact("dias_restantes").value, analytics.daysLeft);
});

test("número fora da ficha é detectado; valores da ficha, dias e anos passam", () => {
  assert.deepEqual(findUngroundedNumbers(`Faltam ${brl("falta_meta")} em 16 dias de 2026`, facts), []);
  assert.deepEqual(findUngroundedNumbers("Você gastou R$ 3.333,33 com lazer", facts), [3333.33]);
});

test("informativo bom passa na validação sem perder pontos", () => {
  const { briefing, issues } = validateBriefing(goodBriefing(), facts);
  assert.ok(briefing);
  assert.equal(briefing.negatives.length, 2);
  assert.deepEqual(issues, []);
});

test("ponto com número inventado é descartado; manchete inventada invalida tudo", () => {
  const raw = goodBriefing();
  raw.negatives[1].explanation = "Você gastou R$ 9.999,00 em lazer.";
  const partial = validateBriefing(raw, facts);
  assert.equal(partial.briefing.negatives.length, 1);
  assert.ok(partial.issues.some((i) => i.path === "negatives[1].explanation"));

  raw.headline = "Você perdeu R$ 4.321,00 este mês";
  assert.equal(validateBriefing(raw, facts).briefing, null);
});

test("geração tenta de novo com o erro apontado e falha de forma explícita se a IA insistir", async () => {
  const prompts = [];
  const fakeModel = (text) => async (p) => {
    prompts.push(p.prompt);
    return { text, modelUsed: "fake", durationMs: 1, inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, reasoningTokens: 0, estimatedCostUsd: 0, isCostEstimated: true, requestId: "r" };
  };
  const bad = { ...goodBriefing(), summary: "Seu saldo é R$ 7.777,00." };
  await assert.rejects(generateAIBriefing({ analytics, callModel: fakeModel(JSON.stringify(bad)) }), BriefingGenerationError);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /recusada pela conferência[\s\S]*7777/);

  const ok = await generateAIBriefing({ analytics, callModel: fakeModel(JSON.stringify(goodBriefing())) });
  assert.equal(ok.attempts, 1);
  assert.equal(ok.briefing.mood, "critico");
});

test("régua de inteligência: resposta boa chega ao nível 5, resposta ruim fica no nível baixo", () => {
  const good = goodBriefing();
  const goodChecks = gradeBriefing({ scenario, facts, rawOutput: good, briefing: validateBriefing(good, facts).briefing, attempts: 1 });
  const goodSum = summarize(goodChecks);
  assert.equal(goodSum.reached, 5, goodChecks.filter((c) => !c.pass).map((c) => `N${c.level} ${c.name}: ${c.detail}`).join("\n"));

  const bad = {
    ...good,
    mood: "positivo",
    headline: "PARABÉNS!!! Sua meta está garantida e você está muito bem neste mês, continue assim",
    negatives: [{ ...good.negatives[1], severity: "baixa", action: "cartão" }],
    summary: "Sua meta está garantida e tudo vai muito bem com o seu dinheiro neste mês, então pode continuar gastando como sempre gastou sem nenhuma preocupação com o futuro próximo.",
  };
  const badSum = summarize(gradeBriefing({ scenario, facts, rawOutput: bad, briefing: validateBriefing(bad, facts).briefing, attempts: 2 }));
  assert.ok(badSum.reached <= 1, `nível ${badSum.reached}`);
});

test("régua do chat cobra número certo, veredito e didática", () => {
  const probe = scenario.chat[0];
  const goodAnswer = `Não recomendo agora. Seu saldo previsto é ${brl("saldo_fim_mes")}, ou seja, o mês já fecha negativo.\n\n**O que fazer:** Espere a próxima renda antes de comprar.`;
  const goodChecks = gradeChatAnswer({ probe, answer: goodAnswer, facts });
  assert.ok(goodChecks.every((c) => c.pass), goodChecks.filter((c) => !c.pass).map((c) => c.name).join(", "));
  const badChecks = gradeChatAnswer({ probe, answer: "Claro! Pode comprar sim, você tem R$ 5.432,00 livres.", facts });
  assert.ok(badChecks.filter((c) => !c.pass).length >= 3);
});

test("heurística de imperativo reconhece verbos de ação e recusa substantivos", () => {
  for (const s of ["Separe R$ 50", "Pague a fatura", "Mantenha o ritmo", "Faça um plano", "Dê prioridade", "Evite parcelar"]) assert.ok(startsWithImperative(s), s);
  for (const s of ["Uma boa ideia", "cartão", "Atenção ao limite", "Você deve pagar"]) assert.ok(!startsWithImperative(s), s);
});
