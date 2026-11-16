"use client";

import React, { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import type { FinancialAnalytics } from "@/lib/services/financialAnalyticsService";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}%`;

/**
 * Gastos do mês até hoje, por categoria, contra a média da própria pessoa no
 * mesmo período (o tracinho na barra). Toque numa categoria para abrir.
 */
export function SpendingBreakdown({ analytics: a, onAsk }: { analytics: FinancialAnalytics; onAsk: (prompt: string) => void }) {
  const s = a.spending;
  const [open, setOpen] = useState<string | null>(null);
  const categories = s.categories.filter((c) => c.monthToDate > 0).slice(0, 6);
  const max = Math.max(1, ...categories.map((c) => Math.max(c.monthToDate, c.samePeriodAverage ?? 0)));
  const total = s.monthToDateCash + s.monthToDateCredit;
  const creditShare = total > 0 ? (s.monthToDateCredit / total) * 100 : 0;
  const pace = s.pacePercent;

  if (s.monthToDate <= 0 && !categories.length) return null;

  return (
    <section aria-labelledby="spending-title" className="rounded-[24px] bg-[var(--ai-card)] p-4 shadow-[var(--ai-shadow)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="spending-title" className="text-[13px] font-medium text-[var(--ai-text-2)]">
            Gastos de {a.monthName} até hoje
          </h2>
          <p className="mt-0.5 text-[26px] font-semibold leading-none tracking-[-0.02em] [font-variant-numeric:tabular-nums] text-[var(--ai-text)]">{brl(s.monthToDate)}</p>
        </div>
        {pace !== null && (
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[12px] font-semibold tabular-nums ${pace >= 120 ? "bg-[var(--ai-warn-bg)] text-[var(--ai-warn)]" : pace <= 90 ? "bg-[var(--ai-good-bg)] text-[var(--ai-good)]" : "bg-[var(--ai-card-2)] text-[var(--ai-text-2)]"}`}
            title="Gastos do dia a dia em relação à sua média para esta altura do mês"
          >
            ritmo {Math.round(pace)}%
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--ai-card-2)]" aria-hidden>
            <span className="bg-[var(--ai-text)]" style={{ width: `${100 - creditShare}%` }} />
            <span className="bg-[var(--ai-accent)]" style={{ width: `${creditShare}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[12px] text-[var(--ai-text-2)]">
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--ai-text)] align-middle" aria-hidden />
              Conta <span className="font-mono tabular-nums text-[var(--ai-text)]">{brl(s.monthToDateCash)}</span>
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--ai-accent)] align-middle" aria-hidden />
              Cartão <span className="font-mono tabular-nums text-[var(--ai-text)]">{brl(s.monthToDateCredit)}</span>
            </span>
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <ul className="mt-4 space-y-1">
          {categories.map((c) => {
            const isOpen = open === c.category;
            const up = c.changePercent !== null && c.changePercent >= 20;
            return (
              <li key={c.category}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : c.category)}
                  className="w-full rounded-[12px] px-2 py-2 text-left outline-none transition-colors hover:bg-[var(--ai-card-2)] focus-visible:bg-[var(--ai-card-2)]"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--ai-text)]">{c.category}</span>
                    {c.changePercent !== null && (
                      <span className={`font-mono text-[11px] tabular-nums ${up ? "text-[var(--ai-warn)]" : c.changePercent <= -10 ? "text-[var(--ai-good)]" : "text-[var(--ai-text-3)]"}`}>{pct(c.changePercent)}</span>
                    )}
                    <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-[var(--ai-text)]">{brl(c.monthToDate)}</span>
                    <ChevronDown size={14} className={`shrink-0 text-[var(--ai-text-3)] transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                  </span>
                  <span className="relative mt-1.5 block h-1.5 rounded-full bg-[var(--ai-card-2)]" aria-hidden>
                    <span className={`absolute inset-y-0 left-0 rounded-full ${up ? "bg-[var(--ai-warn)]" : "bg-[var(--ai-accent)]"}`} style={{ width: `${(c.monthToDate / max) * 100}%` }} />
                    {c.samePeriodAverage !== null && (
                      <span className="absolute -top-1 h-3.5 w-[2px] rounded-full bg-[var(--ai-text)]" style={{ left: `calc(${(c.samePeriodAverage / max) * 100}% - 1px)` }} />
                    )}
                  </span>
                </button>
                {isOpen && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pb-2 pt-1 text-[13px] text-[var(--ai-text-2)]">
                    <span>
                      {c.count} {c.count === 1 ? "lançamento" : "lançamentos"}
                    </span>
                    {c.samePeriodAverage !== null && (
                      <span>
                        média do período <span className="font-mono tabular-nums text-[var(--ai-text)]">{brl(c.samePeriodAverage)}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onAsk(`Analise meus gastos com ${c.category} em ${a.monthName}: o que pesou e onde dá para cortar?`)}
                      className="touch-target ml-auto inline-flex items-center gap-1 font-semibold text-[var(--ai-accent)] outline-none hover:underline focus-visible:underline"
                    >
                      <MessageCircle size={13} aria-hidden /> Analisar com o Cofi
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {categories.some((c) => c.samePeriodAverage !== null) && (
        <p className="mt-2 px-2 text-[11px] text-[var(--ai-text-3)]">
          <span className="mr-1 inline-block h-2.5 w-[2px] translate-y-[1px] rounded-full bg-[var(--ai-text)]" aria-hidden />
          sua média no mesmo período dos meses anteriores
        </p>
      )}
    </section>
  );
}
