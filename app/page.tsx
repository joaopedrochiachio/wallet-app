"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { InteractiveCard } from "@/components/ui/InteractiveCard";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { ListGroup, ListItem } from "@/components/ui/iOSList";
import {
  Utensils,
  Tv,
  Briefcase,
  Laptop,
  Sparkles,
  ChevronRight,
  Plus,
  CreditCard,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const {
    cards,
    activeCard,
    selectCard,
    updateCardLimit,
    payInvoice,
    transactions,
    addTransaction,
    monthIncome,
    monthExpense,
    totalInvoices,
  } = useWallet();

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

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="min-h-full bg-[#F2F2F7] p-6 md:p-10 text-[#1D1D1F] font-sans space-y-8 animate-in fade-in duration-500 relative">
      {/* Header Estilo iOS com Botão Adicionar (Quick Action) */}
      <header className="flex justify-between items-end max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Setembro 2026
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Carteira
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSheetOpen(true)}
            className="w-10 h-10 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center shadow-sm hover:bg-black active:scale-95 transition-all"
            title="Novo Lançamento"
          >
            <Plus strokeWidth={2} size={18} />
          </button>

          <div className="hidden sm:flex flex-col items-end text-xs">
            <span className="font-semibold text-[#1D1D1F]">Carlos Almeida</span>
            <span className="text-[#86868B]">Conta Principal</span>
          </div>
          <div className="w-10 h-10 bg-[#E5E5EA] text-[#1D1D1F] font-semibold text-xs rounded-full flex items-center justify-center border border-black/5 shadow-xs">
            CA
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Cartão 3D Interativo com Seletor de Cartões e Ajuste de Limite */}
        <section>
          <InteractiveCard
            card={activeCard}
            allCards={cards}
            onSelectCard={selectCard}
            onUpdateLimit={updateCardLimit}
            onAddClick={() => setIsSheetOpen(true)}
            onPayInvoice={() => payInvoice(activeCard.id)}
          />
        </section>

        {/* Resumo Dinâmico Conectado ao WalletContext */}
        <section className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200/60 gap-4 sm:gap-0">
            <div className="sm:px-4 first:pl-0 flex flex-col justify-between space-y-1">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#86868B]">
                Entradas
              </span>
              <div className="text-xl font-semibold text-green-600 tracking-tight">
                + R$ {formatCurrency(monthIncome)}
              </div>
              <span className="text-[11px] text-[#86868B]">Mês atual</span>
            </div>

            <div className="sm:px-6 pt-4 sm:pt-0 flex flex-col justify-between space-y-1">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#86868B]">
                Saídas Totais
              </span>
              <div className="text-xl font-semibold text-[#1D1D1F] tracking-tight">
                - R$ {formatCurrency(monthExpense)}
              </div>
              <span className="text-[11px] text-[#86868B]">Fluxo consolidado</span>
            </div>

            <div className="sm:px-6 pt-4 sm:pt-0 flex flex-col justify-between space-y-1">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#86868B]">
                Faturas Abertas
              </span>
              <div className="text-xl font-semibold text-[#1D1D1F] tracking-tight">
                R$ {formatCurrency(totalInvoices)}
              </div>
              <span className="text-[11px] text-[#86868B]">Nubank + Santander</span>
            </div>
          </div>
        </section>

        {/* Lançamentos Recentes em Tempo Real */}
        <section className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
              Lançamentos Recentes
            </h2>
            <Link
              href="/transactions"
              className="text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] flex items-center gap-0.5 transition-colors"
            >
              Ver tudo <ChevronRight strokeWidth={1.5} size={14} />
            </Link>
          </div>

          <ListGroup>
            {recentTransactions.map((tx, idx) => (
              <ListItem
                key={tx.id}
                title={tx.title}
                subtitle={`${tx.category} • ${tx.date}`}
                amount={`${tx.type === "receita" ? "+" : "-"} R$ ${formatCurrency(tx.amount)}`}
                isIncome={tx.type === "receita"}
                badge={tx.account}
                icon={getTransactionIcon(tx.category)}
                isLast={idx === recentTransactions.length - 1}
              />
            ))}
          </ListGroup>
        </section>

        {/* Metas em Andamento */}
        <section className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
              Metas
            </h2>
            <Link
              href="/goals"
              className="text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] flex items-center gap-0.5 transition-colors"
            >
              Nova meta <ChevronRight strokeWidth={1.5} size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
                    <Laptop strokeWidth={1.5} size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1D1D1F]">
                      MacBook Pro M3
                    </h3>
                    <p className="text-xs text-[#86868B]">Equipamento</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F2F2F7] text-[#86868B]">
                  80%
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="w-full h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
                  <div className="h-full bg-[#1D1D1F] rounded-full w-[80%]" />
                </div>
                <div className="flex justify-between items-center text-xs text-[#86868B]">
                  <span>R$ 11.200,00</span>
                  <span>Meta: R$ 14.000,00</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
                    <Sparkles strokeWidth={1.5} size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1D1D1F]">
                      Tênis Nike SB
                    </h3>
                    <p className="text-xs text-[#86868B]">Lifestyle</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F2F2F7] text-[#86868B]">
                  72%
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="w-full h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
                  <div className="h-full bg-[#1D1D1F] rounded-full w-[72%]" />
                </div>
                <div className="flex justify-between items-center text-xs text-[#86868B]">
                  <span>R$ 650,00</span>
                  <span>Meta: R$ 900,00</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Modal Bottom Sheet de Novo Lançamento Conectado */}
      <AddTransactionSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        accounts={["Débito/Pix", "Nubank", "Santander"]}
        onAdd={addTransaction}
      />
    </div>
  );
}