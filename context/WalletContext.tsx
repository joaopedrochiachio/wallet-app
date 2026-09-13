"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeToUserProfile, saveUserProfile } from "@/lib/services/userService";
import {
  subscribeToCards,
  saveCardToFirestore,
  deleteCardFromFirestore,
  updateCardLimitInFirestore,
} from "@/lib/services/cardsService";
import {
  subscribeToTransactions,
  addTransaction as addTransactionFirestore,
} from "@/lib/services/transactionsService";
import {
  subscribeToGoals,
  saveGoalToFirestore,
  deleteGoalFromFirestore,
} from "@/lib/services/goalsService";
import {
  subscribeToRecurring,
  saveRecurringToFirestore,
  deleteRecurringFromFirestore,
} from "@/lib/services/recurringService";
import { get5thBusinessDay } from "@/lib/utils/dateUtils";
import { GoalItem, RecurringItem, RecurrenceType } from "@/types";

export interface CardItem {
  id: string;
  name: string;
  brand: string;
  type: "checking" | "credit";
  balance?: number; // Saldo da conta corrente
  invoiceAmount?: number; // Fatura atual do cartão de crédito
  limit: number; // Limite total
  spent: number; // Gastos acumulados no mês
  closingDay?: number; // Dia de fechamento da fatura
  dueDay?: number; // Dia de vencimento
  colorScheme: {
    gradient: string;
    border: string;
    accent: string;
    badgeText: string;
    chipGradient: string;
  };
}

export interface TransactionItem {
  id: string;
  title: string;
  amount: number;
  type: "despesa" | "receita";
  category: string;
  account: string; // ex: "Débito/Pix", "Nubank", "Santander"
  date: string;
  isRecurring?: boolean;
  recurrenceType?: RecurrenceType;
  recurrenceDay?: number;
  installmentsCount?: number;
}

export type { RecurringItem, RecurrenceType };


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
  projectedFreeBalance: number;
}

export type FinancialPersonaId = "optimizer" | "guardian" | "scaler" | "minimalist";
export type RiskToleranceId = "low" | "moderate" | "high";
export type AIToneId = "analytical" | "direct" | "collaborative";

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatarInitials: string;
  monthlyIncomeBase: number;
  currency: string;
  persona: FinancialPersonaId;
  riskTolerance: RiskToleranceId;
  aiTone: AIToneId;
  maxCommitmentAlertPercent: number;
  primaryFocus: string;
}

export interface NewCardInput {
  name: string;
  brand: string;
  type: "checking" | "credit";
  balance?: number;
  limit: number;
  closingDay?: number;
  dueDay?: number;
  colorScheme: {
    gradient: string;
    border: string;
    accent: string;
    badgeText: string;
    chipGradient: string;
  };
}

interface WalletContextType {
  userProfile: UserProfile;
  cards: CardItem[];
  activeCardId: string;
  activeCard: CardItem;
  transactions: TransactionItem[];
  recurringItems: RecurringItem[];
  goals: GoalItem[];
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
  addTransaction: (tx: Omit<TransactionItem, "id">) => void;
  payInvoice: (cardId: string) => void;
  deleteTransaction: (id: string) => void;
  addRecurringItem: (item: Omit<RecurringItem, "id">) => void;
  toggleRecurringItem: (id: string) => void;
  deleteRecurringItem: (id: string) => void;
  getMonthlyProjection: (monthIndex: number) => MonthProjection;
  addGoal: (goal: Omit<GoalItem, "id">) => GoalItem;
  updateGoalProgress: (goalId: string, amountToAdd: number) => void;
  deleteGoal: (goalId: string) => void;
}

const INITIAL_CARDS: CardItem[] = [
  {
    id: "default-pass",
    name: "Conta Principal",
    brand: "Débito / Pix",
    type: "checking",
    balance: 0.0,
    limit: 0.0,
    spent: 0.0,
    colorScheme: {
      gradient: "from-[#1C1C1E] via-[#141416] to-[#0A0A0C]",
      border: "border-white/15",
      accent: "text-white",
      badgeText: "Conta Corrente",
      chipGradient: "from-amber-200 to-amber-500",
    },
  },
];

const INITIAL_TRANSACTIONS: TransactionItem[] = [];

const INITIAL_RECURRING: RecurringItem[] = [];

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

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [cards, setCards] = useState<CardItem[]>(INITIAL_CARDS);
  const [activeCardId, setActiveCardId] = useState<string>("default-pass");
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>(INITIAL_RECURRING);
  const [goals, setGoals] = useState<GoalItem[]>([]);

  // Carregar do localStorage se disponível no cliente (para cache offline/fallback)
  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem("wallet_user_profile");
      const storedCards = localStorage.getItem("wallet_cards");
      const storedTx = localStorage.getItem("wallet_transactions");
      const storedActive = localStorage.getItem("wallet_active_card");
      const storedRecurring = localStorage.getItem("wallet_recurring");
      const storedGoals = localStorage.getItem("wallet_goals");
      if (storedProfile) setUserProfile(JSON.parse(storedProfile));
      if (storedCards) setCards(JSON.parse(storedCards));
      if (storedTx) setTransactions(JSON.parse(storedTx));
      if (storedActive) setActiveCardId(storedActive);
      if (storedRecurring) setRecurringItems(JSON.parse(storedRecurring));
      if (storedGoals) setGoals(JSON.parse(storedGoals));
    } catch {
      // Ignore storage errors on SSR/private mode
    }
  }, []);

  // Sincronização em tempo real do Perfil via Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserProfile(user.uid, (remoteProfile) => {
      if (remoteProfile) {
        setUserProfile(remoteProfile);
      }
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real das Metas via Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToGoals(user.uid, (remoteGoals) => {
      if (remoteGoals) {
        setGoals(remoteGoals);
      }
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real dos Itens Recorrentes via Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRecurring(user.uid, (remoteRecurring) => {
      if (remoteRecurring && remoteRecurring.length > 0) {
        setRecurringItems(remoteRecurring);
      }
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real dos Cartões via Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToCards(user.uid, (remoteCards) => {
      if (remoteCards && remoteCards.length > 0) {
        setCards(remoteCards);
        if (!remoteCards.some((c) => c.id === activeCardId)) {
          setActiveCardId(remoteCards[0].id);
        }
      }
    });
    return () => unsub();
  }, [user, activeCardId]);

  // Sincronização em tempo real das Transações via Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToTransactions((remoteTx) => {
      const mapped: TransactionItem[] = remoteTx.map((t) => ({
        id: t.id || `tx-${Date.now()}`,
        title: t.description,
        amount: t.amount,
        type: t.type === "in" ? "receita" : "despesa",
        category: t.category,
        account: t.paymentMethod,
        date: typeof t.date === "string" ? t.date : new Date(t.date).toLocaleDateString("pt-BR"),
      }));
      setTransactions(mapped);
    }, user.uid);
    return () => unsub();
  }, [user]);

  // Persistir alterações em localStorage para cache
  useEffect(() => {
    try {
      localStorage.setItem("wallet_user_profile", JSON.stringify(userProfile));
      localStorage.setItem("wallet_cards", JSON.stringify(cards));
      localStorage.setItem("wallet_transactions", JSON.stringify(transactions));
      localStorage.setItem("wallet_active_card", activeCardId);
      localStorage.setItem("wallet_recurring", JSON.stringify(recurringItems));
      localStorage.setItem("wallet_goals", JSON.stringify(goals));
    } catch {
      // Ignore storage errors
    }
  }, [userProfile, cards, transactions, activeCardId, recurringItems, goals]);

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

  const activeCard = useMemo(
    () => cards.find((c) => c.id === activeCardId) || cards[0],
    [cards, activeCardId]
  );

  const mainBalance = useMemo(
    () => cards.find((c) => c.type === "checking")?.balance ?? 0,
    [cards]
  );

  const totalInvoices = useMemo(
    () =>
      cards
        .filter((c) => c.type === "credit")
        .reduce((acc, c) => acc + (c.invoiceAmount || 0), 0),
    [cards]
  );

  const monthIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "receita")
        .reduce((acc, t) => acc + t.amount, 0),
    [transactions]
  );

  const monthExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "despesa")
        .reduce((acc, t) => acc + t.amount, 0),
    [transactions]
  );

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
    () => [
      "Débito/Pix",
      ...cards.filter((c) => c.type === "credit").map((c) => c.name),
    ],
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
        setActiveCardId(remaining[0]?.id || "titanium");
      }
      return remaining;
    });
    if (user) {
      deleteCardFromFirestore(user.uid, cardId).catch((e) =>
        console.error("Erro ao excluir cartão no Firestore:", e)
      );
    }
  };

  // Regra de negócio (agent.md Seção 5.3):
  const addTransaction = (tx: Omit<TransactionItem, "id">) => {
    const newTx: TransactionItem = {
      ...tx,
      id: `tx-${Date.now()}`,
    };

    setTransactions((prev) => [newTx, ...prev]);

    // Se marcou como recorrente, adiciona automaticamente à lista de recorrências
    if (tx.isRecurring) {
      const recType: RecurrenceType = tx.recurrenceType || "fixed_day";
      const now = new Date();
      const calculatedDay =
        recType === "business_day_5"
          ? get5thBusinessDay(now.getFullYear(), now.getMonth())
          : tx.recurrenceDay || 10;

      const newRec: RecurringItem = {
        id: `rec-${Date.now()}`,
        title: tx.title,
        amount: tx.amount,
        account: tx.account,
        category: tx.category,
        type: tx.type === "receita" ? "income" : "expense",
        dueDay: calculatedDay,
        recurrenceType: recType,
        installmentsCount: tx.installmentsCount,
        startMonthIndex: 0,
        startYear: now.getFullYear(),
        active: true,
      };
      addRecurringItem(newRec);
    }

    setCards((prevCards) =>
      prevCards.map((card) => {
        const matchesCreditCard =
          card.type === "credit" &&
          (card.id === tx.account ||
           card.name.toLowerCase() === tx.account.toLowerCase());

        if (matchesCreditCard) {
          if (tx.type === "despesa") {
            const newInvoice = (card.invoiceAmount || 0) + tx.amount;
            const newSpent = card.spent + tx.amount;
            return {
              ...card,
              invoiceAmount: newInvoice,
              spent: newSpent,
            };
          } else {
            const newInvoice = Math.max(0, (card.invoiceAmount || 0) - tx.amount);
            return {
              ...card,
              invoiceAmount: newInvoice,
            };
          }
        }

        const matchesCheckingCard =
          card.type === "checking" &&
          (tx.account === "Débito/Pix" ||
           card.id === tx.account ||
           card.name.toLowerCase() === tx.account.toLowerCase());

        if (matchesCheckingCard) {
          if (tx.type === "despesa") {
            return {
              ...card,
              balance: (card.balance || 0) - tx.amount,
              spent: card.spent + tx.amount,
            };
          } else {
            return {
              ...card,
              balance: (card.balance || 0) + tx.amount,
            };
          }
        }

        return card;
      })
    );
  };

  const payInvoice = (cardId: string) => {
    const targetCard = cards.find((c) => c.id === cardId);
    if (!targetCard || targetCard.type !== "credit" || !targetCard.invoiceAmount) return;

    const invoiceValue = targetCard.invoiceAmount;

    setCards((prev) =>
      prev.map((c) => {
        if (c.type === "checking") {
          return {
            ...c,
            balance: (c.balance || 0) - invoiceValue,
          };
        }
        if (c.id === cardId) {
          return {
            ...c,
            invoiceAmount: 0,
          };
        }
        return c;
      })
    );

    const paymentTx: TransactionItem = {
      id: `tx-pay-${Date.now()}`,
      title: `Pagamento Fatura ${targetCard.name}`,
      amount: invoiceValue,
      type: "despesa",
      category: "Cartão de Crédito",
      account: "Débito/Pix",
      date: "Hoje, agora",
    };

    setTransactions((prev) => [paymentTx, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const addRecurringItem = (item: Omit<RecurringItem, "id">) => {
    const newItem: RecurringItem = {
      ...item,
      id: `rec-${Date.now()}`,
    };
    setRecurringItems((prev) => [newItem, ...prev]);
    if (user) {
      saveRecurringToFirestore(user.uid, newItem).catch((e) =>
        console.error("Erro ao salvar item recorrente no Firestore:", e)
      );
    }
  };

  const toggleRecurringItem = (id: string) => {
    setRecurringItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, active: !item.active };
          if (user) {
            saveRecurringToFirestore(user.uid, updated).catch((e) =>
              console.error("Erro ao alternar item recorrente no Firestore:", e)
            );
          }
          return updated;
        }
        return item;
      })
    );
  };

  const deleteRecurringItem = (id: string) => {
    setRecurringItems((prev) => prev.filter((item) => item.id !== id));
    if (user) {
      deleteRecurringFromFirestore(user.uid, id).catch((e) =>
        console.error("Erro ao excluir item recorrente no Firestore:", e)
      );
    }
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
  const getMonthlyProjection = (monthIndex: number): MonthProjection => {
    const months = [
      { name: "Setembro", year: 2026 },
      { name: "Outubro", year: 2026 },
      { name: "Novembro", year: 2026 },
      { name: "Dezembro", year: 2026 },
    ];

    const safeIndex = Math.min(Math.max(0, monthIndex), months.length - 1);
    const m = months[safeIndex];

    // Renda cadastrada no perfil (apenas referência cadastral, não entra automático no fluxo)
    const baseIncome = userProfile.monthlyIncomeBase || 0;

    const isItemActiveInMonth = (item: RecurringItem, targetMonthIdx: number) => {
      if (!item.active) return false;
      if (!item.installmentsCount || item.installmentsCount <= 0) return true; // Contínuo/Indefinido
      const startIdx = item.startMonthIndex ?? 0;
      const monthOffset = targetMonthIdx - startIdx;
      return monthOffset >= 0 && monthOffset < item.installmentsCount;
    };

    // Recebimentos futuros planejados ativos (ex: salário 1ª parcela dia 5, 2ª parcela dia 20, freelas)
    const plannedIncomesTotal = recurringItems
      .filter((r) => r.type === "income" && isItemActiveInMonth(r, safeIndex))
      .reduce((acc, r) => acc + r.amount, 0);

    // O valor projetado no fluxo é estritamente o que o usuário cadastrou nos recebimentos
    const projectedIncome = plannedIncomesTotal;

    // Contas recorrentes e pagamentos futuros ativos no débito
    const recurringDebitTotal = recurringItems
      .filter((r) => r.type !== "income" && r.account === "Débito/Pix" && isItemActiveInMonth(r, safeIndex))
      .reduce((acc, r) => acc + r.amount, 0);

    // Contas recorrentes e assinaturas ativas no cartão de crédito
    const recurringCreditTotal = recurringItems
      .filter((r) => r.type !== "income" && r.account !== "Débito/Pix" && isItemActiveInMonth(r, safeIndex))
      .reduce((acc, r) => acc + r.amount, 0);

    // Fatura em aberto no mês atual
    const currentInvoicesTotal = cards
      .filter((c) => c.type === "credit")
      .reduce((acc, c) => acc + (c.invoiceAmount || 0), 0);

    const cardInstallments = safeIndex === 0 ? currentInvoicesTotal : 0;

    // Total comprometido = Contas Fixas Débito + Assinaturas Crédito + Faturas Atuais
    const totalCommitted = recurringDebitTotal + recurringCreditTotal + cardInstallments;
    const projectedFreeBalance = projectedIncome - totalCommitted;

    return {
      monthName: m.name,
      year: m.year,
      baseIncome,
      plannedIncomesTotal,
      projectedIncome,
      recurringDebitTotal,
      recurringCreditTotal,
      cardInstallments,
      totalCommitted,
      projectedFreeBalance,
    };
  };

  return (
    <WalletContext.Provider
      value={{
        userProfile,
        cards,
        activeCardId,
        activeCard,
        transactions,
        recurringItems,
        goals,
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
        payInvoice,
        deleteTransaction,
        addRecurringItem,
        toggleRecurringItem,
        deleteRecurringItem,
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
