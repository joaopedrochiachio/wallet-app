"use client";

import React, { useState } from "react";
import { ChevronRight, CreditCard, Landmark, MessageCircle } from "lucide-react";
import type { FinancialAnalytics } from "@/lib/services/financialAnalyticsService";
import { Delta, brl } from "@/components/charts/finance";
import { CategoryIconTile } from "@/components/charts/categoryIcon";

/**
 * Gastos do mês até hoje por categoria (grade do kit de painéis), comparando
 * cada categoria com a média da própria pessoa no mesmo período dos meses
 * anteriores. Toque numa categoria para ver detalhes e pedir análise ao Cofi.
 */
export function SpendingBreakdown({ analytics: a, onAsk }: { analytics: FinancialAnalytics; onAsk: (prompt: string) => void }) {
  const s = a.spending;
  const [open, setOpen] = useState<string | null>(null);
  const categories = s.categories.filter((c) => c.monthToDate > 0).slice(0, 6);
  const total = s.monthToDateCash + s.monthToDateCredit;
  const creditShare = total > 0 ? (s.monthToDateCredit / total) * 100 : 0;
  const pace = s.pacePercent;

  if (s.monthToDate <= 0 && !categories.length) return null;

  return (
    <section aria-labelledby="spending-title" className="rounded-[24px] bg-[var(--ai-card)] p-4 shadow-[var(--ai-shadow)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[var(--fb-line)] pb-4">
        <div>
          <h2 id="spending-title" className="text-[13px] font-medium text-[var(--fb-text-3)]">
            Gastos de {a.monthName} até hoje
          </h2>
          <p className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-[-0.01em] [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{brl(s.monthToDate)}</p>
        </div>
        {pace !== null && (
          <div className="text-right">
            <span className="block text-[11px] text-[var(--fb-text-3)]">ritmo vs. sua média</span>
            <span className="text-base font-bold [font-variant-numeric:tabular-nums]" style={{ color: pace >= 120 ? "var(--fb-up)" : pace <= 90 ? "var(--fb-down)" : "var(--fb-text)" }}>
              {Math.round(pace)}%
            </span>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="grid grid-cols-2 gap-3 border-b border-[var(--fb-line)] py-4">
          <SplitStat icon={<Landmark size={18} strokeWidth={1.75} />} label="Na conta" value={s.monthToDateCash} share={100 - creditShare} />
          <SplitStat icon={<CreditCard size={18} strokeWidth={1.75} />} label="No cartão" value={s.monthToDateCredit} share={creditShare} />
        </div>
      )}

      {categories.length > 0 && (
        <>
          <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {categories.map((c) => {
              const isOpen = open === c.category;
              return (
                <li key={c.category} className="border-b border-[var(--fb-line)]">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : c.category)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-[8px] px-1.5 py-3.5 text-left outline-none transition-colors hover:bg-[var(--fb-card-2)] focus-visible:bg-[var(--fb-card-2)]"
                  >
                    <CategoryIconTile category={c.category} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-[var(--fb-text-3)]">{c.category}</span>
                      <span className="block text-base font-bold [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{brl(c.monthToDate)}</span>
                      {c.samePeriodAverage !== null ? <Delta value={c.changePercent} /> : <span className="text-xs text-[var(--fb-text-4)]">sem histórico</span>}
                    </span>
                    <ChevronRight size={18} className={`shrink-0 transition-transform ${isOpen ? "rotate-90 text-[var(--fb-accent)]" : "text-[var(--fb-text-5)]"}`} aria-hidden />
                  </button>
                  {isOpen && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1.5 pb-3 text-[13px] text-[var(--fb-text-2)] animate-in fade-in duration-200">
                      <span>
                        {c.count} {c.count === 1 ? "lançamento" : "lançamentos"}
                      </span>
                      {c.samePeriodAverage !== null && (
                        <span>
                          sua média: <span className="font-semibold [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{brl(c.samePeriodAverage)}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onAsk(`Analise meus gastos com ${c.category} em ${a.monthName}: o que pesou e onde dá para cortar?`)}
                        className="touch-target ml-auto inline-flex items-center gap-1 font-semibold text-[var(--fb-accent)] outline-none hover:underline focus-visible:underline"
                      >
                        <MessageCircle size={13} aria-hidden /> Analisar com o Cofi
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {categories.some((c) => c.samePeriodAverage !== null) && (
            <p className="mt-3 text-[11px] text-[var(--fb-text-4)]">*comparado à sua média no mesmo período dos meses anteriores</p>
          )}
        </>
      )}
    </section>
  );
}

function SplitStat({ icon, label, value, share }: { icon: React.ReactNode; label: string; value: number; share: number }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-[var(--fb-text-3)]" aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-[var(--fb-text-3)]">{label}</span>
        <span className="block text-base font-bold [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{brl(value)}</span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[var(--fb-compare)]" aria-hidden>
          <span className="block h-full rounded-full bg-[var(--fb-accent)]" style={{ width: `${share}%` }} />
        </span>
      </span>
    </div>
  );
}
