"use client";

import React, { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Repeat, Settings2, Target, Wallet } from "lucide-react";
import type { CardItem } from "@/types";
import {
  formatShortDate,
  monthName,
  monthNameLower,
  shiftPeriodKey,
  INVOICE_STATUS_LABEL,
  type CardInvoice,
  type CardStatement,
} from "@/lib/utils/creditCardEngine";
import { CardBrandLogo } from "@/components/wallet/CardBrandLogo";
import {
  AmountPill,
  BarChart,
  DateBlock,
  Delta,
  Gauge,
  Legend,
  MeterBar,
  Panel,
  PanelLink,
  brl,
  brlShort,
  type BarDatum,
} from "@/components/charts/finance";
import { CategoryIconTile } from "@/components/charts/categoryIcon";
import { cardAccent } from "./cardUi";

interface Props {
  creditCards: CardItem[];
  statements: Record<string, CardStatement>;
  /** Cartão em foco (null = todos). */
  focusId: string | null;
  onFocusChange: (cardId: string | null) => void;
  onOpenInvoice: (periodKey: string, cardId?: string) => void;
  onOpenPlans: () => void;
  onManageCard: (card: CardItem) => void;
}

export function CardsDashboard({ creditCards, statements, focusId, onFocusChange, onOpenInvoice, onOpenPlans, onManageCard }: Props) {
  const focused = focusId ? creditCards.filter((card) => card.id === focusId) : creditCards;
  const list = focused.map((card) => ({ card, s: statements[card.id] })).filter((entry) => entry.s);

  const totals = useMemo(() => {
    const limit = list.reduce((sum, { card }) => sum + (card.limit || 0), 0);
    const used = list.reduce((sum, { s }) => sum + s.usedLimit, 0);
    const due = list.reduce((sum, { s }) => sum + s.amountDue, 0);
    return { limit, used, due, available: Math.max(0, limit - used) };
  }, [list]);

  const upcoming = useMemo(() => {
    const items: { card: CardItem; invoice: CardInvoice }[] = [];
    for (const { card, s } of list) {
      const unpaid = s.invoices.filter((invoice) => invoice.outstanding > 0.005 && invoice.key <= s.currentCycleKey);
      const current = s.getInvoice(s.currentCycleKey);
      const chosen = unpaid.length > 0 ? unpaid : current.total > 0 ? [current] : [];
      for (const invoice of chosen) items.push({ card, invoice });
    }
    return items.sort((a, b) => a.invoice.dueDate.getTime() - b.invoice.dueDate.getTime());
  }, [list]);

  const nextDue = upcoming.find((entry) => entry.invoice.outstanding > 0.005);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <CardCarousel
        creditCards={creditCards}
        statements={statements}
        focusId={focusId}
        onFocusChange={onFocusChange}
        onManageCard={onManageCard}
        onOpenInvoice={onOpenInvoice}
      />

      {/* Quanto ainda posso gastar */}
      <Panel title="Limite">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--fb-line)] pb-3">
          <span className="text-[22px] font-extrabold leading-8 [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{brl(totals.available)}</span>
          <span className="text-sm font-medium text-[var(--fb-text-2)]">disponível</span>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <Stat icon={<Wallet size={20} strokeWidth={1.75} />} label="Em uso" value={brl(totals.used)} />
            <Stat
              icon={<Target size={20} strokeWidth={1.75} />}
              label={nextDue ? `A pagar até ${formatShortDate(nextDue.invoice.dueDate)}` : "A pagar"}
              value={brl(totals.due)}
            />
          </div>
          <Gauge
            value={totals.used}
            max={totals.limit}
            size={132}
            minLabel="R$ 0"
            maxLabel={brlShort(totals.limit)}
            centerLabel={`${totals.limit > 0 ? Math.round((totals.used / totals.limit) * 100) : 0}%`}
            caption="do limite usado"
          />
        </div>
      </Panel>

      {/* O que tenho para pagar */}
      <Panel title="Próximas faturas">
        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--fb-text-3)]">Nenhuma fatura a pagar agora.</p>
        ) : (
          <ul className="-my-1">
            {upcoming.slice(0, 3).map(({ card, invoice }) => {
              const overdue = invoice.status === "overdue";
              return (
                <li key={`${card.id}-${invoice.key}`} className="border-b border-[var(--fb-line)] last:border-0">
                  <button
                    type="button"
                    onClick={() => onOpenInvoice(invoice.key, card.id)}
                    className="flex w-full cursor-pointer items-center gap-3 py-3 text-left"
                  >
                    <DateBlock date={invoice.dueDate} tone={overdue ? "danger" : "neutral"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-[var(--fb-text-3)]">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cardAccent(card) }} aria-hidden />
                        {card.name}
                      </span>
                      <span className="block truncate text-[15px] font-bold leading-6 text-[var(--fb-text-2)]">
                        {monthName(invoice.month)}
                      </span>
                      <span className="block truncate text-xs text-[var(--fb-text-4)]">
                        {overdue ? "Venceu — falta pagar" : `gastos de ${monthNameLower(invoice.referenceMonth)}`}
                      </span>
                    </span>
                    <AmountPill value={invoice.outstanding || invoice.total} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <InvoiceHistory list={list} onOpenInvoice={onOpenInvoice} className="lg:col-span-2" />
      <CommitmentsPanel list={list} onOpenPlans={onOpenPlans} />
      <CategoryBreakdown list={list} className="lg:col-span-3" />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[var(--fb-text-3)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-[var(--fb-text-3)]">{label}</span>
        <span className="block truncate text-base font-bold [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{value}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Carrossel de cartões (como o "Total Balance" do kit)                 */
/* ------------------------------------------------------------------ */

function CardCarousel({
  creditCards,
  statements,
  focusId,
  onFocusChange,
  onManageCard,
  onOpenInvoice,
}: {
  creditCards: CardItem[];
  statements: Record<string, CardStatement>;
  focusId: string | null;
  onFocusChange: (cardId: string | null) => void;
  onManageCard: (card: CardItem) => void;
  onOpenInvoice: (periodKey: string, cardId?: string) => void;
}) {
  const slides: (CardItem | null)[] = creditCards.length > 1 ? [null, ...creditCards] : creditCards;
  const index = Math.max(0, slides.findIndex((slide) => (slide?.id ?? null) === focusId));
  const card = slides[index];
  const go = (delta: number) => {
    const next = slides[(index + delta + slides.length) % slides.length];
    onFocusChange(next?.id ?? null);
  };

  const totalLimit = creditCards.reduce((sum, item) => sum + (item.limit || 0), 0);
  const totalUsed = creditCards.reduce((sum, item) => sum + (statements[item.id]?.usedLimit || 0), 0);
  const statement = card ? statements[card.id] : undefined;
  const current = statement ? statement.getInvoice(statement.currentCycleKey) : null;
  const used = card ? statement?.usedLimit || 0 : totalUsed;
  const limit = card ? card.limit || 0 : totalLimit;
  const accent = card ? cardAccent(card) : "var(--fb-accent)";
  // Número do topo: a fatura atual (o limite já aparece no painel ao lado).
  const currentKey = statement?.currentCycleKey ?? Object.values(statements)[0]?.currentCycleKey;
  const invoiceTotal = card
    ? current?.total ?? 0
    : creditCards.reduce((sum, item) => sum + (currentKey ? statements[item.id]?.getInvoice(currentKey).total ?? 0 : 0), 0);
  const invoiceMonth = currentKey ? monthName(Number(currentKey.split("-")[1]) - 1) : "";

  return (
    <Panel title={card ? card.name : "Meus cartões"}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--fb-line)] pb-3">
        <span className="text-[22px] font-extrabold leading-8 [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{brl(invoiceTotal)}</span>
        <span className="text-sm font-medium text-[var(--fb-text-2)]">fatura de {invoiceMonth}</span>
      </div>

      <div
        className="relative mt-4 overflow-hidden rounded-[8px] px-4 py-3.5 text-white"
        style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #000))` }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block text-xs text-white/70">{card ? "Cartão de crédito" : "Todos os cartões"}</span>
            <span className="block truncate text-base font-semibold">{card ? card.name : "Visão geral"}</span>
          </span>
          {card && (
            <span className="flex shrink-0 items-center gap-2">
              <CardBrandLogo brand={card.brand} className="h-6" />
              <button
                type="button"
                onClick={() => onManageCard(card)}
                className="touch-target flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                aria-label={`Ajustes do ${card.name}`}
              >
                <Settings2 size={14} />
              </button>
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2 text-xs text-white/80">
          <span>{card ? `fecha dia ${card.closingDay || 1} · vence dia ${card.dueDay || 10}` : `limite total ${brl(limit)}`}</span>
          {card && current && (
            <button
              type="button"
              onClick={() => onOpenInvoice(current.key, card.id)}
              className="touch-target cursor-pointer rounded-full bg-white/15 px-2.5 py-1 font-semibold text-white hover:bg-white/25"
            >
              Fatura {brl(current.outstanding || current.total)}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between gap-2 text-xs text-[var(--fb-text-3)]">
          <span>Limite usado</span>
          <span className="[font-variant-numeric:tabular-nums]">{brl(used)} de {brl(limit)}</span>
        </div>
        <MeterBar value={used} max={limit} />
        {card && statement && statement.limitBreakdown.length > 0 && (
          <ul className="space-y-1 pt-1.5 text-xs text-[var(--fb-text-3)]" aria-label="De onde vem o limite usado">
            {statement.limitBreakdown.map((part) => {
              const pastDue = part.status === "overdue" || part.status === "closed";
              return (
                <li key={part.key}>
                  <button
                    type="button"
                    onClick={() => onOpenInvoice(part.key, card.id)}
                    className="flex w-full cursor-pointer justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-[var(--fb-compare)]"
                  >
                    <span className={pastDue ? "font-medium text-amber-700" : undefined}>
                      Fatura de {monthNameLower(Number(part.key.split("-")[1]) - 1)} · {INVOICE_STATUS_LABEL[part.status].toLowerCase()}
                      {part.status === "future" && " (parcelas)"}
                    </span>
                    <span className="[font-variant-numeric:tabular-nums]">{brl(part.amount)}</span>
                  </button>
                </li>
              );
            })}
            {statement.limitBreakdown.some((part) => part.status === "overdue" || part.status === "closed") && (
              <li className="px-1 pt-0.5 text-amber-700">
                Já pagou essa fatura no banco? Abra e toque em &quot;Paguei a fatura&quot; para liberar o limite.
              </li>
            )}
          </ul>
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={() => go(-1)} className="touch-target flex cursor-pointer items-center gap-1 text-sm text-[var(--fb-text-3)] hover:text-[var(--fb-text)]">
            <ChevronLeft size={16} /> Anterior
          </button>
          <span className="flex gap-2" aria-hidden>
            {slides.map((slide, dot) => (
              <span key={slide?.id ?? "all"} className="h-2 w-2 rounded-full transition-colors" style={{ backgroundColor: dot === index ? "var(--fb-accent)" : "var(--fb-compare)" }} />
            ))}
          </span>
          <button type="button" onClick={() => go(1)} className="touch-target flex cursor-pointer items-center gap-1 text-sm font-medium text-[var(--fb-text)]">
            Próximo <ChevronRight size={16} />
          </button>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function InvoiceHistory({
  list,
  onOpenInvoice,
  className = "",
}: {
  list: { card: CardItem; s: CardStatement }[];
  onOpenInvoice: (periodKey: string, cardId?: string) => void;
  className?: string;
}) {
  const base = list[0]?.s.currentMonthKey;
  if (!base) return null;
  const current = list[0].s.currentCycleKey;
  const keys = Array.from({ length: 9 }, (_, i) => shiftPeriodKey(base, i - 3));

  const data: BarDatum[] = keys.map((key) => {
    const parts = list.map(({ card, s }) => ({ card, invoice: s.getInvoice(key) }));
    const total = parts.reduce((sum, part) => sum + part.invoice.total, 0);
    const sample = parts[0]?.invoice;
    const month = Number(key.split("-")[1]) - 1;
    return {
      key,
      label: monthName(month).slice(0, 3),
      value: total,
      state: key < current ? "past" : key === current ? "current" : "future",
      tooltip: (
        <>
          <span className="font-medium text-[var(--fb-text)]">
            Fatura de {monthName(month)}
            {sample && <span className="font-normal text-[var(--fb-text-3)]"> · gastos de {monthNameLower(sample.referenceMonth)}</span>}
          </span>
          <span className="flex flex-wrap gap-x-3 [font-variant-numeric:tabular-nums]">
            {list.length > 1 && parts.filter((p) => p.invoice.total > 0).map((p) => (
              <span key={p.card.id}>{p.card.name} {brl(p.invoice.total)}</span>
            ))}
            <strong className="text-[var(--fb-text)]">{brl(total)}</strong>
          </span>
        </>
      ),
    };
  });

  return (
    <Panel title="Faturas mês a mês" className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-base font-semibold text-[var(--fb-text)]">Valor de cada fatura</span>
        <Legend items={[
          { label: "Fechadas", color: "var(--fb-compare)" },
          { label: "Atual", color: "var(--fb-accent)" },
          { label: "Previstas", color: "var(--fb-accent-2)" },
        ]} />
      </div>
      <BarChart data={data} height={210} onSelect={(key) => onOpenInvoice(key, list.length === 1 ? list[0].card.id : undefined)} />
    </Panel>
  );
}

function CommitmentsPanel({ list, onOpenPlans }: { list: { card: CardItem; s: CardStatement }[]; onOpenPlans: () => void }) {
  const [tab, setTab] = useState<"plans" | "subs">("plans");
  const plans = list.flatMap(({ card, s }) => s.plans.map((plan) => ({ card, plan })))
    .sort((a, b) => a.plan.remainingCount - b.plan.remainingCount);
  const subs = list.flatMap(({ card, s }) => s.subscriptions.map((sub) => ({ card, sub })));

  return (
    <Panel title="Compromissos" action={<PanelLink onClick={onOpenPlans}>Ver tudo</PanelLink>}>
      <div className="mb-1 flex gap-5 border-b border-[var(--fb-line)]" role="tablist">
        {([["plans", `Parcelas (${plans.length})`], ["subs", `Assinaturas (${subs.length})`]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px cursor-pointer border-b-2 px-1 pb-2.5 text-sm font-semibold transition-colors ${
              tab === id ? "border-[var(--fb-accent)] text-[var(--fb-accent)]" : "border-transparent text-[var(--fb-text-2)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul>
        {tab === "plans" && plans.slice(0, 4).map(({ card, plan }) => (
          <li key={plan.recurringItemId} className="flex items-center gap-3 border-b border-[var(--fb-line)] py-3 last:border-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--fb-card-2)] text-[var(--fb-text-3)]"><CalendarClock size={18} strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--fb-text)]">{plan.title}</span>
              <span className="block truncate text-xs text-[var(--fb-text-4)]">{card.name} · {plan.chargedCount}/{plan.installmentsCount} cobradas</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{brl(plan.remainingAmount)}</span>
              <span className="block text-xs text-[var(--fb-text-4)]">faltam {plan.remainingCount}</span>
            </span>
          </li>
        ))}
        {tab === "subs" && subs.slice(0, 4).map(({ card, sub }) => (
          <li key={sub.recurringItemId} className="flex items-center gap-3 border-b border-[var(--fb-line)] py-3 last:border-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--fb-card-2)] text-[var(--fb-text-3)]"><Repeat size={18} strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--fb-text)]">{sub.title}</span>
              <span className="block truncate text-xs text-[var(--fb-text-4)]">
                {card.name}{sub.nextCharge && ` · próxima ${formatShortDate(sub.nextCharge.chargeDate)}`}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{brl(sub.amount)}</span>
          </li>
        ))}
        {((tab === "plans" && plans.length === 0) || (tab === "subs" && subs.length === 0)) && (
          <li className="py-6 text-center text-sm text-[var(--fb-text-3)]">
            {tab === "plans" ? "Nenhuma compra parcelada em andamento." : "Nenhuma assinatura no cartão."}
          </li>
        )}
      </ul>
    </Panel>
  );
}

function CategoryBreakdown({ list, className = "" }: { list: { card: CardItem; s: CardStatement }[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const sample = list[0]?.s;
  const rows = useMemo(() => {
    if (!sample) return [];
    const currentKey = sample.currentCycleKey;
    const previousKey = shiftPeriodKey(currentKey, -1);
    const sum = (key: string) => {
      const map = new Map<string, { total: number; items: { title: string; amount: number; card: CardItem }[] }>();
      for (const { card, s } of list) {
        for (const charge of s.getInvoice(key).charges) {
          if (charge.kind === "refund") continue;
          const entry = map.get(charge.category) || { total: 0, items: [] };
          entry.total += charge.amount;
          entry.items.push({ title: charge.title, amount: charge.amount, card });
          map.set(charge.category, entry);
        }
      }
      return map;
    };
    const now = sum(currentKey);
    const before = sum(previousKey);
    return [...now.entries()]
      .map(([category, data]) => {
        const previous = before.get(category)?.total ?? 0;
        return { category, ...data, delta: previous > 0 ? ((data.total - previous) / previous) * 100 : null };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [list, sample]);

  if (!sample) return null;
  const invoice = sample.getInvoice(sample.currentCycleKey);

  return (
    <Panel
      title="Onde estou gastando"
      className={className}
      action={<span className="pb-1.5 text-xs text-[var(--fb-text-3)]">*comparado à fatura anterior</span>}
    >
      <p className="mb-2 text-sm font-semibold text-[var(--fb-text)]">
        Fatura de {monthName(invoice.month)} <span className="font-normal text-[var(--fb-text-3)]">· gastos de {monthNameLower(invoice.referenceMonth)}</span>
      </p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--fb-text-3)]">Nenhuma compra na fatura atual ainda.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <li key={row.category} className="border-b border-[var(--fb-line)]">
              <button
                type="button"
                onClick={() => setOpen(open === row.category ? null : row.category)}
                aria-expanded={open === row.category}
                className="flex w-full cursor-pointer items-center gap-3 rounded-[8px] px-2 py-4 text-left transition-colors hover:bg-[var(--fb-card-2)]"
              >
                <CategoryIconTile category={row.category} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-[var(--fb-text-3)]">{row.category}</span>
                  <span className="block text-base font-bold [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{brl(row.total)}</span>
                  <Delta value={row.delta} />
                </span>
                <ChevronRight size={18} className={`shrink-0 transition-transform ${open === row.category ? "rotate-90 text-[var(--fb-accent)]" : "text-[var(--fb-text-5)]"}`} />
              </button>
              {open === row.category && (
                <ul className="space-y-1.5 px-2 pb-4 animate-in fade-in duration-200">
                  {row.items.sort((a, b) => b.amount - a.amount).slice(0, 6).map((item, index) => (
                    <li key={`${item.title}-${index}`} className="flex items-center justify-between gap-2 text-xs text-[var(--fb-text-2)]">
                      <span className="truncate">{item.title}{list.length > 1 && <span className="text-[var(--fb-text-4)]"> · {item.card.name}</span>}</span>
                      <span className="shrink-0 [font-variant-numeric:tabular-nums]">{brl(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
