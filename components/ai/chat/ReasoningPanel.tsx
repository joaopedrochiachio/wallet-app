"use client";

import React, { useState } from "react";
import { AlertTriangle, Check, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { Cofi } from "@/components/assistant/Cofi";
import { formatFactValue } from "@/lib/services/aiBriefingModel";
import type { PipelineStep, ReasoningStep, ReasoningVerification } from "@/lib/services/cofiReasoningService";

export interface StoredReasoning {
  understanding: string;
  steps: ReasoningStep[];
  pipeline: PipelineStep[];
  verification: ReasoningVerification;
  attempts: number;
}

function StepIcon({ status }: { status: PipelineStep["status"] }) {
  if (status === "running") return <Loader2 size={12} className="animate-spin text-[var(--ai-accent)]" aria-label="em andamento" />;
  if (status === "warning") return <AlertTriangle size={12} className="text-[var(--ai-warn)]" aria-label="atenção" />;
  return <Check size={12} strokeWidth={3} className="text-[var(--ai-good)]" aria-label="concluído" />;
}

/** Etapas executadas pelo app (leitura, projeção, padrões, conferência). */
export function PipelineList({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="space-y-1">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-2 text-[12.5px] leading-[1.4]">
          <span className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            <StepIcon status={s.status} />
          </span>
          <span className="min-w-0 text-[var(--ai-text-2)]">
            <span className="text-[var(--ai-text)]">{s.title}</span>
            {s.detail && <span className="text-[var(--ai-text-3)]"> · {s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** "Pensando": o que o Cofi está fazendo agora, ao vivo. */
export function LiveReasoning({ steps }: { steps: PipelineStep[] }) {
  const current = [...steps].reverse().find((s) => s.status === "running") ?? steps[steps.length - 1];
  const done = steps.filter((s) => s !== current);
  return (
    <div data-testid="ai-live-reasoning" role="status" aria-live="polite" className="cofi-rise">
      <div className="flex items-center gap-2">
        <Cofi state="pensando" size={22} />
        <span className="cofi-shimmer-text text-[14px] font-medium">{current ? `${current.title}…` : "Preparando seus números…"}</span>
      </div>
      {done.length > 0 && (
        <div className="ml-[10px] mt-2 border-l border-[var(--ai-line)] pl-4">
          <PipelineList steps={done} />
        </div>
      )}
      {current?.detail && <p className="ml-[30px] mt-1 text-[12px] text-[var(--ai-text-3)]">{current.detail}</p>}
    </div>
  );
}

/**
 * Raciocínio de uma resposta, no estilo "pensou por…" dos apps de IA: uma linha
 * discreta que abre a linha do tempo com o que foi entendido, cada etapa (com
 * os dados usados) e o resultado da conferência do app.
 */
export function ReasoningPanel({ reasoning, defaultOpen = false }: { reasoning: StoredReasoning; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const v = reasoning.verification;
  const n = reasoning.steps.length;
  return (
    <div data-testid="ai-reasoning">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="touch-min -ml-1 inline-flex max-w-full items-center gap-1.5 rounded-full px-1 py-1 text-[13px] text-[var(--ai-text-2)] outline-none transition-colors hover:text-[var(--ai-text)] focus-visible:shadow-[var(--mac-focus-ring)]"
      >
        <span>
          Raciocinou em {n} {n === 1 ? "etapa" : "etapas"}
        </span>
        <span className={`inline-flex items-center gap-0.5 font-medium ${v.ok ? "text-[var(--ai-good)]" : "text-[var(--ai-warn)]"}`}>
          · {v.ok ? <ShieldCheck size={12} aria-hidden /> : <AlertTriangle size={12} aria-hidden />}
          {v.ok ? "Conferido" : "Confira"}
        </span>
        <ChevronRight size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="cofi-rise ml-1 mt-1.5 space-y-3 border-l-2 border-[var(--ai-line)] pl-4 text-[13px] leading-[1.5]">
          {reasoning.understanding && (
            <p className="text-[var(--ai-text-2)]">
              <span className="font-semibold text-[var(--ai-text)]">O que entendi: </span>
              {reasoning.understanding}
            </p>
          )}

          {n > 0 && (
            <ol className="space-y-2.5">
              {reasoning.steps.map((s, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-[1px] flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[var(--ai-card)] font-mono text-[10px] font-semibold text-[var(--ai-text-2)] ring-1 ring-[var(--ai-line)]">
                    {i + 1}
                  </span>
                  <p className="font-medium text-[var(--ai-text)]">{s.title}</p>
                  {s.detail && <p className="text-[var(--ai-text-2)] [overflow-wrap:anywhere]">{s.detail}</p>}
                  {s.facts.length > 0 && (
                    <dl className="mt-1 space-y-0.5" aria-label="Dados usados nesta etapa">
                      {s.facts.map((f) => (
                        <div key={f.id} className="flex items-baseline gap-2 text-[11.5px]">
                          <dt className="min-w-0 truncate text-[var(--ai-text-3)]">{f.label}</dt>
                          <dd className="shrink-0 font-mono tabular-nums text-[var(--ai-text)]">{formatFactValue(f)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ol>
          )}

          {reasoning.pipeline.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--ai-text-3)]">O que o app fez</p>
              <PipelineList steps={reasoning.pipeline} />
            </div>
          )}

          <p className={`text-[12px] ${v.ok ? "text-[var(--ai-good)]" : "text-[var(--ai-warn)]"}`}>
            {v.ok ? (
              <>
                {v.numbersChecked} {v.numbersChecked === 1 ? "valor batido" : "valores batidos"} com seus dados
                {v.calculationsChecked ? ` e ${v.calculationsChecked} ${v.calculationsChecked === 1 ? "conta refeita" : "contas refeitas"}` : ""}.
                {reasoning.attempts > 1 ? " A primeira versão tinha um erro e foi corrigida." : ""}
              </>
            ) : (
              <>A conferência encontrou pontos que não batem: {v.problems.join(" ")}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
