export const EXPENSE_CATEGORIES = [
  "Alimentação & Delivery", "Supermercado", "Transporte & Combustível",
  "Moradia & Contas", "Assinaturas & Lazer", "Saúde & Farmácia",
  "Compras & Roupas", "Educação", "Investimentos & Metas", "Outros",
];

export const INCOME_CATEGORIES = [
  "Salário / Pró-labore", "Freelance & Projetos", "Rendimentos & Dividendos",
  "Resgate de Metas & Investimentos", "Venda & Desapego", "Reembolso & Cashback",
  "Bônus & 13º", "Outros",
];

const key = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
const aliases = new Map([
  ...[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((name) => [key(name), name] as const),
  ["alimentação", "Alimentação & Delivery"],
  ["transporte", "Transporte & Combustível"],
  ["moradia", "Moradia & Contas"],
  ["lazer", "Assinaturas & Lazer"],
  ["saúde", "Saúde & Farmácia"],
  ["compras", "Compras & Roupas"],
]);

/** Compatibilidade com os nomes usados pelos lançamentos rápidos anteriores. */
export function normalizeCategory(category: string | null | undefined): string {
  const name = category?.trim() || "Outros";
  return aliases.get(key(name)) || name;
}
