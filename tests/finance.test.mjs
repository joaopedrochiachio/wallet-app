import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCheckingBalance,
  calculateInvoiceSchedule,
  calculateMonthlyAccountFlow,
  calculateProjectedBalance,
  getInvoiceDueDate,
} from "../lib/utils/ledger.ts";
import {
  getPeriodKey,
  isRecurringActiveInMonth,
  get5thBusinessDay,
  getPlanningMonthsWindow,
  isBusinessDay,
  groupRecurringItemsByDate,
} from "../lib/utils/dateUtils.ts";
import {
  createSafeMiddayDate,
  isSameOrBeforeCalendarDay,
  getPendingDueOccurrences,
} from "../lib/utils/timeProgression.ts";

const colorScheme = {
  gradient: "",
  border: "",
  accent: "",
  badgeText: "",
  chipGradient: "",
};

const checking = {
  id: "checking",
  name: "Conta Principal",
  type: "checking",
  openingBalance: 0,
  brand: "",
  limit: 0,
  spent: 0,
  colorScheme,
};

const credit = {
  id: "credit",
  name: "Cartão Principal",
  type: "credit",
  brand: "",
  limit: 5000,
  spent: 0,
  closingDay: 10,
  dueDay: 18,
  colorScheme,
};

test("salário recebido menos contas PIX define o saldo real", () => {
  const result = calculateCheckingBalance(checking, [
    { amount: 5000, type: "receita", account: checking.name, cardId: checking.id },
    { amount: 1200, type: "despesa", account: checking.name, cardId: checking.id },
    { amount: 800, type: "despesa", account: "Débito/Pix", cardId: checking.id },
  ]);
  assert.equal(result, 3000);
});

test("consolidado atual usa apenas o que entrou e saiu da conta", () => {
  const secondaryAccount = {
    ...checking,
    id: "secondary-checking",
    name: "Conta secundária",
  };
  const result = calculateMonthlyAccountFlow(
    [checking, secondaryAccount, credit],
    [
      { amount: 2800, type: "receita", account: checking.name, cardId: checking.id, occurredAt: new Date(2026, 8, 5) },
      { amount: 600, type: "despesa", account: checking.name, cardId: checking.id, occurredAt: new Date(2026, 8, 6) },
      { amount: 1005, type: "despesa", account: credit.name, cardId: credit.id, occurredAt: new Date(2026, 8, 7) },
      { amount: 999, type: "receita", account: secondaryAccount.name, cardId: secondaryAccount.id, occurredAt: new Date(2026, 8, 8) },
      { amount: 900, type: "receita", account: checking.name, cardId: checking.id, occurredAt: new Date(2026, 9, 5) },
    ],
    new Date(2026, 8, 13),
  );

  assert.deepEqual(result, { income: 2800, outflow: 600 });
});

test("previsão antiga não altera o saldo nem o consolidado realizado", () => {
  const plannedEntry = {
    id: "planned-rent-2026-09",
    amount: 1200,
    type: "despesa",
    account: checking.name,
    cardId: checking.id,
    occurredAt: new Date(2026, 8, 10),
  };

  assert.equal(calculateCheckingBalance(checking, [plannedEntry]), 0);
  assert.deepEqual(
    calculateMonthlyAccountFlow([checking], [plannedEntry], new Date(2026, 8, 13)),
    { income: 0, outflow: 0 },
  );
});

test("compra depois do fechamento de setembro vence em outubro", () => {
  const dueDate = getInvoiceDueDate(credit, new Date(2026, 8, 13, 12));
  assert.equal(getPeriodKey(dueDate.getFullYear(), dueDate.getMonth()), "2026-10");
});

test("agenda da fatura aloca pagamento nas cobranças mais antigas", () => {
  const schedule = calculateInvoiceSchedule(credit, [
    { amount: 400, type: "despesa", account: credit.name, cardId: credit.id, occurredAt: new Date(2026, 8, 5, 12) },
    { amount: 900, type: "despesa", account: credit.name, cardId: credit.id, occurredAt: new Date(2026, 8, 13, 12) },
    { amount: 400, type: "receita", account: credit.name, cardId: credit.id, occurredAt: new Date(2026, 8, 18, 12) },
  ]);
  assert.equal(schedule["2026-09"], 0);
  assert.equal(schedule["2026-10"], 900);
});

test("ocorrência realizada deixa de ser pendência no planejamento", () => {
  const salary = {
    active: true,
    startYear: 2026,
    startMonth: 8,
    realizedPeriods: ["2026-09"],
  };
  assert.equal(isRecurringActiveInMonth(salary, 2026, 8), false);
  assert.equal(isRecurringActiveInMonth(salary, 2026, 9), true);
});

test("compra fixa parcelada termina depois da quantidade de meses definida", () => {
  const purchase = {
    active: true,
    startYear: 2026,
    startMonth: 8,
    installmentsCount: 3,
  };

  assert.equal(isRecurringActiveInMonth(purchase, 2026, 8), true);
  assert.equal(isRecurringActiveInMonth(purchase, 2026, 9), true);
  assert.equal(isRecurringActiveInMonth(purchase, 2026, 10), true);
  assert.equal(isRecurringActiveInMonth(purchase, 2026, 11), false);
});

test("pagamento futuro único existe somente no mês planejado", () => {
  const oneTimePayment = {
    active: true,
    startYear: 2026,
    startMonth: 10,
    installmentsCount: 1,
  };

  assert.equal(isRecurringActiveInMonth(oneTimePayment, 2026, 9), false);
  assert.equal(isRecurringActiveInMonth(oneTimePayment, 2026, 10), true);
  assert.equal(isRecurringActiveInMonth(oneTimePayment, 2026, 11), false);
});

test("saldo do mês anterior é transportado como saldo inicial do próximo mês", () => {
  // Mês 0 (Setembro): saldo em conta = 2.500, entradas pendentes = 500, compromissos = 1.000
  const month0Opening = 2500;
  const month0Projected = calculateProjectedBalance(month0Opening, 500, 1000);
  assert.equal(month0Projected, 2000);

  // Mês 1 (Outubro): saldo inicial vem do projetado do mês 0 (2.000), salário = 6.000, compromissos = 3.500
  const month1Opening = month0Projected;
  assert.equal(month1Opening, 2000);
  const month1Projected = calculateProjectedBalance(month1Opening, 6000, 3500);
  assert.equal(month1Projected, 4500);

  // Mês 2 (Novembro): saldo inicial vem do mês 1 (4.500), salário = 6.000, compromissos = 4.000
  const month2Opening = month1Projected;
  assert.equal(month2Opening, 4500);
  const month2Projected = calculateProjectedBalance(month2Opening, 6000, 4000);
  assert.equal(month2Projected, 6500);
});

test("createSafeMiddayDate e isSameOrBeforeCalendarDay operam imunes a desvios de fuso horário", () => {
  const midday = createSafeMiddayDate(2026, 8, 15);
  assert.equal(midday.getFullYear(), 2026);
  assert.equal(midday.getMonth(), 8);
  assert.equal(midday.getDate(), 15);
  assert.equal(midday.getHours(), 12);

  // Comparação de dias civis independente do horário
  const earlyMorning = new Date(2026, 8, 15, 0, 1, 0);
  const lateNight = new Date(2026, 8, 14, 23, 59, 0);
  assert.equal(isSameOrBeforeCalendarDay(lateNight, earlyMorning), true);
  assert.equal(isSameOrBeforeCalendarDay(earlyMorning, lateNight), false);
  assert.equal(isSameOrBeforeCalendarDay(earlyMorning, earlyMorning), true);
});

test("lançamento planejado para o dia 15 não vence no dia 14, vence no dia 15 e permanece válido no dia 16", () => {
  const item = {
    id: "salary-15",
    title: "Salário Mensal",
    amount: 5000,
    type: "income",
    category: "Salário",
    account: checking.name,
    cardId: checking.id,
    dueDay: 15,
    recurrenceType: "fixed_day",
    active: true,
    startYear: 2026,
    startMonth: 8,
    realizedPeriods: [],
  };

  // Dia 14: ainda futuro
  const due14 = getPendingDueOccurrences([item], [checking], [], new Date(2026, 8, 14, 18, 0, 0));
  assert.equal(due14.length, 0);

  // Dia 15: torna-se devido
  const due15 = getPendingDueOccurrences([item], [checking], [], new Date(2026, 8, 15, 8, 0, 0));
  assert.equal(due15.length, 1);
  assert.equal(due15[0].periodKey, "2026-09");
  assert.equal(due15[0].occurrenceId, "rec-tx-salary-15-2026-09");
  assert.equal(due15[0].amount, 5000);
  assert.equal(due15[0].isCredit, false);

  // Dia 16: se ainda não foi materializado, continua na lista de pendências vencidas
  const due16Pending = getPendingDueOccurrences([item], [checking], [], new Date(2026, 8, 16, 10, 0, 0));
  assert.equal(due16Pending.length, 1);

  // Dia 16: após efetivação com registro em realizedPeriods
  const itemRealized = { ...item, realizedPeriods: ["2026-09"] };
  const due16Done = getPendingDueOccurrences([itemRealized], [checking], [], new Date(2026, 8, 16, 10, 0, 0));
  assert.equal(due16Done.length, 0);
});

test("regra do 5º dia útil bancário respeita feriado nacional (Independência em 07/09) e vence no dia 08/09/2026", () => {
  // Setembro de 2026:
  // 01/09 Ter (1º), 02/09 Qua (2º), 03/09 Qui (3º), 04/09 Sex (4º)
  // 05/09 Sáb, 06/09 Dom
  // 07/09 Seg (Feriado Nacional - Independência) -> não é dia útil bancário
  // 08/09 Ter (5º dia útil bancário)
  const holiday = new Date(2026, 8, 7);
  assert.equal(isBusinessDay(holiday), false);
  assert.equal(get5thBusinessDay(2026, 8), 8);

  const businessDayItem = {
    id: "clt-salary",
    title: "Salário CLT",
    amount: 6500,
    type: "income",
    category: "Salário",
    account: checking.name,
    cardId: checking.id,
    recurrenceType: "business_day_5",
    active: true,
    startYear: 2026,
    startMonth: 8,
    realizedPeriods: [],
  };

  // No feriado de 07/09: ainda não venceu
  const dueOnHoliday = getPendingDueOccurrences([businessDayItem], [checking], [], new Date(2026, 8, 7, 16, 0, 0));
  assert.equal(dueOnHoliday.length, 0);

  // No dia 08/09 (5º dia útil): vence
  const dueOn5thDay = getPendingDueOccurrences([businessDayItem], [checking], [], new Date(2026, 8, 8, 9, 0, 0));
  assert.equal(dueOn5thDay.length, 1);
  assert.equal(dueOn5thDay[0].dueDate.getDate(), 8);
});

test("virada de mês e navegação temporal dinâmica (Agosto -> Setembro -> Outubro e virada de ano para Janeiro/2027)", () => {
  // 1. Janela em Setembro de 2026: Agosto (passado), Setembro (Atual), Outubro (futuro), Novembro (futuro)
  const septWindow = getPlanningMonthsWindow(1, 2, new Date(2026, 8, 14));
  assert.equal(septWindow.length, 4);
  assert.deepEqual(septWindow.map((m) => ({ name: m.name, isPast: m.isPast, isCurrent: m.isCurrent })), [
    { name: "Agosto", isPast: true, isCurrent: false },
    { name: "Setembro (Atual)", isPast: false, isCurrent: true },
    { name: "Outubro", isPast: false, isCurrent: false },
    { name: "Novembro", isPast: false, isCurrent: false },
  ]);

  // 2. Virada automática para Outubro de 2026
  const octWindow = getPlanningMonthsWindow(1, 2, new Date(2026, 9, 1));
  assert.deepEqual(octWindow.map((m) => ({ name: m.name, isPast: m.isPast, isCurrent: m.isCurrent })), [
    { name: "Setembro", isPast: true, isCurrent: false },
    { name: "Outubro (Atual)", isPast: false, isCurrent: true },
    { name: "Novembro", isPast: false, isCurrent: false },
    { name: "Dezembro", isPast: false, isCurrent: false },
  ]);

  // 3. Virada de ano em Dezembro de 2026
  const decWindow = getPlanningMonthsWindow(1, 2, new Date(2026, 11, 15));
  assert.deepEqual(decWindow.map((m) => ({ name: m.name, year: m.year, monthIndex: m.monthIndex })), [
    { name: "Novembro", year: 2026, monthIndex: 10 },
    { name: "Dezembro (Atual)", year: 2026, monthIndex: 11 },
    { name: "Janeiro", year: 2027, monthIndex: 0 },
    { name: "Fevereiro", year: 2027, monthIndex: 1 },
  ]);
});

test("catch-up: usuário ausente por 10 dias tem todos os lançamentos vencidos recuperados em ordem cronológica", () => {
  const recurringItems = [
    {
      id: "internet",
      title: "Internet Fibra",
      amount: 150,
      type: "expense",
      category: "Moradia",
      account: checking.name,
      cardId: checking.id,
      dueDay: 12,
      active: true,
      startYear: 2026,
      startMonth: 8,
      realizedPeriods: [],
    },
    {
      id: "salario",
      title: "Salário",
      amount: 5000,
      type: "income",
      category: "Salário",
      account: checking.name,
      cardId: checking.id,
      dueDay: 15,
      active: true,
      startYear: 2026,
      startMonth: 8,
      realizedPeriods: [],
    },
    {
      id: "academia",
      title: "Academia",
      amount: 120,
      type: "expense",
      category: "Saúde",
      account: checking.name,
      cardId: checking.id,
      dueDay: 18,
      active: true,
      startYear: 2026,
      startMonth: 8,
      realizedPeriods: [],
    },
    {
      id: "condominio",
      title: "Condomínio",
      amount: 600,
      type: "expense",
      category: "Moradia",
      account: checking.name,
      cardId: checking.id,
      dueDay: 25, // Ainda futuro no dia 20
      active: true,
      startYear: 2026,
      startMonth: 8,
      realizedPeriods: [],
    },
  ];

  // Usuário abre o app no dia 20 de setembro
  const asOf20 = new Date(2026, 8, 20, 10, 0, 0);
  const catchUpOccurrences = getPendingDueOccurrences(recurringItems, [checking], [], asOf20);

  assert.equal(catchUpOccurrences.length, 3);
  assert.equal(catchUpOccurrences[0].recurringItemId, "internet");
  assert.equal(catchUpOccurrences[0].dueDate.getDate(), 12);
  assert.equal(catchUpOccurrences[1].recurringItemId, "salario");
  assert.equal(catchUpOccurrences[1].dueDate.getDate(), 15);
  assert.equal(catchUpOccurrences[2].recurringItemId, "academia");
  assert.equal(catchUpOccurrences[2].dueDate.getDate(), 18);
});

test("idempotência absoluta: reprocessamento consecutivo não gera lançamentos duplicados", () => {
  const item = {
    id: "subscription-netflix",
    title: "Netflix",
    amount: 55,
    type: "expense",
    category: "Lazer",
    account: checking.name,
    cardId: checking.id,
    dueDay: 5,
    active: true,
    startYear: 2026,
    startMonth: 8,
    realizedPeriods: [],
  };

  const asOf = new Date(2026, 8, 14, 12, 0, 0);

  // 1ª Execução: detecta pendência
  const firstRun = getPendingDueOccurrences([item], [checking], [], asOf);
  assert.equal(firstRun.length, 1);
  const generatedId = firstRun[0].occurrenceId;
  assert.equal(generatedId, "rec-tx-subscription-netflix-2026-09");

  // Após materialização: gravou transação e adicionou a realizedPeriods
  const recordedTransactions = [{ id: generatedId, recurringItemId: item.id, periodKey: "2026-09" }];
  const updatedItem = { ...item, realizedPeriods: ["2026-09"] };

  // Execuções 2 a 10: devem retornar 0 pendências
  for (let i = 0; i < 10; i++) {
    const nextRun = getPendingDueOccurrences([updatedItem], [checking], recordedTransactions, asOf);
    assert.equal(nextRun.length, 0);
  }

  // Idempotência mesmo se apenas existingTransactions tiver sido gravado
  const runOnlyWithTx = getPendingDueOccurrences([item], [checking], recordedTransactions, asOf);
  assert.equal(runOnlyWithTx.length, 0);

  // Idempotência mesmo se apenas realizedPeriods tiver sido gravado
  const runOnlyWithPeriod = getPendingDueOccurrences([updatedItem], [checking], [], asOf);
  assert.equal(runOnlyWithPeriod.length, 0);
});

test("separação de impacto financeiro: débito reduz conta corrente enquanto compra no cartão afeta fatura", () => {
  // Saldo inicial de 5.000 na conta corrente
  const initialChecking = { ...checking, openingBalance: 5000 };

  // 1. Recorrente em conta corrente (Aluguel debitado da conta corrente)
  const rentItem = {
    id: "rent-debit",
    title: "Aluguel",
    amount: 1500,
    type: "expense",
    category: "Moradia",
    account: checking.name,
    cardId: checking.id,
    dueDay: 10,
    active: true,
    startYear: 2026,
    startMonth: 8,
  };

  // 2. Recorrente em cartão de crédito (Streaming no cartão)
  const streamingItem = {
    id: "streaming-credit",
    title: "Streaming de Vídeo",
    amount: 50,
    type: "expense",
    category: "Lazer",
    account: credit.name,
    cardId: credit.id,
    dueDay: 8,
    active: true,
    startYear: 2026,
    startMonth: 8,
  };

  const due = getPendingDueOccurrences([rentItem, streamingItem], [checking, credit], [], new Date(2026, 8, 14));
  assert.equal(due.length, 2);

  const rentOccurrence = due.find((d) => d.recurringItemId === "rent-debit");
  const streamingOccurrence = due.find((d) => d.recurringItemId === "streaming-credit");

  assert.equal(rentOccurrence.isCredit, false);
  assert.equal(streamingOccurrence.isCredit, true);

  // Materializa as duas transações
  const materializedTransactions = [
    {
      id: rentOccurrence.occurrenceId,
      amount: rentOccurrence.amount,
      type: "despesa",
      account: checking.name,
      cardId: checking.id,
      occurredAt: rentOccurrence.dueDate,
    },
    {
      id: streamingOccurrence.occurrenceId,
      amount: streamingOccurrence.amount,
      type: "despesa",
      account: credit.name,
      cardId: credit.id,
      occurredAt: streamingOccurrence.dueDate,
    },
  ];

  // O saldo da conta corrente reduz APENAS pelo aluguel (5.000 - 1.500 = 3.500). O streaming no cartão NÃO toca a conta.
  const checkingBalance = calculateCheckingBalance(initialChecking, materializedTransactions);
  assert.equal(checkingBalance, 3500);

  // O streaming afeta a fatura do cartão de crédito
  const creditSchedule = calculateInvoiceSchedule(credit, materializedTransactions);
  assert.equal(creditSchedule["2026-09"], 50);

  // Quando a fatura do cartão for paga via débito em conta corrente:
  const paymentTransaction = {
    id: "card-payment-2026-09",
    amount: 50,
    type: "despesa",
    account: checking.name,
    cardId: checking.id,
    occurredAt: new Date(2026, 8, 18),
  };
  const finalBalanceAfterBillPayment = calculateCheckingBalance(initialChecking, [...materializedTransactions, paymentTransaction]);
  assert.equal(finalBalanceAfterBillPayment, 3450);
});

test("saldo real versus projetado: materialização não causa dupla contagem no saldo final", () => {
  // Cenário inicial:
  // Saldo atual em conta = 1.000
  // Salário futuro agendado para dia 20: 4.000
  const initialSalary = {
    id: "salary-job",
    title: "Salário Empresa",
    amount: 4000,
    type: "income",
    category: "Salário",
    account: checking.name,
    cardId: checking.id,
    dueDay: 20,
    active: true,
    startYear: 2026,
    startMonth: 8,
    realizedPeriods: [],
  };

  const initialAccount = { ...checking, openingBalance: 1000 };

  // ANTES do dia 20 (ex: dia 14):
  // Saldo real em conta é 1.000 (sem transações de salário)
  const balanceBefore = calculateCheckingBalance(initialAccount, []);
  assert.equal(balanceBefore, 1000);

  // No planejamento, o salário está ativo como receita pendente
  const isPendingBefore = isRecurringActiveInMonth(initialSalary, 2026, 8);
  assert.equal(isPendingBefore, true);

  // Projeção: 1.000 (saldo em conta) + 4.000 (entradas pendentes) - 0 = 5.000
  const projectedBefore = calculateProjectedBalance(balanceBefore, 4000, 0);
  assert.equal(projectedBefore, 5000);

  // CHEGADA DO DIA 20: Ocorrência vence e é materializada
  const due = getPendingDueOccurrences([initialSalary], [checking], [], new Date(2026, 8, 20));
  assert.equal(due.length, 1);

  // 1. Cria a transação real na conta
  const newTx = {
    id: due[0].occurrenceId,
    amount: due[0].amount,
    type: "receita",
    account: checking.name,
    cardId: checking.id,
    occurredAt: due[0].dueDate,
  };

  // 2. Marca o período "2026-09" como realizado no item recorrente
  const updatedSalary = { ...initialSalary, realizedPeriods: ["2026-09"] };

  // DEPOIS da materialização:
  // Saldo real em conta passa a ser 5.000
  const balanceAfter = calculateCheckingBalance(initialAccount, [newTx]);
  assert.equal(balanceAfter, 5000);

  // No planejamento, o salário NÃO é mais pendência
  const isPendingAfter = isRecurringActiveInMonth(updatedSalary, 2026, 8);
  assert.equal(isPendingAfter, false);

  // Projeção atualizada: 5.000 (saldo em conta) + 0 (entradas pendentes) - 0 = 5.000
  const projectedAfter = calculateProjectedBalance(balanceAfter, 0, 0);
  assert.equal(projectedAfter, 5000);

  // Total projetado se manteve íntegro (5.000 antes, 5.000 depois), sem dupla contagem para 9.000!
  assert.equal(projectedBefore, projectedAfter);
});

test("groupRecurringItemsByDate agrupa lançamentos pelo dia e calcula subtotais diários ordenados", () => {
  const items = [
    { id: "1", title: "Aluguel", amount: 2000, dueDay: 20, recurrenceType: "fixed_day" },
    { id: "2", title: "Luz", amount: 120, dueDay: 10, recurrenceType: "fixed_day" },
    { id: "3", title: "Internet", amount: 150, dueDay: 20, recurrenceType: "fixed_day" },
    { id: "4", title: "Salário 5º DU", amount: 5000, recurrenceType: "business_day_5" }, // Em Setembro/2026 cai no dia 8
    { id: "5", title: "Condomínio", amount: 500, dueDay: 20, recurrenceType: "fixed_day" },
    { id: "6", title: "Streaming", amount: 40, dueDay: 10, recurrenceType: "fixed_day" },
  ];

  const grouped = groupRecurringItemsByDate(items, 2026, 8);

  // Deve haver 3 grupos de dias distintos: Dia 8 (5º DU), Dia 10 e Dia 20
  assert.equal(grouped.length, 3);

  // 1º grupo: 5º dia útil (Dia 8)
  assert.equal(grouped[0].day, 8);
  assert.equal(grouped[0].items.length, 1);
  assert.equal(grouped[0].totalAmount, 5000);
  assert.match(grouped[0].label, /5º dia útil/i);

  // 2º grupo: Dia 10
  assert.equal(grouped[1].day, 10);
  assert.equal(grouped[1].items.length, 2);
  assert.equal(grouped[1].totalAmount, 160); // 120 + 40
  assert.equal(grouped[1].label, "Dia 10");

  // 3º grupo: Dia 20 (Aluguel 2000 + Internet 150 + Condomínio 500 = 2650)
  assert.equal(grouped[2].day, 20);
  assert.equal(grouped[2].items.length, 3);
  assert.equal(grouped[2].totalAmount, 2650);
  assert.equal(grouped[2].label, "Dia 20");
});

test("antecipação imediata de pagamento/recebimento futuro atualiza saldo e remove pendência sem duplicidade", () => {
  const initialAccount = { ...checking, openingBalance: 3000 };

  const plannedBill = {
    id: "bill-energy",
    title: "Conta de Luz",
    amount: 250,
    type: "expense",
    account: checking.name,
    cardId: checking.id,
    category: "Moradia & Contas",
    dueDay: 20,
    recurrenceType: "fixed_day",
    active: true,
  };

  // 1. Antes de pagar antecipado (ex: dia 5 do mês)
  const isPendingInitial = isRecurringActiveInMonth(plannedBill, 2026, 8);
  assert.equal(isPendingInitial, true);
  const balanceInitial = calculateCheckingBalance(initialAccount, []);
  assert.equal(balanceInitial, 3000);

  // 2. Usuário clica em 'Pagar antes' no dia 5:
  // Lançamento é materializado adiantado com a data de hoje (05/09/2026)
  const earlyTx = {
    id: `rec-tx-${plannedBill.id}-2026-09`,
    amount: plannedBill.amount,
    type: "despesa",
    account: checking.name,
    cardId: checking.id,
    occurredAt: new Date(2026, 8, 5, 14, 30),
    recurringItemId: plannedBill.id,
    periodKey: "2026-09",
  };

  const updatedBill = {
    ...plannedBill,
    realizedPeriods: ["2026-09"],
  };

  // 3. Após a antecipação:
  // Saldo real é debitado imediatamente: 3000 - 250 = 2750
  const balanceAfter = calculateCheckingBalance(initialAccount, [earlyTx]);
  assert.equal(balanceAfter, 2750);

  // O item de planejamento NÃO está mais pendente para Setembro
  const isPendingAfter = isRecurringActiveInMonth(updatedBill, 2026, 8);
  assert.equal(isPendingAfter, false);

  // O motor de progressão temporal não o reprocessará no dia 20 (idempotência garantida)
  const dueOnDay20 = getPendingDueOccurrences(
    [updatedBill],
    [checking],
    [earlyTx],
    new Date(2026, 8, 20)
  );
  assert.equal(dueOnDay20.length, 0);
});



