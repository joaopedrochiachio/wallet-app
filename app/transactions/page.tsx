"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { ListGroup, ListItem } from "@/components/ui/iOSList";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { subscribeToTransactions } from "@/lib/services/transactionsService";
import { Transaction } from "@/types";
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
  const { user } = useAuth();
  const { accountOptions, addTransaction, deleteTransaction } = useWallet();
  const [firestoreTransactions, setFirestoreTransactions] = useState<Transaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("Setembro");
  const [selectedFilter, setSelectedFilter] = useState("Todas");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Escuta em tempo real do Cloud Firestore (isolado pelo usuário autenticado)
  useEffect(() => {
    const unsubscribe = subscribeToTransactions((items) => {
      setFirestoreTransactions(items);
      setIsSyncing(false);
    }, user?.uid);
    return () => unsubscribe();
  }, [user]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getTransactionIcon = (category: string) => {
    if (category.includes("Alimentação")) return <Utensils strokeWidth={1.5} size={16} />;
    if (category.includes("Lazer")) return <Tv strokeWidth={1.5} size={16} />;
    if (category.includes("Serviços") || category.includes("Renda")) return <Briefcase strokeWidth={1.5} size={16} />;
    if (category.includes("Cartão")) return <CreditCard strokeWidth={1.5} size={16} />;
    return <ShoppingBag strokeWidth={1.5} size={16} />;
  };

  const filteredTransactions = firestoreTransactions.filter((t) => {
    if (selectedFilter === "Todas") return true;
    return t.paymentMethod === selectedFilter;
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
          {["Agosto", "Setembro", "Outubro"].map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedMonth === m
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              {m}
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
              {filter}
            </button>
          ))}
        </div>

        {/* Resumo de Transações Filtradas e Botão de Ação */}
        <div className="flex justify-between items-center px-1 text-xs text-[#86868B]">
          <span>
            Exibindo <strong className="text-[#1D1D1F]">{filteredTransactions.length}</strong> lançamentos em {selectedMonth}
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
          {isSyncing ? (
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
                title={item.description}
                subtitle={`${item.category} • ${typeof item.date === "string" ? item.date : new Date(item.date).toLocaleDateString("pt-BR")}`}
                amount={`${item.type === "in" ? "+" : "-"} R$ ${formatCurrency(item.amount)}`}
                isIncome={item.type === "in"}
                icon={getTransactionIcon(item.category)}
                badge={item.paymentMethod}
                isLast={index === filteredTransactions.length - 1}
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

      {/* Modal de Confirmação para Excluir Lançamento */}
      <AppleConfirmModal
        isOpen={!!txToDelete}
        onClose={() => setTxToDelete(null)}
        onConfirm={() => {
          if (txToDelete?.id) {
            deleteTransaction(txToDelete.id);
            setTxToDelete(null);
          }
        }}
        title="Excluir Lançamento"
        description={`Tem certeza que deseja remover "${txToDelete?.description}" no valor de R$ ${txToDelete ? formatCurrency(txToDelete.amount) : ""}? Esta ação recalculará o saldo disponível.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />
    </div>
  );
}
