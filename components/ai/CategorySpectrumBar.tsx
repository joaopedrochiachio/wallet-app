"use client";

import React from "react";
import { PieChart, UtensilsCrossed, Car, Tv, ShoppingBag, Zap, Tag } from "lucide-react";

export interface CategoryDistribution {
  category: string;
  total: number;
  color: string;
  iconName?: string;
}

interface CategorySpectrumBarProps {
  categories: CategoryDistribution[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export function CategorySpectrumBar({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategorySpectrumBarProps) {
  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalSum = categories.reduce((acc, c) => acc + c.total, 0);

  if (categories.length === 0 || totalSum <= 0) {
    return null;
  }

  const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("aliment") || n.includes("delivery") || n.includes("comida")) {
      return <UtensilsCrossed size={12} />;
    }
    if (n.includes("transporte") || n.includes("uber") || n.includes("carro")) {
      return <Car size={12} />;
    }
    if (n.includes("assinatura") || n.includes("streaming") || n.includes("netflix") || n.includes("spotify")) {
      return <Tv size={12} />;
    }
    if (n.includes("compra") || n.includes("varejo") || n.includes("lazer")) {
      return <ShoppingBag size={12} />;
    }
    if (n.includes("fixa") || n.includes("energia") || n.includes("luz") || n.includes("internet")) {
      return <Zap size={12} />;
    }
    return <Tag size={12} />;
  };

  return (
    <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.025)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <PieChart size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
              Espectro de Gastos & Hábitos
            </h2>
            <p className="text-[11px] text-[#86868B]">
              Distribuição proporcional inspirada no Apple Card (toque para filtrar)
            </p>
          </div>
        </div>

        {selectedCategory && (
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className="text-[11px] font-semibold text-[#86868B] hover:text-[#1D1D1F] bg-[#F2F2F7] px-3 py-1 rounded-full border border-black/[0.05] transition-all self-start sm:self-auto cursor-pointer"
          >
            Limpar filtro (Ver todas)
          </button>
        )}
      </div>

      {/* Barra de Espectro Multi-Cor Apple Card */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-black/[0.04] rounded-full overflow-hidden flex p-0.5 gap-0.5">
          {categories.map((cat, idx) => {
            const pct = (cat.total / totalSum) * 100;
            const isSelected = selectedCategory === cat.category;
            const isDimmed = selectedCategory !== null && !isSelected;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectCategory(isSelected ? null : cat.category)}
                style={{
                  width: `${Math.max(4, pct)}%`,
                  backgroundColor: cat.color,
                }}
                title={`${cat.category}: R$ ${formatCurrency(cat.total)} (${pct.toFixed(0)}%)`}
                className={`h-full rounded-full transition-all duration-300 cursor-pointer ${
                  isDimmed ? "opacity-25 hover:opacity-70 scale-y-75" : "opacity-100 hover:scale-y-110"
                } ${isSelected ? "ring-2 ring-black ring-offset-1" : ""}`}
              />
            );
          })}
        </div>

        {/* Chips de Categorias Clicáveis */}
        <div className="flex flex-wrap gap-2 pt-2">
          {categories.map((cat, idx) => {
            const pct = (cat.total / totalSum) * 100;
            const isSelected = selectedCategory === cat.category;
            const isDimmed = selectedCategory !== null && !isSelected;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectCategory(isSelected ? null : cat.category)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white border-black shadow-xs scale-102"
                    : isDimmed
                    ? "bg-white/50 text-[#86868B] border-black/[0.04] opacity-50 hover:opacity-100"
                    : "bg-[#FAFAFC] hover:bg-black/[0.04] text-[#1D1D1F] border-black/[0.04]"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="flex items-center gap-1">
                  {getCategoryIcon(cat.category)}
                  <span>{cat.category}</span>
                </span>
                <span className={`text-[10px] font-mono tabular-nums ${isSelected ? "text-white/80" : "text-[#86868B]"}`}>
                  R$ {formatCurrency(cat.total)} ({pct.toFixed(0)}%)
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
