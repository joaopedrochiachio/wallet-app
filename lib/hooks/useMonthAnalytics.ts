"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useWallet } from "@/context/WalletContext";
import { buildFinancialAnalytics, type FinancialAnalytics } from "@/lib/services/financialAnalyticsService";
import { getSpendingGuidance, type SpendingGuidance } from "@/lib/services/spendingGuidance";
import { recentTransactionsForAI, summarizeProjections } from "@/lib/ai/clientRequests";
import type { TransactionContextItem } from "@/lib/services/financialContextService";

export const MONTHLY_TARGET_KEY = "wallet_monthly_target";

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/** Meta de fechamento do mês: a escolhida na tela da IA ou a do perfil. */
export function useMonthlyTarget(): number {
  const { userProfile } = useWallet();
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return window.localStorage.getItem(MONTHLY_TARGET_KEY);
      } catch {
        return null;
      }
    },
    () => null
  );
  const parsed = stored === null ? NaN : parseFloat(stored);
  return Number.isNaN(parsed) ? userProfile?.targetMonthEndBalance ?? 700 : parsed;
}

/**
 * Análise do mês no aparelho, com a MESMA lógica que a IA recebe
 * (caixa do Planejamento, linha do tempo, gastos do mês x média).
 */
export function useMonthAnalytics(): { analytics: FinancialAnalytics; guidance: SpendingGuidance } {
  const { cards, transactions, recurringItems, goals, mainBalance, getMonthlyProjection, userProfile } = useWallet();
  const target = useMonthlyTarget();
  return useMemo(() => {
    const analytics = buildFinancialAnalytics({
      cards,
      transactions: recentTransactionsForAI(transactions) as unknown as TransactionContextItem[],
      recurringItems,
      goals,
      monthlyProjections: summarizeProjections(getMonthlyProjection),
      mainBalance,
      targetEndMonthBalance: target,
      monthlyIncomeBase: userProfile?.monthlyIncomeBase,
    });
    return { analytics, guidance: getSpendingGuidance(analytics) };
  }, [cards, transactions, recurringItems, goals, getMonthlyProjection, mainBalance, target, userProfile?.monthlyIncomeBase]);
}
