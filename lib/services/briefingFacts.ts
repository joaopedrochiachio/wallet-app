/**
 * Ficha de fatos do Cofi (sem dependências de servidor): pode ser usada no
 * navegador para mostrar as evidências de cada achado.
 */
import type { FinancialAnalytics } from "./financialAnalyticsService.ts";
import type { BriefingFact, FactKind } from "./aiBriefingModel.ts";
import { friendlyFloor, MIN_MEANINGFUL_DAILY } from "./spendingGuidance.ts";

const round2 = (n: number) => Math.round(n * 100) / 100;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Ficha de fatos: tudo que a IA pode citar, cada um com o PERÍODO no rótulo
 * (hoje, mês até hoje, até o fim do mês, média dos meses anteriores, próximo mês).
 */
export function buildBriefingFacts(a: FinancialAnalytics): BriefingFact[] {
  const facts: BriefingFact[] = [];
  const add = (id: string, label: string, value: unknown, kind: FactKind, note?: string) => {
    if (!finite(value)) return;
    facts.push({ id, label, value: kind === "percent" ? Math.round(value * 10) / 10 : kind === "day" || kind === "count" ? Math.round(value) : round2(value), kind, note });
  };
  const m = a.monthName;

  // Caixa (mesmos números da tela de Planejamento)
  add("saldo_hoje", "Saldo na conta hoje", a.cash.balanceToday, "brl");
  add("recebido_mes", `Já recebido em ${m}`, a.cash.receivedToDate, "brl");
  add("pago_mes", `Já pago em ${m} (saiu da conta)`, a.cash.paidToDate, "brl");
  add("a_receber", `Ainda a receber até o fim de ${m}`, a.cash.toReceive, "brl", "entradas previstas que ainda não caíram");
  add("a_pagar", `Ainda a pagar até o fim de ${m}`, a.cash.toPay, "brl", "contas e faturas que ainda vão sair da conta");
  if (a.cash.invoicesToPay > 0) add("faturas_a_pagar", `Faturas de cartão a pagar em ${m}`, a.cash.invoicesToPay, "brl");
  add("saldo_fim_mes", `Saldo previsto no fim de ${m}`, a.cash.projectedClose, "brl", "saldo de hoje + a receber − a pagar (igual à tela de Planejamento)");
  add("meta_mes", "Meta de saldo para fechar o mês", a.target.value, "brl");
  if (a.target.gap >= 0) {
    add("folga_meta", "Folga acima da meta no fim do mês", a.target.gap, "brl");
    if (a.target.dailyRoom >= MIN_MEANINGFUL_DAILY) {
      add("gasto_livre_dia", "Quanto dá para gastar por dia sem furar a meta (arredondado)", friendlyFloor(a.target.dailyRoom), "brl");
      add("gasto_livre_semana", "Quanto dá para gastar por semana sem furar a meta (arredondado)", friendlyFloor(a.target.dailyRoom * 7), "brl");
    }
  } else {
    add("falta_meta", "Quanto falta para alcançar a meta", -a.target.gap, "brl");
    add("corte_dia", "Corte por dia necessário para alcançar a meta", a.target.dailyCut, "brl");
    add("corte_semana", "Corte por semana necessário para alcançar a meta", a.target.dailyCut * 7, "brl");
  }
  add("dias_restantes", `Dias até o fim de ${m} (contando hoje)`, a.daysLeft, "days");

  // Linha do tempo do caixa
  if (a.timeline.negativeFromDay !== null) {
    add("menor_saldo", `Menor saldo previsto na conta em ${m}`, a.timeline.lowestBalance, "brl", "o pior momento do mês, antes das próximas entradas");
    add("dia_menor_saldo", "Dia do menor saldo previsto", a.timeline.lowestDay, "day");
    add("dia_fica_negativo", "Dia em que a conta fica negativa", a.timeline.negativeFromDay, "day");
    if (a.timeline.recoveryIncome) {
      add("entrada_que_cobre", `Entrada que cobre o buraco: ${a.timeline.recoveryIncome.title}`, a.timeline.recoveryIncome.amount, "brl");
      add("dia_entrada_que_cobre", `Dia da entrada "${a.timeline.recoveryIncome.title}"`, a.timeline.recoveryIncome.day, "day");
    }
  }
  const until = a.timeline.untilNextIncome;
  if (until) {
    add("livre_ate_entrada", `Dinheiro livre até a próxima entrada (${until.title}, dia ${until.day})`, until.available, "brl", "saldo de hoje menos as contas que vencem antes dessa entrada");
    if (until.dailyAvailable >= MIN_MEANINGFUL_DAILY) add("livre_dia_ate_entrada", `Quanto dá para gastar por dia até o dia ${until.day} (arredondado)`, friendlyFloor(until.dailyAvailable), "brl");
    add("dias_ate_entrada", `Dias até a próxima entrada (${until.title})`, until.daysUntil, "days");
  }
  const nextIncome = a.timeline.events.find((e) => e.direction === "in");
  if (nextIncome) {
    add("proxima_entrada", `Próxima entrada prevista: ${nextIncome.title}`, nextIncome.amount, "brl");
    add("dia_proxima_entrada", `Dia da próxima entrada (${nextIncome.title})`, nextIncome.day, "day");
  }
  const nextBill = a.timeline.events.find((e) => e.direction === "out");
  if (nextBill) {
    add("proxima_conta", `Próxima conta a pagar: ${nextBill.title}`, nextBill.amount, "brl");
    add("dia_proxima_conta", `Dia da próxima conta (${nextBill.title})`, nextBill.day, "day");
  }

  // Gastos do mês até hoje x mesmo período dos meses anteriores
  const s = a.spending;
  add("gasto_mes", `Gastos de ${m} até hoje (conta + cartão, com contas fixas)`, s.monthToDate, "brl", `${s.transactionsThisMonth} lançamentos`);
  if (s.fixedToDate > 0) add("contas_fixas_pagas", `Contas fixas já pagas em ${m}`, s.fixedToDate, "brl");
  add("gasto_dia_a_dia", `Gastos do dia a dia em ${m} até hoje (sem contas fixas)`, s.variableToDate, "brl");
  if (s.monthToDateCredit > 0) add("gasto_mes_cartao", `Gastos de ${m} no cartão (pesam na próxima fatura)`, s.monthToDateCredit, "brl");
  if (s.samePeriodAverage !== null) {
    add("gasto_media_periodo", `Média dos gastos do dia a dia do dia 1 ao dia ${a.day} nos ${s.previousMonthsWithData} meses anteriores`, s.samePeriodAverage, "brl");
    add("ritmo_gastos_pct", "Ritmo dos gastos do dia a dia em relação à média (100% = igual)", s.pacePercent, "percent");
  }
  if (s.fullMonthAverage !== null) add("gasto_medio_mes", "Gasto médio do dia a dia por mês inteiro nos meses anteriores", s.fullMonthAverage, "brl");
  s.categories.slice(0, 3).forEach((c, i) => {
    add(`categoria_${i + 1}`, `${c.category} em ${m} até hoje (dia a dia)`, c.monthToDate, "brl", `${c.count} lançamentos`);
    if (c.samePeriodAverage !== null) add(`categoria_${i + 1}_media`, `${c.category}: média do mesmo período nos meses anteriores`, c.samePeriodAverage, "brl");
  });
  if (s.biggestIncrease) {
    add("maior_alta", `Maior alta do mês: ${s.biggestIncrease.category} em ${m} até hoje`, s.biggestIncrease.monthToDate, "brl");
    add("maior_alta_media", `${s.biggestIncrease.category}: média do mesmo período antes`, s.biggestIncrease.samePeriodAverage, "brl");
    add("maior_alta_pct", `Aumento de ${s.biggestIncrease.category} sobre a média`, s.biggestIncrease.changePercent, "percent");
    add("maior_alta_metade_extra", `Metade do excesso em ${s.biggestIncrease.category}`, (s.biggestIncrease.monthToDate - (s.biggestIncrease.samePeriodAverage ?? 0)) / 2, "brl");
  }
  s.habits.forEach((h, i) => {
    add(`habito_${i + 1}`, `Hábito em ${m} até hoje: ${h.name}`, h.total, "brl");
    add(`habito_${i + 1}_qtd`, `Compras de ${h.name} em ${m} até hoje`, h.count, "count");
    if (h.previousAverage !== null) add(`habito_${i + 1}_media`, `${h.name}: média do mesmo período antes`, h.previousAverage, "brl");
  });
  s.largestPurchases.slice(0, 2).forEach((p, i) => {
    add(`compra_${i + 1}`, `Maior compra ${i + 1} de ${m}: ${p.title}${p.credit ? " (cartão)" : ""}`, p.amount, "brl");
  });

  // Cartão, próximo mês e metas
  if (a.credit) {
    add("limite_total", "Limite total dos cartões", a.credit.limit, "brl");
    add("limite_usado", "Limite já usado nos cartões (inclui parcelas futuras)", a.credit.used, "brl");
    add("limite_uso_pct", "Uso do limite dos cartões (inclui parcelas futuras)", a.credit.usagePercent, "percent", "acima de 80% deixa pouca folga para imprevistos");
    add("limite_disponivel", "Limite disponível nos cartões", a.credit.available, "brl");
  }
  if (a.nextMonth) {
    const n = a.nextMonthName;
    add("proximo_mes_entradas", `Entradas previstas em ${n}`, a.nextMonth.income, "brl");
    add("proximo_mes_compromissos", `Compromissos já agendados em ${n}`, a.nextMonth.committed, "brl", "inclui parcelas de cartão e contas fixas");
    if (a.nextMonth.installments > 0) add("proximo_mes_parcelas", `Parcelas de cartão que caem em ${n}`, a.nextMonth.installments, "brl");
    add("proximo_mes_saldo", `Saldo previsto no fim de ${n}`, a.nextMonth.projectedFree, "brl", "só com o que já está agendado; gastos do dia a dia vêm a mais");
  }
  a.goals.forEach((g, i) => {
    add(`objetivo_${i + 1}_progresso`, `Progresso do objetivo "${g.title}"`, g.progressPercent, "percent");
    add(`objetivo_${i + 1}_falta`, `Quanto falta para o objetivo "${g.title}"`, g.gap, "brl");
  });
  return facts;
}
