"use client";

import { useState, useMemo } from "react";
import { useWallet, TransactionItem } from "@/context/WalletContext";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  ShieldCheck,
  Check,
  X,
  Plus,
  Trash2,
  Pencil,
  CalendarClock,
  Repeat,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { AddCardSheet } from "@/components/ui/AddCardSheet";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { EditRecurringSheet } from "@/components/ui/EditRecurringSheet";
import { TransactionDetailsSheet } from "@/components/ui/TransactionDetailsSheet";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { AppleScopeModal } from "@/components/ui/AppleScopeModal";
import { MiniCard } from "@/components/wallet";
import { getPlanningMonths, getPeriodKey, MONTH_NAMES_PT } from "@/lib/utils/dateUtils";
import {
  getInvoiceDueDate,
  getLedgerEntryDate,
  getCardInvoiceDetailsForMonth,
} from "@/lib/utils/ledger";
import type { RecurringItem } from "@/types";

export default function CardsPage() {
  const {
    cards,
    transactions,
    recurringItems,
    deleteTransaction,
    updateTransaction,
    updateRecurringItem,
    updateRecurringItemOccurrence,
    deleteRecurringItem,
    deleteRecurringItemOccurrence,
    updateCardLimit,
    payInvoice,
    mainBalance,
    addCard,
    deleteCard,
    getMonthlyProjection,
    accountOptions,
  } = useWallet();

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [newLimitInput, setNewLimitInput] = useState("");
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  const [isPayingInvoice, setIsPayingInvoice] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [selectedCardForTx, setSelectedCardForTx] = useState<string>("NuBank");
  
  // Modais de Edição e Exclusão
  const [txToDelete, setTxToDelete] = useState<TransactionItem | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);
  const [editingRecurringItem, setEditingRecurringItem] = useState<RecurringItem | null>(null);
  const [isEditRecurringOpen, setIsEditRecurringOpen] = useState(false);
  const [recurringToDelete, setRecurringToDelete] = useState<RecurringItem | null>(null);
  const [deleteRecurringScopeModal, setDeleteRecurringScopeModal] = useState<boolean>(false);

  const [confirmPayModal, setConfirmPayModal] = useState<{
    isOpen: boolean;
    cardId: string;
    cardName: string;
    amount: number;
    monthName: string;
  } | null>(null);
  const [confirmDeleteCardModal, setConfirmDeleteCardModal] = useState<{
    isOpen: boolean;
    cardId: string;
    cardName: string;
  } | null>(null);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const creditCards = cards.filter((c) => c.type === "credit");

  // Competência padrão da fatura aberta do cartão de referência
  const defaultReferenceDueDate = useMemo(() => {
    if (creditCards.length > 0) {
      return getInvoiceDueDate(creditCards[0], new Date());
    }
    return new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  }, [creditCards]);

  const defaultPeriodKey = useMemo(() => {
    return getPeriodKey(
      defaultReferenceDueDate.getFullYear(),
      defaultReferenceDueDate.getMonth()
    );
  }, [defaultReferenceDueDate]);

  // Janela de meses: 1 mês anterior + mês atual da fatura aberta + 6 meses futuros (Total 8 meses)
  const invoiceMonths = useMemo(() => {
    const list = [];
    const baseYear = defaultReferenceDueDate.getFullYear();
    const baseMonth = defaultReferenceDueDate.getMonth();

    for (let offset = -1; offset <= 6; offset++) {
      const d = new Date(baseYear, baseMonth + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = getPeriodKey(y, m);
      list.push({
        year: y,
        monthIndex: m,
        periodKey: key,
        short: MONTH_NAMES_PT[m],
        name: `${MONTH_NAMES_PT[m]} de ${y}`,
        isOpenInvoice: key === defaultPeriodKey,
        isPast: offset < 0,
        isFuture: offset > 0,
      });
    }
    return list;
  }, [defaultReferenceDueDate, defaultPeriodKey]);

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(defaultPeriodKey);

  // Mês atualmente selecionado
  const selectedMonth = useMemo(() => {
    return (
      invoiceMonths.find((m) => m.periodKey === selectedPeriodKey) ||
      invoiceMonths.find((m) => m.periodKey === defaultPeriodKey) ||
      invoiceMonths[1] ||
      invoiceMonths[0]
    );
  }, [invoiceMonths, selectedPeriodKey, defaultPeriodKey]);

  const selectedMonthIndexInList = invoiceMonths.findIndex(
    (m) => m.periodKey === selectedMonth.periodKey
  );

  // Pré-cálculo dos totais por mês para exibição na régua de navegação
  const monthTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const m of invoiceMonths) {
      let sum = 0;
      for (const card of creditCards) {
        const details = getCardInvoiceDetailsForMonth(
          card,
          transactions,
          recurringItems,
          m.year,
          m.monthIndex
        );
        sum += details.totalInvoice;
      }
      totals[m.periodKey] = sum;
    }
    return totals;
  }, [invoiceMonths, creditCards, transactions, recurringItems]);

  // Detalhes calculados dos cartões para o mês selecionado
  const cardDetailsList = useMemo(() => {
    return creditCards.map((card) => {
      return getCardInvoiceDetailsForMonth(
        card,
        transactions,
        recurringItems,
        selectedMonth.year,
        selectedMonth.monthIndex
      );
    });
  }, [creditCards, transactions, recurringItems, selectedMonth]);

  const totalSelectedMonthInvoices = cardDetailsList.reduce(
    (acc, d) => acc + d.totalInvoice,
    0
  );

  const handlePrevMonth = () => {
    if (selectedMonthIndexInList > 0) {
      setSelectedPeriodKey(invoiceMonths[selectedMonthIndexInList - 1].periodKey);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndexInList < invoiceMonths.length - 1) {
      setSelectedPeriodKey(invoiceMonths[selectedMonthIndexInList + 1].periodKey);
    }
  };

  const handleStartEditLimit = (cardId: string, currentLimit: number) => {
    setEditingCardId(cardId);
    setNewLimitInput(currentLimit.toString());
  };

  const handleSaveLimit = (cardId: string) => {
    const num = parseFloat(newLimitInput.replace(/\./g, "").replace(",", "."));
    if (!isNaN(num) && num > 0) {
      updateCardLimit(cardId, num);
    }
    setEditingCardId(null);
  };

  const handleExecutePayInvoice = async () => {
    if (!confirmPayModal) return;
    const { cardId, cardName, amount } = confirmPayModal;
    if (mainBalance < amount) {
      setPaymentErrorMessage("Saldo na Conta Principal insuficiente para quitar esta fatura!");
      setConfirmPayModal(null);
      setTimeout(() => setPaymentErrorMessage(null), 5000);
      return;
    }
    setIsPayingInvoice(true);
    try {
      await payInvoice(cardId, amount);
      setConfirmPayModal(null);
      setPaymentSuccessMessage(`Fatura do ${cardName} paga com sucesso!`);
      setTimeout(() => setPaymentSuccessMessage(null), 4000);
    } catch (error) {
      setPaymentErrorMessage(
        error instanceof Error ? error.message : "Não foi possível pagar a fatura."
      );
      setTimeout(() => setPaymentErrorMessage(null), 5000);
    } finally {
      setIsPayingInvoice(false);
    }
  };

  const handleStartEditRecurring = (item: RecurringItem) => {
    setEditingRecurringItem(item);
    setIsEditRecurringOpen(true);
  };

  const handleSaveRecurring = async (
    id: string,
    updates: Partial<RecurringItem>,
    scope: "all" | "single",
    periodKey?: string
  ) => {
    if (scope === "single" && periodKey) {
      await updateRecurringItemOccurrence(id, periodKey, updates);
    } else {
      await updateRecurringItem(id, updates);
    }

    // Se houver uma transação física já realizada vinculada a este item na competência, sincronizá-la
    const targetPeriod = periodKey || selectedMonth.periodKey;
    const realizedTx = transactions.find((t) => {
      if (t.recurringItemId !== id) return false;
      if (t.periodKey === targetPeriod || !t.periodKey) return true;
      const tDate = getLedgerEntryDate(t);
      if (tDate) {
        const card = cards.find((c) => c.id === t.cardId || c.name === t.account);
        if (card && card.type === "credit") {
          const due = getInvoiceDueDate(card, tDate);
          if (getPeriodKey(due.getFullYear(), due.getMonth()) === targetPeriod) {
            return true;
          }
        }
      }
      return false;
    });

    if (realizedTx) {
      await updateTransaction(realizedTx.id, {
        title: updates.title || realizedTx.title,
        amount: updates.amount ?? realizedTx.amount,
        type: realizedTx.type,
        category: updates.category || realizedTx.category,
        account: updates.account || realizedTx.account,
        cardId: updates.cardId !== undefined ? updates.cardId : realizedTx.cardId,
        date: realizedTx.date,
        occurredAt: getLedgerEntryDate(realizedTx) || new Date(),
      });
    }

    setPaymentSuccessMessage("Compra programada atualizada com sucesso!");
    setTimeout(() => setPaymentSuccessMessage(null), 4000);
  };

  const handleStartDeleteRecurring = (item: RecurringItem) => {
    setRecurringToDelete(item);
    setDeleteRecurringScopeModal(true);
  };

  const handleConfirmDeleteRecurringScope = async (
    scope: "single" | "all",
    targetItemOrId?: RecurringItem | string | null,
    customPeriodKey?: string
  ) => {
    const itemToDelete =
      (typeof targetItemOrId === "object" && targetItemOrId !== null ? targetItemOrId : null) ||
      recurringToDelete ||
      editingRecurringItem ||
      (typeof targetItemOrId === "string" ? recurringItems.find((r) => r.id === targetItemOrId) : null);

    if (!itemToDelete) return;
    const id = itemToDelete.id;
    const periodKey = customPeriodKey || selectedMonth.periodKey;

    if (scope === "all") {
      // Exclui a série inteira no planejamento recorrente
      await deleteRecurringItem(id);

      // Exclui todas as transações realizadas geradas por esta série recorrente
      const linkedTxs = transactions.filter((t) => t.recurringItemId === id);
      for (const tx of linkedTxs) {
        await deleteTransaction(tx.id);
      }
    } else {
      // Exclui apenas esta competência
      await deleteRecurringItemOccurrence(id, periodKey);

      // Encontra e exclui qualquer transação física realizada nesta fatura vinculada
      const matchingTxs = transactions.filter((t) => {
        if (t.recurringItemId !== id) return false;
        if (t.periodKey === periodKey) return true;
        const tDate = getLedgerEntryDate(t);
        if (tDate) {
          const tKey = getPeriodKey(tDate.getFullYear(), tDate.getMonth());
          if (tKey === periodKey) return true;
          const card = cards.find((c) => c.id === t.cardId || c.name === t.account);
          if (card && card.type === "credit") {
            const due = getInvoiceDueDate(card, tDate);
            if (getPeriodKey(due.getFullYear(), due.getMonth()) === periodKey) {
              return true;
            }
          }
        }
        return false;
      });

      for (const tx of matchingTxs) {
        await deleteTransaction(tx.id);
        if (tx.periodKey && tx.periodKey !== periodKey) {
          await deleteRecurringItemOccurrence(id, tx.periodKey);
        }
      }
    }

    setDeleteRecurringScopeModal(false);
    setRecurringToDelete(null);
    setEditingRecurringItem(null);
    setIsEditRecurringOpen(false);
    setPaymentSuccessMessage("Programação excluída com sucesso!");
    setTimeout(() => setPaymentSuccessMessage(null), 4000);
  };

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500">
      {/* Header Superior */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Motor de Cartões de Crédito
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Cartões & Faturas
          </h1>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-black/[0.04] shadow-xs">
            <span className="text-xs text-[#86868B]">Saldo Disponível:</span>
            <span className="text-xs font-semibold text-[#1D1D1F] font-mono tabular-nums">
              R$ {formatCurrency(mainBalance)}
            </span>
          </div>

          <button
            onClick={() => {
              setSelectedCardForTx(creditCards[0]?.name || "NuBank");
              setIsAddTransactionOpen(true);
            }}
            className="bg-white hover:bg-black/5 active:scale-[0.98] text-[#1D1D1F] border border-black/[0.08] text-xs font-semibold px-3.5 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus strokeWidth={2} size={15} />
            <span>Nova Compra</span>
          </button>

          <button
            onClick={() => setIsAddCardOpen(true)}
            className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus strokeWidth={2} size={15} />
            <span>Novo Cartão</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {paymentSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{paymentSuccessMessage}</span>
          </div>
        )}

        {paymentErrorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{paymentErrorMessage}</span>
          </div>
        )}

        {/* Informação sobre a Regra de Negócio (agent.md Seção 5.3) */}
        <div className="bg-white rounded-[20px] p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
            <ShieldCheck strokeWidth={1.5} size={18} />
          </div>
          <div className="text-xs space-y-1">
            <h3 className="font-semibold text-[#1D1D1F]">Controle Inteligente de Crédito</h3>
            <p className="text-[#86868B] leading-relaxed">
              Monitore suas faturas presentes e futuras mês a mês. Compras parceladas e cobranças programadas entram na competência correta pelo fechamento do cartão. O seu Saldo Principal só é debitado quando você efetua o pagamento da fatura.
            </p>
          </div>
        </div>

        {/* Régua de Navegação Temporal das Faturas (Apple HIG Segmented Control) */}
        <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-black/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-[#86868B]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                Competência da Fatura
              </span>
            </div>

            {selectedMonth.periodKey !== defaultPeriodKey && (
              <button
                type="button"
                onClick={() => setSelectedPeriodKey(defaultPeriodKey)}
                className="text-[11px] font-semibold text-[#0071E3] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Voltar para Fatura Atual ({invoiceMonths.find((m) => m.periodKey === defaultPeriodKey)?.short})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Mês Anterior */}
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={selectedMonthIndexInList <= 0}
              className="w-8 h-8 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[#1D1D1F] transition-all cursor-pointer shrink-0"
              title="Ver mês anterior"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Scroll Horizontal de Meses */}
            <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-2 py-1 px-0.5">
              {invoiceMonths.map((m) => {
                const isSelected = m.periodKey === selectedPeriodKey;
                const total = monthTotals[m.periodKey] || 0;

                return (
                  <button
                    key={m.periodKey}
                    type="button"
                    onClick={() => setSelectedPeriodKey(m.periodKey)}
                    className={`min-w-[108px] sm:min-w-[124px] px-3.5 py-2.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all text-center cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-[#1D1D1F] text-white shadow-xs scale-[1.02]"
                        : "bg-[#F8F8FA] hover:bg-[#EFEFF4] text-[#1D1D1F] border border-black/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold tracking-tight">
                        {m.short}
                      </span>
                      <span className={`text-[10px] ${isSelected ? "text-white/70" : "text-[#86868B]"}`}>
                        {m.year}
                      </span>
                      {m.isOpenInvoice && (
                        <span
                          className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          Aberta
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-mono tabular-nums font-semibold ${
                        isSelected ? "text-white" : "text-[#1D1D1F]"
                      }`}
                    >
                      R$ {formatCurrency(total)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Botão Próximo Mês */}
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={selectedMonthIndexInList >= invoiceMonths.length - 1}
              className="w-8 h-8 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[#1D1D1F] transition-all cursor-pointer shrink-0"
              title="Ver próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Lista Detalhada de Cartões de Crédito para o Mês Selecionado */}
        <section className="bg-[#F8F8FA] rounded-[24px] p-5 sm:p-6 border border-black/[0.04] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-black/[0.04]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 shadow-xs">
                <CreditCard size={16} strokeWidth={2} />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                  Faturas dos Cartões
                </span>
                <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight mt-0.5">
                  {creditCards.length}{" "}
                  {creditCards.length === 1
                    ? "cartão com fatura a pagar em"
                    : "cartões com faturas a pagar em"}{" "}
                  {selectedMonth.short} {selectedMonth.year}
                </h2>
              </div>
            </div>

            <div className="flex sm:flex-col sm:items-end justify-between items-center shrink-0">
              <div className="text-right">
                <span className="text-[11px] text-[#86868B] mr-1.5 font-medium">
                  Valor Somado:
                </span>
                <span className="text-lg sm:text-xl font-semibold text-[#1D1D1F] tracking-tight font-mono tabular-nums">
                  R$ {formatCurrency(totalSelectedMonthInvoices)}
                </span>
              </div>
            </div>
          </div>

          {creditCards.length === 0 ? (
            <div className="bg-white rounded-[20px] p-8 border border-black/[0.04] text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center mx-auto">
                <CreditCard size={24} strokeWidth={1.5} />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-semibold text-[#1D1D1F]">
                  Nenhum cartão de crédito cadastrado
                </h3>
                <p className="text-xs text-[#86868B]">
                  Adicione um cartão para controlar faturas, limites e datas de fechamento/vencimento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCardOpen(true)}
                className="bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>Adicionar Primeiro Cartão</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {cardDetailsList.map((details) => {
                const card = details.card;
                const invoice = details.totalInvoice;
                const isEditing = editingCardId === card.id;

                // Separação de itens programados e compras avulsas, evitando qualquer duplicação
                const pendingRecurringList = details.recurringItemDetails.filter((recDetail) => {
                  return !details.cardTransactions.some(
                    (tx) => tx.recurringItemId === recDetail.item.id
                  );
                });

                const regularTransactionsList = details.cardTransactions.filter(
                  (tx) => !tx.recurringItemId
                );
                const realizedRecurringTransactionsList = details.cardTransactions.filter(
                  (tx) => Boolean(tx.recurringItemId)
                );

                return (
                  <div
                    key={card.id}
                    className="bg-white rounded-[20px] p-5 sm:p-6 border border-black/[0.05] shadow-2xs hover:shadow-xs transition-shadow space-y-4"
                  >
                    {/* Topo do Cartão: MiniCard, Identificação e Fatura */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <MiniCard
                          cardName={card.name}
                          brand={card.brand}
                          colorScheme={card.colorScheme}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[#1D1D1F]">
                              {card.name}
                            </h3>
                            {details.isPaid ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Paga na conta
                              </span>
                            ) : details.isOpenInvoice ? (
                              <span className="text-[10px] font-semibold text-[#86868B] px-2 py-0.5 rounded-full bg-[#F2F2F7]">
                                A pagar dia {details.dueDay} ({details.dueMonthName})
                              </span>
                            ) : details.isFutureInvoice ? (
                              <span className="text-[10px] font-semibold text-indigo-700 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200">
                                Fatura Prevista ({details.dueMonthName})
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-[#86868B] px-2 py-0.5 rounded-full bg-[#F2F2F7]">
                                Fatura Encerrada ({details.dueMonthName})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#86868B] mt-0.5">
                            Vencimento dia {details.dueDay} de {details.dueMonthName} · Fechamento dia {details.closingDay}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-[#86868B] block">
                            Fatura {card.name}
                          </span>
                          <span className="text-base sm:text-lg font-semibold text-[#1D1D1F] tracking-tight font-mono tabular-nums">
                            R$ {formatCurrency(invoice)}
                          </span>
                          {card.limit > 0 && (
                            <span className="text-[10px] text-[#86868B] block mt-0.5">
                              Limite: <span className="font-mono tabular-nums">R$ {formatCurrency(card.limit)}</span> · Disp:{" "}
                              <strong className="text-emerald-700 font-semibold font-mono tabular-nums">
                                R$ {formatCurrency(details.availableLimit)}
                              </strong>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!details.isPaid && invoice > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmPayModal({
                                  isOpen: true,
                                  cardId: card.id,
                                  cardName: card.name,
                                  amount: invoice,
                                  monthName: details.dueMonthName,
                                })
                              }
                              className="text-xs font-semibold bg-[#1D1D1F] hover:bg-black text-white px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                              title={`Pagar fatura de ${details.dueMonthName} do ${card.name} na Conta Principal`}
                            >
                              {details.isFutureInvoice ? "Adiantar Fatura" : "Pagar Fatura"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCardForTx(card.name);
                              setIsAddTransactionOpen(true);
                            }}
                            className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] px-2.5 py-1.5 rounded-full hover:bg-blue-50/50 transition-colors cursor-pointer shrink-0"
                            title={`Adicionar compra no ${card.name}`}
                          >
                            + Compra
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteCardModal({
                                isOpen: true,
                                cardId: card.id,
                                cardName: card.name,
                              })
                            }
                            className="w-7 h-7 rounded-full text-[#86868B] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                            title="Excluir Cartão"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Progresso de Limite e Ajuste */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#86868B]">
                          Utilizado: <strong className="text-[#1D1D1F] font-mono tabular-nums">R$ {formatCurrency(card.spent)}</strong>
                        </span>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 bg-[#F2F2F7] px-2 py-0.5 rounded-lg">
                              <span className="text-[#86868B] text-[11px]">R$</span>
                              <input
                                type="number"
                                value={newLimitInput}
                                onChange={(e) => setNewLimitInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveLimit(card.id)}
                                className="w-16 bg-transparent text-[#1D1D1F] font-semibold outline-none text-xs font-mono tabular-nums"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveLimit(card.id)}
                                className="text-emerald-600 hover:text-emerald-700 cursor-pointer"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => setEditingCardId(null)}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEditLimit(card.id, card.limit)}
                              className="text-[#86868B] hover:text-[#1D1D1F] font-medium flex items-center gap-1 cursor-pointer text-[11px]"
                            >
                              <SlidersHorizontal size={11} />
                              <span>Ajustar Limite</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="w-full h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            details.percentUsed > 85 ? "bg-rose-500" : "bg-[#1D1D1F]"
                          }`}
                          style={{ width: `${details.percentUsed}%` }}
                        />
                      </div>
                    </div>

                    {/* Composição da Fatura */}
                    <div className="bg-[#FBFBFD] rounded-2xl p-4 border border-black/[0.03] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#86868B] border-b border-black/[0.04] pb-2">
                        <span className="font-medium text-[#1D1D1F]">
                          Composição da Fatura ({details.dueMonthName})
                        </span>
                        <div className="flex items-center gap-3">
                          {details.hasInstallments && (
                            <span>
                              Compras:{" "}
                              <strong className="text-[#1D1D1F] font-mono tabular-nums">
                                R$ {formatCurrency(details.installmentsAmount)}
                              </strong>
                            </span>
                          )}
                          {details.hasRecurring && (
                            <span>
                              Contas Programadas:{" "}
                              <strong className="text-violet-900 font-mono tabular-nums">
                                R$ {formatCurrency(details.recurringAmount)}
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Grupo 1: Compras Programadas & Assinaturas com Visual Destacado */}
                      {(pendingRecurringList.length > 0 || realizedRecurringTransactionsList.length > 0) && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-900 px-0.5">
                            <Repeat size={12} className="text-violet-600" />
                            <span>
                              Compras Programadas & Assinaturas (
                              {pendingRecurringList.length + realizedRecurringTransactionsList.length}
                              )
                            </span>
                          </div>

                          <div className="space-y-2">
                            {/* Ocorrências pendentes calculadas para este mês */}
                            {pendingRecurringList.map((recDetail) => {
                              const item = recDetail.item;
                              return (
                                <div
                                  key={`pending-${item.id}-${selectedMonth.periodKey}`}
                                  className="group flex items-center justify-between gap-3 bg-[#FAF8FF] hover:bg-[#F5F0FF] p-3 rounded-xl border border-violet-200/90 shadow-2xs transition-all"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 shadow-2xs">
                                      {recDetail.isContinuous ? (
                                        <Repeat size={14} strokeWidth={2.2} />
                                      ) : (
                                        <CalendarClock size={14} strokeWidth={2.2} />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-semibold text-[#1D1D1F] text-xs truncate">
                                          {item.title}
                                        </p>
                                        {recDetail.isContinuous ? (
                                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 border border-violet-200/80 inline-flex items-center gap-1 shrink-0">
                                            <Repeat size={10} strokeWidth={2.5} /> Recorrente mensal
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200/80 inline-flex items-center gap-1 shrink-0">
                                            <CalendarClock size={10} strokeWidth={2.5} /> Parcela{" "}
                                            {recDetail.installmentIndex} de {recDetail.totalInstallments}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-[#86868B] truncate mt-0.5">
                                        {item.category || "Conta Programada"} · Todo dia {item.dueDay || 10}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-semibold text-violet-950 font-mono tabular-nums text-xs">
                                      R$ {formatCurrency(item.amount)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditRecurring(item)}
                                      className="p-1.5 rounded-lg text-violet-700 hover:text-violet-900 hover:bg-violet-100 transition-colors cursor-pointer"
                                      title="Editar compra programada"
                                    >
                                      <Pencil size={13} strokeWidth={1.75} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartDeleteRecurring(item)}
                                      className="p-1.5 rounded-lg text-[#86868B] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Excluir compra programada"
                                    >
                                      <Trash2 size={13} strokeWidth={1.75} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Ocorrências já lançadas fisicamente como transação */}
                            {realizedRecurringTransactionsList.map((tx) => {
                              const linkedItem = recurringItems.find(
                                (r) => r.id === tx.recurringItemId
                              );
                              return (
                                <div
                                  key={tx.id}
                                  className="group flex items-center justify-between gap-3 bg-[#FAF8FF] hover:bg-[#F5F0FF] p-3 rounded-xl border border-violet-200/90 shadow-2xs transition-all"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 shadow-2xs">
                                      <Repeat size={14} strokeWidth={2.2} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-semibold text-[#1D1D1F] text-xs truncate">
                                          {tx.title}
                                        </p>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 border border-violet-200/80 inline-flex items-center gap-1 shrink-0">
                                          <Repeat size={10} strokeWidth={2.5} /> Recorrente mensal
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-[#86868B] truncate mt-0.5">
                                        {tx.category || "Assinatura"} · Lançamento faturado
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-semibold text-violet-950 font-mono tabular-nums text-xs">
                                      R$ {formatCurrency(tx.amount)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (linkedItem) {
                                          handleStartEditRecurring(linkedItem);
                                        } else {
                                          setEditingTransaction(tx as TransactionItem);
                                        }
                                      }}
                                      className="p-1.5 rounded-lg text-violet-700 hover:text-violet-900 hover:bg-violet-100 transition-colors cursor-pointer"
                                      title="Editar compra programada"
                                    >
                                      <Pencil size={13} strokeWidth={1.75} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (linkedItem) {
                                          handleStartDeleteRecurring(linkedItem);
                                        } else {
                                          setTxToDelete(tx as TransactionItem);
                                        }
                                      }}
                                      className="p-1.5 rounded-lg text-[#86868B] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Excluir compra programada"
                                    >
                                      <Trash2 size={13} strokeWidth={1.75} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Grupo 2: Compras Faturadas e Parcelas Avulsas */}
                      {regularTransactionsList.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1D1D1F] px-0.5">
                            <CreditCard size={12} className="text-[#86868B]" />
                            <span>Compras Faturadas ({regularTransactionsList.length})</span>
                          </div>

                          <div className="space-y-1.5">
                            {regularTransactionsList.map((tx) => (
                              <div
                                key={tx.id}
                                className="group flex items-center justify-between gap-3 bg-white hover:bg-gray-50/80 p-2.5 rounded-xl border border-black/[0.04] text-xs transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-6 h-6 rounded-lg bg-[#F2F2F7] flex items-center justify-center text-[#1D1D1F] shrink-0">
                                    <CreditCard size={12} strokeWidth={1.75} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-[#1D1D1F] truncate">{tx.title}</p>
                                    <p className="text-[10px] text-[#86868B] truncate">
                                      {tx.category || "Despesa"}{" "}
                                      {tx.installmentsCount && tx.installmentsCount > 1
                                        ? `· ${tx.installmentsCount}x`
                                        : ""}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="font-semibold text-[#1D1D1F] font-mono tabular-nums">
                                    R$ {formatCurrency(tx.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTransaction(tx as TransactionItem)}
                                    className="text-[#86868B] hover:text-[#1D1D1F] transition-colors p-1 rounded-md hover:bg-black/5 cursor-pointer"
                                    title="Editar lançamento"
                                  >
                                    <Pencil size={12} strokeWidth={1.5} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTxToDelete(tx as TransactionItem)}
                                    className="text-[#86868B] hover:text-rose-600 transition-colors opacity-70 group-hover:opacity-100 p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 size={12} strokeWidth={1.5} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Estado Vazio de Composição da Fatura */}
                      {pendingRecurringList.length === 0 &&
                        realizedRecurringTransactionsList.length === 0 &&
                        regularTransactionsList.length === 0 && (
                          <p className="text-xs text-[#86868B] py-2 text-center">
                            Fatura zerada para {details.dueMonthName}. Nenhuma compra faturada ou assinatura vinculada a este cartão neste mês.
                          </p>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Projeção Real de Faturas Futuras nos Próximos Meses */}
        {(() => {
          const futureProjections = getPlanningMonths(5).slice(1).map((month, index) => {
            const projection = getMonthlyProjection(index + 1);
            return {
              ...month,
              openInvoice: projection.cardInstallments,
              plannedCharges: projection.recurringCreditTotal,
              total: projection.cardInstallments + projection.recurringCreditTotal,
              periodKey: getPeriodKey(month.year, month.monthIndex),
            };
          });
          const hasFutureCharges = futureProjections.some((month) => month.total > 0);

          return (
            <section className="bg-white rounded-[20px] p-6 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-semibold text-[#1D1D1F]">Projeção de Faturas Futuras</h2>
                  <p className="text-xs text-[#86868B]">Assinaturas e parcelas programadas nos cartões</p>
                </div>
                <span className="text-xs font-medium text-[#86868B] bg-[#F2F2F7] px-2.5 py-1 rounded-full">
                  Próximos Meses
                </span>
              </div>

              {hasFutureCharges ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  {futureProjections.map((month) => {
                    const isCurrentSelected = selectedMonth.periodKey === month.periodKey;
                    return (
                      <button
                        key={`${month.year}-${month.monthIndex}`}
                        type="button"
                        onClick={() => setSelectedPeriodKey(month.periodKey)}
                        className={`p-4 rounded-xl text-left transition-all cursor-pointer space-y-1.5 ${
                          isCurrentSelected
                            ? "bg-[#1D1D1F] text-white shadow-xs"
                            : "bg-[#F2F2F7]/60 hover:bg-[#F2F2F7] text-[#1D1D1F]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[11px] uppercase font-semibold tracking-wider ${
                              isCurrentSelected ? "text-white/70" : "text-[#86868B]"
                            }`}
                          >
                            {month.short} {month.year}
                          </span>
                          <ArrowRight
                            size={12}
                            className={isCurrentSelected ? "text-white" : "text-[#86868B]"}
                          />
                        </div>
                        <div
                          className={`text-lg font-semibold font-mono tabular-nums ${
                            isCurrentSelected ? "text-white" : "text-[#1D1D1F]"
                          }`}
                        >
                          R$ {formatCurrency(month.total)}
                        </div>
                        <p
                          className={`text-[11px] font-mono tabular-nums truncate ${
                            isCurrentSelected ? "text-white/80" : "text-[#86868B]"
                          }`}
                        >
                          R$ {formatCurrency(month.openInvoice)} compras + R${" "}
                          {formatCurrency(month.plannedCharges)} programados
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-[#F2F2F7]/40 text-center space-y-1.5 border border-dashed border-gray-200">
                  <p className="text-xs font-medium text-[#1D1D1F]">
                    Nenhuma parcela ou assinatura futura programada no crédito.
                  </p>
                  <p className="text-xs text-[#86868B] max-w-sm mx-auto">
                    Ao cadastrar compras parceladas ou assinaturas contínuas, a previsão de faturas futuras será exibida aqui e na régua temporal automaticamente.
                  </p>
                </div>
              )}
            </section>
          );
        })()}
      </div>

      {/* Modal Bottom Sheet de Criação de Novo Cartão */}
      <AddCardSheet
        isOpen={isAddCardOpen}
        onClose={() => setIsAddCardOpen(false)}
        onAddCard={addCard}
      />

      {/* Modal de Edição de Compra Programada / Assinatura */}
      <EditRecurringSheet
        isOpen={isEditRecurringOpen}
        onClose={() => {
          setIsEditRecurringOpen(false);
          setEditingRecurringItem(null);
        }}
        item={editingRecurringItem}
        currentPeriodKey={selectedMonth.periodKey}
        currentMonthName={selectedMonth.name}
        accounts={accountOptions}
        cards={cards}
        onSave={handleSaveRecurring}
        onDelete={async (id, scope, periodKey) => {
          await handleConfirmDeleteRecurringScope(scope, id, periodKey);
        }}
      />

      {/* Modal de Seleção de Escopo para Exclusão de Compra Programada */}
      <AppleScopeModal
        isOpen={deleteRecurringScopeModal}
        onClose={() => {
          setDeleteRecurringScopeModal(false);
          setRecurringToDelete(null);
        }}
        onSelectScope={(scope) => handleConfirmDeleteRecurringScope(scope, recurringToDelete)}
        title="Excluir Compra Programada"
        description={`Deseja excluir "${recurringToDelete?.title}" apenas da fatura de ${selectedMonth.name} ou cancelar a programação de todas as faturas futuras?`}
        singleLabel={`Apenas na fatura de ${selectedMonth.short}`}
        allLabel="Todas as faturas futuras"
        cancelLabel="Cancelar"
        variant="danger"
      />

      {/* Modal Detalhado de Edição de Transação Avulsa do Cartão */}
      {editingTransaction && (
        <TransactionDetailsSheet
          transaction={editingTransaction}
          accounts={accountOptions}
          cards={cards}
          initialEditing={true}
          onClose={() => setEditingTransaction(null)}
          onSave={async (id, updates) => {
            await updateTransaction(id, updates);
            setEditingTransaction(null);
            setPaymentSuccessMessage("Lançamento atualizado com sucesso!");
            setTimeout(() => setPaymentSuccessMessage(null), 4000);
          }}
          onDelete={async (tx) => {
            await deleteTransaction(tx.id);
            setEditingTransaction(null);
            setPaymentSuccessMessage("Lançamento excluído com sucesso!");
            setTimeout(() => setPaymentSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* Modal de Confirmação para Pagamento de Fatura */}
      <AppleConfirmModal
        isOpen={!!confirmPayModal?.isOpen}
        onClose={() => setConfirmPayModal(null)}
        onConfirm={handleExecutePayInvoice}
        isLoading={isPayingInvoice}
        title="Confirmar Pagamento de Fatura"
        description={`Deseja debitar R$ ${formatCurrency(confirmPayModal?.amount || 0)} do seu saldo disponível (R$ ${formatCurrency(mainBalance)}) para quitar a fatura de ${confirmPayModal?.monthName} do cartão ${confirmPayModal?.cardName}?`}
        confirmLabel="Pagar com W Pay"
        cancelLabel="Cancelar"
        variant="primary"
        iconType="payment"
      />

      {/* Modal de Confirmação para Excluir Cartão */}
      <AppleConfirmModal
        isOpen={!!confirmDeleteCardModal?.isOpen}
        onClose={() => setConfirmDeleteCardModal(null)}
        onConfirm={() => {
          if (confirmDeleteCardModal) {
            deleteCard(confirmDeleteCardModal.cardId);
            setConfirmDeleteCardModal(null);
          }
        }}
        title="Excluir Cartão"
        description={`Tem certeza que deseja remover o cartão ${confirmDeleteCardModal?.cardName}? Esta ação removerá os limites e faturas associadas a ele.`}
        confirmLabel="Excluir Cartão"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />

      {/* Modal de Confirmação para Excluir Compra da Fatura */}
      {txToDelete && (
        <AppleConfirmModal
          isOpen={Boolean(txToDelete)}
          onClose={() => setTxToDelete(null)}
          onConfirm={async () => {
            if (txToDelete) {
              await deleteTransaction(txToDelete.id);
              setTxToDelete(null);
              setPaymentSuccessMessage("Lançamento excluído com sucesso!");
              setTimeout(() => setPaymentSuccessMessage(null), 4000);
            }
          }}
          title="Excluir Lançamento"
          description={`Deseja excluir a compra "${txToDelete.title}" de R$ ${formatCurrency(txToDelete.amount)}?`}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          iconType="trash"
        />
      )}

      {/* Modal Unificado de Lançamento de Transação / Compra */}
      <AddTransactionSheet
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
        accounts={accountOptions}
        initialAccount={selectedCardForTx}
        initialType="despesa"
      />
    </div>
  );
}
