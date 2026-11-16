/**
 * Orientação de gasto que uma pessoa consegue seguir.
 *
 * "R$ 1,41 por dia" não é uma recomendação real: ninguém planeja o dia com isso.
 * Esta regra escolhe a forma certa de falar do dinheiro livre:
 * - livre:     valor por dia é útil (≥ R$ 20) → "cerca de R$ 44 por dia"
 * - contido:   por dia ficaria pequeno, mas o total importa → "R$ 85 até o dia 20, só o essencial"
 * - essencial: quase nada livre → "só o essencial até o salário do dia 20"
 * - pausa:     nada livre (conta vence antes da entrada ou mês abaixo da meta)
 * Vale para qualquer pessoa e qualquer dia de pagamento.
 */
import type { FinancialAnalytics } from "./financialAnalyticsService.ts";

export const MIN_MEANINGFUL_DAILY = 20;
export const MIN_MEANINGFUL_TOTAL = 20;

export type GuidanceMode = "livre" | "contido" | "essencial" | "pausa";

export interface SpendingGuidance {
  mode: GuidanceMode;
  /** Texto curto para chips e para a ilha compacta ("R$ 44/dia", "Só o essencial"). */
  short: string;
  /** Frase principal ("Cerca de R$ 44 por dia"). */
  headline: string;
  /** Explicação em linguagem simples, com o porquê e até quando. */
  detail: string;
  /** Até quando vale a orientação. */
  untilDay: number;
  untilLabel: string;
  /** Total livre na janela (sempre ≥ 0). */
  windowTotal: number;
  dailyAmount: number;
  weeklyAmount: number | null;
}

const brl = (n: number, cents = false) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

/** Arredonda para baixo em valores "redondos" (ninguém separa R$ 42,17). */
export function friendlyFloor(n: number): number {
  if (n <= 0) return 0;
  if (n < 50) return Math.floor(n);
  if (n < 200) return Math.floor(n / 5) * 5;
  return Math.floor(n / 10) * 10;
}

export function getSpendingGuidance(a: FinancialAnalytics): SpendingGuidance {
  const until = a.timeline.untilNextIncome;
  const restDays = a.daysLeft;
  const restTotal = Math.max(0, a.target.gap);

  // A janela relevante é até a próxima entrada quando ela aperta mais que o resto do mês.
  const useIncomeWindow = Boolean(until && until.daysUntil >= 1 && until.dailyAvailable < a.target.dailyRoom);
  const days = useIncomeWindow ? until!.daysUntil : restDays;
  const total = useIncomeWindow ? until!.available : restTotal;
  const untilDay = useIncomeWindow ? until!.day : a.daysInMonth;
  const untilLabel = useIncomeWindow ? `até ${until!.title} (dia ${until!.day})` : `até o fim de ${a.monthName}`;
  const daily = days > 0 ? total / days : total;
  const weekly = days >= 7 ? daily * 7 : null;
  const base = { untilDay, untilLabel, windowTotal: Math.round(total * 100) / 100, dailyAmount: Math.round(daily * 100) / 100, weeklyAmount: weekly === null ? null : Math.round(weekly * 100) / 100 };

  if (total <= 0) {
    const reason =
      a.cash.projectedClose < a.target.value && !useIncomeWindow
        ? `O mês já fecha abaixo da sua meta, então qualquer gasto novo aumenta o que falta.`
        : useIncomeWindow
          ? `As contas que vencem antes de ${until!.title} já usam todo o saldo de hoje.`
          : `Não sobra dinheiro livre no mês depois das contas previstas.`;
    return { ...base, mode: "pausa", short: "Só o essencial", headline: `Só o essencial ${untilLabel}`, detail: `${reason} Segure compras que podem esperar.` };
  }

  if (daily >= MIN_MEANINGFUL_DAILY) {
    const perDay = friendlyFloor(daily);
    return {
      ...base,
      mode: "livre",
      short: `${brl(perDay)}/dia`,
      headline: `Cerca de ${brl(perDay)} por dia`,
      detail: weekly ? `Ou ${brl(friendlyFloor(weekly))} por semana ${untilLabel}, sem furar sua meta.` : `Vale ${untilLabel}, sem furar sua meta.`,
    };
  }

  if (total >= MIN_MEANINGFUL_TOTAL) {
    const amount = friendlyFloor(total);
    return {
      ...base,
      mode: "contido",
      short: `${brl(amount)} até dia ${untilDay}`,
      headline: `${brl(amount)} ${untilLabel}`,
      detail: `Por dia ficaria pouco, então pense no total: use para o essencial (mercado, transporte) e deixe compras novas para depois.`,
    };
  }

  return {
    ...base,
    mode: "essencial",
    short: "Só o essencial",
    headline: `Só o essencial ${untilLabel}`,
    detail: `Sobram só ${brl(total, true)} livres nesse período. Evite compras novas até o dinheiro entrar.`,
  };
}
