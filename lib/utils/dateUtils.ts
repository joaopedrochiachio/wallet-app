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

export interface PlanningMonth {
  name: string;
  short: string;
  monthIndex: number;
  year: number;
  isCurrent?: boolean;
  isPast?: boolean;
}

/** Retorna uma janela de meses baseada no calendário atual, inclusive na virada do ano. */
export function getPlanningMonths(count: number = 4, from: Date = new Date()): PlanningMonth[] {
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(from.getFullYear(), from.getMonth() + offset, 1);
    const short = MONTH_NAMES_PT[date.getMonth()];
    return {
      name: offset === 0 ? `${short} (Atual)` : short,
      short,
      monthIndex: date.getMonth(),
      year: date.getFullYear(),
      isCurrent: offset === 0,
      isPast: offset < 0,
    };
  });
}

/**
 * Retorna uma janela de meses com suporte a meses passados (para histórico e consulta),
 * mês atual e meses futuros, tratando automaticamente virada de mês e de ano.
 * Exemplo com pastMonthsCount=1 e futureMonthsCount=2:
 * Em setembro: Agosto | Setembro (Atual) | Outubro | Novembro
 * Ao virar para outubro: Setembro | Outubro (Atual) | Novembro | Dezembro
 */
export function getPlanningMonthsWindow(
  pastMonthsCount: number = 1,
  futureMonthsCount: number = 2,
  from: Date = new Date()
): PlanningMonth[] {
  const months: PlanningMonth[] = [];
  const startOffset = -Math.max(0, pastMonthsCount);
  const endOffset = Math.max(0, futureMonthsCount);

  for (let offset = startOffset; offset <= endOffset; offset++) {
    const date = new Date(from.getFullYear(), from.getMonth() + offset, 1);
    const short = MONTH_NAMES_PT[date.getMonth()];
    const isCurrent = offset === 0;
    const isPast = offset < 0;

    months.push({
      name: isCurrent ? `${short} (Atual)` : short,
      short,
      monthIndex: date.getMonth(),
      year: date.getFullYear(),
      isCurrent,
      isPast,
    });
  }

  return months;
}

export function getPeriodKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** Diferença em meses entre a competência alvo e o início de um planejamento. */
export function getRecurringMonthOffset(
  item: { startYear?: number; startMonth?: number; startMonthIndex?: number },
  targetYear: number,
  targetMonth: number
): number {
  const startYear = item.startYear ?? targetYear;
  // Compatibilidade com dados antigos: a tela original começava em setembro/2026.
  const legacyDate = new Date(startYear, 8 + (item.startMonthIndex ?? 0), 1);
  const startMonth = item.startMonth ?? legacyDate.getMonth();
  const normalizedStartYear = item.startMonth === undefined ? legacyDate.getFullYear() : startYear;
  return (targetYear - normalizedStartYear) * 12 + targetMonth - startMonth;
}

export function isRecurringActiveInMonth(
  item: {
    active: boolean;
    installmentsCount?: number;
    startYear?: number;
    startMonth?: number;
    startMonthIndex?: number;
    realizedPeriods?: string[];
  },
  targetYear: number,
  targetMonth: number
): boolean {
  if (!item.active || item.realizedPeriods?.includes(getPeriodKey(targetYear, targetMonth))) {
    return false;
  }

  const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
  if (monthOffset < 0) return false;
  return !item.installmentsCount || item.installmentsCount <= 0 || monthOffset < item.installmentsCount;
}

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

export interface PlannedDateGroup<T extends { dueDay?: number; recurrenceType?: "business_day_5" | "fixed_day"; amount: number }> {
  day: number;
  label: string;
  totalAmount: number;
  items: T[];
}

/**
 * Agrupa itens planejados pelo dia de vencimento efetivo no mês especificado,
 * ordenados cronologicamente e calculando o subtotal de cada data.
 */
export function groupRecurringItemsByDate<T extends { dueDay?: number; recurrenceType?: "business_day_5" | "fixed_day"; amount: number }>(
  items: T[],
  year: number,
  monthIndex: number
): PlannedDateGroup<T>[] {
  const map = new Map<number, { has5thBusiness: boolean; hasFixed: boolean; items: T[]; totalAmount: number }>();

  for (const item of items) {
    const effectiveDay = getEffectiveDueDay(item, year, monthIndex);
    const is5thBusiness = item.recurrenceType === "business_day_5";
    const existing = map.get(effectiveDay);

    if (!existing) {
      map.set(effectiveDay, {
        has5thBusiness: is5thBusiness,
        hasFixed: !is5thBusiness,
        items: [item],
        totalAmount: item.amount,
      });
    } else {
      existing.items.push(item);
      existing.totalAmount += item.amount;
      if (is5thBusiness) existing.has5thBusiness = true;
      else existing.hasFixed = true;
    }
  }

  const sortedDays = Array.from(map.keys()).sort((a, b) => a - b);
  return sortedDays.map((day) => {
    const group = map.get(day)!;
    let label = `Dia ${day}`;
    if (group.has5thBusiness && !group.hasFixed) {
      label = `5º dia útil (Dia ${day})`;
    } else if (group.has5thBusiness && group.hasFixed) {
      label = `Dia ${day} · Inclui 5º dia útil`;
    }

    return {
      day,
      label,
      totalAmount: group.totalAmount,
      items: group.items,
    };
  });
}
