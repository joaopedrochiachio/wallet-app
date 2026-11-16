"use client";

import React, { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Gauge, MessageCircle, Pencil } from "lucide-react";
import type { FinancialAnalytics, TimelineEvent } from "@/lib/services/financialAnalyticsService";
import type { SpendingGuidance } from "@/lib/services/spendingGuidance";
import { buildCashSeries } from "@/lib/services/moneyViews";
import { CashFlowChart, weekdayOf } from "./CashFlowChart";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plain = (n: number) => Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Lens = "dia" | "in" | "out";

/**
 * O dinheiro da pessoa, de verdade: quanto tem hoje, o que entra, o que sai e
 * como o saldo se comporta dia a dia até o fim do mês. Tudo calculado no app
 * (mesma conta do Planejamento), sem chamar a IA.
 */
export function MoneyOverview({
  analytics: a,
  guidance,
  target,
  onSaveTarget,
  onAsk,
}: {
  analytics: FinancialAnalytics;
  guidance: SpendingGuidance;
  target: number;
  onSaveTarget: (value: number) => void;
  onAsk: (prompt: string) => void;
}) {
  const series = useMemo(() => buildCashSeries(a), [a]);
  const [year, monthIndex] = useMemo(() => {
    const [y, m] = a.referenceDate.split("-").map(Number);
    return [y, (m || 1) - 1];
  }, [a.referenceDate]);

  // Dia inicial: o pior dia se a conta fica negativa; senão o próximo dia com movimento
  const defaultDay = useMemo(() => {
    if (a.timeline.negativeFromDay !== null) return a.timeline.lowestDay;
    return series.find((p) => p.events.length && p.day > a.day)?.day ?? series[0]?.day ?? a.day;
  }, [a, series]);
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const selectedDay = pickedDay ?? defaultDay;
  const [lens, setLens] = useState<Lens>("dia");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const close = a.cash.projectedClose;
  const gap = close - target;
  const selected = series.find((p) => p.day === selectedDay);
  const upcoming = (dir: "in" | "out") => a.timeline.events.filter((e) => e.direction === dir).sort((x, y) => x.day - y.day);
  const tone = close < 0 ? "bad" : gap < 0 ? "warn" : "good";
  const toneText = { good: "text-[var(--ai-good)]", warn: "text-[var(--ai-warn)]", bad: "text-[var(--ai-bad)]" }[tone];

  const dayLabel = (day: number) => (day === a.day ? "Hoje" : `${weekdayOf(year, monthIndex, day)}, ${day} de ${a.monthName}`);

  return (
    <section aria-labelledby="money-title" className="rounded-[24px] bg-[var(--ai-card)] p-4 shadow-[var(--ai-shadow)] sm:p-6">
      {/* Fechamento previsto */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id="money-title" className="text-[13px] font-medium text-[var(--ai-text-2)]">
            Fecha {a.monthName} com
          </h2>
          <p className={`mt-0.5 text-[34px] font-semibold leading-none tracking-[-0.03em] [font-variant-numeric:tabular-nums] sm:text-[44px] ${close < 0 ? "text-[var(--ai-bad)]" : "text-[var(--ai-text)]"}`}>{brl(close)}</p>
        </div>

        {editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseFloat(draft.replace(/\./g, "").replace(",", "."));
              if (!Number.isNaN(n) && n >= 0) onSaveTarget(n);
              setEditing(false);
            }}
          >
            <label className="sr-only" htmlFor="target-input">
              Meta de saldo no fim do mês
            </label>
            <input
              id="target-input"
              inputMode="decimal"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => setEditing(false)}
              className="h-9 w-28 rounded-full border border-[var(--ai-line)] bg-[var(--ai-card-2)] px-3 font-mono text-[15px] tabular-nums text-[var(--ai-text)] outline-none focus:border-[var(--ai-accent)]"
            />
            <button type="submit" onMouseDown={(e) => e.preventDefault()} aria-label="Salvar meta" className="touch-min flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ai-text)] text-[var(--ai-card)]">
              <Check size={16} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(target).replace(".", ","));
              setEditing(true);
            }}
            aria-label={`Editar meta: ${brl(target)}`}
            className="touch-target group inline-flex items-center gap-2 rounded-full bg-[var(--ai-card-2)] px-3 py-1.5 text-[13px] outline-none focus-visible:shadow-[var(--mac-focus-ring)]"
          >
            <span className="text-[var(--ai-text-2)]">Meta {brl(target)}</span>
            <span className={`font-semibold tabular-nums ${toneText}`}>{gap >= 0 ? `+${plain(gap)}` : `−${plain(gap)}`}</span>
            <Pencil size={12} className="text-[var(--ai-text-3)] group-hover:text-[var(--ai-text)]" aria-hidden />
          </button>
        )}
      </div>

      {/* A conta do fechamento: cada termo é um botão */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-1 sm:gap-2" role="group" aria-label="De onde vem o fechamento">
        <Term active={lens === "dia"} onClick={() => setLens("dia")} label="Hoje" value={plain(a.cash.balanceToday)} negative={a.cash.balanceToday < 0} />
        <Operator>+</Operator>
        <Term active={lens === "in"} onClick={() => setLens("in")} label="Entra" value={plain(a.cash.toReceive)} tone="good" icon={<ArrowDownLeft size={12} />} />
        <Operator>−</Operator>
        <Term active={lens === "out"} onClick={() => setLens("out")} label="Sai" value={plain(a.cash.toPay)} icon={<ArrowUpRight size={12} />} />
      </div>

      {/* Saldo dia a dia */}
      <div className="mt-5">
        <CashFlowChart
          series={series}
          target={target}
          year={year}
          monthIndex={monthIndex}
          selectedDay={selectedDay}
          onSelectDay={(d) => {
            setPickedDay(d);
            setLens("dia");
          }}
          highlight={lens === "dia" ? null : lens}
        />
      </div>

      {/* Conferência: a linha do tempo precisa fechar no mesmo valor do Planejamento */}
      {Math.abs(series[series.length - 1].balance - close) > 1 && (
        <p className="mt-2 rounded-[12px] bg-[var(--ai-warn-bg)] px-3 py-2 text-[12px] leading-[1.45] text-[var(--ai-warn)]">
          <span className="font-semibold">Conferência:</span> a linha do tempo termina em <span className="font-mono tabular-nums">{brl(series[series.length - 1].balance)}</span> e o Planejamento fecha em{" "}
          <span className="font-mono tabular-nums">{brl(close)}</span>. Diferença de <span className="font-mono tabular-nums">{brl(Math.abs(series[series.length - 1].balance - close))}</span>: confira contas e entradas sem data ou já pagas.
        </p>
      )}

      {/* Detalhe da lente escolhida */}
      <div className="mt-3 min-h-[64px]" aria-live="polite">
        {lens === "dia" && selected && (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-semibold text-[var(--ai-text)] first-letter:uppercase">{dayLabel(selected.day)}</p>
              <p className={`font-mono text-[14px] font-semibold tabular-nums ${selected.balance < 0 ? "text-[var(--ai-bad)]" : "text-[var(--ai-text)]"}`}>{brl(selected.balance)}</p>
            </div>
            {selected.events.length ? (
              <EventList events={selected.events} />
            ) : (
              <p className="mt-1 text-[13px] text-[var(--ai-text-3)]">Nada entra nem vence neste dia.</p>
            )}
          </div>
        )}
        {lens !== "dia" && (
          <div>
            {upcoming(lens).length ? (
              <EventList
                events={upcoming(lens)}
                showDay
                onPickDay={(d) => {
                  setPickedDay(d);
                  setLens("dia");
                }}
              />
            ) : (
              <p className="text-[13px] text-[var(--ai-text-3)]">{lens === "in" ? "Nenhuma entrada prevista até o fim do mês." : "Nenhuma conta prevista até o fim do mês."}</p>
            )}
          </div>
        )}
      </div>

      {/* Quanto dá para gastar (orientação calculada pelo app) */}
      <button
        type="button"
        onClick={() => onAsk(`Quanto eu posso gastar até o dia ${guidance.untilDay} sem me apertar? Mostre a conta.`)}
        className="group mt-3 flex w-full items-center gap-3 rounded-[16px] bg-[var(--ai-card-2)] px-3.5 py-3 text-left outline-none focus-visible:shadow-[var(--mac-focus-ring)]"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${guidance.mode === "livre" ? "bg-[var(--ai-good-bg)] text-[var(--ai-good)]" : guidance.mode === "pausa" ? "bg-[var(--ai-bad-bg)] text-[var(--ai-bad)]" : "bg-[var(--ai-warn-bg)] text-[var(--ai-warn)]"}`} aria-hidden>
          <Gauge size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-[var(--ai-text)]">{guidance.headline}</span>
          <span className="block text-[12px] text-[var(--ai-text-2)]">{guidance.untilLabel}</span>
        </span>
        <MessageCircle size={16} className="shrink-0 text-[var(--ai-text-3)] transition-colors group-hover:text-[var(--ai-accent)]" aria-hidden />
      </button>
    </section>
  );
}

function Operator({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center justify-center font-mono text-[16px] text-[var(--ai-text-3)]" aria-hidden>
      {children}
    </span>
  );
}

function Term({
  active,
  onClick,
  label,
  value,
  tone,
  icon,
  negative,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: string;
  tone?: "good";
  icon?: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`touch-min min-w-0 rounded-[14px] px-2 py-2 text-left outline-none transition-colors focus-visible:shadow-[var(--mac-focus-ring)] sm:px-3 ${active ? "bg-[var(--ai-accent-bg)] ring-1 ring-[var(--ai-accent)]/40" : "bg-[var(--ai-card-2)] hover:bg-[var(--ai-line)]"}`}
    >
      <span className={`flex items-center gap-1 text-[11px] font-medium ${active ? "text-[var(--ai-accent)]" : "text-[var(--ai-text-2)]"}`}>
        {icon}
        {label}
      </span>
      <span className={`block truncate font-mono text-[13px] font-semibold tabular-nums sm:text-[15px] ${negative ? "text-[var(--ai-bad)]" : tone === "good" ? "text-[var(--ai-good)]" : "text-[var(--ai-text)]"}`}>
        {negative ? "−" : ""}
        {value}
      </span>
    </button>
  );
}

function EventList({ events, showDay, onPickDay }: { events: TimelineEvent[]; showDay?: boolean; onPickDay?: (day: number) => void }) {
  return (
    <ul className="mt-1.5 divide-y divide-[var(--ai-line)]">
      {events.slice(0, 8).map((e, i) => {
        const content = (
          <>
            {showDay && <span className="w-10 shrink-0 font-mono text-[12px] tabular-nums text-[var(--ai-text-3)]">dia {e.day}</span>}
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.direction === "in" ? "bg-[var(--ai-good)]" : "bg-[var(--ai-text-3)]"}`} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--ai-text)]">{e.title}</span>
            <span className={`shrink-0 font-mono text-[13px] tabular-nums ${e.direction === "in" ? "text-[var(--ai-good)]" : "text-[var(--ai-text)]"}`}>
              {e.direction === "in" ? "+" : "−"}
              {plain(e.amount)}
            </span>
          </>
        );
        return (
          <li key={`${e.day}-${e.title}-${i}`}>
            {onPickDay ? (
              <button type="button" onClick={() => onPickDay(e.day)} className="flex w-full items-center gap-2.5 py-2 text-left outline-none hover:opacity-80 focus-visible:bg-[var(--ai-card-2)]">
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-2.5 py-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
