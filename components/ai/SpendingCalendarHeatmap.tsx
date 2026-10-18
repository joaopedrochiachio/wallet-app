"use client";

import React, { useState, useMemo } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CreditCard,
  Building2,
  TrendingUp,
  Check,
  MessageSquare,
  Sparkles,
  Info,
} from "lucide-react";
import {
  MONTH_NAMES_PT,
  getPeriodKey,
  get5thBusinessDay,
  getEffectiveDueDay,
  getEffectiveRecurringItemForPeriod,
} from "@/lib/utils/dateUtils";

interface SpendingCalendarHeatmapProps {
  recurringItems: any[];
  cards: any[];
  transactions: any[];
  mainBalance: number;
  safeDailyAllowance: number;
  targetEndMonthBalance: number;
  monthlyProjection: any;
  onRealizeItem?: (recurringItem: any, year: number, month: number) => Promise<void>;
  onDiscussWithAI: (topic: string) => void;
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
  const now = new Date();
  const [targetYear, setTargetYear] = useState<number>(now.getFullYear());
  const [targetMonth, setTargetMonth] = useState<number>(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const currentPeriodKey = getPeriodKey(targetYear, targetMonth);
  const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === now.getMonth();

  // Navegação de meses
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

  const handleToday = () => {
    setTargetYear(now.getFullYear());
    setTargetMonth(now.getMonth());
    setSelectedDay(now.getDate());
  };

  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(targetYear, targetMonth, 1).getDay(); // 0 = Domingo
  const fifthBusinessDay = useMemo(() => get5thBusinessDay(targetYear, targetMonth), [targetYear, targetMonth]);

  // Indexação rigorosa dos eventos por dia DO MÊS ESPECÍFICO SELECIONADO
  const calendarData = useMemo(() => {
    const dayMap = new Map<
      number,
      {
        realizedSpent: number;
        scheduledExpenses: number;
        scheduledIncomes: number;
        hasPayday: boolean;
        hasCardInvoice: boolean;
        hasUrgentBill: boolean;
        items: Array<{
          id: string;
          title: string;
          amount: number;
          type: "expense" | "income" | "credit_invoice";
          isPaid: boolean;
          isCreditCharge?: boolean;
          sourceObj?: any;
        }>;
      }
    >();

    for (let d = 1; d <= daysInMonth; d++) {
      dayMap.set(d, {
        realizedSpent: 0,
        scheduledExpenses: 0,
        scheduledIncomes: 0,
        hasPayday: d === fifthBusinessDay,
        hasCardInvoice: false,
        hasUrgentBill: false,
        items: [],
      });
    }

    // 1. Filtragem Rigorosa de Contas Recorrentes para o MÊS SELECIONADO (targetYear/targetMonth)
    for (const rawItem of recurringItems) {
      if (rawItem.active === false) continue;

      // Verifica início do item
      const startYear = rawItem.startYear ?? (rawItem.createdAt ? new Date(rawItem.createdAt).getFullYear() : targetYear);
      const startMonth = rawItem.startMonth ?? (rawItem.createdAt ? new Date(rawItem.createdAt).getMonth() : targetMonth);
      const monthOffset = (targetYear - startYear) * 12 + (targetMonth - startMonth);

      // Se ainda não começou na competência selecionada, ignora
      if (monthOffset < 0) continue;

      // Se é parcelado e o número de parcelas já se esgotou antes deste mês, ignora
      if (rawItem.installmentsCount && rawItem.installmentsCount > 0 && monthOffset >= rawItem.installmentsCount) {
        continue;
      }

      // Se foi excluído pontualmente neste mês, ignora
      if (rawItem.excludedPeriods && rawItem.excludedPeriods.includes(currentPeriodKey)) {
        continue;
      }

      // Se foi deletado via override neste mês, ignora
      if (rawItem.overrides && rawItem.overrides[currentPeriodKey]?.isDeleted) {
        continue;
      }

      // Obtém os dados efetivos com override para este mês
      const item = getEffectiveRecurringItemForPeriod(rawItem, currentPeriodKey);

      // Calcula o dia de vencimento real neste mês
      const day = getEffectiveDueDay(item, targetYear, targetMonth);
      if (day < 1 || day > daysInMonth) continue;

      const isIncome = item.type === "income";

      // Verifica se é cobrado no cartão de crédito
      const isCreditCharge = Boolean(
        item.cardId ||
        cards.some(
          (c: any) =>
            c.type === "credit" &&
            (c.id === item.account || c.name.trim().toLowerCase() === (item.account || "").trim().toLowerCase())
        )
      );

      // Verifica se já foi baixado / realizado
      const isPaid = Boolean(
        rawItem.realizedPeriods?.includes(currentPeriodKey) ||
        transactions.some(
          (tx: any) =>
            tx.recurringItemId === rawItem.id &&
            (tx.periodKey === currentPeriodKey || (tx.date && tx.date.startsWith(currentPeriodKey)))
        )
      );

      const cell = dayMap.get(day);
      if (cell) {
        if (isIncome) {
          cell.scheduledIncomes += item.amount;
        } else {
          // Apenas despesas que saem da conta (não de cartão) entram como saída de caixa direto
          if (!isCreditCharge) {
            cell.scheduledExpenses += item.amount;
            if (!isPaid && isCurrentMonth && day <= now.getDate() + 3) {
              cell.hasUrgentBill = true;
            }
          }
        }

        cell.items.push({
          id: `rec_${rawItem.id}`,
          title: item.title,
          amount: item.amount,
          type: isIncome ? "income" : "expense",
          isPaid,
          isCreditCharge,
          sourceObj: rawItem,
        });
      }
    }

    // 2. Faturas de Cartão de Crédito do Mês
    for (const card of cards) {
      if (card.type && card.type !== "credit") continue;
      let day = card.dueDay || 10;
      if (day > daysInMonth) day = daysInMonth;

      const cardInvoice = monthlyProjection?.cardInvoices?.find(
        (inv: any) => inv.cardId === card.id
      );
      const invoiceAmount = cardInvoice ? cardInvoice.totalInvoice : (card.spent || 0);
      const isPaid = cardInvoice ? cardInvoice.isPaid : false;

      if (invoiceAmount > 0) {
        const cell = dayMap.get(day);
        if (cell) {
          cell.scheduledExpenses += invoiceAmount;
          cell.hasCardInvoice = true;
          cell.items.push({
            id: `card_${card.id}`,
            title: `Fatura ${card.name}`,
            amount: invoiceAmount,
            type: "credit_invoice",
            isPaid,
          });
        }
      }
    }

    // 3. Gastos REAIS já realizados (apenas de transações do mês)
    for (const tx of transactions) {
      if (tx.kind === "invoice_settlement") continue;
      if (!tx.date) continue;
      const txDate = new Date(tx.date);
      if (txDate.getFullYear() === targetYear && txDate.getMonth() === targetMonth) {
        const d = txDate.getDate();
        const cell = dayMap.get(d);
        if (cell) {
          if (tx.type === "expense" || tx.type === "despesa") {
            cell.realizedSpent += tx.amount;
          }
        }
      }
    }

    return dayMap;
  }, [
    daysInMonth,
    fifthBusinessDay,
    recurringItems,
    cards,
    transactions,
    currentPeriodKey,
    monthlyProjection,
    targetYear,
    targetMonth,
    isCurrentMonth,
  ]);

  const selectedDayData = calendarData.get(selectedDay) || {
    realizedSpent: 0,
    scheduledExpenses: 0,
    scheduledIncomes: 0,
    hasPayday: false,
    hasCardInvoice: false,
    hasUrgentBill: false,
    items: [],
  };

  // Totais do mês
  const monthlyTotals = useMemo(() => {
    let expense = 0;
    let income = 0;
    let totalRealized = 0;
    calendarData.forEach((day) => {
      expense += day.scheduledExpenses;
      income += day.scheduledIncomes;
      totalRealized += day.realizedSpent;
    });
    return { expense, income, totalRealized };
  }, [calendarData]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const handlePay = async (item: any) => {
    if (!onRealizeItem || !item.sourceObj) return;
    setActionLoadingId(item.id);
    try {
      await onRealizeItem(item.sourceObj, targetYear, targetMonth);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="w-full rounded-[28px] sm:rounded-[36px] bg-white border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-4 sm:p-7 space-y-6">
      {/* 1. TOPO: TÍTULO, NAVEGAÇÃO E HORIZONTE DE CAIXA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.05] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarDays size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#1D1D1F] capitalize">
                {MONTH_NAMES_PT[targetMonth]} de {targetYear}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Calendário Apple
              </span>
            </div>
            <p className="text-xs text-[#86868B]">
              Vencimentos e gastos reais sincronizados com o livro-caixa.
            </p>
          </div>
        </div>

        {/* Controles de Navegação */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleToday}
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

      {/* 2. GRADE DO CALENDÁRIO ESTILO APPLE CLEAN (SEM QUADRICULADOS CHEIOS DE R$) */}
      <div className="space-y-2">
        {/* Dias da Semana */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[#86868B] uppercase tracking-wider pb-1">
          {weekLabels.map((w, idx) => (
            <span key={idx}>{w}</span>
          ))}
        </div>

        {/* Grade de Dias */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Espaços antes do 1º dia */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty_${i}`} className="aspect-square rounded-2xl bg-transparent" />
          ))}

          {/* Dias reais */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const cell = calendarData.get(day);
            const isSelected = selectedDay === day;
            const isToday = isCurrentMonth && day === now.getDate();
            const hasBills = (cell?.items.length || 0) > 0;
            const hasRealizedSpend = (cell?.realizedSpent || 0) > 0;

            return (
              <button
                key={`day_${day}`}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`aspect-square rounded-2xl p-1 sm:p-2 flex flex-col justify-between items-center transition-all cursor-pointer relative group active:scale-95 border ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white border-black shadow-md ring-2 ring-black/10"
                    : isToday
                    ? "bg-blue-50/90 text-blue-900 border-blue-300 font-bold"
                    : "bg-[#FAFAFC] hover:bg-[#F2F2F7] text-[#1D1D1F] border-black/[0.04]"
                }`}
              >
                {/* Número do Dia */}
                <span className="text-xs sm:text-sm font-semibold leading-none mt-1">
                  {day}
                </span>

                {/* Centro: Mostra o gasto real se houver, ou bolinha de status */}
                <div className="flex flex-col items-center justify-center my-auto">
                  {hasRealizedSpend ? (
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono font-bold leading-none ${
                        isSelected ? "text-emerald-300" : "text-emerald-700"
                      }`}
                    >
                      R$ {Math.round(cell!.realizedSpent)}
                    </span>
                  ) : hasBills ? (
                    <div className="flex items-center gap-1">
                      {cell?.hasPayday && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {cell?.hasCardInvoice && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                      {cell?.items.some((it) => it.type === "expense" && !it.isCreditCharge) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Rodapé do dia */}
                <span className="h-1.5 w-1.5" />
              </button>
            );
          })}
        </div>

        {/* Legenda Discreta */}
        <div className="flex items-center justify-between text-[11px] text-[#86868B] pt-2 px-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Salário / Renda</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Conta Fixa</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>Fatura de Cartão</span>
            </span>
          </div>
          <span className="hidden sm:inline font-mono text-[10px]">
            Toque em um dia para ver
          </span>
        </div>
      </div>

      {/* 3. PAINEL DO DIA SELECIONADO (DETALHAMENTO CONCISO E CORRETO) */}
      <div className="bg-[#FAFAFC] rounded-3xl p-4 sm:p-5 border border-black/[0.05] space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
          <div>
            <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">
              Detalhamento da Data
            </span>
            <h4 className="text-base font-bold text-[#1D1D1F]">
              {selectedDay} de {MONTH_NAMES_PT[targetMonth]}
            </h4>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-[#86868B] block">Gasto Realizado</span>
            <strong className="text-sm font-bold font-mono text-emerald-600 tabular-nums">
              R$ {formatCurrency(selectedDayData.realizedSpent)}
            </strong>
          </div>
        </div>

        {/* Lista de Eventos Válidos da Data */}
        {selectedDayData.items.length === 0 && selectedDayData.realizedSpent === 0 ? (
          <div className="py-6 text-center space-y-1">
            <CheckCircle2 size={22} className="mx-auto text-emerald-500" />
            <p className="text-xs font-semibold text-[#1D1D1F]">Dia sem cobranças ou saídas</p>
            <p className="text-[11px] text-[#86868B]">
              Nenhum vencimento de conta ou fatura agendado para esta data.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
            {selectedDayData.items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-white border border-black/[0.05] shadow-2xs flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === "credit_invoice"
                        ? "bg-indigo-50 text-indigo-700"
                        : item.type === "income"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {item.type === "credit_invoice" ? (
                      <CreditCard size={15} />
                    ) : item.type === "income" ? (
                      <TrendingUp size={15} />
                    ) : (
                      <Building2 size={15} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <strong className="block font-semibold text-[#1D1D1F] truncate">
                      {item.title}
                    </strong>
                    <span className="text-[10px] text-[#86868B]">
                      {item.isPaid
                        ? "Quitada / Paga ✅"
                        : item.isCreditCharge
                        ? "No cartão • Fatura do mês"
                        : "Pendente em conta corrente"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <strong className="font-mono font-bold text-xs tabular-nums text-[#1D1D1F]">
                    R$ {formatCurrency(item.amount)}
                  </strong>

                  {/* Baixa com 1 Toque: Somente para contas reais de débito em conta corrente pendentes */}
                  {!item.isCreditCharge && item.type === "expense" && !item.isPaid && onRealizeItem && (
                    <button
                      type="button"
                      onClick={() => handlePay(item)}
                      disabled={actionLoadingId === item.id}
                      className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                    >
                      <Check size={11} />
                      <span>{actionLoadingId === item.id ? "Baixando..." : "Baixar"}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botão Perguntar ao Consultor */}
        <div className="pt-2 border-t border-black/[0.05]">
          <button
            type="button"
            onClick={() => {
              const prompt = `Auditor, analise as movimentações do dia ${selectedDay} de ${MONTH_NAMES_PT[targetMonth]} (gasto real de R$ ${selectedDayData.realizedSpent.toFixed(2)}). Qual a sua recomendação contábil para manter a meta?`;
              onDiscussWithAI(prompt);
            }}
            className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#F2F2F7] active:scale-95 text-[#1D1D1F] border border-black/[0.08] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <MessageSquare size={13} className="text-blue-600" />
            <span>Consultar Impacto deste Dia com o Auditor</span>
          </button>
        </div>
      </div>
    </div>
  );
}
