"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useCalendarDay } from "@/lib/hooks/useCalendarDay";
import { buildCashRunway, collectRunwayEvents, type RunwaySegment } from "@/lib/services/cashRunway";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = (date: Date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
const dayBefore = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);

/**
 * "Dá pra pagar?": testa, trecho a trecho entre recebimentos, se o saldo da
 * conta corrente cobre todas as contas e faturas que vencem até o próximo
 * dinheiro entrar.
 */
export function CashRunwayCard() {
  const { cards, recurringItems, transactions, goals } = useWallet();
  const todayTime = useCalendarDay().getTime();

  const runway = useMemo(() => {
    const today = new Date(todayTime);
    const startBalance = cards
      .filter((card) => card.type === "checking")
      .reduce((sum, card) => sum + (card.balance || 0), 0);
    const events = collectRunwayEvents({ cards, recurringItems, transactions, goals, today, monthsAhead: 1 });
    return buildCashRunway({
      startBalance,
      events,
      today,
      horizonEnd: new Date(today.getFullYear(), today.getMonth() + 2, 1),
    });
  }, [cards, recurringItems, transactions, goals, todayTime]);

  if (!cards.some((card) => card.type === "checking")) return null;
  const horizonLast = dayBefore(runway.segments[runway.segments.length - 1].endDate);
  const problem = runway.firstUncovered;

  return (
    <section
      data-testid="cash-runway"
      className="space-y-4 rounded-[22px] border border-black/[0.04] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.02)] sm:p-5"
    >
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight text-[#1D1D1F]">Dá pra pagar?</h3>
          <Link href="/simulate" className="touch-target inline-flex items-center gap-1 text-xs font-semibold text-[var(--fb-accent)]">
            E se…? Simular <ChevronRight size={14} />
          </Link>
        </div>
        {problem ? (
          <p className="flex items-start gap-1.5 text-sm text-rose-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Em <strong>{shortDate(problem.event.date)}</strong> o saldo não cobre <strong>{problem.event.title}</strong>.
              Faltam <strong className="font-mono tabular-nums">{money(-problem.balanceAfter)}</strong> nesse dia.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>
              Sim. Com o saldo de hoje e o que vai entrar, tudo o que vence até {shortDate(horizonLast)} fica pago.
              Menor saldo: <strong className="font-mono tabular-nums">{money(runway.lowestBalance)}</strong> em {shortDate(runway.lowestDate)}.
            </span>
          </p>
        )}
      </header>

      <ol className="space-y-2.5">
        {runway.segments.map((segment, index) => (
          <SegmentRow key={segment.startDate.getTime()} segment={segment} isFirst={index === 0} />
        ))}
      </ol>
    </section>
  );
}

function SegmentRow({ segment, isFirst }: { segment: RunwaySegment; isFirst: boolean }) {
  const [open, setOpen] = useState(Boolean(segment.firstUncovered));
  const last = dayBefore(segment.endDate);
  const ok = !segment.firstUncovered;
  const available = segment.openingBalance + segment.incomeTotal;
  const title = isFirst
    ? `Hoje até ${shortDate(last)}`
    : `${shortDate(segment.startDate)} · ${segment.incomes.map((income) => income.title).join(" + ")}`;

  return (
    <li className={`rounded-2xl border ${ok ? "border-black/[0.06]" : "border-rose-200 bg-rose-50/40"}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[#1D1D1F]">{title}</span>
          <span className="block text-xs text-[#86868B]">
            {isFirst ? "Saldo hoje" : `Saldo ${money(segment.openingBalance)} + entrada`}{" "}
            <span className="font-mono tabular-nums text-[#1D1D1F]">{money(isFirst ? segment.openingBalance : segment.incomeTotal)}</span>
            {" · "}
            {segment.bills.length === 0 ? "nenhuma conta até " + shortDate(last) : `${segment.bills.length} ${segment.bills.length === 1 ? "conta" : "contas"} `}
            {segment.bills.length > 0 && <span className="font-mono tabular-nums text-[#1D1D1F]">{money(segment.billsTotal)}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-right">
            <span className={`block text-sm font-semibold font-mono tabular-nums ${ok ? "text-emerald-700" : "text-rose-700"}`}>
              {ok ? money(segment.closingBalance) : `− ${money(segment.shortfall)}`}
            </span>
            <span className="block text-[10px] text-[#86868B]">{ok ? "sobra" : "falta"}</span>
          </span>
          <ChevronDown size={16} className={`text-[#86868B] transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-black/[0.05] px-3.5 py-3 text-xs">
          <Line label={isFirst ? "Saldo hoje" : "Saldo antes do recebimento"} value={money(segment.openingBalance)} />
          {segment.incomes.map((income) => (
            <Line key={income.id} label={`+ ${income.title}${income.overdue ? " (atrasado)" : ""}`} value={money(income.amount)} tone="text-emerald-700" />
          ))}
          {!isFirst && <Line label="Disponível" value={money(available)} strong />}
          {segment.bills.map((bill) => {
            const isProblem = segment.firstUncovered?.event.id === bill.id;
            return (
              <Line
                key={bill.id}
                label={`${shortDate(bill.date)} · ${bill.title}${bill.overdue ? " (atrasada)" : ""}${bill.coveredByGoals > 0 ? ` · meta cobre ${money(bill.coveredByGoals)}` : ""}`}
                value={`− ${money(bill.amount)}`}
                tone={isProblem ? "text-rose-700 font-semibold" : undefined}
              />
            );
          })}
          <Line
            label={ok ? `Sobra em ${shortDate(last)}` : `Saldo em ${shortDate(last)}`}
            value={money(segment.closingBalance)}
            strong
            tone={segment.closingBalance < 0 ? "text-rose-700" : "text-emerald-700"}
          />
          {!ok && segment.firstUncovered && (
            <p className="pt-1 text-rose-700">
              Para pagar tudo deste trecho faltam {money(segment.shortfall)}. A primeira conta que não cabe é {segment.firstUncovered.event.title} em {shortDate(segment.firstUncovered.event.date)}.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold text-[#1D1D1F]" : "text-[#86868B]"}`}>
      <span className="min-w-0 break-words">{label}</span>
      <span className={`shrink-0 font-mono tabular-nums ${tone ?? (strong ? "text-[#1D1D1F]" : "text-[#1D1D1F]")}`}>{value}</span>
    </div>
  );
}
