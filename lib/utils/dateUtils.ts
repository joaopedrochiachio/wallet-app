/**
 * Utilitários de Data para Carteira e Fluxo Financeiro (Padrão Bancário Brasileiro)
 */

// Feriados Nacionais Fixos no Brasil (Mês 0-indexed: 0 = Jan, 11 = Dez)
const BRAZILIAN_FIXED_HOLIDAYS: Record<string, string> = {
  "0-1": "Confraternização Universal",
  "3-21": "Tiradentes",
  "4-1": "Dia do Trabalhador",
  "8-7": "Independência do Brasil",
  "9-12": "Nossa Senhora Aparecida",
  "10-2": "Finados",
  "10-15": "Proclamação da República",
  "10-20": "Dia da Consciência Negra",
  "11-25": "Natal",
};

/**
 * Verifica se um dia específico é dia útil bancário (segunda a sexta, excluindo feriados nacionais)
 */
export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  const key = `${date.getMonth()}-${date.getDate()}`;
  if (BRAZILIAN_FIXED_HOLIDAYS[key]) {
    return false;
  }
  return true;
}

/**
 * Calcula o N-ésimo dia útil de um determinado mês e ano (por padrão, 5º dia útil)
 * @param year Ano (ex: 2026)
 * @param monthIndex Mês (0 = Janeiro, 8 = Setembro, 11 = Dezembro)
 * @param targetCount Qual dia útil encontrar (default = 5)
 * @returns O dia do mês (1 a 31) correspondente ao N-ésimo dia útil
 */
export function getBusinessDayOfMonth(
  year: number,
  monthIndex: number,
  targetCount: number = 5
): number {
  let count = 0;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    if (isBusinessDay(d)) {
      count++;
      if (count === targetCount) {
        return day;
      }
    }
  }

  // Fallback caso termine o mês
  return Math.min(targetCount, daysInMonth);
}

/**
 * Atalho conveniente para obter o 5º dia útil do mês
 */
export function get5thBusinessDay(year: number, monthIndex: number): number {
  return getBusinessDayOfMonth(year, monthIndex, 5);
}

/**
 * Nomes dos meses em português
 */
export const MONTH_NAMES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Retorna o dia de vencimento efetivo considerando se o item é fixo ou 5º dia útil
 */
export function getEffectiveDueDay(
  item: { dueDay?: number; recurrenceType?: "business_day_5" | "fixed_day" },
  year: number,
  monthIndex: number
): number {
  if (item.recurrenceType === "business_day_5") {
    return get5thBusinessDay(year, monthIndex);
  }
  return item.dueDay || 10;
}

/**
 * Formata um rótulo explicativo do vencimento / recebimento
 */
export function formatRecurrenceLabel(
  item: { dueDay?: number; recurrenceType?: "business_day_5" | "fixed_day" },
  year?: number,
  monthIndex?: number
): string {
  const currentYear = year ?? new Date().getFullYear();
  const currentMonth = monthIndex ?? new Date().getMonth();

  if (item.recurrenceType === "business_day_5") {
    const day = get5thBusinessDay(currentYear, currentMonth);
    const monthName = MONTH_NAMES_PT[currentMonth];
    return `5º Dia Útil (cai dia ${day} de ${monthName})`;
  }

  return `Todo dia ${item.dueDay || 10}`;
}
