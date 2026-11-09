"use client";

import React, { useState } from "react";
import {
  Building2,
  ChevronDown,
  CreditCard,
  Repeat,
  Sparkles,
  Check,
  CalendarDays,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { get5thBusinessDay, MONTH_NAMES_PT } from "@/lib/utils/dateUtils";
import { formatAccountLabel, getInvoiceDueDate } from "@/lib/utils/ledger";
import { buildInstallmentPurchasePlan } from "@/lib/utils/installments";
import { RecurrenceType } from "@/types";
import { Portal } from "./Portal";
import { AutoConfirmToggle } from "./AutoConfirmToggle";
import { getCategoryBudgetProgress } from "@/lib/utils/categoryBudgets";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/utils/categories";
import { useCalendarDay } from "@/lib/hooks/useCalendarDay";
import {
  sanitizeTextInput,
  validateCurrency,
  validateDayOfMonth,
  validateInstallmentsCount,
} from "@/lib/utils/security";

export { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/utils/categories";

export interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: string[];
  initialAccount?: string;
  initialType?: "despesa" | "receita";
  onAdd?: (transaction: {
    title: string;
    amount: number;
    type: "despesa" | "receita";
    category: string;
    account: string;
    cardId?: string | null;
    date: string;
    occurredAt?: Date | string | null;
    isRecurring?: boolean;
    autoConfirm?: boolean;
    recurrenceType?: RecurrenceType;
    recurrenceDay?: number;
    installmentsCount?: number;
    paidInstallmentsCount?: number;
  }) => void | Promise<void>;
}

const DEFAULT_ACCOUNTS = ["Débito/Pix"];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function formatDateToInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveDateInput(preset: "today" | "yesterday" | "custom", customDate: string): string {
  if (preset === "custom") return customDate;
  const date = new Date();
  if (preset === "yesterday") date.setDate(date.getDate() - 1);
  return formatDateToInput(date);
}

export function AddTransactionSheet({
  isOpen,
  onClose,
  accounts = DEFAULT_ACCOUNTS,
  initialAccount,
  initialType,
  onAdd,
}: AddTransactionSheetProps) {
  const { cards, addTransaction, userProfile, transactions } = useWallet();
  const [type, setType] = useState<"despesa" | "receita">(initialType || "despesa");
  const [amountInput, setAmountInput] = useState("");
  const [title, setTitle] = useState("");

  const [category, setCategory] = useState(initialType === "receita" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
  const [account, setAccount] = useState(initialAccount || accounts[0] || "Débito/Pix");
  const [dateInput, setDateInput] = useState(() => formatDateToInput(new Date()));
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "custom">("today");
  const [isRecurring, setIsRecurring] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(() =>
    initialType === "receita" ? "business_day_5" : "fixed_day"
  );
  const [recurrenceDay, setRecurrenceDay] = useState(() => new Date().getDate());
  const [isCustomDayOpen, setIsCustomDayOpen] = useState(false);
  const [customDayInput, setCustomDayInput] = useState(() => String(new Date().getDate()));
  const [durationMode, setDurationMode] = useState<"continuous" | "limited">("continuous");
  const [installmentsInput, setInstallmentsInput] = useState("3");
  const [paidInstallmentsInput, setPaidInstallmentsInput] = useState("0");
  const [creditPurchaseMode, setCreditPurchaseMode] = useState<"single" | "installments" | "subscription">("single");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      if (initialAccount) setAccount(initialAccount);
      if (initialType) {
        setType(initialType);
        if (initialType !== type) setCategory(initialType === "receita" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
        setRecurrenceType(initialType === "receita" ? "business_day_5" : "fixed_day");
      }
      const todayDay = new Date().getDate();
      setRecurrenceDay(todayDay);
      setCustomDayInput(String(todayDay));
    }
  }

  useCalendarDay();
  const effectiveDateInput = resolveDateInput(datePreset, dateInput);
  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();
  const current5thBusinessDay = get5thBusinessDay(currentYear, currentMonthIndex);
  const currentMonthName = MONTH_NAMES_PT[currentMonthIndex];

  const categoriesList = type === "despesa" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const checkingAccounts = cards
    .filter((card) => card.type === "checking")
    .map((card) => card.name);
  const availableAccounts =
    type === "receita" && checkingAccounts.length > 0
      ? checkingAccounts
      : accounts;
  const effectiveAccount = availableAccounts.includes(account)
    ? account
    : availableAccounts[0] || "Débito/Pix";
  const selectedCardObj = cards.find(
    (card) => card.name === effectiveAccount || card.id === effectiveAccount
  );
  const isSelectedAccountCreditCard =
    type === "despesa" && selectedCardObj?.type === "credit";

  const handleTypeChange = (nextType: "despesa" | "receita") => {
    setType(nextType);
    setCategory(nextType === "despesa" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
    if (nextType === "receita") {
      setAccount(checkingAccounts[0] || accounts[0] || "Débito/Pix");
      setRecurrenceType("business_day_5");
    } else {
      setRecurrenceType("fixed_day");
    }
  };

  if (!isOpen) return null;

  const parsedAmount =
    parseFloat(amountInput.replace(/\./g, "").replace(",", ".")) || 0;
  const installmentsCount = Math.min(
    360,
    Math.max(2, parseInt(installmentsInput, 10) || 3)
  );
  const isInstallmentModeActive = isSelectedAccountCreditCard
    ? creditPurchaseMode === "installments"
    : isRecurring && durationMode === "limited";
  const paidInstallmentsCount = isSelectedAccountCreditCard && isInstallmentModeActive
    ? Math.min(installmentsCount, Math.max(0, Math.trunc(Number(paidInstallmentsInput) || 0)))
    : 0;
  const [purchaseYear, purchaseMonth, purchaseDay] = effectiveDateInput.split("-").map(Number);
  const purchaseDate = purchaseYear && purchaseMonth && purchaseDay
    ? new Date(purchaseYear, purchaseMonth - 1, purchaseDay, 12)
    : now;
  const installmentSplit = buildInstallmentPurchasePlan(
    parsedAmount,
    isInstallmentModeActive ? installmentsCount : 1,
    purchaseDate,
    paidInstallmentsCount
  );
  const firstUnpaidInvoiceDate = selectedCardObj && installmentSplit.firstUnpaidOccurrence
    ? getInvoiceDueDate(selectedCardObj, installmentSplit.firstUnpaidOccurrence.date)
    : null;
  const effectiveDueDay =
    recurrenceType === "business_day_5"
      ? current5thBusinessDay
      : recurrenceDay;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const currencyCheck = validateCurrency(amountInput, { min: 0.01, max: 50_000_000 });
    if (!currencyCheck.isValid) {
      setErrorMessage(currencyCheck.error || "Informe um valor monetário válido.");
      return;
    }

    const safeAmount = currencyCheck.value;
    if (isSelectedAccountCreditCard && isInstallmentModeActive && (
      !/^\d+$/.test(paidInstallmentsInput) || Number(paidInstallmentsInput) > installmentsCount
    )) {
      setErrorMessage(`Informe entre 0 e ${installmentsCount} parcelas já pagas.`);
      return;
    }
    const sanitizedTitle = sanitizeTextInput(title, 100);
    const sanitizedCategory = sanitizeTextInput(category, 60) || "Outros";

    setLoading(true);
    try {
      const txDescription = sanitizedTitle || sanitizedCategory;

      const [y, m, d] = resolveDateInput(datePreset, dateInput).split("-").map(Number);
      const chosenDate = (y && m && d) ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
      const isToday =
        chosenDate.getFullYear() === now.getFullYear() &&
        chosenDate.getMonth() === now.getMonth() &&
        chosenDate.getDate() === now.getDate();

      const txTime = isToday
        ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "12:00";

      const formattedDate = `${chosenDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })}, ${txTime}`;

      const submitAction = onAdd || addTransaction;
      if (!submitAction) throw new Error("Fluxo de lançamento indisponível.");

      const effectiveIsRecurring = isSelectedAccountCreditCard
        ? creditPurchaseMode === "installments" || creditPurchaseMode === "subscription"
        : isRecurring;
      const effectiveInstallmentsCount = isSelectedAccountCreditCard
        ? creditPurchaseMode === "installments"
          ? validateInstallmentsCount(installmentsCount).value
          : undefined
        : isRecurring && durationMode === "limited"
          ? validateInstallmentsCount(installmentsCount).value
          : undefined;
      const effectiveRecurrenceType = isSelectedAccountCreditCard
        ? "fixed_day"
        : recurrenceType;
      const effectiveRecurrenceDay = isSelectedAccountCreditCard
        ? creditPurchaseMode === "installments"
          ? validateDayOfMonth(chosenDate.getDate()).value
          : validateDayOfMonth(effectiveDueDay).value
        : validateDayOfMonth(effectiveDueDay).value;

      await submitAction({
        title: txDescription,
        amount: safeAmount,
        type,
        category: sanitizedCategory,
        account: effectiveAccount,
        cardId: cards.find((card) => card.name === effectiveAccount)?.id || null,
        date: formattedDate,
        occurredAt: chosenDate,
        isRecurring: effectiveIsRecurring,
        autoConfirm: effectiveIsRecurring && !isSelectedAccountCreditCard && autoConfirm,
        recurrenceType: effectiveIsRecurring ? effectiveRecurrenceType : undefined,
        recurrenceDay: effectiveIsRecurring ? effectiveRecurrenceDay : undefined,
        installmentsCount: effectiveInstallmentsCount,
        paidInstallmentsCount: isSelectedAccountCreditCard && isInstallmentModeActive
          ? paidInstallmentsCount
          : undefined,
      });

      setAmountInput("");
      setTitle("");
      setIsRecurring(false);
      setAutoConfirm(false);
      setCreditPurchaseMode("single");
      setDatePreset("today");
      const today = new Date();
      setDateInput(formatDateToInput(today));
      setRecurrenceType(type === "receita" ? "business_day_5" : "fixed_day");
      setRecurrenceDay(today.getDate());
      setCustomDayInput(String(today.getDate()));
      setDurationMode("continuous");
      setInstallmentsInput("3");
      setPaidInstallmentsInput("0");
      setErrorMessage(null);
      onClose();
    } catch (err: unknown) {
      console.error("Erro ao salvar transação:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Erro ao gravar a transação. Verifique sua conexão."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
        {/* Backdrop com Blur Suave */}
        <button
          type="button"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-apple-backdrop"
          onClick={onClose}
          aria-label="Fechar"
        />

        {/* Sheet Modal Estilo Apple Pay / iOS */}
        <div className="relative z-10 max-h-[90dvh] sm:max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-apple-sheet sm:animate-apple-modal border border-black/[0.04] pb-8 pb-safe touch-scroll">
        {/* Pílula no Mobile */}
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[#D1D1D6] sm:hidden" />

        {/* 1. CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 sm:pt-5 pb-3.5 sm:pb-4 border-b border-black/[0.04]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-[#1D1D1F]">
              {type === "receita" ? "Nova Receita" : "Nova Despesa"}
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                type === "receita"
                  ? "bg-emerald-50/80 text-emerald-700"
                  : "bg-[#F2F2F7] text-[#86868B]"
              }`}
            >
              {type === "receita" ? "Recebimento" : "Pagamento"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer select-none py-1 px-2"
          >
            Cancelar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 sm:space-y-5 pb-8 sm:pb-6">
          {errorMessage && (
            <div className="bg-red-50 text-red-600 border border-red-200/60 rounded-xl px-4 py-2.5 text-xs font-medium animate-in fade-in duration-200">
              {errorMessage}
            </div>
          )}

          {/* 2. SELEÇÃO DA OPERAÇÃO (Segmented Control Nativo) */}
          <div className="p-1 rounded-full bg-[#E5E5EA]/60 border border-black/[0.04] grid grid-cols-2 gap-0.5">
            <button
              type="button"
              onClick={() => handleTypeChange("despesa")}
              className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                type === "despesa"
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
              }`}
            >
              Pagamento (Saída)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("receita")}
              className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                type === "receita"
                  ? "bg-white text-emerald-700 font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
              }`}
            >
              Recebimento (Entrada)
            </button>
          </div>

          {/* 3. VALOR COMO PROTAGONISTA (Experiência Apple Cash / Wallet) */}
          <div className="text-center py-5 px-4 bg-[#FBFBFD] rounded-2xl border border-black/[0.04] space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] block">
              {isInstallmentModeActive
                ? `Valor total da compra (${installmentsCount}x)`
                : "Valor do lançamento"}
            </span>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-light text-[#86868B]">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full max-w-[260px] text-center text-3xl sm:text-5xl font-semibold tracking-tight text-[#1D1D1F] placeholder:text-[#D1D1D6] outline-none bg-transparent font-mono tabular-nums"
                autoFocus
              />
            </div>
            {isInstallmentModeActive && parsedAmount > 0 && (
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-[11px] font-semibold font-mono tabular-nums">
                  {installmentsCount}x de R$ {formatCurrency(installmentSplit.installmentAmount)} / mês
                </span>
              </div>
            )}
            {amountInput && (
              <button
                type="button"
                onClick={() => setAmountInput("")}
                className="text-[11px] font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
              >
                Limpar valor
              </button>
            )}
          </div>

          {/* 4. CONTA OU CARTÃO (Superfícies Compactas Elegantes) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              {type === "receita"
                ? "Destino do recebimento"
                : "Conta ou cartão de cobrança"}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableAccounts.map((acc) => {
                const isSelected = effectiveAccount === acc;
                const accCard = cards.find(
                  (card) => card.name === acc || card.id === acc
                );
                const isCreditCard = accCard?.type === "credit";

                return (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => setAccount(acc)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all select-none cursor-pointer ${
                      isSelected
                        ? "bg-white border-black/15 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5"
                        : "bg-[#F2F2F7]/50 border-black/[0.04] text-[#86868B] hover:bg-[#E5E5EA]/50 hover:text-[#1D1D1F]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? isCreditCard
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-emerald-50 text-emerald-700"
                            : "bg-black/[0.04] text-[#86868B]"
                        }`}
                      >
                        {isCreditCard ? (
                          <CreditCard size={13} strokeWidth={1.75} />
                        ) : (
                          <Building2 size={13} strokeWidth={1.75} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span
                          className={`block text-xs font-semibold truncate ${
                            isSelected ? "text-[#1D1D1F]" : "text-[#86868B]"
                          }`}
                        >
                          {formatAccountLabel(acc)}
                        </span>
                        <span className="block text-[10px] text-[#86868B] truncate">
                          {isCreditCard ? "Cartão de crédito" : "Conta / Pix"}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-[#1D1D1F] shrink-0 mr-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4.1 PARCELAMENTO DIRETO NO CARTÃO DE CRÉDITO */}
          {isSelectedAccountCreditCard && (
            <details className="group rounded-2xl border border-indigo-200/70 bg-indigo-50/40 p-3.5 sm:p-4">
              <summary className="cursor-pointer text-xs font-semibold text-indigo-950">
                {creditPurchaseMode === "installments" ? `Compra em ${installmentsCount}x` : creditPurchaseMode === "subscription" ? "Assinatura mensal" : "À vista · Parcelar ou repetir"}
              </summary>
            <div className="mt-3 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                  <CreditCard size={13} strokeWidth={2} className="text-indigo-700" />
                  Como foi a compra no cartão?
                </span>
                <span className="text-[11px] font-semibold text-indigo-700">
                  {creditPurchaseMode === "single"
                    ? "À vista (1x)"
                    : creditPurchaseMode === "installments"
                      ? `Parcelado em ${installmentsCount}x`
                      : "Assinatura Mensal"}
                </span>
              </div>

              <div className="p-1 rounded-full bg-white/90 border border-indigo-200/60 grid grid-cols-3 gap-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCreditPurchaseMode("single")}
                  className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                    creditPurchaseMode === "single"
                      ? "bg-[#1D1D1F] text-white font-semibold shadow-2xs"
                      : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                  }`}
                >
                  À vista (1x)
                </button>
                <button
                  type="button"
                  onClick={() => setCreditPurchaseMode("installments")}
                  className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                    creditPurchaseMode === "installments"
                      ? "bg-[#1D1D1F] text-white font-semibold shadow-2xs"
                      : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                  }`}
                >
                  Parcelado
                </button>
                <button
                  type="button"
                  onClick={() => setCreditPurchaseMode("subscription")}
                  className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                    creditPurchaseMode === "subscription"
                      ? "bg-[#1D1D1F] text-white font-semibold shadow-2xs"
                      : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                  }`}
                >
                  Assinatura Fixa
                </button>
              </div>

              {creditPurchaseMode === "installments" && (
                <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
                  <div className="flex flex-wrap gap-1.5">
                    {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setInstallmentsInput(String(count))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          installmentsCount === count &&
                          installmentsInput === String(count)
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "bg-white text-[#1D1D1F] border border-indigo-200/70 hover:bg-indigo-50"
                        }`}
                      >
                        {count}x
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#1D1D1F] pt-0.5">
                    <span className="text-[#86868B] font-medium">Quantidade de parcelas:</span>
                    <div className="flex items-center gap-1 bg-white border border-indigo-200/80 rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(installmentsInput, 10) || 2;
                          setInstallmentsInput(String(Math.max(2, current - 1)));
                        }}
                        className="w-6 h-6 rounded bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] font-bold text-xs flex items-center justify-center cursor-pointer select-none"
                        title="Diminuir"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="2"
                        max="360"
                        value={installmentsInput}
                        onChange={(e) => setInstallmentsInput(e.target.value)}
                        onBlur={() => setInstallmentsInput(String(installmentsCount))}
                        className="w-12 text-center text-xs font-bold text-[#1D1D1F] outline-none bg-transparent"
                      />
                      <span className="text-xs font-bold text-[#86868B] pr-1">x</span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(installmentsInput, 10) || 2;
                          setInstallmentsInput(String(current + 1));
                        }}
                        className="w-6 h-6 rounded bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] font-bold text-xs flex items-center justify-center cursor-pointer select-none"
                        title="Aumentar"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-indigo-200/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="paid-installments" className="font-medium text-[#1D1D1F]">Parcelas já pagas</label>
                      <input
                        id="paid-installments"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={installmentsCount}
                        step={1}
                        required
                        value={paidInstallmentsInput}
                        onChange={(e) => setPaidInstallmentsInput(e.target.value)}
                        aria-describedby="paid-installments-help"
                        className="w-16 rounded-lg border border-indigo-200 px-2 py-1.5 text-center font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>
                    <p id="paid-installments-help" className="text-[11px] text-[#86868B] leading-relaxed">
                      Comprou antes de usar o app? Informe a data original da compra e quantas parcelas já quitou. Esses pagamentos não serão debitados do seu saldo atual.
                    </p>
                    <p className="font-medium text-indigo-700" aria-live="polite">
                      {installmentSplit.remainingInstallments > 0
                        ? `Restam ${installmentSplit.remainingInstallments} de ${installmentsCount} parcelas. Próxima: ${paidInstallmentsCount + 1}/${installmentsCount}${firstUnpaidInvoiceDate ? ` na fatura de ${firstUnpaidInvoiceDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}` : ""}.`
                        : "Compra quitada. Nenhum valor será descontado do limite."}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-indigo-200/70 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#86868B]">Valor de cada parcela:</span>
                      <strong className="text-indigo-700 font-mono tabular-nums">
                        {installmentsCount}x de R$ {formatCurrency(installmentSplit.installmentAmount)}
                      </strong>
                    </div>
                    {Math.abs(installmentSplit.lastInstallmentAmount - installmentSplit.installmentAmount) >= 0.005 && (
                      <div className="flex items-center justify-between text-[11px] text-[#86868B]">
                        <span>Ajuste de centavos na última parcela:</span>
                        <span className="font-mono tabular-nums">
                          R$ {formatCurrency(installmentSplit.lastInstallmentAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-black/[0.04] pt-1.5">
                      <span className="text-[#86868B]">Limite descontado agora:</span>
                      <strong className="text-[#1D1D1F] font-mono tabular-nums">
                        R$ {formatCurrency(installmentSplit.remainingAmount)}
                      </strong>
                    </div>
                    {selectedCardObj && selectedCardObj.limit > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-[#86868B]">
                        <span>Limite disponível após a compra:</span>
                        <span className="font-mono tabular-nums font-semibold text-emerald-700">
                          R${" "}
                          {formatCurrency(
                            Math.max(
                              0,
                              selectedCardObj.limit - (selectedCardObj.spent || 0) - installmentSplit.remainingAmount
                            )
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {creditPurchaseMode === "subscription" && (
                <div className="bg-white rounded-xl p-3 border border-indigo-200/70 space-y-2 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[#86868B]">Cobrança mensal fixa no dia:</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={customDayInput}
                      onChange={(e) => {
                        setCustomDayInput(e.target.value);
                        const d = parseInt(e.target.value, 10);
                        if (!Number.isNaN(d) && d >= 1 && d <= 31) {
                          setRecurrenceDay(d);
                        }
                      }}
                      className="w-14 rounded-lg border border-black/15 bg-[#FBFBFD] px-2 py-1 text-center text-xs font-semibold text-[#1D1D1F] outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-[#86868B]">
                    Ideal para Netflix, Spotify, iCloud ou academia. Entra todo mês na fatura sem bloquear o limite dos meses futuros.
                  </p>
                </div>
              )}
            </div>
            </details>
          )}

          {/* 5. DESCRIÇÃO E CATEGORIA (Campos Suaves e Integrados) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                Descrição
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "receita"
                    ? "Ex: Salário, Freelance..."
                    : "Ex: Aluguel, Supermercado..."
                }
                className="w-full rounded-xl border border-black/[0.05] bg-[#F2F2F7]/60 px-3.5 py-2.5 text-xs font-medium text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] focus:bg-white focus:border-black/20 focus:ring-2 focus:ring-black/5"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                Categoria
              </span>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-black/[0.05] bg-[#F2F2F7]/60 pl-3.5 pr-8 py-2.5 text-xs font-medium text-[#1D1D1F] outline-none transition-all focus:bg-white focus:border-black/20 focus:ring-2 focus:ring-black/5 cursor-pointer"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B]"
                />
              </div>
            </div>
          </div>

          {/* 5.1 DATA DO LANÇAMENTO (Lançamento retroativo flexível) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] flex items-center gap-1.5">
                <CalendarDays size={13} strokeWidth={1.75} />
                Data da transação
              </span>
              <span className="text-[11px] font-medium text-[#1D1D1F]">
                {datePreset === "today"
                  ? `Hoje (${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })})`
                  : datePreset === "yesterday"
                  ? `Ontem (${(() => {
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      return y.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                    })()})`
                  : (() => {
                      const [y, m, d] = dateInput.split("-").map(Number);
                      if (y && m && d) {
                        const dt = new Date(y, m - 1, d, 12);
                        return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
                      }
                      return dateInput;
                    })()}
              </span>
            </div>

            <div className="p-1 rounded-full bg-[#E5E5EA]/60 border border-black/[0.04] grid grid-cols-3 gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setDatePreset("today");
                  setDateInput(formatDateToInput(new Date()));
                }}
                className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                  datePreset === "today"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset("yesterday");
                  const yest = new Date();
                  yest.setDate(yest.getDate() - 1);
                  setDateInput(formatDateToInput(yest));
                }}
                className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                  datePreset === "yesterday"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                }`}
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("custom")}
                className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                  datePreset === "custom"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                }`}
              >
                Outra data...
              </button>
            </div>

            {datePreset === "custom" && (
              <div className="pt-1 animate-in fade-in duration-200">
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-black/[0.08] bg-[#FBFBFD]">
                  <span className="text-xs font-medium text-[#1D1D1F]">
                    Quando foi feita:
                  </span>
                  <input
                    type="date"
                    value={dateInput}
                    onChange={(e) => {
                      setDateInput(e.target.value);
                      setDatePreset("custom");
                    }}
                    max={formatDateToInput(new Date(now.getFullYear() + 2, 11, 31))}
                    className="text-xs font-semibold text-[#1D1D1F] bg-white border border-black/10 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-black/30"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 6. RECORRÊNCIA (Progressive Disclosure - para Conta/Pix e Receitas) */}
          {!isSelectedAccountCreditCard && (
          <div className="rounded-2xl border border-black/[0.04] bg-[#FBFBFD] p-4 space-y-3">
            {/* Toggle Principal */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
                  <Repeat size={14} strokeWidth={1.75} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#1D1D1F] block">
                    Repetir todo mês
                  </span>
                  <span className="text-[11px] text-[#86868B] block">
                    Adiciona automaticamente ao planejamento futuro
                  </span>
                </div>
              </div>

              {/* Switch iOS Nativo */}
              <button
                type="button"
                onClick={() => setIsRecurring((prev) => !prev)}
                className={`w-11 h-6.5 rounded-full transition-colors relative p-0.5 cursor-pointer select-none ${
                  isRecurring
                    ? type === "receita"
                      ? "bg-emerald-600"
                      : "bg-[#1D1D1F]"
                    : "bg-[#E5E5EA]"
                }`}
                aria-label="Repetir todo mês"
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white transition-transform shadow-xs ${
                    isRecurring ? "translate-x-4.5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Progressive Disclosure: Área compacta expandida */}
            {isRecurring && (
              <div className="pt-3 border-t border-black/[0.04] space-y-3 animate-in fade-in duration-200">
                {/* Quando: Dia ou Regra */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                      Quando
                    </span>
                    <span className="text-[11px] font-medium text-[#1D1D1F]">
                      {recurrenceType === "business_day_5"
                        ? `5º dia útil (Dia ${current5thBusinessDay} em ${currentMonthName})`
                        : `Todo dia ${recurrenceDay}`}
                    </span>
                  </div>

                  <div className="p-1 rounded-full bg-[#E5E5EA]/60 border border-black/[0.04] grid grid-cols-4 gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceType("business_day_5");
                        setIsCustomDayOpen(false);
                      }}
                      className={`rounded-full py-1.5 text-[11px] transition-all select-none cursor-pointer ${
                        recurrenceType === "business_day_5"
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                          : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                      }`}
                    >
                      5º dia útil
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceType("fixed_day");
                        setRecurrenceDay(5);
                        setIsCustomDayOpen(false);
                      }}
                      className={`rounded-full py-1.5 text-[11px] transition-all select-none cursor-pointer ${
                        recurrenceType === "fixed_day" &&
                        recurrenceDay === 5 &&
                        !isCustomDayOpen
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                          : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                      }`}
                    >
                      Dia 5
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceType("fixed_day");
                        setRecurrenceDay(10);
                        setIsCustomDayOpen(false);
                      }}
                      className={`rounded-full py-1.5 text-[11px] transition-all select-none cursor-pointer ${
                        recurrenceType === "fixed_day" &&
                        recurrenceDay === 10 &&
                        !isCustomDayOpen
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                          : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                      }`}
                    >
                      Dia 10
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceType("fixed_day");
                        setIsCustomDayOpen(true);
                      }}
                      className={`rounded-full py-1.5 text-[11px] transition-all select-none cursor-pointer ${
                        isCustomDayOpen
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                          : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                      }`}
                    >
                      Outro...
                    </button>
                  </div>

                  {isCustomDayOpen && (
                    <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                      <span className="text-xs text-[#86868B]">
                        Dia do mês (1 a 31):
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={customDayInput}
                        onChange={(e) => {
                          setCustomDayInput(e.target.value);
                          const d = parseInt(e.target.value, 10);
                          if (!Number.isNaN(d) && d >= 1 && d <= 31) {
                            setRecurrenceDay(d);
                          }
                        }}
                        className="w-14 rounded-lg border border-black/10 bg-white px-2 py-1 text-center text-xs font-semibold text-[#1D1D1F] outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Duração */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                      Duração
                    </span>
                    <span className="text-[11px] font-medium text-[#1D1D1F]">
                      {durationMode === "continuous"
                        ? "Sem prazo para terminar"
                        : `${installmentsCount} parcelas mensais`}
                    </span>
                  </div>

                  <div className="p-1 rounded-full bg-[#E5E5EA]/60 border border-black/[0.04] grid grid-cols-2 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setDurationMode("continuous")}
                      className={`rounded-full py-1.5 text-[11px] transition-all select-none cursor-pointer ${
                        durationMode === "continuous"
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                          : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                      }`}
                    >
                      Contínua
                    </button>
                    <button
                      type="button"
                      onClick={() => setDurationMode("limited")}
                      className={`rounded-full py-1.5 text-[11px] transition-all select-none cursor-pointer ${
                        durationMode === "limited"
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                          : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                      }`}
                    >
                      Por X meses
                    </button>
                  </div>

                  {durationMode === "limited" && (
                    <div className="space-y-2 pt-1 animate-in fade-in">
                      <div className="flex flex-wrap gap-1.5">
                        {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setInstallmentsInput(String(count))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              installmentsCount === count &&
                              installmentsInput === String(count)
                                ? "bg-[#1D1D1F] text-white shadow-2xs"
                                : "bg-[#E5E5EA]/60 text-[#86868B] hover:text-[#1D1D1F]"
                            }`}
                          >
                            {count}x
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#86868B] pt-1">
                        <span>Outro número de vezes:</span>
                        <div className="flex items-center gap-1 bg-white border border-black/10 rounded-lg p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(installmentsInput, 10) || 2;
                              setInstallmentsInput(String(Math.max(2, current - 1)));
                            }}
                            className="w-6 h-6 rounded bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] font-bold text-xs flex items-center justify-center cursor-pointer select-none"
                            title="Diminuir"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="2"
                            max="360"
                            value={installmentsInput}
                            onChange={(e) => setInstallmentsInput(e.target.value)}
                            onBlur={() =>
                              setInstallmentsInput(String(installmentsCount))
                            }
                            className="w-12 text-center text-xs font-bold text-[#1D1D1F] outline-none"
                          />
                          <span className="text-xs font-bold text-[#86868B] pr-1">x</span>
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(installmentsInput, 10) || 2;
                              setInstallmentsInput(String(current + 1));
                            }}
                            className="w-6 h-6 rounded bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] font-bold text-xs flex items-center justify-center cursor-pointer select-none"
                            title="Aumentar"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumo Inteligente */}
                <div className="bg-emerald-50/70 border border-emerald-200/50 rounded-xl p-2.5 flex items-start gap-2">
                  <Sparkles size={13} className="text-emerald-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                    {recurrenceType === "business_day_5" ? (
                      <>
                        Próximo lançamento no <strong>5º dia útil</strong> (Dia{" "}
                        {current5thBusinessDay} em {currentMonthName}). Recalculado
                        automaticamente pulando fins de semana e feriados.
                      </>
                    ) : (
                      <>
                        Próximo lançamento no <strong>Dia {effectiveDueDay}</strong>{" "}
                        de todo mês
                        {durationMode === "limited"
                          ? ` por ${installmentsCount} meses`
                          : " contínuo"}
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
          )}

          {isRecurring && !isSelectedAccountCreditCard && <AutoConfirmToggle checked={autoConfirm} onChange={setAutoConfirm} isIncome={type === "receita"} />}
          {type === "despesa" && parsedAmount > 0 && (() => {
            const occurrence = isInstallmentModeActive ? installmentSplit.firstUnpaidOccurrence : { date: purchaseDate, amount: parsedAmount };
            if (!occurrence) return null;
            const budget = getCategoryBudgetProgress(userProfile.categoryBudgets || [], [...transactions, {
              amount: occurrence.amount, type: "despesa", account: effectiveAccount, category, occurredAt: occurrence.date,
            }], occurrence.date.getFullYear(), occurrence.date.getMonth()).find((item) => item.category === category);
            return budget && budget.status !== "normal" ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Com este lançamento, {category} ficaria em {budget.percent}% do limite mensal de R$ {formatCurrency(budget.amount)}. {budget.remaining >= 0 ? `Restariam R$ ${formatCurrency(budget.remaining)}.` : `Excederia R$ ${formatCurrency(-budget.remaining)}.`}</p> : null;
          })()}

          {/* 7. RESUMO FINANCEIRO (Subtotal / Método / Total em Destaque) */}
          <div className="space-y-1.5 pt-2 border-t border-black/[0.04]">
            <div className="flex justify-between items-center text-xs text-[#86868B]">
              <span>
                {isInstallmentModeActive ? "Valor total da compra" : "Subtotal"}
              </span>
              <span className="font-mono text-[#1D1D1F]">
                R$ {formatCurrency(parsedAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-[#86868B]">
              <span>
                {type === "receita" ? "Crédito em conta" : "Método de cobrança"}
              </span>
              <span className="font-medium text-[#1D1D1F]">
                {formatAccountLabel(effectiveAccount)}
              </span>
            </div>
            {isInstallmentModeActive && (
              <div className="flex justify-between items-center text-xs text-indigo-700 font-medium">
                <span>Parcelamento na fatura</span>
                <span className="font-mono tabular-nums font-semibold">
                  {installmentsCount}x de R$ {formatCurrency(installmentSplit.installmentAmount)}
                </span>
              </div>
            )}
            {isSelectedAccountCreditCard && isInstallmentModeActive && paidInstallmentsCount > 0 && (
              <div className="flex justify-between items-center text-xs text-[#86868B]">
                <span>Saldo pendente no limite</span>
                <span className="font-mono text-[#1D1D1F]">R$ {formatCurrency(installmentSplit.remainingAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                {type === "receita"
                  ? "Total a receber"
                  : isInstallmentModeActive
                    ? installmentSplit.remainingInstallments > 0
                      ? `${paidInstallmentsCount + 1}ª parcela na fatura`
                      : "Compra quitada"
                    : "Total a pagar"}
              </span>
              <span className="text-2xl font-bold tracking-tight text-[#1D1D1F] font-mono tabular-nums">
                R${" "}
                {formatCurrency(
                  isInstallmentModeActive ? installmentSplit.firstUnpaidOccurrence?.amount ?? 0 : parsedAmount
                )}
              </span>
            </div>
          </div>

          {/* 8. CONFIRMAÇÃO W PAY E BOTÃO PRINCIPAL */}
          <div className="pt-2 space-y-3">
            {/* Confirmação Segura */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#86868B]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-60"
              >
                <path d="M7 3H5a2 2 0 0 0-2 2v2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M3 17v2a2 2 0 0 0 2 2h2" />
                <line x1="9" y1="10" x2="9.01" y2="10" />
                <line x1="15" y1="10" x2="15.01" y2="10" />
                <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
              </svg>
              <span>Confirmação instantânea na carteira</span>
            </div>

            {/* CTA Principal */}
            <button
              type="submit"
              disabled={loading || parsedAmount <= 0}
              className="w-full h-12.5 rounded-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm transition-all duration-150 active:scale-[0.98] select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Check size={16} strokeWidth={2.5} />
                  <span>
                    {type === "receita" ? "Salvar recebimento" : "Salvar gasto"}
                  </span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
