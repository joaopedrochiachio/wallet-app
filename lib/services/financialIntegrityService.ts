import type { CardItem, RecurringItem } from "../../types/index.ts";
import {
  getLedgerEntryDate,
  matchesLedgerCard,
  type LedgerEntry,
} from "../utils/ledger.ts";
import { getPeriodKey } from "../utils/dateUtils.ts";

export type FinancialIntegritySeverity = "error" | "warning";

export interface FinancialIntegrityIssue {
  code:
    | "invalid_amount"
    | "missing_date"
    | "unknown_account"
    | "duplicate_occurrence"
    | "duplicate_entry"
    | "realized_without_entry"
    | "entry_without_realization"
    | "malformed_invoice_group"
    | "period_mismatch"
    | "monthly_equation_mismatch"
    | "carry_mismatch"
    | "current_balance_mismatch";
  severity: FinancialIntegritySeverity;
  message: string;
  transactionIds?: string[];
}

export interface FinancialIntegrityProjection {
  openingBalance: number;
  actualIncomeTotal: number;
  actualOutflowTotal: number;
  balanceReconciliationTotal?: number;
  actualClosingBalance: number;
  plannedIncomesTotal: number;
  pendingCommitted: number;
  projectedFreeBalance: number;
}

export interface FinancialIntegrityAudit {
  status: "ok" | "warning" | "error";
  issues: FinancialIntegrityIssue[];
  errorCount: number;
  warningCount: number;
}

interface AuditInput {
  cards: CardItem[];
  transactions: LedgerEntry[];
  recurringItems: RecurringItem[];
  projection: FinancialIntegrityProjection;
  targetYear: number;
  targetMonth: number;
  expectedOpeningBalance?: number;
  currentCheckingBalance?: number;
}

const CENT_TOLERANCE = 0.011;

function roundCurrency(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalized(value: string | undefined | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function transactionPeriod(entry: LedgerEntry): string | null {
  const date = getLedgerEntryDate(entry);
  return date ? getPeriodKey(date.getFullYear(), date.getMonth()) : null;
}

function transactionLabel(entry: LedgerEntry): string {
  return entry.title || entry.description || "Lançamento sem título";
}

function isActualEntry(entry: LedgerEntry): boolean {
  return !entry.id?.startsWith("planned-");
}

/**
 * Auditor determinístico do livro-caixa. Ele nunca altera registros: apenas
 * confronta as fontes que precisam contar a mesma história financeira.
 */
export function auditFinancialIntegrity(input: AuditInput): FinancialIntegrityAudit {
  const {
    cards,
    transactions,
    recurringItems,
    projection,
    targetYear,
    targetMonth,
    expectedOpeningBalance,
    currentCheckingBalance,
  } = input;
  const issues: FinancialIntegrityIssue[] = [];
  const targetPeriod = getPeriodKey(targetYear, targetMonth);
  const actualTransactions = transactions.filter(isActualEntry);

  const invalidAmounts = actualTransactions.filter(
    (entry) => !Number.isFinite(entry.amount) || entry.amount <= 0
  );
  if (invalidAmounts.length > 0) {
    issues.push({
      code: "invalid_amount",
      severity: "error",
      message: `${invalidAmounts.length} lançamento(s) têm valor inválido.`,
      transactionIds: invalidAmounts.flatMap((entry) => (entry.id ? [entry.id] : [])),
    });
  }

  const missingDates = actualTransactions.filter((entry) => !getLedgerEntryDate(entry));
  if (missingDates.length > 0) {
    issues.push({
      code: "missing_date",
      severity: "error",
      message: `${missingDates.length} lançamento(s) não têm uma data válida e ficaram fora do mês.`,
      transactionIds: missingDates.flatMap((entry) => (entry.id ? [entry.id] : [])),
    });
  }

  const unknownAccountEntries = actualTransactions.filter(
    (entry) => !cards.some((card) => matchesLedgerCard(card, entry.account, entry.cardId))
  );
  if (unknownAccountEntries.length > 0) {
    issues.push({
      code: "unknown_account",
      severity: "error",
      message: `${unknownAccountEntries.length} lançamento(s) apontam para uma conta ou cartão inexistente.`,
      transactionIds: unknownAccountEntries.flatMap((entry) => (entry.id ? [entry.id] : [])),
    });
  }

  const periodMismatches = actualTransactions.filter((entry) => {
    if (!entry.periodKey || !entry.recurringItemId) return false;
    const derivedPeriod = transactionPeriod(entry);
    return derivedPeriod !== null && derivedPeriod !== entry.periodKey;
  });
  if (periodMismatches.length > 0) {
    issues.push({
      code: "period_mismatch",
      severity: "warning",
      message: `${periodMismatches.length} baixa(s) recorrentes têm competência diferente da data efetiva.`,
      transactionIds: periodMismatches.flatMap((entry) => (entry.id ? [entry.id] : [])),
    });
  }

  const recurringOccurrences = new Map<string, LedgerEntry[]>();
  for (const entry of actualTransactions) {
    if (!entry.recurringItemId || !entry.periodKey) continue;
    const key = `${entry.recurringItemId}:${entry.periodKey}`;
    recurringOccurrences.set(key, [...(recurringOccurrences.get(key) || []), entry]);
  }
  const duplicatedOccurrences = [...recurringOccurrences.values()].filter(
    (entries) => entries.length > 1
  );
  if (duplicatedOccurrences.length > 0) {
    issues.push({
      code: "duplicate_occurrence",
      severity: "error",
      message: `${duplicatedOccurrences.length} conta(s) recorrentes foram efetivadas mais de uma vez no mesmo mês.`,
      transactionIds: duplicatedOccurrences.flatMap((entries) =>
        entries.flatMap((entry) => (entry.id ? [entry.id] : []))
      ),
    });
  }

  const exactEntryGroups = new Map<string, LedgerEntry[]>();
  for (const entry of actualTransactions) {
    const entryDate = getLedgerEntryDate(entry);
    if (!entryDate || entry.kind === "invoice_settlement") continue;
    const dayKey = `${entryDate.getFullYear()}-${entryDate.getMonth()}-${entryDate.getDate()}`;
    const duplicateKey = [
      entry.type,
      roundCurrency(entry.amount).toFixed(2),
      normalized(entry.account),
      normalized(transactionLabel(entry)),
      dayKey,
    ].join("|");
    exactEntryGroups.set(duplicateKey, [...(exactEntryGroups.get(duplicateKey) || []), entry]);
  }
  const exactDuplicates = [...exactEntryGroups.values()].filter((entries) => {
    if (entries.length <= 1) return false;
    const groupIds = entries.map((entry) => entry.groupId).filter(Boolean);
    return groupIds.length === 0 || new Set(groupIds).size !== 1;
  });
  if (exactDuplicates.length > 0) {
    issues.push({
      code: "duplicate_entry",
      severity: "warning",
      message: `${exactDuplicates.length} grupo(s) de lançamentos idênticos precisam de revisão.`,
      transactionIds: exactDuplicates.flatMap((entries) =>
        entries.flatMap((entry) => (entry.id ? [entry.id] : []))
      ),
    });
  }

  const recurringById = new Map(recurringItems.map((item) => [item.id, item]));
  const realizedWithoutEntry = recurringItems.filter((item) => {
    if (!item.realizedPeriods?.includes(targetPeriod)) return false;
    return !actualTransactions.some(
      (entry) =>
        entry.recurringItemId === item.id &&
        (entry.periodKey === targetPeriod || transactionPeriod(entry) === targetPeriod)
    );
  });
  if (realizedWithoutEntry.length > 0) {
    issues.push({
      code: "realized_without_entry",
      severity: "error",
      message: `${realizedWithoutEntry.length} conta(s) aparecem como pagas/recebidas, mas não têm lançamento no caixa.`,
    });
  }

  const entryWithoutRealization = actualTransactions.filter((entry) => {
    if (!entry.recurringItemId || entry.periodKey !== targetPeriod) return false;
    const recurring = recurringById.get(entry.recurringItemId);
    return Boolean(recurring && !recurring.realizedPeriods?.includes(targetPeriod));
  });
  if (entryWithoutRealization.length > 0) {
    issues.push({
      code: "entry_without_realization",
      severity: "warning",
      message: `${entryWithoutRealization.length} lançamento(s) existem no caixa, mas o planejamento ainda os mostra como pendentes.`,
      transactionIds: entryWithoutRealization.flatMap((entry) => (entry.id ? [entry.id] : [])),
    });
  }

  const invoiceGroups = new Map<string, LedgerEntry[]>();
  for (const entry of actualTransactions) {
    if (!entry.groupId || (entry.kind !== "invoice_payment" && entry.kind !== "invoice_settlement")) {
      continue;
    }
    invoiceGroups.set(entry.groupId, [...(invoiceGroups.get(entry.groupId) || []), entry]);
  }
  const malformedGroups = [...invoiceGroups.values()].filter((entries) => {
    const kinds = new Set(entries.map((entry) => entry.kind));
    const amounts = new Set(entries.map((entry) => roundCurrency(entry.amount)));
    return entries.length !== 2 || !kinds.has("invoice_payment") || !kinds.has("invoice_settlement") || amounts.size !== 1;
  });
  if (malformedGroups.length > 0) {
    issues.push({
      code: "malformed_invoice_group",
      severity: "error",
      message: `${malformedGroups.length} pagamento(s) de fatura estão incompletos ou com valores diferentes.`,
      transactionIds: malformedGroups.flatMap((entries) =>
        entries.flatMap((entry) => (entry.id ? [entry.id] : []))
      ),
    });
  }

  const calculatedActualClosing = roundCurrency(
    projection.openingBalance +
      (projection.balanceReconciliationTotal || 0) +
      projection.actualIncomeTotal -
      projection.actualOutflowTotal
  );
  const calculatedProjectedClosing = roundCurrency(
    calculatedActualClosing + projection.plannedIncomesTotal - projection.pendingCommitted
  );
  if (
    Math.abs(calculatedActualClosing - roundCurrency(projection.actualClosingBalance)) > CENT_TOLERANCE ||
    Math.abs(calculatedProjectedClosing - roundCurrency(projection.projectedFreeBalance)) > CENT_TOLERANCE
  ) {
    issues.push({
      code: "monthly_equation_mismatch",
      severity: "error",
      message: "O resumo mensal não fecha com as entradas, saídas e pendências da base.",
    });
  }

  if (
    expectedOpeningBalance !== undefined &&
    Math.abs(roundCurrency(expectedOpeningBalance) - roundCurrency(projection.openingBalance)) > CENT_TOLERANCE
  ) {
    issues.push({
      code: "carry_mismatch",
      severity: "error",
      message: "O fechamento do mês anterior não foi transportado integralmente para este mês.",
    });
  }

  if (
    currentCheckingBalance !== undefined &&
    Math.abs(roundCurrency(currentCheckingBalance) - roundCurrency(projection.actualClosingBalance)) > CENT_TOLERANCE
  ) {
    issues.push({
      code: "current_balance_mismatch",
      severity: "error",
      message: "O saldo das contas não confere com o fechamento realizado deste mês.",
    });
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  return {
    status: errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "ok",
    issues,
    errorCount,
    warningCount,
  };
}
