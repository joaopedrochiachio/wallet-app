"use client";

import { useMemo, useState } from "react";
import { useWallet, TransactionItem } from "@/context/WalletContext";
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
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { MonthlyMovementOverview } from "@/components/planning/MonthlyMovementOverview";
import { MiniCard } from "@/components/wallet";
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
import {
  formatAccountLabel,
  getLedgerEntryDate,
  matchesLedgerCard,
  getInvoiceDueDate,
} from "@/lib/utils/ledger";
import {
  sanitizeTextInput,
  validateCurrency,
  validateDayOfMonth,
  validateInstallmentsCount,
} from "@/lib/utils/security";
import { RecurrenceType, RecurringItem } from "@/types";
import { auditFinancialIntegrity } from "@/lib/services/financialIntegrityService";

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
    addTransaction,
    deleteTransaction,
    payInvoice,
    unpayInvoice,
    mainBalance,
  } = useWallet();

  const [showArchivedMonths, setShowArchivedMonths] = useState(true);
  const planningMonths = getPlanningMonthsWindow(showArchivedMonths ? 1 : 0, 3);
  const currentMonthIdx = planningMonths.findIndex((m) => m.isCurrent);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(
    currentMonthIdx >= 0 ? currentMonthIdx : 0
  );

  const toggleArchivePastMonths = () => {
    const nextShow = !showArchivedMonths;
    setShowArchivedMonths(nextShow);
    const newMonths = getPlanningMonthsWindow(nextShow ? 1 : 0, 3);
    const newCurrentIdx = newMonths.findIndex((m) => m.isCurrent);
    setSelectedMonthIndex(newCurrentIdx >= 0 ? newCurrentIdx : 0);
  };
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [isAddingMenuOpen, setIsAddingMenuOpen] = useState(false);
  const [modalType, setModalType] = useState<"income" | "expense">("income");
  const [itemToDelete, setItemToDelete] = useState<RecurringItem | null>(null);
  const [isCardAddSheetOpen, setIsCardAddSheetOpen] = useState(false);
  const [selectedCardForAdd, setSelectedCardForAdd] = useState<string>("NuBank");
  const [txToDelete, setTxToDelete] = useState<TransactionItem | null>(null);

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

  const [confirmPayModal, setConfirmPayModal] = useState<{
    isOpen: boolean;
    cardId: string;
    cardName: string;
    amount: number;
    periodKey?: string;
    monthName?: string;
  } | null>(null);
  const [isPayingInvoice, setIsPayingInvoice] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);

  const activeMonthObj = planningMonths[selectedMonthIndex] || planningMonths[currentMonthIdx >= 0 ? currentMonthIdx : 0];
  const targetYear = activeMonthObj.year;
  const targetMonth = activeMonthObj.monthIndex;
  const targetPeriodKey = getPeriodKey(targetYear, targetMonth);
  const currentMonth5thBusinessDay = get5thBusinessDay(targetYear, targetMonth);

  const projection = getMonthlyProjection(selectedMonthIndex, planningMonths);
  const nextMonthProjection =
    selectedMonthIndex + 1 < planningMonths.length
      ? getMonthlyProjection(selectedMonthIndex + 1, planningMonths)
      : null;
  const previousProjection = selectedMonthIndex > 0
    ? getMonthlyProjection(selectedMonthIndex - 1, planningMonths)
    : null;
  const currentCheckingBalance = cards
    .filter((card) => card.type === "checking")
    .reduce((total, card) => total + (card.balance || 0), 0);
  const expectedOpeningBalance = previousProjection
    ? activeMonthObj.isCurrent || activeMonthObj.isPast
      ? previousProjection.actualClosingBalance
      : previousProjection.projectedFreeBalance
    : undefined;
  const integrityAudit = useMemo(
    () =>
      auditFinancialIntegrity({
        cards,
        transactions,
        recurringItems,
        projection,
        targetYear,
        targetMonth,
        expectedOpeningBalance,
        currentCheckingBalance: activeMonthObj.isCurrent ? currentCheckingBalance : undefined,
      }),
    [
      activeMonthObj.isCurrent,
      cards,
      currentCheckingBalance,
      expectedOpeningBalance,
      projection,
      recurringItems,
      targetMonth,
      targetYear,
      transactions,
    ]
  );

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isCheckingAccount = (item: RecurringItem) =>
    cards.some((card) =>
      card.type === "checking" && matchesLedgerCard(card, item.account, item.cardId)
    ) || item.account === "Débito/Pix";

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
  const totalIncomesScheduled = visiblePlannedIncomes
    .reduce((acc, r) => acc + r.amount, 0);

  const totalDebitExpensesActive = visiblePlannedDebitExpenses
    .filter(isActiveInSelectedMonth)
    .reduce((acc, r) => acc + r.amount, 0);
  const totalDebitExpensesScheduled = visiblePlannedDebitExpenses
    .reduce((acc, r) => acc + r.amount, 0);

  const monthNetSurplus = projection.projectedIncome - projection.totalCommitted;

  // O saldo atual já contém tudo o que entrou e saiu. Reconstruir o início do
  // mês permite conferir o realizado sem aplicar os lançamentos duas vezes.
  const reconciledMonthOpeningBalance = projection.openingBalance;
  const reconciledCurrentBalance = projection.actualClosingBalance;

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

    if (isCredit) {
      const targetCreditCard = targetCardId ? cards.find((c) => c.id === targetCardId) : null;
      const creditAcc =
        targetCreditCard?.name ||
        cards.find((card) => card.type === "credit")?.name ||
        accountOptions.find((acc) => !acc.includes("Débito") && !acc.includes("Pix")) ||
        "NuBank";
      setSelectedCardForAdd(creditAcc);
      setIsAddingMenuOpen(false);
      setIsCardAddSheetOpen(true);
      return;
    }

    setModalType(isIncome ? "income" : "expense");
    setNewCategory(isIncome ? "Salário / Extra" : "Moradia & Contas");

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
    const sanitizedTitle = sanitizeTextInput(newTitle, 80);
    if (!sanitizedTitle) {
      alert("Por favor, informe uma descrição válida para o planejamento.");
      return;
    }

    const amountValidation = validateCurrency(newAmount);
    if (!amountValidation.isValid) {
      alert(amountValidation.error || "Valor informado é inválido.");
      return;
    }
    const cleanAmount = amountValidation.value;

    let computedDay = 10;
    if (recurrenceSelection === "business_day_5") {
      computedDay = currentMonth5thBusinessDay;
    } else if (isCustomDayActive) {
      const dayVal = validateDayOfMonth(customDayInput);
      computedDay = dayVal.isValid ? dayVal.value : 10;
    } else {
      const dayVal = validateDayOfMonth(fixedDayValue);
      computedDay = dayVal.isValid ? dayVal.value : 10;
    }

    const effectiveInstallments =
      durationMode === "installments"
        ? validateInstallmentsCount(installmentsInput || installmentsCount || 2).value
        : durationMode === "one-time"
          ? 1
          : undefined;

    const finalAmount =
      durationMode === "installments" && installmentPricingType === "total" && effectiveInstallments
        ? Math.round((cleanAmount / effectiveInstallments) * 100) / 100
        : cleanAmount;

    try {
      await addRecurringItem({
        title: sanitizedTitle,
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

    const sanitizedTitle = sanitizeTextInput(editTitle, 80);
    if (!sanitizedTitle) {
      alert("Por favor, informe uma descrição válida para a edição.");
      return;
    }

    const amountValidation = validateCurrency(editAmount);
    if (!amountValidation.isValid) {
      alert(amountValidation.error || "Valor informado é inválido.");
      return;
    }
    const cleanAmount = amountValidation.value;

    let computedDay = 10;
    if (editRecurrence === "business_day_5") {
      computedDay = currentMonth5thBusinessDay;
    } else if (editIsCustomDay) {
      const dayVal = validateDayOfMonth(editCustomDay);
      computedDay = dayVal.isValid ? dayVal.value : 10;
    } else {
      const dayVal = validateDayOfMonth(editFixedDay);
      computedDay = dayVal.isValid ? dayVal.value : 10;
    }

    const effectiveEditInstallments =
      editDurationMode === "installments"
        ? validateInstallmentsCount(editInstallmentsInput || editInstallmentsCount || 2).value
        : editDurationMode === "one-time"
          ? 1
          : undefined;

    const finalEditAmount =
      editDurationMode === "installments" && editInstallmentPricingType === "total" && effectiveEditInstallments
        ? Math.round((cleanAmount / effectiveEditInstallments) * 100) / 100
        : cleanAmount;

    const updates: Partial<RecurringItem> = {
      title: sanitizedTitle,
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
      await updateRecurringItem(editingItem.id, updates, targetPeriodKey);
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
        await updateRecurringItem(item.id, updates, targetPeriodKey);
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
      const updates: Partial<RecurringItem> = {
        title: editTitle.trim() || editingItem.title,
        amount: finalAmount,
        type: editType,
        account: editAccount,
        cardId: cards.find((card) => card.name === editAccount)?.id || null,
        category: editCategory,
        dueDay: computedDay,
        recurrenceType: editRecurrence,
      };
      const updatedItem: RecurringItem = {
        ...editingItem,
        ...updates,
      };

      await updateRecurringItem(editingItem.id, updates, targetPeriodKey);
      await realizeRecurringItemNow(updatedItem, targetYear, targetMonth, finalAmount);
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível efetivar o planejamento.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const handleExecutePayInvoice = async () => {
    if (!confirmPayModal) return;
    const { cardId, cardName, amount, periodKey, monthName } = confirmPayModal;
    setIsPayingInvoice(true);
    try {
      await payInvoice(cardId, amount, periodKey || targetPeriodKey);
      setConfirmPayModal(null);
      setPaymentSuccessMessage(
        `Fatura do ${cardName}${monthName ? ` (${monthName})` : ""} paga e debitada da conta como planejado!`
      );
      setTimeout(() => setPaymentSuccessMessage(null), 4500);
    } catch (error) {
      setPaymentErrorMessage(error instanceof Error ? error.message : "Não foi possível pagar a fatura.");
      setTimeout(() => setPaymentErrorMessage(null), 5000);
    } finally {
      setIsPayingInvoice(false);
    }
  };

  const handleUndoPayInvoice = async (cardId: string, cardName: string, periodKey: string) => {
    setIsPayingInvoice(true);
    try {
      await unpayInvoice(cardId, periodKey);
      setPaymentSuccessMessage(`Pagamento da fatura do ${cardName} desfeito.`);
      setTimeout(() => setPaymentSuccessMessage(null), 4000);
    } catch (error) {
      setPaymentErrorMessage(
        error instanceof Error ? error.message : "Não foi possível desfazer o pagamento da fatura."
      );
      setTimeout(() => setPaymentErrorMessage(null), 5000);
    } finally {
      setIsPayingInvoice(false);
    }
  };

  const handleRealizeNow = async (item: RecurringItem) => {
    try {
      setProcessingItemId(item.id);
      const isCredit = !isCheckingAccount(item);
      let plannedYear = targetYear;
      let plannedMonth = targetMonth;

      // Se for cartão de crédito, descobrir o mês exato em que a cobrança ocorre para a fatura deste mês
      if (isCredit) {
        const matchingCard = cards.find((c) => matchesLedgerCard(c, item.account, item.cardId));
        if (matchingCard && matchingCard.type === "credit") {
          const expectedPeriodKey = targetPeriodKey;
          for (let offset = -2; offset <= 0; offset++) {
            const candDate = new Date(targetYear, targetMonth + offset, 1);
            const candY = candDate.getFullYear();
            const candM = candDate.getMonth();
            const day = getEffectiveDueDay(item, candY, candM);
            const dueDate = getInvoiceDueDate(matchingCard, new Date(candY, candM, day, 12, 0, 0));
            if (getPeriodKey(dueDate.getFullYear(), dueDate.getMonth()) === expectedPeriodKey) {
              plannedYear = candY;
              plannedMonth = candM;
              break;
            }
          }
        }
      }

      const effectiveDay = getEffectiveDueDay(item, plannedYear, plannedMonth);
      const plannedDate = new Date(plannedYear, plannedMonth, effectiveDay, 12, 0, 0);
      await realizeRecurringItemNow(item, plannedYear, plannedMonth, undefined, plannedDate);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível efetivar o lançamento.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const handleUnrealize = async (item: RecurringItem) => {
    try {
      setProcessingItemId(item.id);
      const isCredit = !isCheckingAccount(item);
      let plannedYear = targetYear;
      let plannedMonth = targetMonth;

      if (isCredit) {
        const matchingCard = cards.find((c) => matchesLedgerCard(c, item.account, item.cardId));
        if (matchingCard && matchingCard.type === "credit") {
          const expectedPeriodKey = targetPeriodKey;
          for (let offset = -2; offset <= 0; offset++) {
            const candDate = new Date(targetYear, targetMonth + offset, 1);
            const candY = candDate.getFullYear();
            const candM = candDate.getMonth();
            const day = getEffectiveDueDay(item, candY, candM);
            const dueDate = getInvoiceDueDate(matchingCard, new Date(candY, candM, day, 12, 0, 0));
            if (getPeriodKey(dueDate.getFullYear(), dueDate.getMonth()) === expectedPeriodKey) {
              plannedYear = candY;
              plannedMonth = candM;
              break;
            }
          }
        }
      }

      await unrealizeRecurringItem(item, plannedYear, plannedMonth);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível desfazer a efetivação.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const renderItemRow = (
    item: RecurringItem,
    sectionKind: "income" | "debit" | "credit",
    isInvoicePaid: boolean = false
  ) => {
    const isCredit = sectionKind === "credit";
    let plannedYear = targetYear;
    let plannedMonth = targetMonth;

    if (isCredit) {
      const matchingCard = cards.find((c) => matchesLedgerCard(c, item.account, item.cardId));
      if (matchingCard && matchingCard.type === "credit") {
        const expectedPeriodKey = targetPeriodKey;
        for (let offset = -2; offset <= 0; offset++) {
          const candDate = new Date(targetYear, targetMonth + offset, 1);
          const candY = candDate.getFullYear();
          const candM = candDate.getMonth();
          const day = getEffectiveDueDay(item, candY, candM);
          const dueDate = getInvoiceDueDate(matchingCard, new Date(candY, candM, day, 12, 0, 0));
          if (getPeriodKey(dueDate.getFullYear(), dueDate.getMonth()) === expectedPeriodKey) {
            plannedYear = candY;
            plannedMonth = candM;
            break;
          }
        }
      }
    }

    const effectiveDay = getEffectiveDueDay(item, plannedYear, plannedMonth);
    const monthOffset = getRecurringMonthOffset(item, plannedYear, plannedMonth);
    const hasInstallments = Boolean(item.installmentsCount && item.installmentsCount > 1);
    const isFinishedInThisMonth = hasInstallments && monthOffset >= (item.installmentsCount || 0);
    const currentInstallmentNum = monthOffset >= 0 ? monthOffset + 1 : 1;
    const recurrencePeriodKey = getPeriodKey(plannedYear, plannedMonth);
    const isRealizedInThisMonth = Boolean(item.realizedPeriods?.includes(recurrencePeriodKey));
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
      if (plannedMonth !== targetMonth) {
        const candDate = new Date(plannedYear, plannedMonth, 1);
        const chargeMonthShort = candDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
        dateDescription = `Cobrado dia ${effectiveDay} de ${chargeMonthShort}`;
      } else {
        dateDescription = `Cobrado dia ${effectiveDay}`;
      }
    }

    return (
      <div
        key={item.id}
        onClick={() => handleOpenEditModal(item)}
        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 hover:bg-[#F9F9FB] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {isInvoicePaid ? (
            <div
              className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs"
              title="Quitado na fatura deste mês"
            >
              <Check size={12} strokeWidth={3} />
            </div>
          ) : isRealizedInThisMonth ? (
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
              {isInvoicePaid ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                  Quitado na fatura
                </span>
              ) : isRealizedInThisMonth ? (
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
              ) : null}
            </div>
            <p className="text-xs text-[#86868B] truncate mt-0.5">
              {dateDescription} · {formatAccountLabel(item.account)} · {item.category}
              {hasInstallments && ` · Parcela ${currentInstallmentNum} de ${item.installmentsCount}`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
          {/* Ação Rápida: Quitado / "Já cobrou" / "Recebi antes" / "Paguei antes" */}
          {isInvoicePaid ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 shadow-2xs">
              <Check size={11} strokeWidth={2.5} />
              <span>Liquidado</span>
            </span>
          ) : !isRealizedInThisMonth && !isFinishedInThisMonth && item.active ? (
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
                  : sectionKind === "credit"
                  ? "Registrar que esta cobrança já ocorreu no cartão"
                  : "Paguei adiantado: debitar e efetivar saída agora"
              }
            >
              {isProcessing ? (
                <Loader2 size={12} className="animate-spin text-current" />
              ) : (
                <Zap size={12} className="text-amber-500 fill-amber-500 shrink-0" />
              )}
              <span>
                {item.type === "income"
                  ? "Recebi antes"
                  : sectionKind === "credit"
                  ? "Já cobrou"
                  : "Paguei antes"}
              </span>
            </button>
          ) : isRealizedInThisMonth ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleUnrealize(item);
              }}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 hover:bg-rose-50 hover:text-rose-600 text-indigo-700 border border-indigo-200/60 hover:border-rose-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50 group"
              title="Desfazer efetivação"
            >
              <RotateCcw size={12} className="group-hover:rotate-[-45deg] transition-transform" />
              <span>Desfazer</span>
            </button>
          ) : null}

          {/* Valor formatado */}
          <span
            className={`text-sm font-semibold tracking-tight min-w-[90px] text-right font-mono tabular-nums ${
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
            <span className="text-xs font-semibold text-[#1D1D1F] font-mono tabular-nums">
              R$ {formatCurrency(activeMonthObj.isCurrent ? projection.actualClosingBalance : projection.openingBalance)}
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
        {paymentSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
            <span>✓ {paymentSuccessMessage}</span>
          </div>
        )}

        {paymentErrorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
            <span>⚠ {paymentErrorMessage}</span>
          </div>
        )}

        {/* Navegação entre Meses (Controle Segmentado Suave Estilo iOS com opção de arquivar) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="bg-[#E5E5EA]/60 p-1 rounded-full flex items-center gap-1 overflow-x-auto border border-black/5 scrollbar-none touch-pan-x flex-1">
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

          <button
            type="button"
            onClick={toggleArchivePastMonths}
            className="text-[11px] font-medium text-[#86868B] hover:text-[#1D1D1F] px-3 py-1.5 rounded-full bg-white border border-black/[0.06] hover:bg-[#F2F2F7] transition-all cursor-pointer shrink-0 self-end sm:self-auto shadow-2xs active:scale-95"
            title={showArchivedMonths ? "Ocultar meses anteriores no planejamento" : "Exibir Setembro e histórico de meses anteriores"}
          >
            {showArchivedMonths ? "Arquivar Setembro" : "Exibir Setembro"}
          </button>
        </div>

        {/* 2. RESUMO FINANCEIRO PRINCIPAL (Superfície Única Apple com 4 Métricas Essenciais) */}
        <div className="bg-white rounded-[24px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_1px_6px_rgba(0,0,0,0.02)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* 1. Entradas previstas */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#86868B] tracking-tight">
                Entradas previstas
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] font-mono tabular-nums">
                + R$ {formatCurrency(projection.projectedIncome)}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                R$ {formatCurrency(projection.actualIncomeTotal)} recebidos · R${" "}
                {formatCurrency(projection.plannedIncomesTotal)} pendentes
              </p>
            </div>

            {/* 2. Compromissos */}
            <div className="pt-5 sm:pt-0 sm:pl-6 space-y-1">
              <span className="text-xs font-medium text-[#86868B] tracking-tight">
                Compromissos
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] font-mono tabular-nums">
                − R$ {formatCurrency(projection.totalCommitted)}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                R$ {formatCurrency(projection.actualOutflowTotal)} pagos · R${" "}
                {formatCurrency(projection.pendingCommitted)} pendentes
              </p>
            </div>

            {/* 3. Sobra das Contas do Mês (Entradas − Compromissos) */}
            <div className="pt-5 sm:pt-0 sm:pl-6 space-y-1">
              <span className="text-xs font-medium text-[#86868B] tracking-tight">
                Sobra do mês
              </span>
              <div
                className={`text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums ${
                  monthNetSurplus >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {monthNetSurplus >= 0 ? "+" : "−"} R$ {formatCurrency(Math.abs(monthNetSurplus))}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                {monthNetSurplus >= 0 ? "Superávit" : "Déficit"} das contas de {activeMonthObj.name}
              </p>
            </div>

            {/* 4. Saldo Livre Projetado Final */}
            <div className="pt-5 sm:pt-0 sm:pl-6 space-y-1">
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                Saldo final projetado
              </span>
              <div
                className={`text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums ${
                  projection.projectedFreeBalance >= 0 ? "text-[#1D1D1F]" : "text-rose-600"
                }`}
              >
                R$ {formatCurrency(projection.projectedFreeBalance)}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                {activeMonthObj.isCurrent
                  ? `R$ ${formatCurrency(reconciledCurrentBalance)} em conta agora · ${freePercentage}% livre`
                  : activeMonthObj.isPast
                    ? `Resultado consolidado de ${activeMonthObj.name}`
                    : `Saldo herdado + sobra do mês`}
              </p>
            </div>
          </div>

          {/* Realizado e previsto são conferidos em equações independentes. */}
          <div className="pt-3 border-t border-black/[0.04] space-y-2 text-xs text-[#86868B]">
            {activeMonthObj.isCurrent && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-[#1D1D1F]">Saldo conciliado hoje:</span>
                <span>início do mês (R$ {formatCurrency(reconciledMonthOpeningBalance)})</span>
                <span>+</span>
                <span>entradas recebidas (R$ {formatCurrency(projection.actualIncomeTotal)})</span>
                <span>−</span>
                <span>saídas pagas (R$ {formatCurrency(projection.actualOutflowTotal)})</span>
                <span>=</span>
                <strong className="text-[#1D1D1F] font-semibold font-mono tabular-nums">
                  R$ {formatCurrency(reconciledCurrentBalance)}
                </strong>
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[#1D1D1F]">
                {activeMonthObj.isCurrent ? "Projeção do fechamento:" : "Conferência do caixa:"}
              </span>
              <span>
                {activeMonthObj.isCurrent
                  ? "saldo em conta hoje"
                  : `Saldo vindo de ${planningMonths[selectedMonthIndex - 1]?.short || "mês anterior"}`}{" "}
                  (R$ {formatCurrency(activeMonthObj.isCurrent ? projection.actualClosingBalance : projection.openingBalance)})
              </span>
              <span>+</span>
              <span>
                {activeMonthObj.isCurrent ? "entradas pendentes" : "Entradas previstas"}{" "}
                (R$ {formatCurrency(activeMonthObj.isCurrent ? projection.plannedIncomesTotal : projection.projectedIncome)})
              </span>
              <span>−</span>
              <span>
                {activeMonthObj.isCurrent ? "compromissos pendentes" : "Compromissos"}{" "}
                (R$ {formatCurrency(activeMonthObj.isCurrent ? projection.pendingCommitted : projection.totalCommitted)})
              </span>
              <span>=</span>
              <strong className="text-[#1D1D1F] font-semibold font-mono tabular-nums">
                R$ {formatCurrency(projection.projectedFreeBalance)}
              </strong>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                  integrityAudit.status === "ok"
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200/70"
                    : integrityAudit.status === "warning"
                      ? "text-amber-700 bg-amber-50 border-amber-200/70"
                      : "text-rose-700 bg-rose-50 border-rose-200/70"
                }`}
              >
                {integrityAudit.status === "ok"
                  ? "✓ Livro-caixa conferido"
                  : integrityAudit.status === "warning"
                    ? `⚠ ${integrityAudit.warningCount} alerta(s) na base`
                    : `! ${integrityAudit.errorCount} erro(s) na base`}
              </span>
              {integrityAudit.issues.slice(0, 2).map((issue) => (
                <span key={issue.code} className="text-[11px] text-[#6E6E73]">
                  {issue.message}
                </span>
              ))}
            </div>
            {integrityAudit.status === "ok" && activeMonthObj.isCurrent && reconciledCurrentBalance < 0 && (
              <p className="text-[11px] text-rose-700">
                O transporte entre meses está correto. O negativo vem das saídas já realizadas neste mês;
                revise os lançamentos em “Movimentações realizadas” abaixo.
              </p>
            )}
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
              Total: <span className="font-mono tabular-nums">R$ {formatCurrency(projection.totalCommitted)}</span>
            </span>
          </div>

          {/* Três métricas limpas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
            <div>
              <span className="text-xs text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8E8E93]" />
                Já saiu da conta
              </span>
              <div className="text-base sm:text-lg font-semibold text-[#1D1D1F] mt-0.5 font-mono tabular-nums">
                R$ {formatCurrency(projection.actualOutflowTotal)}
              </div>
            </div>

            <div>
              <span className="text-xs text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D1D1F]" />
                Contas diretas a pagar
              </span>
              <div className="text-base sm:text-lg font-semibold text-[#1D1D1F] mt-0.5 font-mono tabular-nums">
                R$ {formatCurrency(debitCommitments)}
              </div>
            </div>

            <div>
              <span className="text-xs text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                Faturas de cartão a pagar
              </span>
              <div className="text-base sm:text-lg font-semibold text-[#1D1D1F] mt-0.5 font-mono tabular-nums">
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
            <span className="font-mono tabular-nums">R$ {formatCurrency(debitCommitments)}</span> em contas diretas + <span className="font-mono tabular-nums">R$ {formatCurrency(projection.totalInvoicesPending ?? creditCommitments)}</span> em faturas de cartão totalizam <span className="font-mono tabular-nums">R${" "}
            {formatCurrency(projection.pendingCommitted)}</span> que sairão da sua conta.
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
                <div className="text-right">
                  <span className="text-sm font-semibold text-emerald-600 block font-mono tabular-nums">
                    + R$ {formatCurrency(totalIncomesScheduled)}
                  </span>
                  {totalIncomesActive < totalIncomesScheduled && (
                    <span className="text-[10px] text-[#86868B] block font-mono tabular-nums">
                      (R$ {formatCurrency(totalIncomesActive)} a receber)
                    </span>
                  )}
                </div>
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
                      <span className="text-xs font-semibold text-emerald-600 font-mono tabular-nums">
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
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#1D1D1F] block font-mono tabular-nums">
                    R$ {formatCurrency(totalDebitExpensesScheduled)}
                  </span>
                  {totalDebitExpensesActive < totalDebitExpensesScheduled && (
                    <span className="text-[10px] text-[#86868B] block font-mono tabular-nums">
                      (R$ {formatCurrency(totalDebitExpensesActive)} a pagar)
                    </span>
                  )}
                </div>
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
                      <span className="text-xs font-semibold text-[#1D1D1F] font-mono tabular-nums">
                        R$ {formatCurrency(group.totalAmount)}
                      </span>
                    </div>
                    {group.items.map((item) => renderItemRow(item, "debit"))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4.3 Faturas de Cartão de Crédito */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-[#6366F1]" strokeWidth={2} />
                <h3 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                  Faturas de cartão de crédito
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#1D1D1F] font-mono tabular-nums">
                  − R$ {formatCurrency(projection.totalInvoicesPending ?? creditCommitments)}
                  {projection.totalInvoicesPaid > 0 && (
                    <span className="text-emerald-600 font-normal ml-1.5">
                      (R$ {formatCurrency(projection.totalInvoicesPaid)} pagos)
                    </span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenModal("expense-credit")}
                  className="text-xs font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors flex items-center gap-1 cursor-pointer select-none"
                >
                  <Plus size={13} strokeWidth={2.2} />
                  <span>Compra no cartão</span>
                </button>
              </div>
            </div>

            {projection.cardInvoices.length === 0 ? (
              <div className="bg-white rounded-[22px] border border-black/[0.04] shadow-[0_1px_4px_rgba(0,0,0,0.02)] p-7 text-center space-y-1.5">
                <p className="text-sm font-medium text-[#1D1D1F]">
                  Nenhum cartão de crédito cadastrado
                </p>
                <p className="text-xs text-[#86868B]">
                  Cadastre seus cartões em Cartões &amp; Faturas para acompanhar e quitar faturas no planejamento.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {projection.cardInvoices.map((ci) => {
                  const nextCardInvoice = nextMonthProjection?.cardInvoices.find(
                    (n) => n.cardId === ci.cardId
                  );
                  const hasNextOpenToAdvance =
                    ci.totalInvoice === 0 &&
                    !ci.isPaid &&
                    nextCardInvoice &&
                    nextCardInvoice.pendingInvoice > 0;

                  return (
                    <div
                      key={ci.cardId}
                      className="bg-white rounded-[22px] border border-black/[0.04] shadow-[0_1px_4px_rgba(0,0,0,0.02)] overflow-hidden divide-y divide-gray-100"
                    >
                      {/* Cabeçalho da Fatura do Cartão */}
                      <div className="p-4 sm:p-5 bg-[#FBFBFD] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: ci.cardColor || "#1D1D1F" }}
                          >
                            <CreditCard size={17} strokeWidth={2} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-[#1D1D1F] truncate">
                                Fatura {ci.cardName}
                              </h4>
                              {ci.isPaid && ci.paidAmount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check size={10} strokeWidth={3} />
                                  Fatura paga
                                </span>
                              ) : ci.pendingInvoice > 0 ? (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                                  Vence dia {ci.dueDay} de {ci.invoiceDueMonthName || activeMonthObj.name}
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-[#86868B]">
                                  Sem fatura neste mês
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#86868B] mt-0.5">
                              {ci.paidAmount > 0 && ci.pendingInvoice > 0
                                ? `Pago: R$ ${formatCurrency(ci.paidAmount)} · Falta pagar: R$ ${formatCurrency(ci.pendingInvoice)}`
                                : ci.isPaid && ci.paidAmount > 0
                                  ? `Debitado da conta principal: R$ ${formatCurrency(ci.paidAmount)}`
                                  : `Parcelas/compras: R$ ${formatCurrency(ci.installmentsAmount)} · Recorrentes: R$ ${formatCurrency(ci.recurringAmount)}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          {!ci.isPaid && ci.pendingInvoice > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmPayModal({
                                  isOpen: true,
                                  cardId: ci.cardId,
                                  cardName: ci.cardName,
                                  amount: ci.pendingInvoice,
                                  periodKey: ci.invoicePeriodKey || targetPeriodKey,
                                  monthName: ci.invoiceDueMonthName || activeMonthObj.name,
                                })
                              }
                              disabled={isPayingInvoice}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#1D1D1F] hover:bg-black text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-2xs"
                              title="Marcar fatura como paga e debitar da conta corrente como planejado"
                            >
                              {isPayingInvoice ? (
                                <Loader2 size={13} className="animate-spin text-white" />
                              ) : (
                                <Zap size={13} className="text-amber-400 fill-amber-400 shrink-0" />
                              )}
                              <span>Paguei a fatura</span>
                            </button>
                          ) : ci.paidAmount > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleUndoPayInvoice(
                                  ci.cardId,
                                  ci.cardName,
                                  ci.invoicePeriodKey || targetPeriodKey
                                )
                              }
                              disabled={isPayingInvoice}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-rose-50 hover:text-rose-600 text-emerald-700 border border-emerald-200/70 hover:border-rose-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50 group"
                              title="Desfazer pagamento da fatura"
                            >
                              <RotateCcw size={12} className="group-hover:rotate-[-45deg] transition-transform" />
                              <span>Desfazer pagamento</span>
                            </button>
                          ) : hasNextOpenToAdvance && nextCardInvoice ? (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmPayModal({
                                  isOpen: true,
                                  cardId: ci.cardId,
                                  cardName: ci.cardName,
                                  amount: nextCardInvoice.pendingInvoice,
                                  periodKey: nextCardInvoice.invoicePeriodKey,
                                  monthName: nextCardInvoice.invoiceDueMonthName,
                                })
                              }
                              disabled={isPayingInvoice}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-2xs"
                              title={`Antecipar e pagar agora a fatura de ${nextCardInvoice.invoiceDueMonthName}`}
                            >
                              <Zap size={12} className="text-amber-300 fill-amber-300 shrink-0" />
                              <span>
                                Paguei a fatura de {nextCardInvoice.invoiceDueMonthName} (R${" "}
                                {formatCurrency(nextCardInvoice.pendingInvoice)})
                              </span>
                            </button>
                          ) : null}

                          <span
                            className={`text-sm sm:text-base font-bold tracking-tight min-w-[95px] text-right font-mono tabular-nums ${
                              ci.isPaid && ci.paidAmount > 0
                                ? "text-emerald-600"
                                : ci.pendingInvoice > 0
                                  ? "text-[#1D1D1F]"
                                  : "text-[#86868B]"
                            }`}
                          >
                            R$ {formatCurrency(ci.isPaid ? ci.paidAmount : ci.pendingInvoice)}
                          </span>
                        </div>
                      </div>

                      {/* Itens recorrentes que caem nesta fatura */}
                      {ci.recurringItems.length > 0 && (
                        <div className="divide-y divide-gray-100">
                          {ci.recurringItems.map((item) =>
                            renderItemRow(
                              getEffectiveRecurringItemForPeriod(
                                item,
                                ci.invoicePeriodKey || targetPeriodKey
                              ),
                              "credit",
                              ci.isPaid && ci.paidAmount > 0
                            )
                          )}
                        </div>
                      )}

                      {/* Compras e parcelas faturadas nesta competência */}
                      {ci.transactions.length > 0 && (
                        <div className="divide-y divide-gray-100 bg-white">
                          {ci.transactions.map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between gap-3 px-4 py-3 text-xs hover:bg-[#F9F9FB] transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    ci.isPaid && ci.paidAmount > 0 ? "bg-emerald-500" : "bg-indigo-500"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <p className="font-medium text-[#1D1D1F] truncate">{tx.title}</p>
                                  <p className="text-[11px] text-[#86868B] truncate">
                                    {tx.category} · {tx.date}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-semibold text-[#1D1D1F] font-mono tabular-nums">
                                  R$ {formatCurrency(tx.amount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setTxToDelete(tx)}
                                  className="text-gray-300 hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                                  title="Excluir lançamento"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
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
                    <span className="text-xl font-bold text-[#1D1D1F] font-mono tabular-nums">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="w-full text-2xl sm:text-3xl font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none bg-transparent font-mono tabular-nums"
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
                                  Total <strong className="font-mono tabular-nums">R$ {formatCurrency(clean)}</strong> ÷ {count}x = <strong className="font-mono tabular-nums">R$ {formatCurrency(clean / count)}/mês</strong>
                                </span>
                              ) : (
                                <span>
                                  {count}x de <strong className="font-mono tabular-nums">R$ {formatCurrency(clean)}</strong> = Total de <strong className="font-mono tabular-nums">R$ {formatCurrency(clean * count)}</strong>
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
                    <span className="text-xl font-bold text-[#1D1D1F] font-mono tabular-nums">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full text-2xl sm:text-3xl font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none bg-transparent font-mono tabular-nums"
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

      {/* MODAL DE ESCOPO DE EDIÇÃO APPLE HIG (Apenas neste mês vs Este mês e meses à frente) */}
      <AppleScopeModal
        isOpen={Boolean(scopeEditModal)}
        onClose={() => setScopeEditModal(null)}
        onSelectScope={handleApplyScopeEdit}
        title="Salvar Alterações"
        description={`Deseja aplicar as alterações em "${scopeEditModal?.updates.title || ""}" apenas em ${activeMonthObj.name} ou para este mês e todos os meses à frente?`}
        singleLabel={`Apenas neste mês (${activeMonthObj.short})`}
        allLabel={`Este mês e meses à frente (${activeMonthObj.short} em diante)`}
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

      {/* CONFIRMAÇÃO DE PAGAMENTO DE FATURA VIA CONTA PRINCIPAL */}
      {confirmPayModal && (
        <AppleConfirmModal
          isOpen={confirmPayModal.isOpen}
          onClose={() => setConfirmPayModal(null)}
          onConfirm={handleExecutePayInvoice}
          title={`Pagar Fatura do ${confirmPayModal.cardName}${confirmPayModal.monthName ? ` (${confirmPayModal.monthName})` : ""}`}
          description={`Deseja confirmar o pagamento da fatura do ${confirmPayModal.cardName} no valor de R$ ${formatCurrency(confirmPayModal.amount)}? O valor será debitado da sua Conta Principal conforme planejado.`}
          confirmLabel={isPayingInvoice ? "Pagando..." : "Confirmar Pagamento"}
          cancelLabel="Cancelar"
          variant="primary"
          iconType="payment"
        />
      )}

      {/* MODAL SIMPLES UNIFICADO PARA LANÇAR COMPRAS EM CARTÃO */}
      <AddTransactionSheet
        isOpen={isCardAddSheetOpen}
        onClose={() => setIsCardAddSheetOpen(false)}
        accounts={accountOptions}
        initialAccount={selectedCardForAdd}
        initialType="despesa"
      />

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE LANÇAMENTO */}
      {txToDelete && (
        <AppleConfirmModal
          isOpen={Boolean(txToDelete)}
          onClose={() => setTxToDelete(null)}
          onConfirm={async () => {
            if (txToDelete) {
              try {
                await deleteTransaction(txToDelete.id);
              } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível excluir o lançamento.");
              } finally {
                setTxToDelete(null);
              }
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
    </div>
  );
}
