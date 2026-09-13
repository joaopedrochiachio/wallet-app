"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeToUserProfile, saveUserProfile } from "@/lib/services/userService";
import {
  subscribeToCards,
  saveCardToFirestore,
  deleteCardFromFirestore,
  updateCardLimitInFirestore,
  updateCardFieldsInFirestore,
  writeBatch,
  doc,
  db,
} from "@/lib/services/cardsService";
import {
  subscribeToTransactions,
  addTransaction as addTransactionFirestore,
  deleteTransactionFromFirestore,
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
  isRecurring?: boolean;
  recurrenceType?: RecurrenceType;
  recurrenceDay?: number;
  installmentsCount?: number;
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
  projectedFreeBalance: number;
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
  const [cards, setCards] = useState<CardItem[]>([]);
  const [activeCardId, setActiveCardId] = useState<string>("");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);

  // Rastreamento de carregamento dos listeners do Firestore
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const [recurringLoaded, setRecurringLoaded] = useState(false);
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  const isDataLoaded = profileLoaded && cardsLoaded && transactionsLoaded && recurringLoaded && goalsLoaded;

  // Sincronização em tempo real do Perfil via Firestore
  useEffect(() => {
    if (!user) {
      setProfileLoaded(false);
      return;
    }
    const unsub = subscribeToUserProfile(user.uid, (remoteProfile) => {
      if (remoteProfile) {
        setUserProfile(remoteProfile);
      }
      setProfileLoaded(true);
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real das Metas via Firestore
  useEffect(() => {
    if (!user) {
      setGoalsLoaded(false);
      return;
    }
    const unsub = subscribeToGoals(user.uid, (remoteGoals) => {
      setGoals(remoteGoals);
      setGoalsLoaded(true);
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real dos Itens Recorrentes via Firestore
  useEffect(() => {
    if (!user) {
      setRecurringLoaded(false);
      return;
    }
    const unsub = subscribeToRecurring(user.uid, (remoteRecurring) => {
      // Snapshot vazio é um estado válido — sempre atualizar
      setRecurringItems(remoteRecurring);
      setRecurringLoaded(true);
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real dos Cartões via Firestore
  useEffect(() => {
    if (!user) {
      setCardsLoaded(false);
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
      setCardsLoaded(true);
    });
    return () => unsub();
  }, [user]);

  // Sincronização em tempo real das Transações via Firestore
  useEffect(() => {
    if (!user) {
      setTransactionsLoaded(false);
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
      }));
      setTransactions(mapped);
      setTransactionsLoaded(true);
    }, user.uid);
    return () => unsub();
  }, [user]);

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
    () => cards.find((c) => c.id === activeCardId) || cards[0] || {
      id: "", name: "Carregando...", brand: "", type: "checking" as const, balance: 0, limit: 0, spent: 0,
      colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
    },
    [cards, activeCardId]
  );

  const mainBalance = useMemo(
    () => cards.find((c) => c.type === "checking")?.balance ?? 0,
    [cards]
  );

  // MODELO DERIVADO: invoiceAmount calculado a partir das transações por cardId/nome
  const cardInvoices = useMemo(() => {
    const invoiceMap: Record<string, number> = {};
    for (const tx of transactions) {
      // Resolver qual card esta transação pertence
      const matchedCard = cards.find((c) =>
        c.type === "credit" && (
          c.id === tx.cardId ||
          c.id === tx.account ||
          c.name.toLowerCase() === tx.account.toLowerCase()
        )
      );
      if (matchedCard) {
        if (!invoiceMap[matchedCard.id]) invoiceMap[matchedCard.id] = 0;
        if (tx.type === "despesa") {
          invoiceMap[matchedCard.id] += tx.amount;
        } else {
          invoiceMap[matchedCard.id] -= tx.amount;
        }
      }
    }
    // Garantir que não fique negativo
    for (const key of Object.keys(invoiceMap)) {
      invoiceMap[key] = Math.max(0, invoiceMap[key]);
    }
    return invoiceMap;
  }, [transactions, cards]);

  // MODELO DERIVADO: spent calculado a partir das transações por cardId/nome
  const cardSpent = useMemo(() => {
    const spentMap: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.type !== "despesa") continue;
      const matchedCard = cards.find((c) =>
        c.id === tx.cardId ||
        c.id === tx.account ||
        c.name.toLowerCase() === tx.account.toLowerCase()
      );
      if (matchedCard) {
        if (!spentMap[matchedCard.id]) spentMap[matchedCard.id] = 0;
        spentMap[matchedCard.id] += tx.amount;
      }
    }
    return spentMap;
  }, [transactions, cards]);

  // Cards enriquecidos com invoiceAmount e spent derivados
  const enrichedCards = useMemo(() =>
    cards.map((c) => ({
      ...c,
      invoiceAmount: c.type === "credit" ? (cardInvoices[c.id] || 0) : c.invoiceAmount,
      spent: cardSpent[c.id] || 0,
    })),
    [cards, cardInvoices, cardSpent]
  );

  const totalInvoices = useMemo(
    () =>
      enrichedCards
        .filter((c) => c.type === "credit")
        .reduce((acc, c) => acc + (c.invoiceAmount || 0), 0),
    [enrichedCards]
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

  // Regra de negócio (agent.md Seção 5.3):
  // Modelo derivado: invoiceAmount/spent são calculados via useMemo.
  // Apenas balance de checking precisa ser persistido no Firestore.
  const addTransaction = (tx: Omit<TransactionItem, "id">) => {
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

    // Resolver cardId para referência estável
    const resolvedCardId = resolveCardId(tx.account);

    // Persistir mutação de balance no Firestore para contas correntes (checking)
    if (user) {
      const matchedChecking = cards.find((c) =>
        c.type === "checking" &&
        (tx.account === "Débito/Pix" ||
         c.id === tx.account ||
         c.name.toLowerCase() === tx.account.toLowerCase())
      );

      if (matchedChecking) {
        const balanceDelta = tx.type === "despesa" ? -tx.amount : tx.amount;
        const newBalance = (matchedChecking.balance || 0) + balanceDelta;
        // Atualização otimista local + persistência no Firestore
        setCards((prev) => prev.map((c) =>
          c.id === matchedChecking.id ? { ...c, balance: newBalance } : c
        ));
        updateCardFieldsInFirestore(user.uid, matchedChecking.id, { balance: newBalance }).catch((e) =>
          console.error("Erro ao atualizar balance no Firestore:", e)
        );
      }
    }
    // Nota: Para cartões de crédito, invoiceAmount/spent são derivados automaticamente
    // das transações via useMemo — não é necessário mutar o card.
  };

  /**
   * Resolve o cardId a partir do nome/account da transação.
   * Usado para adicionar referência estável (cardId) às novas transações.
   */
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

  const payInvoice = async (cardId: string) => {
    const targetCard = enrichedCards.find((c) => c.id === cardId);
    if (!targetCard || targetCard.type !== "credit" || !targetCard.invoiceAmount) return;
    if (!user) return;

    const invoiceValue = targetCard.invoiceAmount;
    const checkingCard = cards.find((c) => c.type === "checking");
    if (!checkingCard) return;

    const newCheckingBalance = (checkingCard.balance || 0) - invoiceValue;

    try {
      // Operação atômica: atualizar balance da checking + criar transação de pagamento
      const batch = writeBatch(db);

      // 1. Atualizar balance da conta corrente
      const checkingDocRef = doc(db, "users", user.uid, "cards", checkingCard.id);
      batch.update(checkingDocRef, { balance: newCheckingBalance });

      await batch.commit();

      // 2. Criar transação de pagamento no Firestore (fora do batch pois usa addDoc)
      await addTransactionFirestore(
        {
          amount: invoiceValue,
          type: "out",
          category: "Pagamento de Fatura",
          description: `Pagamento Fatura ${targetCard.name}`,
          paymentMethod: "Débito/Pix",
          date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) +
                ", " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
        user.uid
      );

      // Atualização otimista local (listeners do Firestore atualizarão com dados reais)
      setCards((prev) =>
        prev.map((c) => {
          if (c.id === checkingCard.id) {
            return { ...c, balance: newCheckingBalance };
          }
          return c;
        })
      );
    } catch (e) {
      console.error("Erro ao pagar fatura no Firestore:", e);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;

    // Encontrar a transação antes de deletar para ajustar balance se necessário
    const txToDelete = transactions.find((t) => t.id === id);

    try {
      // Deletar do Firestore — o listener onSnapshot atualizará o state automaticamente
      await deleteTransactionFromFirestore(user.uid, id);

      // Se era uma transação de checking, ajustar o balance no Firestore
      if (txToDelete) {
        const matchedChecking = cards.find((c) =>
          c.type === "checking" &&
          (txToDelete.account === "Débito/Pix" ||
           c.id === txToDelete.account ||
           c.id === txToDelete.cardId ||
           c.name.toLowerCase() === txToDelete.account.toLowerCase())
        );

        if (matchedChecking) {
          // Reverter o efeito da transação no balance
          const balanceAdjust = txToDelete.type === "despesa" ? txToDelete.amount : -txToDelete.amount;
          const newBalance = (matchedChecking.balance || 0) + balanceAdjust;
          await updateCardFieldsInFirestore(user.uid, matchedChecking.id, { balance: newBalance });
        }
      }
    } catch (e) {
      console.error("Erro ao excluir transação do Firestore:", e);
    }
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

    // Fatura em aberto no mês atual — agora derivada das transações
    const currentInvoicesTotal = enrichedCards
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
