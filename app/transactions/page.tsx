"use client";

import { useState } from "react";
import Link from "next/link";
import { TransactionItem, CardItem, useWallet } from "@/context/WalletContext";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { TransactionDetailsSheet } from "@/components/ui/TransactionDetailsSheet";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { StatementImportModal } from "@/components/import/StatementImportModal";
import { getPeriodKey, MONTH_NAMES_PT } from "@/lib/utils/dateUtils";
import { formatAccountLabel, matchesLedgerCard } from "@/lib/utils/ledger";
import {
  Briefcase,
  Building2,
  Car,
  CreditCard,
  FileText,
  Filter,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  Tv,
  Utensils,
  ArrowDownLeft,
  Target,
  Search,
  X,
  RotateCcw,
} from "lucide-react";

interface DayGroup {
  dateKey: string;
  label: string;
  items: TransactionItem[];
}

const formatCurrency = (val: number) =>
  val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getTransactionDate(tx: TransactionItem): Date {
  if (tx.occurredAt) {
    const d = new Date(tx.occurredAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (tx.createdAt) {
    const d = new Date(tx.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (tx.date) {
    if (/^\d{4}-\d{2}-\d{2}/.test(tx.date)) {
      const d = new Date(tx.date);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(tx.date)) {
      const [day, month, year] = tx.date.split("/");
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

function formatDayGroupLabel(date: Date): string {
  const now = new Date();
  const isSameYear = date.getFullYear() === now.getFullYear();
  const isToday =
    isSameYear &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate();

  if (isToday) return "Hoje";
  if (isYesterday) return "Ontem";

  const day = date.getDate();
  const monthName = MONTH_NAMES_PT[date.getMonth()].toLowerCase();
  if (isSameYear) {
    return `${day} de ${monthName}`;
  }
  return `${day} de ${monthName} de ${date.getFullYear()}`;
}

function formatTimeOrDate(date: Date): string | null {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours !== 0 || minutes !== 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return null;
}

function getTransactionIcon(category: string, type: "despesa" | "receita") {
  if (type === "receita") return <ArrowDownLeft strokeWidth={1.5} size={15} />;
  const cat = category.toLowerCase();
  if (cat.includes("alimenta") || cat.includes("delivery") || cat.includes("restaurante")) {
    return <Utensils strokeWidth={1.5} size={15} />;
  }
  if (cat.includes("supermercado")) {
    return <ShoppingBag strokeWidth={1.5} size={15} />;
  }
  if (cat.includes("transporte") || cat.includes("combustível") || cat.includes("uber")) {
    return <Car strokeWidth={1.5} size={15} />;
  }
  if (cat.includes("moradia") || cat.includes("contas") || cat.includes("aluguel")) {
    return <Building2 strokeWidth={1.5} size={15} />;
  }
  if (cat.includes("lazer") || cat.includes("assinatura") || cat.includes("streaming")) {
    return <Tv strokeWidth={1.5} size={15} />;
  }
  if (cat.includes("saúde") || cat.includes("farmácia")) {
    return <HeartPulse strokeWidth={1.5} size={15} />;
  }
  if (cat.includes("serviço") || cat.includes("trabalho") || cat.includes("projeto") || cat.includes("renda")) {
    return <Briefcase strokeWidth={1.5} size={15} />;
  }
  if (cat.includes("cartão")) {
    return <CreditCard strokeWidth={1.5} size={15} />;
  }
  if (cat.includes("meta") || cat.includes("investimento") || cat.includes("reserva")) {
    return <Target strokeWidth={1.5} size={15} />;
  }
  return <ShoppingBag strokeWidth={1.5} size={15} />;
}

function TransactionRow({
  item,
  cards,
  onSelect,
  onEdit,
  onDelete,
}: {
  item: TransactionItem;
  cards: CardItem[];
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isGoalMovement = item.groupId?.startsWith("goal-");
  const isInvoicePayment = item.kind === "invoice_payment" || item.kind === "invoice_settlement";
  const canEdit = !isGoalMovement && (!item.kind || item.kind === "regular");
  const txDate = getTransactionDate(item);
  const timeStr = formatTimeOrDate(txDate);
  const isIncome = item.type === "receita";
  const isCredit = cards.some(
    (card) =>
      card.type === "credit" &&
      matchesLedgerCard(card, item.account, item.cardId)
  );

  const metaParts: string[] = [];
  if (item.category) metaParts.push(item.category);
  if (timeStr) metaParts.push(timeStr);
  metaParts.push(formatAccountLabel(item.account));

  return (
    <div
      onClick={onSelect}
      className="group relative flex items-center justify-between gap-4 px-5 sm:px-6 py-3.5 sm:py-4 transition-colors hover:bg-black/[0.015] cursor-pointer select-none"
    >
      {/* Lado Esquerdo: Ícone Discreto + Título & Metadados */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="w-8.5 h-8.5 rounded-full bg-[#F2F2F7] text-[#1D1D1F]/70 flex items-center justify-center shrink-0">
          {getTransactionIcon(item.category, item.type)}
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="text-sm font-medium text-[#1D1D1F] tracking-tight truncate">
            {item.title}
          </h3>
          <p className="text-xs text-[#86868B] truncate">
            {metaParts.join(" · ")}
          </p>
        </div>
      </div>

      {/* Lado Direito: Valor + Menu de Ações no Hover */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <span
            className={`text-sm sm:text-[15px] font-semibold tracking-tight block font-mono tabular-nums ${
              isIncome ? "text-emerald-600" : "text-[#1D1D1F]"
            }`}
          >
            {isIncome ? "+ " : "− "}R$ {formatCurrency(item.amount)}
          </span>
          <span className="text-[10px] text-[#86868B] font-normal block">
            {isIncome ? "Entrada" : isCredit ? "Fatura" : "Débito"}
          </span>
        </div>

        {/* Menu Contextual ••• (Aparece suavemente no hover em desktop) */}
        <div
          className="relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="w-8 h-8 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#E5E5EA]/70 transition-all flex items-center justify-center opacity-70 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
            title="Ações do lançamento"
            aria-label={`Opções para ${item.title}`}
          >
            <MoreHorizontal size={16} strokeWidth={1.75} />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-36 bg-white/95 backdrop-blur-xl border border-black/[0.08] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                {isGoalMovement || isInvoicePayment ? <Link href={isGoalMovement ? "/goals" : "/cards"} className="block rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#1D1D1F] hover:bg-[#F2F2F7]">
                  {isGoalMovement ? "Abrir Metas" : "Abrir faturas"}
                </Link> : <>
                {canEdit && <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors text-left cursor-pointer"
                >
                  <Pencil size={12} strokeWidth={1.75} className="text-[#86868B]" />
                  <span>Editar</span>
                </button>}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                >
                  <Trash2 size={12} strokeWidth={1.75} className="text-rose-500" />
                  <span>Excluir</span>
                </button>
                </>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const {
    accountOptions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    transactions,
    cards,
    isDataLoaded,
  } = useWallet();
  const now = new Date();
  const currentPeriodKey = getPeriodKey(now.getFullYear(), now.getMonth());

  // Coleta dinamicamente meses com lançamentos mais uma janela ampla ao redor do mês atual (-4 a +1)
  const dynamicPeriodKeys = new Set<string>();
  for (let offset = -4; offset <= 1; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    dynamicPeriodKeys.add(getPeriodKey(d.getFullYear(), d.getMonth()));
  }
  transactions.forEach((tx) => {
    const d = getTransactionDate(tx);
    dynamicPeriodKeys.add(getPeriodKey(d.getFullYear(), d.getMonth()));
  });

  const monthOptions = Array.from(dynamicPeriodKeys)
    .sort()
    .map((key) => {
      const [yStr, mStr] = key.split("-");
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10) - 1;
      const isCurrentYear = year === now.getFullYear();
      return {
        periodKey: key,
        label: isCurrentYear
          ? MONTH_NAMES_PT[month]
          : `${MONTH_NAMES_PT[month].slice(0, 3)}/${String(year).slice(-2)}`,
        year,
        month,
      };
    });

  const [selectedMonth, setSelectedMonth] = useState(currentPeriodKey);
  const [selectedFilter, setSelectedFilter] = useState("Todas");
  const [selectedType, setSelectedType] = useState<"all" | "receita" | "despesa">("all");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<TransactionItem | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionItem | null>(null);
  const [openTransactionInEditMode, setOpenTransactionInEditMode] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const openTransactionDetails = (
    transaction: TransactionItem,
    editMode = false
  ) => {
    setOpenTransactionInEditMode(editMode);
    setSaveFeedback(null);
    setSelectedTransaction(transaction);
  };

  // Transações do mês selecionado (base para extrair categorias disponíveis)
  const monthTransactions = transactions.filter((transaction) => {
    if (transaction.kind === "invoice_settlement") return false;
    const txDate = getTransactionDate(transaction);
    return getPeriodKey(txDate.getFullYear(), txDate.getMonth()) === selectedMonth;
  });

  const categoryOptions = Array.from(
    new Set(
      monthTransactions
        .map((tx) => tx.category?.trim())
        .filter((cat): cat is string => Boolean(cat))
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("pt-BR");

  const filteredTransactions = monthTransactions.filter((transaction) => {
    const belongsToAccount =
      selectedFilter === "Todas" || transaction.account === selectedFilter;
    const belongsToType =
      selectedType === "all" || transaction.type === selectedType;
    const belongsToCategory =
      selectedCategory === "Todas" || transaction.category === selectedCategory;
    const matchesSearch =
      !normalizedQuery ||
      transaction.title.toLocaleLowerCase("pt-BR").includes(normalizedQuery) ||
      (transaction.category || "").toLocaleLowerCase("pt-BR").includes(normalizedQuery) ||
      (transaction.account || "").toLocaleLowerCase("pt-BR").includes(normalizedQuery);

    return belongsToAccount && belongsToType && belongsToCategory && matchesSearch;
  });

  const hasActiveFilters =
    selectedFilter !== "Todas" ||
    selectedType !== "all" ||
    selectedCategory !== "Todas" ||
    normalizedQuery.length > 0;

  const clearAllFilters = () => {
    setSelectedFilter("Todas");
    setSelectedType("all");
    setSelectedCategory("Todas");
    setSearchQuery("");
  };

  const filteredIncomesTotal = filteredTransactions
    .filter((tx) => tx.type === "receita")
    .reduce((acc, tx) => acc + tx.amount, 0);
  const filteredExpensesTotal = filteredTransactions
    .filter((tx) => tx.type === "despesa")
    .reduce((acc, tx) => acc + tx.amount, 0);

  // Agrupamento cronológico descendente por dia
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const dateA = getTransactionDate(a).getTime();
    const dateB = getTransactionDate(b).getTime();
    return dateB - dateA;
  });

  const groupsMap = new Map<string, { label: string; items: TransactionItem[] }>();

  for (const tx of sortedTransactions) {
    const txDate = getTransactionDate(tx);
    const dateKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(txDate.getDate()).padStart(2, "0")}`;

    if (!groupsMap.has(dateKey)) {
      groupsMap.set(dateKey, {
        label: formatDayGroupLabel(txDate),
        items: [],
      });
    }
    groupsMap.get(dateKey)!.items.push(tx);
  }

  const groupedTransactions: DayGroup[] = Array.from(groupsMap.entries()).map(
    ([dateKey, val]) => ({
      dateKey,
      label: val.label,
      items: val.items,
    })
  );

  const activeMonthName =
    monthOptions.find((m) => m.periodKey === selectedMonth)?.label || "Mês";

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500">
      {saveFeedback && <p role="status" className="mx-auto max-w-4xl text-sm text-emerald-700">{saveFeedback}</p>}
      {/* 1. CABEÇALHO (Eyebrow, Título Dominante e Controles macOS) */}
      <header className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Histórico de Lançamentos
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Transações
          </h1>
        </div>

        {/* Controles de Topo: Segmented Control do Mês + Botão Secundário Nova Transação */}
        <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto">
          {/* Mês Segmented Control (Padrão Apple idêntico ao Planejamento Mensal) */}
          <div className="bg-[#E5E5EA]/60 p-1 rounded-full flex items-center gap-0.5 border border-black/[0.04]">
            {monthOptions.map((month) => (
              <button
                key={month.periodKey}
                type="button"
                onClick={() => setSelectedMonth(month.periodKey)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all select-none cursor-pointer ${
                  selectedMonth === month.periodKey
                    ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                {month.label}
              </button>
            ))}
          </div>

          {/* Botão Importar Extrato PDF */}
          <button
            type="button"
            onClick={() => setIsStatementModalOpen(true)}
            className="bg-white hover:bg-[#F2F2F7] active:scale-[0.98] text-[#1D1D1F] text-xs font-semibold px-3.5 py-2 rounded-full border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all flex items-center gap-1.5 cursor-pointer select-none"
            data-testid="transactions-import-statement-btn"
          >
            <FileText strokeWidth={2} size={13} />
            <span>Importar Extrato PDF</span>
          </button>

          {/* Botão Secundário Elegante: + Nova Transação */}
          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-3.5 py-2 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all flex items-center gap-1.5 cursor-pointer select-none"
          >
            <Plus strokeWidth={2} size={14} />
            <span>Nova Transação</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* 2. PAINEL DE FILTROS COMPLETO (Busca, Tipo, Categoria e Conta/Cartão) */}
        <div className="bg-white rounded-[22px] p-4 border border-black/[0.04] shadow-[0_1px_4px_rgba(0,0,0,0.02)] space-y-3">
          {/* Linha 1: Busca por texto + Seletor de Tipo (Todos / Entradas / Saídas) + Seletor de Categoria */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, categoria ou conta..."
                className="w-full bg-[#F2F2F7] focus:bg-white rounded-xl pl-9 pr-8 py-2 text-xs text-[#1D1D1F] placeholder:text-[#86868B] outline-none border border-transparent focus:border-black/15 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] p-0.5 cursor-pointer"
                  title="Limpar busca"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filtro de Tipo (Segmented Control) */}
            <div className="bg-[#F2F2F7] p-1 rounded-xl flex items-center gap-0.5 shrink-0">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "receita", label: "Entradas" },
                  { id: "despesa", label: "Saídas" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedType === t.id
                      ? "bg-white text-[#1D1D1F] shadow-2xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filtro de Categoria */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#F2F2F7] hover:bg-[#E5E5EA]/80 rounded-xl px-3 py-2 text-xs font-medium text-[#1D1D1F] outline-none border border-transparent focus:border-black/15 cursor-pointer shrink-0"
              aria-label="Filtrar por categoria"
            >
              <option value="Todas">Categoria: Todas</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Linha 2: Filtro por Conta/Cartão + Contador e Resumo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-black/[0.04]">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none touch-pan-x">
              <span className="text-xs text-[#86868B] font-medium mr-1 shrink-0 flex items-center gap-1">
                <Filter strokeWidth={1.75} size={12} />
                <span>Conta:</span>
              </span>
              {["Todas", ...accountOptions].map((filter) => {
                const isSelected = selectedFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs transition-all shrink-0 select-none cursor-pointer ${
                      isSelected
                        ? "bg-[#1D1D1F] text-white font-semibold shadow-2xs"
                        : "text-[#86868B] hover:text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] font-medium"
                    }`}
                  >
                    {filter === "Todas" ? filter : formatAccountLabel(filter)}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 text-xs">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Limpar filtros</span>
                </button>
              )}

              <span className="text-[#86868B] font-normal">
                {filteredTransactions.length}{" "}
                {filteredTransactions.length === 1 ? "lançamento" : "lançamentos"}
                {filteredIncomesTotal > 0 && (
                  <span className="text-emerald-600 font-medium font-mono tabular-nums ml-2">
                    +R$ {formatCurrency(filteredIncomesTotal)}
                  </span>
                )}
                {filteredExpensesTotal > 0 && (
                  <span className="text-[#1D1D1F] font-medium font-mono tabular-nums ml-2">
                    −R$ {formatCurrency(filteredExpensesTotal)}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 3. SUPERFÍCIE ÚNICA DE TRANSAÇÕES (Estilo Apple Wallet / Ajustes) */}
        <div className="bg-white rounded-[24px] border border-black/[0.04] shadow-[0_1px_6px_rgba(0,0,0,0.02)] overflow-hidden">
          {!isDataLoaded ? (
            <div className="py-16 text-center text-xs text-[#86868B]">
              Sincronizando lançamentos com Cloud Firestore...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-1.5">
              <p className="text-sm font-semibold text-[#1D1D1F]">
                Nenhum lançamento encontrado
              </p>
              <p className="text-xs text-[#86868B] max-w-sm mx-auto">
                Não foram encontrados lançamentos para os filtros selecionados em {activeMonthName}.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-2 inline-flex items-center text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#1D1D1F] text-white hover:bg-black transition-colors cursor-pointer"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          ) : (
            <div>
              {groupedTransactions.map((group, groupIndex) => (
                <div
                  key={group.dateKey}
                  className={groupIndex > 0 ? "border-t border-black/[0.04]" : ""}
                >
                  {/* Divisor Discreto de Data */}
                  <div className="px-5 sm:px-6 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]/90">
                    {group.label}
                  </div>

                  {/* Lançamentos do Dia */}
                  <div className="divide-y divide-black/[0.035]">
                    {group.items.map((item) => (
                      <TransactionRow
                        key={item.id}
                        item={item}
                        cards={cards}
                        onSelect={() => openTransactionDetails(item)}
                        onEdit={() => openTransactionDetails(item, true)}
                        onDelete={() => setTxToDelete(item)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Inserção */}
      <AddTransactionSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        accounts={accountOptions}
        onAdd={async (tx) => {
          await addTransaction(tx);
          if (tx.occurredAt) {
            const d = new Date(tx.occurredAt);
            if (!Number.isNaN(d.getTime())) {
              setSelectedMonth(getPeriodKey(d.getFullYear(), d.getMonth()));
            }
          }
        }}
      />

      {/* Modal / Sheet Detalhes da Transação */}
      {selectedTransaction && (
        <TransactionDetailsSheet
          key={selectedTransaction.id}
          transaction={selectedTransaction}
          accounts={accountOptions}
          cards={cards}
          initialEditing={openTransactionInEditMode}
          onClose={() => {
            setSelectedTransaction(null);
            setOpenTransactionInEditMode(false);
          }}
          onSave={async (id, updates) => {
            await updateTransaction(id, updates);
            setSaveFeedback("Lançamento atualizado.");
          }}
          onDelete={(tx) => {
            setSelectedTransaction(null);
            setTxToDelete(tx);
          }}
        />
      )}

      {/* Modal de Confirmação para Excluir Lançamento */}
      <AppleConfirmModal
        isOpen={!!txToDelete}
        onClose={() => setTxToDelete(null)}
        onConfirm={async () => {
          if (txToDelete?.id) {
            try {
              await deleteTransaction(txToDelete.id);
              setTxToDelete(null);
            } catch (error) {
              alert(
                error instanceof Error
                  ? error.message
                  : "Não foi possível excluir o lançamento."
              );
            }
          }
        }}
        title="Excluir Lançamento"
        description={`Tem certeza que deseja remover "${txToDelete?.title}" no valor de R$ ${
          txToDelete ? formatCurrency(txToDelete.amount) : ""
        }? Esta ação recalculará o saldo disponível.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />

      {/* Modal de Importação Inteligente de Extrato PDF */}
      <StatementImportModal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        onImportedSuccess={({ confirmedTransactions }) => {
          if (confirmedTransactions.length > 0) {
            const firstDate = confirmedTransactions[0].date;
            const [yStr, mStr] = firstDate.split("-");
            const y = parseInt(yStr, 10);
            const m = parseInt(mStr, 10) - 1;
            if (!Number.isNaN(y) && !Number.isNaN(m)) {
              setSelectedMonth(getPeriodKey(y, m));
            }
          }
        }}
      />
    </div>
  );
}
