"use client";

import React from "react";
import { CalendarClock, ChevronRight, Repeat } from "lucide-react";
import type { CardItem } from "@/types";
import { formatShortDate, monthName, type CardStatement } from "@/lib/utils/creditCardEngine";
import { CardDot, Money } from "./cardUi";

export function CommitmentsList({
  cards,
  statements,
  onOpenInvoice,
}: {
  cards: CardItem[];
  statements: Record<string, CardStatement>;
  onOpenInvoice: (periodKey: string, cardId: string) => void;
}) {
  const plans = cards
    .flatMap((card) => (statements[card.id]?.plans || []).map((plan) => ({ plan, card })))
    .sort((a, b) => (a.plan.lastInvoiceKey || "").localeCompare(b.plan.lastInvoiceKey || ""));
  const subs = cards.flatMap((card) => (statements[card.id]?.subscriptions || []).map((sub) => ({ sub, card })));
  const remainingTotal = plans.reduce((sum, { plan }) => sum + plan.remainingAmount, 0);
  const subsTotal = subs.reduce((sum, { sub }) => sum + sub.amount, 0);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <header className="flex flex-col gap-2 px-5 pb-3 pt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F]">Compras parceladas</h2>
            <p className="text-xs text-[#86868B]">Ocupam o limite inteiro; cada fatura paga devolve a parcela.</p>
          </div>
          <div className="flex items-baseline gap-2 sm:block sm:text-right">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Ainda vai cobrar</span>
            <Money value={remainingTotal} className="text-base font-semibold text-[#1D1D1F]" />
          </div>
        </header>
        {plans.length === 0 ? (
          <p className="px-5 pb-5 text-xs text-[#86868B]">Nenhuma compra parcelada em andamento.</p>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {plans.map(({ plan, card }) => {
              const lastMonth = plan.lastInvoiceKey ? monthName(Number(plan.lastInvoiceKey.split("-")[1]) - 1) : null;
              const target = plan.nextCharge?.invoiceKey || plan.lastInvoiceKey;
              return (
                <li key={plan.recurringItemId}>
                  <button
                    type="button"
                    onClick={() => target && onOpenInvoice(target, card.id)}
                    className="flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#F8F8FA]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                      <CalendarClock size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#1D1D1F]">{plan.title}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[#86868B]">
                        <span className="mr-1 inline-block align-middle"><CardDot card={card} size={6} /></span>
                        {card.name} · {plan.installmentsCount}x de <Money value={plan.installmentAmount} />
                        {lastMonth && <span className="hidden sm:inline"> · última na fatura de {lastMonth}</span>}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F2F2F7]">
                          <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(plan.chargedCount / plan.installmentsCount) * 100}%` }} />
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#86868B]">{plan.chargedCount}/{plan.installmentsCount}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <Money value={plan.remainingAmount} className="block text-sm font-semibold text-[#1D1D1F]" />
                      <span className="block text-[10px] text-[#86868B]">de <Money value={plan.totalAmount} /></span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-[#86868B]" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <header className="flex flex-col gap-2 px-5 pb-3 pt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F]">Assinaturas</h2>
            <p className="text-xs text-[#86868B]">Toque para mover de cartão ou cancelar a partir de uma fatura.</p>
          </div>
          <div className="flex items-baseline gap-2 sm:block sm:text-right">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Por mês</span>
            <Money value={subsTotal} className="text-base font-semibold text-[#1D1D1F]" />
          </div>
        </header>
        {subs.length === 0 ? (
          <p className="px-5 pb-5 text-xs text-[#86868B]">Nenhuma assinatura no cartão.</p>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {subs.map(({ sub, card }) => (
              <li key={sub.recurringItemId}>
                <button
                  type="button"
                  onClick={() => sub.nextCharge && onOpenInvoice(sub.nextCharge.invoiceKey, card.id)}
                  className="flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#F8F8FA]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                    <Repeat size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#1D1D1F]">{sub.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#86868B]">
                      <span className="mr-1 inline-block align-middle"><CardDot card={card} size={6} /></span>{card.name}
                      {sub.nextCharge && <> · próxima {formatShortDate(sub.nextCharge.chargeDate)}</>}
                    </span>
                  </span>
                  <Money value={sub.amount} className="shrink-0 text-sm font-semibold text-[#1D1D1F]" />
                  <ChevronRight size={16} className="shrink-0 text-[#86868B]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
