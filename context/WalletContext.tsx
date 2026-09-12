"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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
}

export interface RecurringItem {
  id: string;
  title: string;
  amount: number;
  account: string; // "Débito/Pix" | "Nubank" | "Santander"
  category: string;
  dueDay: number;
  active: boolean;
}

export interface MonthProjection {
  monthName: string;
  year: number;
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
}

const INITIAL_CARDS: CardItem[] = [
  {
    id: "titanium",
    name: "Titanium Card",
    brand: "Apple Cash / Débito",
    type: "checking",
    balance: 4245.0,
    limit: 10000.0,
    spent: 4255.0,
    colorScheme: {
      gradient: "from-[#1C1C1E] via-[#141416] to-[#0A0A0C]",
      border: "border-white/15",
      accent: "text-white",
      badgeText: "Titanium Card",
      chipGradient: "from-amber-200 to-amber-500",
    },
  },
  {
    id: "nubank",
    name: "Nubank Ultravioleta",
    brand: "Mastercard Black",
    type: "credit",
    invoiceAmount: 776.0,
    limit: 8500.0,
    spent: 776.0,
    closingDay: 8,
    dueDay: 15,
    colorScheme: {
      gradient: "from-[#1F0A2E] via-[#150620] to-[#0C0212]",
      border: "border-purple-500/20",
      accent: "text-purple-300",
      badgeText: "Ultravioleta",
      chipGradient: "from-purple-200 to-amber-400",
    },
  },
  {
    id: "santander",
    name: "Santander Unique",
    brand: "Visa Infinite",
    type: "credit",
    invoiceAmount: 1054.0,
    limit: 15000.0,
    spent: 1054.0,
    closingDay: 15,
    dueDay: 22,
    colorScheme: {
      gradient: "from-[#260C0C] via-[#1A0707] to-[#0D0303]",
      border: "border-red-500/20",
      accent: "text-rose-300",
      badgeText: "Santander Unique",
      chipGradient: "from-amber-300 to-yellow-500",
    },
  },
];

const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: "tx-1",
    title: "Salário Mensal",
    amount: 3918.0,
    type: "receita",
    category: "Renda Fixa",
    account: "Débito/Pix",
    date: "05 Set, 09:00",
  },
  {
    id: "tx-2",
    title: "Gastos Inatel / Café",
    amount: 166.0,
    type: "despesa",
    category: "Alimentação & Delivery",
    account: "Débito/Pix",
    date: "08 Set, 15:30",
  },
  {
    id: "tx-3",
    title: "Parcela Empréstimo",
    amount: 155.0,
    type: "despesa",
    category: "Finanças & Serviços",
    account: "Santander",
    date: "07 Set, 11:15",
  },
  {
    id: "tx-4",
    title: "Fatura Nubank",
    amount: 776.0,
    type: "despesa",
    category: "Cartão de Crédito",
    account: "Nubank",
    date: "06 Set, 20:45",
  },
  {
    id: "tx-5",
    title: "Supermercado St. Marche",
    amount: 380.5,
    type: "despesa",
    category: "Alimentação & Delivery",
    account: "Nubank",
    date: "04 Set, 18:20",
  },
  {
    id: "tx-6",
    title: "Consultoria UI/UX",
    amount: 2400.0,
    type: "receita",
    category: "Serviços",
    account: "Débito/Pix",
    date: "09 Set, 14:00",
  },
];

const INITIAL_RECURRING: RecurringItem[] = [
  {
    id: "rec-1",
    title: "Aluguel & Condomínio",
    amount: 1850.0,
    account: "Débito/Pix",
    category: "Moradia",
    dueDay: 10,
    active: true,
  },
  {
    id: "rec-2",
    title: "Internet Fibra 600MB",
    amount: 119.9,
    account: "Débito/Pix",
    category: "Serviços",
    dueDay: 15,
    active: true,
  },
  {
    id: "rec-3",
    title: "Assinatura Netflix Premium",
    amount: 55.9,
    account: "Nubank",
    category: "Assinaturas",
    dueDay: 20,
    active: true,
  },
  {
    id: "rec-4",
    title: "Academia Smart Fit",
    amount: 129.9,
    account: "Santander",
    category: "Saúde & Fitness",
    dueDay: 5,
    active: true,
  },
  {
    id: "rec-5",
    title: "Spotify Family",
    amount: 34.9,
    account: "Santander",
    category: "Assinaturas",
    dueDay: 1,
    active: true,
  },
];

const INITIAL_USER_PROFILE: UserProfile = {
  name: "Carlos Almeida",
  email: "carlos.almeida@apple.com",
  role: "Lead Tech & Product Designer",
  avatarInitials: "CA",
  monthlyIncomeBase: 6318.0,
  currency: "BRL",
  persona: "optimizer",
  riskTolerance: "moderate",
  aiTone: "analytical",
  maxCommitmentAlertPercent: 35,
  primaryFocus: "Maximizar Retorno de Cartões & Reserva de Emergência",
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [cards, setCards] = useState<CardItem[]>(INITIAL_CARDS);
  const [activeCardId, setActiveCardId] = useState<string>("titanium");
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>(INITIAL_RECURRING);

  // Carregar do localStorage se disponível no cliente
  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem("wallet_user_profile");
      const storedCards = localStorage.getItem("wallet_cards");
      const storedTx = localStorage.getItem("wallet_transactions");
      const storedActive = localStorage.getItem("wallet_active_card");
      const storedRecurring = localStorage.getItem("wallet_recurring");
      if (storedProfile) setUserProfile(JSON.parse(storedProfile));
      if (storedCards) setCards(JSON.parse(storedCards));
      if (storedTx) setTransactions(JSON.parse(storedTx));
      if (storedActive) setActiveCardId(storedActive);
      if (storedRecurring) setRecurringItems(JSON.parse(storedRecurring));
    } catch {
      // Ignore storage errors on SSR/private mode
    }
  }, []);

  // Persistir alterações
  useEffect(() => {
    try {
      localStorage.setItem("wallet_user_profile", JSON.stringify(userProfile));
      localStorage.setItem("wallet_cards", JSON.stringify(cards));
      localStorage.setItem("wallet_transactions", JSON.stringify(transactions));
      localStorage.setItem("wallet_active_card", activeCardId);
      localStorage.setItem("wallet_recurring", JSON.stringify(recurringItems));
    } catch {
      // Ignore storage errors
    }
  }, [userProfile, cards, transactions, activeCardId, recurringItems]);

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
      return next;
    });
  };

  const activeCard = cards.find((c) => c.id === activeCardId) || cards[0];

  const mainBalance =
    cards.find((c) => c.type === "checking")?.balance ?? 0;

  const totalInvoices = cards
    .filter((c) => c.type === "credit")
    .reduce((acc, c) => acc + (c.invoiceAmount || 0), 0);

  const monthIncome = transactions
    .filter((t) => t.type === "receita")
    .reduce((acc, t) => acc + t.amount, 0);

  const monthExpense = transactions
    .filter((t) => t.type === "despesa")
    .reduce((acc, t) => acc + t.amount, 0);

  const selectCard = (cardId: string) => {
    setActiveCardId(cardId);
  };

  const updateCardLimit = (cardId: string, newLimit: number) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, limit: Math.max(100, newLimit) } : c))
    );
  };

  const accountOptions = [
    "Débito/Pix",
    ...cards.filter((c) => c.type === "credit").map((c) => c.name),
  ];

  const addCard = (input: NewCardInput): CardItem => {
    const newCardId = `card-${Date.now()}`;
    const newCard: CardItem = {
      ...input,
      id: newCardId,
      spent: 0,
      invoiceAmount: input.type === "credit" ? 0 : undefined,
      balance: input.type === "checking" ? input.balance ?? 0 : undefined,
    };
    setCards((prev) => [...prev, newCard]);
    setActiveCardId(newCardId);
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
      const newRec: RecurringItem = {
        id: `rec-${Date.now()}`,
        title: tx.title,
        amount: tx.amount,
        account: tx.account,
        category: tx.category,
        dueDay: 10,
        active: true,
      };
      setRecurringItems((prev) => [newRec, ...prev]);
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
  };

  const toggleRecurringItem = (id: string) => {
    setRecurringItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item))
    );
  };

  const deleteRecurringItem = (id: string) => {
    setRecurringItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Projeção simples para os próximos meses (0 = Setembro, 1 = Outubro, 2 = Novembro, 3 = Dezembro)
  const getMonthlyProjection = (monthIndex: number): MonthProjection => {
    const months = [
      { name: "Setembro", year: 2026, installments: 0 },
      { name: "Outubro", year: 2026, installments: 485.0 }, // parcelas futuras de cartão
      { name: "Novembro", year: 2026, installments: 210.0 },
      { name: "Dezembro", year: 2026, installments: 0.0 },
    ];

    const safeIndex = Math.min(Math.max(0, monthIndex), months.length - 1);
    const m = months[safeIndex];

    // Renda base estimada (do perfil do usuário)
    const projectedIncome = userProfile.monthlyIncomeBase || 6318.0;

    // Soma das contas recorrentes ativas no débito
    const recurringDebitTotal = recurringItems
      .filter((r) => r.active && r.account === "Débito/Pix")
      .reduce((acc, r) => acc + r.amount, 0);

    // Soma das contas recorrentes ativas no crédito
    const recurringCreditTotal = recurringItems
      .filter((r) => r.active && r.account !== "Débito/Pix")
      .reduce((acc, r) => acc + r.amount, 0);

    const cardInstallments = m.installments;

    // Total comprometido = Contas Fixas Débito + Assinaturas Crédito + Parcelas de Cartão
    const totalCommitted = recurringDebitTotal + recurringCreditTotal + cardInstallments;
    const projectedFreeBalance = projectedIncome - totalCommitted;

    return {
      monthName: m.name,
      year: m.year,
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
