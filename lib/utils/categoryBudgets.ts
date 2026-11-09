import type { CategoryBudget } from "../../types/index.ts";
import { getLedgerEntryDate, type LedgerEntry } from "./ledger.ts";

const categoryKey = (category: string) => category.trim().toLocaleLowerCase("pt-BR");

export function validateCategoryBudgets(budgets: CategoryBudget[]): CategoryBudget[] {
  if (!Array.isArray(budgets) || budgets.length > 50) throw new Error("Você pode configurar até 50 categorias.");
  const seen = new Set<string>();
  const ids = new Set<string>();
  return budgets.map((budget) => {
    const category = budget.category?.trim();
    const key = category ? categoryKey(category) : "";
    if (!key || category.length > 60 || seen.has(key) || ids.has(budget.id) || !/^[a-zA-Z0-9_-]{1,120}$/.test(budget.id)) {
      throw new Error("Escolha categorias válidas, sem repetir uma categoria.");
    }
    if (!Number.isFinite(budget.amount) || budget.amount < 0.01 || budget.amount > 100_000_000 ||
      !Number.isInteger(budget.alertPercent) || budget.alertPercent < 1 || budget.alertPercent > 100) {
      throw new Error("Informe um limite válido e um alerta entre 1% e 100%.");
    }
    seen.add(key);
    ids.add(budget.id);
    return { id: budget.id, category, amount: Math.round(budget.amount * 100) / 100, alertPercent: budget.alertPercent };
  });
}

export function getCategoryBudgetProgress(
  budgets: CategoryBudget[], transactions: LedgerEntry[], year: number, month: number
) {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.id?.startsWith("planned-") || transaction.kind === "invoice_payment" ||
      transaction.kind === "invoice_settlement" || transaction.kind === "balance_reconciliation" ||
      transaction.groupId?.startsWith("goal-") ||
      (transaction.category === "Investimentos & Metas" && /^(aporte|resgate)( inicial)?:/i.test(transaction.title || transaction.description || ""))) continue;
    const date = getLedgerEntryDate(transaction);
    if (!date || date.getFullYear() !== year || date.getMonth() !== month || !transaction.category) continue;
    const key = categoryKey(transaction.category);
    const cents = Math.round(transaction.amount * 100);
    if (!Number.isFinite(cents)) continue;
    totals.set(key, (totals.get(key) || 0) + (transaction.type === "despesa" ? cents : -cents));
  }
  return budgets.map((budget) => {
    const spent = Math.max(0, totals.get(categoryKey(budget.category)) || 0) / 100;
    const percent = budget.amount > 0 ? Math.floor(spent / budget.amount * 100) : 0;
    return {
      ...budget, spent, percent,
      remaining: Math.round((budget.amount - spent) * 100) / 100,
      status: spent >= budget.amount ? "exceeded" as const
        : spent * 100 >= budget.amount * budget.alertPercent ? "warning" as const : "normal" as const,
    };
  });
}
