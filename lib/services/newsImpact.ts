/**
 * "Como isso te afeta": liga cada tema de notícia ao dinheiro do usuário.
 * Roda no aparelho com os dados que já estão no app; nada sai para a IA.
 * Um tema sem relação com os dados do usuário não gera texto (sem frase genérica).
 */
import type { CardItem, GoalItem, RecurringItem } from "../../types/index.ts";
import type { NewsTopicId } from "./newsFeed.ts";
import { buildRecurringRadar } from "./recurringRadar.ts";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Serviços cobrados em dólar ou que reajustam acompanhando o dólar. */
const DOLLAR_SERVICES = /\b(icloud|apple|spotify|netflix|claude|anthropic|openai|chatgpt|google one|youtube|amazon|prime video|disney|hbo|max|adobe|microsoft|xbox|playstation|steam|github|notion|figma|canva|duolingo|midjourney|cursor|api)\b/;
const FUEL = /\b(gasolina|posto|combustivel|etanol|diesel|shell|ipiranga|petrobras br)\b/;
const RENT = /\b(aluguel|condominio|iptu)\b/;
const POWER = /\b(luz|energia|cemig|enel|light|copel|celesc|coelba|equatorial|neoenergia)\b/;

export interface ImpactEntry {
  label: string;
  amount: number;
}

export interface TopicImpact {
  topic: NewsTopicId;
  /** Uma frase que explica o efeito no bolso, já com os números do usuário. */
  text: string;
  /** O que entrou na conta (para abrir e conferir). */
  basis: ImpactEntry[];
}

export interface ImpactInputs {
  recurringItems: RecurringItem[];
  cards: CardItem[];
  goals: GoalItem[];
  transactions: Array<{ title?: string; description?: string; category?: string; amount: number; type: string; occurredAt?: unknown; date?: unknown }>;
  /** Limite usado por cartão (do extrato), se disponível. */
  usedLimitByCard?: Record<string, number>;
  today?: Date;
}

function txDate(tx: ImpactInputs["transactions"][number]): Date | null {
  const raw = tx.occurredAt ?? tx.date;
  const value = raw && typeof raw === "object" && "toDate" in (raw as object)
    ? (raw as { toDate: () => Date }).toDate()
    : raw instanceof Date ? raw : raw ? new Date(raw as string) : null;
  return value && !Number.isNaN(value.getTime()) ? value : null;
}

export function buildTopicImpacts(input: ImpactInputs): Map<NewsTopicId, TopicImpact> {
  const today = input.today ?? new Date();
  const radar = buildRecurringRadar({ recurringItems: input.recurringItems, cards: input.cards, today });
  const impacts = new Map<NewsTopicId, TopicImpact>();
  const fixed = radar.costs.filter((cost) => cost.kind === "fixed");
  const installments = radar.costs.filter((cost) => cost.kind === "installment");

  // Dólar: assinaturas que cobram ou reajustam em dólar.
  const dollar = fixed.filter((cost) => DOLLAR_SERVICES.test(plain(cost.item.title)));
  if (dollar.length > 0) {
    const total = dollar.reduce((sum, cost) => sum + cost.monthly, 0);
    impacts.set("dolar", {
      topic: "dolar",
      text: `${dollar.length === 1 ? "Uma assinatura sua acompanha" : `${dollar.length} assinaturas suas acompanham`} o dólar: ${brl(total)} por mês. Se o dólar subir 10%, isso tende a ir para ${brl(total * 1.1)} no próximo reajuste.`,
      basis: dollar.map((cost) => ({ label: cost.item.title, amount: cost.monthly })),
    });
  }

  // Juros: parcelas contratadas não mudam; o que está guardado rende diferente.
  const owed = installments.reduce((sum, cost) => sum + (cost.remainingAmount ?? 0), 0);
  const saved = input.goals.reduce((sum, goal) => sum + Math.max(0, goal.current || 0), 0);
  if (owed > 0 || saved > 0) {
    const parts: string[] = [];
    if (owed > 0) parts.push(`suas parcelas em andamento (${brl(owed)} a pagar) já têm valor fixo e não mudam; compras parceladas e empréstimos novos é que ficam mais caros ou mais baratos`);
    if (saved > 0) parts.push(`os ${brl(saved)} guardados em metas rendem mais com juros altos se estiverem em CDB, Tesouro Selic ou poupança`);
    impacts.set("juros", {
      topic: "juros",
      text: `${parts.join("; ").replace(/^./, (c) => c.toUpperCase())}.`,
      basis: [
        ...installments.filter((cost) => (cost.remainingAmount ?? 0) > 0).map((cost) => ({ label: `${cost.item.title} (falta)`, amount: cost.remainingAmount ?? 0 })),
        ...input.goals.filter((goal) => goal.current > 0).map((goal) => ({ label: `Meta ${goal.title}`, amount: goal.current })),
      ],
    });
  }

  // Inflação: o custo fixo é o que mais sente reajuste.
  if (radar.fixedMonthly > 0) {
    impacts.set("inflacao", {
      topic: "inflacao",
      text: `Suas contas fixas somam ${brl(radar.fixedMonthly)} por mês. Cada 1 ponto de inflação a mais pode somar cerca de ${brl(radar.fixedMonthly * 0.01)} por mês quando elas forem reajustadas.`,
      basis: fixed.map((cost) => ({ label: cost.item.title, amount: cost.monthly })),
    });
  }

  // Combustível: o que foi para posto nos últimos 30 dias.
  const since = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
  const fuel = input.transactions.filter((tx) => {
    if (tx.type !== "despesa" && tx.type !== "out") return false;
    const date = txDate(tx);
    return date && date >= since && date <= today && FUEL.test(plain(`${tx.title ?? tx.description ?? ""} ${tx.category ?? ""}`));
  });
  if (fuel.length > 0) {
    const total = fuel.reduce((sum, tx) => sum + tx.amount, 0);
    impacts.set("combustivel", {
      topic: "combustivel",
      text: `Você gastou ${brl(total)} com combustível nos últimos 30 dias (${fuel.length} ${fuel.length === 1 ? "abastecimento" : "abastecimentos"}). Um aumento de 5% na bomba seria uns ${brl(total * 0.05)} a mais por mês.`,
      basis: fuel.map((tx) => ({ label: tx.title ?? tx.description ?? "Combustível", amount: tx.amount })),
    });
  }

  // Crédito: quanto do limite já está comprometido.
  const credit = input.cards.filter((card) => card.type === "credit" && card.limit > 0);
  const used = credit.reduce((sum, card) => sum + (input.usedLimitByCard?.[card.id] ?? card.spent ?? 0), 0);
  const limit = credit.reduce((sum, card) => sum + card.limit, 0);
  if (limit > 0 && used > 0) {
    const share = Math.round((used / limit) * 100);
    impacts.set("credito", {
      topic: "credito",
      text: `Seus cartões estão com ${share}% do limite em uso (${brl(used)} de ${brl(limit)}). Regras novas de crédito e rotativo afetam principalmente quem não paga a fatura inteira.`,
      basis: credit.map((card) => ({ label: card.name, amount: input.usedLimitByCard?.[card.id] ?? card.spent ?? 0 })),
    });
  }

  // Aluguel/condomínio e energia: contas que reajustam por índice ou bandeira.
  const rent = fixed.filter((cost) => RENT.test(plain(cost.item.title)));
  if (rent.length > 0) {
    const total = rent.reduce((sum, cost) => sum + cost.monthly, 0);
    impacts.set("imoveis", {
      topic: "imoveis",
      text: `Você paga ${brl(total)} por mês em ${rent.map((cost) => cost.item.title).join(", ")}. Aluguel costuma ser reajustado uma vez por ano pelo IGP-M ou IPCA.`,
      basis: rent.map((cost) => ({ label: cost.item.title, amount: cost.monthly })),
    });
  }
  const power = fixed.filter((cost) => POWER.test(plain(cost.item.title)));
  if (power.length > 0) {
    const total = power.reduce((sum, cost) => sum + cost.monthly, 0);
    impacts.set("energia", {
      topic: "energia",
      text: `Sua conta de luz está planejada em ${brl(total)} por mês. Bandeira vermelha costuma encarecer a conta entre 5% e 10%: uns ${brl(total * 0.05)} a ${brl(total * 0.1)}.`,
      basis: power.map((cost) => ({ label: cost.item.title, amount: cost.monthly })),
    });
  }

  // Renda: notícias de salário, 13º e INSS mexem com o que entra.
  if (radar.monthlyIncome > 0) {
    impacts.set("emprego", {
      topic: "emprego",
      text: `Você planejou receber ${brl(radar.monthlyIncome)} por mês em média. Mudanças em salário mínimo, 13º, FGTS ou INSS mexem diretamente nesse número.`,
      basis: [{ label: "Renda média prevista", amount: radar.monthlyIncome }],
    });
  }

  return impacts;
}
