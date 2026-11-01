"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Flame,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import type { TransactionItem } from "@/context/WalletContext";
import type { FinancialDiagnosis, SpecificExpenseAlert } from "@/lib/services/financialDiagnosisService";

interface VisualPatternStorytellingProps {
  diagnosis: FinancialDiagnosis | null;
  targetEndMonthBalance: number;
  effectiveProjectedFree: number;
  safeDailyAllowance: number;
  mainBalance: number;
  monthExpense: number;
  transactions?: TransactionItem[];
  onDiscussWithAI: (prompt: string) => void;
  onOpenSimulator?: (params?: { description?: string; amount?: number }) => void;
  onDismissPattern?: (item: string) => void;
  onRefreshPatterns?: () => void;
  isSearchingPatterns?: boolean;
}

type Cluster = "all" | "drains" | "recurring" | "habits";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalize(value: string) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isRelatedTransaction(transaction: TransactionItem, alert: SpecificExpenseAlert) {
  const category = normalize(transaction.category);
  const alertCategory = normalize(alert.habitCategory || "");
  const title = normalize(transaction.title);
  const item = normalize(alert.item);
  return Boolean(
    (category && alertCategory && (category.includes(alertCategory) || alertCategory.includes(category))) ||
    item.split(/\s+|&|\//).filter((token) => token.length > 3).some((token) => title.includes(token))
  );
}

export function VisualPatternStorytelling({
  diagnosis,
  targetEndMonthBalance,
  effectiveProjectedFree,
  safeDailyAllowance,
  mainBalance,
  monthExpense,
  transactions = [],
  onDiscussWithAI,
  onOpenSimulator,
  onDismissPattern,
  onRefreshPatterns,
  isSearchingPatterns,
}: VisualPatternStorytellingProps) {
  const [selectedCluster, setSelectedCluster] = useState<Cluster>("all");
  const [simulatedCutPercent, setSimulatedCutPercent] = useState(20);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const displayAlerts = useMemo<SpecificExpenseAlert[]>(() => {
    const rawAlerts = diagnosis?.specificExpensesAlerts || [];
    const fallbackAlerts: SpecificExpenseAlert[] = [
      { item: "Delivery & Alimentação Externa", totalAmount: 284.5, count: 5, habitCategory: "Alimentação", alertType: "warning", message: "Pedidos recorrentes concentram o maior gasto variável discricionário do ciclo." },
      { item: "Assinaturas e Streaming", totalAmount: 119.8, count: 3, habitCategory: "Serviços Digitais", alertType: "info", message: "Serviços mensais podem ser revistos conforme o uso real." },
      { item: "Microcompras & Transporte por App", totalAmount: 94.2, count: 4, habitCategory: "Transporte", alertType: "info", message: "Deslocamentos pequenos e frequentes ganharam relevância no fechamento." },
    ];
    const source = rawAlerts.length > 0 ? rawAlerts : fallbackAlerts;
    return [...source].sort((a, b) => b.totalAmount - a.totalAmount);
  }, [diagnosis?.specificExpensesAlerts]);

  const filteredAlerts = useMemo(() => {
    if (selectedCluster === "drains") return displayAlerts.filter((alert) => alert.totalAmount >= 100 || alert.alertType === "alert");
    if (selectedCluster === "recurring") return displayAlerts.filter((alert) => /servico|assinatura|streaming|recorr/.test(normalize(`${alert.habitCategory} ${alert.item}`)));
    if (selectedCluster === "habits") return displayAlerts.filter((alert) => /aliment|transporte|delivery|rotina|lazer/.test(normalize(`${alert.habitCategory} ${alert.item}`)));
    return displayAlerts;
  }, [displayAlerts, selectedCluster]);

  const totalDrainsAmount = displayAlerts.reduce((sum, alert) => sum + alert.totalAmount, 0);
  const potentialSavings = (totalDrainsAmount * simulatedCutPercent) / 100;
  const newProjectedBalance = effectiveProjectedFree + potentialSavings;
  const targetStatus = effectiveProjectedFree >= targetEndMonthBalance ? "on_track" : "at_risk";
  const safeMargin = Math.max(0, effectiveProjectedFree - targetEndMonthBalance);
  const spotlights = filteredAlerts.slice(0, 3);
  const remaining = filteredAlerts.slice(3);

  const getTransactionTags = (alert: SpecificExpenseAlert) => {
    const related = transactions.filter((transaction) => transaction.type === "despesa" && isRelatedTransaction(transaction, alert)).sort((a, b) => b.amount - a.amount).slice(0, 3);
    if (related.length > 0) return related.map((transaction) => transaction.title);
    return [alert.item, `${alert.count || 1} lançamento${(alert.count || 1) > 1 ? "s" : ""}`, alert.habitCategory || "Despesa"];
  };

  const discussPattern = (alert: SpecificExpenseAlert) => {
    onDiscussWithAI(`Niko, aprofunde o padrão "${alert.item}", que soma R$ ${alert.totalAmount.toFixed(2)}. Mostre as transações relacionadas e proponha um plano prático de redução para o próximo ciclo.`);
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-300">
      <section className="relative overflow-hidden rounded-[32px] border border-black/[0.05] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-6">
        <div className={`pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl ${targetStatus === "on_track" ? "bg-emerald-300/15" : "bg-amber-300/15"}`} />
        <div className="relative grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-[13px] text-white ${targetStatus === "on_track" ? "bg-emerald-600" : "bg-amber-500"}`}>
                {targetStatus === "on_track" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              </span>
              <span className="rounded-full bg-[#F2F2F7] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6E6E73]">Diagnóstico de hábitos</span>
            </div>
            <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
              {targetStatus === "on_track" ? "Sua meta está protegida — agora otimize os excessos." : "Pequenos ralos estão pressionando seu fechamento."}
            </h2>
            <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-[#6E6E73]">
              Priorizamos impacto real e escondemos o ruído. Abra somente o hábito que merece sua atenção agora.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => onDiscussWithAI(`Niko, analise meu saldo projetado de R$ ${effectiveProjectedFree.toFixed(2)} contra a meta de R$ ${targetEndMonthBalance.toFixed(2)} e priorize três ações.`)} className="inline-flex items-center gap-1.5 rounded-full bg-[#1D1D1F] px-3.5 py-2 text-[10px] font-semibold text-white transition-transform active:scale-95"><MessageCircle size={12} /> Aprofundar com Niko</button>
              {onOpenSimulator && <button type="button" onClick={() => onOpenSimulator()} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-semibold text-[#6E6E73] transition-colors hover:bg-[#F2F2F7] hover:text-[#1D1D1F]"><Calculator size={12} /> Simular uma compra</button>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] border border-black/[0.05] bg-black/[0.05]">
            <Metric label="Saldo projetado" value={`R$ ${formatCurrency(effectiveProjectedFree)}`} tone={targetStatus === "on_track" ? "green" : "amber"} icon={<Target size={13} />} />
            <Metric label="Teto seguro hoje" value={`R$ ${formatCurrency(safeDailyAllowance)}`} tone="blue" icon={<Sparkles size={13} />} />
            <Metric label="Saldo em conta" value={`R$ ${formatCurrency(mainBalance)}`} tone="neutral" icon={<TrendingUp size={13} />} />
            <Metric label="Ralos mapeados" value={`R$ ${formatCurrency(totalDrainsAmount)}`} tone="rose" icon={<Flame size={13} />} />
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-black/[0.05] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold tracking-tight text-slate-900">Simulador de cortes</h3><p className="mt-0.5 text-[10px] text-[#86868B]">Ajuste a intensidade e veja a tendência no próprio controle.</p></div>
              <span className="rounded-full bg-[#1D1D1F] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white">{simulatedCutPercent}%</span>
            </div>
            <div className="mt-5">
              <input type="range" min={5} max={50} step={5} value={simulatedCutPercent} onChange={(event) => setSimulatedCutPercent(Number(event.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#E5E5EA] accent-[#1D1D1F]" aria-label="Percentual de corte nos ralos" />
              <div className="mt-2 flex justify-between text-[9px] text-[#AEAEB2]"><span>Ajuste leve · 5%</span><span>Recomendado · 20%</span><span>Intenso · 50%</span></div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[22px] bg-[#F2F8F4] p-4">
            <svg viewBox="0 0 240 66" className="absolute inset-x-0 bottom-0 h-16 w-full text-emerald-500/20" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 58 C35 54 40 50 68 49 C100 48 110 36 140 38 C170 40 180 20 240 8 L240 66 L0 66 Z" fill="currentColor" />
              <path d="M0 58 C35 54 40 50 68 49 C100 48 110 36 140 38 C170 40 180 20 240 8" fill="none" stroke="#34C759" strokeWidth="2" />
            </svg>
            <div className="relative">
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-800">Tendência de folga mensal</span>
              <strong className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums text-emerald-700">+R$ {formatCurrency(potentialSavings)}</strong>
              <p className="mt-1 text-[10px] text-emerald-900/75">Fechamento estimado em <span className="font-semibold tabular-nums">R$ {formatCurrency(newProjectedBalance)}</span>.</p>
              <button type="button" onClick={() => onDiscussWithAI(`Niko, transforme um corte de ${simulatedCutPercent}% nos ralos, equivalente a R$ ${potentialSavings.toFixed(2)}, em um plano executável.`)} className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 hover:text-emerald-950">Aplicar estratégia no chat <ArrowUpRight size={11} /></button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-black/[0.05] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><Flame size={17} className="text-rose-500" /><h3 className="text-base font-semibold tracking-tight text-slate-900">Hábitos invisíveis & ralos</h3></div><p className="mt-1 text-[11px] text-[#86868B]">Os três maiores impactos ficam em foco. O restante aparece sob demanda.</p></div>
          <div className="flex flex-wrap items-center gap-1 rounded-[14px] bg-[#F2F2F7] p-1">
            {([['all', 'Todos'], ['drains', 'Críticos'], ['recurring', 'Recorrentes'], ['habits', 'Rotina']] as Array<[Cluster, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setSelectedCluster(value)} className={`rounded-[10px] px-2.5 py-1.5 text-[10px] font-semibold transition-all ${selectedCluster === value ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B] hover:text-[#1D1D1F]"}`}>{label}</button>)}
            {onRefreshPatterns && <button type="button" onClick={onRefreshPatterns} disabled={isSearchingPatterns} title="Buscar novos padrões" className="rounded-[10px] p-1.5 text-[#86868B] hover:bg-white hover:text-[#1D1D1F] disabled:opacity-40"><RefreshCw size={12} className={isSearchingPatterns ? "animate-spin" : ""} /></button>}
          </div>
        </div>

        {spotlights.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {spotlights.map((alert, index) => {
              const impactBase = Math.max(safeMargin, monthExpense * 0.25, 1);
              const impact = Math.min(100, Math.round((alert.totalAmount / impactBase) * 100));
              return (
                <article key={alert.item} className="group relative overflow-hidden rounded-[22px] border border-black/[0.05] bg-[#FAFAFA] p-4 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-between"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#86868B]">Impacto #{index + 1}</span>{onDismissPattern && <button type="button" onClick={() => onDismissPattern(alert.item)} title="Descartar alerta" className="rounded-full p-1 text-[#C7C7CC] opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"><X size={12} /></button>}</div>
                  <h4 className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-snug tracking-tight text-slate-900">{alert.item}</h4>
                  <strong className="mt-2 block text-xl font-semibold tracking-tight tabular-nums text-rose-600">R$ {formatCurrency(alert.totalAmount)}</strong>
                  <div className="mt-3 flex flex-wrap gap-1.5">{getTransactionTags(alert).map((tag) => <span key={tag} className="max-w-full truncate rounded-full border border-black/[0.05] bg-white px-2 py-1 text-[9px] font-medium text-[#6E6E73]">{tag}</span>)}</div>
                  <div className="mt-4"><div className="mb-1.5 flex justify-between text-[9px] text-[#86868B]"><span>Impacto na margem</span><span className="font-semibold tabular-nums text-slate-900">{impact}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-black/[0.05]"><div className="h-full rounded-full bg-rose-500" style={{ width: `${impact}%` }} /></div></div>
                  <button type="button" onClick={() => discussPattern(alert)} className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 transition-colors hover:text-blue-800"><MessageCircle size={11} /> Discutir com consultor <ArrowUpRight size={10} /></button>
                </article>
              );
            })}
          </div>
        ) : <div className="mt-5 rounded-[20px] bg-[#F5F5F7] p-6 text-center text-[11px] text-[#86868B]">Nenhum padrão corresponde a este filtro.</div>}

        {remaining.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-[20px] border border-black/[0.05]">
            <div className="border-b border-black/[0.05] bg-[#FAFAFA] px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#86868B]">Outros sinais · toque para expandir</div>
            <div className="divide-y divide-black/[0.05]">
              {remaining.map((alert) => {
                const expanded = expandedItem === alert.item;
                return (
                  <div key={alert.item}>
                    <button type="button" onClick={() => setExpandedItem(expanded ? null : alert.item)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA]">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" /><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] font-medium text-slate-900">{alert.item}</strong><span className="text-[9px] text-[#86868B]">{alert.habitCategory || "Despesa"} · {alert.count || 1} ocorrências</span></span><strong className="text-[11px] font-semibold tabular-nums text-slate-900">R$ {formatCurrency(alert.totalAmount)}</strong><ChevronDown size={13} className={`text-[#86868B] transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded && <div className="animate-in slide-in-from-top-1 border-t border-black/[0.04] bg-[#FAFAFA] px-4 py-3"><div className="flex flex-wrap gap-1.5">{getTransactionTags(alert).map((tag) => <span key={tag} className="rounded-full bg-white px-2 py-1 text-[9px] text-[#6E6E73] shadow-sm">{tag}</span>)}</div><p className="mt-2 text-[10px] leading-relaxed text-[#6E6E73]">{alert.message}</p><div className="mt-3 flex items-center justify-between"><button type="button" onClick={() => discussPattern(alert)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600"><MessageCircle size={11} /> Discutir com consultor</button>{onDismissPattern && <button type="button" onClick={() => onDismissPattern(alert.item)} className="text-[9px] font-medium text-[#86868B] hover:text-rose-600">Descartar sinal</button>}</div></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, tone, icon }: { label: string; value: string; tone: "green" | "amber" | "blue" | "rose" | "neutral"; icon: React.ReactNode }) {
  const colors = { green: "text-emerald-700", amber: "text-amber-700", blue: "text-blue-700", rose: "text-rose-600", neutral: "text-slate-900" };
  return <div className="bg-[#FAFAFA] p-4"><div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">{icon}{label}</div><strong className={`mt-2 block text-[15px] font-semibold tracking-tight tabular-nums ${colors[tone]}`}>{value}</strong></div>;
}
