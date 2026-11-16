/**
 * Cenários da avaliação de inteligência da IA.
 * Cada cenário é uma vida financeira sintética (com meses anteriores, para média)
 * e o que a IA PRECISA perceber. A data de referência é o dia 15 do mês corrente.
 */
import type { FinancialTelemetryInput, TransactionContextItem } from "../../lib/services/financialContextService.ts";
import type { AnalyticsInput, AnalyticsProjection } from "../../lib/services/financialAnalyticsService.ts";
import type { BriefingMood } from "../../lib/services/aiBriefingService.ts";
import type { CardItem, GoalItem, RecurringItem } from "../../types/index.ts";

export interface ChatProbe {
  question: string;
  /** A resposta precisa citar o valor de pelo menos um destes fatos. */
  mustMentionAnyFact?: string[];
  /** Veredito esperado (ex.: dizer que não cabe no orçamento). */
  verdict?: RegExp;
  verdictLabel?: string;
  forbidden?: RegExp;
  /** Valores que NÃO podem aparecer (ex.: total histórico tratado como do mês). */
  forbiddenNumbers?: number[];
}

export interface ScenarioExpectation {
  moods: BriefingMood[];
  /** Cada grupo: pelo menos um desses fatos precisa aparecer como evidência em algum ponto. */
  mustCiteGroups?: string[][];
  /** O primeiro ponto de atenção precisa ter um destes fatos como evidência. */
  topRiskAny?: string[];
  topRiskSeverity?: Array<"alta" | "media" | "baixa">;
  /** Proíbe pontos de severidade alta (cenários saudáveis). */
  noHighSeverity?: boolean;
  /** Pelo menos um ponto a favor precisa citar um destes fatos. */
  positiveAny?: string[];
  /** Frases que indicam leitura errada da situação. */
  forbidden?: Array<{ pattern: RegExp; reason: string }>;
  /** Valores que não podem aparecer em nenhum texto (somas de outros períodos). */
  forbiddenNumbers?: Array<{ value: number; reason: string }>;
}

export interface EvalScenario {
  id: string;
  title: string;
  now: Date;
  input: FinancialTelemetryInput;
  analyticsInput: AnalyticsInput;
  expect: ScenarioExpectation;
  chat: ChatProbe[];
}

const today = new Date();
const Y = today.getFullYear();
const M = today.getMonth();
const NOW = new Date(Y, M, 15, 12);
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const iso = (monthOffset: number, d: number) => {
  const date = new Date(Y, M + monthOffset, d, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const scheme = { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" };
const checking = (balance: number): CardItem => ({ id: "conta", name: "Conta principal", brand: "Banco", type: "checking", limit: 0, spent: 0, balance, colorScheme: scheme });
const credit = (id: string, limit: number, spent: number, dueDay = 10, closingDay = 3): CardItem => ({ id, name: `Cartão ${id}`, brand: "Visa", type: "credit", limit, spent, dueDay, closingDay, colorScheme: scheme });

let seq = 0;
const tx = (monthOffset: number, d: number, title: string, amount: number, category: string, extra: Partial<TransactionContextItem> = {}): TransactionContextItem => ({
  id: `t${seq++}`,
  title,
  amount,
  type: "despesa",
  category,
  account: "Conta principal",
  cardId: "conta",
  date: iso(monthOffset, d),
  ...extra,
});
const income = (monthOffset: number, d: number, title: string, amount: number, extra: Partial<TransactionContextItem> = {}): TransactionContextItem =>
  tx(monthOffset, d, title, amount, "Salário / Extra", { type: "receita", ...extra });

const bill = (id: string, title: string, amount: number, dueDay: number, category = "Moradia & Contas"): RecurringItem => ({
  id, title, amount, account: "Conta principal", cardId: "conta", category, dueDay, active: true, startYear: Y - 1, startMonth: 0,
});
const plannedIncome = (id: string, title: string, amount: number, dueDay: number): RecurringItem => ({
  ...bill(id, title, amount, dueDay, "Salário / Extra"), type: "income",
});

const profile = (income: number, extra: Record<string, unknown> = {}) => ({
  name: "Pessoa", email: "", role: "", avatarInitials: "P", monthlyIncomeBase: income, currency: "BRL",
  persona: "optimizer" as const, riskTolerance: "moderate" as const, aiTone: "direct" as const,
  maxCommitmentAlertPercent: 60, primaryFocus: "Fechar o mês no azul", ...extra,
});

interface Life {
  income: number;
  target: number;
  balanceToday: number;
  received: number;
  paid: number;
  toReceive: number;
  toPay: number;
  invoicesToPay?: number;
  cards?: CardItem[];
  transactions: TransactionContextItem[];
  recurring?: RecurringItem[];
  goals?: GoalItem[];
  cardInvoices?: AnalyticsProjection["cardInvoices"];
  next?: { income: number; committed: number; installments: number; free: number };
  profileExtra?: Record<string, unknown>;
}

/** Monta as duas entradas (contexto antigo do chat + análise nova) a partir da mesma vida financeira. */
function life(l: Life): { input: FinancialTelemetryInput; analyticsInput: AnalyticsInput } {
  const cards = [checking(l.balanceToday), ...(l.cards ?? [])];
  const close = l.balanceToday + l.toReceive - l.toPay;
  const current: AnalyticsProjection = {
    monthName: MONTH_NAMES[M], year: Y, openingBalance: l.balanceToday - l.received + l.paid, actualClosingBalance: l.balanceToday,
    actualIncomeTotal: l.received, actualOutflowTotal: l.paid, plannedIncomesTotal: l.toReceive, projectedIncome: l.received + l.toReceive,
    pendingCommitted: l.toPay, totalCommitted: l.paid + l.toPay, cardInstallments: 0, totalInvoicesPending: l.invoicesToPay ?? 0,
    projectedFreeBalance: close, cardInvoices: l.cardInvoices ?? [],
  };
  const projections: AnalyticsProjection[] = [current];
  if (l.next) {
    projections.push({
      monthName: MONTH_NAMES[(M + 1) % 12], year: Y, plannedIncomesTotal: l.next.income, projectedIncome: l.next.income,
      totalCommitted: l.next.committed, cardInstallments: l.next.installments, projectedFreeBalance: l.next.free,
    });
  }
  const userProfile = profile(l.income, { targetMonthEndBalance: l.target, ...(l.profileExtra ?? {}) });
  return {
    input: {
      userProfile, cards, transactions: l.transactions, recurringItems: l.recurring ?? [], goals: l.goals ?? [],
      mainBalance: l.balanceToday, monthIncome: l.received, monthExpense: l.paid, targetEndMonthBalance: l.target,
      monthlyProjections: projections as FinancialTelemetryInput["monthlyProjections"],
    },
    analyticsInput: {
      cards, transactions: l.transactions, recurringItems: l.recurring ?? [], goals: l.goals ?? [], monthlyProjections: projections,
      mainBalance: l.balanceToday, targetEndMonthBalance: l.target, monthlyIncomeBase: l.income, now: NOW,
    },
  };
}

/** Meses anteriores "normais" para dar base de comparação (mesmo período e mês inteiro). */
function history(months: number[], perMonth: Array<[number, string, number, string]>): TransactionContextItem[] {
  return months.flatMap((offset) => perMonth.map(([d, title, amount, category]) => tx(offset, d, title, amount, category)));
}

// ---------------------------------------------------------------------------
// 1. O caso real relatado: pouco saldo hoje, contas a pagar, mas salário a caminho.
//    Lazer alto nos meses anteriores e baixo neste mês.
// ---------------------------------------------------------------------------
const lazerHistory = history([-1, -2, -3], [
  [3, "Cinema", 180, "Lazer & Hobbies"], [5, "Show", 420, "Lazer & Hobbies"], [8, "Bar", 160, "Lazer & Hobbies"],
  [12, "Streaming", 55, "Assinaturas & Serviços"], [18, "Viagem curta", 600, "Lazer & Hobbies"], [22, "Restaurante", 230, "Lazer & Hobbies"],
  [6, "Mercado", 480, "Alimentação & Delivery"], [14, "Mercado", 390, "Alimentação & Delivery"],
]);
const caso1 = life({
  income: 4007.93, target: 700, balanceToday: 5.65, received: 1874.85, paid: 2082.61, toReceive: 2133.08, toPay: 764.04,
  transactions: [
    ...lazerHistory,
    income(0, 9, "Salario Fixo", 1874.85),
    tx(0, 2, "Aluguel", 1100, "Moradia & Contas", { recurringItemId: "aluguel" }),
    tx(0, 6, "Mercado", 410, "Alimentação & Delivery"),
    tx(0, 10, "Farmácia", 96.61, "Saúde & Bem-estar"),
    tx(0, 11, "Cinema", 46, "Lazer & Hobbies"),
    tx(0, 12, "Mercado", 430, "Alimentação & Delivery"),
  ],
  recurring: [
    bill("aluguel", "Aluguel", 1100, 2),
    bill("cartao-loja", "Carnê da loja", 500, 17, "Compras & Outros"),
    bill("internet", "Internet e energia", 264.04, 25),
    plannedIncome("salario", "Salario Fixo", 1874.85, 9),
    plannedIncome("adiantamento", "Salario (Adiantamento)", 1233.59, 20),
    plannedIncome("decimo", "1ª Parcela do Décimo Terceiro", 899.49, 30),
  ],
  next: { income: 3108.44, committed: 1864.04, installments: 0, free: 1244.4 },
});
const lazerAllTime = lazerHistory.filter((t) => /Lazer|Assinaturas/.test(t.category)).reduce((s, t) => s + t.amount, 0) + 46;

export const SCENARIOS: EvalScenario[] = [
  {
    id: "salario-a-caminho",
    title: "Saldo baixo hoje e contas a pagar, mas salário a caminho (caso real relatado)",
    now: NOW,
    ...caso1,
    expect: {
      moods: ["atencao"],
      topRiskAny: ["dia_fica_negativo", "menor_saldo", "entrada_que_cobre", "dia_entrada_que_cobre", "dia_menor_saldo"],
      positiveAny: ["a_receber", "saldo_fim_mes", "folga_meta", "gasto_livre_dia", "ritmo_gastos_pct", "gasto_mes"],
      mustCiteGroups: [["saldo_fim_mes", "a_receber", "folga_meta"]],
      forbidden: [
        { pattern: /(contas|despesas)[^.]{0,40}(superam|maiores que|passam d)[^.]{0,20}(seu |o )?saldo(?! previsto| no fim)/i, reason: "comparou contas só com o saldo de hoje, ignorando o que vai entrar" },
        { pattern: /(mês|mes) (fecha|vai fechar) (no )?(negativo|vermelho)/i, reason: "disse que o mês fecha negativo (fecha positivo)" },
      ],
      forbiddenNumbers: [{ value: lazerAllTime, reason: "usou o lazer somado de vários meses como se fosse deste mês" }],
    },
    chat: [
      { question: "Vou conseguir pagar minhas contas este mês?", verdict: /(^|\n)\W*sim(?!\p{L})|vai conseguir|consegue pagar|dá para pagar|cobre/iu, verdictLabel: "dizer que sim, com as entradas previstas", mustMentionAnyFact: ["a_receber", "saldo_fim_mes", "entrada_que_cobre"] },
      { question: "Quanto eu gastei com lazer este mês?", mustMentionAnyFact: ["categoria_1", "categoria_2", "categoria_3"], forbiddenNumbers: [lazerAllTime] },
    ],
  },
  {
    id: "mes-no-vermelho",
    title: "Mesmo com o salário a receber, o mês fecha negativo",
    now: NOW,
    ...life({
      income: 4200, target: 500, balanceToday: 320, received: 4200, paid: 3900, toReceive: 0, toPay: 1260,
      cards: [credit("roxo", 3000, 2650)],
      cardInvoices: [{ cardId: "roxo", cardName: "Cartão roxo", dueDay: 22, pendingInvoice: 820, isPaid: false }],
      invoicesToPay: 820,
      transactions: [
        ...history([-1, -2, -3], [[4, "Mercado", 600, "Alimentação & Delivery"], [10, "Uber", 120, "Transporte & Combustível"]]),
        income(0, 5, "Salário", 4200),
        tx(0, 6, "Aluguel", 1800, "Moradia & Contas"), tx(0, 8, "Mercado", 900, "Alimentação & Delivery"),
        tx(0, 9, "Uber", 260, "Transporte & Combustível"), tx(0, 12, "Eletrônicos", 940, "Tecnologia"),
      ],
      recurring: [bill("luz", "Energia", 310, 25), bill("net", "Internet", 130, 26)],
      next: { income: 4200, committed: 3900, installments: 1490, free: 300 },
    }),
    expect: {
      moods: ["critico"],
      topRiskAny: ["saldo_fim_mes", "falta_meta", "a_pagar", "corte_dia", "dia_fica_negativo", "menor_saldo"],
      topRiskSeverity: ["alta"],
      mustCiteGroups: [["saldo_fim_mes", "falta_meta"], ["a_pagar", "faturas_a_pagar", "gasto_mes", "ritmo_gastos_pct", "maior_alta"]],
      forbidden: [{ pattern: /meta (está |esta )?(garantida|atingida|batida)/i, reason: "disse que a meta está garantida num mês negativo" }],
    },
    chat: [
      { question: "Consigo comprar um fone de R$ 600 à vista agora?", verdict: /(^|\n)\W*n[ãa]o(?!\p{L})|n[ãa]o (recomend|cabe|d[áa]|consegue|vale)|evite|adie|espere/iu, verdictLabel: "desaconselhar a compra", mustMentionAnyFact: ["saldo_fim_mes", "falta_meta", "saldo_hoje", "a_pagar"] },
    ],
  },
  {
    id: "poupador-exemplar",
    title: "Renda alta, gastando menos que a média e acima da meta",
    now: NOW,
    ...life({
      income: 12000, target: 3000, balanceToday: 9400, received: 12000, paid: 2600, toReceive: 0, toPay: 260,
      cards: [credit("preto", 20000, 1800)],
      transactions: [
        ...history([-1, -2, -3], [[3, "Mercado", 900, "Alimentação & Delivery"], [7, "Restaurante", 600, "Lazer & Hobbies"], [11, "Compras", 700, "Compras & Outros"]]),
        income(0, 5, "Salário", 12000), tx(0, 6, "Aluguel", 2000, "Moradia & Contas", { recurringItemId: "aluguel" }), tx(0, 9, "Mercado", 600, "Alimentação & Delivery"),
      ],
      recurring: [bill("aluguel", "Aluguel", 2000, 6), bill("luz", "Energia", 260, 28)],
      goals: [{ id: "g1", title: "Reserva", category: "Segurança", current: 30000, target: 40000 }],
      next: { income: 12000, committed: 4060, installments: 1800, free: 7940 },
    }),
    expect: {
      moods: ["positivo"],
      noHighSeverity: true,
      positiveAny: ["folga_meta", "saldo_fim_mes", "gasto_livre_dia", "ritmo_gastos_pct", "gasto_mes"],
      forbidden: [{ pattern: /(no vermelho|negativ[oa]|estour)/i, reason: "alarmou sem motivo" }],
    },
    chat: [
      { question: "Quanto eu posso gastar por dia até o fim do mês sem atrapalhar minha meta?", mustMentionAnyFact: ["gasto_livre_dia", "folga_meta"] },
      { question: "Vale a pena colocar parte da sobra na minha reserva?", verdict: /(?<!\p{L})(sim|vale|faz sentido|recomendo|pode)(?!\p{L})/iu, verdictLabel: "apoiar o aporte", mustMentionAnyFact: ["folga_meta", "objetivo_1_falta", "saldo_fim_mes"] },
    ],
  },
  {
    id: "cartao-no-limite",
    title: "Caixa ok neste mês, mas cartão quase estourado e parcelas pesadas no mês seguinte",
    now: NOW,
    ...life({
      income: 6500, target: 800, balanceToday: 3100, received: 6500, paid: 3400, toReceive: 0, toPay: 0,
      cards: [credit("azul", 8000, 7450, 12, 4)],
      transactions: [
        ...history([-1, -2, -3], [[4, "Mercado", 700, "Alimentação & Delivery"], [9, "Restaurante", 300, "Lazer & Hobbies"]]),
        income(0, 5, "Salário", 6500), tx(0, 6, "Aluguel", 2100, "Moradia & Contas"),
        tx(0, 7, "Notebook 10x", 4800, "Tecnologia", { cardId: "azul", account: "Cartão azul" }),
        tx(0, 8, "Viagem", 1900, "Lazer & Hobbies", { cardId: "azul", account: "Cartão azul" }),
        tx(0, 10, "Mercado", 650, "Alimentação & Delivery"),
      ],
      next: { income: 6500, committed: 4480, installments: 2380, free: 2020 },
    }),
    expect: {
      moods: ["atencao", "critico"],
      topRiskAny: ["limite_uso_pct", "limite_disponivel", "proximo_mes_parcelas", "proximo_mes_entradas", "maior_alta", "ritmo_gastos_pct", "gasto_mes_cartao"],
      mustCiteGroups: [["limite_uso_pct", "limite_disponivel"], ["proximo_mes_parcelas", "proximo_mes_saldo", "gasto_mes_cartao"]],
      forbidden: [{ pattern: /(fatura|cartão)[^.]{0,40}(já|ja) (está|esta) paga/i, reason: "tratou a fatura futura como paga" }],
    },
    chat: [
      { question: "Posso parcelar mais uma compra de R$ 1.200 no cartão?", verdict: /(?<!\p{L})(não|nao|evite|cuidado|arrisc\p{L}*|segure|adie|melhor esperar)(?!\p{L})/iu, verdictLabel: "alertar sobre o limite", mustMentionAnyFact: ["limite_disponivel", "limite_uso_pct", "proximo_mes_parcelas"] },
    ],
  },
  {
    id: "gasto-acelerado",
    title: "Mês ainda positivo, mas delivery muito acima da média deste período",
    now: NOW,
    ...life({
      income: 7000, target: 1500, balanceToday: 3600, received: 7000, paid: 3400, toReceive: 0, toPay: 0,
      transactions: [
        ...history([-1, -2, -3], [[4, "iFood", 60, "Alimentação & Delivery"], [11, "iFood", 70, "Alimentação & Delivery"], [9, "Mercado", 500, "Alimentação & Delivery"], [6, "Aluguel", 2200, "Moradia & Contas"]]),
        income(0, 5, "Salário", 7000), tx(0, 6, "Aluguel", 2200, "Moradia & Contas"), tx(0, 9, "Mercado", 500, "Alimentação & Delivery"),
        ...Array.from({ length: 9 }, (_, i) => tx(0, 2 + i, i % 2 ? "iFood" : "Rappi", 70 + i * 6, "Alimentação & Delivery")),
      ],
      goals: [{ id: "g1", title: "Viagem", category: "Lazer", current: 1200, target: 6000 }],
      next: { income: 7000, committed: 2200, installments: 0, free: 4800 },
    }),
    expect: {
      moods: ["atencao"],
      noHighSeverity: true,
      mustCiteGroups: [["habito_1", "habito_1_qtd", "maior_alta", "maior_alta_pct", "ritmo_gastos_pct", "gasto_media_periodo"]],
      positiveAny: ["folga_meta", "saldo_fim_mes", "gasto_livre_dia"],
    },
    chat: [{ question: "Por que meu dinheiro está acabando mais rápido este mês?", mustMentionAnyFact: ["habito_1", "maior_alta", "gasto_mes", "ritmo_gastos_pct", "categoria_1"] }],
  },
  {
    id: "comecando-agora",
    title: "Conta nova, quase sem lançamentos e sem renda informada",
    now: NOW,
    ...life({
      income: 0, target: 0, balanceToday: 350, received: 0, paid: 18, toReceive: 0, toPay: 0,
      transactions: [tx(0, 2, "Padaria", 18, "Alimentação & Delivery")],
      profileExtra: { primaryFocus: "" },
    }),
    expect: {
      moods: ["neutro", "positivo"],
      noHighSeverity: true,
      forbidden: [
        { pattern: /(estour|no vermelho|crise|perigo)/i, reason: "inventou alarme sem dados" },
        { pattern: /reserva de emergência.{0,40}(insuficiente|baixa)/i, reason: "julgou reserva sem renda informada" },
      ],
    },
    chat: [{ question: "Por onde eu começo a organizar meu dinheiro aqui?", verdict: /(regist|lanç|cadastr|anot|inform)/i, verdictLabel: "orientar a registrar dados" }],
  },
];
