"use client";

import { useState } from "react";
import { TransactionItem, CardItem, useWallet } from "@/context/WalletContext";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { TransactionDetailsSheet } from "@/components/ui/TransactionDetailsSheet";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { getPeriodKey, MONTH_NAMES_PT } from "@/lib/utils/dateUtils";
import { formatAccountLabel, matchesLedgerCard } from "@/lib/utils/ledger";
import {
  Briefcase,
  Building2,
  Car,
  CreditCard,
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
            className={`text-sm sm:text-[15px] font-semibold tracking-tight block ${
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
            className="w-7 h-7 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#E5E5EA]/70 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
            title="Ações do lançamento"
            aria-label={`Opções para ${item.title}`}
          >
            <MoreHorizontal size={15} strokeWidth={1.75} />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-36 bg-white/95 backdrop-blur-xl border border-black/[0.08] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors text-left cursor-pointer"
                >
                  <Pencil size={12} strokeWidth={1.75} className="text-[#86868B]" />
                  <span>Editar</span>
                </button>
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
  const monthOptions = [-1, 0, 1].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return {
      label: MONTH_NAMES_PT[date.getMonth()],
      periodKey: getPeriodKey(date.getFullYear(), date.getMonth()),
    };
  });
  const [selectedMonth, setSelectedMonth] = useState(
    getPeriodKey(now.getFullYear(), now.getMonth())
  );
  const [selectedFilter, setSelectedFilter] = useState("Todas");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<TransactionItem | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionItem | null>(null);
  const [openTransactionInEditMode, setOpenTransactionInEditMode] = useState(false);

  const openTransactionDetails = (
    transaction: TransactionItem,
    editMode = false
  ) => {
    setOpenTransactionInEditMode(editMode);
    setSelectedTransaction(transaction);
  };

  const filteredTransactions = transactions.filter((transaction) => {
    if (transaction.kind === "invoice_settlement") return false;
    const rawDate = transaction.occurredAt || transaction.createdAt;
    const occurredAt = rawDate ? new Date(rawDate) : null;
    const belongsToMonth =
      occurredAt && !Number.isNaN(occurredAt.getTime())
        ? getPeriodKey(occurredAt.getFullYear(), occurredAt.getMonth()) ===
          selectedMonth
        : selectedMonth === getPeriodKey(now.getFullYear(), now.getMonth());
    const belongsToAccount =
      selectedFilter === "Todas" || transaction.account === selectedFilter;
    return belongsToMonth && belongsToAccount;
  });

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
    <div className="min-h-full bg-[#F2F2F7] p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500">
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

          {/* Botão Secundário Elegante: + Nova Transação */}
          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            className="bg-white hover:bg-[#F2F2F7] active:scale-[0.98] text-[#1D1D1F] text-xs font-semibold px-3.5 py-2 rounded-full border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all flex items-center gap-1.5 cursor-pointer select-none"
          >
            <Plus strokeWidth={2} size={14} />
            <span>Nova Transação</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* 2. BARRA DE FILTROS POR CONTA/CARTÃO (Chips Discretos e Contador Silencioso) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          {/* Filtros por Conta/Cartão (Sem preto sólido pesado) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
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
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-black/[0.08]"
                      : "text-[#86868B] hover:text-[#1D1D1F] bg-[#E5E5EA]/40 hover:bg-[#E5E5EA]/70 border border-transparent font-medium"
                  }`}
                >
                  {filter === "Todas" ? filter : formatAccountLabel(filter)}
                </button>
              );
            })}
          </div>

          {/* Contador Editorial */}
          <span className="text-xs text-[#86868B] font-normal shrink-0">
            {filteredTransactions.length}{" "}
            {filteredTransactions.length === 1 ? "lançamento" : "lançamentos"} em{" "}
            {activeMonthName}
          </span>
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
                Não foram encontrados lançamentos para o filtro selecionado em {activeMonthName}.
              </p>
              {selectedFilter !== "Todas" && (
                <button
                  type="button"
                  onClick={() => setSelectedFilter("Todas")}
                  className="mt-2 inline-flex items-center text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#1D1D1F] text-white hover:bg-black transition-colors cursor-pointer"
                >
                  Ver todas as contas
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
        onAdd={addTransaction}
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
          onSave={updateTransaction}
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
    </div>
  );
}
