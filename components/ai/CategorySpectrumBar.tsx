"use client";

import React from "react";
import {
  Cake,
  Car,
  Coffee,
  HeartPulse,
  ListFilter,
  Phone,
  ShoppingBag,
  Tag,
  Tv,
  UtensilsCrossed,
  X,
  Zap,
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
  const normalized = (category || "").toLowerCase();

  if (
    normalized.includes("transporte") ||
    normalized.includes("uber") ||
    normalized.includes("99") ||
    normalized.includes("mobilidade") ||
    normalized.includes("carro") ||
    normalized.includes("combustivel") ||
    normalized.includes("posto")
  ) {
    return { color: "#007AFF", label: "Transporte" };
  }
  if (
    normalized.includes("lanche") ||
    normalized.includes("fast food") ||
    normalized.includes("hamburguer") ||
    normalized.includes("mcdonald") ||
    normalized.includes("bk") ||
    normalized.includes("burger")
  ) {
    return { color: "#FF9500", label: "Fast Food" };
  }
  if (
    normalized.includes("restaurante") ||
    normalized.includes("delivery") ||
    normalized.includes("ifood") ||
    normalized.includes("refeic") ||
    normalized.includes("alimenta")
  ) {
    return { color: "#FF6B00", label: "Restaurantes & Delivery" };
  }
  if (
    normalized.includes("café") ||
    normalized.includes("cafe") ||
    normalized.includes("padaria") ||
    normalized.includes("cantina")
  ) {
    return { color: "#D97706", label: "Cafés & Cantinas" };
  }
  if (
    normalized.includes("doce") ||
    normalized.includes("sobremesa") ||
    normalized.includes("sorvete") ||
    normalized.includes("acai") ||
    normalized.includes("açaí")
  ) {
    return { color: "#FF2D55", label: "Sobremesas" };
  }
  if (
    normalized.includes("farmacia") ||
    normalized.includes("farmácia") ||
    normalized.includes("saude") ||
    normalized.includes("saúde") ||
    normalized.includes("drogaria") ||
    normalized.includes("medic")
  ) {
    return { color: "#34C759", label: "Farmácia & Saúde" };
  }
  if (
    normalized.includes("assinatura") ||
    normalized.includes("streaming") ||
    normalized.includes("lazer") ||
    normalized.includes("netflix") ||
    normalized.includes("spotify") ||
    normalized.includes("cinema")
  ) {
    return { color: "#AF52DE", label: "Lazer & Assinaturas" };
  }
  if (
    normalized.includes("telefonia") ||
    normalized.includes("internet") ||
    normalized.includes("vivo") ||
    normalized.includes("claro") ||
    normalized.includes("tim") ||
    normalized.includes("celular")
  ) {
    return { color: "#5856D6", label: "Telefonia & Internet" };
  }
  if (
    normalized.includes("mercado") ||
    normalized.includes("supermercado") ||
    normalized.includes("compras") ||
    normalized.includes("varejo")
  ) {
    return { color: "#30B0C7", label: "Mercado & Varejo" };
  }

  return { color: "#FF3B30", label: "Outros" };
}

interface CategorySpectrumBarProps {
  categories: CategoryDistribution[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function getCategoryIcon(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("fast food") || normalized.includes("lanche")) return UtensilsCrossed;
  if (normalized.includes("café") || normalized.includes("cafe") || normalized.includes("padaria")) return Coffee;
  if (normalized.includes("doce") || normalized.includes("sobremesa")) return Cake;
  if (normalized.includes("farmacia") || normalized.includes("saúde") || normalized.includes("saude")) return HeartPulse;
  if (normalized.includes("transporte") || normalized.includes("uber") || normalized.includes("carro")) return Car;
  if (normalized.includes("assinatura") || normalized.includes("streaming") || normalized.includes("lazer")) return Tv;
  if (normalized.includes("telefonia") || normalized.includes("internet")) return Phone;
  if (normalized.includes("fixa") || normalized.includes("energia") || normalized.includes("luz")) return Zap;
  if (normalized.includes("mercado") || normalized.includes("compras")) return ShoppingBag;
  return Tag;
}

export function CategorySpectrumBar({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategorySpectrumBarProps) {
  const total = categories.reduce((sum, category) => sum + category.total, 0);

  if (categories.length === 0 || total <= 0) return null;

  return (
    <section className="overflow-hidden rounded-[28px] border border-black/[0.05] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
      <header className="flex flex-col gap-3 border-b border-black/[0.05] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F2F2F7] text-[#1D1D1F]">
            <ListFilter size={15} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-[#1D1D1F]">
              Gastos por categoria
            </h2>
            <p className="text-[11px] text-[#86868B]">
              Uma lista direta para localizar onde o dinheiro está concentrado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#F2F2F7] px-2.5 py-1 text-[9px] font-semibold text-[#6E6E73]">
            Total {formatCurrency(total)}
          </span>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className="inline-flex items-center gap-1 rounded-full border border-black/[0.07] bg-white px-2.5 py-1 text-[9px] font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              <X size={10} />
              Limpar filtro
            </button>
          )}
        </div>
      </header>

      <div className="flex h-2.5 w-full gap-0.5 bg-[#F2F2F7] p-0.5">
        {categories.map((category) => {
          const share = (category.total / total) * 100;
          const selected = selectedCategory === category.category;
          const dimmed = Boolean(selectedCategory && !selected);

          return (
            <button
              key={category.category}
              type="button"
              onClick={() => onSelectCategory(selected ? null : category.category)}
              title={`${category.category}: ${share.toFixed(0)}%`}
              className={`h-full rounded-full transition-opacity ${dimmed ? "opacity-20" : "opacity-100"}`}
              style={{ width: `${Math.max(3, share)}%`, backgroundColor: category.color }}
            />
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="border-b border-black/[0.05] bg-[#FAFAFA]">
              {['Categoria', 'Valor', 'Participação', 'Distribuição', 'Filtro'].map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-[9px] font-bold uppercase tracking-[0.08em] text-[#86868B] first:sm:px-7"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const share = (category.total / total) * 100;
              const selected = selectedCategory === category.category;
              const CategoryIcon = getCategoryIcon(category.category);

              return (
                <tr
                  key={category.category}
                  className={`border-b border-black/[0.045] last:border-b-0 ${selected ? "bg-[#F5F5F7]" : "hover:bg-[#FAFAFA]"}`}
                >
                  <td className="px-4 py-3 first:sm:px-7">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm"
                        style={{ backgroundColor: category.color }}
                      >
                        <CategoryIcon size={12} />
                      </span>
                      <span className="text-[10px] font-bold text-[#1D1D1F]">{category.category}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-bold text-[#1D1D1F]">
                    {formatCurrency(category.total)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-[#6E6E73]">
                    {share.toFixed(1)}%
                  </td>
                  <td className="w-[190px] px-4 py-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${share}%`, backgroundColor: category.color }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectCategory(selected ? null : category.category)}
                      className={`rounded-full px-2.5 py-1 text-[8.5px] font-semibold transition-colors ${
                        selected
                          ? "bg-[#1D1D1F] text-white"
                          : "bg-[#F2F2F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                      }`}
                    >
                      {selected ? "Filtro ativo" : "Ver lançamentos"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
