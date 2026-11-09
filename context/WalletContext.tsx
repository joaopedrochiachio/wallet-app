"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeToUserProfile,
  saveUserProfile,
  markUserOnboardedLocal,
} from "@/lib/services/userService";
import {
  subscribeToCards,
  saveCardToFirestore,
  deleteCardFromFirestore,
  updateCardLimitInFirestore,
  updateCardFieldsInFirestore,
} from "@/lib/services/cardsService";
import {
  subscribeToTransactions,
  addTransaction as addTransactionFirestore,
  deleteTransactionFromFirestore,
  payCreditCardInvoice,
  unpayCreditCardInvoice,
  updateTransactionInFirestore,
  realizePlannedOccurrence,
  unrealizePlannedOccurrence,
  TransactionUpdateInput,
} from "@/lib/services/transactionsService";
import {
  subscribeToGoals,
  deleteGoalFromFirestore,
  saveGoalOperation,
  updateGoalDetails,
} from "@/lib/services/goalsService";
import {
  subscribeToRecurring,
  saveRecurringToFirestore,
  updateRecurringInFirestore,
  deleteRecurringFromFirestore,
} from "@/lib/services/recurringService";
import { processDueOccurrencesForUser } from "@/lib/services/timeProgressionService";
import { buildInstallmentPurchasePlan } from "@/lib/utils/installments";
import { validateCategoryBudgets } from "@/lib/utils/categoryBudgets";
import { getPendingDueOccurrences } from "@/lib/utils/timeProgression";
import { hasRecordedRecurringOccurrence } from "@/lib/utils/recurringOccurrences";
import {
  get5thBusinessDay,
  getEffectiveDueDay,
  getPeriodKey,
  getPlanningMonths,
  PlanningMonth,
  isRecurringActiveInMonth,
  getRecurringMonthOffset,
  getEffectiveRecurringItemForPeriod,
  buildForwardRecurringUpdate,
  MONTH_NAMES_PT,
} from "@/lib/utils/dateUtils";
import {
  calculateCheckingBalance,
  calculateCheckingBalanceBefore,
  calculateCreditInvoice,
  calculateCreditCardUsedLimit,
  splitInstallmentPurchase,
  calculateInvoiceSchedule,
  calculateInvoiceScheduleWithCredits,
  calculateMonthlyAccountFlow,
  calculateProjectedBalance,
  getInvoiceDueDate,
  getLedgerEntryDate,
  matchesLedgerCard,
  getCardOpenInvoiceDetails,
  getCardInvoiceDetailsForMonth,
  getCardInvoiceRecurringDetails,
  isInvoicePaymentOrSettlement,
  getCheckingBalanceMigration,
  CURRENT_LEDGER_BALANCE_VERSION,
} from "@/lib/utils/ledger";
import {
  GoalItem,
  RecurringItem,
  RecurrenceType,
  UserProfile,
  CardItem,
  NewCardInput,
  FinancialPersonaId,
  RiskToleranceId,
  AIToneId,
  CategoryBudget,
} from "@/types";

export type {
  GoalItem,
  RecurringItem,
  RecurrenceType,
  UserProfile,
  CardItem,
  NewCardInput,
  FinancialPersonaId,
  RiskToleranceId,
  AIToneId,
};

export interface TransactionItem {
  id: string;
  title: string;
  amount: number;
  type: "despesa" | "receita";
  category: string;
  account: string; // ex: "Débito/Pix", "Nubank", "Santander"
  cardId?: string | null; // Referência estável por ID do cartão
  date: string;
  occurredAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  isRecurring?: boolean;
  autoConfirm?: boolean;
  recurrenceType?: RecurrenceType;
  recurrenceDay?: number;
  installmentsCount?: number;
  paidInstallmentsCount?: number;
  amountIsTotalPurchase?: boolean;
  kind?: "regular" | "invoice_payment" | "invoice_settlement" | "balance_reconciliation";
  relatedCardId?: string | null;
  groupId?: string | null;
  recurringItemId?: string | null;
  periodKey?: string | null;
}

export interface CardInvoiceProjection {
  cardId: string;
  cardName: string;
  cardColor?: string;
  dueDay: number;
  closingDay: number;
  installmentsAmount: number;
  recurringAmount: number;
  totalInvoice: number;
  paidAmount: number;
  pendingInvoice: number;
  isPaid: boolean;
  recurringItems: RecurringItem[];
  transactions: TransactionItem[];
  invoicePeriodKey?: string;
  invoiceDueMonthName?: string;
}

export interface MonthProjection {
  monthName: string;
  year: number;
  baseIncome: number;
  plannedIncomesTotal: number;
  projectedIncome: number;
  recurringDebitTotal: number;
  recurringCreditTotal: number;
  cardInstallments: number;
  totalCommitted: number;
  actualIncomeTotal: number;
  actualOutflowTotal: number;
  balanceReconciliationTotal: number;
  pendingCommitted: number;
  projectedFreeBalance: number;
  openingBalance: number;
  actualClosingBalance: number;
  cardInvoices: CardInvoiceProjection[];
  totalInvoicesScheduled: number;
  totalInvoicesPending: number;
  totalInvoicesPaid: number;
  monthNetSurplus: number;
}

interface WalletContextType {
  userProfile: UserProfile;
  cards: CardItem[];
  activeCardId: string;
  activeCard: CardItem;
  transactions: TransactionItem[];
  recurringItems: RecurringItem[];
  goals: GoalItem[];
  isDataLoaded: boolean;
  mainBalance: number;
  totalInvoices: number;
  monthIncome: number;
  monthExpense: number;
  accountOptions: string[];
  selectCard: (cardId: string) => void;
  updateCardLimit: (cardId: string, newLimit: number) => void;
  updateCardBillingCycle: (cardId: string, closingDay: number, dueDay: number) => Promise<void>;
  addCard: (card: NewCardInput) => CardItem;
  deleteCard: (cardId: string) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  saveCategoryBudgets: (budgets: CategoryBudget[]) => Promise<void>;
  addTransaction: (tx: Omit<TransactionItem, "id">) => Promise<void>;
  reconcileCheckingBalance: (cardId: string, targetBalance: number) => Promise<number>;
  updateTransaction: (id: string, updates: TransactionUpdateInput) => Promise<void>;
  payInvoice: (cardId: string, customAmount?: number, periodKey?: string) => Promise<void>;
  unpayInvoice: (cardId: string, periodKey: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addRecurringItem: (item: Omit<RecurringItem, "id">) => Promise<void>;
  updateRecurringItem: (
    id: string,
    updates: Partial<RecurringItem>,
    fromPeriodKey?: string
  ) => Promise<void>;
  updateRecurringItemOccurrence: (
    id: string,
    periodKey: string,
    override: Partial<RecurringItem>
  ) => Promise<void>;
  deleteRecurringItemOccurrence: (
    id: string,
    periodKey: string
  ) => Promise<void>;
  toggleRecurringItem: (id: string) => Promise<void>;
  deleteRecurringItem: (id: string) => Promise<void>;
  realizeRecurringItemNow: (
    item: RecurringItem,
    targetYear: number,
    targetMonth: number,
    customAmount?: number,
    customDate?: Date
  ) => Promise<void>;
  unrealizeRecurringItem: (
    item: RecurringItem,
    targetYear: number,
    targetMonth: number
  ) => Promise<void>;
  getMonthlyProjection: (monthIndex: number, customMonths?: PlanningMonth[]) => MonthProjection;
  addGoal: (
    goal: Omit<GoalItem, "id">,
    source?: {
      type: "account" | "already_saved";
      cardId?: string | null;
      accountName?: string;
    },
    operationId?: string
  ) => Promise<GoalItem>;
  contributeToGoal: (
    goalId: string,
    amount: number,
    source: {
      type: "account" | "already_saved";
      cardId?: string | null;
      accountName?: string;
    },
    operationId?: string
  ) => Promise<void>;
  withdrawFromGoal: (
    goalId: string,
    amount: number,
    destination: {
      type: "account" | "already_withdrawn";
      cardId?: string | null;
      accountName?: string;
    },
    operationId?: string
  ) => Promise<void>;
  updateGoal: (goalId: string, updates: Partial<GoalItem>) => Promise<void>;
  deleteGoal: (goalId: string) => void;
}

const INITIAL_USER_PROFILE: UserProfile = {
  name: "Seu Nome",
  email: "",
  role: "Membro da Carteira",
  avatarInitials: "WI",
  monthlyIncomeBase: 0.0,
  currency: "BRL",
  persona: "optimizer",
  riskTolerance: "moderate",
  aiTone: "analytical",
  maxCommitmentAlertPercent: 35,
  primaryFocus: "Gestão Financeira e Previsibilidade",
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const LEGACY_FINANCIAL_STORAGE_KEYS = [
  "wallet_cards",
  "wallet_transactions",
  "wallet_user_profile",
  "wallet_recurring",
  "wallet_goals",
];

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [activeCardId, setActiveCardId] = useState<string>("");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);

  // Rastreamento de carregamento dos listeners do Firestore
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null);
  const [cardsLoadedFor, setCardsLoadedFor] = useState<string | null>(null);
  const [transactionsLoadedFor, setTransactionsLoadedFor] = useState<string | null>(null);
  const [recurringLoadedFor, setRecurringLoadedFor] = useState<string | null>(null);
  const [goalsLoadedFor, setGoalsLoadedFor] = useState<string | null>(null);

  const isDataLoaded = Boolean(user && [
    profileLoadedFor,
    cardsLoadedFor,
    transactionsLoadedFor,
    recurringLoadedFor,
    goalsLoadedFor,
  ].every((loadedUserId) => loadedUserId === user.uid));

  // Remove apenas caches financeiros legados. A sessão do Firebase Auth, flags de onboarding/tutorial e o cache da IA são preservados.
  useEffect(() => {
    const legacyKeys = new Set([
      ...LEGACY_FINANCIAL_STORAGE_KEYS,
      ...Object.keys(window.localStorage).filter(
        (key) =>
          key.startsWith("wallet_") &&
          !key.startsWith("wallet_ai_") &&
          !key.startsWith("wallet_onboarded_") &&
          !key.startsWith("wallet_tutorial_")
      ),
    ]);
    legacyKeys.forEach((key) => window.localStorage.removeItem(key));
  }, []);

  // Sanitização estrita de dados sensíveis da memória ao deslogar
  useEffect(() => {
    if (!user) {
      setUserProfile(INITIAL_USER_PROFILE);
      setCards([]);
      setActiveCardId("");
      setTransactions([]);
      setRecurringItems([]);
      setGoals([]);
      setProfileLoadedFor(null);
      setCardsLoadedFor(null);
      setTransactionsLoadedFor(null);
      setRecurringLoadedFor(null);
      setGoalsLoadedFor(null);
    }
  }, [user]);

  // Sincronização em tempo real do Perfil via Firestore
  useEffect(() => {
    if (!user) {
      return;
    }
    const unsub = subscribeToUserProfile(user.uid, (remoteProfile) => {
      if (remoteProfile) {
        setUserProfile({ ...INITIAL_USER_PROFILE, ...remoteProfile });
        if (
          remoteProfile.isOnboarded === true ||
          (typeof remoteProfile.name === "string" && remoteProfile.name.trim().length > 0) ||
          (typeof remoteProfile.monthlyIncomeBase === "number" && remoteProfile.monthlyIncomeBase > 0)
        ) {
          markUserOnboardedLocal(user.uid);
        }
      }
      setProfileLoadedFor(user.uid);
    });
    return () => unsub();
  }, [user]);

  // Migra e repara contas antigas sem reaplicar o histórico sobre um saldo que
  // já havia sido atualizado pelo modelo legado.
  useEffect(() => {
    if (!user || cardsLoadedFor !== user.uid || transactionsLoadedFor !== user.uid) return;
    cards.filter((card) => card.type === "checking").forEach((card) => {
      const migration = getCheckingBalanceMigration(card, transactions);
      if (!migration) return;
      updateCardFieldsInFirestore(user.uid, card.id, migration).catch((error) =>
        console.error("Erro ao migrar saldo inicial para o Firestore:", error)
      );
    });
  }, [cards, cardsLoadedFor, transactions, transactionsLoadedFor, user]);

  // Sincronização em tempo real das Metas via Firestore
  useEffect(() => {
    if (!user) {
      return;
    }
    const unsub = subscribeToGoals(user.uid, (remoteGoals) => {
      setGoals(remoteGoals);
      setGoalsLoadedFor(user.uid);
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real dos Itens Recorrentes via Firestore
  useEffect(() => {
    if (!user) {
      return;
    }
    const unsub = subscribeToRecurring(user.uid, (remoteRecurring) => {
      // Snapshot vazio é um estado válido — sempre atualizar
      setRecurringItems(remoteRecurring);
      if (remoteRecurring.length > 0) {
        markUserOnboardedLocal(user.uid);
      }
      setRecurringLoadedFor(user.uid);
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real dos Cartões via Firestore
  useEffect(() => {
    if (!user) {
      return;
    }
    const unsub = subscribeToCards(user.uid, (remoteCards) => {
      // Snapshot vazio é um estado válido — sempre atualizar
      setCards(remoteCards);
      if (remoteCards.length > 0) {
        markUserOnboardedLocal(user.uid);
        setActiveCardId((prevActiveId) => {
          if (!remoteCards.some((c) => c.id === prevActiveId)) {
            return remoteCards[0].id;
          }
          return prevActiveId;
        });
      }
      setCardsLoadedFor(user.uid);
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real das Transações via Firestore
  useEffect(() => {
    if (!user) {
      return;
    }
    const unsub = subscribeToTransactions((remoteTx) => {
      const mapped: TransactionItem[] = remoteTx.map((t) => ({
        id: t.id || `tx-${Date.now()}`,
        title: t.description,
        amount: t.amount,
        type: t.type === "in" ? "receita" : "despesa",
        category: t.category,
        account: t.paymentMethod,
        cardId: t.cardId || null,
        date: typeof t.date === "string" ? t.date : new Date(t.date).toLocaleDateString("pt-BR"),
        occurredAt: t.occurredAt || null,
        createdAt: t.createdAt || null,
        kind: t.kind || "regular",
        relatedCardId: t.relatedCardId || null,
        groupId: t.groupId || null,
        recurringItemId: t.recurringItemId || null,
        periodKey: t.periodKey || null,
      }));
      mapped.sort((a, b) => {
        const timeA = a.occurredAt
          ? new Date(a.occurredAt).getTime()
          : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.occurredAt
          ? new Date(b.occurredAt).getTime()
          : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      setTransactions(mapped);
      setTransactionsLoadedFor(user.uid);
    }, user.uid);
    return () => unsub();
  }, [user]);

  // Processamento automático de ocorrências vencidas (Catch-up e virada de dia/mês)
  const isProcessingDueRef = useRef(false);

  const runDueCheck = useCallback(async () => {
    if (!user || isProcessingDueRef.current) return;
    isProcessingDueRef.current = true;
    try {
      await processDueOccurrencesForUser(user.uid, new Date(), {
        recurringItems,
        cards,
        transactions,
      });
    } catch (err) {
      console.error("Erro no processamento de ocorrências vencidas:", err);
    } finally {
      isProcessingDueRef.current = false;
    }
  }, [user, recurringItems, cards, transactions]);

  useEffect(() => {
    if (
      !user ||
      recurringLoadedFor !== user.uid ||
      cardsLoadedFor !== user.uid ||
      transactionsLoadedFor !== user.uid
    ) {
      return;
    }
    // Executa catch-up atômico e idempotente assim que os dados essenciais estiverem sincronizados
    void runDueCheck();
  }, [user, recurringLoadedFor, cardsLoadedFor, transactionsLoadedFor, runDueCheck]);

  // Timer automático para meia-noite e verificação periódica
  useEffect(() => {
    if (!user) return;

    // Calcular milissegundos até a próxima virada de dia (00:00:02)
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      2
    );
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    const midnightTimeout = setTimeout(() => {
      void runDueCheck();
    }, msUntilMidnight);

    // Intervalo periódico de segurança a cada 30 minutos
    const interval = setInterval(() => {
      void runDueCheck();
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(midnightTimeout);
      clearInterval(interval);
    };
  }, [user, runDueCheck]);

  const updateUserProfile = useCallback((updated: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const next = { ...prev, ...updated };
      if (updated.name && !updated.avatarInitials) {
        const parts = updated.name.trim().split(" ");
        if (parts.length >= 2) {
          next.avatarInitials = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        } else if (parts[0]) {
          next.avatarInitials = parts[0].slice(0, 2).toUpperCase();
        }
      }
      if (user) {
        saveUserProfile(user.uid, next).catch((e) => console.error("Erro ao salvar perfil no Firestore:", e));
      }
      return next;
    });
  }, [user]);

  // Faturas e saldos são projeções do livro-caixa salvo no Firestore.
  const cardInvoices = useMemo(() => {
    const invoiceMap: Record<string, number> = {};
    for (const card of cards.filter((item) => item.type === "credit")) {
      invoiceMap[card.id] = calculateCreditInvoice(card, transactions, recurringItems);
    }
    return invoiceMap;
  }, [transactions, cards, recurringItems]);

  const checkingBalances = useMemo(() => {
    const result: Record<string, number> = {};
    for (const card of cards.filter((item) => item.type === "checking")) {
      result[card.id] = calculateCheckingBalance(card, transactions);
    }
    return result;
  }, [cards, transactions]);

  const enrichedCards = useMemo(
    () =>
      cards.map((card) => {
        if (card.type === "checking") {
          return { ...card, balance: checkingBalances[card.id] ?? 0, spent: 0 };
        }
        const invoiceAmount = cardInvoices[card.id] || 0;
        const usedLimit = calculateCreditCardUsedLimit(
          { ...card, spent: 0 },
          transactions,
          recurringItems
        );
        return {
          ...card,
          balance: 0,
          invoiceAmount,
          spent: Math.max(invoiceAmount, usedLimit),
        };
      }),
    [cards, cardInvoices, checkingBalances, transactions, recurringItems]
  );

  const activeCard = useMemo(
    () => enrichedCards.find((c) => c.id === activeCardId) || enrichedCards[0] || {
      id: "", name: "Carregando...", brand: "", type: "checking" as const, balance: 0, limit: 0, spent: 0,
      colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
    },
    [enrichedCards, activeCardId]
  );

  const mainBalance = useMemo(
    () => enrichedCards.find((c) => c.type === "checking")?.balance ?? 0,
    [enrichedCards]
  );

  const totalInvoices = useMemo(
    () =>
      enrichedCards
        .filter((c) => c.type === "credit")
        .reduce((acc, c) => acc + (c.invoiceAmount || 0), 0),
    [enrichedCards]
  );

  const currentMonthAccountFlow = useMemo(
    () => calculateMonthlyAccountFlow(cards, transactions),
    [cards, transactions]
  );

  const monthIncome = currentMonthAccountFlow.income;
  const monthExpense = currentMonthAccountFlow.outflow;

  const selectCard = useCallback((cardId: string) => {
    setActiveCardId(cardId);
  }, []);

  const saveCategoryBudgets = useCallback(async (budgets: CategoryBudget[]) => {
    if (!user) throw new Error("Entre na sua conta para definir o orçamento.");
    const categoryBudgets = validateCategoryBudgets(budgets);
    await saveUserProfile(user.uid, { categoryBudgets });
    setUserProfile((previous) => ({ ...previous, categoryBudgets }));
  }, [user]);

  const updateCardLimit = useCallback((cardId: string, newLimit: number) => {
    const validLimit = Math.max(1, Math.round(newLimit * 100) / 100);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, limit: validLimit } : c))
    );
    if (user) {
      updateCardLimitInFirestore(user.uid, cardId, validLimit).catch((e) =>
        console.error("Erro ao atualizar limite no Firestore:", e)
      );
    }
  }, [user]);

  const updateCardBillingCycle = useCallback(async (
    cardId: string, closingDay: number, dueDay: number
  ) => {
    if (!user) throw new Error("Entre na sua conta para alterar as datas do cartão.");
    if (!cards.some((card) => card.id === cardId && card.type === "credit")) {
      throw new Error("Cartão de crédito não encontrado.");
    }
    if (![closingDay, dueDay].every((day) => Number.isInteger(day) && day >= 1 && day <= 31)) {
      throw new Error("Informe dias entre 1 e 31 para o fechamento e o vencimento.");
    }
    await updateCardFieldsInFirestore(user.uid, cardId, { closingDay, dueDay });
    setCards((prev) => prev.map((card) => card.id === cardId ? { ...card, closingDay, dueDay } : card));
  }, [user, cards]);

  const accountOptions = useMemo(
    () => cards.length > 0
      ? [...cards].sort((a, b) => (a.type === "checking" ? -1 : 1) - (b.type === "checking" ? -1 : 1)).map((card) => card.name)
      : ["Débito/Pix"],
    [cards]
  );

  const addCard = useCallback((input: NewCardInput): CardItem => {
    const newCardId = `card-${Date.now()}`;
    const newCard: CardItem = {
      ...input,
      id: newCardId,
      spent: 0,
      invoiceAmount: 0,
      balance: input.type === "checking" ? input.balance ?? 0 : 0,
      openingBalance: input.type === "checking" ? input.balance ?? 0 : 0,
      ledgerBalanceVersion:
        input.type === "checking" ? CURRENT_LEDGER_BALANCE_VERSION : undefined,
    };
    setCards((prev) => [...prev, newCard]);
    setActiveCardId(newCardId);
    if (user) {
      saveCardToFirestore(user.uid, newCard).catch((e) =>
        console.error("Erro ao salvar cartão no Firestore:", e)
      );
    }
    return newCard;
  }, [user]);

  const deleteCard = useCallback((cardId: string) => {
    const cardToDelete = cards.find((c) => c.id === cardId);
    if (!cardToDelete) return;
    if (cards.length <= 1) return;

    setCards((prev) => {
      const remaining = prev.filter((c) => c.id !== cardId);
      if (activeCardId === cardId) {
        setActiveCardId(remaining[0]?.id || "");
      }
      return remaining;
    });
    if (user) {
      deleteCardFromFirestore(user.uid, cardId).catch((e) =>
        console.error("Erro ao excluir cartão no Firestore:", e)
      );
    }
  }, [cards, activeCardId, user]);

  const resolveCardId = useCallback((account: string): string | null => {
    if (account === "Débito/Pix") {
      const checking = cards.find((c) => c.type === "checking");
      return checking?.id || null;
    }
    const matched = cards.find((c) =>
      c.id === account || c.name.toLowerCase() === account.toLowerCase()
    );
    return matched?.id || null;
  }, [cards]);

  const addTransaction = useCallback(
    async (tx: Omit<TransactionItem, "id">) => {
      if (!user) throw new Error("Entre na sua conta para salvar o lançamento.");

      const txDate = tx.occurredAt
        ? (tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt))
        : (tx.date && /^\d{4}-\d{2}-\d{2}/.test(tx.date) ? new Date(tx.date) : new Date());
      const safeTxDate = Number.isNaN(txDate.getTime()) ? new Date() : txDate;
      const resolvedCardId = tx.cardId || resolveCardId(tx.account);
      const periodKey = getPeriodKey(safeTxDate.getFullYear(), safeTxDate.getMonth());
      const expectedRecurringType = tx.type === "receita" ? "income" : "expense";

      const requestedInstallments =
        tx.installmentsCount && tx.installmentsCount > 1
          ? Math.max(2, Math.min(360, Math.round(tx.installmentsCount)))
          : undefined;
      const isInstallmentPurchase = Boolean(requestedInstallments && requestedInstallments > 1);

      const splitInfo =
        isInstallmentPurchase && tx.amountIsTotalPurchase !== false
          ? splitInstallmentPurchase(tx.amount, requestedInstallments!)
          : {
              totalAmount: tx.amount * (requestedInstallments || 1),
              installmentsCount: requestedInstallments || 1,
              installmentAmount: tx.amount,
              lastInstallmentAmount: tx.amount,
            };

      const effectiveTxAmount = isInstallmentPurchase
        ? splitInfo.installmentAmount
        : tx.amount;
      const installmentPlan = isInstallmentPurchase
        ? buildInstallmentPurchasePlan(
            splitInfo.totalAmount, requestedInstallments!, safeTxDate, tx.paidInstallmentsCount ?? 0
          )
        : undefined;
      if (tx.paidInstallmentsCount && (!installmentPlan || !cards.some(
        (card) => card.id === resolvedCardId && card.type === "credit"
      ))) {
        throw new Error("Parcelas já pagas se aplicam a compras parceladas no cartão de crédito.");
      }
      const firstUnpaid = installmentPlan?.firstUnpaidOccurrence;
      const initialPeriodKey = firstUnpaid?.periodKey || periodKey;

      const matchingRecurring = !isInstallmentPurchase
        ? recurringItems.find((item) => {
            const itemCardId = item.cardId || resolveCardId(item.account);
            const sameTitle =
              item.title.trim().toLocaleLowerCase("pt-BR") === tx.title.trim().toLocaleLowerCase("pt-BR");
            const sameCategoryAndCloseTitle =
              item.category.trim().toLocaleLowerCase("pt-BR") === tx.category.trim().toLocaleLowerCase("pt-BR") &&
              (item.title.trim().toLocaleLowerCase("pt-BR").includes(tx.title.trim().toLocaleLowerCase("pt-BR")) ||
                tx.title.trim().toLocaleLowerCase("pt-BR").includes(item.title.trim().toLocaleLowerCase("pt-BR")));
            const sameDescription = sameTitle || sameCategoryAndCloseTitle;
            return (
              item.active &&
              (item.type || "expense") === expectedRecurringType &&
              Math.abs(item.amount - effectiveTxAmount) < 0.005 &&
              sameDescription &&
              itemCardId === resolvedCardId &&
              !item.realizedPeriods?.includes(periodKey)
            );
          })
        : undefined;

      let recurringToPersist: RecurringItem | undefined;
      if (matchingRecurring) {
        recurringToPersist = {
          ...matchingRecurring,
          realizedPeriods: [...(matchingRecurring.realizedPeriods || []), periodKey],
        };
      } else if (tx.isRecurring || isInstallmentPurchase) {
        const recurrenceType: RecurrenceType = tx.recurrenceType || "fixed_day";
        const overrides = installmentPlan?.overrides;

        recurringToPersist = {
          id: `rec-${crypto.randomUUID()}`,
          title: tx.title,
          amount: effectiveTxAmount,
          account: tx.account,
          cardId: resolvedCardId,
          category: tx.category,
          type: expectedRecurringType,
          dueDay:
            recurrenceType === "business_day_5"
              ? get5thBusinessDay(safeTxDate.getFullYear(), safeTxDate.getMonth())
              : tx.recurrenceDay || safeTxDate.getDate() || 10,
          recurrenceType,
          autoConfirm: tx.autoConfirm === true,
          installmentsCount: requestedInstallments,
          ...(installmentPlan ? { paidInstallmentsCount: installmentPlan.paidInstallmentsCount } : {}),
          startMonth: safeTxDate.getMonth(),
          startYear: safeTxDate.getFullYear(),
          realizedPeriods: installmentPlan && !firstUnpaid ? [] : [initialPeriodKey],
          ...(overrides ? { overrides } : {}),
          active: true,
        };
      }

      // Uma compra já quitada é apenas histórico de planejamento; não gera cobrança.
      if (installmentPlan && !firstUnpaid && recurringToPersist) {
        await saveRecurringToFirestore(user.uid, recurringToPersist);
        return;
      }
      const entryDate = firstUnpaid?.date || safeTxDate;
      await addTransactionFirestore(
        {
          amount: firstUnpaid?.amount ?? effectiveTxAmount,
          type: tx.type === "receita" ? "in" : "out",
          category: tx.category,
          description: tx.title,
          paymentMethod: tx.account,
          cardId: resolvedCardId,
          kind: "regular",
          recurringItemId: recurringToPersist?.id || null,
          periodKey: recurringToPersist ? initialPeriodKey : null,
          date: installmentPlan?.paidInstallmentsCount
            ? `${entryDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, 12:00`
            : tx.date,
          occurredAt: installmentPlan?.paidInstallmentsCount ? entryDate : safeTxDate,
        },
        user.uid,
        recurringToPersist
      );
    },
    [user, cards, recurringItems, resolveCardId]
  );

  /**
   * Concilia o saldo informado pelo usuário sem apagar o histórico. A diferença
   * vira uma movimentação técnica separada de renda e despesa do mês.
   */
  const reconcileCheckingBalance = useCallback(async (
    cardId: string,
    targetBalance: number
  ): Promise<number> => {
    if (!user) throw new Error("Entre na sua conta para conciliar o saldo.");
    if (!Number.isFinite(targetBalance)) throw new Error("Informe um saldo válido.");

    const checkingCard = cards.find((card) => card.id === cardId && card.type === "checking");
    if (!checkingCard) throw new Error("Conta corrente não encontrada.");

    const currentBalance = calculateCheckingBalance(checkingCard, transactions);
    const difference = Math.round((targetBalance - currentBalance) * 100) / 100;
    if (Math.abs(difference) < 0.005) return 0;

    const now = new Date();
    await addTransactionFirestore(
      {
        amount: Math.abs(difference),
        type: difference > 0 ? "in" : "out",
        category: "Conciliação de saldo",
        description: "Ajuste na conta",
        paymentMethod: checkingCard.name,
        cardId: checkingCard.id,
        kind: "balance_reconciliation",
        recurringItemId: null,
        periodKey: getPeriodKey(now.getFullYear(), now.getMonth()),
        date: now.toISOString(),
        occurredAt: now,
      },
      user.uid
    );

    return difference;
  }, [cards, transactions, user]);

  const payInvoice = useCallback(async (cardId: string, customAmount?: number, periodKey?: string) => {
    const targetCard = enrichedCards.find((c) => c.id === cardId);
    if (!targetCard || targetCard.type !== "credit") return;
    const invoiceValue = customAmount ?? targetCard.invoiceAmount ?? 0;
    if (invoiceValue <= 0) return;
    if (!user) return;

    const checkingCard = enrichedCards.find((c) => c.type === "checking");
    if (!checkingCard) throw new Error("Cadastre uma conta corrente antes de pagar a fatura.");

    const effectivePeriodKey =
      periodKey || getCardOpenInvoiceDetails(targetCard, transactions, recurringItems).periodKey;

    const now = new Date();
    await payCreditCardInvoice(user.uid, {
      amount: invoiceValue,
      checkingCardId: checkingCard.id,
      checkingAccountName: checkingCard.name,
      creditCardId: targetCard.id,
      creditCardName: targetCard.name,
      periodKey: effectivePeriodKey,
      date: `${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      occurredAt: now,
    });
  }, [enrichedCards, transactions, recurringItems, user]);

  const unpayInvoice = useCallback(async (cardId: string, periodKey: string) => {
    if (!user) throw new Error("Entre na sua conta para desfazer o pagamento da fatura.");
    await unpayCreditCardInvoice(user.uid, cardId, periodKey);
  }, [user]);

  const deleteTransaction = useCallback(async (id: string) => {
    if (!user) return;

    const txToDelete = transactions.find((t) => t.id === id);
    if (!txToDelete) return;

    // Atualização otimista imediata para que a UI responda na hora sem piscar
    setTransactions((prev) => prev.filter((t) => t.id !== id));

    const effectivePeriodKey =
      txToDelete.periodKey ||
      (txToDelete.occurredAt
        ? getPeriodKey(
            new Date(txToDelete.occurredAt).getFullYear(),
            new Date(txToDelete.occurredAt).getMonth()
          )
        : getPeriodKey(new Date().getFullYear(), new Date().getMonth()));

    await deleteTransactionFromFirestore(user.uid, {
      id: txToDelete.id,
      groupId: txToDelete.groupId,
      recurringItemId: txToDelete.recurringItemId,
      periodKey: effectivePeriodKey,
    });
  }, [transactions, user]);

  const updateTransaction = useCallback(async (id: string, updates: TransactionUpdateInput) => {
    if (!user) throw new Error("Entre na sua conta para editar o lançamento.");
    if (!transactions.some((transaction) => transaction.id === id)) {
      throw new Error("Lançamento não encontrado.");
    }
    await updateTransactionInFirestore(user.uid, id, updates);
  }, [transactions, user]);

  const addRecurringItem = useCallback(async (item: Omit<RecurringItem, "id">) => {
    if (!user) throw new Error("Entre na sua conta para salvar o planejamento.");
    const newItem: RecurringItem = {
      ...item,
      id: `rec-${crypto.randomUUID()}`,
    };
    await saveRecurringToFirestore(user.uid, newItem);
  }, [user]);

  const updateRecurringItem = useCallback(async (
    id: string,
    updates: Partial<RecurringItem>,
    fromPeriodKey?: string
  ) => {
    if (!user) throw new Error("Entre na sua conta para editar o planejamento.");
    const item = recurringItems.find((candidate) => candidate.id === id);
    const now = new Date();
    const effectiveFromPeriod = fromPeriodKey || getPeriodKey(now.getFullYear(), now.getMonth());

    const payload = item
      ? buildForwardRecurringUpdate(item, effectiveFromPeriod, updates)
      : updates;

    await updateRecurringInFirestore(user.uid, id, payload);

    // Se a competência inicial (ou futura) já tiver um lançamento efetivado vinculado, sincroniza o valor/dados
    if (item) {
      const linkedTxs = transactions.filter(
        (t) => t.recurringItemId === id && t.periodKey && t.periodKey >= effectiveFromPeriod
      );
      for (const linkedTx of linkedTxs) {
        const prevOccurredDate = getLedgerEntryDate(linkedTx) || new Date();
        const txYear = prevOccurredDate.getFullYear();
        const txMonth = prevOccurredDate.getMonth();
        const daysInTxMonth = new Date(txYear, txMonth + 1, 0).getDate();
        const updatedItemForMonth: RecurringItem = {
          ...item,
          ...updates,
        };
        const shouldMoveDay =
          updates.dueDay !== undefined || updates.recurrenceType !== undefined;
        const nextDay = shouldMoveDay
          ? Math.min(daysInTxMonth, Math.max(1, getEffectiveDueDay(updatedItemForMonth, txYear, txMonth)))
          : prevOccurredDate.getDate();
        const occurredDate = shouldMoveDay
          ? new Date(txYear, txMonth, nextDay, prevOccurredDate.getHours(), prevOccurredDate.getMinutes(), prevOccurredDate.getSeconds())
          : prevOccurredDate;
        const nextDateLabel = shouldMoveDay
          ? `${occurredDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${occurredDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          : linkedTx.date;

        await updateTransactionInFirestore(user.uid, linkedTx.id, {
          title: updates.title ?? item.title,
          amount: updates.amount !== undefined ? updates.amount : item.amount,
          type: (updates.type ?? item.type) === "income" ? "receita" : "despesa",
          category: updates.category ?? item.category,
          account: updates.account ?? item.account,
          cardId: updates.cardId !== undefined ? updates.cardId : (item.cardId ?? null),
          date: nextDateLabel,
          occurredAt: occurredDate,
        });
      }
    }
  }, [recurringItems, transactions, user]);

  const updateRecurringItemOccurrence = useCallback(async (
    id: string,
    periodKey: string,
    override: Partial<RecurringItem>
  ) => {
    if (!user) throw new Error("Entre na sua conta para editar o planejamento.");
    const item = recurringItems.find((candidate) => candidate.id === id);
    if (!item) return;

    const existingOverrides = item.overrides || {};
    const currentOverride = existingOverrides[periodKey] || {};
    const nextOverrides = {
      ...existingOverrides,
      [periodKey]: {
        ...currentOverride,
        ...override,
      },
    };

    await updateRecurringInFirestore(user.uid, id, {
      overrides: nextOverrides,
    });

    // Se esta competência específica já tiver lançamento efetivado vinculado, sincroniza também
    const linkedTx = transactions.find(
      (t) => t.recurringItemId === id && t.periodKey === periodKey
    );
    if (linkedTx) {
      const effectiveItem = getEffectiveRecurringItemForPeriod(
        { ...item, overrides: nextOverrides },
        periodKey
      );
      const prevOccurredDate = getLedgerEntryDate(linkedTx) || new Date();
      const [pYearStr, pMonthStr] = periodKey.split("-");
      const txYear = Number(pYearStr) || prevOccurredDate.getFullYear();
      const txMonth = (Number(pMonthStr) || prevOccurredDate.getMonth() + 1) - 1;
      const daysInTxMonth = new Date(txYear, txMonth + 1, 0).getDate();
      const shouldMoveDay =
        override.dueDay !== undefined || override.recurrenceType !== undefined;
      const nextDay = shouldMoveDay
        ? Math.min(daysInTxMonth, Math.max(1, getEffectiveDueDay(effectiveItem, txYear, txMonth)))
        : prevOccurredDate.getDate();
      const occurredDate = shouldMoveDay
        ? new Date(txYear, txMonth, nextDay, prevOccurredDate.getHours(), prevOccurredDate.getMinutes(), prevOccurredDate.getSeconds())
        : prevOccurredDate;
      const nextDateLabel = shouldMoveDay
        ? `${occurredDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${occurredDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
        : linkedTx.date;

      await updateTransactionInFirestore(user.uid, linkedTx.id, {
        title: effectiveItem.title,
        amount: effectiveItem.amount,
        type: effectiveItem.type === "income" ? "receita" : "despesa",
        category: effectiveItem.category,
        account: effectiveItem.account,
        cardId: effectiveItem.cardId ?? null,
        date: nextDateLabel,
        occurredAt: occurredDate,
      });
    }
  }, [recurringItems, transactions, user]);

  const deleteRecurringItemOccurrence = useCallback(async (
    id: string,
    periodKey: string
  ) => {
    if (!user) throw new Error("Entre na sua conta para alterar o planejamento.");
    const item = recurringItems.find((candidate) => candidate.id === id);
    if (!item) return;

    const nextExcluded = Array.from(new Set([...(item.excludedPeriods || []), periodKey]));
    await updateRecurringInFirestore(user.uid, id, {
      excludedPeriods: nextExcluded,
    });
  }, [recurringItems, user]);

  const toggleRecurringItem = useCallback(async (id: string) => {
    if (!user) throw new Error("Entre na sua conta para alterar o planejamento.");
    const item = recurringItems.find((candidate) => candidate.id === id);
    if (!item) return;
    await saveRecurringToFirestore(user.uid, { ...item, active: !item.active });
  }, [recurringItems, user]);

  const deleteRecurringItem = useCallback(async (id: string) => {
    if (!user) throw new Error("Entre na sua conta para excluir o planejamento.");
    await deleteRecurringFromFirestore(user.uid, id);
  }, [user]);

  const realizeRecurringItemNow = useCallback(async (
    item: RecurringItem,
    targetYear: number,
    targetMonth: number,
    customAmount?: number,
    customDate?: Date
  ) => {
    if (!user) throw new Error("Entre na sua conta para efetivar o planejamento.");
    const periodKey = getPeriodKey(targetYear, targetMonth);
    await realizePlannedOccurrence(user.uid, item, periodKey, {
      customAmount,
      customDate,
    });
  }, [user]);

  const unrealizeRecurringItem = useCallback(async (
    item: RecurringItem,
    targetYear: number,
    targetMonth: number
  ) => {
    if (!user) throw new Error("Entre na sua conta para desfazer a efetivação.");
    const periodKey = getPeriodKey(targetYear, targetMonth);
    await unrealizePlannedOccurrence(user.uid, item.id, periodKey);
  }, [user]);

  const resolveGoalAccount = useCallback((input: { cardId?: string | null; accountName?: string }) => {
    const account = input.cardId
      ? cards.find((card) => card.id === input.cardId)
      : cards.find((card) => card.type === "checking" && card.name === input.accountName) || cards.find((card) => card.type === "checking");
    if (!account || account.type !== "checking") throw new Error("Selecione uma conta corrente v?lida.");
    return account.id;
  }, [cards]);

  const addGoal = useCallback(async (
    goalInput: Omit<GoalItem, "id">,
    source?: { type: "account" | "already_saved"; cardId?: string | null; accountName?: string },
    operationId = crypto.randomUUID()
  ): Promise<GoalItem> => {
    if (!user) throw new Error("Entre na sua conta para criar uma meta.");
    const goal = { ...goalInput, id: `goal-${operationId}` };
    return saveGoalOperation(user.uid, {
      action: "create", goalId: goal.id, operationId, initialGoal: goal,
      amount: goal.current, occurredAt: new Date().toISOString(),
      ...(source?.type === "account" && goal.current > 0 ? { accountId: resolveGoalAccount(source) } : {}),
    });
  }, [user, resolveGoalAccount]);

  const contributeToGoal = useCallback(async (
    goalId: string, amount: number,
    source: { type: "account" | "already_saved"; cardId?: string | null; accountName?: string },
    operationId = crypto.randomUUID()
  ) => {
    if (!user) throw new Error("Entre na sua conta para registrar o aporte.");
    await saveGoalOperation(user.uid, {
      action: "contribute", goalId, operationId, amount, occurredAt: new Date().toISOString(),
      ...(source.type === "account" ? { accountId: resolveGoalAccount(source) } : {}),
    });
  }, [user, resolveGoalAccount]);

  const withdrawFromGoal = useCallback(async (
    goalId: string, amount: number,
    destination: { type: "account" | "already_withdrawn"; cardId?: string | null; accountName?: string },
    operationId = crypto.randomUUID()
  ) => {
    if (!user) throw new Error("Entre na sua conta para registrar o resgate.");
    await saveGoalOperation(user.uid, {
      action: "withdraw", goalId, operationId, amount, occurredAt: new Date().toISOString(),
      ...(destination.type === "account" ? { accountId: resolveGoalAccount(destination) } : {}),
    });
  }, [user, resolveGoalAccount]);

  const updateGoal = useCallback(async (goalId: string, updates: Partial<GoalItem>) => {
    if (!user) throw new Error("Entre na sua conta para editar uma meta.");
    await updateGoalDetails(user.uid, goalId, updates);
  }, [user]);

  const deleteGoal = useCallback((goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    if (user) {
      deleteGoalFromFirestore(user.uid, goalId).catch((e) =>
        console.error("Erro ao excluir meta no Firestore:", e)
      );
    }
  }, [user]);

  // Projeção dinâmica para os meses seguintes (0 = Mês Atual, 1 = Próximo mês, etc.)
  // O saldo livre projetado ao final de cada mês é transportado para o próximo como saldo em conta.
  const getMonthlyProjection = useCallback((
    monthIndex: number,
    customMonths?: PlanningMonth[]
  ): MonthProjection => {
    const months = customMonths || getPlanningMonths(6);
    const safeIndex = Math.min(Math.max(0, monthIndex), months.length - 1);
    const currentMonthIdx = months.findIndex((m) => m.isCurrent);

    // Renda cadastrada no perfil (apenas referência cadastral, não entra automático no fluxo)
    const baseIncome = userProfile.monthlyIncomeBase || 0;

    let runningBalance = 0;
    let projectionResult: MonthProjection = null!;

    for (let idx = 0; idx <= safeIndex; idx++) {
      const m = months[idx];
      const targetPeriodKey = getPeriodKey(m.year, m.monthIndex);
      const periodStart = new Date(m.year, m.monthIndex, 1, 0, 0, 0, 0);
      const isPastMonth = Boolean(m.isPast || (currentMonthIdx >= 0 && idx < currentMonthIdx));
      const isCurrentMonth = Boolean(m.isCurrent || (currentMonthIdx >= 0 ? idx === currentMonthIdx : idx === 0));

      const activeInTargetMonth = (item: RecurringItem) =>
        isRecurringActiveInMonth(item, m.year, m.monthIndex);
      const isCheckingRecurring = (item: RecurringItem) =>
        cards.some((card) =>
          card.type === "checking" && matchesLedgerCard(card, item.account, item.cardId)
        ) || item.account === "Débito/Pix";

      const transactionsInTargetMonth = transactions.filter((transaction) => {
        const occurredAt = getLedgerEntryDate(transaction);
        return occurredAt && getPeriodKey(occurredAt.getFullYear(), occurredAt.getMonth()) === targetPeriodKey;
      });

      const isRecurringAlreadyInTransactions = (item: RecurringItem) =>
        hasRecordedRecurringOccurrence(item, targetPeriodKey, transactions, cards);

      // Recebimentos futuros planejados ativos (ex: salário, rendimentos)
      // Se for mês passado, não há mais receitas futuras planejadas
      const plannedIncomesTotal = isPastMonth
        ? 0
        : recurringItems
            .filter((r) => r.type === "income" && activeInTargetMonth(r))
            .reduce((acc, r) => {
              const effective = getEffectiveRecurringItemForPeriod(r, targetPeriodKey);
              if (isRecurringAlreadyInTransactions(r)) return acc;
              return acc + effective.amount;
            }, 0);

      const actualIncomeTotal = transactionsInTargetMonth
        .filter((transaction) => transaction.kind !== "balance_reconciliation")
        .filter((transaction) => transaction.type === "receita" && cards.some((card) =>
          card.type === "checking" && matchesLedgerCard(card, transaction.account, transaction.cardId)
        ))
        .reduce((total, transaction) => total + transaction.amount, 0);

      const actualOutflowTotal = transactionsInTargetMonth
        .filter((transaction) => transaction.kind !== "balance_reconciliation")
        .filter((transaction) => transaction.type === "despesa" && cards.some((card) =>
          card.type === "checking" && matchesLedgerCard(card, transaction.account, transaction.cardId)
        ))
        .reduce((total, transaction) => total + transaction.amount, 0);

      const balanceReconciliationTotal = transactionsInTargetMonth
        .filter((transaction) => transaction.kind === "balance_reconciliation")
        .filter((transaction) => cards.some((card) =>
          card.type === "checking" && matchesLedgerCard(card, transaction.account, transaction.cardId)
        ))
        .reduce(
          (total, transaction) =>
            total + (transaction.type === "receita" ? transaction.amount : -transaction.amount),
          0
        );

      // Contas recorrentes e pagamentos futuros ativos no débito
      const overdueDebitTotal = isCurrentMonth ? getPendingDueOccurrences(
        recurringItems.filter((item) => item.type !== "income" && isCheckingRecurring(item)), cards, transactions, new Date()
      ).filter((occurrence) => occurrence.periodKey < targetPeriodKey).reduce((sum, occurrence) => sum + occurrence.amount, 0) : 0;
      const recurringDebitTotal = overdueDebitTotal + (isPastMonth
        ? 0
        : recurringItems
            .filter((r) => r.type !== "income" && isCheckingRecurring(r) && activeInTargetMonth(r))
            .reduce((acc, r) => {
              const effective = getEffectiveRecurringItemForPeriod(r, targetPeriodKey);
              if (isRecurringAlreadyInTransactions(r)) return acc;
              return acc + effective.amount;
            }, 0));

      // Faturas de cartão de crédito detalhadas por cartão
      const creditCards = cards.filter((card) => card.type === "credit");

      // Para o mês de planejamento m (ex: Outubro), a fatura a ser paga em m tem vencimento no mês m.
      // Os gastos ocorridos em m que vencem em m+1 entram como compromisso de pagamento no mês m+1 (Novembro).
      const invoicePeriodYear = m.year;
      const invoicePeriodMonth = m.monthIndex;
      const invoicePeriodKey = getPeriodKey(invoicePeriodYear, invoicePeriodMonth);
      const invoiceDueMonthName = MONTH_NAMES_PT[invoicePeriodMonth];

      const cardInvoices: CardInvoiceProjection[] = creditCards.map((creditCard) => {
        const monthDetails = getCardInvoiceDetailsForMonth(
          creditCard,
          transactions,
          recurringItems,
          invoicePeriodYear,
          invoicePeriodMonth
        );

        const pendingInvoice = isPastMonth ? 0 : monthDetails.pendingInvoice;
        const paidAmount = monthDetails.paidAmount;
        const totalInvoice = monthDetails.totalInvoice;
        const isPaid =
          isPastMonth ||
          monthDetails.isPaid ||
          (totalInvoice === 0 && pendingInvoice === 0);

        return {
          cardId: creditCard.id,
          cardName: creditCard.name,
          cardColor: creditCard.colorScheme?.accent || "#1D1D1F",
          dueDay: creditCard.dueDay || 10,
          closingDay: creditCard.closingDay || 3,
          installmentsAmount: monthDetails.installmentsAmount,
          recurringAmount: monthDetails.recurringAmount,
          totalInvoice,
          paidAmount,
          pendingInvoice,
          isPaid,
          recurringItems: monthDetails.recurringItems,
          transactions: monthDetails.cardTransactions as TransactionItem[],
          invoicePeriodKey,
          invoiceDueMonthName,
        };
      });

      const recurringCreditTotal = cardInvoices.reduce((sum, ci) => sum + ci.recurringAmount, 0);
      const cardInstallments = cardInvoices.reduce((sum, ci) => sum + ci.installmentsAmount, 0);
      const totalInvoicesScheduled = cardInvoices.reduce((sum, ci) => sum + ci.totalInvoice, 0);
      const totalInvoicesPending = cardInvoices.reduce((sum, ci) => sum + ci.pendingInvoice, 0);
      const totalInvoicesPaid = cardInvoices.reduce((sum, ci) => sum + ci.paidAmount, 0);

      // Total comprometido = Contas Fixas Débito + Faturas de Cartão Pendentes
      const pendingCommitted = recurringDebitTotal + totalInvoicesPending;
      const totalCommitted = actualOutflowTotal + pendingCommitted;

      // Saldo inicial do mês e saldo projetado
      let openingBalance = 0;
      let actualClosingBalance = 0;
      let projectedFreeBalance = 0;

      if (isPastMonth) {
        openingBalance = cards
          .filter((card) => card.type === "checking")
          .reduce(
            (total, card) =>
              total + calculateCheckingBalanceBefore(card, transactions, periodStart),
            0
          );
        actualClosingBalance = openingBalance + balanceReconciliationTotal + actualIncomeTotal - actualOutflowTotal;
        projectedFreeBalance = actualClosingBalance;
        runningBalance = projectedFreeBalance;
      } else if (isCurrentMonth) {
        openingBalance = cards
          .filter((card) => card.type === "checking")
          .reduce(
            (total, card) =>
              total + calculateCheckingBalanceBefore(card, transactions, periodStart),
            0
          );
        actualClosingBalance = openingBalance + balanceReconciliationTotal + actualIncomeTotal - actualOutflowTotal;
        projectedFreeBalance = calculateProjectedBalance(
          actualClosingBalance,
          plannedIncomesTotal,
          pendingCommitted
        );
        runningBalance = projectedFreeBalance;
      } else {
        openingBalance = runningBalance;
        actualClosingBalance = openingBalance + balanceReconciliationTotal + actualIncomeTotal - actualOutflowTotal;
        projectedFreeBalance = calculateProjectedBalance(
          actualClosingBalance,
          plannedIncomesTotal,
          pendingCommitted
        );
        runningBalance = projectedFreeBalance;
      }

      if (idx === safeIndex) {
        projectionResult = {
          monthName: m.short,
          year: m.year,
          baseIncome,
          plannedIncomesTotal,
          projectedIncome: actualIncomeTotal + plannedIncomesTotal,
          recurringDebitTotal,
          recurringCreditTotal,
          cardInstallments,
          totalCommitted,
          actualIncomeTotal,
          actualOutflowTotal,
          balanceReconciliationTotal,
          pendingCommitted,
          projectedFreeBalance,
          openingBalance,
          actualClosingBalance,
          cardInvoices,
          totalInvoicesScheduled,
          totalInvoicesPending,
          totalInvoicesPaid,
          monthNetSurplus: (actualIncomeTotal + plannedIncomesTotal) - totalCommitted,
        };
      }
    }

    return projectionResult;
  }, [userProfile.monthlyIncomeBase, recurringItems, cards, transactions]);

  const contextValue = useMemo(
    () => ({
      userProfile,
      cards: enrichedCards,
      activeCardId,
      activeCard,
      transactions,
      recurringItems,
      goals,
      isDataLoaded,
      mainBalance,
      totalInvoices,
      monthIncome,
      monthExpense,
      accountOptions,
      selectCard,
      updateCardLimit,
      updateCardBillingCycle,
      addCard,
      deleteCard,
      updateUserProfile,
      saveCategoryBudgets,
      addTransaction,
      reconcileCheckingBalance,
      updateTransaction,
      payInvoice,
      unpayInvoice,
      deleteTransaction,
      addRecurringItem,
      updateRecurringItem,
      updateRecurringItemOccurrence,
      deleteRecurringItemOccurrence,
      toggleRecurringItem,
      deleteRecurringItem,
      realizeRecurringItemNow,
      unrealizeRecurringItem,
      getMonthlyProjection,
      addGoal,
      contributeToGoal,
      withdrawFromGoal,
      updateGoal,
      deleteGoal,
    }),
    [
      userProfile,
      enrichedCards,
      activeCardId,
      activeCard,
      transactions,
      recurringItems,
      goals,
      isDataLoaded,
      mainBalance,
      totalInvoices,
      monthIncome,
      monthExpense,
      accountOptions,
      selectCard,
      updateCardLimit,
      updateCardBillingCycle,
      addCard,
      deleteCard,
      updateUserProfile,
      saveCategoryBudgets,
      addTransaction,
      reconcileCheckingBalance,
      updateTransaction,
      payInvoice,
      unpayInvoice,
      deleteTransaction,
      addRecurringItem,
      updateRecurringItem,
      updateRecurringItemOccurrence,
      deleteRecurringItemOccurrence,
      toggleRecurringItem,
      deleteRecurringItem,
      realizeRecurringItemNow,
      unrealizeRecurringItem,
      getMonthlyProjection,
      addGoal,
      contributeToGoal,
      withdrawFromGoal,
      updateGoal,
      deleteGoal,
    ]
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
