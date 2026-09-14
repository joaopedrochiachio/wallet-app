"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CreditCard,
  Search,
  SlidersHorizontal,
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
          card.name === transaction.account),
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
        transaction.type === "despesa" && !isCreditTransaction(transaction),
    )
    .reduce((total, transaction) => total + transaction.amount, 0);
  const filteredCreditExpenses = filteredTransactions
    .filter(
      (transaction) =>
        transaction.type === "despesa" && isCreditTransaction(transaction),
    )
    .reduce((total, transaction) => total + transaction.amount, 0);

  const balanceCount = transactions.filter(
    (transaction) => !isCreditTransaction(transaction),
  ).length;
  const creditCount = transactions.length - balanceCount;
  const hasActiveFilters =
    paymentFilter !== "all" || directionFilter !== "all" || Boolean(search);

  const resetFilters = () => {
    setPaymentFilter("all");
    setDirectionFilter("all");
    setSearch("");
  };

  const paymentOptions: Array<{
    id: PaymentFilter;
    label: string;
    count: number;
  }> = [
    { id: "all", label: "Tudo", count: transactions.length },
    { id: "balance", label: "Pix / saldo", count: balanceCount },
    { id: "credit", label: "Crédito", count: creditCount },
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
    <section className="space-y-3" data-testid="monthly-movement-overview">
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-[#1D1D1F]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F]">
              Movimentações realizadas
            </h2>
          </div>
          <p className="mt-0.5 text-[11px] text-[#86868B]">
            Explore os lançamentos de {monthLabel} sem perder o resumo do período
          </p>
        </div>
        <span className="text-xs font-semibold text-[#86868B]" aria-live="polite">
          {filteredTransactions.length} de {transactions.length} lançamento(s)
        </span>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-black/[0.04] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="space-y-4 border-b border-black/[0.05] bg-[#FAFAFC] p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#EDEDF2] p-1"
              aria-label="Filtrar por meio de pagamento"
            >
              {paymentOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPaymentFilter(option.id)}
                  className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-all ${
                    paymentFilter === option.id
                      ? "bg-white text-[#1D1D1F] shadow-sm"
                      : "text-[#6E6E73] hover:text-[#1D1D1F]"
                  }`}
                  aria-pressed={paymentFilter === option.id}
                >
                  {option.id === "balance" && <Building2 size={13} />}
                  {option.id === "credit" && <CreditCard size={13} />}
                  <span>{option.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                      paymentFilter === option.id ? "bg-[#F2F2F7]" : "bg-black/[0.05]"
                    }`}
                  >
                    {option.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block min-w-0 sm:w-60">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar lançamento..."
                  className="h-10 w-full rounded-xl border border-black/[0.06] bg-white pl-9 pr-9 text-xs text-[#1D1D1F] outline-none transition-shadow placeholder:text-[#A1A1A6] focus:ring-4 focus:ring-blue-500/10"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#86868B] hover:bg-[#F2F2F7] hover:text-[#1D1D1F]"
                    aria-label="Limpar busca"
                  >
                    <X size={13} />
                  </button>
                )}
              </label>

              <select
                value={directionFilter}
                onChange={(event) =>
                  setDirectionFilter(event.target.value as DirectionFilter)
                }
                className="h-10 rounded-xl border border-black/[0.06] bg-white px-3 text-xs font-medium text-[#1D1D1F] outline-none focus:ring-4 focus:ring-blue-500/10"
                aria-label="Filtrar entradas e saídas"
              >
                {directionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-[18px] border border-black/[0.04] bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Resumo do recorte
                </span>
                <p className="mt-1 text-xs leading-relaxed text-[#6E6E73]">
                  {filteredTransactions.length === 0 ? (
                    "Nenhum lançamento corresponde aos filtros atuais."
                  ) : (
                    <>
                      Entraram{" "}
                      <strong className="text-emerald-700">
                        R$ {formatCurrency(filteredIncome)}
                      </strong>
                      , saíram{" "}
                      <strong className="text-[#1D1D1F]">
                        R$ {formatCurrency(filteredBalanceExpenses)}
                      </strong>{" "}
                      do saldo e{" "}
                      <strong className="text-indigo-700">
                        R$ {formatCurrency(filteredCreditExpenses)}
                      </strong>{" "}
                      foram concentrados em faturas.
                    </>
                  )}
                </p>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="self-start whitespace-nowrap rounded-full bg-[#F2F2F7] px-3 py-1.5 text-[10px] font-semibold text-[#1D1D1F] hover:bg-[#E5E5EA] sm:self-auto"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryMetric
                label="Entradas"
                value={`+ R$ ${formatCurrency(filteredIncome)}`}
                tone="positive"
              />
              <SummaryMetric
                label="Saídas lançadas"
                value={`− R$ ${formatCurrency(filteredExpenses)}`}
                tone="negative"
              />
              <SummaryMetric
                label="Saiu do saldo"
                value={`R$ ${formatCurrency(filteredBalanceExpenses)}`}
              />
              <SummaryMetric
                label="Foi para faturas"
                value={`R$ ${formatCurrency(filteredCreditExpenses)}`}
                tone="credit"
              />
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs font-medium text-[#1D1D1F]">
              Nenhuma movimentação encontrada.
            </p>
            <p className="mt-1 text-[11px] text-[#86868B]">
              Ajuste os filtros ou limpe a busca para visualizar o mês completo.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 rounded-full bg-[#1D1D1F] px-4 py-2 text-[11px] font-semibold text-white"
              >
                Ver todos os lançamentos
              </button>
            )}
          </div>
        ) : (
          <div>
            {filteredTransactions.map((transaction, index) => {
              const onCredit = isCreditTransaction(transaction);
              const isIncome = transaction.type === "receita";

              return (
                <div
                  key={transaction.id}
                  className={`flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[#F8F8FA] sm:gap-4 ${
                    index !== filteredTransactions.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isIncome
                          ? "bg-emerald-50 text-emerald-700"
                          : onCredit
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-[#F2F2F7] text-[#1D1D1F]"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft size={16} />
                      ) : onCredit ? (
                        <CreditCard size={16} />
                      ) : (
                        <ArrowUpRight size={16} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#1D1D1F]">
                        {transaction.title}
                      </h3>
                      <p className="truncate text-xs text-[#86868B]">
                        {formatAccountLabel(transaction.account)} • {transaction.category} • {transaction.date}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          onCredit
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-[#F2F2F7] text-[#6E6E73]"
                        }`}
                      >
                        {onCredit
                          ? "Crédito • entra na fatura"
                          : isIncome
                            ? "Entrada no saldo"
                            : "Saiu da conta • impacto imediato"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`whitespace-nowrap text-sm font-semibold ${
                      isIncome ? "text-emerald-600" : "text-[#1D1D1F]"
                    }`}
                  >
                    {isIncome ? "+" : "−"} R$ {formatCurrency(transaction.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "credit";
}) {
  const toneClass = {
    neutral: "text-[#1D1D1F]",
    positive: "text-emerald-700",
    negative: "text-rose-600",
    credit: "text-indigo-700",
  }[tone];

  return (
    <div className="rounded-xl bg-[#F7F7F9] p-3">
      <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#86868B]">
        {label}
      </span>
      <strong className={`mt-1 block text-xs font-semibold sm:text-sm ${toneClass}`}>
        {value}
      </strong>
    </div>
  );
}
