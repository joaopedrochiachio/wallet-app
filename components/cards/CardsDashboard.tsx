"use client";

import React, { useMemo, useState } from "react";
import { CalendarClock, ChevronRight, Repeat, Settings2 } from "lucide-react";
import type { CardItem } from "@/types";
import {
  formatShortDate,
  monthName,
  monthNameLower,
  shiftPeriodKey,
  type CardStatement,
} from "@/lib/utils/creditCardEngine";
import { MiniCard } from "@/components/wallet";
import { CardDot, InvoiceStatusPill, Money, cardAccent, formatBRL } from "./cardUi";

interface Props {
  creditCards: CardItem[];
  statements: Record<string, CardStatement>;
  /** Cartões em foco (vazio = todos). */
  focusIds: string[];
  onToggleFocus: (cardId: string) => void;
  onOpenInvoice: (periodKey: string) => void;
  onOpenPlans: () => void;
  onManageCard: (card: CardItem) => void;
}

export function CardsDashboard({
  creditCards,
  statements,
  focusIds,
  onToggleFocus,
  onOpenInvoice,
  onOpenPlans,
  onManageCard,
}: Props) {
  const focused = focusIds.length > 0 ? creditCards.filter((card) => focusIds.includes(card.id)) : creditCards;
  const focusedStatements = focused.map((card) => statements[card.id]).filter(Boolean);

  const totals = useMemo(() => {
    const limit = focused.reduce((sum, card) => sum + (card.limit || 0), 0);
    const used = focusedStatements.reduce((sum, s) => sum + s.usedLimit, 0);
    const due = focusedStatements.reduce((sum, s) => sum + s.amountDue, 0);
    const future = focusedStatements.reduce((sum, s) => sum + s.futureCommitted, 0);
    const subs = focusedStatements.reduce((sum, s) => sum + s.subscriptions.reduce((a, b) => a + b.amount, 0), 0);
    const nextDue = focusedStatements
      .flatMap((s) => s.invoices.filter((invoice) => invoice.outstanding > 0.005 && invoice.key <= s.currentCycleKey))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
    return { limit, used, due, future, subs, available: Math.max(0, limit - used), nextDue };
  }, [focused, focusedStatements]);

  return (
    <div className="space-y-4">
      {/* Limite: um número principal, o resto ao tocar */}
      <section className="rounded-[24px] border border-black/[0.05] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">Limite disponível</span>
            <Money value={totals.available} className="mt-1 block text-[34px] font-semibold leading-none tracking-tight text-[#1D1D1F]" />
            <p className="mt-2 text-xs text-[#86868B]">
              de <Money value={totals.limit} /> · <Money value={totals.used} className="text-[#1D1D1F]" /> em uso
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:w-[440px] sm:grid-cols-3">
            <Stat
              label="A pagar agora"
              value={totals.due}
              hint={totals.nextDue ? `próx. venc. ${formatShortDate(totals.nextDue.dueDate)}` : "nada pendente"}
              onClick={totals.nextDue ? () => onOpenInvoice(totals.nextDue!.key) : undefined}
            />
            <Stat label="Parcelas futuras" value={totals.future} hint="já comprometido" onClick={onOpenPlans} />
            <Stat label="Assinaturas" value={totals.subs} hint="por mês" onClick={onOpenPlans} />
          </div>
        </div>

        {totals.limit > 0 && (
          <div className="mt-5">
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-[#F2F2F7]" role="img" aria-label="Uso do limite por cartão">
              {focused.map((card) => {
                const used = statements[card.id]?.usedLimit || 0;
                if (used <= 0) return null;
                return (
                  <div
                    key={card.id}
                    title={`${card.name}: R$ ${formatBRL(used)} em uso`}
                    className="h-full transition-all duration-500"
                    style={{ width: `${(used / totals.limit) * 100}%`, backgroundColor: cardAccent(card) }}
                  />
                );
              })}
            </div>
            {focused.length > 1 && (
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                {focused.map((card) => (
                  <span key={card.id} className="inline-flex items-center gap-1.5 text-[11px] text-[#86868B]">
                    <CardDot card={card} size={8} />
                    {card.name}
                    <Money value={statements[card.id]?.usedLimit || 0} className="text-[#1D1D1F]" />
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Meus cartões */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-[#1D1D1F]">Meus cartões</h2>
          {focusIds.length > 0 && (
            <button type="button" onClick={() => focusIds.forEach(onToggleFocus)} className="touch-target cursor-pointer text-xs font-medium text-[#0071E3]">
              Ver todos
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {creditCards.map((card) => {
            const statement = statements[card.id];
            if (!statement) return null;
            const current = statement.getInvoice(statement.currentCycleKey);
            const pending = statement.invoices.find((invoice) => invoice.outstanding > 0.005 && invoice.key < statement.currentCycleKey);
            const isFocused = focusIds.includes(card.id);
            return (
              <div
                key={card.id}
                className={`w-[260px] shrink-0 snap-start rounded-[22px] border bg-white p-4 transition-all sm:w-[280px] ${
                  isFocused ? "border-[#1D1D1F] shadow-xs" : "border-black/[0.05]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onToggleFocus(card.id)} className="flex min-w-0 cursor-pointer items-center gap-2.5 text-left" aria-pressed={isFocused}>
                    <MiniCard cardName={card.name} brand={card.brand} colorScheme={card.colorScheme} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#1D1D1F]">{card.name}</span>
                      <span className="block text-[11px] text-[#86868B]">fecha {card.closingDay || 1} · vence {card.dueDay || 10}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onManageCard(card)}
                    className="touch-min flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#86868B] hover:bg-[#F2F2F7] hover:text-[#1D1D1F]"
                    aria-label={`Ajustes do ${card.name}`}
                  >
                    <Settings2 size={15} />
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-[11px] text-[#86868B]">
                    <span>Disponível</span>
                    <span>{statement.percentUsed}% usado</span>
                  </div>
                  <Money value={statement.availableLimit} className="block text-lg font-semibold text-[#1D1D1F]" />
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F2F2F7]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${statement.percentUsed}%`, backgroundColor: statement.percentUsed > 85 ? "#E11D48" : cardAccent(card) }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[#86868B]">de <Money value={card.limit || 0} /></p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenInvoice((pending || current).key)}
                  className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl bg-[#F8F8FA] px-3 py-2.5 text-left transition-colors hover:bg-[#F2F2F7]"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[11px] text-[#86868B]">
                      Fatura de {monthName((pending || current).month)} <InvoiceStatusPill status={(pending || current).status} />
                    </span>
                    <Money value={(pending || current).outstanding || (pending || current).total} className="block text-sm font-semibold text-[#1D1D1F]" />
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[#86868B]" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <InvoiceTimelineChart cards={focused} statements={statements} onOpenInvoice={onOpenInvoice} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CategoryBreakdown cards={focused} statements={statements} />
        <CommitmentsPreview cards={focused} statements={statements} onOpenPlans={onOpenPlans} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint, onClick }: { label: string; value: number; hint: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[#F8F8FA] px-3.5 py-2.5 text-left transition-colors hover:bg-[#F2F2F7] disabled:cursor-default sm:block sm:px-3"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">{label}</span>
        <span className="block text-[10px] text-[#86868B] sm:hidden">{hint}</span>
      </span>
      <span className="shrink-0 text-right sm:text-left">
        <Money value={value} className="block text-sm font-semibold text-[#1D1D1F] sm:mt-0.5" />
        <span className="hidden text-[10px] text-[#86868B] sm:block">{hint}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Linha do tempo de faturas: barras empilhadas por cartão               */
/* ------------------------------------------------------------------ */

function InvoiceTimelineChart({
  cards,
  statements,
  onOpenInvoice,
}: {
  cards: CardItem[];
  statements: Record<string, CardStatement>;
  onOpenInvoice: (periodKey: string) => void;
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const anyStatement = cards.map((card) => statements[card.id]).find(Boolean);
  if (!anyStatement) return null;

  const baseKey = anyStatement.currentMonthKey;
  const keys = Array.from({ length: 9 }, (_, index) => shiftPeriodKey(baseKey, index - 2));
  const columns = keys.map((key) => {
    const parts = cards.map((card) => {
      const invoice = statements[card.id]?.getInvoice(key);
      return { card, value: invoice?.total || 0, invoice };
    });
    const sample = parts[0]?.invoice;
    return { key, parts, total: parts.reduce((sum, part) => sum + part.value, 0), sample };
  });
  const max = Math.max(1, ...columns.map((column) => column.total));
  const active = columns.find((column) => column.key === hoverKey) || null;

  return (
    <section className="rounded-[24px] border border-black/[0.05] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1D1D1F]">Minhas faturas</h2>
          <p className="text-xs text-[#86868B]">Cada fatura mostra os gastos do mês anterior. Toque numa barra para abrir.</p>
        </div>
        <div className="min-h-[34px] text-right">
          {active ? (
            <>
              <span className="block text-[11px] text-[#86868B]">
                Fatura de {monthName(Number(active.key.split("-")[1]) - 1)}
                {active.sample && <> · gastos de {monthNameLower(active.sample.referenceMonth)}</>}
              </span>
              <Money value={active.total} className="text-sm font-semibold text-[#1D1D1F]" />
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex h-44 items-end gap-1.5 sm:gap-2.5" onMouseLeave={() => setHoverKey(null)}>
        {columns.map((column, columnIndex) => {
          const isCurrent = column.key === baseKey;
          // No celular mostra 6 meses (1 antes, atual e 4 à frente) para alvos de toque confortáveis.
          const hiddenOnPhone = columnIndex === 0 || columnIndex === columns.length - 1;
          const isPast = column.key < baseKey;
          const height = (column.total / max) * 100;
          return (
            <button
              key={column.key}
              type="button"
              onMouseEnter={() => setHoverKey(column.key)}
              onFocus={() => setHoverKey(column.key)}
              onClick={() => onOpenInvoice(column.key)}
              className={`group h-full min-w-[32px] flex-1 cursor-pointer flex-col items-center justify-end gap-1.5 ${hiddenOnPhone ? "hidden sm:flex" : "flex"}`}
              aria-label={`Fatura de ${monthName(Number(column.key.split("-")[1]) - 1)}: R$ ${formatBRL(column.total)}`}
            >
              <div
                className={`flex w-full max-w-[44px] flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity ${
                  hoverKey && hoverKey !== column.key ? "opacity-40" : isPast ? "opacity-60" : "opacity-100"
                }`}
                style={{ height: `${Math.max(column.total > 0 ? 3 : 0, height)}%` }}
              >
                {column.parts.filter((part) => part.value > 0).map((part) => (
                  <div
                    key={part.card.id}
                    style={{ flexGrow: part.value, backgroundColor: cardAccent(part.card) }}
                    className="min-h-[2px] w-full"
                  />
                ))}
              </div>
              <span className={`text-[11px] ${isCurrent ? "font-semibold text-[#1D1D1F]" : "text-[#86868B]"}`}>
                {monthName(Number(column.key.split("-")[1]) - 1).slice(0, 3)}
              </span>
            </button>
          );
        })}
      </div>

      {active && cards.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/[0.05] pt-3">
          {active.parts.map((part) => (
            <span key={part.card.id} className="inline-flex items-center gap-1.5 text-[11px] text-[#86868B]">
              <CardDot card={part.card} size={8} /> {part.card.name} <Money value={part.value} className="text-[#1D1D1F]" />
            </span>
          ))}
        </div>
      )}
      {!active && cards.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/[0.05] pt-3">
          {cards.map((card) => (
            <span key={card.id} className="inline-flex items-center gap-1.5 text-[11px] text-[#86868B]">
              <CardDot card={card} size={8} /> {card.name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function CategoryBreakdown({ cards, statements }: { cards: CardItem[]; statements: Record<string, CardStatement> }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const map = new Map<string, { total: number; items: { title: string; amount: number; card: CardItem }[] }>();
    for (const card of cards) {
      const statement = statements[card.id];
      if (!statement) continue;
      const invoice = statement.getInvoice(statement.currentCycleKey);
      for (const charge of invoice.charges) {
        if (charge.kind === "refund") continue;
        const entry = map.get(charge.category) || { total: 0, items: [] };
        entry.total += charge.amount;
        entry.items.push({ title: charge.title, amount: charge.amount, card });
        map.set(charge.category, entry);
      }
    }
    return [...map.entries()].map(([category, data]) => ({ category, ...data })).sort((a, b) => b.total - a.total);
  }, [cards, statements]);
  const max = Math.max(1, ...rows.map((row) => row.total));
  const sample = cards.map((card) => statements[card.id]).find(Boolean);
  const reference = sample ? sample.getInvoice(sample.currentCycleKey) : null;

  return (
    <section className="rounded-[24px] border border-black/[0.05] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
      <h2 className="text-sm font-semibold text-[#1D1D1F]">Onde estou gastando</h2>
      <p className="text-xs text-[#86868B]">
        {reference ? `Fatura atual (${monthName(reference.month)}) · gastos de ${monthNameLower(reference.referenceMonth)}` : "Fatura atual"}
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-[#86868B]">Nenhuma compra na fatura atual ainda.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {rows.slice(0, 7).map((row) => (
            <li key={row.category}>
              <button
                type="button"
                onClick={() => setOpen(open === row.category ? null : row.category)}
                className="w-full cursor-pointer rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[#F8F8FA]"
                aria-expanded={open === row.category}
              >
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-[#1D1D1F]">{row.category}</span>
                  <Money value={row.total} className="shrink-0 font-semibold text-[#1D1D1F]" />
                </span>
                <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[#F2F2F7]">
                  <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(row.total / max) * 100}%` }} />
                </span>
              </button>
              {open === row.category && (
                <ul className="mb-1 ml-2 space-y-1 border-l border-black/[0.06] pl-3 animate-in fade-in duration-200">
                  {row.items.sort((a, b) => b.amount - a.amount).map((item, index) => (
                    <li key={`${item.title}-${index}`} className="flex items-center justify-between gap-2 text-[11px] text-[#86868B]">
                      <span className="flex min-w-0 items-center gap-1.5 truncate"><CardDot card={item.card} size={6} /> {item.title}</span>
                      <Money value={item.amount} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommitmentsPreview({
  cards,
  statements,
  onOpenPlans,
}: {
  cards: CardItem[];
  statements: Record<string, CardStatement>;
  onOpenPlans: () => void;
}) {
  const plans = cards.flatMap((card) => (statements[card.id]?.plans || []).map((plan) => ({ plan, card })));
  const subs = cards.flatMap((card) => (statements[card.id]?.subscriptions || []).map((sub) => ({ sub, card })));
  const endingSoon = [...plans].sort((a, b) => a.plan.remainingCount - b.plan.remainingCount).slice(0, 4);

  return (
    <section className="rounded-[24px] border border-black/[0.05] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1D1D1F]">Parcelas e assinaturas</h2>
          <p className="text-xs text-[#86868B]">{plans.length} parcelamentos · {subs.length} assinaturas</p>
        </div>
        <button type="button" onClick={onOpenPlans} className="touch-target cursor-pointer text-xs font-medium text-[#0071E3]">Ver tudo</button>
      </div>
      {endingSoon.length === 0 && subs.length === 0 ? (
        <p className="mt-4 text-xs text-[#86868B]">Nenhuma compra parcelada ou assinatura ativa.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {endingSoon.map(({ plan, card }) => (
            <li key={plan.recurringItemId} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><CalendarClock size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-xs font-medium text-[#1D1D1F]"><CardDot card={card} size={6} />{plan.title}</span>
                <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-[#F2F2F7]">
                  <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(plan.chargedCount / plan.installmentsCount) * 100}%` }} />
                </span>
              </span>
              <span className="shrink-0 text-right text-[11px] text-[#86868B]">
                {plan.chargedCount}/{plan.installmentsCount}
                <Money value={plan.remainingAmount} className="block text-xs font-semibold text-[#1D1D1F]" />
              </span>
            </li>
          ))}
          {subs.slice(0, Math.max(0, 5 - endingSoon.length)).map(({ sub, card }) => (
            <li key={sub.recurringItemId} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><Repeat size={15} /></span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs font-medium text-[#1D1D1F]"><CardDot card={card} size={6} />{sub.title}</span>
              <Money value={sub.amount} className="shrink-0 text-xs font-semibold text-[#1D1D1F]" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
