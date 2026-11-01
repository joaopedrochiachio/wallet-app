"use client";

import React, { useMemo } from "react";
import {
  ArrowUpRight,
  Cake,
  Car,
  ChevronRight,
  Coffee,
  HeartPulse,
  ListFilter,
  MessageCircle,
  Phone,
  ShoppingBag,
  Tag,
  Tv,
  UtensilsCrossed,
  X,
  Zap,
} from "lucide-react";
import type { TransactionItem } from "@/context/WalletContext";
import type { SpecificExpenseAlert } from "@/lib/services/financialDiagnosisService";

export interface CategoryDistribution {
  category: string;
  total: number;
  color: string;
  iconName?: string;
}

export function resolveAppleCategoryTheme(category: string): { color: string; label: string } {
  const normalized = normalize(category);
  if (/transporte|uber|99|mobilidade|carro|combustivel|posto/.test(normalized)) return { color: "#007AFF", label: "Transporte" };
  if (/lanche|fast food|hamburguer|mcdonald|burger/.test(normalized)) return { color: "#FF9500", label: "Fast Food" };
  if (/restaurante|delivery|ifood|refeic|alimenta/.test(normalized)) return { color: "#FF6B00", label: "Restaurantes & Delivery" };
  if (/cafe|padaria|cantina/.test(normalized)) return { color: "#D97706", label: "Cafés & Cantinas" };
  if (/doce|sobremesa|sorvete|acai/.test(normalized)) return { color: "#FF2D55", label: "Sobremesas" };
  if (/farmacia|saude|drogaria|medic/.test(normalized)) return { color: "#34C759", label: "Farmácia & Saúde" };
  if (/assinatura|streaming|lazer|netflix|spotify|cinema/.test(normalized)) return { color: "#AF52DE", label: "Lazer & Assinaturas" };
  if (/telefonia|internet|vivo|claro|tim|celular/.test(normalized)) return { color: "#5856D6", label: "Telefonia & Internet" };
  if (/mercado|supermercado|compras|varejo/.test(normalized)) return { color: "#30B0C7", label: "Mercado & Varejo" };
  return { color: "#FF3B30", label: "Outros" };
}

interface CategorySpectrumBarProps {
  categories: CategoryDistribution[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  transactions?: TransactionItem[];
  insights?: SpecificExpenseAlert[];
  onDiscussWithAI?: (prompt: string) => void;
}

function normalize(value: string) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function sameCategory(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return normalize(resolveAppleCategoryTheme(left).label) === normalize(resolveAppleCategoryTheme(right).label);
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function formatTransactionDate(transaction: TransactionItem) {
  const rawDate = transaction.occurredAt ?? transaction.date;
  const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (Number.isNaN(date.getTime())) return transaction.date;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function CategoryIcon({ name, size = 13 }: { name: string; size?: number }) {
  const normalized = normalize(name);
  if (/fast food|lanche/.test(normalized)) return <UtensilsCrossed size={size} />;
  if (/cafe|padaria/.test(normalized)) return <Coffee size={size} />;
  if (/doce|sobremesa/.test(normalized)) return <Cake size={size} />;
  if (/farmacia|saude/.test(normalized)) return <HeartPulse size={size} />;
  if (/transporte|uber|carro/.test(normalized)) return <Car size={size} />;
  if (/assinatura|streaming|lazer/.test(normalized)) return <Tv size={size} />;
  if (/telefonia|internet/.test(normalized)) return <Phone size={size} />;
  if (/fixa|energia|luz/.test(normalized)) return <Zap size={size} />;
  if (/mercado|compras/.test(normalized)) return <ShoppingBag size={size} />;
  return <Tag size={size} />;
}

export function CategorySpectrumBar({
  categories,
  selectedCategory,
  onSelectCategory,
  transactions = [],
  insights = [],
  onDiscussWithAI,
}: CategorySpectrumBarProps) {
  const total = categories.reduce((sum, category) => sum + category.total, 0);
  const activeCategoryName = categories.find((category) => category.category === selectedCategory)?.category ?? categories[0]?.category ?? null;
  const activeCategory = categories.find((category) => category.category === activeCategoryName);

  const activeTransactions = useMemo(() => {
    if (!activeCategoryName) return [];
    return transactions
      .filter((transaction) => transaction.type === "despesa" && sameCategory(transaction.category, activeCategoryName))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [activeCategoryName, transactions]);

  const activeInsight = useMemo(() => {
    if (!activeCategoryName) return null;
    return insights.find((insight) => sameCategory(insight.habitCategory || insight.item, activeCategoryName)) ?? null;
  }, [activeCategoryName, insights]);

  if (categories.length === 0 || total <= 0 || !activeCategory) return null;

  const activeShare = (activeCategory.total / total) * 100;
  return (
    <section className="overflow-hidden rounded-[30px] border border-black/[0.05] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <header className="flex flex-col gap-3 border-b border-black/[0.05] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#F2F2F7] text-[#1D1D1F]"><ListFilter size={16} /></div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">Gastos por categoria</h2>
            <p className="text-[11px] text-[#86868B]">Selecione uma categoria e inspecione os lançamentos sem sair da visão geral.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#F2F2F7] px-3 py-1 text-[10px] font-semibold tabular-nums text-[#6E6E73]">Total {formatCurrency(total)}</span>
          {selectedCategory && (
            <button type="button" onClick={() => onSelectCategory(null)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-[#6E6E73] transition-colors hover:bg-[#F2F2F7] hover:text-[#1D1D1F]"><X size={11} /> Limpar</button>
          )}
        </div>
      </header>

      <div className="flex h-3 w-full gap-0.5 bg-[#F5F5F7] p-0.5" aria-label="Distribuição proporcional dos gastos">
        {categories.map((category) => {
          const share = (category.total / total) * 100;
          const selected = activeCategoryName === category.category;
          return (
            <button key={category.category} type="button" onClick={() => onSelectCategory(category.category)} title={`${category.category}: ${share.toFixed(0)}%`} className={`h-full rounded-full transition-all duration-300 ${selected ? "opacity-100 ring-2 ring-white" : "opacity-55 hover:opacity-90"}`} style={{ width: `${Math.max(3, share)}%`, backgroundColor: category.color }} />
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.35fr)]">
        <div className="border-b border-black/[0.05] p-3 lg:border-b-0 lg:border-r">
          <div className="space-y-1">
            {categories.map((category) => {
              const share = (category.total / total) * 100;
              const selected = activeCategoryName === category.category;
              return (
                <button key={category.category} type="button" onClick={() => onSelectCategory(category.category)} className={`group w-full rounded-[16px] px-3 py-2.5 text-left transition-all ${selected ? "bg-[#F2F2F7]" : "hover:bg-[#FAFAFA]"}`}>
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] text-white shadow-sm" style={{ backgroundColor: category.color }}><CategoryIcon name={category.category} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <strong className="truncate text-[11px] font-semibold text-slate-900">{category.category}</strong>
                        <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-[#6E6E73]">{formatCurrency(category.total)}</span>
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.05]"><span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: category.color }} /></span>
                        <span className="w-9 text-right text-[9px] tabular-nums text-[#86868B]">{share.toFixed(0)}%</span>
                      </span>
                    </span>
                    <ChevronRight size={13} className={`transition-transform ${selected ? "translate-x-0 text-[#1D1D1F]" : "-translate-x-1 text-[#C7C7CC] group-hover:translate-x-0"}`} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-white shadow-sm" style={{ backgroundColor: activeCategory.color }}><CategoryIcon name={activeCategory.category} size={16} /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86868B]">Categoria selecionada</p>
                <h3 className="truncate text-base font-semibold tracking-tight text-slate-900">{activeCategory.category}</h3>
              </div>
            </div>
            <div className="text-right">
              <strong className="block text-lg font-semibold tracking-tight tabular-nums text-slate-900">{formatCurrency(activeCategory.total)}</strong>
              <span className="text-[10px] tabular-nums text-[#86868B]">{activeShare.toFixed(1)}% do total</span>
            </div>
          </div>

          {activeInsight && <div className="mt-4 rounded-[16px] bg-[#F5F5F7] px-3.5 py-3 text-[11px] leading-relaxed text-[#555]"><span className="font-semibold text-slate-900">Leitura do Niko: </span>{activeInsight.message}</div>}

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#86868B]">Maiores lançamentos</span>
              <span className="text-[10px] text-[#AEAEB2]">{activeTransactions.length} exibidos</span>
            </div>
            {activeTransactions.length > 0 ? (
              <div className="divide-y divide-black/[0.05]">
                {activeTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center gap-3 py-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: activeCategory.color }} />
                    <div className="min-w-0 flex-1"><strong className="block truncate text-[11px] font-medium text-slate-900">{transaction.title}</strong><span className="text-[9px] text-[#86868B]">{transaction.account} · {formatTransactionDate(transaction)}</span></div>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-900">− {formatCurrency(transaction.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[16px] border border-dashed border-black/10 px-4 py-5 text-center text-[11px] text-[#86868B]">A categoria veio do diagnóstico consolidado; não há lançamentos individuais compatíveis neste período.</div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] pt-3">
            <span className="text-[10px] text-[#86868B]">Análise contextual, sem trocar de tela.</span>
            {onDiscussWithAI && (
              <button type="button" onClick={() => onDiscussWithAI(`Niko, aprofunde os gastos de ${activeCategory.category}, que somam ${formatCurrency(activeCategory.total)} (${activeShare.toFixed(1)}% do total), e indique as melhores ações.`)} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-600 transition-colors hover:text-blue-800"><MessageCircle size={12} /> Discutir com Niko <ArrowUpRight size={11} /></button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
