"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Moon, RefreshCw, Sun } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { Cofi, type CofiState } from "@/components/assistant/Cofi";
import { AuditReport } from "@/components/ai/audit/AuditReport";
import { CofiChat, type CofiChatHandle, type PatternReaction } from "@/components/ai/chat/CofiChat";
import { usePatternMemory } from "@/components/ai/chat/usePatternMemory";
import { MoneyOverview } from "@/components/ai/money/MoneyOverview";
import { SpendingBreakdown } from "@/components/ai/money/SpendingBreakdown";
import { SpendingCalendarHeatmap } from "@/components/ai/SpendingCalendarHeatmap";
import { postAI, AIRequestError, summarizeProjections, localDateKey, recentTransactionsForAI } from "@/lib/ai/clientRequests";
import type { AIBriefing, BriefingFact } from "@/lib/services/aiBriefingModel";
import { loadCachedBriefing, loadRemoteBriefing, saveBriefing, type CachedBriefing } from "@/lib/services/aiChatService";
import { buildBriefingFacts } from "@/lib/services/briefingFacts";
import { buildPatternCatalog } from "@/lib/services/cofiPatterns";
import { calculateDailySafeSpend } from "@/lib/services/dailyCompanionService";
import { buildAnalyticsFromRequest } from "@/lib/services/financialAnalyticsService";
import { buildAuditFindings } from "@/lib/services/moneyViews";
import { getSpendingGuidance } from "@/lib/services/spendingGuidance";
import { MONTHLY_TARGET_KEY, useMonthlyTarget } from "@/lib/hooks/useMonthAnalytics";
import { useAppTheme } from "@/lib/theme";

type Briefing = CachedBriefing<AIBriefing, BriefingFact>;

/** "hoje, 16/11/2026 às 09:13" — data e hora completas da última análise. */
function analysisDateLabel(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const prefix = d.toDateString() === today.toDateString() ? "hoje, " : d.toDateString() === yesterday.toDateString() ? "ontem, " : "";
  return `${prefix}${date} às ${time}`;
}

/** "há 5 min", "há 3 h", "há 2 dias". */
function analysisAgeLabel(iso?: string, now = Date.now()) {
  if (!iso) return undefined;
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return undefined;
  // Negativo = análise feita depois do último "tique" do relógio da tela
  const min = Math.floor(Math.max(0, ms) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function AIPage() {
  const { user } = useAuth();
  const { userProfile, cards, transactions, recurringItems, goals, mainBalance, monthIncome, monthExpense, getMonthlyProjection, realizeRecurringItemNow, isDataLoaded } = useWallet();
  const [theme, setTheme] = useAppTheme();
  const chatRef = useRef<CofiChatHandle>(null);

  // ---------- Meta do mês (a mesma do painel do Cofi) ----------
  const target = useMonthlyTarget();
  const saveTarget = (value: number) => {
    try {
      window.localStorage.setItem(MONTHLY_TARGET_KEY, String(value));
      // Mesma aba não recebe o evento "storage" sozinha
      window.dispatchEvent(new StorageEvent("storage", { key: MONTHLY_TARGET_KEY }));
    } catch {
      /* sem armazenamento: a meta volta ao padrão do perfil */
    }
  };

  // ---------- Dados enviados à IA (e a mesma análise para as telas) ----------
  const buildContextPayload = useCallback(
    () => ({
      userProfile,
      cards,
      transactions: recentTransactionsForAI(transactions),
      recurringItems,
      goals,
      mainBalance,
      monthIncome,
      monthExpense,
      monthlyProjections: summarizeProjections(getMonthlyProjection),
      targetEndMonthBalance: target,
      clientDate: localDateKey(),
    }),
    [userProfile, cards, transactions, recurringItems, goals, mainBalance, monthIncome, monthExpense, getMonthlyProjection, target]
  );
  const analytics = useMemo(() => {
    try {
      return buildAnalyticsFromRequest(buildContextPayload());
    } catch {
      return null;
    }
  }, [buildContextPayload]);
  const guidance = useMemo(() => (analytics ? getSpendingGuidance(analytics) : null), [analytics]);
  const liveFacts = useMemo(() => (analytics ? buildBriefingFacts(analytics) : []), [analytics]);
  const patternCatalog = useMemo(() => (isDataLoaded ? buildPatternCatalog(analytics) : []), [analytics, isDataLoaded]);
  const [patternMemory, updatePatternMemory] = usePatternMemory(user?.uid);

  const signature = useMemo(
    () => [transactions.length, recurringItems.length, cards.length, goals.length, mainBalance.toFixed(2), monthIncome.toFixed(2), monthExpense.toFixed(2), target].join("|"),
    [transactions.length, recurringItems.length, cards.length, goals.length, mainBalance, monthIncome, monthExpense, target]
  );

  // ---------- Parecer da IA (só quando a pessoa pede) ----------
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
    });
    loadRemoteBriefing<AIBriefing, BriefingFact>(user?.uid)
      .then((saved) => {
        if (alive && saved) setBriefing((current) => (current && new Date(current.generatedAt) > new Date(saved.generatedAt) ? current : saved));
      })
      .finally(() => {
        if (alive) setCacheChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  // Atualiza o "há X min" sem chamar a IA.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const generate = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setIsGenerating(true);
    setBriefingError(null);
    try {
      const data = await postAI<{ briefing: AIBriefing; facts: BriefingFact[]; generatedAt: string; modelUsed?: string }>("/api/ai/briefing", buildContextPayload(), user);
      const next: Briefing = { briefing: data.briefing, facts: data.facts, generatedAt: data.generatedAt, modelUsed: data.modelUsed, signature };
      setBriefing(next);
      void saveBriefing(user?.uid, next);
    } catch (err) {
      setBriefingError(err instanceof AIRequestError ? err.message : "Não foi possível gerar a análise agora.");
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }, [buildContextPayload, signature, user]);

  const isStale = Boolean(briefing && isDataLoaded && briefing.signature !== signature);

  // Achados: parecer da IA + padrões do app, sem repetir assunto
  const findings = useMemo(() => {
    const briefingIds = new Set((briefing?.facts ?? []).map((f) => f.id));
    const facts = briefing ? [...briefing.facts, ...liveFacts.filter((f) => !briefingIds.has(f.id))] : liveFacts;
    return buildAuditFindings({ briefing: briefing?.briefing ?? null, facts, catalog: patternCatalog, memory: patternMemory });
  }, [briefing, liveFacts, patternCatalog, patternMemory]);

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
  const onPatternReaction = useCallback((key: string, reaction: PatternReaction) => {
    // Na auditoria, "acompanhar" só marca (sem chamar a IA)
    chatRef.current?.reactToPattern(key, reaction === "reduzir" ? "acompanhar" : reaction);
  }, []);

  const currentMonth = getMonthlyProjection(0);
  const safeSpend = useMemo(
    () => calculateDailySafeSpend({ projectedFreeBalance: currentMonth?.projectedFreeBalance ?? mainBalance - monthExpense, targetEndMonthBalance: target }),
    [currentMonth?.projectedFreeBalance, mainBalance, monthExpense, target]
  );

  const firstName = (userProfile?.name || user?.displayName || "").trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const mood = briefing?.briefing.mood;
  const cofiState: CofiState = isGenerating ? "pensando" : briefingError && !briefing ? "erro" : mood === "critico" ? "alerta" : mood === "positivo" ? "sucesso" : "ocioso";

  return (
    <div className="min-h-full w-full bg-[var(--ai-bg)] text-[var(--ai-text)]">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6 sm:pt-6 md:pb-12">
        {/* Cabeçalho */}
        <header className="flex items-center gap-3">
          <Cofi state={cofiState} size={44} label={`Cofi, seu auditor financeiro${isGenerating ? ", analisando" : ""}`} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.025em] text-[var(--ai-text)] sm:text-[30px]">Wallet+ IA</h1>
            <p className="truncate text-[13px] text-[var(--ai-text-2)] first-letter:uppercase">
              {firstName ? `${greeting()}, ${firstName} · ` : ""}
              {today}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ai-card)] text-[var(--ai-text)] shadow-[var(--ai-shadow)] outline-none focus-visible:shadow-[var(--mac-focus-ring)]"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={isGenerating}
            aria-label="Gerar nova análise"
            title="Gerar uma nova análise com os números de agora"
            className="touch-min inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--ai-text)] px-3.5 text-[13px] font-semibold text-[var(--ai-card)] outline-none transition-opacity disabled:opacity-60 focus-visible:shadow-[var(--mac-focus-ring)]"
          >
            <RefreshCw size={13} className={isGenerating ? "animate-spin" : undefined} aria-hidden />
            <span className="hidden sm:inline">{isGenerating ? "Analisando…" : "Nova análise"}</span>
          </button>
        </header>

        <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-start lg:gap-5">
          <div className="min-w-0 space-y-4">
            {analytics && guidance && <MoneyOverview analytics={analytics} guidance={guidance} target={target} onSaveTarget={saveTarget} onAsk={ask} />}

            <AuditReport
              briefing={briefing?.briefing ?? null}
              facts={briefing?.facts ?? liveFacts}
              attention={findings.attention}
              favorable={findings.favorable}
              cacheChecked={cacheChecked}
              isGenerating={isGenerating}
              isStale={isStale}
              error={briefingError}
              lastAnalysisDate={analysisDateLabel(briefing?.generatedAt)}
              lastAnalysisAge={analysisAgeLabel(briefing?.generatedAt, now)}
              onGenerate={() => void generate()}
              onAsk={ask}
              onPatternReaction={onPatternReaction}
            />

            {analytics && <SpendingBreakdown analytics={analytics} onAsk={ask} />}

            {/* Calendário de gastos — recolhido por padrão */}
            <section ref={calendarRef} className="scroll-mt-4 overflow-hidden rounded-[24px] bg-[var(--ai-card)] shadow-[var(--ai-shadow)]">
              <h2>
                <button
                  type="button"
                  onClick={() => setCalendarOpen((v) => !v)}
                  aria-expanded={calendarOpen}
                  aria-controls="ai-calendar"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:bg-[var(--ai-card-2)] sm:px-6"
                >
                  <CalendarDays size={18} className="text-[var(--ai-accent)]" aria-hidden />
                  <span className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--ai-text)]">Calendário de gastos</span>
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

            <p className="px-1 text-center text-[11px] leading-[1.5] text-[var(--ai-text-3)]">
              Números calculados pelo app a partir dos seus lançamentos. O Cofi confere cada valor que cita; ele organiza informações e não substitui recomendação de investimento.
            </p>
          </div>

          {/* Chat: coluna fixa no computador, barra + tela cheia no celular */}
          <aside className="mt-4 lg:sticky lg:top-[4.25rem] lg:mt-0 lg:h-[calc(100dvh-5.5rem)]" aria-label="Conversa com o Cofi">
            <CofiChat
              ref={chatRef}
              userId={user?.uid}
              user={user}
              cards={cards}
              suggestedQuestions={briefing?.briefing.suggestedQuestions ?? []}
              buildContextPayload={buildContextPayload}
              patternCatalog={patternCatalog}
              patternMemory={patternMemory}
              onPatternMemoryChange={updatePatternMemory}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
