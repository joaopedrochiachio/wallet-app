"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  Plus,
  Trash2,
  Check,
  Building2,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Pencil,
  Zap,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { AppleScopeModal } from "@/components/ui/AppleScopeModal";
import { MonthlyMovementOverview } from "@/components/planning/MonthlyMovementOverview";
import {
  get5thBusinessDay,
  getEffectiveDueDay,
  getPlanningMonthsWindow,
  getPeriodKey,
  getRecurringMonthOffset,
  isRecurringActiveInMonth,
  groupRecurringItemsByDate,
  getEffectiveRecurringItemForPeriod,
} from "@/lib/utils/dateUtils";
import { formatAccountLabel, getLedgerEntryDate } from "@/lib/utils/ledger";
import { RecurrenceType, RecurringItem } from "@/types";

export default function PlanningPage() {
  const {
    recurringItems,
    addRecurringItem,
    updateRecurringItem,
    updateRecurringItemOccurrence,
    deleteRecurringItemOccurrence,
    toggleRecurringItem,
    deleteRecurringItem,
    realizeRecurringItemNow,
    unrealizeRecurringItem,
    getMonthlyProjection,
    accountOptions,
    cards,
    transactions,
  } = useWallet();

  const planningMonths = getPlanningMonthsWindow(0, 3);
  const currentMonthIdx = planningMonths.findIndex((m) => m.isCurrent);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(
    currentMonthIdx >= 0 ? currentMonthIdx : 0
  );
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [isAddingMenuOpen, setIsAddingMenuOpen] = useState(false);
  const [modalType, setModalType] = useState<"income" | "expense">("income");
  const [itemToDelete, setItemToDelete] = useState<RecurringItem | null>(null);

  // Form para novo item de planejamento
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newAccount, setNewAccount] = useState("Débito/Pix");
  const [newCategory, setNewCategory] = useState("Salário / Extra");

  // Recorrência e cálculo inteligente
  const [recurrenceSelection, setRecurrenceSelection] =
    useState<RecurrenceType>("business_day_5");
  const [fixedDayValue, setFixedDayValue] = useState("10");
  const [isCustomDayActive, setIsCustomDayActive] = useState(false);
  const [customDayInput, setCustomDayInput] = useState("10");

  // Duração: uma vez, por um número de meses ou contínuo.
  const [durationMode, setDurationMode] = useState<"one-time" | "continuous" | "installments">("continuous");
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [installmentsInput, setInstallmentsInput] = useState<string>("3");
  const [installmentPricingType, setInstallmentPricingType] = useState<"total" | "monthly">("total");

  // Estados para edição de planejamento
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editAccount, setEditAccount] = useState("Débito/Pix");
  const [editCategory, setEditCategory] = useState("Moradia & Contas");
  const [editType, setEditType] = useState<"income" | "expense">("expense");
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceType>("fixed_day");
  const [editFixedDay, setEditFixedDay] = useState("10");
  const [editIsCustomDay, setEditIsCustomDay] = useState(false);
  const [editCustomDay, setEditCustomDay] = useState("10");
  const [editDurationMode, setEditDurationMode] = useState<"one-time" | "continuous" | "installments">("continuous");
  const [editInstallmentsCount, setEditInstallmentsCount] = useState<number>(3);
  const [editInstallmentsInput, setEditInstallmentsInput] = useState<string>("3");
  const [editInstallmentPricingType, setEditInstallmentPricingType] = useState<"total" | "monthly">("monthly");
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [scopeEditModal, setScopeEditModal] = useState<{
    isOpen: boolean;
    item: RecurringItem;
    updates: Partial<RecurringItem>;
  } | null>(null);

  const activeMonthObj = planningMonths[selectedMonthIndex] || planningMonths[currentMonthIdx >= 0 ? currentMonthIdx : 0];
  const targetYear = activeMonthObj.year;
  const targetMonth = activeMonthObj.monthIndex;
  const targetPeriodKey = getPeriodKey(targetYear, targetMonth);
  const currentMonth5thBusinessDay = get5thBusinessDay(targetYear, targetMonth);

  const projection = getMonthlyProjection(selectedMonthIndex, planningMonths);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isCheckingAccount = (item: RecurringItem) =>
    item.account === "Débito/Pix" || cards.some((card) =>
      card.type === "checking" &&
      (card.id === item.cardId || card.id === item.account || card.name === item.account)
    );

  const isActiveInSelectedMonth = (item: RecurringItem) =>
    isRecurringActiveInMonth(item, targetYear, targetMonth);

  const selectedTransactions = transactions.filter((transaction) => {
    if (transaction.kind === "invoice_settlement") return false;
    const occurredAt = getLedgerEntryDate(transaction);
    return occurredAt?.getFullYear() === targetYear && occurredAt.getMonth() === targetMonth;
  });

  // Separar recebidos futuros vs pagamentos futuros
  const plannedIncomes = recurringItems.filter((r) => r.type === "income");
  const plannedDebitExpenses = recurringItems.filter(
    (r) => r.type !== "income" && isCheckingAccount(r)
  );
  const plannedCreditExpenses = recurringItems.filter(
    (r) => r.type !== "income" && !isCheckingAccount(r)
  );

  const isScheduledForSelectedMonth = (item: RecurringItem) => {
    if (item.excludedPeriods?.includes(targetPeriodKey) || item.overrides?.[targetPeriodKey]?.isDeleted) {
      return false;
    }
    const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
    return monthOffset >= 0 && (
      !item.installmentsCount ||
      item.installmentsCount <= 0 ||
      monthOffset < item.installmentsCount
    );
  };

  const visiblePlannedIncomes = plannedIncomes
    .filter(isScheduledForSelectedMonth)
    .map((item) => getEffectiveRecurringItemForPeriod(item, targetPeriodKey));
  const visiblePlannedDebitExpenses = plannedDebitExpenses
    .filter(isScheduledForSelectedMonth)
    .map((item) => getEffectiveRecurringItemForPeriod(item, targetPeriodKey));
  const visiblePlannedCreditExpenses = plannedCreditExpenses
    .filter(isScheduledForSelectedMonth)
    .map((item) => getEffectiveRecurringItemForPeriod(item, targetPeriodKey));

  // Agrupamento inteligente por data com subtotais diários
  const groupedPlannedIncomes = groupRecurringItemsByDate(
    visiblePlannedIncomes,
    targetYear,
    targetMonth
  );
  const groupedPlannedDebitExpenses = groupRecurringItemsByDate(
    visiblePlannedDebitExpenses,
    targetYear,
    targetMonth
  );
  const groupedPlannedCreditExpenses = groupRecurringItemsByDate(
    visiblePlannedCreditExpenses,
    targetYear,
    targetMonth
  );

  const totalIncomesActive = visiblePlannedIncomes
    .filter(isActiveInSelectedMonth)
    .reduce((acc, r) => acc + r.amount, 0);

  const totalDebitExpensesActive = visiblePlannedDebitExpenses
    .filter(isActiveInSelectedMonth)
    .reduce((acc, r) => acc + r.amount, 0);

  const totalAvailable = projection.openingBalance + projection.projectedIncome;
  const freePercentage =
    totalAvailable > 0
      ? Math.max(
          0,
          Math.round((projection.projectedFreeBalance / totalAvailable) * 100)
        )
      : 0;

  const creditCommitments =
    projection.cardInstallments + projection.recurringCreditTotal;
  const debitCommitments = projection.recurringDebitTotal;

  const realizedShare =
    projection.totalCommitted > 0
      ? (projection.actualOutflowTotal / projection.totalCommitted) * 100
      : 0;
  const creditShare =
    projection.totalCommitted > 0
      ? (creditCommitments / projection.totalCommitted) * 100
      : 0;
  const debitShare =
    projection.totalCommitted > 0
      ? (debitCommitments / projection.totalCommitted) * 100
      : 0;

  // Informações de cartões de crédito
  const creditCards = cards.filter((c) => c.type === "credit");
  const primaryCreditCard = creditCards[0];
  const creditCardNameText =
    creditCards.length > 0
      ? creditCards.length === 1
        ? creditCards[0].name
        : creditCards.map((c) => c.name).join(", ")
      : "Nubank";
  const creditCardDueDayText = primaryCreditCard?.dueDay
    ? `dia ${primaryCreditCard.dueDay}`
    : "dia 15";

  const handleOpenModal = (
    mode: "income" | "expense" | "expense-debit" | "expense-credit",
    targetCardId?: string
  ) => {
    const isIncome = mode === "income";
    const isCredit = mode === "expense-credit";

    setModalType(isIncome ? "income" : "expense");
    setNewCategory(isIncome ? "Salário / Extra" : isCredit ? "Assinaturas & Lazer" : "Moradia & Contas");

    const checkingAcc =
      cards.find((card) => card.type === "checking")?.name ||
      accountOptions.find((acc) => acc.includes("Débito") || acc.includes("Pix")) ||
      "Débito/Pix";

    const targetCreditCard = targetCardId ? cards.find((c) => c.id === targetCardId) : null;
    const creditAcc =
      targetCreditCard?.name ||
      cards.find((card) => card.type === "credit")?.name ||
      accountOptions.find((acc) => !acc.includes("Débito") && !acc.includes("Pix")) ||
      "Cartão de Crédito";

    setNewAccount(isIncome ? checkingAcc : isCredit ? creditAcc : checkingAcc);
    setRecurrenceSelection(isIncome ? "business_day_5" : "fixed_day");
    setIsCustomDayActive(false);
    setDurationMode(isIncome ? "continuous" : isCredit ? "one-time" : "one-time");
    setInstallmentsCount(3);
    setInstallmentsInput("3");
    setInstallmentPricingType("total");
    setIsAddingMenuOpen(false);
    setIsAddingModalOpen(true);
  };

  const handleCreatePlannedItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(newAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(cleanAmount) || cleanAmount <= 0 || !newTitle.trim()) return;

    let computedDay = 10;
    if (recurrenceSelection === "business_day_5") {
      computedDay = currentMonth5thBusinessDay;
    } else if (isCustomDayActive) {
      computedDay = parseInt(customDayInput) || 10;
    } else {
      computedDay = parseInt(fixedDayValue) || 10;
    }

    const effectiveInstallments =
      durationMode === "installments"
        ? Math.max(2, parseInt(installmentsInput, 10) || installmentsCount || 2)
        : durationMode === "one-time"
          ? 1
          : undefined;

    const finalAmount =
      durationMode === "installments" && installmentPricingType === "total" && effectiveInstallments
        ? Math.round((cleanAmount / effectiveInstallments) * 100) / 100
        : cleanAmount;

    try {
      await addRecurringItem({
        title: newTitle.trim(),
        amount: finalAmount,
        type: modalType,
        account: newAccount,
        cardId: cards.find((card) => card.name === newAccount)?.id || null,
        category: newCategory,
        dueDay: computedDay,
        recurrenceType: recurrenceSelection,
        installmentsCount: effectiveInstallments,
        startMonth: targetMonth,
        startYear: targetYear,
        active: true,
      });
      setNewTitle("");
      setNewAmount("");
      setIsAddingModalOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível salvar o planejamento.");
    }
  };

  const handleToggleRecurring = async (id: string) => {
    try {
      await toggleRecurringItem(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível alterar o planejamento.");
    }
  };

  const handleOpenEditModal = (item: RecurringItem) => {
    const effective = getEffectiveRecurringItemForPeriod(item, targetPeriodKey);
    setEditingItem(item);
    setEditTitle(effective.title);
    setEditAmount(effective.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setEditAccount(effective.account);
    setEditCategory(effective.category);
    setEditType(effective.type || "expense");
    setEditRecurrence(effective.recurrenceType || "fixed_day");
    const isSpecialDay = effective.dueDay === 5 || effective.dueDay === 10 || effective.dueDay === 20;
    setEditFixedDay(isSpecialDay ? String(effective.dueDay) : "10");
    setEditIsCustomDay(!isSpecialDay && effective.recurrenceType !== "business_day_5");
    setEditCustomDay(String(effective.dueDay || 10));

    if (!item.installmentsCount || item.installmentsCount === 0) {
      setEditDurationMode("continuous");
      setEditInstallmentsCount(3);
      setEditInstallmentsInput("3");
      setEditInstallmentPricingType("monthly");
    } else if (item.installmentsCount === 1) {
      setEditDurationMode("one-time");
      setEditInstallmentsCount(1);
      setEditInstallmentsInput("1");
      setEditInstallmentPricingType("monthly");
    } else {
      setEditDurationMode("installments");
      setEditInstallmentsCount(item.installmentsCount);
      setEditInstallmentsInput(String(item.installmentsCount));
      setEditInstallmentPricingType("monthly");
    }

    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const cleanAmount = parseFloat(editAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(cleanAmount) || cleanAmount <= 0 || !editTitle.trim()) return;

    let computedDay = 10;
    if (editRecurrence === "business_day_5") {
      computedDay = currentMonth5thBusinessDay;
    } else if (editIsCustomDay) {
      computedDay = parseInt(editCustomDay) || 10;
    } else {
      computedDay = parseInt(editFixedDay) || 10;
    }

    const effectiveEditInstallments =
      editDurationMode === "installments"
        ? Math.max(2, parseInt(editInstallmentsInput, 10) || editInstallmentsCount || 2)
        : editDurationMode === "one-time"
          ? 1
          : undefined;

    const finalEditAmount =
      editDurationMode === "installments" && editInstallmentPricingType === "total" && effectiveEditInstallments
        ? Math.round((cleanAmount / effectiveEditInstallments) * 100) / 100
        : cleanAmount;

    const updates: Partial<RecurringItem> = {
      title: editTitle.trim(),
      amount: finalEditAmount,
      type: editType,
      account: editAccount,
      cardId: cards.find((card) => card.name === editAccount)?.id || null,
      category: editCategory,
      dueDay: computedDay,
      recurrenceType: editRecurrence,
      installmentsCount: effectiveEditInstallments,
    };

    const isMultiMonth = !editingItem.installmentsCount || editingItem.installmentsCount > 1;

    if (isMultiMonth) {
      // Abre modal de confirmação de escopo (Apenas nesta ocorrência vs Todas as ocorrências)
      setScopeEditModal({
        isOpen: true,
        item: editingItem,
        updates,
      });
      return;
    }

    try {
      await updateRecurringItem(editingItem.id, updates);
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível atualizar o planejamento.");
    }
  };

  const handleApplyScopeEdit = async (scope: "single" | "all") => {
    if (!scopeEditModal) return;
    const { item, updates } = scopeEditModal;

    try {
      if (scope === "single") {
        await updateRecurringItemOccurrence(item.id, targetPeriodKey, updates);
      } else {
        await updateRecurringItem(item.id, updates);
      }
      setScopeEditModal(null);
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível atualizar o planejamento.");
    }
  };

  const handleApplyDeleteScope = async (scope: "single" | "all") => {
    if (!itemToDelete) return;
    try {
      if (scope === "single") {
        await deleteRecurringItemOccurrence(itemToDelete.id, targetPeriodKey);
      } else {
        await deleteRecurringItem(itemToDelete.id);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível excluir o planejamento.");
    } finally {
      setItemToDelete(null);
    }
  };

  const handleRealizeFromEditModal = async () => {
    if (!editingItem) return;
    const cleanAmount = parseFloat(editAmount.replace(/\./g, "").replace(",", "."));
    const finalAmount = !isNaN(cleanAmount) && cleanAmount > 0 ? cleanAmount : editingItem.amount;

    let computedDay = 10;
    if (editRecurrence === "business_day_5") {
      computedDay = currentMonth5thBusinessDay;
    } else if (editIsCustomDay) {
      computedDay = parseInt(editCustomDay) || 10;
    } else {
      computedDay = parseInt(editFixedDay) || 10;
    }

    try {
      setProcessingItemId(editingItem.id);
      const updatedItem: RecurringItem = {
        ...editingItem,
        title: editTitle.trim() || editingItem.title,
        amount: finalAmount,
        type: editType,
        account: editAccount,
        cardId: cards.find((card) => card.name === editAccount)?.id || null,
        category: editCategory,
        dueDay: computedDay,
        recurrenceType: editRecurrence,
      };

      await updateRecurringItem(editingItem.id, updatedItem);
      await realizeRecurringItemNow(updatedItem, targetYear, targetMonth, finalAmount);
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível efetivar o planejamento.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const handleRealizeNow = async (item: RecurringItem) => {
    try {
      setProcessingItemId(item.id);
      const effectiveDay = getEffectiveDueDay(item, targetYear, targetMonth);
      const plannedDate = new Date(targetYear, targetMonth, effectiveDay, 12, 0, 0);
      await realizeRecurringItemNow(item, targetYear, targetMonth, undefined, plannedDate);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível efetivar o lançamento.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const handleUnrealize = async (item: RecurringItem) => {
    try {
      setProcessingItemId(item.id);
      await unrealizeRecurringItem(item, targetYear, targetMonth);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível desfazer a efetivação.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const renderItemRow = (item: RecurringItem, sectionKind: "income" | "debit" | "credit") => {
    const effectiveDay = getEffectiveDueDay(item, targetYear, targetMonth);
    const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
    const hasInstallments = Boolean(item.installmentsCount && item.installmentsCount > 1);
    const isFinishedInThisMonth = hasInstallments && monthOffset >= (item.installmentsCount || 0);
    const currentInstallmentNum = monthOffset >= 0 ? monthOffset + 1 : 1;
    const isRealizedInThisMonth = Boolean(item.realizedPeriods?.includes(getPeriodKey(targetYear, targetMonth)));
    const isProcessing = processingItemId === item.id;

    let dateDescription = "";
    if (sectionKind === "income") {
      dateDescription = item.recurrenceType === "business_day_5"
        ? `5º dia útil (dia ${effectiveDay})`
        : `Previsão dia ${effectiveDay}`;
    } else if (sectionKind === "debit") {
      dateDescription = item.recurrenceType === "business_day_5"
        ? `5º dia útil (dia ${effectiveDay})`
        : `Dia ${effectiveDay}`;
    } else {
      dateDescription = `Cobrado dia ${effectiveDay}`;
    }

    return (
      <div
        key={item.id}
        onClick={() => handleOpenEditModal(item)}
        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 hover:bg-[#F9F9FB] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {isRealizedInThisMonth ? (
            <div
              className={`w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0 shadow-2xs ${
                sectionKind === "income"
                  ? "bg-emerald-600"
                  : sectionKind === "credit"
                  ? "bg-indigo-600"
                  : "bg-[#1D1D1F]"
              }`}
              title="Efetivado nesta competência"
            >
              <Check size={12} strokeWidth={3} />
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleToggleRecurring(item.id);
              }}
              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                item.active
                  ? sectionKind === "income"
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : sectionKind === "credit"
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-[#1D1D1F] border-[#1D1D1F] text-white"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
              title={item.active ? "Desativar" : "Ativar"}
            >
              {item.active && <Check size={11} strokeWidth={3} />}
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className={`text-sm font-medium truncate ${
                  item.active ? "text-[#1D1D1F] group-hover:text-black" : "text-gray-400 line-through"
                }`}
              >
                {item.title}
              </h4>
              {isRealizedInThisMonth && (
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                    sectionKind === "income"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : sectionKind === "credit"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-gray-100 text-[#1D1D1F] border-black/5"
                  }`}
                >
                  {sectionKind === "credit" ? "Na fatura" : "Efetivado"}
                </span>
              )}
            </div>
            <p className="text-xs text-[#86868B] truncate mt-0.5">
              {dateDescription} · {formatAccountLabel(item.account)} · {item.category}
              {hasInstallments && ` · Parcela ${currentInstallmentNum} de ${item.installmentsCount}`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
          {/* Ação Rápida Antecipada: "Recebi antes" / "Paguei antes" ("clico e já faz na hora") */}
          {!isRealizedInThisMonth && !isFinishedInThisMonth && item.active ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleRealizeNow(item);
              }}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1D1D1F]/5 hover:bg-[#1D1D1F] hover:text-white text-[#1D1D1F] transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-2xs"
              title={
                item.type === "income"
                  ? "Recebi adiantado: efetivar entrada agora"
                  : "Paguei adiantado: debitar e efetivar saída agora"
              }
            >
              {isProcessing ? (
                <Loader2 size={12} className="animate-spin text-current" />
              ) : (
                <Zap size={12} className="text-amber-500 fill-amber-500 shrink-0" />
              )}
              <span>{item.type === "income" ? "Recebi antes" : "Paguei antes"}</span>
            </button>
          ) : isRealizedInThisMonth ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleUnrealize(item);
              }}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 text-[11px] text-[#86868B] hover:text-rose-600 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-rose-50"
              title="Desfazer efetivação desta competência"
            >
              {isProcessing ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RotateCcw size={11} />
              )}
              <span className="text-[11px]">Desfazer</span>
            </button>
          ) : null}

          {/* Valor formatado */}
          <span
            className={`text-sm font-semibold tracking-tight min-w-[90px] text-right ${
              isFinishedInThisMonth
                ? "text-gray-400 line-through text-xs"
                : isRealizedInThisMonth || item.active
                ? sectionKind === "income"
                  ? "text-emerald-600"
                  : "text-[#1D1D1F]"
                : "text-gray-400"
            }`}
          >
            {isFinishedInThisMonth
              ? "Quitado"
              : sectionKind === "income"
              ? `+ R$ ${formatCurrency(item.amount)}`
              : `R$ ${formatCurrency(item.amount)}`}
          </span>

          {/* Botão de Edição */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEditModal(item);
            }}
            className="text-gray-400 hover:text-[#1D1D1F] transition-colors p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
            title="Editar planejamento"
          >
            <Pencil size={14} />
          </button>

          {/* Botão de Exclusão */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setItemToDelete(item);
            }}
            className="text-gray-300 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-7 animate-in fade-in duration-500 relative">
      {/* 1. CABEÇALHO */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Visão futura & previsibilidade
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Planejamento Mensal
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          {/* Indicador de Saldo em Conta / Saldo Vindo do Mês Anterior */}
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-black/[0.04] shadow-2xs">
            <span className="text-xs text-[#86868B]">
              {activeMonthObj.isCurrent
                ? "Saldo em conta:"
                : activeMonthObj.isPast
                  ? `Realizado em ${activeMonthObj.short}:`
                  : `Saldo vindo de ${planningMonths[selectedMonthIndex - 1]?.short}:`}
            </span>
            <span className="text-xs font-semibold text-[#1D1D1F]">
              R$ {formatCurrency(projection.openingBalance)}
            </span>
          </div>

          {/* Ação Principal: + Adicionar com Menu Contextual Elegante */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddingMenuOpen((prev) => !prev)}
              className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-xs cursor-pointer select-none"
            >
              <Plus strokeWidth={2} size={15} />
              <span>Adicionar</span>
            </button>

          {isAddingMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsAddingMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-60 bg-white/95 backdrop-blur-xl border border-black/[0.08] rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans">
                <button
                  type="button"
                  onClick={() => handleOpenModal("income")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F2F2F7] transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <ArrowDownLeft size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#1D1D1F]">
                      Recebimento futuro
                    </span>
                    <span className="block text-[10px] text-[#86868B]">
                      Entrada prevista no saldo
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenModal("expense-debit")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F2F2F7] transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
                    <Building2 size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#1D1D1F]">
                      Conta planejada
                    </span>
                    <span className="block text-[10px] text-[#86868B]">
                      Desconto direto da conta
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenModal("expense-credit")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F2F2F7] transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                    <CreditCard size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#1D1D1F]">
                      Compra no cartão
                    </span>
                    <span className="block text-[10px] text-[#86868B]">
                      Entra na fatura futura
                    </span>
                  </div>
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navegação entre Meses (Controle Segmentado Suave Estilo iOS) */}
        <div className="bg-[#E5E5EA]/60 p-1 rounded-full flex items-center gap-1 overflow-x-auto border border-black/5 scrollbar-none touch-pan-x">
          {planningMonths.map((m, idx) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setSelectedMonthIndex(idx)}
              className={`flex-1 min-w-[76px] sm:min-w-[90px] py-1.5 px-2.5 sm:px-3 rounded-full text-xs font-semibold transition-all select-none text-center cursor-pointer ${
                selectedMonthIndex === idx
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* 2. RESUMO FINANCEIRO PRINCIPAL (Superfície Única Apple com 3 Métricas Essenciais) */}
        <div className="bg-white rounded-[24px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_1px_6px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* 1. Entradas previstas */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#86868B] tracking-tight">
                Entradas previstas
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                R$ {formatCurrency(projection.projectedIncome)}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                R$ {formatCurrency(projection.actualIncomeTotal)} recebidos · R${" "}
                {formatCurrency(projection.plannedIncomesTotal)} pendentes
              </p>
            </div>

            {/* 2. Compromissos */}
            <div className="pt-5 sm:pt-0 sm:pl-8 space-y-1">
              <span className="text-xs font-medium text-[#86868B] tracking-tight">
                Compromissos
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                R$ {formatCurrency(projection.totalCommitted)}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                R$ {formatCurrency(projection.actualOutflowTotal)} pagos · R${" "}
                {formatCurrency(projection.pendingCommitted)} pendentes
              </p>
            </div>

            {/* 3. Saldo livre projetado (Destaque Principal) */}
            <div className="pt-5 sm:pt-0 sm:pl-8 space-y-1">
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                Saldo livre projetado
              </span>
              <div
                className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                  projection.projectedFreeBalance >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                R$ {formatCurrency(projection.projectedFreeBalance)}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                {activeMonthObj.isCurrent
                  ? `Considera R$ ${formatCurrency(projection.openingBalance)} em conta · ${freePercentage}% livre`
                  : activeMonthObj.isPast
                    ? `Resultado consolidado de ${activeMonthObj.name}`
                    : `Inclui R$ ${formatCurrency(projection.openingBalance)} vindo de ${planningMonths[selectedMonthIndex - 1]?.name}`}
              </p>
            </div>
          </div>
        </div>

        {/* 3. COMPOSIÇÃO DOS COMPROMISSOS (Área Simples e Silenciosa) */}
        <section
          data-testid="monthly-macro-summary"
          className="bg-white rounded-[22px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_1px_4px_rgba(0,0,0,0.02)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
              Composição dos compromissos
            </h2>
            <span className="text-xs text-[#86868B]">
              Total: R$ {formatCurrency(projection.totalCommitted)}
            </span>
          </div>

          {/* Três métricas limpas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
            <div>
              <span className="text-xs text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8E8E93]" />
                Já saiu da conta
              </span>
              <div className="text-base sm:text-lg font-semibold text-[#1D1D1F] mt-0.5">
                R$ {formatCurrency(projection.actualOutflowTotal)}
              </div>
            </div>

            <div>
              <span className="text-xs text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D1D1F]" />
                Contas diretas a pagar
              </span>
              <div className="text-base sm:text-lg font-semibold text-[#1D1D1F] mt-0.5">
                R$ {formatCurrency(debitCommitments)}
              </div>
            </div>

            <div>
              <span className="text-xs text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                Faturas de cartão a pagar
              </span>
              <div className="text-base sm:text-lg font-semibold text-[#1D1D1F] mt-0.5">
                R$ {formatCurrency(projection.totalInvoicesPending ?? creditCommitments)}
              </div>
            </div>
          </div>

          {/* Barra Horizontal de Composição */}
          <div
            className="h-2 rounded-full bg-[#F2F2F7] overflow-hidden flex gap-0.5"
            aria-label="Distribuição dos compromissos"
          >
            {projection.totalCommitted > 0 ? (
              <>
                <div
                  className="h-full bg-[#8E8E93] transition-all duration-500"
                  style={{ width: `${realizedShare}%` }}
                  title={`Já saiu: R$ ${formatCurrency(projection.actualOutflowTotal)}`}
                />
                <div
                  className="h-full bg-[#1D1D1F] transition-all duration-500"
                  style={{ width: `${debitShare}%` }}
                  title={`Contas diretas: R$ ${formatCurrency(debitCommitments)}`}
                />
                <div
                  className="h-full bg-[#6366F1] transition-all duration-500"
                  style={{ width: `${creditShare}%` }}
                  title={`Faturas de cartão: R$ ${formatCurrency(creditCommitments)}`}
                />
              </>
            ) : (
              <div className="h-full w-full bg-gray-200/50" />
            )}
          </div>

          {/* Pequeno Insight Complementar */}
          <p className="text-xs text-[#86868B] leading-relaxed pt-0.5">
            R$ {formatCurrency(debitCommitments)} em contas diretas + R$ {formatCurrency(projection.totalInvoicesPending ?? creditCommitments)} em faturas de cartão totalizam R${" "}
            {formatCurrency(projection.pendingCommitted)} que sairão da sua conta.
          </p>
        </section>

        {/* 4. PLANEJAMENTO DO MÊS */}
        <section className="space-y-6 pt-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#86868B]">
              Planejamento
            </h2>
          </div>

          {/* 4.1 Recebimentos Previstos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                Recebimentos previstos
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-emerald-600">
                  + R$ {formatCurrency(totalIncomesActive)}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenModal("income")}
                  className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[22px] border border-black/[0.04] shadow-[0_1px_4px_rgba(0,0,0,0.02)] overflow-hidden divide-y divide-gray-100">
              {groupedPlannedIncomes.length === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <p className="text-sm font-medium text-[#1D1D1F]">
                    Nenhum recebimento previsto em {activeMonthObj.name}
                  </p>
                  <p className="text-xs text-[#86868B]">
                    Agende salários, comissões ou rendimentos previstos.
                  </p>
                </div>
              ) : (
                groupedPlannedIncomes.map((group) => (
                  <div key={group.day} className="divide-y divide-gray-100">
                    <div className="bg-[#FBFBFD] px-4 py-2 flex items-center justify-between border-b border-black/[0.03]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600/70" />
                        <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                          {group.label}
                        </span>
                        <span className="text-[11px] text-[#86868B]">
                          · {group.items.length} {group.items.length === 1 ? "recebimento" : "recebimentos"}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600">
                        + R$ {formatCurrency(group.totalAmount)}
                      </span>
                    </div>
                    {group.items.map((item) => renderItemRow(item, "income"))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4.2 Saídas da Conta (Transações programadas no débito direto) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  Saídas da conta
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Valores planejados que serão descontados diretamente do seu saldo.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-[#1D1D1F]">
                  R$ {formatCurrency(totalDebitExpensesActive)}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenModal("expense-debit")}
                  className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[22px] border border-black/[0.04] shadow-[0_1px_4px_rgba(0,0,0,0.02)] overflow-hidden divide-y divide-gray-100">
              {groupedPlannedDebitExpenses.length === 0 ? (
                <div className="p-7 text-center space-y-1.5">
                  <p className="text-sm font-medium text-[#1D1D1F]">
                    Nenhuma saída da conta planejada em {activeMonthObj.name}
                  </p>
                  <p className="text-xs text-[#86868B]">
                    Cadastre contas fixas como Aluguel, Luz, Internet ou Condomínio.
                  </p>
                </div>
              ) : (
                groupedPlannedDebitExpenses.map((group) => (
                  <div key={group.day} className="divide-y divide-gray-100">
                    <div className="bg-[#FBFBFD] px-4 py-2 flex items-center justify-between border-b border-black/[0.03]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1D1D1F]" />
                        <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                          {group.label}
                        </span>
                        <span className="text-[11px] text-[#86868B]">
                          · {group.items.length} {group.items.length === 1 ? "saída direta" : "saídas diretas"}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[#1D1D1F]">
                        R$ {formatCurrency(group.totalAmount)}
                      </span>
                    </div>
                    {group.items.map((item) => renderItemRow(item, "debit"))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4.3 Faturas dos Cartões de Crédito (Lá para baixo com Valor Somado e cada Cartão separado) */}
          <div className="bg-[#F8F8FA] rounded-[22px] p-5 sm:p-6 border border-black/[0.04] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-black/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CreditCard size={16} strokeWidth={2} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                      Faturas dos Cartões
                    </span>
                    {projection.totalInvoicesPending === 0 && (projection.totalInvoicesScheduled ?? 0) > 0 ? (
                      <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ Pagas na conta
                      </span>
                    ) : null}
                  </div>
                  <h4 className="text-sm font-semibold text-[#1D1D1F] tracking-tight mt-0.5">
                    {projection.cardInvoices && projection.cardInvoices.length > 0
                      ? `${projection.cardInvoices.length} ${projection.cardInvoices.length === 1 ? "cartão com fatura na saída da conta" : "cartões com faturas na saída da conta"}`
                      : "Nenhum cartão cadastrado"}
                  </h4>
                </div>
              </div>

              <div className="flex sm:flex-col sm:items-end justify-between items-center shrink-0">
                <div className="text-right">
                  <span className="text-[11px] text-[#86868B] mr-1.5 font-medium">
                    Valor Somado:
                  </span>
                  <span className="text-lg sm:text-xl font-semibold text-[#1D1D1F] tracking-tight">
                    R$ {formatCurrency(projection.totalInvoicesScheduled ?? creditCommitments)}
                  </span>
                </div>
                {projection.totalInvoicesPending !== undefined && projection.totalInvoicesPending < (projection.totalInvoicesScheduled ?? 0) && (
                  <span className="text-[11px] text-[#86868B]">
                    (R$ {formatCurrency(projection.totalInvoicesPending)} ainda pendente)
                  </span>
                )}
              </div>
            </div>

            {/* Lista Detalhada Cartão por Cartão */}
            {(!projection.cardInvoices || projection.cardInvoices.length === 0) ? (
              <div className="bg-white rounded-[18px] p-6 text-center border border-black/[0.04]">
                <p className="text-xs text-[#86868B]">
                  Cadastre um cartão de crédito na aba Cartões para visualizar faturas aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {projection.cardInvoices.map((ci) => {
                  const hasInstallments = ci.installmentsAmount > 0;
                  const hasRecurring = ci.recurringAmount > 0;
                  const isEmpty = !hasInstallments && !hasRecurring && ci.totalInvoice === 0;

                  return (
                    <div
                      key={ci.cardId}
                      className="bg-white rounded-[18px] border border-black/[0.05] p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow space-y-3"
                    >
                      {/* Topo do Cartão Específico */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: ci.cardColor || "#1D1D1F" }}
                          >
                            <CreditCard size={15} strokeWidth={2} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-semibold text-[#1D1D1F]">
                                {ci.cardName}
                              </h5>
                              {ci.isPaid ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ✓ Paga na conta
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-[#86868B] px-2 py-0.5 rounded-full bg-[#F2F2F7]">
                                  A pagar dia {ci.dueDay}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#86868B] mt-0.5">
                              Vencimento dia {ci.dueDay} · Fechamento dia {ci.closingDay}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] uppercase font-semibold tracking-wider text-[#86868B] block">
                              Fatura {ci.cardName}
                            </span>
                            <span className="text-base sm:text-lg font-semibold text-[#1D1D1F] tracking-tight">
                              R$ {formatCurrency(ci.totalInvoice)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenModal("expense-credit", ci.cardId)}
                            className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] px-2.5 py-1 rounded-full hover:bg-blue-50/50 transition-colors cursor-pointer shrink-0"
                            title={`Adicionar compra ou assinatura no ${ci.cardName}`}
                          >
                            + Compra
                          </button>
                        </div>
                      </div>

                      {/* Detalhamento sem duplicidade do que compõe esta fatura específica */}
                      {isEmpty ? (
                        <p className="text-xs text-[#86868B] bg-[#FBFBFD] px-3.5 py-2 rounded-xl border border-black/[0.02]">
                          Fatura zerada para {activeMonthObj.name}. Nenhuma compra faturada ou assinatura vinculada a este cartão.
                        </p>
                      ) : (
                        <div className="bg-[#FBFBFD] rounded-xl p-3 border border-black/[0.03] space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#86868B] border-b border-black/[0.03] pb-1.5">
                            <span>Composição da fatura</span>
                            <div className="flex items-center gap-3">
                              {hasInstallments && (
                                <span>Compras: <strong className="text-[#1D1D1F]">R$ {formatCurrency(ci.installmentsAmount)}</strong></span>
                              )}
                              {hasRecurring && (
                                <span>Assinaturas: <strong className="text-[#1D1D1F]">R$ {formatCurrency(ci.recurringAmount)}</strong></span>
                              )}
                            </div>
                          </div>

                          {/* Itens de assinaturas vinculadas a este cartão */}
                          {ci.recurringItems && ci.recurringItems.length > 0 && (
                            <div className="space-y-1.5 pt-0.5">
                              {ci.recurringItems.map((item) => renderItemRow(item, "credit"))}
                            </div>
                          )}

                          {/* Compras e parcelamentos faturados no cartão */}
                          {hasInstallments && (
                            <div className="flex items-center justify-between text-xs pt-1 px-1 text-[#86868B]">
                              <span>Lançamentos e compras faturadas no {ci.cardName}</span>
                              <span className="font-medium text-[#1D1D1F]">
                                R$ {formatCurrency(ci.installmentsAmount)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 5. MOVIMENTAÇÕES REALIZADAS (O que já aconteceu) */}
        <MonthlyMovementOverview
          transactions={selectedTransactions}
          cards={cards}
          monthLabel={activeMonthObj.name}
        />
      </div>

      {/* MODAL PADRÃO APPLE PAY (SMART ANIMATE APPLE PAY INTERACTION) */}
      {isAddingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            onClick={() => setIsAddingModalOpen(false)}
            className="fixed inset-0 bg-black/45 animate-apple-backdrop"
          />

          <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] z-50 animate-apple-sheet sm:animate-apple-modal max-h-[92dvh] sm:max-h-[88vh] flex flex-col font-sans overflow-hidden">
            {/* Pílula Apple */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

            <form onSubmit={handleCreatePlannedItem} className="flex-1 flex flex-col min-h-0">
              {/* HEADER DO MODAL FIXO NO TOPO */}
              <div className="flex items-center justify-between px-5 sm:px-6 pt-3 pb-3 border-b border-[#E5E5EA] shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsAddingModalOpen(false)}
                  className="text-[#0071E3] hover:text-[#0077ED] font-normal text-sm sm:text-base cursor-pointer active:opacity-60 transition-opacity py-1 px-1"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-black/[0.04] flex items-center justify-center text-[#1D1D1F] shrink-0">
                    <CalendarDays size={15} strokeWidth={2} />
                  </div>
                  <div className="text-center sm:text-left min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-[#1D1D1F] leading-tight truncate">
                      {modalType === "income" ? "Novo Recebimento" : "Nova Despesa Planejada"}
                    </h2>
                    <span className="text-[11px] font-medium text-[#86868B] block truncate">
                      Previsão para {activeMonthObj.name}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!newTitle.trim() || !newAmount.trim()}
                  className="text-[#0071E3] hover:text-[#0077ED] font-semibold text-sm sm:text-base cursor-pointer active:opacity-60 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed py-1 px-1"
                >
                  Salvar
                </button>
              </div>

              {/* CORPO DO FORMULÁRIO COM ROLAGEM */}
              <div className="flex-1 overflow-y-auto px-0 touch-scroll">
                {/* TABELA AGRUPADA ESTILO APPLE */}
                <div className="divide-y divide-[#E5E5EA] border-b border-[#E5E5EA] bg-white">
                {/* LINHA: TIPO */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    TIPO
                  </span>
                  <div className="flex-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModalType("income");
                        setNewCategory("Salário / Extra");
                        const checkingAcc =
                          cards.find((card) => card.type === "checking")?.name || "Débito/Pix";
                        setNewAccount(checkingAcc);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        modalType === "income"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <ArrowDownLeft size={13} />
                      <span>Recebimento</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalType("expense");
                        setNewCategory("Moradia & Contas");
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        modalType === "expense"
                          ? "bg-[#1D1D1F] text-white shadow-2xs"
                          : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <ArrowUpRight size={13} />
                      <span>Pagamento</span>
                    </button>
                  </div>
                </div>

                {/* LINHA: IDENTIFICAÇÃO */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    ITEM
                  </span>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={
                      modalType === "income"
                        ? "Ex: Hacktown Ingresso, Salário Quinzena, Freelance..."
                        : "Ex: Aluguel, Academia, Internet, Luz..."
                    }
                    className="flex-1 text-sm font-medium text-[#1D1D1F] placeholder:text-[#86868B] outline-none bg-transparent"
                  />
                </div>

                {/* LINHA: VALOR */}
                <div className="flex items-center px-6 py-4">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    VALOR
                  </span>
                  <div className="flex-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold text-[#1D1D1F]">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="w-full text-2xl sm:text-3xl font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* LINHA: DIA PREVISTO / 5º DIA ÚTIL */}
                <div className="px-6 py-4 space-y-3 bg-[#FAFAFC]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                      DATA / RECORRÊNCIA
                    </span>
                    <span className="text-xs font-semibold text-[#1D1D1F]">
                      Mês Base: {activeMonthObj.short}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Botão 5º Dia Útil Dinâmico */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("business_day_5");
                        setIsCustomDayActive(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceSelection === "business_day_5"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-700 font-bold">⚡ 5º Dia Útil</span>
                        {recurrenceSelection === "business_day_5" && (
                          <Check size={14} className="text-emerald-700" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">
                        Cálculo bancário
                      </span>
                    </button>

                    {/* Dia 5 */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("fixed_day");
                        setFixedDayValue("5");
                        setIsCustomDayActive(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceSelection === "fixed_day" && fixedDayValue === "5" && !isCustomDayActive
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 5</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>

                    {/* Dia 10 */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("fixed_day");
                        setFixedDayValue("10");
                        setIsCustomDayActive(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceSelection === "fixed_day" && fixedDayValue === "10" && !isCustomDayActive
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 10</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>

                    {/* Dia 20 */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("fixed_day");
                        setFixedDayValue("20");
                        setIsCustomDayActive(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceSelection === "fixed_day" && fixedDayValue === "20" && !isCustomDayActive
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 20</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>
                  </div>

                  {/* Dia Personalizado */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("fixed_day");
                        setIsCustomDayActive(true);
                      }}
                      className={`text-xs font-semibold hover:underline cursor-pointer ${
                        isCustomDayActive ? "text-[#1D1D1F] font-bold" : "text-[#86868B]"
                      }`}
                    >
                      Outro dia fixo do mês:
                    </button>
                    {isCustomDayActive && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#86868B]">Dia</span>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={customDayInput}
                          onChange={(e) => setCustomDayInput(e.target.value)}
                          className="w-14 h-7 text-center rounded-lg border border-black/10 bg-white font-semibold text-xs outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* DURAÇÃO: Uma vez / Parcelado / Contínuo */}
                <div className="px-6 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                      DURAÇÃO DO COMPROMISSO
                    </span>
                    <span className="text-[11px] text-[#86868B]">
                      {durationMode === "one-time"
                        ? "Apenas neste mês"
                        : durationMode === "installments"
                          ? `${Math.max(2, parseInt(installmentsInput, 10) || installmentsCount || 2)} parcelas mensais`
                          : "Recorrente contínuo"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDurationMode("one-time")}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        durationMode === "one-time"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Apenas 1 mês</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Pagamento único</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDurationMode("installments");
                        if (!installmentsInput || parseInt(installmentsInput, 10) < 2) {
                          setInstallmentsCount(3);
                          setInstallmentsInput("3");
                        }
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        durationMode === "installments"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Parcelado</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Duração definida</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDurationMode("continuous")}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        durationMode === "continuous"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Contínuo</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Sem prazo final</span>
                    </button>
                  </div>

                  {durationMode === "installments" && (
                    <div className="rounded-2xl border border-black/[0.06] bg-[#F9F9FB] p-3.5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#86868B] font-medium">Quantidade de parcelas:</span>
                        <span className="font-bold text-[#1D1D1F] bg-black/[0.04] px-2.5 py-0.5 rounded-md">
                          {Math.max(2, parseInt(installmentsInput, 10) || installmentsCount || 2)}x mensais
                        </span>
                      </div>

                      {/* Chips rápidos mais usados */}
                      <div className="flex flex-wrap gap-1.5">
                        {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((count) => {
                          const isSelected = (parseInt(installmentsInput, 10) || installmentsCount) === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              onClick={() => {
                                setInstallmentsCount(count);
                                setInstallmentsInput(String(count));
                              }}
                              className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                                isSelected
                                  ? "bg-[#1D1D1F] text-white shadow-2xs"
                                  : "bg-white border border-black/[0.06] text-[#1D1D1F] hover:bg-gray-100"
                              }`}
                            >
                              {count}x
                            </button>
                          );
                        })}
                      </div>

                      {/* Campo livre: parcelar em quantas vezes quiser */}
                      <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
                        <div className="text-left pr-2">
                          <span className="text-xs font-semibold text-[#1D1D1F] block">
                            Outro número de parcelas:
                          </span>
                          <span className="text-[10px] text-[#86868B] block">
                            Digite qualquer quantidade (ex: 7, 9, 15, 36, 48, 60...)
                          </span>
                        </div>

                        <div className="flex items-center gap-1 bg-white border border-black/10 rounded-xl p-1 shadow-2xs shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(installmentsInput, 10) || installmentsCount || 2;
                              const next = Math.max(2, current - 1);
                              setInstallmentsInput(String(next));
                              setInstallmentsCount(next);
                            }}
                            className="w-7 h-7 rounded-lg bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] font-bold text-xs flex items-center justify-center cursor-pointer select-none transition-all"
                            title="Diminuir 1 parcela"
                          >
                            -
                          </button>
                          <div className="flex items-center px-1">
                            <input
                              type="number"
                              min="2"
                              max="360"
                              value={installmentsInput}
                              onChange={(e) => {
                                setInstallmentsInput(e.target.value);
                                const parsed = parseInt(e.target.value, 10);
                                if (parsed && parsed >= 2) {
                                  setInstallmentsCount(parsed);
                                }
                              }}
                              onBlur={() => {
                                const parsed = Math.max(2, parseInt(installmentsInput, 10) || 2);
                                setInstallmentsInput(String(parsed));
                                setInstallmentsCount(parsed);
                              }}
                              className="w-12 text-center text-xs font-bold text-[#1D1D1F] outline-none bg-transparent"
                            />
                            <span className="text-xs font-bold text-[#86868B]">x</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(installmentsInput, 10) || installmentsCount || 2;
                              const next = current + 1;
                              setInstallmentsInput(String(next));
                              setInstallmentsCount(next);
                            }}
                            className="w-7 h-7 rounded-lg bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] font-bold text-xs flex items-center justify-center cursor-pointer select-none transition-all"
                            title="Aumentar 1 parcela"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Seletor de Modo de Valor: Total da compra vs Valor de cada parcela */}
                      <div className="bg-white rounded-xl p-2.5 border border-black/[0.05] space-y-2 mt-2">
                        <div className="flex items-center justify-between text-[11px] text-[#86868B]">
                          <span>Como você digitou o valor acima?</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#F2F2F7] rounded-lg">
                          <button
                            type="button"
                            onClick={() => setInstallmentPricingType("total")}
                            className={`py-1 text-center text-xs font-semibold rounded-md transition-all cursor-pointer ${
                              installmentPricingType === "total"
                                ? "bg-white text-[#1D1D1F] shadow-2xs"
                                : "text-[#86868B] hover:text-[#1D1D1F]"
                            }`}
                          >
                            Valor total da compra
                          </button>
                          <button
                            type="button"
                            onClick={() => setInstallmentPricingType("monthly")}
                            className={`py-1 text-center text-xs font-semibold rounded-md transition-all cursor-pointer ${
                              installmentPricingType === "monthly"
                                ? "bg-white text-[#1D1D1F] shadow-2xs"
                                : "text-[#86868B] hover:text-[#1D1D1F]"
                            }`}
                          >
                            Valor de cada parcela
                          </button>
                        </div>

                        {(() => {
                          const clean = parseFloat(newAmount.replace(/\./g, "").replace(",", ".")) || 0;
                          const count = Math.max(2, parseInt(installmentsInput, 10) || installmentsCount || 2);
                          if (clean <= 0) return null;
                          return (
                            <div className="text-[11px] bg-blue-50/60 border border-blue-100 rounded-lg p-2 text-blue-900 flex items-center justify-between">
                              {installmentPricingType === "total" ? (
                                <span>
                                  Total <strong>R$ {formatCurrency(clean)}</strong> ÷ {count}x = <strong>R$ {formatCurrency(clean / count)}/mês</strong>
                                </span>
                              ) : (
                                <span>
                                  {count}x de <strong>R$ {formatCurrency(clean)}</strong> = Total de <strong>R$ {formatCurrency(clean * count)}</strong>
                                </span>
                              )}
                              <span className="text-[10px] text-blue-700/80 font-medium ml-2 shrink-0">
                                {installmentPricingType === "total" ? "Divisão automática" : "Valor fixo por mês"}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* LINHA: CONTA DE DESTINO / CARTÃO */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    {modalType === "income" ? "DESTINO" : "FORMA"}
                  </span>
                  <select
                    value={newAccount}
                    onChange={(e) => setNewAccount(e.target.value)}
                    className="flex-1 text-xs font-medium text-[#1D1D1F] bg-transparent outline-none cursor-pointer"
                  >
                    {accountOptions.map((acc) => (
                      <option key={acc} value={acc}>
                        {formatAccountLabel(acc)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* LINHA: CATEGORIA */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    CATEGORIA
                  </span>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex-1 text-xs font-medium text-[#1D1D1F] bg-transparent outline-none cursor-pointer"
                  >
                    {modalType === "income" ? (
                      <>
                        <option value="Salário / Extra">Salário / Renda Principal</option>
                        <option value="13º / Bônus">13º / Bônus / PLR</option>
                        <option value="Freelance / Extra">Freelance / Extra</option>
                        <option value="Rendimentos">Rendimentos de Investimento</option>
                        <option value="Reembolso">Reembolso / Outros</option>
                      </>
                    ) : (
                      <>
                        <option value="Moradia & Contas">Moradia & Contas Fixas</option>
                        <option value="Assinaturas & Lazer">Assinaturas & Lazer</option>
                        <option value="Alimentação">Alimentação & Supermercado</option>
                        <option value="Transporte">Transporte & Mobilidade</option>
                        <option value="Saúde & Bem-estar">Saúde & Bem-estar</option>
                        <option value="Educação">Educação</option>
                        <option value="Outros">Outros Compromissos</option>
                      </>
                    )}
                  </select>
                </div>
                </div>
              </div>

              {/* BOTÃO SALVAR PLANEJAMENTO FIXO NO RODAPÉ */}
              <div className="p-4 sm:p-5 bg-white/95 backdrop-blur-md border-t border-[#E5E5EA] shrink-0 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.04)] z-10">
                <button
                  type="submit"
                  disabled={!newTitle.trim() || !newAmount.trim()}
                  className="w-full h-12.5 rounded-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm transition-all duration-150 active:scale-[0.98] select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center justify-center gap-2"
                >
                  <Check size={16} strokeWidth={2.5} />
                  <span>
                    {modalType === "income" ? "Salvar Recebimento" : "Salvar Planejamento"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE PLANEJAMENTO ESTILO APPLE */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingItem(null);
            }}
            className="fixed inset-0 bg-black/45 animate-apple-backdrop"
          />

          <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] z-50 animate-apple-sheet sm:animate-apple-modal max-h-[92dvh] sm:max-h-[88vh] flex flex-col font-sans overflow-hidden">
            {/* Pílula Apple */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

            <form onSubmit={handleSaveEdit} className="flex-1 flex flex-col min-h-0">
              {/* HEADER DO MODAL FIXO NO TOPO */}
              <div className="flex items-center justify-between px-5 sm:px-6 pt-3 pb-3 border-b border-[#E5E5EA] shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="text-[#0071E3] hover:text-[#0077ED] font-normal text-sm sm:text-base cursor-pointer active:opacity-60 transition-opacity py-1 px-1"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-black/[0.04] flex items-center justify-center text-[#1D1D1F] shrink-0">
                    <Pencil size={15} strokeWidth={2} />
                  </div>
                  <div className="text-center sm:text-left min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-[#1D1D1F] leading-tight truncate">
                      Editar Planejamento
                    </h2>
                    <span className="text-[11px] font-medium text-[#86868B] block truncate">
                      {activeMonthObj.name} de {targetYear}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!editTitle.trim() || !editAmount.trim()}
                  className="text-[#0071E3] hover:text-[#0077ED] font-semibold text-sm sm:text-base cursor-pointer active:opacity-60 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed py-1 px-1"
                >
                  Salvar
                </button>
              </div>

              {/* CORPO DO FORMULÁRIO COM ROLAGEM */}
              <div className="flex-1 overflow-y-auto px-0 touch-scroll">
                {/* TABELA AGRUPADA ESTILO APPLE */}
                <div className="divide-y divide-[#E5E5EA] border-b border-[#E5E5EA] bg-white">
                {/* LINHA: TIPO */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    TIPO
                  </span>
                  <div className="flex-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditType("income")}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        editType === "income"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <ArrowDownLeft size={13} />
                      <span>Recebimento</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditType("expense")}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        editType === "expense"
                          ? "bg-[#1D1D1F] text-white shadow-2xs"
                          : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <ArrowUpRight size={13} />
                      <span>Pagamento</span>
                    </button>
                  </div>
                </div>

                {/* LINHA: IDENTIFICAÇÃO */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    ITEM
                  </span>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Nome do compromisso"
                    className="flex-1 text-sm font-medium text-[#1D1D1F] placeholder:text-[#86868B] outline-none bg-transparent"
                  />
                </div>

                {/* LINHA: VALOR */}
                <div className="flex items-center px-6 py-4">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    VALOR
                  </span>
                  <div className="flex-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold text-[#1D1D1F]">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full text-2xl sm:text-3xl font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* LINHA: DATA / RECORRÊNCIA */}
                <div className="px-6 py-4 space-y-3 bg-[#FAFAFC]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                      DATA / VENCIMENTO
                    </span>
                    <span className="text-xs font-semibold text-[#1D1D1F]">
                      Mês Base: {activeMonthObj.short}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditRecurrence("business_day_5");
                        setEditIsCustomDay(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        editRecurrence === "business_day_5"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-700 font-bold">⚡ 5º Dia Útil</span>
                        {editRecurrence === "business_day_5" && (
                          <Check size={14} className="text-emerald-700" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">
                        Cálculo bancário
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditRecurrence("fixed_day");
                        setEditFixedDay("5");
                        setEditIsCustomDay(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        editRecurrence === "fixed_day" && editFixedDay === "5" && !editIsCustomDay
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 5</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditRecurrence("fixed_day");
                        setEditFixedDay("10");
                        setEditIsCustomDay(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        editRecurrence === "fixed_day" && editFixedDay === "10" && !editIsCustomDay
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 10</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditRecurrence("fixed_day");
                        setEditFixedDay("20");
                        setEditIsCustomDay(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        editRecurrence === "fixed_day" && editFixedDay === "20" && !editIsCustomDay
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 20</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditRecurrence("fixed_day");
                        setEditIsCustomDay(true);
                      }}
                      className={`text-xs font-semibold hover:underline cursor-pointer ${
                        editIsCustomDay ? "text-[#1D1D1F] font-bold" : "text-[#86868B]"
                      }`}
                    >
                      Outro dia fixo do mês:
                    </button>
                    {editIsCustomDay && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#86868B]">Dia</span>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={editCustomDay}
                          onChange={(e) => setEditCustomDay(e.target.value)}
                          className="w-14 h-7 text-center rounded-lg border border-black/10 bg-white font-semibold text-xs outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* DURAÇÃO */}
                <div className="px-6 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                      DURAÇÃO DO COMPROMISSO
                    </span>
                    <span className="text-[11px] text-[#86868B]">
                      {editDurationMode === "one-time"
                        ? "Apenas neste mês"
                        : editDurationMode === "installments"
                          ? `${Math.max(2, parseInt(editInstallmentsInput, 10) || editInstallmentsCount || 2)} parcelas mensais`
                          : "Recorrente contínuo"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditDurationMode("one-time")}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        editDurationMode === "one-time"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Apenas 1 mês</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Pagamento único</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditDurationMode("installments");
                        if (!editInstallmentsInput || parseInt(editInstallmentsInput, 10) < 2) {
                          setEditInstallmentsCount(3);
                          setEditInstallmentsInput("3");
                        }
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        editDurationMode === "installments"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Parcelado</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Duração definida</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditDurationMode("continuous")}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        editDurationMode === "continuous"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Contínuo</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Sem prazo final</span>
                    </button>
                  </div>

                  {editDurationMode === "installments" && (
                    <div className="rounded-2xl border border-black/[0.06] bg-[#F9F9FB] p-3.5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#86868B] font-medium">Quantidade de parcelas:</span>
                        <span className="font-bold text-[#1D1D1F] bg-black/[0.04] px-2.5 py-0.5 rounded-md">
                          {Math.max(2, parseInt(editInstallmentsInput, 10) || editInstallmentsCount || 2)}x mensais
                        </span>
                      </div>

                      {/* Chips rápidos mais usados */}
                      <div className="flex flex-wrap gap-1.5">
                        {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((count) => {
                          const isSelected = (parseInt(editInstallmentsInput, 10) || editInstallmentsCount) === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              onClick={() => {
                                setEditInstallmentsCount(count);
                                setEditInstallmentsInput(String(count));
                              }}
                              className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                                isSelected
                                  ? "bg-[#1D1D1F] text-white shadow-2xs"
                                  : "bg-white border border-black/[0.06] text-[#1D1D1F] hover:bg-gray-100"
                              }`}
                            >
                              {count}x
                            </button>
                          );
                        })}
                      </div>

                      {/* Campo livre: parcelar em quantas vezes quiser */}
                      <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
                        <div className="text-left pr-2">
                          <span className="text-xs font-semibold text-[#1D1D1F] block">
                            Outro número de parcelas:
                          </span>
                          <span className="text-[10px] text-[#86868B] block">
                            Digite qualquer quantidade (ex: 7, 9, 15, 36, 48, 60...)
                          </span>
                        </div>

                        <div className="flex items-center gap-1 bg-white border border-black/10 rounded-xl p-1 shadow-2xs shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(editInstallmentsInput, 10) || editInstallmentsCount || 2;
                              const next = Math.max(2, current - 1);
                              setEditInstallmentsInput(String(next));
                              setEditInstallmentsCount(next);
                            }}
                            className="w-7 h-7 rounded-lg bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] font-bold text-xs flex items-center justify-center cursor-pointer select-none transition-all"
                            title="Diminuir 1 parcela"
                          >
                            -
                          </button>
                          <div className="flex items-center px-1">
                            <input
                              type="number"
                              min="2"
                              max="360"
                              value={editInstallmentsInput}
                              onChange={(e) => {
                                setEditInstallmentsInput(e.target.value);
                                const parsed = parseInt(e.target.value, 10);
                                if (parsed && parsed >= 2) {
                                  setEditInstallmentsCount(parsed);
                                }
                              }}
                              onBlur={() => {
                                const parsed = Math.max(2, parseInt(editInstallmentsInput, 10) || 2);
                                setEditInstallmentsInput(String(parsed));
                                setEditInstallmentsCount(parsed);
                              }}
                              className="w-12 text-center text-xs font-bold text-[#1D1D1F] outline-none bg-transparent"
                            />
                            <span className="text-xs font-bold text-[#86868B]">x</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(editInstallmentsInput, 10) || editInstallmentsCount || 2;
                              const next = current + 1;
                              setEditInstallmentsInput(String(next));
                              setEditInstallmentsCount(next);
                            }}
                            className="w-7 h-7 rounded-lg bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] font-bold text-xs flex items-center justify-center cursor-pointer select-none transition-all"
                            title="Aumentar 1 parcela"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Seletor de Modo de Valor: Total da compra vs Valor de cada parcela */}
                      <div className="bg-white rounded-xl p-2.5 border border-black/[0.05] space-y-2 mt-2">
                        <div className="flex items-center justify-between text-[11px] text-[#86868B]">
                          <span>Como você informou o valor na edição?</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#F2F2F7] rounded-lg">
                          <button
                            type="button"
                            onClick={() => setEditInstallmentPricingType("total")}
                            className={`py-1 text-center text-xs font-semibold rounded-md transition-all cursor-pointer ${
                              editInstallmentPricingType === "total"
                                ? "bg-white text-[#1D1D1F] shadow-2xs"
                                : "text-[#86868B] hover:text-[#1D1D1F]"
                            }`}
                          >
                            Valor total
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditInstallmentPricingType("monthly")}
                            className={`py-1 text-center text-xs font-semibold rounded-md transition-all cursor-pointer ${
                              editInstallmentPricingType === "monthly"
                                ? "bg-white text-[#1D1D1F] shadow-2xs"
                                : "text-[#86868B] hover:text-[#1D1D1F]"
                            }`}
                          >
                            Valor por parcela / mês
                          </button>
                        </div>

                        {(() => {
                          const clean = parseFloat(editAmount.replace(/\./g, "").replace(",", ".")) || 0;
                          const count = Math.max(2, parseInt(editInstallmentsInput, 10) || editInstallmentsCount || 2);
                          if (clean <= 0) return null;
                          return (
                            <div className="text-[11px] bg-blue-50/60 border border-blue-100 rounded-lg p-2 text-blue-900 flex items-center justify-between">
                              {editInstallmentPricingType === "total" ? (
                                <span>
                                  Total <strong>R$ {formatCurrency(clean)}</strong> ÷ {count}x = <strong>R$ {formatCurrency(clean / count)}/mês</strong>
                                </span>
                              ) : (
                                <span>
                                  {count}x de <strong>R$ {formatCurrency(clean)}</strong> = Total de <strong>R$ {formatCurrency(clean * count)}</strong>
                                </span>
                              )}
                              <span className="text-[10px] text-blue-700/80 font-medium ml-2 shrink-0">
                                {editInstallmentPricingType === "total" ? "Divisão automática" : "Valor fixo por mês"}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* LINHA: CONTA / CARTÃO */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    {editType === "income" ? "DESTINO" : "FORMA"}
                  </span>
                  <select
                    value={editAccount}
                    onChange={(e) => setEditAccount(e.target.value)}
                    className="flex-1 text-xs font-medium text-[#1D1D1F] bg-transparent outline-none cursor-pointer"
                  >
                    {accountOptions.map((acc) => (
                      <option key={acc} value={acc}>
                        {formatAccountLabel(acc)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* LINHA: CATEGORIA */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    CATEGORIA
                  </span>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="flex-1 text-xs font-medium text-[#1D1D1F] bg-transparent outline-none cursor-pointer"
                  >
                    {editType === "income" ? (
                      <>
                        <option value="Salário / Extra">Salário / Renda Principal</option>
                        <option value="13º / Bônus">13º / Bônus / PLR</option>
                        <option value="Freelance / Extra">Freelance / Extra</option>
                        <option value="Rendimentos">Rendimentos de Investimento</option>
                        <option value="Reembolso">Reembolso / Outros</option>
                      </>
                    ) : (
                      <>
                        <option value="Moradia & Contas">Moradia & Contas Fixas</option>
                        <option value="Assinaturas & Lazer">Assinaturas & Lazer</option>
                        <option value="Alimentação">Alimentação & Supermercado</option>
                        <option value="Transporte">Transporte & Mobilidade</option>
                        <option value="Saúde & Bem-estar">Saúde & Bem-estar</option>
                        <option value="Educação">Educação</option>
                        <option value="Outros">Outros Compromissos</option>
                      </>
                    )}
                  </select>
                </div>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO FIXOS NO RODAPÉ */}
              <div className="p-4 sm:p-5 bg-white/95 backdrop-blur-md border-t border-[#E5E5EA] shrink-0 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.04)] z-10 space-y-2">
                {!editingItem.realizedPeriods?.includes(getPeriodKey(targetYear, targetMonth)) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleRealizeFromEditModal}
                      disabled={processingItemId === editingItem.id}
                      className="h-12 rounded-full border border-[#1D1D1F]/20 hover:bg-black/5 text-[#1D1D1F] font-semibold text-xs transition-all active:scale-[0.98] select-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {processingItemId === editingItem.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Zap size={14} className="text-amber-500 fill-amber-500" />
                      )}
                      <span>Efetivar Agora (Hoje)</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!editTitle.trim() || !editAmount.trim()}
                      className="h-12 rounded-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-xs transition-all duration-150 active:scale-[0.98] select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center justify-center gap-2"
                    >
                      <Check size={15} strokeWidth={2.5} />
                      <span>Salvar Alterações</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={!editTitle.trim() || !editAmount.trim()}
                    className="w-full h-12 rounded-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-xs transition-all duration-150 active:scale-[0.98] select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center justify-center gap-2"
                  >
                    <Check size={15} strokeWidth={2.5} />
                    <span>Salvar Alterações</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ESCOPO DE EDIÇÃO APPLE HIG (Apenas esta ocorrência vs Todas as ocorrências) */}
      <AppleScopeModal
        isOpen={Boolean(scopeEditModal)}
        onClose={() => setScopeEditModal(null)}
        onSelectScope={handleApplyScopeEdit}
        title="Salvar Alterações"
        description={`Deseja aplicar as alterações em "${scopeEditModal?.updates.title || ""}" apenas no mês de ${activeMonthObj.name} ou em todas as ocorrências deste compromisso?`}
        singleLabel={`Apenas neste mês (${activeMonthObj.short})`}
        allLabel="Todas as ocorrências"
        cancelLabel="Revisar formulário"
        variant="primary"
      />

      {/* CONFIRMAÇÃO DE EXCLUSÃO APPLE HIG (COM SUPORTE A ESCOPO SE FOR RECORRENTE) */}
      {itemToDelete && (!itemToDelete.installmentsCount || itemToDelete.installmentsCount > 1) ? (
        <AppleScopeModal
          isOpen={Boolean(itemToDelete)}
          onClose={() => setItemToDelete(null)}
          onSelectScope={handleApplyDeleteScope}
          title="Excluir Planejamento"
          description={`"${itemToDelete.title}" é um compromisso recorrente. Deseja remover apenas a ocorrência de ${activeMonthObj.name} ou todas as ocorrências deste compromisso?`}
          singleLabel={`Excluir apenas deste mês (${activeMonthObj.short})`}
          allLabel="Excluir de todos os meses"
          cancelLabel="Manter compromisso"
          variant="danger"
        />
      ) : (
        <AppleConfirmModal
          isOpen={Boolean(itemToDelete)}
          onClose={() => setItemToDelete(null)}
          onConfirm={async () => {
            if (itemToDelete) {
              try {
                await deleteRecurringItem(itemToDelete.id);
              } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível excluir o planejamento.");
              } finally {
                setItemToDelete(null);
              }
            }
          }}
          title="Excluir Planejamento"
          description={`Tem certeza que deseja remover "${itemToDelete?.title || ""}" dos seus compromissos futuros?`}
          confirmLabel="Excluir"
          cancelLabel="Manter"
          variant="danger"
          iconType="trash"
        />
      )}
    </div>
  );
}
