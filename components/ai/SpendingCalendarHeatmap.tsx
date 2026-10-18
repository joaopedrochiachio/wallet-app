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
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  MONTH_NAMES_PT,
  getPeriodKey,
  get5thBusinessDay,
  getEffectiveDueDay,
  getEffectiveRecurringItemForPeriod,
} from "@/lib/utils/dateUtils";

interface CalendarTransactionItem {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  category?: string;
  account?: string;
  cardName?: string;
  dateStr: string;
  timeStr?: string;
}

interface CalendarBillItem {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income" | "credit_invoice";
  isPaid: boolean;
  isCreditCharge?: boolean;
  sourceObj?: any;
}

interface DayData {
  day: number;
  realizedIncome: number;
  realizedExpense: number;
  dayNet: number;
  transactions: CalendarTransactionItem[];
  bills: CalendarBillItem[];
  hasPayday: boolean;
  hasCardInvoice: boolean;
  hasUrgentBill: boolean;
}

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

  // Navegação de mês
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
  const firstDayOfWeek = new Date(targetYear, targetMonth, 1).getDay(); // 0 = Dom
  const fifthBusinessDay = useMemo(() => get5thBusinessDay(targetYear, targetMonth), [targetYear, targetMonth]);

  // Indexação diária de Transações Reais e Contas Programadas
  const calendarData = useMemo(() => {
    const dayMap = new Map<number, DayData>();

    for (let d = 1; d <= daysInMonth; d++) {
      dayMap.set(d, {
        day: d,
        realizedIncome: 0,
        realizedExpense: 0,
        dayNet: 0,
        transactions: [],
        bills: [],
        hasPayday: d === fifthBusinessDay,
        hasCardInvoice: false,
        hasUrgentBill: false,
      });
    }

    // 1. PROCESSA TODAS AS TRANSAÇÕES REAIS DO MÊS
    for (const tx of transactions) {
      if (tx.kind === "invoice_settlement") continue;
      if (!tx.date) continue;

      let txDate: Date;
      if (typeof tx.date === "string") {
        // Suporta tanto YYYY-MM-DD quanto ISO strings
        const parts = tx.date.split("T")[0].split("-");
        if (parts.length === 3) {
          txDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          txDate = new Date(tx.date);
        }
      } else {
        txDate = new Date(tx.date);
      }

      if (txDate.getFullYear() === targetYear && txDate.getMonth() === targetMonth) {
        const d = txDate.getDate();
        const cell = dayMap.get(d);
        if (cell) {
          const rawAmount = typeof tx.amount === "number" ? Math.abs(tx.amount) : 0;
          const isIncome = tx.type === "income" || tx.type === "receita" || tx.kind === "income";

          if (isIncome) {
            cell.realizedIncome += rawAmount;
          } else {
            cell.realizedExpense += rawAmount;
          }

          cell.dayNet = cell.realizedIncome - cell.realizedExpense;

          let timeStr = "";
          if (typeof tx.date === "string" && tx.date.includes("T")) {
            const timePart = tx.date.split("T")[1];
            if (timePart) timeStr = timePart.substring(0, 5);
          }

          cell.transactions.push({
            id: tx.id || `tx_${Math.random()}`,
            title: tx.title || tx.description || (isIncome ? "Entrada diversa" : "Despesa diversa"),
            amount: rawAmount,
            type: isIncome ? "income" : "expense",
            category: tx.category || (isIncome ? "Renda" : "Geral"),
            account: tx.account || tx.accountName,
            cardName: tx.cardName || (tx.cardId ? cards.find((c: any) => c.id === tx.cardId)?.name : undefined),
            dateStr: tx.date,
            timeStr,
          });
        }
      }
    }

    // 2. PROCESSA CONTAS RECORRENTES VÁLIDAS PARA O MÊS ESPECÍFICO
    for (const rawItem of recurringItems) {
      if (rawItem.active === false) continue;

      const startYear = rawItem.startYear ?? (rawItem.createdAt ? new Date(rawItem.createdAt).getFullYear() : targetYear);
      const startMonth = rawItem.startMonth ?? (rawItem.createdAt ? new Date(rawItem.createdAt).getMonth() : targetMonth);
      const monthOffset = (targetYear - startYear) * 12 + (targetMonth - startMonth);

      if (monthOffset < 0) continue;
      if (rawItem.installmentsCount && rawItem.installmentsCount > 0 && monthOffset >= rawItem.installmentsCount) continue;
      if (rawItem.excludedPeriods && rawItem.excludedPeriods.includes(currentPeriodKey)) continue;
      if (rawItem.overrides && rawItem.overrides[currentPeriodKey]?.isDeleted) continue;

      const item = getEffectiveRecurringItemForPeriod(rawItem, currentPeriodKey);
      const day = getEffectiveDueDay(item, targetYear, targetMonth);
      if (day < 1 || day > daysInMonth) continue;

      const isIncome = item.type === "income";
      const isCreditCharge = Boolean(
        item.cardId ||
        cards.some(
          (c: any) =>
            c.type === "credit" &&
            (c.id === item.account || c.name.trim().toLowerCase() === (item.account || "").trim().toLowerCase())
        )
      );

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
        if (!isIncome && !isCreditCharge && !isPaid && isCurrentMonth && day <= now.getDate() + 3) {
          cell.hasUrgentBill = true;
        }

        cell.bills.push({
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

    // 3. FATURAS DE CARTÃO DE CRÉDITO DO MÊS
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
          cell.hasCardInvoice = true;
          cell.bills.push({
            id: `card_${card.id}`,
            title: `Fatura ${card.name}`,
            amount: invoiceAmount,
            type: "credit_invoice",
            isPaid,
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

  const selectedDayData: DayData = calendarData.get(selectedDay) || {
    day: selectedDay,
    realizedIncome: 0,
    realizedExpense: 0,
    dayNet: 0,
    transactions: [],
    bills: [],
    hasPayday: false,
    hasCardInvoice: false,
    hasUrgentBill: false,
  };

  // Totais consolidados do mês
  const monthlyTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let daysWithTransactions = 0;

    calendarData.forEach((day) => {
      income += day.realizedIncome;
      expense += day.realizedExpense;
      if (day.transactions.length > 0) daysWithTransactions++;
    });

    const net = income - expense;
    return { income, expense, net, daysWithTransactions };
  }, [calendarData]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const handlePay = async (bill: CalendarBillItem) => {
    if (!onRealizeItem || !bill.sourceObj) return;
    setActionLoadingId(bill.id);
    try {
      await onRealizeItem(bill.sourceObj, targetYear, targetMonth);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Dia da semana por extenso para a data selecionada
  const selectedDateObj = new Date(targetYear, targetMonth, selectedDay);
  const dayOfWeekName = selectedDateObj.toLocaleDateString("pt-BR", { weekday: "long" });

  return (
    <div className="w-full rounded-[28px] sm:rounded-[36px] bg-white border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-4 sm:p-7 space-y-6">
      {/* 1. CABEÇALHO & NAVEGAÇÃO DE MÊS */}
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
                Extrato Diário Sincronizado
              </span>
            </div>
            <p className="text-xs text-[#86868B]">
              Histórico de entradas e saídas reais dia a dia, integrado aos vencimentos.
            </p>
          </div>
        </div>

        {/* Controles de Navegação */}
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
            Mês Atual
          </button>
          <div className="flex items-center bg-[#F2F2F7] rounded-xl p-0.5 border border-black/[0.05]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white text-[#1D1D1F] transition-all cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white text-[#1D1D1F] transition-all cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUMÁRIO CONSOLIDADO DO MÊS (KPIs APPLE WHITE) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 bg-[#F8F8FA] rounded-2xl border border-black/[0.04]">
        <div className="space-y-0.5">
          <span className="text-[10px] font-semibold text-[#86868B] flex items-center gap-1">
            <ArrowDownLeft size={11} className="text-emerald-600" />
            Entradas Reais
          </span>
          <strong className="text-xs sm:text-sm font-bold font-mono text-emerald-600 tabular-nums block">
            +R$ {formatCurrency(monthlyTotals.income)}
          </strong>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] font-semibold text-[#86868B] flex items-center gap-1">
            <ArrowUpRight size={11} className="text-rose-600" />
            Saídas Reais
          </span>
          <strong className="text-xs sm:text-sm font-bold font-mono text-rose-600 tabular-nums block">
            -R$ {formatCurrency(monthlyTotals.expense)}
          </strong>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] font-semibold text-[#86868B] flex items-center gap-1">
            <Wallet size={11} className="text-[#1D1D1F]" />
            Balanço Mensal
          </span>
          <strong
            className={`text-xs sm:text-sm font-bold font-mono tabular-nums block ${
              monthlyTotals.net >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {monthlyTotals.net >= 0 ? "+" : ""}R$ {formatCurrency(monthlyTotals.net)}
          </strong>
        </div>
      </div>

      {/* 3. GRID DO CALENDÁRIO COM GASTOS REAIS E INDICADORES DISCRETOS */}
      <div className="space-y-2">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 gap-1 text-center font-semibold text-[11px] text-[#86868B] uppercase tracking-wider py-1">
          {weekLabels.map((lbl) => (
            <div key={lbl}>{lbl}</div>
          ))}
        </div>

        {/* Células dos Dias */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Células vazias do início */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty_${i}`} className="aspect-square opacity-0 pointer-events-none" />
          ))}

          {/* Dias reais do mês */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const cell = calendarData.get(day);
            const isSelected = selectedDay === day;
            const isToday = isCurrentMonth && day === now.getDate();

            const hasSpent = (cell?.realizedExpense || 0) > 0;
            const hasIncome = (cell?.realizedIncome || 0) > 0;
            const hasBills = (cell?.bills.length || 0) > 0;

            return (
              <button
                key={`day_${day}`}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`aspect-square rounded-2xl p-1 sm:p-2 flex flex-col justify-between items-center transition-all cursor-pointer relative group active:scale-95 border ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white border-black shadow-md ring-2 ring-black/10"
                    : isToday
                    ? "bg-blue-50/80 text-blue-900 border-blue-300 font-bold"
                    : "bg-[#FAFAFC] hover:bg-[#F2F2F7] text-[#1D1D1F] border-black/[0.04]"
                }`}
              >
                {/* Linha Superior: Número do Dia */}
                <span className="text-xs sm:text-sm font-semibold leading-none mt-0.5 sm:mt-1">
                  {day}
                </span>

                {/* Centro: Mostra o gasto real se gastou naquele dia, ou entrada */}
                <div className="flex flex-col items-center justify-center my-auto min-w-0 w-full px-0.5">
                  {hasSpent ? (
                    <span
                      className={`text-[8.5px] sm:text-[10px] font-mono font-bold leading-none truncate max-w-full ${
                        isSelected ? "text-rose-300" : "text-rose-600"
                      }`}
                    >
                      -R${Math.round(cell!.realizedExpense)}
                    </span>
                  ) : hasIncome ? (
                    <span
                      className={`text-[8.5px] sm:text-[10px] font-mono font-bold leading-none truncate max-w-full ${
                        isSelected ? "text-emerald-300" : "text-emerald-600"
                      }`}
                    >
                      +R${Math.round(cell!.realizedIncome)}
                    </span>
                  ) : null}
                </div>

                {/* Rodapé: Pontos de Vencimento/Contas Programadas */}
                <div className="flex items-center gap-0.5 mb-0.5 h-1.5">
                  {cell?.hasPayday && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {cell?.hasCardInvoice && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  {cell?.bills.some((b) => b.type === "expense" && !b.isCreditCharge) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                  {!hasBills && !hasSpent && !hasIncome && (
                    <span className="w-1 h-1 rounded-full opacity-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legenda Discreta */}
        <div className="flex items-center justify-between text-[11px] text-[#86868B] pt-2 px-1 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="text-[10px] font-mono font-bold text-rose-600">-R$</span>
              <span>Gasto do dia</span>
            </span>
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
          <span className="font-mono text-[10px] text-[#86868B]">
            Toque em qualquer dia para inspecionar
          </span>
        </div>
      </div>

      {/* 4. PAINEL DE DETALHAMENTO DO DIA SELECIONADO (EXTRATO REAL DE ENTRADAS & SAÍDAS) */}
      <div className="bg-[#FAFAFC] rounded-3xl p-4 sm:p-6 border border-black/[0.05] space-y-5">
        {/* Cabeçalho do Dia */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.05] pb-3">
          <div>
            <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider block">
              Fechamento do Dia
            </span>
            <h4 className="text-base sm:text-lg font-bold text-[#1D1D1F] capitalize">
              {dayOfWeekName}, {selectedDay} de {MONTH_NAMES_PT[targetMonth]}
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onDiscussWithAI(
                  `Rubi, analise o meu dia ${selectedDay} de ${MONTH_NAMES_PT[targetMonth]}: entrou R$ ${formatCurrency(
                    selectedDayData.realizedIncome
                  )}, saiu R$ ${formatCurrency(selectedDayData.realizedExpense)}, com balanço de R$ ${formatCurrency(
                    selectedDayData.dayNet
                  )}. Qual o impacto na minha meta mensal?`
                )
              }
              className="px-3 py-1.5 rounded-full bg-white hover:bg-[#F2F2F7] active:scale-95 text-xs font-semibold text-[#1D1D1F] border border-black/[0.08] shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <MessageSquare size={13} className="text-rose-500" />
              <span>Consultar com Rubi (CFO)</span>
            </button>
          </div>
        </div>

        {/* Três Cards de Balanço do Dia */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white rounded-2xl p-3 border border-black/[0.05] shadow-2xs space-y-1">
            <span className="text-[10px] font-semibold text-[#86868B] block">Entrou Hoje</span>
            <strong className="text-sm sm:text-base font-bold font-mono text-emerald-600 tabular-nums block">
              +R$ {formatCurrency(selectedDayData.realizedIncome)}
            </strong>
            <span className="text-[9.5px] text-[#86868B] block">
              {selectedDayData.transactions.filter((t) => t.type === "income").length} entrada(s)
            </span>
          </div>

          <div className="bg-white rounded-2xl p-3 border border-black/[0.05] shadow-2xs space-y-1">
            <span className="text-[10px] font-semibold text-[#86868B] block">Saiu Hoje</span>
            <strong className="text-sm sm:text-base font-bold font-mono text-rose-600 tabular-nums block">
              -R$ {formatCurrency(selectedDayData.realizedExpense)}
            </strong>
            <span className="text-[9.5px] text-[#86868B] block">
              {selectedDayData.transactions.filter((t) => t.type === "expense").length} gasto(s)
            </span>
          </div>

          <div className="bg-white rounded-2xl p-3 border border-black/[0.05] shadow-2xs space-y-1">
            <span className="text-[10px] font-semibold text-[#86868B] block">Resultado do Dia</span>
            <strong
              className={`text-sm sm:text-base font-bold font-mono tabular-nums block ${
                selectedDayData.dayNet > 0
                  ? "text-emerald-600"
                  : selectedDayData.dayNet < 0
                  ? "text-rose-600"
                  : "text-[#1D1D1F]"
              }`}
            >
              {selectedDayData.dayNet > 0 ? "+" : ""}R$ {formatCurrency(selectedDayData.dayNet)}
            </strong>
            <span
              className={`text-[9.5px] font-semibold inline-block px-1.5 py-0.2 rounded-full ${
                selectedDayData.dayNet > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : selectedDayData.dayNet < 0
                  ? "bg-rose-50 text-rose-700"
                  : "bg-black/5 text-[#86868B]"
              }`}
            >
              {selectedDayData.dayNet > 0 ? "Superavitário" : selectedDayData.dayNet < 0 ? "Gasto no Dia" : "Neutro"}
            </span>
          </div>
        </div>

        {/* 4.1 EXTRATO DAS TRANSAÇÕES REAIS OCORRIDAS NESTE DIA */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5">
              <Receipt size={14} className="text-[#86868B]" />
              Transações Realizadas nesta Data ({selectedDayData.transactions.length})
            </span>
          </div>

          {selectedDayData.transactions.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white border border-black/[0.05] text-center space-y-1">
              <CheckCircle2 size={18} className="mx-auto text-emerald-500" />
              <p className="text-xs font-semibold text-[#1D1D1F]">Nenhum gasto ou entrada registrado neste dia</p>
              <p className="text-[11px] text-[#86868B]">
                Você manteve seu caixa estável sem saídas discricionárias nesta data.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto no-scrollbar">
              {selectedDayData.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-2xl bg-white border border-black/[0.05] shadow-2xs flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {tx.type === "income" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>

                    <div className="min-w-0">
                      <strong className="block font-semibold text-[#1D1D1F] truncate">
                        {tx.title}
                      </strong>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#86868B]">
                        <span>{tx.category}</span>
                        {(tx.cardName || tx.account) && (
                          <>
                            <span>•</span>
                            <span className="truncate">{tx.cardName ? `Cartão ${tx.cardName}` : tx.account}</span>
                          </>
                        )}
                        {tx.timeStr && (
                          <>
                            <span>•</span>
                            <span>{tx.timeStr}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <strong
                    className={`font-mono font-bold text-xs tabular-nums shrink-0 ${
                      tx.type === "income" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}R$ {formatCurrency(tx.amount)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4.2 COMPROMISSOS E VENCIMENTOS PROGRAMADOS PARA ESTE DIA */}
        {selectedDayData.bills.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-black/[0.05]">
            <span className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5 px-1">
              <Clock size={14} className="text-[#86868B]" />
              Vencimentos Programados ({selectedDayData.bills.length})
            </span>

            <div className="space-y-1.5">
              {selectedDayData.bills.map((bill) => (
                <div
                  key={bill.id}
                  className="p-3 rounded-2xl bg-white border border-black/[0.05] shadow-2xs flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        bill.type === "credit_invoice"
                          ? "bg-indigo-50 text-indigo-700"
                          : bill.type === "income"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {bill.type === "credit_invoice" ? (
                        <CreditCard size={15} />
                      ) : bill.type === "income" ? (
                        <TrendingUp size={15} />
                      ) : (
                        <Building2 size={15} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <strong className="block font-semibold text-[#1D1D1F] truncate">
                        {bill.title}
                      </strong>
                      <span className="text-[10px] text-[#86868B]">
                        {bill.isPaid
                          ? "Quitada / Baixada ✅"
                          : bill.isCreditCharge
                          ? "Cobrança no Cartão de Crédito"
                          : "Pendente de quitação"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <strong className="font-mono font-bold text-xs tabular-nums text-[#1D1D1F]">
                      R$ {formatCurrency(bill.amount)}
                    </strong>

                    {!bill.isPaid && !bill.isCreditCharge && onRealizeItem && bill.sourceObj && (
                      <button
                        type="button"
                        onClick={() => handlePay(bill)}
                        disabled={actionLoadingId === bill.id}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-50"
                      >
                        {actionLoadingId === bill.id ? "Baixando..." : "Baixar"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
