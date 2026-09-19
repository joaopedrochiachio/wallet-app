"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeToUserProfile, saveUserProfile } from "@/lib/services/userService";
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
  updateTransactionInFirestore,
  realizePlannedOccurrence,
  unrealizePlannedOccurrence,
  TransactionUpdateInput,
} from "@/lib/services/transactionsService";
import {
  subscribeToGoals,
  saveGoalToFirestore,
  deleteGoalFromFirestore,
} from "@/lib/services/goalsService";
import {
  subscribeToRecurring,
  saveRecurringToFirestore,
  updateRecurringInFirestore,
  deleteRecurringFromFirestore,
} from "@/lib/services/recurringService";
import { processDueOccurrencesForUser } from "@/lib/services/timeProgressionService";
import {
  get5thBusinessDay,
  getEffectiveDueDay,
  getPeriodKey,
  getPlanningMonths,
  PlanningMonth,
  isRecurringActiveInMonth,
} from "@/lib/utils/dateUtils";
import {
  calculateCheckingBalance,
  calculateCreditInvoice,
  calculateInvoiceSchedule,
  calculateMonthlyAccountFlow,
  calculateProjectedBalance,
  getInvoiceDueDate,
  getLedgerEntryDate,
  matchesLedgerCard,
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
  recurrenceType?: RecurrenceType;
  recurrenceDay?: number;
  installmentsCount?: number;
  kind?: "regular" | "invoice_payment" | "invoice_settlement";
  relatedCardId?: string | null;
  groupId?: string | null;
  recurringItemId?: string | null;
  periodKey?: string | null;
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
  pendingCommitted: number;
  projectedFreeBalance: number;
  openingBalance: number;
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
  addCard: (card: NewCardInput) => CardItem;
  deleteCard: (cardId: string) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  addTransaction: (tx: Omit<TransactionItem, "id">) => Promise<void>;
  updateTransaction: (id: string, updates: TransactionUpdateInput) => Promise<void>;
  payInvoice: (cardId: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addRecurringItem: (item: Omit<RecurringItem, "id">) => Promise<void>;
  updateRecurringItem: (id: string, updates: Partial<RecurringItem>) => Promise<void>;
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
  addGoal: (goal: Omit<GoalItem, "id">) => GoalItem;
  updateGoalProgress: (goalId: string, amountToAdd: number) => void;
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

  // Remove apenas caches financeiros legados. A sessão do Firebase Auth é preservada.
  useEffect(() => {
    const legacyKeys = new Set([
      ...LEGACY_FINANCIAL_STORAGE_KEYS,
      ...Object.keys(window.localStorage).filter((key) => key.startsWith("wallet_")),
    ]);
    legacyKeys.forEach((key) => window.localStorage.removeItem(key));
  }, []);

  // Sincronização em tempo real do Perfil via Firestore
  useEffect(() => {
    if (!user) {
      return;
    }
    const unsub = subscribeToUserProfile(user.uid, (remoteProfile) => {
      if (remoteProfile) {
        setUserProfile({ ...INITIAL_USER_PROFILE, ...remoteProfile });
      }
      setProfileLoadedFor(user.uid);
    });
    return () => unsub();
  }, [user]);

  // Migra contas antigas para o modelo de livro-caixa. Se já existem
  // lançamentos, eles passam a representar todo o saldo; sem lançamentos,
  // o saldo antigo é preservado como saldo inicial.
  useEffect(() => {
    if (!user || cardsLoadedFor !== user.uid || transactionsLoadedFor !== user.uid) return;
    const legacyCheckingCards = cards.filter(
      (card) => card.type === "checking" && card.openingBalance === undefined
    );
    legacyCheckingCards.forEach((card) => {
      const hasLedgerEntries = transactions.some((transaction) =>
        matchesLedgerCard(card, transaction.account, transaction.cardId)
      );
      const openingBalance = hasLedgerEntries ? 0 : card.balance ?? 0;
      updateCardFieldsInFirestore(user.uid, card.id, { openingBalance }).catch((error) =>
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
      await processDueOccurrencesForUser(user.uid);
    } catch (err) {
      console.error("Erro no processamento de ocorrências vencidas:", err);
    } finally {
      isProcessingDueRef.current = false;
    }
  }, [user]);

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

  const updateUserProfile = (updated: Partial<UserProfile>) => {
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
  };

  // Faturas e saldos são projeções do livro-caixa salvo no Firestore.
  const cardInvoices = useMemo(() => {
    const invoiceMap: Record<string, number> = {};
    for (const card of cards.filter((item) => item.type === "credit")) {
      invoiceMap[card.id] = calculateCreditInvoice(card, transactions);
    }
    return invoiceMap;
  }, [transactions, cards]);

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
        return { ...card, balance: 0, invoiceAmount, spent: invoiceAmount };
      }),
    [cards, cardInvoices, checkingBalances]
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

  const selectCard = (cardId: string) => {
    setActiveCardId(cardId);
  };

  const updateCardLimit = (cardId: string, newLimit: number) => {
    const validLimit = Math.max(100, newLimit);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, limit: validLimit } : c))
    );
    if (user) {
      updateCardLimitInFirestore(user.uid, cardId, validLimit).catch((e) =>
        console.error("Erro ao atualizar limite no Firestore:", e)
      );
    }
  };

  const accountOptions = useMemo(
    () => cards.length > 0
      ? [...cards].sort((a, b) => (a.type === "checking" ? -1 : 1) - (b.type === "checking" ? -1 : 1)).map((card) => card.name)
      : ["Débito/Pix"],
    [cards]
  );

  const addCard = (input: NewCardInput): CardItem => {
    const newCardId = `card-${Date.now()}`;
    const newCard: CardItem = {
      ...input,
      id: newCardId,
      spent: 0,
      invoiceAmount: 0,
      balance: input.type === "checking" ? input.balance ?? 0 : 0,
      openingBalance: input.type === "checking" ? input.balance ?? 0 : 0,
    };
    setCards((prev) => [...prev, newCard]);
    setActiveCardId(newCardId);
    if (user) {
      saveCardToFirestore(user.uid, newCard).catch((e) =>
        console.error("Erro ao salvar cartão no Firestore:", e)
      );
    }
    return newCard;
  };

  const deleteCard = (cardId: string) => {
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
  };

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

  const addTransaction = async (tx: Omit<TransactionItem, "id">) => {
    if (!user) throw new Error("Entre na sua conta para salvar o lançamento.");

    const now = new Date();
    const resolvedCardId = tx.cardId || resolveCardId(tx.account);
    const periodKey = getPeriodKey(now.getFullYear(), now.getMonth());
    const expectedRecurringType = tx.type === "receita" ? "income" : "expense";
    const matchingRecurring = recurringItems.find((item) => {
      const itemCardId = item.cardId || resolveCardId(item.account);
      const sameDescription =
        item.title.trim().toLocaleLowerCase("pt-BR") === tx.title.trim().toLocaleLowerCase("pt-BR") ||
        item.category.trim().toLocaleLowerCase("pt-BR") === tx.category.trim().toLocaleLowerCase("pt-BR");
      return item.active &&
        (item.type || "expense") === expectedRecurringType &&
        Math.abs(item.amount - tx.amount) < 0.005 &&
        sameDescription &&
        itemCardId === resolvedCardId &&
        !item.realizedPeriods?.includes(periodKey);
    });

    let recurringToPersist: RecurringItem | undefined;
    if (matchingRecurring) {
      recurringToPersist = {
        ...matchingRecurring,
        realizedPeriods: [...(matchingRecurring.realizedPeriods || []), periodKey],
      };
    } else if (tx.isRecurring) {
      const recurrenceType: RecurrenceType = tx.recurrenceType || "fixed_day";
      recurringToPersist = {
        id: `rec-${crypto.randomUUID()}`,
        title: tx.title,
        amount: tx.amount,
        account: tx.account,
        cardId: resolvedCardId,
        category: tx.category,
        type: expectedRecurringType,
        dueDay: recurrenceType === "business_day_5"
          ? get5thBusinessDay(now.getFullYear(), now.getMonth())
          : tx.recurrenceDay || 10,
        recurrenceType,
        installmentsCount: tx.installmentsCount,
        startMonth: now.getMonth(),
        startYear: now.getFullYear(),
        realizedPeriods: [periodKey],
        active: true,
      };
    }

    await addTransactionFirestore(
      {
        amount: tx.amount,
        type: tx.type === "receita" ? "in" : "out",
        category: tx.category,
        description: tx.title,
        paymentMethod: tx.account,
        cardId: resolvedCardId,
        kind: "regular",
        recurringItemId: recurringToPersist?.id || null,
        periodKey: recurringToPersist ? periodKey : null,
        date: tx.date,
        occurredAt: tx.occurredAt || now,
      },
      user.uid,
      recurringToPersist
    );
  };

  const payInvoice = async (cardId: string) => {
    const targetCard = enrichedCards.find((c) => c.id === cardId);
    if (!targetCard || targetCard.type !== "credit" || !targetCard.invoiceAmount) return;
    if (!user) return;

    const invoiceValue = targetCard.invoiceAmount;
    const checkingCard = enrichedCards.find((c) => c.type === "checking");
    if (!checkingCard) throw new Error("Cadastre uma conta corrente antes de pagar a fatura.");
    if ((checkingCard.balance || 0) < invoiceValue) throw new Error("Saldo insuficiente para pagar a fatura.");

    const now = new Date();
    await payCreditCardInvoice(user.uid, {
      amount: invoiceValue,
      checkingCardId: checkingCard.id,
      checkingAccountName: checkingCard.name,
      creditCardId: targetCard.id,
      creditCardName: targetCard.name,
      date: `${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      occurredAt: now,
    });
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;

    const txToDelete = transactions.find((t) => t.id === id);
    if (!txToDelete) return;
    await deleteTransactionFromFirestore(user.uid, {
      id: txToDelete.id,
      groupId: txToDelete.groupId,
      recurringItemId: txToDelete.recurringItemId,
      periodKey: txToDelete.periodKey,
    });
  };

  const updateTransaction = async (id: string, updates: TransactionUpdateInput) => {
    if (!user) throw new Error("Entre na sua conta para editar o lançamento.");
    if (!transactions.some((transaction) => transaction.id === id)) {
      throw new Error("Lançamento não encontrado.");
    }
    await updateTransactionInFirestore(user.uid, id, updates);
  };

  const addRecurringItem = async (item: Omit<RecurringItem, "id">) => {
    if (!user) throw new Error("Entre na sua conta para salvar o planejamento.");
    const newItem: RecurringItem = {
      ...item,
      id: `rec-${crypto.randomUUID()}`,
    };
    await saveRecurringToFirestore(user.uid, newItem);
  };

  const updateRecurringItem = async (id: string, updates: Partial<RecurringItem>) => {
    if (!user) throw new Error("Entre na sua conta para editar o planejamento.");
    await updateRecurringInFirestore(user.uid, id, updates);
  };

  const toggleRecurringItem = async (id: string) => {
    if (!user) throw new Error("Entre na sua conta para alterar o planejamento.");
    const item = recurringItems.find((candidate) => candidate.id === id);
    if (!item) return;
    await saveRecurringToFirestore(user.uid, { ...item, active: !item.active });
  };

  const deleteRecurringItem = async (id: string) => {
    if (!user) throw new Error("Entre na sua conta para excluir o planejamento.");
    await deleteRecurringFromFirestore(user.uid, id);
  };

  const realizeRecurringItemNow = async (
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
  };

  const unrealizeRecurringItem = async (
    item: RecurringItem,
    targetYear: number,
    targetMonth: number
  ) => {
    if (!user) throw new Error("Entre na sua conta para desfazer a efetivação.");
    const periodKey = getPeriodKey(targetYear, targetMonth);
    await unrealizePlannedOccurrence(user.uid, item.id, periodKey);
  };

  const addGoal = (goalInput: Omit<GoalItem, "id">): GoalItem => {
    const newGoal: GoalItem = {
      ...goalInput,
      id: `goal-${Date.now()}`,
    };
    setGoals((prev) => [newGoal, ...prev]);
    if (user) {
      saveGoalToFirestore(user.uid, newGoal).catch((e) =>
        console.error("Erro ao salvar meta no Firestore:", e)
      );
    }
    return newGoal;
  };

  const updateGoalProgress = (goalId: string, amountToAdd: number) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id === goalId) {
          const updated = { ...g, current: Math.min(g.target, g.current + amountToAdd) };
          if (user) {
            saveGoalToFirestore(user.uid, updated).catch((e) =>
              console.error("Erro ao atualizar meta no Firestore:", e)
            );
          }
          return updated;
        }
        return g;
      })
    );
  };

  const deleteGoal = (goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    if (user) {
      deleteGoalFromFirestore(user.uid, goalId).catch((e) =>
        console.error("Erro ao excluir meta no Firestore:", e)
      );
    }
  };

  // Projeção dinâmica para os meses seguintes (0 = Mês Atual, 1 = Próximo mês, etc.)
  // O saldo livre projetado ao final de cada mês é transportado para o próximo como saldo em conta.
  const getMonthlyProjection = (
    monthIndex: number,
    customMonths?: PlanningMonth[]
  ): MonthProjection => {
    const months = customMonths || getPlanningMonths();
    const safeIndex = Math.min(Math.max(0, monthIndex), months.length - 1);
    const currentMonthIdx = months.findIndex((m) => m.isCurrent);

    // Renda cadastrada no perfil (apenas referência cadastral, não entra automático no fluxo)
    const baseIncome = userProfile.monthlyIncomeBase || 0;

    let runningBalance = mainBalance;
    let projectionResult: MonthProjection = null!;

    for (let idx = 0; idx <= safeIndex; idx++) {
      const m = months[idx];
      const targetPeriodKey = getPeriodKey(m.year, m.monthIndex);
      const isPastMonth = Boolean(m.isPast || (currentMonthIdx >= 0 && idx < currentMonthIdx));
      const isCurrentMonth = Boolean(m.isCurrent || (currentMonthIdx >= 0 ? idx === currentMonthIdx : idx === 0));

      const activeInTargetMonth = (item: RecurringItem) =>
        isRecurringActiveInMonth(item, m.year, m.monthIndex);
      const isCheckingRecurring = (item: RecurringItem) =>
        cards.some((card) =>
          card.type === "checking" && matchesLedgerCard(card, item.account, item.cardId)
        ) || item.account === "Débito/Pix";

      // Recebimentos futuros planejados ativos (ex: salário, rendimentos)
      // Se for mês passado, não há mais receitas futuras planejadas
      const plannedIncomesTotal = isPastMonth
        ? 0
        : recurringItems
            .filter((r) => r.type === "income" && activeInTargetMonth(r))
            .reduce((acc, r) => acc + r.amount, 0);

      const transactionsInTargetMonth = transactions.filter((transaction) => {
        const occurredAt = getLedgerEntryDate(transaction);
        return occurredAt && getPeriodKey(occurredAt.getFullYear(), occurredAt.getMonth()) === targetPeriodKey;
      });

      const actualIncomeTotal = transactionsInTargetMonth
        .filter((transaction) => transaction.type === "receita" && cards.some((card) =>
          card.type === "checking" && matchesLedgerCard(card, transaction.account, transaction.cardId)
        ))
        .reduce((total, transaction) => total + transaction.amount, 0);

      const actualOutflowTotal = transactionsInTargetMonth
        .filter((transaction) => transaction.type === "despesa" && cards.some((card) =>
          card.type === "checking" && matchesLedgerCard(card, transaction.account, transaction.cardId)
        ))
        .reduce((total, transaction) => total + transaction.amount, 0);

      // Contas recorrentes e pagamentos futuros ativos no débito
      const recurringDebitTotal = isPastMonth
        ? 0
        : recurringItems
            .filter((r) => r.type !== "income" && isCheckingRecurring(r) && activeInTargetMonth(r))
            .reduce((acc, r) => acc + r.amount, 0);

      // Compras planejadas no crédito entram no mês em que a fatura vence
      let recurringCreditTotal = 0;
      if (!isPastMonth) {
        for (const item of recurringItems.filter((candidate) =>
          candidate.type !== "income" && !isCheckingRecurring(candidate)
        )) {
          const creditCard = cards.find((card) =>
            card.type === "credit" && matchesLedgerCard(card, item.account, item.cardId)
          );
          if (!creditCard) continue;
          for (let sourceOffset = -2; sourceOffset <= 0; sourceOffset += 1) {
            const source = new Date(m.year, m.monthIndex + sourceOffset, 1);
            if (!isRecurringActiveInMonth(item, source.getFullYear(), source.getMonth())) continue;
            const chargeDate = new Date(
              source.getFullYear(),
              source.getMonth(),
              getEffectiveDueDay(item, source.getFullYear(), source.getMonth()),
              12
            );
            const invoiceDueDate = getInvoiceDueDate(creditCard, chargeDate);
            if (getPeriodKey(invoiceDueDate.getFullYear(), invoiceDueDate.getMonth()) === targetPeriodKey) {
              recurringCreditTotal += item.amount;
            }
          }
        }
      }

      const cardInstallments = isPastMonth
        ? 0
        : cards
            .filter((card) => card.type === "credit")
            .reduce((total, card) => {
              const schedule = calculateInvoiceSchedule(card, transactions);
              return total + (schedule[targetPeriodKey] || 0);
            }, 0);

      // Total comprometido = Contas Fixas Débito + Assinaturas Crédito + Faturas Atuais
      const pendingCommitted = recurringDebitTotal + recurringCreditTotal + cardInstallments;
      const totalCommitted = actualOutflowTotal + pendingCommitted;

      // Saldo inicial do mês e saldo projetado
      let openingBalance = 0;
      let projectedFreeBalance = 0;

      if (isPastMonth) {
        openingBalance = actualIncomeTotal;
        projectedFreeBalance = actualIncomeTotal - actualOutflowTotal;
      } else if (isCurrentMonth) {
        openingBalance = mainBalance;
        projectedFreeBalance = calculateProjectedBalance(openingBalance, plannedIncomesTotal, pendingCommitted);
        runningBalance = projectedFreeBalance;
      } else {
        openingBalance = runningBalance;
        projectedFreeBalance = calculateProjectedBalance(
          openingBalance,
          actualIncomeTotal + plannedIncomesTotal,
          totalCommitted
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
          pendingCommitted,
          projectedFreeBalance,
          openingBalance,
        };
      }
    }

    return projectionResult;
  };

  return (
    <WalletContext.Provider
      value={{
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
        addCard,
        deleteCard,
        updateUserProfile,
        addTransaction,
        updateTransaction,
        payInvoice,
        deleteTransaction,
        addRecurringItem,
        updateRecurringItem,
        toggleRecurringItem,
        deleteRecurringItem,
        realizeRecurringItemNow,
        unrealizeRecurringItem,
        getMonthlyProjection,
        addGoal,
        updateGoalProgress,
        deleteGoal,
      }}
    >
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
