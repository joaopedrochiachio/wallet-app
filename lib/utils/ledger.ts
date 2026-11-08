import type { CardItem, RecurringItem } from "@/types";
import {
  getPeriodKey,
  getRecurringMonthOffset,
  getEffectiveRecurringItemForPeriod,
  getEffectiveDueDay,
  MONTH_NAMES_PT,
} from "./dateUtils.ts";

export interface LedgerEntry {
  id?: string;
  amount: number;
  type: "despesa" | "receita";
  account: string;
  cardId?: string | null;
  occurredAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  date?: string | Date | null;
  periodKey?: string | null;
  category?: string;
  description?: string;
  title?: string;
  kind?: string;
  relatedCardId?: string | null;
  groupId?: string | null;
  recurringItemId?: string | null;
  installmentsCount?: number | null;
  installmentsIndex?: number | null;
}

export interface AccountFlow {
  income: number;
  outflow: number;
}

export const CURRENT_LEDGER_BALANCE_VERSION = 3;

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

/** Compatibilidade: previsões antigas chegaram a ser gravadas como lançamentos reais. */
function isActualEntry(entry: LedgerEntry): boolean {
  return !entry.id?.startsWith("planned-");
}

export function formatAccountLabel(value: string): string {
  const withoutDebitSuffix = value.replace(/\s*\(débito(?:\s*\/\s*pix)?\)\s*$/iu, "").trim();
  return normalizeText(withoutDebitSuffix) === normalizeText("Débito/Pix")
    ? "Conta principal"
    : withoutDebitSuffix;
}

export function matchesLedgerCard(
  card: CardItem,
  account: string,
  cardId?: string | null
): boolean {
  // Quando o lançamento já possui o identificador estável, ele é a fonte de
  // verdade. Usar também o rótulo permitiria contar a mesma movimentação em
  // duas contas quando dados legados têm nome e cardId divergentes.
  if (cardId) return card.id === cardId;

  return card.id === account ||
    normalizeText(card.name) === normalizeText(account) ||
    (card.type === "checking" && account === "Débito/Pix");
}

/** Saldo da conta = saldo inicial + entradas - saídas do livro-caixa. */
export function calculateCheckingBalance(card: CardItem, entries: LedgerEntry[]): number {
  const accountEntries = entries.filter((entry) =>
    isActualEntry(entry) && matchesLedgerCard(card, entry.account, entry.cardId)
  );
  const openingBalance = card.openingBalance ??
    (accountEntries.length === 0 ? card.balance ?? 0 : 0);

  return accountEntries.reduce(
    (balance, entry) => balance + (entry.type === "receita" ? entry.amount : -entry.amount),
    openingBalance
  );
}

/** Saldo consolidado imediatamente antes de uma data de corte. */
export function calculateCheckingBalanceBefore(
  card: CardItem,
  entries: LedgerEntry[],
  exclusiveEnd: Date
): number {
  const entriesBeforeCutoff = entries.filter((entry) => {
    const occurredAt = getLedgerEntryDate(entry);
    return occurredAt !== null && occurredAt.getTime() < exclusiveEnd.getTime();
  });
  return calculateCheckingBalance(card, entriesBeforeCutoff);
}

/**
 * Converte uma conta do modelo antigo, no qual `balance` já era atualizado a
 * cada lançamento, para o livro-caixa atual. O saldo legado é tratado como um
 * snapshot conciliado e nunca pode receber o histórico uma segunda vez.
 *
 * A versão inicial da migração gravava `openingBalance = 0` quando havia
 * lançamentos. Contas atingidas por essa regra também são reparadas aqui.
 */
export function getCheckingBalanceMigration(
  card: CardItem,
  entries: LedgerEntry[]
): Pick<CardItem, "openingBalance" | "ledgerBalanceVersion"> | null {
  if (
    card.type !== "checking" ||
    card.ledgerBalanceVersion === CURRENT_LEDGER_BALANCE_VERSION
  ) {
    return null;
  }

  const accountEntries = entries.filter(
    (entry) =>
      isActualEntry(entry) &&
      matchesLedgerCard(card, entry.account, entry.cardId)
  );
  const legacySnapshot = Number.isFinite(card.balance) ? Number(card.balance) : 0;
  const wasAffectedByZeroOpeningMigration =
    card.openingBalance === 0 &&
    accountEntries.length > 0 &&
    Math.abs(legacySnapshot) >= 0.005;

  let openingBalance = card.openingBalance ?? legacySnapshot;

  if (card.openingBalance === undefined || wasAffectedByZeroOpeningMigration) {
    const ledgerNetFlow = accountEntries.reduce(
      (total, entry) =>
        total + (entry.type === "receita" ? entry.amount : -entry.amount),
      0
    );
    openingBalance = legacySnapshot - ledgerNetFlow;
  }

  return {
    openingBalance: Math.round(openingBalance * 100) / 100,
    ledgerBalanceVersion: CURRENT_LEDGER_BALANCE_VERSION,
  };
}

export interface CardInvoiceRecurringItemDetail {
  item: RecurringItem;
  installmentIndex?: number;
  totalInstallments?: number;
  isContinuous: boolean;
  chargeDate: Date;
  candPeriodKey: string;
}

/**
 * Retorna os itens recorrentes e o valor pendente que vencem na fatura especificada (invoiceYear, invoiceMonth).
 * Utiliza o dia de fechamento (closingDay) e vencimento (dueDay) do cartão para determinar
 * rigorosamente em qual fatura cada cobrança mensal (ex: Spotify dia 10, Apple dia 14) cai.
 */
export function getCardInvoiceRecurringDetails(
  card: CardItem,
  recurringItems: RecurringItem[],
  invoiceYear: number,
  invoiceMonth: number,
  entries: LedgerEntry[] = []
): {
  items: RecurringItem[];
  itemDetails: CardInvoiceRecurringItemDetail[];
  pendingAmount: number;
  totalAmount: number;
} {
  if (card.type !== "credit") {
    return { items: [], itemDetails: [], pendingAmount: 0, totalAmount: 0 };
  }

  const targetPeriodKey = getPeriodKey(invoiceYear, invoiceMonth);
  const matchingCreditItems = recurringItems.filter(
    (candidate) =>
      candidate.type !== "income" &&
      matchesLedgerCard(card, candidate.account, candidate.cardId)
  );

  const matchedItems: RecurringItem[] = [];
  const itemDetails: CardInvoiceRecurringItemDetail[] = [];
  let pendingAmount = 0;
  let totalAmount = 0;

  // Uma cobrança de cartão pode vir do próprio mês ou de até 2 meses anteriores dependendo de closingDay e dueDay
  for (let offset = -2; offset <= 0; offset++) {
    const candDate = new Date(invoiceYear, invoiceMonth + offset, 1);
    const candYear = candDate.getFullYear();
    const candMonth = candDate.getMonth();
    const candPeriodKey = getPeriodKey(candYear, candMonth);

    for (const rawItem of matchingCreditItems) {
      if (!rawItem.active) continue;

      const item = getEffectiveRecurringItemForPeriod(rawItem, candPeriodKey);

      const monthOffset = getRecurringMonthOffset(rawItem, candYear, candMonth);
      const isScheduledForMonth =
        monthOffset >= 0 &&
        (!rawItem.installmentsCount ||
          rawItem.installmentsCount <= 0 ||
          monthOffset < rawItem.installmentsCount);

      if (!isScheduledForMonth) continue;

      const chargeDay = getEffectiveDueDay(item, candYear, candMonth);
      const chargeDate = new Date(candYear, candMonth, chargeDay, 12, 0, 0);
      const invoiceDueDate = getInvoiceDueDate(card, chargeDate);
      const calculatedPeriodKey = getPeriodKey(
        invoiceDueDate.getFullYear(),
        invoiceDueDate.getMonth()
      );

      // Só pertence a esta fatura se a data de vencimento calculada for este mês
      if (calculatedPeriodKey === targetPeriodKey) {
        if (
          item.excludedPeriods?.includes(targetPeriodKey) ||
          item.overrides?.[targetPeriodKey]?.isDeleted
        ) {
          continue;
        }

        matchedItems.push(item);
        totalAmount += item.amount;

        const isContinuous = !rawItem.installmentsCount || rawItem.installmentsCount <= 0;
        itemDetails.push({
          item,
          installmentIndex: isContinuous ? undefined : monthOffset + 1,
          totalInstallments: isContinuous ? undefined : rawItem.installmentsCount,
          isContinuous,
          chargeDate,
          candPeriodKey,
        });

        const isRealizedInPeriod = Boolean(item.realizedPeriods?.includes(candPeriodKey));
        const isAlreadyInTransactions = entries.some(
          (t: LedgerEntry) =>
            t.recurringItemId === item.id &&
            (t.periodKey === candPeriodKey ||
              (getLedgerEntryDate(t) &&
                getPeriodKey(
                  getLedgerEntryDate(t)!.getFullYear(),
                  getLedgerEntryDate(t)!.getMonth()
                ) === candPeriodKey))
        );

        if (!isRealizedInPeriod && !isAlreadyInTransactions) {
          pendingAmount += item.amount;
        }
      }
    }
  }

  return {
    items: matchedItems,
    itemDetails,
    pendingAmount,
    totalAmount,
  };
}

/**
 * Identifica se um lançamento do livro-caixa corresponde a um pagamento ou baixa
 * da fatura deste cartão de crédito específico (seja débito em conta corrente ou baixa no cartão).
 */
export function isInvoicePaymentOrSettlement(
  entry: LedgerEntry,
  card: CardItem
): boolean {
  if (!isActualEntry(entry)) return false;

  // 1. Baixa/crédito direto no cartão de crédito (receita no cartão)
  if (entry.type === "receita" && matchesLedgerCard(card, entry.account, entry.cardId)) {
    return true;
  }

  // 2. Saída em conta vinculada especificamente a este cartão como pagamento de fatura
  if (entry.kind === "invoice_payment") {
    if (entry.relatedCardId === card.id || entry.cardId === card.id) return true;
    if (matchesLedgerCard(card, entry.account, entry.cardId)) return true;
    const desc = normalizeText(entry.description || entry.title || "");
    if (desc.includes(normalizeText(card.name))) return true;
  }

  // 3. Pagamento de fatura manual registrado na conta corrente
  const categoryNorm = normalizeText(entry.category || "");
  if (categoryNorm === "pagamento de fatura") {
    if (entry.relatedCardId === card.id || entry.cardId === card.id) return true;
    if (matchesLedgerCard(card, entry.account, entry.cardId)) return true;
    const desc = normalizeText(entry.description || entry.title || "");
    if (desc.includes(normalizeText(card.name))) return true;
  }

  // 4. Lançamento com categoria "Cartão de Crédito" que seja quitação da fatura
  if (categoryNorm === "cartão de crédito" || categoryNorm === "cartao de credito") {
    const desc = normalizeText(entry.description || entry.title || "");
    if (desc.includes("fatura") && desc.includes(normalizeText(card.name))) return true;
    if (entry.relatedCardId === card.id) return true;
  }

  return false;
}

/**
 * Fatura real aberta e comprometimento do cartão de crédito:
 * - Se recurringItems for fornecido: calcula a fatura da competência aberta atual,
 *   somando compras faturadas (via calculateInvoiceSchedule) e assinaturas/recorrências
 *   ativas alocadas a este cartão (ex: Apple, Spotify, iCloud), abatendo baixas e pagamentos efetuados.
 * - Caso contrário (ou fallback): calcula compras brutas menos estornos e baixas.
 */
export interface CardOpenInvoiceDetails {
  targetYear: number;
  targetMonth: number;
  periodKey: string;
  dueDate: Date;
  dueDay: number;
  dueMonthName: string;
  closingDay: number;
  installmentsAmount: number;
  recurringAmount: number;
  totalInvoice: number;
  cardTransactions: LedgerEntry[];
  recurringItems: RecurringItem[];
  hasInstallments: boolean;
  hasRecurring: boolean;
  isPaid: boolean;
}

/**
 * Retorna todos os detalhes da fatura aberta do cartão de crédito, garantindo sincronização
 * absoluta entre o valor total, compras faturadas, assinaturas e data de vencimento.
 */
export function getCardOpenInvoiceDetails(
  card: CardItem,
  entries: LedgerEntry[],
  recurringItems: RecurringItem[] = [],
  referenceDate: Date = new Date()
): CardOpenInvoiceDetails {
  if (card.type !== "credit") {
    return {
      targetYear: referenceDate.getFullYear(),
      targetMonth: referenceDate.getMonth(),
      periodKey: getPeriodKey(referenceDate.getFullYear(), referenceDate.getMonth()),
      dueDate: referenceDate,
      dueDay: 10,
      dueMonthName: MONTH_NAMES_PT[referenceDate.getMonth()],
      closingDay: 1,
      installmentsAmount: 0,
      recurringAmount: 0,
      totalInvoice: 0,
      cardTransactions: [],
      recurringItems: [],
      hasInstallments: false,
      hasRecurring: false,
      isPaid: true,
    };
  }

  // 1. Data de vencimento da fatura aberta do cartão
  const openDueDate = getInvoiceDueDate(card, referenceDate);
  let openPeriodKey = getPeriodKey(openDueDate.getFullYear(), openDueDate.getMonth());

  // Próximo mês padrão (competência seguinte que acumula os gastos do mês corrente)
  const nextMonthRef = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const nextMonthPeriodKey = getPeriodKey(nextMonthRef.getFullYear(), nextMonthRef.getMonth());

  const { schedule, creditsByPeriod } = calculateInvoiceScheduleWithCredits(card, entries, referenceDate);

  let targetYear = openDueDate.getFullYear();
  let targetMonth = openDueDate.getMonth();

  const currentRecDetails = getCardInvoiceRecurringDetails(
    card,
    recurringItems,
    targetYear,
    targetMonth,
    entries
  );
  const currentNetRecurring = Math.max(
    0,
    currentRecDetails.pendingAmount - (creditsByPeriod?.[openPeriodKey] || 0)
  );

  // Se o openPeriodKey original estiver quitado ou zerado, mas houver despesas no ciclo do mês seguinte:
  if (
    openPeriodKey < nextMonthPeriodKey &&
    (schedule[openPeriodKey] || 0) === 0 &&
    currentNetRecurring === 0
  ) {
    const nextRecDetails = getCardInvoiceRecurringDetails(
      card,
      recurringItems,
      nextMonthRef.getFullYear(),
      nextMonthRef.getMonth(),
      entries
    );
    const nextNetRecurring = Math.max(
      0,
      nextRecDetails.pendingAmount - (creditsByPeriod?.[nextMonthPeriodKey] || 0)
    );
    if ((schedule[nextMonthPeriodKey] || 0) > 0 || nextNetRecurring > 0) {
      targetYear = nextMonthRef.getFullYear();
      targetMonth = nextMonthRef.getMonth();
      openPeriodKey = nextMonthPeriodKey;
    }
  }

  // 2. Compras e parcelas faturadas para esta competência ou competências pendentes
  let installmentsAmount = 0;
  for (const [key, amount] of Object.entries(schedule)) {
    if (key <= openPeriodKey) {
      installmentsAmount += amount;
    }
  }

  // 3. Assinaturas e cobranças recorrentes que caem nesta fatura
  const recurringDetails = getCardInvoiceRecurringDetails(
    card,
    recurringItems,
    targetYear,
    targetMonth,
    entries
  );

  const periodCredit = creditsByPeriod?.[openPeriodKey] || 0;
  const netRecurring = Math.round(Math.max(0, recurringDetails.pendingAmount - periodCredit) * 100) / 100;
  let totalInvoice = Math.round(Math.max(0, installmentsAmount + netRecurring) * 100) / 100;

  const hasAnyPaymentForOpenPeriod = entries.some((entry) => {
    if (!isInvoicePaymentOrSettlement(entry, card)) return false;
    const pDate = getLedgerEntryDate(entry);
    const pKey = entry.periodKey || (pDate ? getPeriodKey(pDate.getFullYear(), pDate.getMonth()) : null);
    return pKey === openPeriodKey;
  });

  // Fallback: se não houver faturas distribuídas nem pagamento na competência, mas houver despesas avulsas brutas sem data
  if (
    totalInvoice === 0 &&
    !hasAnyPaymentForOpenPeriod &&
    Object.keys(schedule).length === 0 &&
    schedule[openPeriodKey] === undefined &&
    recurringDetails.pendingAmount === 0
  ) {
    const rawInvoice = entries
      .filter((entry) => isActualEntry(entry) && matchesLedgerCard(card, entry.account, entry.cardId))
      .reduce(
        (total, entry) => total + (entry.type === "despesa" ? entry.amount : -entry.amount),
        0
      );
    totalInvoice = Math.max(0, rawInvoice);
  }

  // Compras faturadas que vencem nesta competência
  const cardTransactions = entries.filter((entry) => {
    if (entry.id?.startsWith("planned-")) return false;
    if (entry.type !== "despesa") return false;
    if (entry.kind === "invoice_payment" || entry.kind === "invoice_settlement") return false;
    if (!matchesLedgerCard(card, entry.account, entry.cardId)) return false;
    const dDate = getInvoiceDueDate(card, getLedgerEntryDate(entry) || new Date(targetYear, targetMonth, 1));
    const dKey = getPeriodKey(dDate.getFullYear(), dDate.getMonth());
    return dKey === openPeriodKey;
  });

  const dueDay = card.dueDay || 10;
  const closingDay = card.closingDay || 1;
  const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const effectiveDueDate = new Date(targetYear, targetMonth, Math.min(dueDay, lastDayOfMonth));
  const dueMonthName = MONTH_NAMES_PT[targetMonth];

  const hasInstallments = cardTransactions.length > 0;
  const hasRecurring = recurringDetails.items.length > 0;
  const isPaid = totalInvoice === 0 && !hasInstallments && !hasRecurring;

  return {
    targetYear,
    targetMonth,
    periodKey: openPeriodKey,
    dueDate: effectiveDueDate,
    dueDay,
    dueMonthName,
    closingDay,
    installmentsAmount,
    recurringAmount: recurringDetails.pendingAmount,
    totalInvoice,
    cardTransactions,
    recurringItems: recurringDetails.items,
    hasInstallments,
    hasRecurring,
    isPaid,
  };
}

export function calculateCreditInvoice(
  card: CardItem,
  entries: LedgerEntry[],
  recurringItems: RecurringItem[] = [],
  referenceDate: Date = new Date()
): number {
  return getCardOpenInvoiceDetails(card, entries, recurringItems, referenceDate).totalInvoice;
}

export interface InstallmentPurchaseSplit {
  totalAmount: number;
  installmentsCount: number;
  installmentAmount: number;
  lastInstallmentAmount: number;
}

/**
 * Divide o valor total de uma compra parcelada em N parcelas mensais,
 * conciliando eventual diferença de centavos na última parcela (como nos cartões reais).
 * Exemplo: R$ 275,00 em 3x -> 2x de R$ 91,67 + 1x de R$ 91,66 = R$ 275,00.
 */
export function splitInstallmentPurchase(
  totalAmount: number,
  installmentsCount: number
): InstallmentPurchaseSplit {
  const safeTotal = Math.round(Math.max(0, Number(totalAmount) || 0) * 100) / 100;
  const safeCount = Math.max(1, Math.min(360, Math.round(Number(installmentsCount) || 1)));
  if (safeCount <= 1) {
    return {
      totalAmount: safeTotal,
      installmentsCount: 1,
      installmentAmount: safeTotal,
      lastInstallmentAmount: safeTotal,
    };
  }
  const installmentAmount = Math.round((safeTotal / safeCount) * 100) / 100;
  const lastInstallmentAmount =
    Math.round((safeTotal - installmentAmount * (safeCount - 1)) * 100) / 100;
  return {
    totalAmount: safeTotal,
    installmentsCount: safeCount,
    installmentAmount,
    lastInstallmentAmount: Math.max(0, lastInstallmentAmount),
  };
}

/**
 * Calcula o limite total comprometido (utilizado) no cartão de crédito,
 * reproduzindo o funcionamento real de um cartão:
 * - Soma a fatura aberta atual (compras à vista, parcela do mês atual e assinaturas do ciclo aberto)
 * - Soma todas as parcelas futuras ainda não quitadas de compras parceladas (installmentsCount > 1),
 *   descontando do limite o valor integral da compra e liberando a cada fatura paga.
 */
export function calculateCreditCardUsedLimit(
  card: CardItem,
  entries: LedgerEntry[],
  recurringItems: RecurringItem[] = [],
  referenceDate: Date = new Date()
): number {
  if (card.type !== "credit") return 0;

  const openDetails = getCardOpenInvoiceDetails(card, entries, recurringItems, referenceDate);
  const { schedule, creditsByPeriod } = calculateInvoiceScheduleWithCredits(
    card,
    entries,
    referenceDate
  );

  // 1. Fatura aberta atual
  let totalCommitted = openDetails.totalInvoice;

  // 2. Compras lançadas diretamente em entries com vencimento após a fatura aberta
  for (const [periodKey, amount] of Object.entries(schedule)) {
    if (periodKey > openDetails.periodKey && amount > 0) {
      totalCommitted += amount;
    }
  }

  // 3. Parcelas futuras de compras parceladas (installmentsCount > 1) que vencem após a fatura aberta
  const installmentRecurringItems = recurringItems.filter(
    (item) =>
      item.active &&
      item.type !== "income" &&
      Boolean(item.installmentsCount && item.installmentsCount > 1) &&
      matchesLedgerCard(card, item.account, item.cardId)
  );

  if (installmentRecurringItems.length > 0) {
    const maxInstallments = installmentRecurringItems.reduce(
      (max, item) => Math.max(max, Math.min(360, item.installmentsCount || 1)),
      1
    );
    const horizonMonths = Math.min(360, maxInstallments + 2);

    for (let offset = 1; offset <= horizonMonths; offset++) {
      const futDate = new Date(openDetails.targetYear, openDetails.targetMonth + offset, 1);
      const futYear = futDate.getFullYear();
      const futMonth = futDate.getMonth();
      const futPeriodKey = getPeriodKey(futYear, futMonth);

      const futRecDetails = getCardInvoiceRecurringDetails(
        card,
        installmentRecurringItems,
        futYear,
        futMonth,
        entries
      );

      if (futRecDetails.pendingAmount > 0) {
        const futCredit = creditsByPeriod?.[futPeriodKey] || 0;
        const netFutInstallments = Math.max(0, futRecDetails.pendingAmount - futCredit);
        totalCommitted += netFutInstallments;
      }
    }
  }

  return Math.round(Math.max(0, totalCommitted) * 100) / 100;
}

export interface CardMonthInvoiceDetails {
  card: CardItem;
  targetYear: number;
  targetMonth: number;
  periodKey: string;
  dueDate: Date;
  dueDay: number;
  dueMonthName: string;
  closingDay: number;
  installmentsAmount: number;
  recurringAmount: number;
  totalInvoice: number;
  pendingInvoice: number;
  paidAmount: number;
  isPaid: boolean;
  isOpenInvoice: boolean;
  isFutureInvoice: boolean;
  isPastInvoice: boolean;
  availableLimit: number;
  percentUsed: number;
  cardTransactions: LedgerEntry[];
  recurringItems: RecurringItem[];
  recurringItemDetails: CardInvoiceRecurringItemDetail[];
  hasInstallments: boolean;
  hasRecurring: boolean;
}

/**
 * Retorna os detalhes da fatura do cartão para qualquer mês específico (passado, presente ou futuro),
 * distribuindo compras parceladas, cobranças programadas e pagamentos daquela competência.
 * Quando a fatura é paga, o valor real (totalInvoice) é preservado para exibição e análises de IA,
 * enquanto pendingInvoice zera para evitar dupla contagem no fluxo de caixa e liberar o limite.
 */
export function getCardInvoiceDetailsForMonth(
  card: CardItem,
  entries: LedgerEntry[],
  recurringItems: RecurringItem[] = [],
  invoiceYear: number,
  invoiceMonth: number,
  referenceDate: Date = new Date()
): CardMonthInvoiceDetails {
  const targetPeriodKey = getPeriodKey(invoiceYear, invoiceMonth);
  const dueDay = card.dueDay || 10;
  const closingDay = card.closingDay || 1;
  const lastDayOfMonth = new Date(invoiceYear, invoiceMonth + 1, 0).getDate();
  const effectiveDueDate = new Date(invoiceYear, invoiceMonth, Math.min(dueDay, lastDayOfMonth));
  const dueMonthName = MONTH_NAMES_PT[invoiceMonth];

  if (card.type !== "credit") {
    return {
      card,
      targetYear: invoiceYear,
      targetMonth: invoiceMonth,
      periodKey: targetPeriodKey,
      dueDate: effectiveDueDate,
      dueDay,
      dueMonthName,
      closingDay,
      installmentsAmount: 0,
      recurringAmount: 0,
      totalInvoice: 0,
      pendingInvoice: 0,
      paidAmount: 0,
      isPaid: true,
      isOpenInvoice: false,
      isFutureInvoice: false,
      isPastInvoice: false,
      availableLimit: card.limit || 0,
      percentUsed: 0,
      cardTransactions: [],
      recurringItems: [],
      recurringItemDetails: [],
      hasInstallments: false,
      hasRecurring: false,
    };
  }

  const { schedule, creditsByPeriod } = calculateInvoiceScheduleWithCredits(card, entries, referenceDate);
  const netInstallments = schedule[targetPeriodKey] || 0;

  const recurringDetails = getCardInvoiceRecurringDetails(
    card,
    recurringItems,
    invoiceYear,
    invoiceMonth,
    entries
  );

  const periodCredit = creditsByPeriod?.[targetPeriodKey] || 0;
  const netRecurring = Math.round(Math.max(0, recurringDetails.pendingAmount - periodCredit) * 100) / 100;
  let pendingInvoice = Math.round(Math.max(0, netInstallments + netRecurring) * 100) / 100;

  // Compras faturadas que vencem nesta competência
  const cardTransactions = entries.filter((entry) => {
    if (entry.id?.startsWith("planned-")) return false;
    if (entry.type !== "despesa") return false;
    if (entry.kind === "invoice_payment" || entry.kind === "invoice_settlement") return false;
    if (!matchesLedgerCard(card, entry.account, entry.cardId)) return false;
    const dDate = getInvoiceDueDate(card, getLedgerEntryDate(entry) || new Date(invoiceYear, invoiceMonth, 1));
    const dKey = getPeriodKey(dDate.getFullYear(), dDate.getMonth());
    return dKey === targetPeriodKey;
  });

  // Estornos/créditos avulsos no cartão (que não sejam pagamento/baixa de fatura)
  const cardRefundsTotal = entries
    .filter((entry) => {
      if (entry.id?.startsWith("planned-")) return false;
      if (entry.type !== "receita") return false;
      if (isInvoicePaymentOrSettlement(entry, card)) return false;
      if (!matchesLedgerCard(card, entry.account, entry.cardId)) return false;
      const dDate = getInvoiceDueDate(card, getLedgerEntryDate(entry) || new Date(invoiceYear, invoiceMonth, 1));
      const dKey = getPeriodKey(dDate.getFullYear(), dDate.getMonth());
      return dKey === targetPeriodKey;
    })
    .reduce((sum, entry) => sum + entry.amount, 0);

  const grossInstallments = Math.round(
    Math.max(0, cardTransactions.reduce((sum, entry) => sum + entry.amount, 0) - cardRefundsTotal) * 100
  ) / 100;
  const grossRecurring = Math.round(Math.max(0, recurringDetails.pendingAmount) * 100) / 100;

  // Pagamentos desta competência
  const processedPaymentGroups = new Set<string>();
  const paidAmount = Math.round(
    entries
      .filter((entry) => isInvoicePaymentOrSettlement(entry, card))
      .filter((entry) => {
        const pDate = getLedgerEntryDate(entry);
        const pKey = entry.periodKey || (pDate ? getPeriodKey(pDate.getFullYear(), pDate.getMonth()) : null);
        return pKey === targetPeriodKey;
      })
      .filter((entry) => {
        const groupKey = entry.groupId || entry.id;
        if (groupKey && processedPaymentGroups.has(groupKey)) return false;
        if (groupKey) processedPaymentGroups.add(groupKey);
        return true;
      })
      .reduce((sum, entry) => sum + entry.amount, 0) * 100
  ) / 100;

  // Fatura aberta do ciclo corrente de referência
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refMonthKey = getPeriodKey(refYear, refMonth);

  const openDueDate = getInvoiceDueDate(card, referenceDate);
  const openPeriodKey = getPeriodKey(openDueDate.getFullYear(), openDueDate.getMonth());

  const nextMonthRef = new Date(refYear, refMonth + 1, 1);
  const nextMonthPeriodKey = getPeriodKey(nextMonthRef.getFullYear(), nextMonthRef.getMonth());

  let effectiveOpenPeriodKey = openPeriodKey;
  const currentRecDetails = getCardInvoiceRecurringDetails(
    card,
    recurringItems,
    openDueDate.getFullYear(),
    openDueDate.getMonth(),
    entries
  );
  const currentNetRecurring = Math.max(
    0,
    currentRecDetails.pendingAmount - (creditsByPeriod?.[openPeriodKey] || 0)
  );

  if (
    openPeriodKey < nextMonthPeriodKey &&
    (schedule[openPeriodKey] || 0) === 0 &&
    currentNetRecurring === 0
  ) {
    const nextRecDetails = getCardInvoiceRecurringDetails(
      card,
      recurringItems,
      nextMonthRef.getFullYear(),
      nextMonthRef.getMonth(),
      entries
    );
    const nextNetRecurring = Math.max(
      0,
      nextRecDetails.pendingAmount - (creditsByPeriod?.[nextMonthPeriodKey] || 0)
    );
    if ((schedule[nextMonthPeriodKey] || 0) > 0 || nextNetRecurring > 0) {
      effectiveOpenPeriodKey = nextMonthPeriodKey;
    }
  }

  const isOpenInvoice = targetPeriodKey === effectiveOpenPeriodKey;
  const isFutureInvoice = targetPeriodKey > effectiveOpenPeriodKey;
  const isPastInvoice = targetPeriodKey < effectiveOpenPeriodKey;

  // Fallback se for fatura aberta sem itens distribuídos nem pagamentos, mas com gastos brutos
  if (
    isOpenInvoice &&
    pendingInvoice === 0 &&
    paidAmount === 0 &&
    Object.keys(schedule).length === 0 &&
    schedule[targetPeriodKey] === undefined &&
    recurringDetails.pendingAmount === 0
  ) {
    const rawInvoice = entries
      .filter((entry) => isActualEntry(entry) && matchesLedgerCard(card, entry.account, entry.cardId))
      .reduce((total, entry) => total + (entry.type === "despesa" ? entry.amount : -entry.amount), 0);
    pendingInvoice = Math.max(0, rawInvoice);
  }

  // Preserva o valor real da fatura mesmo quando paga (não zera ao pagar!)
  const installmentsAmount =
    paidAmount > 0
      ? Math.round(
          Math.max(
            grossInstallments,
            netInstallments,
            grossInstallments + grossRecurring === 0 ? paidAmount : 0
          ) * 100
        ) / 100
      : netInstallments;

  const recurringAmount =
    paidAmount > 0
      ? Math.round(Math.max(grossRecurring, netRecurring) * 100) / 100
      : netRecurring;

  const totalInvoice =
    paidAmount > 0
      ? Math.round(Math.max(installmentsAmount + recurringAmount, paidAmount + pendingInvoice) * 100) / 100
      : pendingInvoice;

  const hasInstallments = cardTransactions.length > 0 || installmentsAmount > 0;
  const hasRecurring = recurringDetails.items.length > 0 || recurringAmount > 0;
  const isPaid =
    (isPastInvoice && pendingInvoice <= 0.005) ||
    targetPeriodKey < refMonthKey ||
    (paidAmount > 0 && pendingInvoice <= 0.005);

  const effectiveSpent =
    card.spent > 0
      ? card.spent
      : calculateCreditCardUsedLimit(card, entries, recurringItems, referenceDate);
  const availableLimit = Math.round(Math.max(0, card.limit - effectiveSpent) * 100) / 100;
  const percentUsed =
    card.limit > 0 ? Math.min(100, Math.round((effectiveSpent / card.limit) * 100)) : 0;

  return {
    card,
    targetYear: invoiceYear,
    targetMonth: invoiceMonth,
    periodKey: targetPeriodKey,
    dueDate: effectiveDueDate,
    dueDay,
    dueMonthName,
    closingDay,
    installmentsAmount,
    recurringAmount,
    totalInvoice,
    pendingInvoice,
    paidAmount,
    isPaid,
    isOpenInvoice,
    isFutureInvoice,
    isPastInvoice,
    availableLimit,
    percentUsed,
    cardTransactions,
    recurringItems: recurringDetails.items,
    recurringItemDetails: recurringDetails.itemDetails || [],
    hasInstallments,
    hasRecurring,
  };
}

export function getLedgerEntryDate(entry: LedgerEntry): Date | null {
  const raw = entry.occurredAt || entry.createdAt || (entry as { date?: string | Date }).date;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number") {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof raw === "string") {
    // Se for formato YYYY-MM-DD, interpretar como meio-dia local para evitar deslocamento UTC-3
    const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      return new Date(year, month, day, 12, 0, 0);
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Fluxo efetivamente realizado nas contas durante um mês.
 * Compras no crédito e itens apenas planejados não fazem parte deste total.
 */
export function calculateMonthlyAccountFlow(
  cards: CardItem[],
  entries: LedgerEntry[],
  targetDate: Date = new Date()
): AccountFlow {
  const primaryAccount = cards.find((card) => card.type === "checking");
  if (!primaryAccount) return { income: 0, outflow: 0 };

  const accountEntries = entries.filter((entry) => {
    const occurredAt = getLedgerEntryDate(entry);
    const isTargetMonth = occurredAt &&
      occurredAt.getMonth() === targetDate.getMonth() &&
      occurredAt.getFullYear() === targetDate.getFullYear();

    return isActualEntry(entry) && Boolean(isTargetMonth) &&
      matchesLedgerCard(primaryAccount, entry.account, entry.cardId);
  });

  return accountEntries.reduce<AccountFlow>(
    (flow, entry) => {
      if (entry.kind === "balance_reconciliation") return flow;
      if (entry.type === "receita") flow.income += entry.amount;
      else flow.outflow += entry.amount;
      return flow;
    },
    { income: 0, outflow: 0 }
  );
}

/** Calcula em qual mês uma compra entra na fatura, pelo fechamento e vencimento. */
export function getInvoiceDueDate(card: CardItem, purchaseDate: Date): Date {
  const closingDay = Math.min(31, Math.max(1, card.closingDay || 1));
  const dueDay = Math.min(31, Math.max(1, card.dueDay || closingDay));
  const closingMonthOffset = purchaseDate.getDate() > closingDay ? 1 : 0;
  const dueMonthOffset = closingMonthOffset + (dueDay <= closingDay ? 1 : 0);
  const dueMonth = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + dueMonthOffset, 1);
  const lastDay = new Date(dueMonth.getFullYear(), dueMonth.getMonth() + 1, 0).getDate();
  return new Date(dueMonth.getFullYear(), dueMonth.getMonth(), Math.min(dueDay, lastDay));
}

/**
 * Distribui a fatura aberta por mês de vencimento. Créditos e pagamentos
 * liquidam primeiro as cobranças mais antigas.
 */
export function calculateInvoiceScheduleWithCredits(
  card: CardItem,
  entries: LedgerEntry[],
  fallbackDate: Date = new Date()
): { schedule: Record<string, number>; remainingCredits: number; creditsByPeriod: Record<string, number> } {
  const charges = new Map<string, number>();
  const paymentsByPeriod = new Map<string, number>();

  const processedGroups = new Set<string>();

  for (const entry of entries.filter(isActualEntry)) {
    // 1. Pagamentos ou baixas da fatura deste cartão
    if (isInvoicePaymentOrSettlement(entry, card)) {
      const groupKey = entry.groupId || entry.id;
      if (groupKey && processedGroups.has(groupKey)) {
        continue;
      }
      if (groupKey) processedGroups.add(groupKey);

      const pDate = getLedgerEntryDate(entry) || fallbackDate;
      const pKey = entry.periodKey || getPeriodKey(pDate.getFullYear(), pDate.getMonth());
      paymentsByPeriod.set(pKey, (paymentsByPeriod.get(pKey) || 0) + entry.amount);
      continue;
    }

    // 2. Compras faturadas no cartão de crédito
    if (matchesLedgerCard(card, entry.account, entry.cardId)) {
      if (entry.type === "receita") {
        const dDate = getInvoiceDueDate(card, getLedgerEntryDate(entry) || fallbackDate);
        const key = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, "0")}`;
        paymentsByPeriod.set(key, (paymentsByPeriod.get(key) || 0) + entry.amount);
        continue;
      }
      const dueDate = getInvoiceDueDate(card, getLedgerEntryDate(entry) || fallbackDate);
      const key = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
      charges.set(key, (charges.get(key) || 0) + entry.amount);
    }
  }

  const allKeys = new Set([...charges.keys(), ...paymentsByPeriod.keys()]);
  const sortedKeys = [...allKeys].sort();

  const result: Record<string, number> = {};
  const creditsByPeriod: Record<string, number> = {};

  for (const key of sortedKeys) {
    const charge = charges.get(key) || 0;
    const payment = paymentsByPeriod.get(key) || 0;

    // Pagamentos efetuados para uma competência K liquidam a fatura de K.
    // Não abatem cobranças de competências futuras (K+1, etc.), pois são faturas abertas ainda não pagas.
    const appliedCredit = Math.min(charge, payment);
    result[key] = Math.max(0, charge - appliedCredit);
    creditsByPeriod[key] = Math.max(0, payment - charge);
  }

  return { schedule: result, remainingCredits: 0, creditsByPeriod };
}

export function calculateInvoiceSchedule(
  card: CardItem,
  entries: LedgerEntry[],
  fallbackDate: Date = new Date()
): Record<string, number> {
  return calculateInvoiceScheduleWithCredits(card, entries, fallbackDate).schedule;
}

/**
 * Calcula o saldo projetado acumulando o saldo transportado do mês anterior (openingBalance)
 * com as entradas previstas menos as saídas comprometidas.
 */
export function calculateProjectedBalance(
  openingBalance: number,
  income: number,
  committed: number
): number {
  return openingBalance + income - committed;
}
