"use client";

import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";

/** Erro de uma rota de IA com a mensagem já pronta para mostrar. */
export class AIRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AIRequestError";
    this.status = status;
    this.code = code;
  }
}

export function describeAIFailure(status: number): string {
  if (status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
  if (status === 429) return "Você atingiu o limite de uso da IA por agora. Tente mais tarde.";
  if (status === 413) return "Os dados ficaram grandes demais para enviar. Inicie uma nova conversa.";
  return "A IA está indisponível no momento. Tente novamente em instantes.";
}

/**
 * POST autenticado para as rotas de IA. Renova o token uma vez em 401 e
 * transforma qualquer falha em AIRequestError com mensagem legível.
 */
export async function postAI<T>(url: string, body: unknown, user?: Pick<User, "getIdToken"> | null): Promise<T> {
  const activeUser = auth?.currentUser || user || null;
  const payload = JSON.stringify(body);
  const send = async (forceRefresh: boolean) => {
    const token = activeUser ? await activeUser.getIdToken(forceRefresh) : "";
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: payload,
    });
  };

  let res: Response;
  try {
    res = await send(false);
    if (res.status === 401 && activeUser) res = await send(true);
  } catch {
    throw new AIRequestError("Não consegui falar com o servidor. Verifique sua conexão e tente novamente.", 0);
  }

  const text = await res.text();
  let data: (T & { success?: boolean; error?: string; code?: string }) | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok || !data || data.success === false) {
    throw new AIRequestError(data?.error || describeAIFailure(res.status), res.status, data?.code);
  }
  return data;
}

interface ProjectionLike {
  monthName: string;
  year: number;
  openingBalance: number;
  actualClosingBalance?: number;
  plannedIncomesTotal: number;
  recurringDebitTotal: number;
  recurringCreditTotal: number;
  cardInstallments: number;
  totalCommitted: number;
  pendingCommitted?: number;
  totalInvoicesPending?: number;
  projectedFreeBalance: number;
  monthNetSurplus?: number;
  actualIncomeTotal?: number;
  actualOutflowTotal?: number;
  projectedIncome?: number;
  cardInvoices?: Array<{ cardId: string; cardName?: string; dueDay?: number; pendingInvoice?: number; isPaid?: boolean }>;
}

/** Resumo das projeções dos próximos 6 meses no formato que as rotas de IA esperam. */
export function summarizeProjections(getMonthlyProjection: (index: number) => ProjectionLike) {
  return [0, 1, 2, 3, 4, 5].map((idx) => {
    const p = getMonthlyProjection(idx);
    return {
      monthName: p.monthName,
      year: p.year,
      openingBalance: p.openingBalance,
      actualClosingBalance: p.actualClosingBalance,
      plannedIncomesTotal: p.plannedIncomesTotal,
      recurringDebitTotal: p.recurringDebitTotal,
      recurringCreditTotal: p.recurringCreditTotal,
      cardInstallments: p.cardInstallments,
      totalCommitted: p.totalCommitted,
      pendingCommitted: p.pendingCommitted,
      totalInvoicesPending: p.totalInvoicesPending,
      projectedFreeBalance: p.projectedFreeBalance,
      monthNetSurplus: p.monthNetSurplus,
      actualIncomeTotal: p.actualIncomeTotal,
      actualOutflowTotal: p.actualOutflowTotal,
      projectedIncome: p.projectedIncome,
      // Só o necessário da fatura (sem a lista de compras)
      cardInvoices: (p.cardInvoices ?? []).map((inv) => ({
        cardId: inv.cardId,
        cardName: inv.cardName,
        dueDay: inv.dueDay,
        pendingInvoice: inv.pendingInvoice,
        isPaid: inv.isPaid,
      })),
    };
  });
}

/** Data local da pessoa (AAAA-MM-DD), para o servidor usar o mesmo "hoje". */
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lançamentos do mês atual e dos 3 anteriores: o suficiente para comparar com a média. */
export function recentTransactionsForAI<T extends { date?: string; occurredAt?: unknown; createdAt?: unknown }>(transactions: T[], now: Date = new Date()): T[] {
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).getTime();
  return transactions.filter((tx) => {
    const raw = (tx.occurredAt as string | number | undefined) ?? tx.date ?? (tx.createdAt as string | number | undefined);
    if (raw === undefined || raw === null) return true;
    const t = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw) ? new Date(`${raw.slice(0, 10)}T12:00:00`).getTime() : new Date(raw as string | number).getTime();
    return Number.isNaN(t) || t >= from;
  });
}
