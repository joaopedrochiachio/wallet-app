/**
 * Modelos das telas de dinheiro do Cofi (sem dependências de servidor).
 *
 * - buildCashSeries: saldo da conta dia a dia até o fim do mês, a partir da
 *   linha do tempo da análise (mesmo cálculo do Planejamento).
 * - buildAuditFindings: junta o parecer da IA (pontos validados) com os padrões
 *   calculados pelo app, sem repetir o mesmo assunto duas vezes.
 */
import type { FinancialAnalytics, TimelineEvent } from "./financialAnalyticsService.ts";
import type { AIBriefing, BriefingFact, BriefingPoint, FactKind } from "./aiBriefingModel.ts";
import type { CofiPattern, PatternMemory, PatternStatus } from "./cofiPatterns.ts";

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Saldo dia a dia                                                     */
/* ------------------------------------------------------------------ */

export interface CashPoint {
  day: number;
  /** Saldo ao fim do dia, depois das entradas e contas daquele dia. */
  balance: number;
  events: TimelineEvent[];
}

export function buildCashSeries(a: FinancialAnalytics): CashPoint[] {
  const today = Math.max(1, Math.min(a.day, a.daysInMonth));
  const out: CashPoint[] = [];
  let running = a.cash.balanceToday;
  for (let d = today; d <= a.daysInMonth; d++) {
    // Pendências de dias anteriores entram no dia de hoje
    const events = a.timeline.events.filter((e) => (d === today ? e.day <= today : e.day === d));
    for (const e of events) running += e.direction === "in" ? e.amount : -e.amount;
    out.push({ day: d, balance: round2(running), events });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Achados da auditoria                                                */
/* ------------------------------------------------------------------ */

export type FindingTone = "critico" | "atencao" | "leve" | "positivo";

export interface AuditFinding {
  id: string;
  tone: FindingTone;
  title: string;
  /** O número que resume o achado (um só). */
  value?: { value: number; kind: FactKind };
  explanation: string;
  action?: string;
  /** Dados do app que sustentam o achado (conferidos). */
  evidence: BriefingFact[];
  patternKey?: string;
  patternStatus?: PatternStatus;
  /** "ia" = escrito pelo parecer; "app" = calculado pelo app, sem IA. */
  source: "ia" | "app";
}

const SEVERITY_ORDER: Record<FindingTone, number> = { critico: 0, atencao: 1, leve: 2, positivo: 3 };

function overlap(a: string[], b: string[]): number {
  const set = new Set(a);
  return b.filter((x) => set.has(x)).length;
}

function pickValue(point: BriefingPoint, facts: BriefingFact[]): AuditFinding["value"] {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const fact = point.evidenceFactIds.map((id) => byId.get(id)).find((f) => f && (f.kind === "brl" || f.kind === "percent"));
  return fact ? { value: fact.value, kind: fact.kind } : undefined;
}

export function buildAuditFindings(params: {
  briefing: AIBriefing | null;
  facts: BriefingFact[];
  catalog: CofiPattern[];
  memory: PatternMemory;
}): { attention: AuditFinding[]; favorable: AuditFinding[] } {
  const { briefing, facts, catalog, memory } = params;
  const used = new Set<string>();
  const factById = new Map(facts.map((f) => [f.id, f]));
  const evidenceFor = (ids: string[]) => ids.map((id) => factById.get(id)).filter((f): f is BriefingFact => Boolean(f));
  const statusOf = (key?: string) => (key ? memory[key]?.status : undefined);

  const matchPattern = (point: BriefingPoint, tone: CofiPattern["tone"]) => {
    let best: CofiPattern | null = null;
    let bestScore = 0;
    for (const p of catalog) {
      if (used.has(p.key) || p.tone !== tone) continue;
      const score = overlap(p.factIds, point.evidenceFactIds);
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (best) used.add(best.key);
    return best;
  };

  const fromPoint = (point: BriefingPoint, i: number, kind: "neg" | "pos"): AuditFinding => {
    const pattern = matchPattern(point, kind === "neg" ? "atencao" : "positivo");
    const tone: FindingTone = kind === "pos" ? "positivo" : point.severity === "alta" ? "critico" : point.severity === "baixa" ? "leve" : "atencao";
    return {
      id: `${kind}-${i}-${point.title}`,
      tone,
      title: point.title,
      value: pattern ? pattern.metric : pickValue(point, facts),
      explanation: point.explanation,
      action: point.action,
      evidence: evidenceFor(point.evidenceFactIds),
      patternKey: pattern?.key,
      patternStatus: statusOf(pattern?.key),
      source: "ia",
    };
  };

  const attention: AuditFinding[] = (briefing?.negatives ?? []).map((p, i) => fromPoint(p, i, "neg"));
  const favorable: AuditFinding[] = (briefing?.positives ?? []).map((p, i) => fromPoint(p, i, "pos"));

  // Padrões que o parecer não cobriu (ou não há parecer): entram calculados pelo app
  for (const p of catalog) {
    if (used.has(p.key)) continue;
    const status = statusOf(p.key);
    if (status === "ignorado" || status === "esperado") continue;
    const finding: AuditFinding = {
      id: `app-${p.key}`,
      tone: p.tone === "positivo" ? "positivo" : "atencao",
      title: p.title,
      value: p.metric,
      explanation: p.detail,
      evidence: evidenceFor(p.factIds),
      patternKey: p.key,
      patternStatus: status,
      source: "app",
    };
    (p.tone === "positivo" ? favorable : attention).push(finding);
  }

  attention.sort((a, b) => SEVERITY_ORDER[a.tone] - SEVERITY_ORDER[b.tone]);
  return { attention, favorable };
}
