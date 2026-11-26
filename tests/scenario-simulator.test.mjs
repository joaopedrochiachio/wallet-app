import assert from "node:assert/strict";
import test from "node:test";
import { simulateScenario } from "../lib/services/scenarioSimulator.ts";

const colorScheme = { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" };
const nubank = { id: "nu", name: "Nubank", type: "credit", brand: "", limit: 800, spent: 0, closingDay: 1, dueDay: 10, colorScheme };
const itau = { id: "itau", name: "Itaú", type: "credit", brand: "", limit: 500, spent: 0, closingDay: 8, dueDay: 15, colorScheme };
const statements = { nu: { availableLimit: 254.76 }, itau: { availableLimit: 45.36 } };
const d = (y, m, day) => new Date(y, m, day);
const ev = (date, title, amount, kind = "bill") => ({ id: title, date, title, amount, kind, overdue: false, coveredByGoals: 0 });

const today = d(2026, 10, 25);
const baseEvents = [
  ev(d(2026, 10, 30), "13º", 899.49, "income"),
  ev(d(2026, 11, 7), "Salário", 1579.71, "income"),
  ev(d(2026, 11, 10), "Fatura NuBank", 361.92, "invoice"),
];
const horizonEnd = d(2027, 0, 1);

test("guardar 100 hoje, 400 dia 30 e 100 no Nubank no fim de semana", () => {
  const r = simulateScenario({
    startBalance: 191.69, baseEvents, cards: [nubank, itau], statements, today, horizonEnd,
    moves: [
      { id: "a", kind: "save", amount: 100, date: today },
      { id: "b", kind: "save", amount: 400, date: d(2026, 10, 30) },
      { id: "c", kind: "card", amount: 100, date: d(2026, 10, 28), cardId: "nu", installments: 1 },
    ],
  });
  const [impact] = r.cardImpacts;
  assert.equal(impact.availableAfter, 154.76);
  assert.equal(impact.exceedsLimit, false);
  assert.equal(impact.installments[0].invoiceKey, "2026-12", "compra de 28/nov entra na fatura de dezembro");
  assert.equal(impact.installments[0].dueDate.getDate(), 10);
  assert.equal(r.simulated.segments[0].closingBalance, 91.69, "cartão não mexe na conta até a fatura");
  const dec10 = r.daily.find((p) => p.date.getMonth() === 11 && p.date.getDate() === 10);
  assert.equal(Math.round((dec10.base - dec10.simulated) * 100) / 100, 600);
});

test("compra acima do limite disponível é apontada", () => {
  const r = simulateScenario({
    startBalance: 0, baseEvents: [], cards: [itau], statements, today, horizonEnd,
    moves: [{ id: "x", kind: "card", amount: 100, date: today, cardId: "itau", installments: 1 }],
  });
  assert.equal(r.cardImpacts[0].exceedsLimit, true);
});

test("parcelado: cada parcela cai numa fatura e o horizonte cresce até a última", () => {
  const r = simulateScenario({
    startBalance: 1000, baseEvents: [], cards: [nubank], statements, today, horizonEnd,
    moves: [{ id: "p", kind: "card", amount: 300, date: today, cardId: "nu", installments: 3 }],
  });
  assert.deepEqual(r.cardImpacts[0].installments.map((i) => i.invoiceKey), ["2026-12", "2027-01", "2027-02"]);
  assert.equal(r.cardImpacts[0].availableAfter, -45.24);
  assert.ok(r.daily[r.daily.length - 1].date >= d(2027, 1, 10));
  assert.equal(r.daily[r.daily.length - 1].simulated, 700);
});

test("receita extra abre um trecho novo e cobre a conta que estourava", () => {
  const events = [ev(d(2026, 11, 5), "Aluguel", 900)];
  const without = simulateScenario({ startBalance: 500, baseEvents: events, moves: [], cards: [], statements: {}, today, horizonEnd });
  assert.ok(without.simulated.firstUncovered);
  const withExtra = simulateScenario({
    startBalance: 500, baseEvents: events, cards: [], statements: {}, today, horizonEnd,
    moves: [{ id: "f", kind: "income", amount: 500, date: d(2026, 11, 1), label: "Freela" }],
  });
  assert.equal(withExtra.simulated.firstUncovered, null);
  assert.equal(withExtra.simulated.segments[1].incomes[0].title, "Freela");
});
