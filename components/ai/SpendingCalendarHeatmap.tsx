"use client";

import React, { useState, useMemo } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Building2,
  AlertTriangle,
  Zap,
  TrendingUp,
  Coins,
  ShieldCheck,
  Check,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { MONTH_NAMES_PT, getPeriodKey, get5thBusinessDay } from "@/lib/utils/dateUtils";

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

  // Navegação
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

  // Contabilidade dos dias do mês
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(targetYear, targetMonth, 1).getDay(); // 0 = Domingo
  const fifthBusinessDay = useMemo(() => get5thBusinessDay(targetYear, targetMonth), [targetYear, targetMonth]);

  // Indexa eventos por dia
  const calendarData = useMemo(() => {
    const dayMap = new Map<
      number,
      {
        totalExpense: number;
        totalIncome: number;
        hasPayday: boolean;
        hasCardInvoice: boolean;
        hasUrgentBill: boolean;
        items: Array<{
          id: string;
          title: string;
          amount: number;
          type: "expense" | "income" | "credit_invoice";
          isPaid: boolean;
          sourceObj?: any;
        }>;
      }
    >();

    for (let d = 1; d <= daysInMonth; d++) {
      dayMap.set(d, {
        totalExpense: 0,
        totalIncome: 0,
        hasPayday: d === fifthBusinessDay,
        hasCardInvoice: false,
        hasUrgentBill: false,
        items: [],
      });
    }

    // 1. Contas Recorrentes
    for (const item of recurringItems) {
      if (item.active === false) continue;
      let day = item.dueDay || 10;
      if (item.recurrenceType === "business_day_5") {
        day = fifthBusinessDay;
      }
      if (day < 1) day = 1;
      if (day > daysInMonth) day = daysInMonth;

      const isIncome = item.type === "income";
      const isPaid = Boolean(
        item.realizedPeriods?.includes(currentPeriodKey) ||
          transactions.some(
            (tx: any) => tx.recurringItemId === item.id && tx.periodKey === currentPeriodKey
          )
      );

      const cell = dayMap.get(day);
      if (cell) {
        if (isIncome) {
          cell.totalIncome += item.amount;
        } else {
          cell.totalExpense += item.amount;
          if (!isPaid && isCurrentMonth && day <= now.getDate() + 3) {
            cell.hasUrgentBill = true;
          }
        }
        cell.items.push({
          id: `rec_${item.id}`,
          title: item.title,
          amount: item.amount,
          type: isIncome ? "income" : "expense",
          isPaid,
          sourceObj: item,
        });
      }
    }

    // 2. Faturas de Cartão
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
          cell.totalExpense += invoiceAmount;
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

    // 3. Transações Lançadas no Mês
    for (const tx of transactions) {
      if (tx.kind === "invoice_settlement") continue;
      if (!tx.date) continue;
      const txDate = new Date(tx.date);
      if (txDate.getFullYear() === targetYear && txDate.getMonth() === targetMonth) {
        const d = txDate.getDate();
        const cell = dayMap.get(d);
        if (cell) {
          if (tx.type === "income") {
            cell.totalIncome += tx.amount;
          } else {
            cell.totalExpense += tx.amount;
          }
          cell.items.push({
            id: tx.id,
            title: tx.title || tx.description || "Lançamento",
            amount: tx.amount,
            type: tx.type === "income" ? "income" : "expense",
            isPaid: true,
          });
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
    totalExpense: 0,
    totalIncome: 0,
    hasPayday: false,
    hasCardInvoice: false,
    hasUrgentBill: false,
    items: [],
  };

  // Totais do mês
  const monthlyTotals = useMemo(() => {
    let expense = 0;
    let income = 0;
    calendarData.forEach((day) => {
      expense += day.totalExpense;
      income += day.totalIncome;
    });
    return { expense, income, balance: income - expense };
  }, [calendarData]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Nível de calor para a cor de fundo do dia
  const getHeatmapColor = (dayExpense: number, isSelected: boolean, isToday: boolean) => {
    if (isSelected) {
      return "ring-2 ring-[#1D1D1F] bg-[#1D1D1F] text-white shadow-md";
    }
    if (isToday) {
      return "ring-2 ring-blue-500 bg-blue-50/80 text-blue-900 font-bold";
    }
    if (dayExpense === 0) {
      return "bg-[#FAFAFC] text-[#1D1D1F] hover:bg-[#F2F2F7]";
    }
    if (dayExpense < 100) {
      return "bg-emerald-50/70 text-emerald-950 border-emerald-200/50 hover:bg-emerald-100/60";
    }
    if (dayExpense < 400) {
      return "bg-amber-50/80 text-amber-950 border-amber-200/60 hover:bg-amber-100/70";
    }
    return "bg-rose-50/90 text-rose-950 border-rose-200/70 hover:bg-rose-100/80";
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/[0.05] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
            <CalendarDays size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#1D1D1F] capitalize">
                {MONTH_NAMES_PT[targetMonth]} de {targetYear}
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Linha do Tempo de Liquidez
              </span>
            </div>
            <p className="text-xs text-[#86868B]">
              Mapa de calor diário de saídas, vencimentos e datas de fechamento sem surpresas.
            </p>
          </div>
        </div>

        {/* Controles de Navegação */}
        <div className="flex items-center gap-2 self-start md:self-auto">
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

      {/* 2. BARRA DE HORIZONTE DE CAIXA (CASH RUNWAY GAUGES) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1">
          <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">
            Despesas Previstas no Mês
          </span>
          <strong className="text-lg font-bold font-mono text-[#1D1D1F] block tabular-nums">
            R$ {formatCurrency(monthlyTotals.expense)}
          </strong>
          <span className="text-[10px] text-[#86868B]">
            Fixas agendadas + faturas de cartão
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1">
          <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">
            Teto Diário Seguro Hoje
          </span>
          <strong className="text-lg font-bold font-mono text-emerald-600 block tabular-nums">
            R$ {formatCurrency(safeDailyAllowance)}/dia
          </strong>
          <span className="text-[10px] text-[#86868B]">
            Preserva o alvo de R$ {formatCurrency(targetEndMonthBalance)}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1">
          <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">
            Saldo Disponível Hoje
          </span>
          <strong className="text-lg font-bold font-mono text-[#1D1D1F] block tabular-nums">
            R$ {formatCurrency(mainBalance)}
          </strong>
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Conta protegida contra despesas
          </span>
        </div>
      </div>

      {/* 3. GRADE PRINCIPAL: CALENDÁRIO + PAINEL DO DIA SELECIONADO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CALENDÁRIO MENSAL EM GRADE (7 COLUNAS) */}
        <div className="lg:col-span-7 space-y-2">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-[#86868B] uppercase tracking-wider pb-1">
            {weekLabels.map((w, idx) => (
              <span key={idx}>{w}</span>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Espaços vazios antes do 1º dia */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty_${i}`} className="h-14 sm:h-16 rounded-xl bg-transparent" />
            ))}

            {/* Dias reais do mês */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const cell = calendarData.get(day);
              const isSelected = selectedDay === day;
              const isToday = isCurrentMonth && day === now.getDate();
              const hasEvents = (cell?.items.length || 0) > 0;
              const style = getHeatmapColor(cell?.totalExpense || 0, isSelected, isToday);

              return (
                <button
                  key={`day_${day}`}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`h-14 sm:h-16 rounded-2xl p-1.5 flex flex-col justify-between text-left transition-all cursor-pointer border border-black/[0.04] relative group active:scale-95 ${style}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold">{day}</span>

                    {/* Marcadores de Tipo de Evento */}
                    <div className="flex items-center gap-0.5">
                      {cell?.hasPayday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Dia de Pagamento" />
                      )}
                      {cell?.hasCardInvoice && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Vencimento de Fatura" />
                      )}
                      {cell?.hasUrgentBill && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Conta Urgente" />
                      )}
                    </div>
                  </div>

                  {/* Valor de Saída no Dia se houver */}
                  {cell && cell.totalExpense > 0 && (
                    <div className="text-[10px] font-mono font-bold truncate tabular-nums">
                      R$ {cell.totalExpense > 999 ? `${(cell.totalExpense / 1000).toFixed(1)}k` : Math.round(cell.totalExpense)}
                    </div>
                  )}

                  {cell && cell.totalIncome > 0 && cell.totalExpense === 0 && (
                    <div className="text-[10px] font-mono font-bold text-emerald-600 truncate tabular-nums">
                      +R$ {Math.round(cell.totalIncome)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda do Mapa de Calor */}
          <div className="flex items-center justify-between text-[11px] text-[#86868B] pt-2 px-1">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-md bg-[#FAFAFC] border border-black/10" />
                <span>R$ 0</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-md bg-emerald-100 border border-emerald-300" />
                <span>Até R$ 100</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-md bg-amber-100 border border-amber-300" />
                <span>R$ 100 - R$ 400</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-md bg-rose-100 border border-rose-300" />
                <span>R$ 400+</span>
              </span>
            </div>
            <span className="hidden sm:inline font-mono text-[10px]">Toque em um dia para ver</span>
          </div>
        </div>

        {/* PAINEL LATERAL: DETALHES DO DIA SELECIONADO */}
        <div className="lg:col-span-5 bg-[#FAFAFC] rounded-3xl p-4 sm:p-5 border border-black/[0.05] space-y-4">
          <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
            <div>
              <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">
                Detalhamento do Dia
              </span>
              <h4 className="text-base font-bold text-[#1D1D1F]">
                {selectedDay} de {MONTH_NAMES_PT[targetMonth]}
              </h4>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[#86868B] block">Total Previsto</span>
              <strong className="text-sm font-bold font-mono text-[#1D1D1F] tabular-nums">
                R$ {formatCurrency(selectedDayData.totalExpense)}
              </strong>
            </div>
          </div>

          {/* Lista de itens no dia */}
          {selectedDayData.items.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-white text-emerald-600 flex items-center justify-center mx-auto border border-black/5 shadow-2xs">
                <CheckCircle2 size={20} />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#1D1D1F]">Nenhuma conta para este dia</p>
                <p className="text-[11px] text-[#86868B]">
                  Dia livre de cobranças fixas ou faturas.
                </p>
              </div>
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
                        {item.isPaid ? "Realizada / Paga ✅" : "Pendente de quitação"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <strong className="font-mono font-bold text-xs tabular-nums text-[#1D1D1F]">
                      R$ {formatCurrency(item.amount)}
                    </strong>

                    {/* Botão Baixar Conta em 1 Clique */}
                    {item.sourceObj && !item.isPaid && onRealizeItem && (
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

          {/* Botão Perguntar ao Consultor sobre o dia */}
          <div className="pt-2 border-t border-black/[0.05]">
            <button
              type="button"
              onClick={() => {
                const prompt = `Auditor, analise as despesas agendadas para o dia ${selectedDay} de ${MONTH_NAMES_PT[targetMonth]} (total de R$ ${selectedDayData.totalExpense.toFixed(2)}). Haverá saldo suficiente sem comprometer a meta?`;
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
    </div>
  );
}
