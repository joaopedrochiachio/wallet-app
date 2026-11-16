"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Moon, Pencil, RefreshCw, Sun, AlertTriangle } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { Cofi, type CofiState } from "@/components/assistant/Cofi";
import { AttentionPoints, BriefingHero, BriefingSkeleton, NextStepAndLesson } from "@/components/ai/briefing/BriefingView";
import { CofiChat, type CofiChatHandle } from "@/components/ai/chat/CofiChat";
import { SpendingCalendarHeatmap } from "@/components/ai/SpendingCalendarHeatmap";
import { MacButton } from "@/components/ui/macos/Button";
import { MacTextField } from "@/components/ui/macos/TextField";
import { postAI, AIRequestError, summarizeProjections } from "@/lib/ai/clientRequests";
import type { AIBriefing, BriefingFact } from "@/lib/services/aiBriefingModel";
import { loadCachedBriefing, saveCachedBriefing, type CachedBriefing } from "@/lib/services/aiChatService";
import { calculateDailySafeSpend } from "@/lib/services/dailyCompanionService";
import { useAppTheme } from "@/lib/theme";

type Briefing = CachedBriefing<AIBriefing, BriefingFact>;

const TARGET_KEY = "wallet_monthly_target";
/** Informativo antigo com dados alterados é regenerado sozinho depois desse tempo. */
const AUTO_REFRESH_AFTER_MS = 30 * 60 * 1000;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function generatedLabel(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Atualizado hoje às ${time}` : `Atualizado em ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${time}`;
}

export default function AIPage() {
  const { user } = useAuth();
  const {
    userProfile,
    cards,
    transactions,
    recurringItems,
    goals,
    mainBalance,
    monthIncome,
    monthExpense,
    getMonthlyProjection,
    realizeRecurringItemNow,
    isDataLoaded,
  } = useWallet();
  const [theme, setTheme] = useAppTheme();
  const chatRef = useRef<CofiChatHandle>(null);

  // ---------- Meta de saldo do mês ----------
  const [target, setTarget] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = parseFloat(window.localStorage.getItem(TARGET_KEY) || "");
      if (!Number.isNaN(saved)) return saved;
    }
    return userProfile?.targetMonthEndBalance ?? 700;
  });
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const saveTarget = (value: number) => {
    setTarget(value);
    try {
      window.localStorage.setItem(TARGET_KEY, String(value));
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  };

  const currentMonth = getMonthlyProjection(0);
  const projectedFree = currentMonth?.projectedFreeBalance ?? mainBalance - monthExpense;
  const safeSpend = useMemo(
    () => calculateDailySafeSpend({ projectedFreeBalance: projectedFree, targetEndMonthBalance: target }),
    [projectedFree, target]
  );

  // ---------- Dados enviados à IA ----------
  const buildContextPayload = useCallback(
    () => ({
      userProfile,
      cards,
      transactions,
      recurringItems,
      goals,
      mainBalance,
      monthIncome,
      monthExpense,
      monthlyProjections: summarizeProjections(getMonthlyProjection),
      targetEndMonthBalance: target,
    }),
    [userProfile, cards, transactions, recurringItems, goals, mainBalance, monthIncome, monthExpense, getMonthlyProjection, target]
  );
  const signature = useMemo(
    () => [transactions.length, recurringItems.length, cards.length, goals.length, mainBalance.toFixed(2), monthIncome.toFixed(2), monthExpense.toFixed(2), target].join("|"),
    [transactions.length, recurringItems.length, cards.length, goals.length, mainBalance, monthIncome, monthExpense, target]
  );

  // ---------- Informativo ----------
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const generatingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      setBriefing(loadCachedBriefing<AIBriefing, BriefingFact>(user?.uid));
      setCacheChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const generate = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setIsGenerating(true);
    setBriefingError(null);
    try {
      const data = await postAI<{ briefing: AIBriefing; facts: BriefingFact[]; generatedAt: string; modelUsed?: string }>("/api/ai/briefing", buildContextPayload(), user);
      const next: Briefing = { briefing: data.briefing, facts: data.facts, generatedAt: data.generatedAt, modelUsed: data.modelUsed, signature };
      setBriefing(next);
      saveCachedBriefing(user?.uid, next);
    } catch (err) {
      setBriefingError(err instanceof AIRequestError ? err.message : "Não foi possível gerar o informativo agora.");
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }, [buildContextPayload, signature, user]);

  const isStale = Boolean(briefing && briefing.signature !== signature);
  const autoTriedRef = useRef(false);
  useEffect(() => {
    if (!cacheChecked || !isDataLoaded || autoTriedRef.current) return;
    const old = briefing ? Date.now() - new Date(briefing.generatedAt).getTime() : Infinity;
    if (!briefing || (isStale && old > AUTO_REFRESH_AFTER_MS)) {
      autoTriedRef.current = true;
      const timer = window.setTimeout(() => void generate(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [cacheChecked, isDataLoaded, briefing, isStale, generate]);

  // ---------- Calendário (recolhido; ?view=calendar abre direto) ----------
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("view") === "calendar") {
        setCalendarOpen(true);
        calendarRef.current?.scrollIntoView({ block: "start" });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const ask = useCallback((prompt: string) => chatRef.current?.ask(prompt), []);

  const firstName = (userProfile?.name || user?.displayName || "").trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const mood = briefing?.briefing.mood;
  const cofiState: CofiState = isGenerating ? "pensando" : briefingError && !briefing ? "erro" : mood === "critico" ? "alerta" : mood === "positivo" ? "sucesso" : "ocioso";
  const onTrack = projectedFree >= target;

  return (
    <div className="min-h-full w-full bg-[var(--ai-bg)] pb-28 text-[var(--ai-text)] md:pb-12">
      <div className="mx-auto w-full max-w-[1120px] space-y-4 px-4 pt-4 sm:px-6 sm:pt-6">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-center gap-3">
          <Cofi state={cofiState} size={52} label={`Cofi, seu assistente financeiro${isGenerating ? ", analisando" : ""}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[var(--ai-text-2)] first-letter:uppercase">
              {firstName ? `Olá, ${firstName} · ` : ""}
              {today}
            </p>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--ai-text)] sm:text-[28px]">Informativo do Cofi</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
              className="touch-target flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ai-card)] text-[var(--ai-text)] shadow-[var(--ai-shadow)] outline-none focus-visible:shadow-[var(--mac-focus-ring)]"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <MacButton
              variant="prominent"
              shape="capsule"
              size="large"
              onClick={() => void generate()}
              disabled={isGenerating}
              aria-label="Atualizar"
              title="Atualizar informativo"
              icon={<RefreshCw size={13} className={isGenerating ? "animate-spin" : undefined} />}
            >
              <span className="hidden sm:inline">{isGenerating ? "Gerando…" : "Atualizar"}</span>
            </MacButton>
          </div>
        </header>

        {/* Meta do mês */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-[var(--ai-card)] px-4 py-3 shadow-[var(--ai-shadow)]">
          <span className="text-[13px] text-[var(--ai-text-2)]">Meta para fechar o mês</span>
          {editingTarget ? (
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const n = parseFloat(targetDraft.replace(/\./g, "").replace(",", "."));
                if (!Number.isNaN(n) && n >= 0) saveTarget(n);
                setEditingTarget(false);
              }}
            >
              <MacTextField
                inputMode="decimal"
                aria-label="Meta de saldo no fim do mês"
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
                className="!w-28 font-mono"
                autoFocus
              />
              <MacButton type="submit" variant="prominent" size="small" shape="capsule">
                Salvar
              </MacButton>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTargetDraft(String(target).replace(".", ","));
                setEditingTarget(true);
              }}
              className="touch-target inline-flex items-center gap-1.5 font-mono text-[15px] font-semibold tabular-nums text-[var(--ai-text)] outline-none hover:text-[var(--ai-accent)] focus-visible:text-[var(--ai-accent)]"
              aria-label={`Editar meta: ${formatBRL(target)}`}
            >
              {formatBRL(target)} <Pencil size={13} className="text-[var(--ai-text-3)]" aria-hidden />
            </button>
          )}
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums ${onTrack ? "bg-[var(--ai-good-bg)] text-[var(--ai-good)]" : "bg-[var(--ai-bad-bg)] text-[var(--ai-bad)]"}`}
          >
            {onTrack ? `Folga de ${formatBRL(projectedFree - target)}` : `Faltam ${formatBRL(target - projectedFree)}`}
          </span>
        </div>

        {/* Avisos do informativo */}
        {briefingError && (
          <div role="alert" className="flex flex-wrap items-start gap-3 rounded-[16px] bg-[var(--ai-warn-bg)] px-4 py-3 text-[14px] text-[var(--ai-warn)]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">O Cofi não conseguiu gerar o informativo</p>
              <p className="mt-0.5 leading-[1.45]">
                {briefingError}
                {briefing ? " Abaixo está o último informativo gerado." : ""}
              </p>
            </div>
            <MacButton variant="bordered" size="small" shape="capsule" onClick={() => void generate()} icon={<RefreshCw size={11} />}>
              Tentar novamente
            </MacButton>
          </div>
        )}
        {isStale && !isGenerating && !briefingError && (
          <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-[var(--ai-accent-bg)] px-4 py-2.5 text-[14px] text-[var(--ai-text)]">
            <span className="min-w-0 flex-1">Seus números mudaram desde o último informativo.</span>
            <button type="button" onClick={() => void generate()} className="touch-target font-semibold text-[var(--ai-accent)] outline-none hover:underline focus-visible:underline">
              Atualizar agora
            </button>
          </div>
        )}

        {/* Informativo */}
        {isGenerating && !briefing ? (
          <div role="status" aria-label="Gerando informativo">
            <BriefingSkeleton />
          </div>
        ) : briefing ? (
          <div className={`space-y-4 transition-opacity ${isGenerating ? "opacity-60" : ""}`} aria-busy={isGenerating}>
            <BriefingHero briefing={briefing.briefing} facts={briefing.facts} generatedLabel={generatedLabel(briefing.generatedAt)} />
            <AttentionPoints briefing={briefing.briefing} facts={briefing.facts} onAsk={ask} />
            <NextStepAndLesson briefing={briefing.briefing} />
          </div>
        ) : (
          !briefingError && (
            <section className="flex flex-col items-center rounded-[20px] bg-[var(--ai-card)] px-5 py-10 text-center shadow-[var(--ai-shadow)]">
              <Cofi state="dormindo" size={64} />
              <h2 className="mt-3 text-[18px] font-semibold text-[var(--ai-text)]">Seu informativo ainda não foi gerado</h2>
              <p className="mt-1 max-w-sm text-[14px] leading-[1.5] text-[var(--ai-text-2)]">
                O Cofi lê seus números e mostra, em poucos minutos de leitura, o que vai bem e o que pede atenção.
              </p>
              <MacButton className="mt-4" variant="prominent" shape="capsule" size="large" onClick={() => void generate()}>
                Gerar meu informativo
              </MacButton>
            </section>
          )
        )}

        {/* Chat */}
        <CofiChat
          ref={chatRef}
          userId={user?.uid}
          user={user}
          cards={cards}
          suggestedQuestions={briefing?.briefing.suggestedQuestions ?? []}
          buildContextPayload={buildContextPayload}
        />

        {/* Calendário de gastos — recolhido por padrão */}
        <section ref={calendarRef} className="scroll-mt-4 overflow-hidden rounded-[20px] bg-[var(--ai-card)] shadow-[var(--ai-shadow)]">
          <h2>
            <button
              type="button"
              onClick={() => setCalendarOpen((v) => !v)}
              aria-expanded={calendarOpen}
              aria-controls="ai-calendar"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:bg-[var(--ai-card-2)] sm:px-5"
            >
              <CalendarDays size={18} className="text-[var(--ai-accent)]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-[var(--ai-text)]">Calendário de gastos</span>
                <span className="block text-[12px] text-[var(--ai-text-2)]">Entradas, contas e vencimentos dia a dia</span>
              </span>
              <ChevronDown size={18} className={`text-[var(--ai-text-2)] transition-transform ${calendarOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
          </h2>
          {calendarOpen && (
            <div id="ai-calendar" className="border-t border-[var(--ai-line)] sm:p-4">
              <SpendingCalendarHeatmap
                recurringItems={recurringItems}
                cards={cards}
                transactions={transactions}
                mainBalance={mainBalance}
                safeDailyAllowance={safeSpend.safeDailyAllowance}
                targetEndMonthBalance={target}
                monthlyProjection={currentMonth}
                onRealizeItem={realizeRecurringItemNow}
                onDiscussWithAI={ask}
              />
            </div>
          )}
        </section>

        <p className="px-1 pb-2 text-center text-[11px] leading-[1.5] text-[var(--ai-text-3)]">
          O Cofi usa só os números registrados no app e confere cada valor antes de mostrar. Ele organiza informações; não substitui uma recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
