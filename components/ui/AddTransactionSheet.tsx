"use client";

import React, { useState } from "react";
import {
  Building2,
  ChevronDown,
  CreditCard,
  Repeat,
  Sparkles,
  X,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { WPayLogo } from "@/components/ui/WPayLogo";
import { get5thBusinessDay, MONTH_NAMES_PT } from "@/lib/utils/dateUtils";
import { formatAccountLabel } from "@/lib/utils/ledger";
import { RecurrenceType } from "@/types";

export interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: string[];
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
    recurrenceType?: RecurrenceType;
    recurrenceDay?: number;
    installmentsCount?: number;
  }) => void | Promise<void>;
}

export const EXPENSE_CATEGORIES = [
  "Alimentação & Delivery",
  "Supermercado",
  "Transporte & Combustível",
  "Moradia & Contas",
  "Assinaturas & Lazer",
  "Saúde & Farmácia",
  "Compras & Roupas",
  "Educação",
  "Outros",
];

export const INCOME_CATEGORIES = [
  "Salário / Pró-labore",
  "Freelance & Projetos",
  "Rendimentos & Dividendos",
  "Venda & Desapego",
  "Reembolso & Cashback",
  "Bônus & 13º",
  "Outros",
];

const DEFAULT_ACCOUNTS = ["Débito/Pix"];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function AddTransactionSheet({
  isOpen,
  onClose,
  accounts = DEFAULT_ACCOUNTS,
  onAdd,
}: AddTransactionSheetProps) {
  const { cards } = useWallet();
  const [type, setType] = useState<"despesa" | "receita">("despesa");
  const [amountInput, setAmountInput] = useState("");
  const [title, setTitle] = useState("");

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [account, setAccount] = useState(accounts[0] || "Débito/Pix");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("business_day_5");
  const [recurrenceDay, setRecurrenceDay] = useState(10);
  const [isCustomDayOpen, setIsCustomDayOpen] = useState(false);
  const [customDayInput, setCustomDayInput] = useState("10");
  const [durationMode, setDurationMode] = useState<"continuous" | "limited">("continuous");
  const [installmentsInput, setInstallmentsInput] = useState("3");

  const [loading, setLoading] = useState(false);

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

  const handleTypeChange = (nextType: "despesa" | "receita") => {
    setType(nextType);
    setCategory(nextType === "despesa" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
    if (nextType === "receita") {
      setAccount(checkingAccounts[0] || accounts[0] || "Débito/Pix");
      setRecurrenceType("business_day_5");
    }
  };

  if (!isOpen) return null;

  const parsedAmount =
    parseFloat(amountInput.replace(/\./g, "").replace(",", ".")) || 0;
  const installmentsCount = Math.min(
    60,
    Math.max(2, parseInt(installmentsInput, 10) || 2)
  );

  const effectiveDueDay =
    recurrenceType === "business_day_5"
      ? current5thBusinessDay
      : recurrenceDay;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) return;

    setLoading(true);
    try {
      const txDescription =
        title.trim() || (type === "despesa" ? "Novo Pagamento" : "Novo Recebimento");
      const formattedDate = `${now.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })}, ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

      if (!onAdd) throw new Error("Fluxo de lançamento indisponível.");
      await onAdd({
        title: txDescription,
        amount: parsedAmount,
        type,
        category,
        account: effectiveAccount,
        cardId: cards.find((card) => card.name === effectiveAccount)?.id || null,
        date: formattedDate,
        occurredAt: now,
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : undefined,
        recurrenceDay: isRecurring ? effectiveDueDay : undefined,
        installmentsCount:
          isRecurring && durationMode === "limited" ? installmentsCount : undefined,
      });

      setAmountInput("");
      setTitle("");
      setIsRecurring(false);
      setDurationMode("continuous");
      setInstallmentsInput("3");
      onClose();
    } catch (err: unknown) {
      console.error("Erro ao salvar transação:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Erro ao gravar a transação. Verifique sua conexão."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop com Blur Suave */}
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-apple-backdrop"
        onClick={onClose}
        aria-label="Fechar"
      />

      {/* Sheet Modal Estilo Apple Pay / iOS */}
      <div className="relative z-10 max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-apple-sheet sm:animate-apple-modal border border-black/[0.04]">
        {/* Pílula no Mobile */}
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[#D1D1D6] sm:hidden" />

        {/* 1. CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-black/[0.04]">
          <div className="flex items-center gap-2.5">
            <WPayLogo size="md" />
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
            className="text-xs font-semibold text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer select-none"
          >
            Cancelar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
              Valor do lançamento
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
                className="w-full max-w-[260px] text-center text-4xl sm:text-5xl font-semibold tracking-tight text-[#1D1D1F] placeholder:text-[#D1D1D6] outline-none bg-transparent"
                autoFocus
              />
            </div>
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

          {/* 6. RECORRÊNCIA (Progressive Disclosure) */}
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
                    <div className="flex items-center gap-1.5 pt-1 animate-in fade-in">
                      {[2, 3, 6, 12].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setInstallmentsInput(String(count))}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            installmentsCount === count &&
                            installmentsInput === String(count)
                              ? "bg-[#1D1D1F] text-white"
                              : "bg-[#E5E5EA]/60 text-[#86868B] hover:text-[#1D1D1F]"
                          }`}
                        >
                          {count}x
                        </button>
                      ))}
                      <div className="ml-auto flex items-center gap-1.5 text-xs text-[#86868B]">
                        <span>Outro:</span>
                        <input
                          type="number"
                          min="2"
                          max="60"
                          value={installmentsInput}
                          onChange={(e) => setInstallmentsInput(e.target.value)}
                          onBlur={() =>
                            setInstallmentsInput(String(installmentsCount))
                          }
                          className="w-14 rounded-lg border border-black/10 bg-white px-2 py-1 text-center text-xs font-semibold text-[#1D1D1F] outline-none"
                        />
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

          {/* 7. RESUMO FINANCEIRO (Subtotal / Método / Total em Destaque) */}
          <div className="space-y-1.5 pt-2 border-t border-black/[0.04]">
            <div className="flex justify-between items-center text-xs text-[#86868B]">
              <span>Subtotal</span>
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
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                {type === "receita" ? "Total a receber" : "Total a pagar"}
              </span>
              <span className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
                R$ {formatCurrency(parsedAmount)}
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
              <span>Confirmação segura com W Pay</span>
            </div>

            {/* CTA Principal Estilo Apple Pay */}
            <button
              type="submit"
              disabled={loading || parsedAmount <= 0}
              className="w-full h-12.5 rounded-full bg-[#1D1D1F] hover:bg-black text-white font-medium text-sm transition-all duration-150 active:scale-[0.98] select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-normal">
                    {type === "receita" ? "Receber com" : "Pagar com"}
                  </span>
                  <WPayLogo size="md" variant="light" />
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
