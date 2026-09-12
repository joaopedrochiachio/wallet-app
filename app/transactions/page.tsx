"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { ListGroup, ListItem } from "@/components/ui/iOSList";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import {
  Briefcase,
  Utensils,
  CreditCard,
  Plus,
  Filter,
  ShoppingBag,
  Tv,
} from "lucide-react";

export default function TransactionsPage() {
  const { transactions, addTransaction, accountOptions } = useWallet();
  const [selectedMonth, setSelectedMonth] = useState("Setembro");
  const [selectedFilter, setSelectedFilter] = useState("Todas");
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getTransactionIcon = (category: string) => {
    if (category.includes("Alimentação")) return <Utensils strokeWidth={1.5} size={16} />;
    if (category.includes("Lazer")) return <Tv strokeWidth={1.5} size={16} />;
    if (category.includes("Serviços") || category.includes("Renda")) return <Briefcase strokeWidth={1.5} size={16} />;
    if (category.includes("Cartão")) return <CreditCard strokeWidth={1.5} size={16} />;
    return <ShoppingBag strokeWidth={1.5} size={16} />;
  };

  const filteredTransactions = transactions.filter((t) => {
    if (selectedFilter === "Todas") return true;
    return t.account === selectedFilter;
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
            className="text-xs font-semibold text-[#1D1D1F] hover:underline flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-black/[0.04] shadow-2xs"
          >
            <Plus strokeWidth={1.5} size={14} /> Nova Transação
          </button>
        </div>

        {/* Lista de Transações (Componente iOSList) */}
        <ListGroup>
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#86868B]">
              Nenhum lançamento encontrado para este filtro.
            </div>
          ) : (
            filteredTransactions.map((item, index) => (
              <ListItem
                key={item.id}
                title={item.title}
                subtitle={`${item.category} • ${item.date}`}
                amount={`${item.type === "receita" ? "+" : "-"} R$ ${formatCurrency(item.amount)}`}
                isIncome={item.type === "receita"}
                icon={getTransactionIcon(item.category)}
                badge={item.account}
                isLast={index === filteredTransactions.length - 1}
              />
            ))
          )}
        </ListGroup>
      </div>

      {/* Modal de Inserção Integrado */}
      <AddTransactionSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        accounts={accountOptions}
        onAdd={addTransaction}
      />
    </div>
  );
}
