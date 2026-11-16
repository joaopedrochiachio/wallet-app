"use client";

import React from "react";
import { ArrowRight, BookOpen, CheckCircle2, CircleAlert, Footprints, MessageCircle } from "lucide-react";
import { formatFactValue, type AIBriefing, type BriefingFact, type BriefingMood, type BriefingPoint } from "@/lib/services/aiBriefingModel";

const MOOD: Record<BriefingMood, { label: string; tone: string }> = {
  positivo: { label: "Mês sob controle", tone: "text-[var(--ai-good)] bg-[var(--ai-good-bg)]" },
  neutro: { label: "Poucos dados ainda", tone: "text-[var(--ai-text-2)] bg-[var(--ai-card-2)]" },
  atencao: { label: "Pede atenção", tone: "text-[var(--ai-warn)] bg-[var(--ai-warn-bg)]" },
  critico: { label: "Situação crítica", tone: "text-[var(--ai-bad)] bg-[var(--ai-bad-bg)]" },
};

const SEVERITY: Record<NonNullable<BriefingPoint["severity"]>, { label: string; dot: string; text: string }> = {
  alta: { label: "Urgente", dot: "bg-[var(--ai-bad)]", text: "text-[var(--ai-bad)]" },
  media: { label: "Importante", dot: "bg-[var(--ai-warn)]", text: "text-[var(--ai-warn)]" },
  baixa: { label: "Fique de olho", dot: "bg-[var(--ai-text-3)]", text: "text-[var(--ai-text-2)]" },
};

/** Grade dos números de destaque sem célula vazia (3 itens: o primeiro ocupa a linha toda no celular). */
const HIGHLIGHT_GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3 [&>*:first-child]:col-span-2 lg:[&>*:first-child]:col-span-1",
  4: "grid-cols-2 lg:grid-cols-4",
};

const card = "rounded-[20px] bg-[var(--ai-card)] shadow-[var(--ai-shadow)]";

function factTone(fact: BriefingFact): string {
  if (fact.kind === "brl" && fact.value < 0) return "text-[var(--ai-bad)]";
  return "text-[var(--ai-text)]";
}

export function BriefingHero({ briefing, facts, generatedLabel }: { briefing: AIBriefing; facts: BriefingFact[]; generatedLabel?: string }) {
  const mood = MOOD[briefing.mood];
  const highlights = briefing.highlightFactIds.map((id) => facts.find((f) => f.id === id)).filter(Boolean) as BriefingFact[];
  return (
    <section aria-labelledby="ai-headline" className={`${card} p-5 sm:p-7`}>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${mood.tone}`}>{mood.label}</span>
        {generatedLabel && <span className="text-[var(--ai-text-3)]">{generatedLabel}</span>}
      </div>
      <h2 id="ai-headline" className="mt-3 text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--ai-text)] sm:text-[30px]">
        {briefing.headline}
      </h2>
      <p className="mt-2.5 max-w-3xl text-[15px] leading-[1.5] text-[var(--ai-text-2)] sm:text-[16px]">{briefing.summary}</p>

      {highlights.length > 0 && (
        <dl className={`mt-5 grid gap-px overflow-hidden rounded-[14px] bg-[var(--ai-line)] ${HIGHLIGHT_GRID[highlights.length] ?? HIGHLIGHT_GRID[4]}`}>
          {highlights.map((fact) => (
            <div key={fact.id} className="min-w-0 bg-[var(--ai-card)] px-3.5 py-3 sm:px-4">
              <dt className="text-[12px] leading-[1.3] text-[var(--ai-text-2)]">{fact.label}</dt>
              <dd
                className={`mt-1 break-words font-mono font-semibold tabular-nums tracking-[-0.02em] ${
                  formatFactValue(fact).length > 13 ? "text-[15px] sm:text-[18px]" : "text-[18px] sm:text-[22px]"
                } ${factTone(fact)}`}
              >
                {formatFactValue(fact)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function EvidenceChips({ ids, facts }: { ids: string[]; facts: BriefingFact[] }) {
  const list = ids.map((id) => facts.find((f) => f.id === id)).filter(Boolean) as BriefingFact[];
  if (!list.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Números que sustentam este ponto">
      {list.map((f) => (
        <li key={f.id} className="max-w-full truncate rounded-full bg-[var(--ai-card-2)] px-2.5 py-1 text-[12px] text-[var(--ai-text-2)]">
          {f.label}: <span className={`font-mono font-semibold tabular-nums ${factTone(f)}`}>{formatFactValue(f)}</span>
        </li>
      ))}
    </ul>
  );
}

function PointCard({ point, facts, kind, onAsk }: { point: BriefingPoint; facts: BriefingFact[]; kind: "good" | "bad"; onAsk: (prompt: string) => void }) {
  const sev = kind === "bad" ? SEVERITY[point.severity ?? "media"] : null;
  return (
    <li className="border-t border-[var(--ai-line)] px-4 py-4 first:border-t-0 sm:px-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sev ? sev.dot : "bg-[var(--ai-good)]"}`}
        />
        <div className="min-w-0 flex-1">
          {sev && <p className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${sev.text}`}>{sev.label}</p>}
          <h4 className="text-[15px] font-semibold leading-[1.35] text-[var(--ai-text)]">{point.title}</h4>
          <EvidenceChips ids={point.evidenceFactIds} facts={facts} />
          <p className="mt-2.5 text-[14px] leading-[1.5] text-[var(--ai-text-2)]">
            <span className="font-semibold text-[var(--ai-text)]">Por que importa: </span>
            {point.explanation}
          </p>
          <p className="mt-1.5 flex gap-1.5 text-[14px] leading-[1.5] text-[var(--ai-text)]">
            <ArrowRight size={15} className="mt-[3px] shrink-0 text-[var(--ai-accent)]" aria-hidden />
            <span>
              <span className="font-semibold">O que fazer: </span>
              {point.action}
            </span>
          </p>
          <button
            type="button"
            onClick={() => onAsk(`Me explique melhor este ponto e como resolver: "${point.title}".`)}
            className="touch-target mt-2 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium text-[var(--ai-accent)] outline-none hover:underline focus-visible:underline"
          >
            <MessageCircle size={14} aria-hidden /> Perguntar ao Cofi
          </button>
        </div>
      </div>
    </li>
  );
}

export function AttentionPoints({ briefing, facts, onAsk }: { briefing: AIBriefing; facts: BriefingFact[]; onAsk: (prompt: string) => void }) {
  const columns = [
    { key: "bad" as const, title: "Pede atenção", icon: <CircleAlert size={16} className="text-[var(--ai-warn)]" />, points: briefing.negatives, empty: "Nada preocupante agora. Continue registrando seus gastos para o Cofi acompanhar." },
    { key: "good" as const, title: "A seu favor", icon: <CheckCircle2 size={16} className="text-[var(--ai-good)]" />, points: briefing.positives, empty: "Ainda sem pontos positivos claros nos seus números." },
  ];
  return (
    <section aria-labelledby="ai-points" className="space-y-3">
      <h3 id="ai-points" className="px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--ai-text-2)]">
        Pontos de atenção
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        {columns.map((col) => (
          <div key={col.key} className={`${card} min-w-0 overflow-hidden`}>
            <div className="flex items-center gap-2 border-b border-[var(--ai-line)] px-4 py-3 sm:px-5">
              {col.icon}
              <h4 className="text-[15px] font-semibold text-[var(--ai-text)]">{col.title}</h4>
              <span className="ml-auto text-[12px] tabular-nums text-[var(--ai-text-3)]">{col.points.length}</span>
            </div>
            {col.points.length ? (
              <ul>
                {col.points.map((p, i) => (
                  <PointCard key={`${col.key}-${i}`} point={p} facts={facts} kind={col.key} onAsk={onAsk} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-5 text-[14px] leading-[1.5] text-[var(--ai-text-2)] sm:px-5">{col.empty}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function NextStepAndLesson({ briefing }: { briefing: AIBriefing }) {
  if (!briefing.nextStep.title && !briefing.lesson.term) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {briefing.nextStep.title && (
        <section className={`${card} p-5`} aria-labelledby="ai-next-step">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ai-accent)]">
            <Footprints size={14} aria-hidden /> Próximo passo
          </p>
          <h3 id="ai-next-step" className="mt-2 text-[17px] font-semibold leading-[1.3] text-[var(--ai-text)]">{briefing.nextStep.title}</h3>
          {briefing.nextStep.detail && <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--ai-text-2)]">{briefing.nextStep.detail}</p>}
        </section>
      )}
      {briefing.lesson.term && (
        <section className={`${card} p-5`} aria-labelledby="ai-lesson">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ai-text-2)]">
            <BookOpen size={14} aria-hidden /> Para entender
          </p>
          <h3 id="ai-lesson" className="mt-2 text-[17px] font-semibold leading-[1.3] text-[var(--ai-text)]">{briefing.lesson.term}</h3>
          <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--ai-text-2)]">{briefing.lesson.explanation}</p>
        </section>
      )}
    </div>
  );
}

export function BriefingSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <div className={`${card} space-y-3 p-5 sm:p-7`}>
        <div className="ai-skeleton h-6 w-32" />
        <div className="ai-skeleton h-8 w-4/5" />
        <div className="ai-skeleton h-4 w-full" />
        <div className="ai-skeleton h-4 w-2/3" />
        <div className="grid grid-cols-2 gap-2 pt-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ai-skeleton h-16" />
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className={`${card} h-48 p-5`}><div className="ai-skeleton h-full" /></div>
        <div className={`${card} h-48 p-5`}><div className="ai-skeleton h-full" /></div>
      </div>
    </div>
  );
}
