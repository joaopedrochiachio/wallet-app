"use client";

import { useState } from "react";
import { TransactionItem, useWallet } from "@/context/WalletContext";
import { ListGroup, ListItem } from "@/components/ui/iOSList";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { TransactionDetailsSheet } from "@/components/ui/TransactionDetailsSheet";
import { getPeriodKey, MONTH_NAMES_PT } from "@/lib/utils/dateUtils";
import { formatAccountLabel, matchesLedgerCard } from "@/lib/utils/ledger";
import {
  Briefcase,
  Utensils,
  CreditCard,
  Plus,
  Filter,
  ShoppingBag,
  Tv,
  Trash2,
} from "lucide-react";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";

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
  const [selectedMonth, setSelectedMonth] = useState(getPeriodKey(now.getFullYear(), now.getMonth()));
  const [selectedFilter, setSelectedFilter] = useState("Todas");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<TransactionItem | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionItem | null>(null);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getTransactionIcon = (category: string) => {
    if (category.includes("Alimentação")) return <Utensils strokeWidth={1.5} size={16} />;
    if (category.includes("Lazer")) return <Tv strokeWidth={1.5} size={16} />;
    if (category.includes("Serviços") || category.includes("Renda")) return <Briefcase strokeWidth={1.5} size={16} />;
    if (category.includes("Cartão")) return <CreditCard strokeWidth={1.5} size={16} />;
    return <ShoppingBag strokeWidth={1.5} size={16} />;
  };

  const filteredTransactions = transactions.filter((transaction) => {
    if (transaction.kind === "invoice_settlement") return false;
    const rawDate = transaction.occurredAt || transaction.createdAt;
    const occurredAt = rawDate ? new Date(rawDate) : null;
    const belongsToMonth = occurredAt && !Number.isNaN(occurredAt.getTime())
      ? getPeriodKey(occurredAt.getFullYear(), occurredAt.getMonth()) === selectedMonth
      : selectedMonth === getPeriodKey(now.getFullYear(), now.getMonth());
    const belongsToAccount = selectedFilter === "Todas" || transaction.account === selectedFilter;
    return belongsToMonth && belongsToAccount;
  });

  return (
    <div className="min-h-full bg-[#F2F2F7] p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500">
      {/* Header com Seletor de Mês (iOS Segmented Control) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Histórico de Lançamentos
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Transações
          </h1>
        </div>

        {/* Mês Segmented Control */}
        <div className="bg-[#E5E5EA]/70 p-1 rounded-full flex items-center gap-1 self-start sm:self-auto border border-black/5">
          {monthOptions.map((month) => (
            <button
              key={month.periodKey}
              onClick={() => setSelectedMonth(month.periodKey)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedMonth === month.periodKey
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              {month.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Filtros Rápidos (Pills Minimalistas estilo iOS) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="text-xs font-semibold text-[#86868B] mr-1 flex items-center gap-1 shrink-0">
            <Filter strokeWidth={1.5} size={13} />
            <span>Filtro:</span>
          </div>
          {["Todas", ...accountOptions].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all ${
                selectedFilter === filter
                  ? "bg-[#1D1D1F] text-white shadow-xs"
                  : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-black/[0.04]"
              }`}
            >
              {filter === "Todas" ? filter : formatAccountLabel(filter)}
            </button>
          ))}
        </div>

        {/* Resumo de Transações Filtradas e Botão de Ação */}
        <div className="flex justify-between items-center px-1 text-xs text-[#86868B]">
          <span>
            Exibindo <strong className="text-[#1D1D1F]">{filteredTransactions.length}</strong> lançamentos em {monthOptions.find((month) => month.periodKey === selectedMonth)?.label}
          </span>
          <button
            onClick={() => setIsSheetOpen(true)}
            className="text-xs font-semibold text-[#1D1D1F] hover:underline flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-black/[0.04] shadow-2xs cursor-pointer"
          >
            <Plus strokeWidth={1.5} size={14} /> Nova Transação
          </button>
        </div>

        {/* Lista de Transações (Componente iOSList com Cloud Firestore) */}
        <ListGroup>
          {!isDataLoaded ? (
            <div className="py-12 text-center text-xs text-[#86868B]">
              Sincronizando lançamentos com Cloud Firestore...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#86868B]">
              Nenhum lançamento encontrado para este filtro.
            </div>
          ) : (
            filteredTransactions.map((item, index) => (
              <ListItem
                key={item.id || index}
                title={item.title}
                subtitle={`${item.category} • ${typeof item.date === "string" ? item.date : new Date(item.date).toLocaleDateString("pt-BR")}`}
                amount={`${item.type === "receita" ? "+" : "-"} R$ ${formatCurrency(item.amount)}`}
                isIncome={item.type === "receita"}
                icon={getTransactionIcon(item.category)}
                badge={formatAccountLabel(item.account)}
                badgeTone={cards.some((card) =>
                  card.type === "credit" && matchesLedgerCard(card, item.account, item.cardId)
                ) ? "credit" : "account"}
                isLast={index === filteredTransactions.length - 1}
                onClick={() => setSelectedTransaction(item)}
                rightElement={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTxToDelete(item);
                    }}
                    className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
                    title="Excluir Lançamento"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                }
              />
            ))
          )}
        </ListGroup>
      </div>

      {/* Modal de Inserção Integrado ao Firestore */}
      <AddTransactionSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        accounts={accountOptions}
        onAdd={addTransaction}
      />

      {selectedTransaction && (
        <TransactionDetailsSheet
          key={selectedTransaction.id}
          transaction={selectedTransaction}
          accounts={accountOptions}
          cards={cards}
          onClose={() => setSelectedTransaction(null)}
          onSave={updateTransaction}
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
              alert(error instanceof Error ? error.message : "Não foi possível excluir o lançamento.");
            }
          }
        }}
        title="Excluir Lançamento"
        description={`Tem certeza que deseja remover "${txToDelete?.title}" no valor de R$ ${txToDelete ? formatCurrency(txToDelete.amount) : ""}? Esta ação recalculará o saldo disponível.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />
    </div>
  );
}
