"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Copy, TrendingUp } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useCalendarDay } from "@/lib/hooks/useCalendarDay";
import { buildRecurringRadar, radarWeight, type RadarAlert } from "@/lib/services/recurringRadar";
import { Panel, brl } from "@/components/charts/finance";
import { CardDot } from "@/components/cards/cardUi";

const periodLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", " ");
};

export default function RadarPage() {
  const { recurringItems, cards } = useWallet();
  const todayTime = useCalendarDay().getTime();
  const radar = useMemo(
    () => buildRecurringRadar({ recurringItems, cards, today: new Date(todayTime) }),
    [recurringItems, cards, todayTime]
  );
  const monthly = radar.fixedMonthly + radar.installmentsMonthly;
  const topYear = radar.costs[0] ? radarWeight(radar.costs[0]) : 0;
  const income = radar.monthlyIncome;
  // A barra mede contra a renda; sem renda cadastrada, contra o próprio total.
  const scale = Math.max(income, monthly, 0.01);
  const pct = (value: number) => Math.max(0, (value / scale) * 100);
  const lastInstallment = radar.costs
    .filter((cost) => cost.kind === "installment" && cost.lastPeriodKey)
    .map((cost) => cost.lastPeriodKey as string)
    .sort()
    .pop();
  const cumulativeRelief = radar.relief.map((_, index) =>
    radar.relief.slice(0, index + 1).reduce((sum, relief) => sum + relief.amount, 0));

  return (
    <div className="min-h-full space-y-5 bg-[#F2F2F7] p-4 font-sans text-[#1D1D1F] animate-in fade-in duration-500 sm:p-6 md:p-10">
      <header className="mx-auto max-w-6xl pt-2 md:pt-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">Inteligência</span>
        <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-[#1D1D1F]">Raio-X</h1>
      </header>

      {radar.costs.length === 0 ? (
        <div className="mx-auto max-w-6xl space-y-2 rounded-[24px] border border-black/[0.04] bg-white p-8 text-center">
          <h2 className="text-base font-semibold">Nada recorrente ainda</h2>
          <p className="mx-auto max-w-sm text-xs text-[#86868B]">
            Cadastre assinaturas, contas fixas e compras parceladas no{" "}
            <Link href="/planning" className="font-semibold text-[var(--fb-accent)]">Planejamento</Link> para ver quanto elas pesam.
          </p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="min-w-0 space-y-5">
            <Panel title="Todo mês">
              <div className="space-y-4">
                <div>
                  <span className="block text-[32px] font-extrabold leading-10 text-[var(--fb-text)] [font-variant-numeric:tabular-nums]">{brl(monthly)}</span>
                  <span className="text-sm text-[var(--fb-text-2)]">sai todo mês com contas fixas, assinaturas e parcelas, antes de qualquer gasto do dia a dia.</span>
                </div>

                {/* Uma barra só: de onde vem o total e quanto ele ocupa da renda. */}
                <div className="space-y-2">
                  <div className="flex h-3 overflow-hidden rounded-full bg-[var(--fb-compare)]" role="img"
                    aria-label={`Fixas ${brl(radar.fixedMonthly)}, parcelas ${brl(radar.installmentsMonthly)}${income > 0 ? `, sobra ${brl(Math.max(0, income - monthly))}` : ""}`}>
                    <span className="h-full" style={{ width: `${pct(radar.fixedMonthly)}%`, backgroundColor: "var(--fb-accent)" }} />
                    <span className="h-full border-l-2 border-[var(--fb-card)]" style={{ width: `${pct(radar.installmentsMonthly)}%`, backgroundColor: "var(--fb-accent-2)" }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--fb-text-2)]">
                    <LegendDot color="var(--fb-accent)" label="Fixas e assinaturas" value={radar.fixedMonthly} />
                    <LegendDot color="var(--fb-accent-2)" label="Parcelas" value={radar.installmentsMonthly} />
                    {income > 0 && <LegendDot color="var(--fb-compare)" label="Sobra da renda" value={Math.max(0, income - monthly)} />}
                  </div>
                </div>

                <ul className="space-y-1.5 border-t border-[var(--fb-line)] pt-3 text-xs leading-relaxed text-[var(--fb-text-3)]">
                  {income > 0 && (
                    <li>
                      Você espera receber <strong className="text-[var(--fb-text)] [font-variant-numeric:tabular-nums]">{brl(income)}</strong> por mês.{" "}
                      <strong className="text-[var(--fb-text)]">{Math.round((monthly / income) * 100)}%</strong> disso já tem destino certo.
                    </li>
                  )}
                  {lastInstallment && (
                    <li>As parcelas acabam até <strong className="text-[var(--fb-text)] capitalize">{periodLabel(lastInstallment)}</strong>; veja mês a mês em Alívio.</li>
                  )}
                  <li>
                    Somando os próximos 12 meses, são <strong className="text-[var(--fb-text)] [font-variant-numeric:tabular-nums]">{brl(radar.nextYearTotal)}</strong>.
                  </li>
                </ul>
              </div>
            </Panel>

            {radar.alerts.length > 0 && (
              <Panel title="Atenção">
                <ul className="divide-y divide-[var(--fb-line)]">
                  {radar.alerts.map((alert, index) => <AlertRow key={index} alert={alert} />)}
                </ul>
              </Panel>
            )}

            {radar.relief.length > 0 && (
              <Panel title="Alívio">
                <ol className="space-y-3">
                  {radar.relief.map((relief, index) => {
                    return (
                      <li key={relief.periodKey} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fb-accent-bg)] text-[var(--fb-accent)]">
                          <CalendarClock size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium capitalize text-[var(--fb-text)]">{periodLabel(relief.periodKey)}</span>
                          <span className="block truncate text-xs text-[var(--fb-text-3)]">acaba {relief.items.join(", ")}</span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-semibold text-[var(--fb-text)] [font-variant-numeric:tabular-nums]">+ {brl(relief.amount)}</span>
                          <span className="block text-[11px] text-[var(--fb-text-3)] [font-variant-numeric:tabular-nums]">
                            {index > 0 ? `${brl(cumulativeRelief[index])}/mês a mais que hoje` : "por mês a mais que hoje"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </Panel>
            )}
          </div>

          <div className="min-w-0">
            <Panel title="O que mais pesa">
              <ul className="space-y-3.5">
                {radar.costs.map((cost) => {
                  const card = cards.find((candidate) => candidate.id === cost.accountId);
                  const isInstallment = cost.kind === "installment";
                  const weight = radarWeight(cost);
                  return (
                    <li key={cost.item.id} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[var(--fb-text)]">{cost.item.title}</span>
                          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--fb-text-3)]">
                            {card && <CardDot card={card} size={8} />}
                            <span>{cost.accountName}</span>
                            <span>· próxima {brl(cost.monthly)}</span>
                            {isInstallment && cost.nextInstallment && cost.item.installmentsCount && (
                              <span>· {cost.nextInstallment}ª de {cost.item.installmentsCount}</span>
                            )}
                            {isInstallment && cost.lastPeriodKey && <span>· até {periodLabel(cost.lastPeriodKey)}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-semibold text-[var(--fb-text)] [font-variant-numeric:tabular-nums]">{brl(weight)}</span>
                          <span className="block text-[11px] text-[var(--fb-text-3)]">{isInstallment ? "falta pagar" : "em 12 meses"}</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--fb-compare)]" aria-hidden>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${topYear > 0 ? Math.max(2, (weight / topYear) * 100) : 0}%`,
                            backgroundColor: cost.kind === "installment" ? "var(--fb-accent-2)" : "var(--fb-accent)",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--fb-line)] pt-3 text-xs text-[var(--fb-text-2)]">
                <span className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-[2px] bg-[var(--fb-accent)]" aria-hidden /> Fixas e assinaturas</span>
                <span className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-[2px] bg-[var(--fb-accent-2)]" aria-hidden /> Parcelas</span>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: RadarAlert }) {
  const icon = alert.kind === "duplicate" ? <Copy size={15} /> : alert.kind === "price_change" ? <TrendingUp size={15} /> : <AlertTriangle size={15} />;
  let title: string;
  let detail: string;
  if (alert.kind === "duplicate") {
    title = `${alert.title} em ${alert.items.length} lugares`;
    detail = `Cobra ${alert.items.map((item) => item.account).join(" e ")} a partir de ${periodLabel(alert.periods[0])} · ${brl(alert.monthlyWaste)}/mês a mais`;
  } else if (alert.kind === "price_change") {
    title = `${alert.item.title} muda de valor`;
    detail = `${brl(alert.from)} → ${brl(alert.to)} a partir de ${periodLabel(alert.periodKey)}`;
  } else {
    title = `${alert.item.title} vence antes do salário`;
    detail = `Dia ${alert.dueDay}, e o primeiro recebimento é dia ${alert.incomeDay} · ${brl(alert.amount)} precisa estar na conta antes`;
  }
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--fb-warn) 14%, transparent)", color: "var(--fb-warn)" }}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--fb-text)]">{title}</span>
        <span className="block text-xs text-[var(--fb-text-3)]">{detail}</span>
      </span>
    </li>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label} <span className="font-semibold text-[var(--fb-text)] [font-variant-numeric:tabular-nums]">{brl(value)}</span>
    </span>
  );
}
