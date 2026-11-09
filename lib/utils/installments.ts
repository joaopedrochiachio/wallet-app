import { getPeriodKey } from "./dateUtils.ts";
import { splitInstallmentPurchase } from "./ledger.ts";

/** Mantém a data e a numeração originais, cobrando apenas as parcelas ainda pendentes. */
export function buildInstallmentPurchasePlan(
  totalAmount: number,
  installmentsCount: number,
  purchaseDate: Date,
  paidInstallmentsCount = 0
) {
  const split = splitInstallmentPurchase(totalAmount, installmentsCount);
  if (
    !Number.isInteger(paidInstallmentsCount) ||
    paidInstallmentsCount < 0 ||
    paidInstallmentsCount > split.installmentsCount
  ) {
    throw new Error(`Informe entre 0 e ${split.installmentsCount} parcelas já pagas.`);
  }
  if (Number.isNaN(purchaseDate.getTime())) {
    throw new Error("Informe uma data de compra válida.");
  }

  const dateAtOffset = (offset: number) => {
    const month = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + offset, 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return new Date(month.getFullYear(), month.getMonth(), Math.min(purchaseDate.getDate(), lastDay), 12);
  };
  const lastDate = dateAtOffset(split.installmentsCount - 1);
  const remainingInstallments = split.installmentsCount - paidInstallmentsCount;
  const firstUnpaidDate = remainingInstallments > 0 ? dateAtOffset(paidInstallmentsCount) : null;

  return {
    ...split,
    paidInstallmentsCount,
    remainingInstallments,
    remainingAmount: remainingInstallments > 0
      ? Math.round((split.totalAmount - split.installmentAmount * paidInstallmentsCount) * 100) / 100
      : 0,
    firstUnpaidOccurrence: firstUnpaidDate ? {
      date: firstUnpaidDate,
      periodKey: getPeriodKey(firstUnpaidDate.getFullYear(), firstUnpaidDate.getMonth()),
      amount: remainingInstallments === 1 ? split.lastInstallmentAmount : split.installmentAmount,
    } : null,
    overrides: Math.abs(split.lastInstallmentAmount - split.installmentAmount) >= 0.005
      ? { [getPeriodKey(lastDate.getFullYear(), lastDate.getMonth())]: { amount: split.lastInstallmentAmount } }
      : undefined,
  };
}
