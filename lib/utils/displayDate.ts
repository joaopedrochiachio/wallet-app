/**
 * Formata datas para exibição no padrão do app ("12 nov" ou "12 nov 2025").
 * Aceita Date, timestamp, ISO ("2026-11-12T15:00:00.000Z" / "2026-11-12")
 * e devolve rótulos que já são texto humano ("Dezembro 2026", "12 nov, 14:30")
 * sem alteração — assim nenhum valor técnico cru aparece na tela.
 */
export function formatDisplayDate(value: unknown, reference: Date = new Date()): string {
  if (value === null || value === undefined || value === "") return "";
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof value === "number") date = new Date(value);
  else if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    date = (value as { toDate: () => Date }).toDate();
  } else if (typeof value === "string") {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!iso) return value;
    date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
  }
  if (!date || Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";
  const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  return date.getFullYear() === reference.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}
