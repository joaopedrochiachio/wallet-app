/**
 * Análise financeira com PERÍODOS EXPLÍCITOS para a IA (informativo e chat).
 *
 * Regras que evitam leituras erradas:
 * - Caixa do mês usa os mesmos números da tela de Planejamento (projeção do mês):
 *   saldo de hoje + a receber − a pagar = saldo no fim do mês.
 * - Gastos por categoria e hábitos são do MÊS ATUAL (até hoje), comparados com a
 *   média do mesmo período nos meses anteriores — nunca o histórico inteiro somado.
 * - A linha do tempo do caixa (dia a dia) mostra se o dinheiro acaba antes de uma
 *   entrada chegar, mesmo que o mês feche positivo.
 */
import type { CardItem, GoalItem, RecurringItem } from "../../types/index.ts";
import type { TransactionContextItem } from "./financialContextService.ts";
import { inferHabitCategory, isExcludedFromHabitAnalysis } from "./financialContextService.ts";
import { getEffectiveDueDay, getEffectiveRecurringItemForPeriod, getPeriodKey, isRecurringActiveInMonth } from "../utils/dateUtils.ts";
import { hasRecordedRecurringOccurrence } from "../utils/recurringOccurrences.ts";
import { getLedgerEntryDate, matchesLedgerCard } from "../utils/ledger.ts";
import { redactPersonalData } from "./privacyService.ts";

/** Mesmo padrão de privacidade do contexto antigo: títulos filtrados, cartões e objetivos com apelido. */
const safeTitle = (t: string) => redactPersonalData(t || "").trim().slice(0, 60) || "Lançamento";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Projeção mensal no formato enviado pelo app (mesma da tela de Planejamento). */
export interface AnalyticsProjection {
  monthName: string;
  year: number;
  openingBalance?: number;
  /** Saldo conciliado de hoje (mês atual). */
  actualClosingBalance?: number;
  actualIncomeTotal?: number;
  actualOutflowTotal?: number;
  /** Mês atual: entradas ainda a receber. Meses futuros: entradas planejadas. */
  plannedIncomesTotal: number;
  projectedIncome?: number;
  pendingCommitted?: number;
  totalCommitted: number;
  cardInstallments: number;
  totalInvoicesPending?: number;
  projectedFreeBalance: number;
  cardInvoices?: Array<{ cardId: string; cardName?: string; dueDay?: number; pendingInvoice?: number; isPaid?: boolean }>;
}

export interface AnalyticsInput {
  cards: CardItem[];
  transactions: TransactionContextItem[];
  recurringItems: RecurringItem[];
  goals: GoalItem[];
  monthlyProjections: AnalyticsProjection[];
  mainBalance: number;
  targetEndMonthBalance: number;
  monthlyIncomeBase?: number;
  now?: Date;
}

export interface TimelineEvent {
  day: number;
  title: string;
  amount: number;
  direction: "in" | "out";
}

export interface CategoryAnalytics {
  category: string;
  monthToDate: number;
  count: number;
  /** Média do mesmo período (dia 1 até hoje) nos meses anteriores com dados. */
  samePeriodAverage: number | null;
  changePercent: number | null;
}

export interface FinancialAnalytics {
  referenceDate: string;
  monthName: string;
  nextMonthName: string;
  day: number;
  daysInMonth: number;
  daysLeft: number;
  cash: {
    balanceToday: number;
    receivedToDate: number;
    paidToDate: number;
    toReceive: number;
    toPay: number;
    invoicesToPay: number;
    projectedClose: number;
  };
  target: { value: number; gap: number; dailyRoom: number; dailyCut: number };
  timeline: {
    events: TimelineEvent[];
    lowestBalance: number;
    lowestDay: number;
    /** Primeiro dia em que o saldo fica negativo (null se não fica). */
    negativeFromDay: number | null;
    /** Entrada que tira o saldo do negativo, se houver. */
    recoveryIncome: TimelineEvent | null;
    /** Próxima entrada prevista e quanto dá para gastar até ela sem a conta ficar negativa. */
    untilNextIncome: { day: number; title: string; amount: number; daysUntil: number; available: number; dailyAvailable: number } | null;
  };
  spending: {
    monthToDate: number;
    monthToDateCredit: number;
    monthToDateCash: number;
    /** Contas fixas (recorrências) já pagas no mês; ficam fora das comparações de hábito. */
    fixedToDate: number;
    /** Gastos do dia a dia (sem contas fixas) até hoje. */
    variableToDate: number;
    previousMonthsWithData: number;
    samePeriodAverage: number | null;
    fullMonthAverage: number | null;
    pacePercent: number | null;
    categories: CategoryAnalytics[];
    biggestIncrease: CategoryAnalytics | null;
    habits: Array<{ name: string; total: number; count: number; previousAverage: number | null }>;
    largestPurchases: Array<{ title: string; amount: number; day: number; credit: boolean }>;
    transactionsThisMonth: number;
  };
  credit: { limit: number; used: number; available: number; usagePercent: number } | null;
  nextMonth: { income: number; committed: number; installments: number; projectedFree: number } | null;
  goals: Array<{ title: string; progressPercent: number; gap: number }>;
  incomeKnown: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Categorias/hábitos genéricos ("Outros", "Geral") não geram alerta: não dizem o que mudar. */
const isGenericName = (name: string) => /(^|\s)(outr[oa]s?|geral|diversos|sem categoria)(\s|$)/i.test(name || "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function isSpending(tx: TransactionContextItem): boolean {
  return (
    tx.type === "despesa" &&
    tx.kind !== "invoice_payment" &&
    tx.kind !== "invoice_settlement" &&
    tx.kind !== "balance_reconciliation" &&
    !tx.id?.startsWith("planned-")
  );
}

export function buildFinancialAnalytics(input: AnalyticsInput): FinancialAnalytics {
  const now = input.now ? new Date(input.now) : new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - day + 1);
  const periodKey = getPeriodKey(year, month);
  const current = input.monthlyProjections[0];
  const next = input.monthlyProjections[1];
  const creditCards = input.cards.filter((c) => c.type === "credit");
  const isCreditTx = (tx: TransactionContextItem) => creditCards.some((c) => c.id === tx.cardId || matchesLedgerCard(c, tx.account, tx.cardId));

  // ---------- Caixa do mês (mesma conta da tela de Planejamento) ----------
  const balanceToday = round2(current?.actualClosingBalance ?? input.mainBalance);
  const toReceive = round2(num(current?.plannedIncomesTotal));
  const toPay = round2(num(current?.pendingCommitted));
  const projectedClose = round2(current ? current.projectedFreeBalance : balanceToday + toReceive - toPay);
  const cash = {
    balanceToday,
    receivedToDate: round2(num(current?.actualIncomeTotal)),
    paidToDate: round2(num(current?.actualOutflowTotal)),
    toReceive,
    toPay,
    invoicesToPay: round2(num(current?.totalInvoicesPending)),
    projectedClose,
  };
  const gap = round2(projectedClose - input.targetEndMonthBalance);
  const target = {
    value: input.targetEndMonthBalance,
    gap,
    dailyRoom: gap > 0 ? round2(gap / daysLeft) : 0,
    dailyCut: gap < 0 ? round2(-gap / daysLeft) : 0,
  };

  // ---------- Linha do tempo do caixa, dia a dia até o fim do mês ----------
  const events: TimelineEvent[] = [];
  for (const raw of input.recurringItems) {
    if (!raw || !isRecurringActiveInMonth(raw, year, month)) continue;
    const item = getEffectiveRecurringItemForPeriod(raw, periodKey);
    const isIncome = item.type === "income";
    if (!isIncome && creditCards.some((c) => matchesLedgerCard(c, item.account, item.cardId))) continue; // vai na fatura
    if (hasRecordedRecurringOccurrence(raw, periodKey, input.transactions as never, input.cards, isIncome ? "receita" : "despesa")) continue;
    const due = Math.min(daysInMonth, Math.max(1, getEffectiveDueDay(item, year, month)));
    events.push({ day: Math.max(day, due), title: safeTitle(item.title), amount: round2(item.amount), direction: isIncome ? "in" : "out" });
  }
  for (const inv of current?.cardInvoices ?? []) {
    const pending = num(inv.pendingInvoice);
    if (inv.isPaid || pending <= 0) continue;
    const due = Math.min(daysInMonth, Math.max(1, inv.dueDay || daysInMonth));
    const cardIndex = creditCards.findIndex((c) => c.id === inv.cardId);
    events.push({ day: Math.max(day, due), title: `Fatura do Cartão ${cardIndex >= 0 ? cardIndex + 1 : ""}`.trim(), amount: round2(pending), direction: "out" });
  }
  // Reconcilia com os totais do Planejamento: o que não tem data entra no último dia.
  const sum = (dir: "in" | "out") => events.filter((e) => e.direction === dir).reduce((s, e) => s + e.amount, 0);
  const missingIn = round2(toReceive - sum("in"));
  const missingOut = round2(toPay - sum("out"));
  if (missingIn > 1) events.push({ day: daysInMonth, title: "Outras entradas previstas", amount: missingIn, direction: "in" });
  if (missingOut > 1) events.push({ day: daysInMonth, title: "Outras contas previstas", amount: missingOut, direction: "out" });
  // No mesmo dia, entradas antes das saídas: quem recebe e paga no dia 20 não fica negativo no dia 20.
  events.sort((a, b) => a.day - b.day || (a.direction === "in" ? -1 : 1));

  // Avalia o saldo no FIM de cada dia (tudo que entra e sai no dia já compensado).
  const days = [...new Set(events.map((e) => e.day))];
  let running = balanceToday;
  let lowestBalance = balanceToday;
  let lowestDay = day;
  let negativeFromDay: number | null = balanceToday < 0 ? day : null;
  let recoveryIncome: TimelineEvent | null = null;
  for (const d of days) {
    const ofDay = events.filter((e) => e.day === d);
    running = round2(ofDay.reduce((acc, e) => acc + (e.direction === "in" ? e.amount : -e.amount), running));
    if (running < lowestBalance) {
      lowestBalance = running;
      lowestDay = d;
    }
    if (running < 0 && negativeFromDay === null) negativeFromDay = d;
    if (running >= 0 && negativeFromDay !== null && !recoveryIncome) {
      recoveryIncome = ofDay.filter((e) => e.direction === "in").sort((x, y) => y.amount - x.amount)[0] ?? null;
    }
  }

  // Dinheiro livre até a próxima entrada: o menor saldo antes dela (contas que vencem antes já descontadas).
  const firstIncome = events.find((e) => e.direction === "in" && e.day > day) ?? null;
  let untilNextIncome: FinancialAnalytics["timeline"]["untilNextIncome"] = null;
  if (firstIncome) {
    let bal = balanceToday;
    let minBefore = balanceToday;
    for (const e of events) {
      if (e.day >= firstIncome.day) break;
      bal = round2(bal + (e.direction === "in" ? e.amount : -e.amount));
      minBefore = Math.min(minBefore, bal);
    }
    const daysUntil = Math.max(1, firstIncome.day - day);
    const available = round2(Math.max(0, minBefore));
    untilNextIncome = { day: firstIncome.day, title: firstIncome.title, amount: firstIncome.amount, daysUntil, available, dailyAvailable: round2(available / daysUntil) };
  }

  // ---------- Gastos: mês atual x mesmo período dos meses anteriores ----------
  const spendingTx = input.transactions.filter(isSpending).map((tx) => ({ tx, date: getLedgerEntryDate(tx as never) })).filter((x) => x.date) as Array<{ tx: TransactionContextItem; date: Date }>;
  const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const currentIdx = year * 12 + month;
  const thisMonth = spendingTx.filter((x) => monthIndex(x.date) === currentIdx && x.date.getDate() <= day);
  const previousIdx = [1, 2, 3].map((k) => currentIdx - k).filter((idx) => spendingTx.some((x) => monthIndex(x.date) === idx));
  const samePeriodOf = (idx: number) => spendingTx.filter((x) => monthIndex(x.date) === idx && x.date.getDate() <= day);
  const fullOf = (idx: number) => spendingTx.filter((x) => monthIndex(x.date) === idx);
  const total = (list: Array<{ tx: TransactionContextItem }>) => list.reduce((s, x) => s + x.tx.amount, 0);
  const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

  const monthToDate = round2(total(thisMonth));
  // Comparações (ritmo, categorias, hábitos) usam só gastos do dia a dia: contas fixas não são hábito.
  const norm = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
  const fixedItems = input.recurringItems.filter((r) => r && r.type !== "income");
  const isFixed = (t: TransactionContextItem) =>
    Boolean(t.recurringItemId) ||
    /moradia/i.test(t.category || "") ||
    fixedItems.some((r) => norm(r.title) === norm(t.title) || ((r.category || "") === (t.category || "") && Math.abs(r.amount - t.amount) <= Math.max(1, r.amount * 0.02)));
  const isVariable = (x: { tx: TransactionContextItem }) => !isFixed(x.tx);
  const variableThisMonth = thisMonth.filter(isVariable);
  const variableToDate = round2(total(variableThisMonth));
  const samePeriodAverage = avg(previousIdx.map((idx) => total(samePeriodOf(idx).filter(isVariable))));
  const fullMonthAverage = avg(previousIdx.map((idx) => total(fullOf(idx).filter(isVariable))));

  const byCategory = new Map<string, { total: number; count: number }>();
  for (const { tx } of variableThisMonth) {
    const c = byCategory.get(tx.category || "Outros") || { total: 0, count: 0 };
    c.total += tx.amount;
    c.count += 1;
    byCategory.set(tx.category || "Outros", c);
  }
  const categories: CategoryAnalytics[] = [...byCategory.entries()]
    .map(([category, v]) => {
      const prev = avg(previousIdx.map((idx) => total(samePeriodOf(idx).filter((x) => isVariable(x) && (x.tx.category || "Outros") === category))));
      return {
        category,
        monthToDate: round2(v.total),
        count: v.count,
        samePeriodAverage: prev === null ? null : round2(prev),
        changePercent: prev && prev > 0 ? Math.round(((v.total - prev) / prev) * 100) : null,
      };
    })
    .sort((a, b) => b.monthToDate - a.monthToDate);
  const biggestIncrease =
    categories
      .filter((c) => !isGenericName(c.category) && c.samePeriodAverage !== null && c.monthToDate - (c.samePeriodAverage ?? 0) >= 100 && (c.changePercent ?? 0) >= 30)
      .sort((a, b) => b.monthToDate - (b.samePeriodAverage ?? 0) - (a.monthToDate - (a.samePeriodAverage ?? 0)))[0] ?? null;

  const habitMap = new Map<string, { total: number; count: number; categories: Map<string, number> }>();
  for (const { tx } of variableThisMonth) {
    if (isExcludedFromHabitAnalysis(tx.title, tx.category)) continue;
    const name = inferHabitCategory(tx.title, tx.category);
    if (isGenericName(name)) continue; // "Outros hábitos" / "Alimentação Geral" não são hábitos
    const h = habitMap.get(name) || { total: 0, count: 0, categories: new Map<string, number>() };
    h.total += tx.amount;
    h.count += 1;
    h.categories.set(tx.category || "Outros", (h.categories.get(tx.category || "Outros") || 0) + tx.amount);
    habitMap.set(name, h);
  }
  // Só vira hábito relevante o que está claramente acima da média da própria pessoa
  // (≥ 30% e ≥ R$ 100 a mais) ou, sem histórico, o que se repete muito (5+ vezes).
  // Hábitos da mesma categoria da "maior alta" ficam de fora para não repetir o alerta.
  const habits = [...habitMap.entries()]
    .filter(([, h]) => h.count >= 3)
    .map(([name, h]) => {
      const prev = avg(previousIdx.map((idx) => total(samePeriodOf(idx).filter((x) => isVariable(x) && !isExcludedFromHabitAnalysis(x.tx.title, x.tx.category) && inferHabitCategory(x.tx.title, x.tx.category) === name))));
      const mainCategory = [...h.categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      return { name, total: round2(h.total), count: h.count, previousAverage: prev === null ? null : round2(prev), mainCategory };
    })
    .filter((h) => (h.previousAverage === null ? h.count >= 5 : h.total >= h.previousAverage * 1.3 && h.total - h.previousAverage >= 100))
    .filter((h) => !biggestIncrease || h.mainCategory !== biggestIncrease.category)
    .sort((a, b) => b.total - a.total)
    .slice(0, 2)
    .map((h) => ({ name: h.name, total: h.total, count: h.count, previousAverage: h.previousAverage }));

  const largestPurchases = [...thisMonth]
    .filter((x) => !x.tx.recurringItemId)
    .sort((a, b) => b.tx.amount - a.tx.amount)
    .slice(0, 3)
    .map((x) => ({ title: safeTitle(x.tx.title), amount: round2(x.tx.amount), day: x.date.getDate(), credit: isCreditTx(x.tx) }));

  // ---------- Cartões, próximo mês e metas ----------
  const limit = creditCards.reduce((s, c) => s + num(c.limit), 0);
  const used = creditCards.reduce((s, c) => s + num(c.spent ?? c.invoiceAmount), 0);
  const credit = limit > 0 ? { limit: round2(limit), used: round2(used), available: round2(Math.max(0, limit - used)), usagePercent: Math.round((used / limit) * 100) } : null;
  const nextMonth = next
    ? { income: round2(num(next.projectedIncome ?? next.plannedIncomesTotal)), committed: round2(num(next.totalCommitted)), installments: round2(num(next.cardInstallments)), projectedFree: round2(num(next.projectedFreeBalance)) }
    : null;
  const goals = input.goals.slice(0, 3).map((g, i) => ({
    title: `Objetivo ${i + 1}`,
    progressPercent: g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0,
    gap: round2(Math.max(0, g.target - g.current)),
  }));

  return {
    referenceDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    monthName: MONTHS[month],
    nextMonthName: MONTHS[(month + 1) % 12],
    day,
    daysInMonth,
    daysLeft,
    cash,
    target,
    timeline: { events, lowestBalance: round2(lowestBalance), lowestDay, negativeFromDay, recoveryIncome, untilNextIncome },
    spending: {
      monthToDate,
      monthToDateCredit: round2(total(thisMonth.filter((x) => isCreditTx(x.tx)))),
      monthToDateCash: round2(total(thisMonth.filter((x) => !isCreditTx(x.tx)))),
      previousMonthsWithData: previousIdx.length,
      samePeriodAverage: samePeriodAverage === null ? null : round2(samePeriodAverage),
      fullMonthAverage: fullMonthAverage === null ? null : round2(fullMonthAverage),
      fixedToDate: round2(monthToDate - variableToDate),
      variableToDate,
      pacePercent: samePeriodAverage && samePeriodAverage > 0 ? Math.round((variableToDate / samePeriodAverage) * 100) : null,
      categories,
      biggestIncrease,
      habits,
      largestPurchases,
      transactionsThisMonth: thisMonth.length,
    },
    credit,
    nextMonth,
    goals,
    incomeKnown: num(input.monthlyIncomeBase) > 0 || cash.receivedToDate > 0 || cash.toReceive > 0,
  };
}

/** Data de referência enviada pelo app (dia local da pessoa), aceita só se estiver perto do relógio do servidor. */
export function resolveReferenceDate(clientDate: unknown, serverNow: Date = new Date()): Date {
  if (typeof clientDate === "string") {
    const m = clientDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
      if (Math.abs(d.getTime() - serverNow.getTime()) <= 36 * 3600 * 1000) return d;
    }
  }
  return serverNow;
}

/** Monta a análise a partir do corpo enviado pelo app (mesmo formato para informativo e chat). */
export function buildAnalyticsFromRequest(body: Record<string, unknown> | null | undefined, serverNow: Date = new Date()): FinancialAnalytics {
  const b = body ?? {};
  const arr = <T>(v: unknown, max: number): T[] => (Array.isArray(v) ? (v.slice(0, max) as T[]) : []);
  const profile = (b.userProfile ?? {}) as { monthlyIncomeBase?: number; targetMonthEndBalance?: number };
  const target = typeof b.targetEndMonthBalance === "number" ? b.targetEndMonthBalance : num(profile.targetMonthEndBalance);
  return buildFinancialAnalytics({
    cards: arr<CardItem>(b.cards, 30),
    transactions: arr<TransactionContextItem>(b.transactions, 1500),
    recurringItems: arr<RecurringItem>(b.recurringItems, 80),
    goals: arr<GoalItem>(b.goals, 30),
    monthlyProjections: arr<AnalyticsProjection>(b.monthlyProjections, 6),
    mainBalance: num(b.mainBalance),
    targetEndMonthBalance: target,
    monthlyIncomeBase: num(profile.monthlyIncomeBase),
    now: resolveReferenceDate(b.clientDate, serverNow),
  });
}
