"use client";

import React, { useState, useMemo } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  MONTH_NAMES_PT,
  getPeriodKey,
  getEffectiveDueDay,
  getEffectiveRecurringItemForPeriod,
} from "@/lib/utils/dateUtils";
import { resolveRealizedRecurringDay } from "@/lib/services/financialCalendarService";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Building2,
  ArrowDownLeft,
  CalendarDays,
  Plus,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Filter,
} from "lucide-react";

export function InteractiveFinancialCalendar() {
  const {
    recurringItems,
    cards,
    transactions,
    realizeRecurringItemNow,
    unrealizeRecurringItem,
    getMonthlyProjection,
  } = useWallet();

  const now = new Date();
  const [targetYear, setTargetYear] = useState(now.getFullYear());
  const [targetMonth, setTargetMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const currentPeriodKey = getPeriodKey(targetYear, targetMonth);

  // Navegação entre meses
  const handlePrevMonth = () => {
    if (targetMonth === 0) {
      setTargetYear(targetYear - 1);
      setTargetMonth(11);
    } else {
      setTargetMonth(targetMonth - 1);
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (targetMonth === 11) {
      setTargetYear(targetYear + 1);
      setTargetMonth(0);
    } else {
      setTargetMonth(targetMonth + 1);
    }
    setSelectedDay(1);
  };

  const handleCurrentMonth = () => {
    setTargetYear(now.getFullYear());
    setTargetMonth(now.getMonth());
    setSelectedDay(now.getDate());
  };

  // Dias do mês
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(targetYear, targetMonth, 1).getDay(); // 0 = Domingo

  // Projeção do mês
  const monthOffset = (targetYear - now.getFullYear()) * 12 + (targetMonth - now.getMonth());
  const monthProj = useMemo(() => {
    return getMonthlyProjection(monthOffset);
  }, [getMonthlyProjection, monthOffset]);

  // Coleta todos os eventos do mês indexados pelo dia do mês (1 a 31)
  const monthEventsByDay = useMemo(() => {
    const map = new Map<
      number,
      Array<{
        id: string;
        title: string;
        amount: number;
        type: "expense" | "income" | "credit_invoice";
        accountOrCard: string;
        isRealized: boolean;
        recurringItemId?: string;
        cardId?: string;
      }>
    >();

    // Inicializa todos os dias
    for (let d = 1; d <= daysInMonth; d++) {
      map.set(d, []);
    }

    // 1. Recorrências e Contas Fixas
    const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === now.getMonth();
    for (const rawItem of recurringItems) {
      if (rawItem.active === false) continue;
      if (rawItem.excludedPeriods?.includes(currentPeriodKey)) continue;
      if (rawItem.overrides?.[currentPeriodKey]?.isDeleted) continue;

      const item = getEffectiveRecurringItemForPeriod(rawItem, currentPeriodKey);
      const scheduledDay = Math.min(daysInMonth, Math.max(1, getEffectiveDueDay(item, targetYear, targetMonth)));

      const linkedTx = transactions.find(
        (tx) => tx.recurringItemId === rawItem.id && tx.periodKey === currentPeriodKey
      );
      const isRealized = Boolean(
        rawItem.realizedPeriods?.includes(currentPeriodKey) || linkedTx
      );

      const day = isRealized
        ? resolveRealizedRecurringDay({
            rawItem,
            transaction: linkedTx,
            year: targetYear,
            month: targetMonth,
            daysInMonth,
            periodKey: currentPeriodKey,
            isCurrentMonth,
            now,
          })
        : scheduledDay;

      const isIncome = item.type === "income";
      const dayList = map.get(day) || [];
      dayList.push({
        id: `rec_${rawItem.id}`,
        title: item.title,
        amount: item.amount,
        type: isIncome ? "income" : "expense",
        accountOrCard: item.account,
        isRealized,
        recurringItemId: rawItem.id,
      });
      map.set(day, dayList);
    }

    // 2. Faturas de Cartão
    for (const card of cards) {
      if (card.type && card.type !== "credit") continue;
      const dueDay = card.dueDay || 10;
      let day = dueDay;
      if (day > daysInMonth) day = daysInMonth;

      const cardInvoice = monthProj?.cardInvoices?.find((inv) => inv.cardId === card.id);
      const invoiceAmount = cardInvoice ? cardInvoice.totalInvoice : (card.spent || 0);
      const isPaid = cardInvoice ? cardInvoice.isPaid : false;

      if (invoiceAmount > 0) {
        const dayList = map.get(day) || [];
        dayList.push({
          id: `card_${card.id}`,
          title: `Fatura ${card.name}`,
          amount: invoiceAmount,
          type: "credit_invoice",
          accountOrCard: card.name,
          isRealized: isPaid,
          cardId: card.id,
        });
        map.set(day, dayList);
      }
    }

    return map;
  }, [recurringItems, cards, transactions, targetYear, targetMonth, daysInMonth, currentPeriodKey, monthProj]);

  // Eventos do dia selecionado
  const selectedDayEvents = monthEventsByDay.get(selectedDay) || [];

  // Totais do mês
  const totals = useMemo(() => {
    let pendingExpenses = 0;
    let paidExpenses = 0;
    let plannedIncome = 0;

    monthEventsByDay.forEach((events) => {
      events.forEach((e) => {
        if (e.type === "income") {
          plannedIncome += e.amount;
        } else {
          if (e.isRealized) {
            paidExpenses += e.amount;
          } else {
            pendingExpenses += e.amount;
          }
        }
      });
    });

    return {
      pendingExpenses,
      paidExpenses,
      plannedIncome,
      totalExpenses: pendingExpenses + paidExpenses,
    };
  }, [monthEventsByDay]);

  // Ação de Dar Baixa / Desfazer Baixa
  const handleToggleRealize = async (recurringItemId: string, isRealized: boolean) => {
    const item = recurringItems.find((r) => r.id === recurringItemId);
    if (!item) return;

    setActionLoadingId(recurringItemId);
    try {
      if (isRealized) {
        await unrealizeRecurringItem(item, targetYear, targetMonth);
        setFeedbackMsg(`Previsão "${item.title}" restaurada para pendente.`);
      } else {
        await realizeRecurringItemNow(item, targetYear, targetMonth);
        setFeedbackMsg(`Conta "${item.title}" baixada como realizada! ✅`);
      }
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err) {
      console.error("Erro ao alterar status da ocorrência:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const weekDayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="w-full rounded-[24px] sm:rounded-[32px] bg-white/90 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-3.5 sm:p-7 space-y-5 sm:space-y-6">
      {/* 1. CABEÇALHO DO CALENDÁRIO COM NAVEGAÇÃO E TOTAIS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.05] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-[#1D1D1F]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
              Calendário Financeiro Interativo
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] capitalize mt-0.5">
            {MONTH_NAMES_PT[targetMonth]} de {targetYear}
          </h2>
        </div>

        {/* Controles de Navegação */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleCurrentMonth}
            className="px-3 py-1.5 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold transition-colors cursor-pointer"
          >
            Mês Atual
          </button>
          <div className="flex items-center gap-1 bg-[#F2F2F7] p-1 rounded-full border border-black/5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-full bg-white hover:bg-[#E5E5EA] text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              title="Mês anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-7 h-7 rounded-full bg-white hover:bg-[#E5E5EA] text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              title="Próximo mês"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE RESUMO FINANCEIRO DO MÊS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3 rounded-2xl bg-[#FAFAFC] border border-black/[0.04]">
          <span className="text-[10px] text-[#86868B] block font-medium">Pendente a Pagar</span>
          <strong className="text-sm sm:text-base font-bold font-mono text-amber-600 tabular-nums">
            R$ {formatCurrency(totals.pendingExpenses)}
          </strong>
        </div>
        <div className="p-3 rounded-2xl bg-[#FAFAFC] border border-black/[0.04]">
          <span className="text-[10px] text-[#86868B] block font-medium">Já Quitado / Pago</span>
          <strong className="text-sm sm:text-base font-bold font-mono text-emerald-600 tabular-nums">
            R$ {formatCurrency(totals.paidExpenses)}
          </strong>
        </div>
        <div className="p-3 rounded-2xl bg-[#FAFAFC] border border-black/[0.04]">
          <span className="text-[10px] text-[#86868B] block font-medium">Total de Saídas</span>
          <strong className="text-sm sm:text-base font-bold font-mono text-[#1D1D1F] tabular-nums">
            R$ {formatCurrency(totals.totalExpenses)}
          </strong>
        </div>
        <div className="p-3 rounded-2xl bg-[#FAFAFC] border border-black/[0.04]">
          <span className="text-[10px] text-[#86868B] block font-medium">Entradas Previstas</span>
          <strong className="text-sm sm:text-base font-bold font-mono text-blue-600 tabular-nums">
            R$ {formatCurrency(totals.plannedIncome)}
          </strong>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in zoom-in-95">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 3. GRADE DO CALENDÁRIO MENSAL */}
      <div className="space-y-2">
        {/* Dias da Semana */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs font-bold text-[#86868B] py-1">
          {weekDayLabels.map((lbl) => (
            <div key={lbl}>{lbl}</div>
          ))}
        </div>

        {/* Células dos Dias */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Espaços vazios antes do dia 1 */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div
              key={`empty_${i}`}
              className="h-13 sm:h-20 rounded-xl sm:rounded-2xl bg-[#F2F2F7]/40 border border-transparent"
            />
          ))}

          {/* Dias válidos do mês */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const events = monthEventsByDay.get(day) || [];
            const isToday =
              day === now.getDate() &&
              targetMonth === now.getMonth() &&
              targetYear === now.getFullYear();
            const isSelected = day === selectedDay;

            // Classificação dos pontos
            const hasPendingExpense = events.some((e) => e.type !== "income" && !e.isRealized);
            const hasPaidExpense = events.some((e) => e.type !== "income" && e.isRealized);
            const hasIncome = events.some((e) => e.type === "income");

            return (
              <button
                key={`day_${day}`}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`h-13 sm:h-20 p-1 sm:p-2 rounded-xl sm:rounded-2xl flex flex-col justify-between transition-all select-none cursor-pointer border text-left ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white shadow-md border-black scale-[1.02] z-10"
                    : isToday
                    ? "bg-amber-500/10 border-amber-400/40 text-[#1D1D1F] hover:bg-amber-500/20"
                    : "bg-[#FAFAFC] hover:bg-[#F2F2F7] border-black/[0.04] text-[#1D1D1F]"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-bold font-mono ${
                      isSelected
                        ? "text-white"
                        : isToday
                        ? "text-amber-700 font-extrabold"
                        : "text-[#1D1D1F]"
                    }`}
                  >
                    {day}
                  </span>
                  {events.length > 0 && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-black/5 text-[#86868B]"
                      }`}
                    >
                      {events.length}
                    </span>
                  )}
                </div>

                {/* Marcadores Coloridos de Lançamentos */}
                <div className="flex items-center gap-1 overflow-hidden pt-1">
                  {hasPendingExpense && (
                    <span
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                        isSelected ? "bg-amber-400" : "bg-amber-500"
                      }`}
                      title="Contas a pagar pendentes"
                    />
                  )}
                  {hasPaidExpense && (
                    <span
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                        isSelected ? "bg-emerald-300" : "bg-emerald-500"
                      }`}
                      title="Contas já quitadas"
                    />
                  )}
                  {hasIncome && (
                    <span
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                        isSelected ? "bg-blue-300" : "bg-blue-500"
                      }`}
                      title="Receitas previstas"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. DETALHAMENTO DO DIA SELECIONADO */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-3">
        <div className="flex items-center justify-between border-b border-black/5 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
              Lançamentos do Dia {selectedDay} de {MONTH_NAMES_PT[targetMonth]}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 text-[#1D1D1F] font-bold">
              {selectedDayEvents.length} registro{selectedDayEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          <span className="text-xs font-mono font-bold text-[#1D1D1F]">
            Total: R${" "}
            {formatCurrency(
              selectedDayEvents.reduce((acc, e) => (e.type === "income" ? acc : acc + e.amount), 0)
            )}
          </span>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#86868B] space-y-1">
            <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
            <p>Nenhuma conta ou receita agendada para o dia {selectedDay}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDayEvents.map((event) => (
              <div
                key={event.id}
                className="p-3.5 rounded-xl bg-white border border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-black/15 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      event.type === "income"
                        ? "bg-blue-50 text-blue-600"
                        : event.type === "credit_invoice"
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {event.type === "income" ? (
                      <ArrowDownLeft size={16} />
                    ) : event.type === "credit_invoice" ? (
                      <CreditCard size={16} />
                    ) : (
                      <Building2 size={16} />
                    )}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-[#1D1D1F] truncate block">
                        {event.title}
                      </strong>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          event.isRealized
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {event.isRealized
                          ? event.type === "income"
                            ? "Recebido"
                            : "Quitado / Pago"
                          : "Pendente"}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#86868B] block truncate">
                      {event.accountOrCard}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5">
                  <strong className="text-sm sm:text-base font-bold font-mono tabular-nums text-[#1D1D1F]">
                    {event.type === "income" ? "+" : "−"} R$ {formatCurrency(event.amount)}
                  </strong>

                  {/* Botão de 1 toque para dar baixa ou desfazer */}
                  {event.recurringItemId && (
                    <button
                      type="button"
                      disabled={actionLoadingId === event.recurringItemId}
                      onClick={() => handleToggleRealize(event.recurringItemId!, event.isRealized)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px] ${
                        event.isRealized
                          ? "bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F]"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95"
                      }`}
                    >
                      {actionLoadingId === event.recurringItemId ? (
                        <span>Processando...</span>
                      ) : event.isRealized ? (
                        <>
                          <RotateCcw size={12} />
                          <span>Desfazer</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} />
                          <span>Dar Baixa</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
