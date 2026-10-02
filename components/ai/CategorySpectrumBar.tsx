"use client";

import React from "react";
import {
  PieChart,
  UtensilsCrossed,
  Car,
  Tv,
  ShoppingBag,
  Zap,
  Coffee,
  HeartPulse,
  Cake,
  Phone,
  Tag,
  Sparkles,
} from "lucide-react";

export interface CategoryDistribution {
  category: string;
  total: number;
  color: string;
  iconName?: string;
}

export function resolveAppleCategoryTheme(category: string): {
  color: string;
  label: string;
} {
  const c = (category || "").toLowerCase();
  if (c.includes("transporte") || c.includes("uber") || c.includes("99") || c.includes("mobilidade") || c.includes("carro") || c.includes("combustivel") || c.includes("posto")) {
    return { color: "#007AFF", label: "Transporte" }; // Apple Blue
  }
  if (c.includes("lanche") || c.includes("fast food") || c.includes("hamburguer") || c.includes("mcdonald") || c.includes("bk") || c.includes("burger")) {
    return { color: "#FF9500", label: "Fast Food" }; // Apple Amber
  }
  if (c.includes("restaurante") || c.includes("delivery") || c.includes("ifood") || c.includes("refeic") || c.includes("alimenta")) {
    return { color: "#FF6B00", label: "Restaurantes & Delivery" }; // Vibrant Coral
  }
  if (c.includes("café") || c.includes("cafe") || c.includes("padaria") || c.includes("cantina")) {
    return { color: "#D97706", label: "Cafés & Cantinas" }; // Warm Gold
  }
  if (c.includes("doce") || c.includes("sobremesa") || c.includes("sorvete") || c.includes("acai") || c.includes("açaí")) {
    return { color: "#FF2D55", label: "Sobremesas" }; // Apple Pink
  }
  if (c.includes("farmacia") || c.includes("farmácia") || c.includes("saude") || c.includes("saúde") || c.includes("drogaria") || c.includes("medic")) {
    return { color: "#34C759", label: "Farmácia & Saúde" }; // Apple Green
  }
  if (c.includes("assinatura") || c.includes("streaming") || c.includes("lazer") || c.includes("netflix") || c.includes("spotify") || c.includes("cinema")) {
    return { color: "#AF52DE", label: "Lazer & Assinaturas" }; // Apple Purple
  }
  if (c.includes("telefonia") || c.includes("internet") || c.includes("vivo") || c.includes("claro") || c.includes("tim") || c.includes("celular")) {
    return { color: "#5856D6", label: "Telefonia & Internet" }; // Apple Indigo
  }
  if (c.includes("mercado") || c.includes("supermercado") || c.includes("compras") || c.includes("varejo")) {
    return { color: "#30B0C7", label: "Mercado & Varejo" }; // Apple Teal
  }
  return { color: "#FF3B30", label: "Outros" }; // Default vibrant
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
    if (n.includes("fast food") || n.includes("lanche") || n.includes("burger")) {
      return <UtensilsCrossed size={12} />;
    }
    if (n.includes("café") || n.includes("cafe") || n.includes("padaria") || n.includes("cantina")) {
      return <Coffee size={12} />;
    }
    if (n.includes("doce") || n.includes("sobremesa")) {
      return <Cake size={12} />;
    }
    if (n.includes("farmacia") || n.includes("saúde") || n.includes("saude")) {
      return <HeartPulse size={12} />;
    }
    if (n.includes("transporte") || n.includes("uber") || n.includes("carro")) {
      return <Car size={12} />;
    }
    if (n.includes("assinatura") || n.includes("streaming") || n.includes("lazer")) {
      return <Tv size={12} />;
    }
    if (n.includes("telefonia") || n.includes("internet") || n.includes("vivo")) {
      return <Phone size={12} />;
    }
    if (n.includes("fixa") || n.includes("energia") || n.includes("luz")) {
      return <Zap size={12} />;
    }
    if (n.includes("mercado") || n.includes("compras")) {
      return <ShoppingBag size={12} />;
    }
    return <Tag size={12} />;
  };

  const selectedCatObj = categories.find((c) => c.category === selectedCategory);

  return (
    <div className="bg-white rounded-[28px] p-5 sm:p-7 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-xs">
            <PieChart size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
              Espectro de Gastos & Hábitos
            </h2>
            <p className="text-[11px] text-[#86868B]">
              Distribuição proporcional inspirada no Apple Card (toque para filtrar os padrões)
            </p>
          </div>
        </div>

        {selectedCategory && (
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className="text-xs font-semibold text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] px-3 py-1 rounded-full border border-black/[0.05] transition-all self-start sm:self-auto cursor-pointer shadow-xs active:scale-95"
          >
            ✕ Limpar filtro
          </button>
        )}
      </div>

      {/* Barra de Espectro Multi-Cor Apple Card */}
      <div className="space-y-2.5 pt-1">
        <div className="h-3.5 w-full bg-black/[0.04] rounded-full overflow-hidden flex p-0.5 gap-1">
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
                  width: `${Math.max(5, pct)}%`,
                  backgroundColor: cat.color,
                }}
                title={`${cat.category}: R$ ${formatCurrency(cat.total)} (${pct.toFixed(0)}%)`}
                className={`h-full rounded-full transition-all duration-300 cursor-pointer ${
                  isDimmed
                    ? "opacity-25 hover:opacity-75"
                    : "opacity-100 hover:scale-y-110"
                } ${isSelected ? "ring-2 ring-black ring-offset-1 scale-y-110 shadow-sm" : ""}`}
              />
            );
          })}
        </div>

        {/* Feedback da Categoria Selecionada */}
        {selectedCatObj && (
          <div className="p-3 rounded-2xl bg-[#FAFAFC] border border-black/[0.05] flex items-center justify-between text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedCatObj.color }}
              />
              <span className="font-semibold text-[#1D1D1F]">
                {selectedCatObj.category}
              </span>
              <span className="text-[#86868B]">
                • R$ {formatCurrency(selectedCatObj.total)} (
                {((selectedCatObj.total / totalSum) * 100).toFixed(0)}% de todos os hábitos)
              </span>
            </div>
            <span className="text-[11px] text-[#007AFF] font-medium">
              Filtrando hábitos abaixo ↓
            </span>
          </div>
        )}

        {/* Chips de Categorias Clicáveis com Cores Oficiais Apple Card */}
        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map((cat, idx) => {
            const pct = (cat.total / totalSum) * 100;
            const isSelected = selectedCategory === cat.category;
            const isDimmed = selectedCategory !== null && !isSelected;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectCategory(isSelected ? null : cat.category)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white border-black shadow-xs scale-102"
                    : isDimmed
                    ? "bg-white/60 text-[#86868B] border-black/[0.04] opacity-50 hover:opacity-100"
                    : "bg-[#FAFAFC] hover:bg-black/[0.04] text-[#1D1D1F] border-black/[0.04] shadow-2xs"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="flex items-center gap-1.5">
                  {getCategoryIcon(cat.category)}
                  <span>{cat.category}</span>
                </span>
                <span
                  className={`text-[10px] font-mono tabular-nums ${
                    isSelected ? "text-white/80" : "text-[#86868B]"
                  }`}
                >
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
