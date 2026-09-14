"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { AddCardSheet } from "@/components/ui/AddCardSheet";
import { ListGroup, ListItem } from "@/components/ui/iOSList";
import {
  CardStack,
  WalletCard,
  WalletHeader,
  WalletActions,
} from "@/components/wallet";
import { WalletCardData, CardBrand } from "@/types/wallet";
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
  Target,
  ShieldCheck,
  Plane,
} from "lucide-react";
import Link from "next/link";
import { formatAccountLabel, matchesLedgerCard } from "@/lib/utils/ledger";

export default function DashboardPage() {
  const {
    userProfile,
    cards,
    activeCard,
    selectCard,
    addTransaction,
    addCard,
    accountOptions,
    mainBalance,
    goals,
    transactions,
    monthIncome,
    monthExpense,
    isDataLoaded,
  } = useWallet();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isCardSheetOpen, setIsCardSheetOpen] = useState(false);

  // Modo de visualização: Pilha 3D fluida vs Grade organizada
  const [is3DStackView, setIs3DStackView] = useState<boolean>(true);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const balanceIsPositive = mainBalance >= 0;

  const getTransactionIcon = (category: string) => {
    if (category.includes("Alimentação")) return <Utensils strokeWidth={1.5} size={16} />;
    if (category.includes("Lazer")) return <Tv strokeWidth={1.5} size={16} />;
    if (category.includes("Serviços") || category.includes("Renda")) return <Briefcase strokeWidth={1.5} size={16} />;
    if (category.includes("Cartão")) return <CreditCard strokeWidth={1.5} size={16} />;
    return <ShoppingBag strokeWidth={1.5} size={16} />;
  };

  const recentTransactions = transactions
    .filter((transaction) => transaction.kind !== "invoice_settlement")
    .slice(0, 5);

  // A conta principal controla o saldo; somente crédito aparece como cartão.
  const userWalletCards: WalletCardData[] = cards
    .filter((card) => card.type === "credit")
    .map((c, index) => {
      const isGlass = c.name.toLowerCase().includes("ultra") || index === 0;
      return {
        id: c.id,
        title: c.name,
        subtitle: `Fecha dia ${c.closingDay} • Vence dia ${c.dueDay}`,
        variant: isGlass ? "glass" : "bank",
        brand: (c.brand.toLowerCase().includes("visa")
          ? "visa"
          : c.brand.toLowerCase().includes("apple")
            ? "apple"
            : "mastercard") as CardBrand,
        type: c.type,
        balance: c.balance,
        limit: c.limit,
        spent: c.spent,
        cardNumber: `•••• •••• •••• ${c.id.slice(-4) || "8842"}`,
        holderName: userProfile.name,
        expirationDate: "09/31",
        background: c.colorScheme?.gradient,
        accentColor: c.colorScheme?.accent,
        isGlass,
        status: "active",
        closingDay: c.closingDay,
        dueDay: c.dueDay,
      };
    });

  // Cartão selecionado / em destaque
  const activeWalletCard: WalletCardData | undefined =
    userWalletCards.find((c) => c.id === activeCard.id) ||
    userWalletCards[0];

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-8 animate-in fade-in duration-500 relative">
      {/* 1. HEADER INTEGRADO DA CARTEIRA */}
      <WalletHeader
        onOpenNewTransaction={() => setIsSheetOpen(true)}
        onAddNewCard={() => setIsCardSheetOpen(true)}
        cardsCount={userWalletCards.length}
      />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* 2. PILHA 3D DE CARTÕES E GRADE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-[#1D1D1F]" />
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                {is3DStackView ? "Pilha 3D de Cartões" : "Cartão Principal & Cartões"}
              </h2>
            </div>

            {/* Alternador Pilha 3D vs Grade */}
            <div className="flex items-center gap-1 bg-[#E5E5EA]/80 p-1 rounded-full text-[11px] font-semibold border border-black/5">
              <button
                type="button"
                onClick={() => setIs3DStackView(true)}
                className={`px-3.5 py-1 rounded-full transition-all cursor-pointer ${
                  is3DStackView
                    ? "bg-white text-[#1D1D1F] shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                Pilha 3D
              </button>
              <button
                type="button"
                onClick={() => setIs3DStackView(false)}
                className={`px-3.5 py-1 rounded-full transition-all cursor-pointer ${
                  !is3DStackView
                    ? "bg-white text-[#1D1D1F] shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                Grade
              </button>
            </div>
          </div>

          {!isDataLoaded ? (
            <div className="bg-white/70 rounded-[32px] p-10 text-center text-xs text-[#86868B] border border-black/[0.04]">
              Sincronizando cartões com Cloud Firestore...
            </div>
          ) : userWalletCards.length === 0 ? (
            <div className="bg-white rounded-[32px] p-8 text-center space-y-3 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="w-10 h-10 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center mx-auto">
                <CreditCard size={20} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#1D1D1F]">Nenhum cartão cadastrado</h3>
                <p className="text-xs text-[#86868B]">Adicione seu primeiro cartão para começar.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCardSheetOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D1D1F] px-4 py-2 text-xs font-semibold text-white hover:bg-black"
              >
                <Plus size={14} />
                Adicionar primeiro cartão
              </button>
            </div>
          ) : is3DStackView ? (
            /* MODO PILHA 3D: interação por toque, clique, arraste e teclado */
            <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 sm:p-8 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <CardStack
                cards={userWalletCards}
                onSelectCard={(id) => selectCard(id)}
              />
              <p className="text-center text-[11px] text-[#86868B] font-medium mt-4">
                Toque na pilha para abrir. Depois, arraste os cartões para reorganizar ou toque em um para usá-lo.
              </p>
            </div>
          ) : (
            /* MODO GRADE: Cartão Principal em Destaque + Cartões Secundários */
            <div className="space-y-6">
              {/* Cartão Ativo / Principal */}
              {activeWalletCard && (
                <div className="flex justify-center">
                  <WalletCard
                    card={activeWalletCard}
                    onClick={() => selectCard(activeWalletCard.id)}
                  />
                </div>
              )}

              {/* Cartões Secundários */}
              {userWalletCards.length > 1 && activeWalletCard && (
                <div className="pt-2 space-y-3">
                  <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1">
                    Cartões Secundários
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {userWalletCards
                      .filter((c) => c.id !== activeWalletCard.id)
                      .slice(0, 2)
                      .map((secCard) => (
                        <div
                          key={secCard.id}
                          onClick={() => selectCard(secCard.id)}
                          className="cursor-pointer flex justify-center hover:scale-[1.02] transition-transform"
                        >
                          <WalletCard card={secCard} />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4. CONSOLIDADO FINANCEIRO */}
        <section className="space-y-2" data-testid="dashboard-consolidated">
          <div className="flex items-end justify-between px-1">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                Consolidado do mês
              </h2>
              <p className="mt-0.5 text-[11px] text-[#A1A1A6]">Somente valores realizados</p>
            </div>
            <span className="text-[11px] text-[#86868B]">Conta principal</span>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-black/[0.04] bg-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.035)] backdrop-blur-xl">
            <div className="grid grid-cols-2 sm:grid-cols-3">
              <div className="border-b border-r border-black/[0.05] p-3.5 sm:p-5 min-w-0 sm:border-b-0">
                <span className="text-[10px] font-medium text-[#86868B]">Entrou</span>
                <strong className="mt-1 block text-sm font-semibold text-emerald-600 sm:text-base truncate">
                  + R$ {formatCurrency(monthIncome)}
                </strong>
              </div>

              <div className="border-b border-black/[0.05] p-3.5 sm:p-5 min-w-0 sm:border-b-0 sm:border-r">
                <span className="text-[10px] font-medium text-[#86868B]">Saiu</span>
                <strong className="mt-1 block text-sm font-semibold text-[#1D1D1F] sm:text-base truncate">
                  − R$ {formatCurrency(monthExpense)}
                </strong>
              </div>

              <div className="col-span-2 bg-[#FAFAFC] p-3.5 sm:p-5 min-w-0 sm:col-span-1">
                <span className="text-[10px] font-medium text-[#86868B]">Tenho na conta</span>
                <strong
                  className={`mt-1 block text-lg sm:text-xl font-semibold tracking-tight truncate ${
                    balanceIsPositive ? "text-[#1D1D1F]" : "text-rose-600"
                  }`}
                >
                  {balanceIsPositive ? "" : "−"}R$ {formatCurrency(Math.abs(mainBalance))}
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* 4. LANÇAMENTOS RECENTES EM TEMPO REAL */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
              Lançamentos Recentes
            </h2>
            <Link
              href="/transactions"
              className="text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] flex items-center gap-0.5 transition-colors group"
            >
              <span>Ver tudo</span>
              <ChevronRight strokeWidth={1.5} size={13} className="text-[#86868B] group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <ListGroup>
            {!isDataLoaded ? (
              <div className="py-8 text-center text-xs text-[#86868B]">
                Sincronizando lançamentos com Cloud Firestore...
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#86868B]">
                Nenhum lançamento registrado recentemente.
              </div>
            ) : (
              recentTransactions.map((tx, idx) => {
                const accountLabel = formatAccountLabel(tx.account);
                const dateLabel = typeof tx.date === "string"
                  ? tx.date
                  : new Date(tx.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

                return (
                  <ListItem
                    key={tx.id || idx}
                    title={tx.title}
                    subtitle={`${tx.category} · ${accountLabel} · ${dateLabel}`}
                    amount={`${tx.type === "receita" ? "+ " : "− "}R$ ${formatCurrency(tx.amount)}`}
                    isIncome={tx.type === "receita"}
                    icon={getTransactionIcon(tx.category)}
                    isLast={idx === recentTransactions.length - 1}
                  />
                );
              })
            )}
          </ListGroup>
        </section>

        {/* 6. METAS EM ANDAMENTO CONECTADAS AO WALLETCONTEXT */}
        <section className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
              Metas em Andamento
            </h2>
            <Link
              href="/goals"
              className="text-xs font-semibold text-[#1D1D1F] hover:underline flex items-center gap-0.5 transition-colors"
            >
              Ver todas <ChevronRight strokeWidth={1.5} size={14} />
            </Link>
          </div>

          {goals.length === 0 ? (
            <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center mx-auto">
                <Target size={20} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#1D1D1F]">
                  Nenhuma meta cadastrada ainda
                </h3>
                <p className="text-xs text-[#86868B] max-w-sm mx-auto">
                  Crie objetivos patrimoniais como Reserva de Emergência ou Viagens para acompanhar o progresso aqui.
                </p>
              </div>
              <Link
                href="/goals"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-[#1D1D1F] text-white hover:bg-black transition-colors cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>Criar Primeira Meta</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.slice(0, 4).map((goal) => {
                const percentage = Math.min(
                  100,
                  goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0
                );

                const getGoalIcon = (cat: string) => {
                  const lower = cat.toLowerCase();
                  if (lower.includes("segurança") || lower.includes("reserva"))
                    return <ShieldCheck strokeWidth={1.5} size={16} />;
                  if (lower.includes("viagem") || lower.includes("lazer") || lower.includes("turismo"))
                    return <Plane strokeWidth={1.5} size={16} />;
                  if (lower.includes("trabalho") || lower.includes("computador") || lower.includes("equipamento"))
                    return <Laptop strokeWidth={1.5} size={16} />;
                  return <Sparkles strokeWidth={1.5} size={16} />;
                };

                return (
                  <Link
                    key={goal.id}
                    href="/goals"
                    className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] p-5 space-y-4 hover:border-black/15 transition-all block group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          {getGoalIcon(goal.category)}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[#1D1D1F] group-hover:text-black transition-colors">
                            {goal.title}
                          </h3>
                          <p className="text-xs text-[#86868B]">{goal.category}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F2F2F7] text-[#86868B]">
                        {percentage}%
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="w-full h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1D1D1F] rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs text-[#86868B]">
                        <span className="font-semibold text-[#1D1D1F]">
                          R$ {formatCurrency(goal.current)}
                        </span>
                        <span>Meta: R$ {formatCurrency(goal.target)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Modal Bottom Sheet de Novo Lançamento Conectado */}
      <AddTransactionSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        accounts={accountOptions}
        onAdd={addTransaction}
      />

      {/* Modal Bottom Sheet de Criação de Novo Cartão */}
      <AddCardSheet
        isOpen={isCardSheetOpen}
        onClose={() => setIsCardSheetOpen(false)}
        onAddCard={addCard}
      />
    </div>
  );
}
