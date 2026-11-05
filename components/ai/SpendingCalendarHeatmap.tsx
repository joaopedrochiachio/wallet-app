"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  MessageSquare,
  Receipt,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type {
  CardInvoiceProjection,
  MonthProjection,
  TransactionItem,
} from "@/context/WalletContext";
import type { CardItem, RecurringItem } from "@/types";
import { MONTH_NAMES_PT } from "@/lib/utils/dateUtils";
import {
  buildFinancialCalendar,
  summarizeFinancialCalendar,
  type FinancialCalendarBillItem,
} from "@/lib/services/financialCalendarService";

interface SpendingCalendarHeatmapProps {
  recurringItems: RecurringItem[];
  cards: CardItem[];
  transactions: TransactionItem[];
  mainBalance: number;
  safeDailyAllowance: number;
  targetEndMonthBalance: number;
  monthlyProjection: MonthProjection;
  onRealizeItem?: (
    recurringItem: RecurringItem,
    year: number,
    month: number,
    customAmount?: number,
    customDate?: Date
  ) => Promise<void>;
  onDiscussWithAI: (topic: string) => void;
}

const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function compactCurrency(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `${(absolute / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  }
  return Math.round(absolute).toLocaleString("pt-BR");
}

export function SpendingCalendarHeatmap({
  recurringItems,
  cards,
  transactions,
  mainBalance,
  safeDailyAllowance,
  targetEndMonthBalance,
  monthlyProjection,
  onRealizeItem,
  onDiscussWithAI,
}: SpendingCalendarHeatmapProps) {
  const [now] = useState(() => new Date());
  const [targetYear, setTargetYear] = useState(now.getFullYear());
  const [targetMonth, setTargetMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === now.getMonth();
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(targetYear, targetMonth, 1).getDay();

  const calendarData = useMemo(
    () =>
      buildFinancialCalendar({
        year: targetYear,
        month: targetMonth,
        cards,
        recurringItems,
        transactions,
        currentMonthInvoices: isCurrentMonth
          ? (monthlyProjection?.cardInvoices as CardInvoiceProjection[])
          : undefined,
        now,
      }),
    [
      targetYear,
      targetMonth,
      cards,
      recurringItems,
      transactions,
      isCurrentMonth,
      monthlyProjection?.cardInvoices,
      now,
    ]
  );

  const totals = useMemo(() => summarizeFinancialCalendar(calendarData), [calendarData]);
  const selectedDayData = calendarData.get(selectedDay)!;
  const selectedDate = new Date(targetYear, targetMonth, selectedDay);
  const selectedDayLabel = selectedDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const projectedClosing = isCurrentMonth
    ? mainBalance + totals.plannedIncome - totals.plannedExpense
    : totals.plannedNet;

  const moveMonth = (offset: number) => {
    const next = new Date(targetYear, targetMonth + offset, 1);
    setTargetYear(next.getFullYear());
    setTargetMonth(next.getMonth());
    setSelectedDay(1);
  };

  const handleToday = () => {
    setTargetYear(now.getFullYear());
    setTargetMonth(now.getMonth());
    setSelectedDay(now.getDate());
  };

  const handleRealize = async (bill: FinancialCalendarBillItem, customDate?: Date) => {
    if (!onRealizeItem || !bill.sourceItem) return;
    setActionLoadingId(bill.id);
    try {
      const effectiveDate =
        customDate ??
        (isCurrentMonth && selectedDay > now.getDate()
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
          : new Date(targetYear, targetMonth, selectedDay, 12, 0, 0));
      await onRealizeItem(bill.sourceItem, targetYear, targetMonth, undefined, effectiveDate);
      if (effectiveDate.getFullYear() === targetYear && effectiveDate.getMonth() === targetMonth) {
        setSelectedDay(effectiveDate.getDate());
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <section className="w-full rounded-[28px] sm:rounded-[36px] bg-white border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-4 sm:p-7 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.05] pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0">
            <CalendarDays size={19} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#1D1D1F] capitalize">
                {MONTH_NAMES_PT[targetMonth]} de {targetYear}
              </h3>
              <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Real + previsto
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#86868B]">
              O que aconteceu e o que ainda está programado, dia por dia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleToday}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isCurrentMonth
                ? "bg-[#1D1D1F] text-white border-black"
                : "bg-white hover:bg-[#F2F2F7] text-[#1D1D1F] border-black/10"
            }`}
          >
            Hoje
          </button>
          <div className="flex items-center bg-[#F2F2F7] rounded-xl p-0.5 border border-black/[0.05]">
            <button type="button" onClick={() => moveMonth(-1)} className="p-1.5 rounded-lg hover:bg-white" aria-label="Mês anterior">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => moveMonth(1)} className="p-1.5 rounded-lg hover:bg-white" aria-label="Próximo mês">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <SummaryCard label="Entradas realizadas" value={`+R$ ${formatCurrency(totals.realizedIncome)}`} tone="emerald" icon={<ArrowDownLeft size={12} />} />
        <SummaryCard label="Saídas realizadas" value={`−R$ ${formatCurrency(totals.realizedExpense)}`} tone="rose" icon={<ArrowUpRight size={12} />} />
        <SummaryCard label="Ainda previsto" value={`${totals.plannedNet >= 0 ? "+" : "−"}R$ ${formatCurrency(Math.abs(totals.plannedNet))}`} tone={totals.plannedNet >= 0 ? "blue" : "amber"} icon={<Clock3 size={12} />} />
        <SummaryCard label={isCurrentMonth ? "Saldo após agenda" : "Balanço da agenda"} value={`${projectedClosing >= 0 ? "+" : "−"}R$ ${formatCurrency(Math.abs(projectedClosing))}`} tone={projectedClosing >= targetEndMonthBalance || !isCurrentMonth ? "dark" : "rose"} icon={<Wallet size={12} />} />
      </div>

      <div className="rounded-3xl border border-black/[0.05] bg-[#FAFAFC] p-3 sm:p-4 space-y-2">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center font-semibold text-[9px] sm:text-[10px] text-[#86868B] uppercase tracking-wider">
          {WEEK_LABELS.map((label) => <div key={label}>{label}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: firstDayOfWeek }).map((_, index) => (
            <div key={`empty-${index}`} className="min-h-[64px] sm:min-h-[88px]" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const data = calendarData.get(day)!;
            const isSelected = selectedDay === day;
            const isToday = isCurrentMonth && now.getDate() === day;
            const hasRealized = data.realizedIncome > 0 || data.realizedExpense > 0;
            const hasPlanned = data.plannedIncome > 0 || data.plannedExpense > 0;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                aria-label={`Abrir ${day} de ${MONTH_NAMES_PT[targetMonth]}`}
                className={`min-h-[64px] sm:min-h-[88px] rounded-xl sm:rounded-2xl p-1.5 sm:p-2 text-left flex flex-col transition-all active:scale-95 border overflow-hidden ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white border-black shadow-md ring-2 ring-black/10"
                    : isToday
                      ? "bg-blue-50 text-blue-950 border-blue-300"
                      : data.hasUrgentBill
                        ? "bg-amber-50/70 text-[#1D1D1F] border-amber-200"
                        : "bg-white hover:bg-[#F2F2F7] text-[#1D1D1F] border-black/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] sm:text-xs font-bold">{day}</span>
                  {data.hasUrgentBill && <AlertTriangle size={10} className={isSelected ? "text-amber-300" : "text-amber-600"} />}
                </div>
                <div className="mt-auto w-full space-y-0.5 min-w-0">
                  {hasRealized && (
                    <div className={`text-[8px] sm:text-[9px] font-mono font-bold truncate ${data.realizedNet >= 0 ? isSelected ? "text-emerald-300" : "text-emerald-600" : isSelected ? "text-rose-300" : "text-rose-600"}`}>
                      {data.realizedNet >= 0 ? "+" : "−"}R$ {compactCurrency(data.realizedNet)}
                    </div>
                  )}
                  {hasPlanned && (
                    <div className={`text-[7.5px] sm:text-[8.5px] font-semibold truncate ${isSelected ? "text-blue-200" : "text-blue-600"}`}>
                      Prev. {data.plannedNet >= 0 ? "+" : "−"}R$ {compactCurrency(data.plannedNet)}
                    </div>
                  )}
                  {!hasRealized && !hasPlanned && data.bills.length > 0 && (
                    <div className={`text-[7.5px] sm:text-[8.5px] font-semibold truncate ${isSelected ? "text-white/60" : "text-[#86868B]"}`}>
                      {data.bills.length} evento{data.bills.length > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
                <div className="flex gap-0.5 mt-1 h-1">
                  {hasRealized && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                  {data.bills.some((bill) => bill.source === "recurring") && <span className="w-1 h-1 rounded-full bg-amber-500" />}
                  {data.hasCardInvoice && <span className="w-1 h-1 rounded-full bg-indigo-500" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[9px] sm:text-[10px] text-[#86868B]">
          <LegendDot color="bg-emerald-500" label="Realizado" />
          <LegendDot color="bg-blue-500" label="Previsto" />
          <LegendDot color="bg-amber-500" label="Conta ou renda" />
          <LegendDot color="bg-indigo-500" label="Fatura" />
        </div>
      </div>

      <div className="bg-[#FAFAFC] rounded-3xl p-4 sm:p-6 border border-black/[0.05] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.05] pb-3">
          <div>
            <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">Dia selecionado</span>
            <h4 className="text-base sm:text-lg font-bold text-[#1D1D1F] capitalize">{selectedDayLabel}</h4>
          </div>
          <button
            type="button"
            onClick={() => onDiscussWithAI(`Analise meu dia ${selectedDay} de ${MONTH_NAMES_PT[targetMonth]}. Realizado: entrou R$ ${formatCurrency(selectedDayData.realizedIncome)} e saiu R$ ${formatCurrency(selectedDayData.realizedExpense)}. Previsto: entra R$ ${formatCurrency(selectedDayData.plannedIncome)} e sai R$ ${formatCurrency(selectedDayData.plannedExpense)}. Como isso afeta minha meta de R$ ${formatCurrency(targetEndMonthBalance)}?`)}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-[#F2F2F7] active:scale-95 text-xs font-semibold text-[#1D1D1F] border border-black/[0.08] flex items-center gap-1.5 cursor-pointer transition-all self-start"
          >
            <MessageSquare size={13} className="text-blue-600" />
            Perguntar ao assistente
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <DayMetric label="Entrou" value={selectedDayData.realizedIncome} prefix="+" tone="emerald" />
          <DayMetric label="Saiu" value={selectedDayData.realizedExpense} prefix="−" tone="rose" />
          <DayMetric label="A receber" value={selectedDayData.plannedIncome} prefix="+" tone="blue" />
          <DayMetric label="A pagar" value={selectedDayData.plannedExpense} prefix="−" tone="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5 px-1"><Receipt size={14} className="text-[#86868B]" />Realizado ({selectedDayData.transactions.length})</h5>
            {selectedDayData.transactions.length === 0 ? <EmptyDayMessage text="Nenhum lançamento realizado neste dia." /> : (
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto no-scrollbar">
                {selectedDayData.transactions.map((transaction) => (
                  <div key={transaction.id} className="p-3 rounded-2xl bg-white border border-black/[0.05] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${transaction.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {transaction.type === "income" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                      </div>
                      <div className="min-w-0">
                        <strong className="block font-semibold text-[#1D1D1F] truncate">{transaction.title}</strong>
                        <span className="block text-[10px] text-[#86868B] truncate">{transaction.category} · {transaction.cardName || transaction.account || "Carteira"} · {transaction.timeLabel}</span>
                      </div>
                    </div>
                    <strong className={`font-mono font-bold shrink-0 ${transaction.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>{transaction.type === "income" ? "+" : "−"}R$ {formatCurrency(transaction.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5 px-1"><Clock3 size={14} className="text-[#86868B]" />Agenda prevista ({selectedDayData.bills.length})</h5>
            {selectedDayData.bills.length === 0 ? <EmptyDayMessage text="Nada previsto para este dia." /> : (
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto no-scrollbar">
                {selectedDayData.bills.map((bill) => (
                  <div key={bill.id} className="p-3 rounded-2xl bg-white border border-black/[0.05] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${bill.type === "income" ? "bg-emerald-50 text-emerald-700" : bill.type === "credit_invoice" ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"}`}>
                        {bill.type === "income" ? <TrendingUp size={15} /> : bill.type === "credit_invoice" ? <CreditCard size={15} /> : <Building2 size={15} />}
                      </div>
                      <div className="min-w-0">
                        <strong className="block font-semibold text-[#1D1D1F] truncate">{bill.title}</strong>
                        <span className="text-[10px] text-[#86868B]">{bill.status === "paid" ? "Realizado" : bill.status === "scheduled_card" ? "Cai na fatura do cartão" : "Pendente"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <strong className="font-mono font-bold text-[#1D1D1F]">R$ {formatCurrency(bill.amount)}</strong>
                      {bill.status === "pending" && bill.sourceItem && onRealizeItem && (
                        <div className="flex items-center gap-1">
                          {isCurrentMonth && now.getDate() > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRealize(
                                  bill,
                                  new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0)
                                )
                              }
                              disabled={actionLoadingId === bill.id}
                              title={bill.type === "income" ? "Recebi adiantado ontem" : "Paguei adiantado ontem"}
                              className="px-2 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-[10px] transition-all cursor-pointer disabled:opacity-50"
                            >
                              Ontem
                            </button>
                          )}
                          <button type="button" onClick={() => handleRealize(bill)} disabled={actionLoadingId === bill.id} className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] transition-all cursor-pointer disabled:opacity-50">
                            {actionLoadingId === bill.id ? "Salvando..." : bill.type === "income" ? "Receber" : "Baixar"}
                          </button>
                        </div>
                      )}
                      {bill.status === "paid" && (
                        <div className="flex items-center gap-1.5">
                          {isCurrentMonth &&
                            now.getDate() > 1 &&
                            selectedDay !== now.getDate() - 1 &&
                            bill.sourceItem &&
                            onRealizeItem && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRealize(
                                    bill,
                                    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0)
                                  )
                                }
                                disabled={actionLoadingId === bill.id}
                                title="Mover recebimento/pagamento realizado para ontem"
                                className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-[9px] transition-all cursor-pointer disabled:opacity-50"
                              >
                                {actionLoadingId === bill.id ? "..." : "Adiantar p/ ontem"}
                              </button>
                            )}
                          <CheckCircle2 size={15} className="text-emerald-600" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3 flex items-start gap-2.5">
          <Sparkles size={15} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-blue-950 leading-relaxed">
            <strong>Leitura do assistente:</strong>{" "}
            {isCurrentMonth
              ? projectedClosing >= targetEndMonthBalance
                ? `sua agenda preserva a meta e mantém R$ ${formatCurrency(Math.max(0, projectedClosing - targetEndMonthBalance))} de folga. Seu teto seguro hoje é R$ ${formatCurrency(safeDailyAllowance)}.`
                : `a agenda atual projeta R$ ${formatCurrency(Math.abs(targetEndMonthBalance - projectedClosing))} abaixo da meta. Priorize os compromissos pendentes.`
              : totals.plannedExpense > totals.plannedIncome
                ? `este mês concentra R$ ${formatCurrency(totals.plannedExpense)} em compromissos. Reserve caixa antes da virada.`
                : "a agenda futura está equilibrada com as entradas previstas."}
          </p>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: string; tone: "emerald" | "rose" | "blue" | "amber" | "dark"; icon: React.ReactNode }) {
  const colors = { emerald: "text-emerald-600 bg-emerald-50/70", rose: "text-rose-600 bg-rose-50/70", blue: "text-blue-600 bg-blue-50/70", amber: "text-amber-700 bg-amber-50/70", dark: "text-[#1D1D1F] bg-[#F8F8FA]" };
  return <div className={`rounded-2xl border border-black/[0.04] p-3 ${colors[tone]}`}><span className="text-[9px] sm:text-[10px] font-semibold opacity-70 flex items-center gap-1">{icon}{label}</span><strong className="text-xs sm:text-sm font-bold font-mono tabular-nums block mt-1">{value}</strong></div>;
}

function DayMetric({ label, value, prefix, tone }: { label: string; value: number; prefix: string; tone: "emerald" | "rose" | "blue" | "amber" }) {
  const colors = { emerald: "text-emerald-600", rose: "text-rose-600", blue: "text-blue-600", amber: "text-amber-700" };
  return <div className="bg-white rounded-2xl p-3 border border-black/[0.05]"><span className="text-[10px] font-semibold text-[#86868B] block">{label}</span><strong className={`text-sm sm:text-base font-bold font-mono block mt-0.5 ${colors[tone]}`}>{prefix}R$ {formatCurrency(value)}</strong></div>;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${color}`} />{label}</span>;
}

function EmptyDayMessage({ text }: { text: string }) {
  return <div className="min-h-[72px] rounded-2xl bg-white border border-dashed border-black/10 flex items-center justify-center text-center px-3"><p className="text-[11px] text-[#86868B]">{text}</p></div>;
}
