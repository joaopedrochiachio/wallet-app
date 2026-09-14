"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  ChevronDown,
  CreditCard,
  Search,
  X,
} from "lucide-react";
import type { CardItem, TransactionItem } from "@/context/WalletContext";
import { formatAccountLabel } from "@/lib/utils/ledger";

type PaymentFilter = "all" | "balance" | "credit";
type DirectionFilter = "all" | TransactionItem["type"];

interface MonthlyMovementOverviewProps {
  transactions: TransactionItem[];
  cards: CardItem[];
  monthLabel: string;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function formatTransactionDate(dateStr?: string, occurredAt?: unknown): string {
  if (dateStr) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split("-");
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  }
  if (occurredAt instanceof Date && !Number.isNaN(occurredAt.getTime())) {
    return `${String(occurredAt.getDate()).padStart(2, "0")}/${String(
      occurredAt.getMonth() + 1
    ).padStart(2, "0")}`;
  }
  return "Este mês";
}

export function MonthlyMovementOverview({
  transactions,
  cards,
  monthLabel,
}: MonthlyMovementOverviewProps) {
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [search, setSearch] = useState("");

  const isCreditTransaction = (transaction: TransactionItem) =>
    cards.some(
      (card) =>
        card.type === "credit" &&
        (card.id === transaction.cardId ||
          card.id === transaction.account ||
          card.name === transaction.account)
    );

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredTransactions = transactions.filter((transaction) => {
    const usesCredit = isCreditTransaction(transaction);
    const matchesPayment =
      paymentFilter === "all" ||
      (paymentFilter === "credit" && usesCredit) ||
      (paymentFilter === "balance" && !usesCredit);
    const matchesDirection =
      directionFilter === "all" || transaction.type === directionFilter;
    const matchesSearch =
      !normalizedSearch ||
      [transaction.title, transaction.account, transaction.category]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch);

    return matchesPayment && matchesDirection && matchesSearch;
  });

  const filteredIncome = filteredTransactions
    .filter((transaction) => transaction.type === "receita")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const filteredExpenses = filteredTransactions
    .filter((transaction) => transaction.type === "despesa")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const filteredBalanceExpenses = filteredTransactions
    .filter(
      (transaction) =>
        transaction.type === "despesa" && !isCreditTransaction(transaction)
    )
    .reduce((total, transaction) => total + transaction.amount, 0);
  const filteredCreditExpenses = filteredTransactions
    .filter(
      (transaction) =>
        transaction.type === "despesa" && isCreditTransaction(transaction)
    )
    .reduce((total, transaction) => total + transaction.amount, 0);

  const hasActiveFilters =
    paymentFilter !== "all" || directionFilter !== "all" || Boolean(search);

  const hasAnyValue =
    filteredIncome > 0 ||
    filteredExpenses > 0 ||
    filteredBalanceExpenses > 0 ||
    filteredCreditExpenses > 0;

  const shouldShowRecorte = (transactions.length > 0 || hasActiveFilters) && hasAnyValue;

  const resetFilters = () => {
    setPaymentFilter("all");
    setDirectionFilter("all");
    setSearch("");
  };

  const paymentOptions: Array<{
    id: PaymentFilter;
    label: string;
  }> = [
    { id: "all", label: "Tudo" },
    { id: "balance", label: "Pix / saldo" },
    { id: "credit", label: "Crédito" },
  ];

  const directionOptions: Array<{
    id: DirectionFilter;
    label: string;
  }> = [
    { id: "all", label: "Entradas e saídas" },
    { id: "receita", label: "Só entradas" },
    { id: "despesa", label: "Só saídas" },
  ];

  return (
    <section className="space-y-3 pt-2" data-testid="monthly-movement-overview">
      {/* 1. Header Editorial da Seção */}
      <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
              Movimentações realizadas
            </h2>
            {transactions.length > 0 && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E5E5EA]/70 text-[#86868B]"
                aria-live="polite"
              >
                {filteredTransactions.length === transactions.length
                  ? `${transactions.length} ${transactions.length === 1 ? "lançamento" : "lançamentos"}`
                  : `${filteredTransactions.length} de ${transactions.length} lançamentos`}
              </span>
            )}
          </div>
          <p className="text-xs text-[#86868B] mt-0.5">
            Lançamentos já efetivados no mês de {monthLabel}
          </p>
        </div>
      </div>

      {/* 2. Container em Superfície Única Apple (Alinhado aos cards superiores) */}
      <div className="overflow-hidden rounded-[24px] border border-black/[0.04] bg-white shadow-[0_1px_6px_rgba(0,0,0,0.02)]">
        {/* Barra de Filtros Minimalista iOS */}
        <div className="flex flex-col gap-3 p-4 sm:p-5 border-b border-black/[0.04] sm:flex-row sm:items-center sm:justify-between">
          {/* Segmented Control de Pagamento */}
          <div
            className="inline-flex max-w-full gap-0.5 rounded-[12px] bg-[#E5E5EA]/55 p-1 border border-black/[0.04] self-start sm:self-auto"
            aria-label="Filtrar por meio de pagamento"
          >
            {paymentOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPaymentFilter(option.id)}
                className={`flex h-7.5 items-center gap-1.5 rounded-[9px] px-3 text-xs transition-all select-none cursor-pointer ${
                  paymentFilter === option.id
                    ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)] font-semibold"
                    : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                }`}
                aria-pressed={paymentFilter === option.id}
              >
                {option.id === "balance" && (
                  <Building2 size={13} strokeWidth={1.75} className="opacity-70" />
                )}
                {option.id === "credit" && (
                  <CreditCard size={13} strokeWidth={1.75} className="opacity-70" />
                )}
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          {/* Busca e Filtro de Direção */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Campo de Busca Clean */}
            <div className="relative min-w-0 sm:w-56">
              <Search
                size={13}
                strokeWidth={2}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar lançamento..."
                className="h-8.5 w-full rounded-xl border border-black/[0.05] bg-[#F2F2F7]/60 pl-8.5 pr-7 text-xs text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] focus:bg-white focus:border-black/15 focus:ring-2 focus:ring-black/5"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 flex h-4.5 w-4.5 -translate-y-1/2 items-center justify-center rounded-full bg-black/10 text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  aria-label="Limpar busca"
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* Select Estilizado iOS com Chevron */}
            <div className="relative">
              <select
                value={directionFilter}
                onChange={(event) =>
                  setDirectionFilter(event.target.value as DirectionFilter)
                }
                className="h-8.5 appearance-none rounded-xl border border-black/[0.05] bg-[#F2F2F7]/60 pl-3.5 pr-8 text-xs font-medium text-[#1D1D1F] outline-none transition-all focus:bg-white focus:border-black/15 focus:ring-2 focus:ring-black/5 cursor-pointer"
                aria-label="Filtrar entradas e saídas"
              >
                {directionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                strokeWidth={2}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B]"
              />
            </div>
          </div>
        </div>

        {/* 3. Resumo do Recorte Estilo Apple (Integrado e com ritmo vertical dos cards superiores) */}
        {shouldShowRecorte && (
          <div className="border-b border-black/[0.04] bg-[#FAFAFC]/80 px-5 sm:px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                Resumo do recorte
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] transition-colors cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.04]">
              <div className="space-y-0.5">
                <span className="text-xs text-[#86868B] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Entradas
                </span>
                <div className="text-base sm:text-lg font-semibold tracking-tight text-emerald-600">
                  + R$ {formatCurrency(filteredIncome)}
                </div>
              </div>

              <div className="space-y-0.5 pt-3 sm:pt-0 sm:pl-6">
                <span className="text-xs text-[#86868B] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1D1D1F] shrink-0" />
                  Saídas
                </span>
                <div className="text-base sm:text-lg font-semibold tracking-tight text-[#1D1D1F]">
                  − R$ {formatCurrency(filteredExpenses)}
                </div>
              </div>

              <div className="space-y-0.5 pt-3 sm:pt-0 sm:pl-6">
                <span className="text-xs text-[#86868B] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8E8E93] shrink-0" />
                  Saiu do saldo
                </span>
                <div className="text-base sm:text-lg font-semibold tracking-tight text-[#1D1D1F]">
                  R$ {formatCurrency(filteredBalanceExpenses)}
                </div>
              </div>

              <div className="space-y-0.5 pt-3 sm:pt-0 sm:pl-6">
                <span className="text-xs text-[#86868B] flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] shrink-0" />
                  Foi para faturas
                </span>
                <div className="text-base sm:text-lg font-semibold tracking-tight text-indigo-600">
                  R$ {formatCurrency(filteredCreditExpenses)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Lista de Movimentações Estilo Apple Wallet */}
        {transactions.length === 0 ? (
          /* Estado Vazio Silencioso (Sem lançamentos no mês) */
          <div className="py-16 px-6 text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#1D1D1F]">
              Nenhuma movimentação em {monthLabel}
            </p>
            <p className="text-xs text-[#86868B] max-w-sm mx-auto">
              Os lançamentos realizados neste período aparecerão aqui automaticamente.
            </p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          /* Estado Vazio de Filtro */
          <div className="py-14 px-6 text-center space-y-2.5">
            <p className="text-sm font-semibold text-[#1D1D1F]">
              Nenhum lançamento encontrado
            </p>
            <p className="text-xs text-[#86868B] max-w-sm mx-auto">
              Nenhum registro coincide com os filtros aplicados para {monthLabel}.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-1 inline-flex items-center text-xs font-semibold px-4 py-1.5 rounded-full bg-[#1D1D1F] text-white hover:bg-black transition-colors cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          /* Lista com Ritmo Vertical Suave e Divisórias Delicadas */
          <div className="divide-y divide-black/[0.035]">
            {filteredTransactions.map((transaction) => {
              const onCredit = isCreditTransaction(transaction);
              const isIncome = transaction.type === "receita";

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-4 px-5 sm:px-6 py-3.5 sm:py-4 transition-colors hover:bg-black/[0.015]"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    {/* Ícone Discreto e Harmonioso */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isIncome
                          ? "bg-emerald-50 text-emerald-600"
                          : onCredit
                          ? "bg-indigo-50/70 text-indigo-600"
                          : "bg-[#F2F2F7] text-[#1D1D1F]/80"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft size={16} strokeWidth={1.75} />
                      ) : onCredit ? (
                        <CreditCard size={15} strokeWidth={1.75} />
                      ) : (
                        <ArrowUpRight size={16} strokeWidth={1.75} />
                      )}
                    </div>

                    {/* Título e Metadados Hierarquizados */}
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="truncate text-sm font-medium text-[#1D1D1F] tracking-tight">
                        {transaction.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-[#86868B] truncate">
                        <span>
                          {formatTransactionDate(
                            transaction.date,
                            transaction.occurredAt
                          )}
                        </span>
                        <span className="text-black/20">·</span>
                        <span>{formatAccountLabel(transaction.account)}</span>
                        {transaction.category && (
                          <>
                            <span className="text-black/20">·</span>
                            <span className="truncate">{transaction.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Valor Alinhado à Direita com Sinalização Elegante */}
                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm sm:text-base font-semibold tracking-tight block ${
                        isIncome ? "text-emerald-600" : "text-[#1D1D1F]"
                      }`}
                    >
                      {isIncome ? "+ " : "− "}R$ {formatCurrency(transaction.amount)}
                    </span>
                    <span className="text-[10px] text-[#86868B] font-normal block">
                      {isIncome ? "Entrada" : onCredit ? "Fatura" : "Débito"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
