/**
 * Cenários da avaliação de inteligência da IA.
 * Cada cenário é uma vida financeira sintética com o que a IA PRECISA perceber.
 * As datas são relativas ao mês corrente, então os cenários valem em qualquer dia.
 */
import type { FinancialTelemetryInput, MonthProjectionSummary } from "../../lib/services/financialContextService.ts";
import type { BriefingMood } from "../../lib/services/aiBriefingService.ts";

export interface ChatProbe {
  question: string;
  /** A resposta precisa citar o valor de pelo menos um destes fatos. */
  mustMentionAnyFact?: string[];
  /** Veredito esperado (ex.: dizer que não cabe no orçamento). */
  verdict?: RegExp;
  verdictLabel?: string;
  forbidden?: RegExp;
}

export interface ScenarioExpectation {
  moods: BriefingMood[];
  /** Cada grupo: pelo menos um desses fatos precisa aparecer como evidência em algum ponto. */
  mustCiteGroups?: string[][];
  /** O primeiro ponto de atenção precisa ter um destes fatos como evidência. */
  topRiskAny?: string[];
  /** Severidade exigida no primeiro ponto de atenção. */
  topRiskSeverity?: Array<"alta" | "media" | "baixa">;
  /** Proíbe pontos de severidade alta (cenários saudáveis). */
  noHighSeverity?: boolean;
  /** Pelo menos um ponto a favor precisa citar um destes fatos. */
  positiveAny?: string[];
  /** Frases que indicam leitura errada da situação. */
  forbidden?: Array<{ pattern: RegExp; reason: string }>;
}

export interface EvalScenario {
  id: string;
  title: string;
  input: FinancialTelemetryInput;
  expect: ScenarioExpectation;
  chat: ChatProbe[];
}

const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();
const day = (d: number) => new Date(y, m, Math.min(d, Math.max(1, now.getDate())), 12).toISOString().slice(0, 10);
const monthLabel = (offset: number) =>
  ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][(m + offset + 12) % 12];

const scheme = { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" };
const checking = (balance: number) => ({ id: "conta", name: "Conta principal", brand: "Banco", type: "checking" as const, limit: 0, spent: 0, balance, colorScheme: scheme });
const credit = (id: string, limit: number, spent: number, dueDay = 10, closingDay = 3) => ({ id, name: `Cartão ${id}`, brand: "Visa", type: "credit" as const, limit, spent, dueDay, closingDay, colorScheme: scheme });

function projection(p: Partial<MonthProjectionSummary> & { projectedFreeBalance: number }, offset = 0): MonthProjectionSummary {
  return {
    monthName: monthLabel(offset),
    year: y,
    openingBalance: 0,
    plannedIncomesTotal: 0,
    recurringDebitTotal: 0,
    recurringCreditTotal: 0,
    cardInstallments: 0,
    totalCommitted: 0,
    pendingCommitted: 0,
    totalInvoicesPending: 0,
    ...p,
  };
}

const profile = (income: number, extra: Record<string, unknown> = {}) => ({
  name: "Pessoa",
  email: "",
  role: "",
  avatarInitials: "P",
  monthlyIncomeBase: income,
  currency: "BRL",
  persona: "optimizer" as const,
  riskTolerance: "moderate" as const,
  aiTone: "direct" as const,
  maxCommitmentAlertPercent: 60,
  primaryFocus: "Fechar o mês no azul",
  ...extra,
});

const tx = (i: number, title: string, amount: number, category: string, d: number, extra: Record<string, unknown> = {}) => ({
  id: `t${i}`,
  title,
  amount,
  type: "despesa" as const,
  category,
  account: "Conta principal",
  cardId: "conta",
  date: day(d),
  ...extra,
});

const salary = (amount: number) => ({ id: "salario", title: "Salário", amount, type: "receita" as const, category: "Salário / Extra", account: "Conta principal", cardId: "conta", date: day(5) });

export const SCENARIOS: EvalScenario[] = [
  {
    id: "mes-no-vermelho",
    title: "Contas pendentes maiores que o saldo: o mês fecha negativo",
    input: {
      userProfile: profile(4200, { targetMonthEndBalance: 500 }),
      cards: [checking(820), credit("roxo", 3000, 2650)],
      transactions: [salary(4200), tx(1, "Aluguel", 1800, "Moradia & Contas", 6), tx(2, "Mercado Extra", 640, "Alimentação & Delivery", 8), tx(3, "Uber", 92, "Transporte & Combustível", 9), tx(4, "Farmácia", 160, "Saúde & Bem-estar", 10)],
      recurringItems: [
        { id: "luz", title: "Energia", amount: 310, account: "Conta principal", cardId: "conta", category: "Moradia & Contas", dueDay: 25, active: true },
        { id: "net", title: "Internet", amount: 130, account: "Conta principal", cardId: "conta", category: "Moradia & Contas", dueDay: 26, active: true },
      ],
      goals: [],
      mainBalance: 820,
      monthIncome: 4200,
      monthExpense: 2692,
      targetEndMonthBalance: 500,
      monthlyProjections: [
        projection({ openingBalance: 1300, recurringDebitTotal: 440, totalCommitted: 4290, pendingCommitted: 1598, totalInvoicesPending: 1158, projectedFreeBalance: -778 }),
        projection({ plannedIncomesTotal: 4200, cardInstallments: 1490, recurringDebitTotal: 2240, totalCommitted: 3730, projectedFreeBalance: 470 }, 1),
      ],
    },
    expect: {
      moods: ["critico"],
      topRiskAny: ["saldo_projetado", "falta_meta", "contas_pendentes", "corte_diario", "faturas_pendentes"],
      topRiskSeverity: ["alta"],
      mustCiteGroups: [["saldo_projetado", "falta_meta"], ["contas_pendentes", "faturas_pendentes", "limite_uso_pct"]],
      forbidden: [
        { pattern: /meta (está |esta )?(garantida|atingida|batida)/i, reason: "disse que a meta está garantida num mês negativo" },
        { pattern: /margem (segura|livre) de R\$/i, reason: "ofereceu margem de gasto num mês negativo" },
      ],
    },
    chat: [
      { question: "Consigo comprar um fone de R$ 600 à vista agora?", verdict: /(^|\n)\W*n[ãa]o(?!\p{L})|n[ãa]o (recomend|cabe|d[áa]|consegue|conseguiria|aconselh|vale)|evite|adie|espere/iu, verdictLabel: "desaconselhar a compra", mustMentionAnyFact: ["saldo_projetado", "falta_meta", "saldo_conta", "contas_pendentes"] },
      { question: "Quanto ainda vou pagar de contas este mês?", mustMentionAnyFact: ["contas_pendentes"] },
    ],
  },
  {
    id: "poupador-exemplar",
    title: "Renda alta, poupa bem e está acima da meta",
    input: {
      userProfile: profile(12000, { targetMonthEndBalance: 3000, persona: "scaler", primaryFocus: "Investir a sobra" }),
      cards: [checking(9400), credit("preto", 20000, 1800)],
      transactions: [salary(12000), tx(1, "Aluguel", 2800, "Moradia & Contas", 6), tx(2, "Mercado", 900, "Alimentação & Delivery", 9), tx(3, "Academia", 120, "Saúde & Bem-estar", 10)],
      recurringItems: [{ id: "luz", title: "Energia", amount: 260, account: "Conta principal", cardId: "conta", category: "Moradia & Contas", dueDay: 28, active: true }],
      goals: [{ id: "g1", title: "Reserva", category: "Segurança", current: 30000, target: 40000 }],
      mainBalance: 9400,
      monthIncome: 12000,
      monthExpense: 3820,
      targetEndMonthBalance: 3000,
      monthlyProjections: [
        projection({ openingBalance: 1220, recurringDebitTotal: 260, totalCommitted: 4080, pendingCommitted: 260, totalInvoicesPending: 0, projectedFreeBalance: 9140 }),
        projection({ plannedIncomesTotal: 12000, cardInstallments: 1800, recurringDebitTotal: 3060, totalCommitted: 4860, projectedFreeBalance: 7140 }, 1),
      ],
    },
    expect: {
      moods: ["positivo"],
      noHighSeverity: true,
      positiveAny: ["margem_segura", "taxa_poupanca", "saldo_projetado", "sobra_mes", "margem_diaria"],
      forbidden: [{ pattern: /(no vermelho|negativ[oa]|estour)/i, reason: "alarmou sem motivo" }],
    },
    chat: [
      { question: "Quanto posso gastar por dia até o fim do mês sem atrapalhar minha meta?", mustMentionAnyFact: ["margem_diaria", "margem_segura"] },
      { question: "Vale a pena colocar parte da sobra na minha reserva?", verdict: /\b(sim|vale|faz sentido|recomendo|pode)\b/i, verdictLabel: "apoiar o aporte", mustMentionAnyFact: ["margem_segura", "meta_1_falta", "saldo_projetado", "sobra_mes"] },
    ],
  },
  {
    id: "cartao-no-limite",
    title: "Caixa ok neste mês, mas cartão quase estourado e parcelas pesadas no mês seguinte",
    input: {
      userProfile: profile(6500, { targetMonthEndBalance: 800 }),
      cards: [checking(3100), credit("azul", 8000, 7450, 12, 4)],
      transactions: [salary(6500), tx(1, "Aluguel", 2100, "Moradia & Contas", 6), tx(2, "Notebook 10x", 4800, "Tecnologia", 7, { cardId: "azul", account: "Cartão azul" }), tx(3, "Viagem", 1900, "Lazer & Hobbies", 8, { cardId: "azul", account: "Cartão azul" })],
      recurringItems: [],
      goals: [],
      mainBalance: 3100,
      monthIncome: 6500,
      monthExpense: 2100,
      targetEndMonthBalance: 800,
      monthlyProjections: [
        projection({ openingBalance: 0, totalCommitted: 2100, pendingCommitted: 0, totalInvoicesPending: 0, projectedFreeBalance: 3100 }),
        projection({ plannedIncomesTotal: 6500, cardInstallments: 2380, recurringDebitTotal: 2100, totalCommitted: 4480, projectedFreeBalance: 2020 }, 1),
      ],
    },
    expect: {
      moods: ["atencao", "critico"],
      topRiskAny: ["limite_uso_pct", "limite_disponivel", "proximo_mes_parcelas", "limite_usado"],
      mustCiteGroups: [["limite_uso_pct", "limite_disponivel", "limite_usado"], ["proximo_mes_parcelas", "proximo_mes_saldo"]],
      forbidden: [{ pattern: /(fatura|cartão).{0,40}(já|ja) (está|esta) paga/i, reason: "tratou a fatura futura como paga" }],
    },
    chat: [
      { question: "Posso parcelar mais uma compra de R$ 1.200 no cartão?", verdict: /(?<!\p{L})(não|nao|evite|cuidado|arrisc\p{L}*|segure|adie|melhor esperar)(?!\p{L})/iu, verdictLabel: "alertar sobre o limite", mustMentionAnyFact: ["limite_disponivel", "limite_uso_pct", "proximo_mes_parcelas"] },
    ],
  },
  {
    id: "fixos-pesados",
    title: "Contas fixas comem a maior parte da renda (acima do teto escolhido)",
    input: {
      userProfile: profile(5000, { targetMonthEndBalance: 300, maxCommitmentAlertPercent: 50 }),
      cards: [checking(2300)],
      transactions: [salary(5000), tx(1, "Mercado", 420, "Alimentação & Delivery", 7)],
      recurringItems: [
        { id: "aluguel", title: "Aluguel", amount: 1900, account: "Conta principal", cardId: "conta", category: "Moradia & Contas", dueDay: 27, active: true },
        { id: "carro", title: "Financiamento do carro", amount: 1150, account: "Conta principal", cardId: "conta", category: "Transporte & Combustível", dueDay: 28, active: true },
        { id: "escola", title: "Escola", amount: 680, account: "Conta principal", cardId: "conta", category: "Educação & Cursos", dueDay: 28, active: true },
      ],
      goals: [],
      mainBalance: 4580,
      monthIncome: 5000,
      monthExpense: 420,
      targetEndMonthBalance: 300,
      monthlyProjections: [
        projection({ openingBalance: 0, recurringDebitTotal: 3730, totalCommitted: 4150, pendingCommitted: 3730, projectedFreeBalance: 850 }),
        projection({ plannedIncomesTotal: 5000, recurringDebitTotal: 3730, totalCommitted: 3730, projectedFreeBalance: 1270 }, 1),
      ],
    },
    expect: {
      moods: ["atencao", "neutro"],
      topRiskAny: ["compromisso_pct", "fixos_mes", "contas_pendentes"],
      mustCiteGroups: [["compromisso_pct", "fixos_mes", "compromisso_teto_pct"]],
    },
    chat: [
      { question: "Por que sobra tão pouco no fim do mês?", mustMentionAnyFact: ["fixos_mes", "compromisso_pct", "contas_pendentes"] },
    ],
  },
  {
    id: "habito-delivery",
    title: "Mês saudável, mas delivery frequente drena a sobra",
    input: {
      userProfile: profile(7000, { targetMonthEndBalance: 1500 }),
      cards: [checking(4200), credit("verde", 6000, 1450)],
      transactions: [
        salary(7000),
        tx(1, "Aluguel", 2200, "Moradia & Contas", 6),
        ...Array.from({ length: 9 }, (_, i) => tx(10 + i, i % 2 ? "iFood" : "iFood Restaurante", 58 + i * 7, "Alimentação & Delivery", 2 + i, { cardId: "verde", account: "Cartão verde" })),
        tx(30, "Mercado", 520, "Alimentação & Delivery", 9),
      ],
      recurringItems: [],
      goals: [{ id: "g1", title: "Viagem", category: "Lazer", current: 1200, target: 6000 }],
      mainBalance: 4200,
      monthIncome: 7000,
      monthExpense: 2720,
      targetEndMonthBalance: 1500,
      monthlyProjections: [
        projection({ openingBalance: 0, totalCommitted: 2720, pendingCommitted: 0, projectedFreeBalance: 4200 }),
        projection({ plannedIncomesTotal: 7000, cardInstallments: 1450, recurringDebitTotal: 2200, totalCommitted: 3650, projectedFreeBalance: 3350 }, 1),
      ],
    },
    expect: {
      moods: ["positivo", "atencao"],
      noHighSeverity: true,
      mustCiteGroups: [["habito_1", "habito_1_qtd", "categoria_1", "categoria_1_pct"]],
      positiveAny: ["margem_segura", "saldo_projetado", "taxa_poupanca", "sobra_mes", "margem_diaria"],
    },
    chat: [
      { question: "Quanto estou gastando com delivery?", mustMentionAnyFact: ["habito_1", "categoria_1"] },
    ],
  },
  {
    id: "comecando-agora",
    title: "Conta nova, quase sem lançamentos",
    input: {
      userProfile: profile(0, { targetMonthEndBalance: 0, primaryFocus: "" }),
      cards: [checking(350)],
      transactions: [tx(1, "Padaria", 18, "Alimentação & Delivery", 2)],
      recurringItems: [],
      goals: [],
      mainBalance: 350,
      monthIncome: 0,
      monthExpense: 18,
      targetEndMonthBalance: 0,
      monthlyProjections: [projection({ openingBalance: 368, totalCommitted: 18, projectedFreeBalance: 350 })],
    },
    expect: {
      moods: ["neutro", "positivo"],
      noHighSeverity: true,
      forbidden: [
        { pattern: /(estour|no vermelho|crise|perigo)/i, reason: "inventou alarme sem dados" },
        { pattern: /reserva de emergência.{0,40}(insuficiente|baixa)/i, reason: "julgou reserva sem renda informada" },
      ],
    },
    chat: [
      { question: "Por onde eu começo a organizar meu dinheiro aqui?", verdict: /(regist|lanç|cadastr|anot|inform)/i, verdictLabel: "orientar a registrar dados" },
    ],
  },
];
