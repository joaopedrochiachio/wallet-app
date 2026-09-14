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
  persona?: FinancialPersonaId;
  riskTolerance: RiskToleranceId;
  aiTone: AIToneId;
  maxCommitmentAlertPercent: number;
  primaryFocus: string;
  isOnboarded?: boolean;
}

export interface CardItem {
  id: string;
  name: string;
  brand: string;
  type: "checking" | "credit";
  balance?: number;
  /** Saldo existente antes do primeiro lançamento. O saldo atual é derivado do livro-caixa. */
  openingBalance?: number;
  invoiceAmount?: number;
  limit: number;
  spent: number;
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

export interface Transaction {
  id?: string;
  amount: number;
  type: "in" | "out";
  category: string;
  date: string | Date;
  description: string;
  paymentMethod: string;
  cardId?: string | null;
  kind?: "regular" | "invoice_payment" | "invoice_settlement";
  relatedCardId?: string | null;
  groupId?: string | null;
  recurringItemId?: string | null;
  periodKey?: string | null;
  occurredAt?: string | number | Date | null;
  createdAt?: string | number | Date;
  userId?: string;
}

export interface GoalItem {
  id: string;
  title: string;
  category: string;
  current: number;
  target: number;
  deadline?: string;
  icon?: string;
}

export type RecurrenceType = "business_day_5" | "fixed_day";

export interface RecurringItem {
  id: string;
  title: string;
  amount: number;
  type?: "expense" | "income"; // default "expense"
  account: string;
  cardId?: string | null;
  category: string;
  dueDay: number;
  recurrenceType?: RecurrenceType;
  installmentsCount?: number; // Total de meses/parcelas (ex: 3, 4, 5). Se ausente ou 0 = contínuo/fixo
  startMonthIndex?: number; // Mês inicial (0 = Setembro, 1 = Outubro...)
  startMonth?: number; // Mês calendário inicial (0 = Janeiro, 11 = Dezembro)
  startYear?: number; // Ano de início (ex: 2026)
  realizedPeriods?: string[]; // Competências já realizadas, no formato YYYY-MM
  active: boolean;
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

