/**
 * Tipos e formatação do informativo do Cofi, sem dependências de servidor
 * (pode ser importado por componentes do navegador).
 */
export type FactKind = "brl" | "percent" | "count" | "days" | "months" | "day";

export interface BriefingFact {
  id: string;
  label: string;
  value: number;
  kind: FactKind;
  /** Frase curta que ajuda a IA (e o usuário) a entender o número. */
  note?: string;
}

export type BriefingMood = "positivo" | "neutro" | "atencao" | "critico";
export type BriefingSeverity = "alta" | "media" | "baixa";

export interface BriefingPoint {
  title: string;
  explanation: string;
  evidenceFactIds: string[];
  action: string;
  severity?: BriefingSeverity;
}

export interface AIBriefing {
  headline: string;
  summary: string;
  mood: BriefingMood;
  highlightFactIds: string[];
  positives: BriefingPoint[];
  negatives: BriefingPoint[];
  nextStep: { title: string; detail: string };
  lesson: { term: string; explanation: string };
  suggestedQuestions: string[];
}

export function formatFactValue(fact: Pick<BriefingFact, "value" | "kind">): string {
  const n = fact.value;
  if (fact.kind === "brl") return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (fact.kind === "percent") return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (fact.kind === "months") return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${n === 1 ? "mês" : "meses"}`;
  if (fact.kind === "day") return `dia ${n}`;
  if (fact.kind === "days") return `${n} ${n === 1 ? "dia" : "dias"}`;
  return String(n);
}
