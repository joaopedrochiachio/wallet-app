"use client";

import React, { useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, Check, ChevronDown, Clock, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Cofi } from "@/components/assistant/Cofi";
import { formatFactValue, type AIBriefing, type BriefingFact } from "@/lib/services/aiBriefingModel";
import type { AuditFinding, FindingTone } from "@/lib/services/moneyViews";
import type { PatternReaction } from "@/components/ai/chat/CofiChat";

const DOT: Record<FindingTone, string> = {
  critico: "bg-[var(--ai-bad)]",
  atencao: "bg-[var(--ai-warn)]",
  leve: "bg-[var(--ai-text-3)]",
  positivo: "bg-[var(--ai-good)]",
};
const VALUE_TONE: Record<FindingTone, string> = {
  critico: "text-[var(--ai-bad)]",
  atencao: "text-[var(--ai-warn)]",
  leve: "text-[var(--ai-text)]",
  positivo: "text-[var(--ai-good)]",
};

export interface AuditReportProps {
  briefing: AIBriefing | null;
  facts: BriefingFact[];
  attention: AuditFinding[];
  favorable: AuditFinding[];
  cacheChecked: boolean;
  isGenerating: boolean;
  isStale: boolean;
  error: string | null;
  lastAnalysisDate?: string;
  lastAnalysisAge?: string;
  onGenerate: () => void;
  onAsk: (prompt: string) => void;
  onPatternReaction: (key: string, reaction: PatternReaction) => void;
}

/**
 * O Cofi como auditor: parecer da IA (gerado só quando a pessoa pede) e os
 * achados, cada um com o número que importa, a ação e os dados conferidos.
 */
export function AuditReport(props: AuditReportProps) {
  const { briefing, attention, favorable, cacheChecked, isGenerating, isStale, error, lastAnalysisDate, lastAnalysisAge, onGenerate, onAsk, onPatternReaction } = props;
  // Até a pessoa escolher, o achado mais grave fica aberto (mesmo se a análise carregar depois)
  const [openChoice, setOpenChoice] = useState<string | null | undefined>(undefined);
  const openId = openChoice === undefined ? (attention[0]?.id ?? null) : openChoice;
  const setOpenId = (id: string | null) => setOpenChoice(id);
  const [lessonOpen, setLessonOpen] = useState(false);
  const mood = briefing?.mood;
  const cofiState = isGenerating ? "pensando" : mood === "critico" ? "alerta" : mood === "positivo" ? "sucesso" : "ocioso";

  return (
    <section aria-labelledby="audit-title" className="overflow-hidden rounded-[24px] bg-[var(--ai-card)] shadow-[var(--ai-shadow)]">
      <header className="flex items-center gap-3 px-4 pb-1 pt-4 sm:px-6 sm:pt-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ai-accent-bg)] text-[var(--ai-accent)]" aria-hidden>
          <ShieldCheck size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="audit-title" className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--ai-text)]">
            Auditoria do Cofi
          </h2>
          {briefing && lastAnalysisDate ? (
            <p data-testid="last-analysis" className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-[var(--ai-text-2)]">
              <Clock size={11} aria-hidden />
              <span>{isGenerating ? "Gerando nova análise…" : `Última análise: ${lastAnalysisDate}`}</span>
              {!isGenerating && lastAnalysisAge && <span>({lastAnalysisAge})</span>}
              {isStale && !isGenerating && (
                <>
                  <span className="text-[var(--ai-accent)]">· Seus números mudaram depois dessa análise.</span>
                  <button type="button" onClick={onGenerate} className="touch-target font-semibold text-[var(--ai-accent)] underline-offset-2 outline-none hover:underline focus-visible:underline">
                    Gerar nova análise
                  </button>
                </>
              )}
              {!isStale && !isGenerating && <span className="sr-only">A análise só é refeita quando você pedir.</span>}
            </p>
          ) : (
            <p className="text-[12px] text-[var(--ai-text-2)]">Pontos calculados pelo app. O parecer da IA só é gerado quando você pede.</p>
          )}
        </div>
      </header>

      {error && (
        <div role="alert" className="mx-4 mt-3 flex flex-wrap items-start gap-3 rounded-[14px] bg-[var(--ai-warn-bg)] px-3.5 py-3 text-[13px] text-[var(--ai-warn)] sm:mx-6">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">O Cofi não conseguiu gerar a análise</p>
            <p className="mt-0.5 leading-[1.45]">
              {error}
              {briefing ? " Abaixo está o último informativo gerado." : ""}
            </p>
          </div>
          <button type="button" onClick={onGenerate} className="touch-target inline-flex items-center gap-1 rounded-full bg-[var(--ai-card)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ai-text)] outline-none focus-visible:shadow-[var(--mac-focus-ring)]">
            <RefreshCw size={11} aria-hidden /> Tentar novamente
          </button>
        </div>
      )}

      {/* Parecer */}
      <div className="px-4 pt-3 sm:px-6">
        {!cacheChecked && !briefing ? (
          <div role="status" aria-label="Carregando a última análise" className="space-y-2 py-1">
            <div className="ai-skeleton h-6 w-3/4" />
            <div className="ai-skeleton h-4 w-full" />
          </div>
        ) : isGenerating && !briefing ? (
          <div role="status" aria-label="Gerando informativo" className="flex items-center gap-3 py-2">
            <Cofi state="pensando" size={36} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="ai-skeleton h-5 w-2/3" />
              <div className="ai-skeleton h-4 w-full" />
            </div>
          </div>
        ) : briefing ? (
          <div className={isGenerating ? "opacity-60 transition-opacity" : undefined} aria-busy={isGenerating}>
            <h3 id="ai-headline" className="text-[21px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--ai-text)] sm:text-[24px]">
              {briefing.headline}
            </h3>
            <p className="mt-1.5 text-[15px] leading-[1.5] text-[var(--ai-text-2)]">{briefing.summary}</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-[var(--ai-card-2)] px-3.5 py-3">
            <Cofi state={cofiState} size={36} />
            <p className="min-w-0 flex-1 text-[14px] leading-[1.45] text-[var(--ai-text-2)]">
              <span className="block font-semibold text-[var(--ai-text)]">Você ainda não tem uma análise</span>
              O parecer da IA lê o mês inteiro e confere cada valor. Ele fica salvo e só é refeito quando você pedir.
            </p>
            <button type="button" onClick={onGenerate} className="touch-min rounded-full bg-[var(--ai-text)] px-4 py-2 text-[14px] font-semibold text-[var(--ai-card)] outline-none focus-visible:shadow-[var(--mac-focus-ring)]">
              Gerar minha análise
            </button>
          </div>
        )}
      </div>

      {/* Achados */}
      {attention.length > 0 && (
        <div className="mt-3">
          <h3 className="sr-only">Pede atenção</h3>
          <ul className="divide-y divide-[var(--ai-line)] border-t border-[var(--ai-line)]">
            {attention.map((f) => (
              <FindingRow key={f.id} finding={f} open={openId === f.id} onToggle={() => setOpenId(openId === f.id ? null : f.id)} onAsk={onAsk} onPatternReaction={onPatternReaction} />
            ))}
          </ul>
        </div>
      )}

      {favorable.length > 0 && (
        <div className="mt-1">
          <h3 className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--ai-text-3)] sm:px-6">A seu favor</h3>
          <ul className="divide-y divide-[var(--ai-line)] border-t border-[var(--ai-line)]">
            {favorable.map((f) => (
              <FindingRow key={f.id} finding={f} open={openId === f.id} onToggle={() => setOpenId(openId === f.id ? null : f.id)} onAsk={onAsk} onPatternReaction={onPatternReaction} />
            ))}
          </ul>
        </div>
      )}

      {/* Próximo passo e conceito */}
      {briefing && (
        <div className="space-y-2 border-t border-[var(--ai-line)] px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-[16px] bg-[var(--ai-accent-bg)] px-3.5 py-3">
            <ArrowRight size={17} className="mt-0.5 shrink-0 text-[var(--ai-accent)]" aria-hidden />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--ai-text)]">{briefing.nextStep.title}</p>
              <p className="mt-0.5 text-[13px] leading-[1.45] text-[var(--ai-text-2)]">{briefing.nextStep.detail}</p>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={lessonOpen}
            onClick={() => setLessonOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-[12px] px-1 py-1.5 text-left text-[13px] text-[var(--ai-text-2)] outline-none hover:text-[var(--ai-text)] focus-visible:shadow-[var(--mac-focus-ring)]"
          >
            <BookOpen size={14} aria-hidden />
            <span className="min-w-0 flex-1">
              Entenda: <span className="font-semibold text-[var(--ai-text)]">{briefing.lesson.term}</span>
            </span>
            <ChevronDown size={14} className={`transition-transform ${lessonOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {lessonOpen && <p className="px-1 pl-7 text-[13px] leading-[1.5] text-[var(--ai-text-2)]">{briefing.lesson.explanation}</p>}
        </div>
      )}
    </section>
  );
}

function FindingRow({
  finding: f,
  open,
  onToggle,
  onAsk,
  onPatternReaction,
}: {
  finding: AuditFinding;
  open: boolean;
  onToggle: () => void;
  onAsk: (prompt: string) => void;
  onPatternReaction: (key: string, reaction: PatternReaction) => void;
}) {
  const panelId = `finding-${f.id.replace(/[^a-z0-9]+/gi, "-")}`;
  const tracking = f.patternStatus === "acompanhar";
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-[var(--ai-card-2)] focus-visible:bg-[var(--ai-card-2)] sm:px-6"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[f.tone]}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-[1.3] text-[var(--ai-text)]">{f.title}</span>
          {tracking && <span className="mt-0.5 block text-[11px] font-semibold text-[var(--ai-accent)]">Acompanhando</span>}
        </span>
        {f.value && <span className={`shrink-0 font-mono text-[14px] font-semibold tabular-nums ${VALUE_TONE[f.tone]}`}>{formatFactValue(f.value)}</span>}
        <ChevronDown size={15} className={`shrink-0 text-[var(--ai-text-3)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div id={panelId} className="space-y-3 px-4 pb-4 pl-9 sm:px-6 sm:pl-11">
          <p className="text-[14px] leading-[1.5] text-[var(--ai-text-2)]">{f.explanation}</p>
          {f.action && (
            <p className="flex items-start gap-2 text-[14px] font-semibold leading-[1.4] text-[var(--ai-text)]">
              <ArrowRight size={15} className="mt-0.5 shrink-0 text-[var(--ai-accent)]" aria-hidden />
              {f.action}
            </p>
          )}

          {f.evidence.length > 0 && (
            <div className="rounded-[12px] bg-[var(--ai-card-2)] px-3 py-2">
              <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--ai-text-3)]">
                <Check size={11} strokeWidth={3} className="text-[var(--ai-good)]" aria-hidden />
                {f.source === "ia" ? "Valores conferidos com seus dados" : "Calculado pelo app com seus dados"}
              </p>
              <dl className="space-y-0.5">
                {f.evidence.slice(0, 4).map((e) => (
                  <div key={e.id} className="flex items-baseline justify-between gap-3 text-[12px]">
                    <dt className="min-w-0 truncate text-[var(--ai-text-2)]">{e.label}</dt>
                    <dd className="shrink-0 font-mono tabular-nums text-[var(--ai-text)]">{formatFactValue(e)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onAsk(`Me explique melhor este ponto e como resolver: "${f.title}".`)}
              className="touch-min inline-flex items-center gap-1.5 rounded-full bg-[var(--ai-text)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--ai-card)] outline-none focus-visible:shadow-[var(--mac-focus-ring)]"
            >
              <MessageCircle size={13} aria-hidden /> Perguntar ao Cofi
            </button>
            {f.patternKey && f.tone !== "positivo" && !tracking && (
              <button
                type="button"
                onClick={() => onPatternReaction(f.patternKey!, "reduzir")}
                className="touch-min rounded-full border border-[var(--ai-line)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--ai-text)] outline-none hover:bg-[var(--ai-card-2)] focus-visible:shadow-[var(--mac-focus-ring)]"
              >
                Acompanhar
              </button>
            )}
            {f.patternKey && f.tone !== "positivo" && (
              <button
                type="button"
                onClick={() => onPatternReaction(f.patternKey!, "esperado")}
                className="touch-min rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--ai-text-2)] outline-none hover:text-[var(--ai-text)] focus-visible:shadow-[var(--mac-focus-ring)]"
              >
                É esperado
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
