import { createElement } from "react";
import {
  Car,
  Clapperboard,
  GraduationCap,
  HeartPulse,
  Home,
  LayoutGrid,
  PiggyBank,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { normalizeCategory } from "@/lib/utils/categories";

const RULES: [RegExp, LucideIcon][] = [
  [/aliment|delivery|restaur|comida|lanche/i, Utensils],
  [/mercado/i, ShoppingCart],
  [/transporte|combust|uber|carro/i, Car],
  [/moradia|aluguel|casa|contas/i, Home],
  [/assinatura|lazer|stream|entreten/i, Clapperboard],
  [/sa[uú]de|farm|m[eé]dic/i, HeartPulse],
  [/compra|roupa|shopping/i, ShoppingBag],
  [/educa|curso|escola/i, GraduationCap],
  [/invest|meta|reserva/i, PiggyBank],
];

export function categoryIcon(category: string): LucideIcon {
  const name = normalizeCategory(category);
  return RULES.find(([pattern]) => pattern.test(name))?.[1] ?? LayoutGrid;
}

export function CategoryIconTile({ category, size = 40 }: { category: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[8px] bg-[var(--fb-card-2)] text-[var(--fb-text-3)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {createElement(categoryIcon(category), { size: Math.round(size * 0.5), strokeWidth: 1.75 })}
    </span>
  );
}
