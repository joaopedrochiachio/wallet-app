"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  MessageCircleQuestion,
  MessagesSquare,
  PanelLeft,
  RefreshCw,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { Cofi } from "@/components/assistant/Cofi";
import { FormattedMessage } from "@/components/ai/FormattedMessage";
import { LiveReasoning, ReasoningPanel, type StoredReasoning } from "@/components/ai/chat/ReasoningPanel";
import { PopUpButton } from "@/components/ui/macos/PopUpButton";
import { MacSegmentedControl } from "@/components/ui/macos/SegmentedControl";
import { MacFormRow, MacTextField } from "@/components/ui/macos/TextField";
import { postAIStream, AIRequestError, localDateKey } from "@/lib/ai/clientRequests";
import { ChatSession, createChatSession, loadChatSessions, saveChatSessions } from "@/lib/services/aiChatService";
import { memoryForRequest, type CofiPattern, type PatternMemory, type PatternStatus } from "@/lib/services/cofiPatterns";
import type { PipelineStep } from "@/lib/services/cofiReasoningService";
import type { PurchaseSimulationResult } from "@/lib/services/financialContextService";
import type { CardItem } from "@/types";

interface ChatPatternRef {
  key: string;
  title: string;
  observation: string;
}

interface ChatFollowUp {
  question: string;
  patternKey: string;
  patternTitle: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  modelUsed?: string;
  simulationResult?: PurchaseSimulationResult | null;
  reasoning?: StoredReasoning;
  patterns?: ChatPatternRef[];
  followUp?: ChatFollowUp | null;
}

interface ChatReply {
  message: string;
  modelUsed?: string;
  simulationResult?: PurchaseSimulationResult | null;
  reasoning?: StoredReasoning;
  patterns?: ChatPatternRef[];
  followUp?: ChatFollowUp | null;
}

/** Reação da pessoa a um padrão: vira status na memória do Cofi. */
export type PatternReaction = "reduzir" | "acompanhar" | "esperado" | "explicar" | "ignorar" | "conversar";
const REACTION_STATUS: Record<PatternReaction, PatternStatus> = {
  reduzir: "acompanhar",
  acompanhar: "acompanhar",
  esperado: "esperado",
  explicar: "conversado",
  ignorar: "ignorado",
  conversar: "conversado",
};

interface SimulationPayload {
  amount: number;
  method: "cash" | "credit";
  installments: number;
  cardId: string;
  description: string;
}

export interface CofiChatHandle {
  /** Envia uma pergunta (ex.: vinda da auditoria) e mostra o chat. */
  ask: (text: string) => void;
  /** Reação a um padrão vinda de fora do chat (ex.: "Acompanhar" na auditoria). */
  reactToPattern: (key: string, reaction: PatternReaction) => void;
}

interface CofiChatProps {
  userId?: string;
  user?: { getIdToken: (forceRefresh?: boolean) => Promise<string> } | null;
  cards: CardItem[];
  suggestedQuestions: string[];
  /** Dados financeiros enviados junto com cada pergunta. */
  buildContextPayload: () => Record<string, unknown>;
  /** Padrões calculados pelo app (mesma regra do servidor). */
  patternCatalog?: CofiPattern[];
  patternMemory: PatternMemory;
  /** Aplica a mudança e devolve a memória nova. */
  onPatternMemoryChange: (change: (current: PatternMemory) => PatternMemory) => PatternMemory;
}

const FALLBACK_QUESTIONS = ["Quanto posso gastar por dia até o fim do mês?", "Qual conta eu devo pagar primeiro?", "Onde eu consigo economizar este mês?"];

const nowLabel = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Celular: abaixo do breakpoint md do Tailwind. */
const MOBILE_QUERY = "(max-width: 767px)";
function subscribeMobile(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
}

/**
 * Área visível de verdade (descontando o teclado do celular). Com ela a tela
 * cheia do chat mantém o campo de digitação acima do teclado no iOS/Android.
 */
function useVisualViewport(active: boolean) {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => setBox({ height: vv.height, top: vv.offsetTop });
    const frame = window.requestAnimationFrame(update);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      window.cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setBox(null);
    };
  }, [active]);
  return active ? box : null;
}

/** Agrupa conversas como no app do Claude: Hoje, Ontem, 7 dias, Mais antigas. */
function groupSessions(sessions: ChatSession[]) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  const groups: Array<{ label: string; items: ChatSession[] }> = [
    { label: "Hoje", items: [] },
    { label: "Ontem", items: [] },
    { label: "Últimos 7 dias", items: [] },
    { label: "Mais antigas", items: [] },
  ];
  for (const s of sessions) {
    const t = new Date(s.updatedAt).getTime();
    const idx = t >= startToday ? 0 : t >= startToday - day ? 1 : t >= startToday - 7 * day ? 2 : 3;
    groups[idx].items.push(s);
  }
  return groups.filter((g) => g.items.length);
}

export const CofiChat = forwardRef<CofiChatHandle, CofiChatProps>(function CofiChat(
  { userId, user, cards, suggestedQuestions, buildContextPayload, patternCatalog = [], patternMemory, onPatternMemoryChange },
  ref
) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<{ message: string; text: string; simulation?: SimulationPayload; sessionId: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<PipelineStep[]>([]);
  const [freshReplyId, setFreshReplyId] = useState<string | null>(null);
  const [settledFollowUps, setSettledFollowUps] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");

  const [isSimOpen, setIsSimOpen] = useState(false);
  const [simAmount, setSimAmount] = useState("1200");
  const [simMethod, setSimMethod] = useState<"cash" | "credit">("credit");
  const [simInstallments, setSimInstallments] = useState(6);
  const [simCardId, setSimCardId] = useState("");
  const [simDescription, setSimDescription] = useState("Novo celular");

  const sectionRef = useRef<HTMLElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  const creditCards = cards.filter((c) => c.type === "credit");
  const activeSimCardId = simCardId || creditCards[0]?.id || "";

  // No celular: barra de pergunta fixa acima da barra de abas; a conversa abre
  // em tela cheia (uma rolagem só, campo sempre visível acima do teclado).
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const fullscreen = isMobile && expanded;
  const docked = isMobile && !expanded;
  const viewport = useVisualViewport(fullscreen);
  const expandOnMobile = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) setExpanded(true);
  }, [setExpanded]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  useEffect(() => {
    let alive = true;
    loadChatSessions(userId).then((saved) => {
      if (!alive) return;
      if (saved.length) {
        setSessions(saved);
        setActiveSessionId(saved[0].id);
        setMessages((saved[0].messages as ChatMessage[]) || []);
      } else {
        const first = createChatSession("Nova conversa");
        setSessions([first]);
        setActiveSessionId(first.id);
        setMessages([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Rolagem: enviando, vai ao fim; chegou resposta, mostra a pergunta no topo
  // para ler a resposta desde o começo.
  const lastMessage = messages[messages.length - 1];
  const scrollKey = `${lastMessage?.id ?? "none"}|${isSending ? 1 : 0}|${fullscreen ? 1 : 0}`;
  const lastScrollKey = useRef("");
  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed || lastScrollKey.current === scrollKey) return;
    const firstRun = lastScrollKey.current === "";
    lastScrollKey.current = scrollKey;
    window.requestAnimationFrame(() => {
      const behavior: ScrollBehavior = firstRun ? "auto" : "smooth";
      if (!isSending && lastMessage?.role === "assistant") {
        const question = messages[messages.length - 2];
        const anchor = question?.role === "user" ? feed.querySelector<HTMLElement>(`[data-msg-id="${question.id}"]`) : feed.querySelector<HTMLElement>(`[data-msg-id="${lastMessage.id}"]`);
        if (anchor) {
          feed.scrollTo({ top: Math.max(0, anchor.offsetTop - 12), behavior });
          return;
        }
      }
      feed.scrollTo({ top: feed.scrollHeight, behavior });
    });
  }, [scrollKey, isSending, lastMessage, messages]);

  useEffect(() => {
    if (!isSending || !liveSteps.length) return;
    const feed = feedRef.current;
    if (feed) window.requestAnimationFrame(() => feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" }));
  }, [isSending, liveSteps]);

  const send = useCallback(
    async (rawText?: string, simulation?: SimulationPayload, options?: { retry?: boolean; memory?: PatternMemory }) => {
      if (sendingRef.current) return;
      const text = (rawText ?? input).trim();
      if (!text) return;
      sendingRef.current = true;
      setChatError(null);
      setHistoryOpen(false);
      expandOnMobile();

      const session = sessions.find((s) => s.id === activeSessionId) || sessions[0] || createChatSession("Nova conversa");
      const history = (session.messages as ChatMessage[]) || [];
      const isRetry = Boolean(options?.retry) && history[history.length - 1]?.role === "user";
      const previous = isRetry ? history.slice(0, -1) : history;
      const userMsg: ChatMessage = { id: globalThis.crypto.randomUUID(), role: "user", content: text, timestamp: nowLabel() };
      const withQuestion = isRetry ? history : [...previous, userMsg];
      const title = !history.length || /^Nova (conversa|consulta)$/i.test(session.title) ? (text.length > 40 ? `${text.slice(0, 38)}…` : text) : session.title;

      const pending: ChatSession = { ...session, title, updatedAt: new Date().toISOString(), messages: withQuestion };
      const pendingList = [pending, ...sessions.filter((s) => s.id !== session.id)];
      setMessages(withQuestion);
      setSessions(pendingList);
      setActiveSessionId(session.id);
      void saveChatSessions(pendingList, userId);
      if (rawText === undefined) {
        setInput("");
        if (inputRef.current) inputRef.current.style.height = "auto";
      }
      setIsSending(true);
      setLiveSteps([]);

      try {
        const data = await postAIStream<ChatReply>(
          "/api/ai/chat",
          {
            ...buildContextPayload(),
            messages: previous.map((m) => ({ role: m.role, content: m.content })),
            userMessage: text,
            simulation,
            patternMemory: memoryForRequest(patternCatalog, options?.memory ?? patternMemory),
          },
          user,
          (event) => {
            if (event.type !== "step" || !event.step) return;
            const step = event.step as PipelineStep;
            setLiveSteps((prev) => {
              const idx = prev.findIndex((s) => s.id === step.id);
              if (idx === -1) return [...prev, step];
              const next = [...prev];
              next[idx] = step;
              return next;
            });
          }
        );
        const reply: ChatMessage = {
          id: globalThis.crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          timestamp: nowLabel(),
          modelUsed: data.modelUsed,
          simulationResult: data.simulationResult,
          reasoning: data.reasoning,
          patterns: data.patterns?.length ? data.patterns : undefined,
          followUp: data.followUp?.question ? data.followUp : null,
        };
        const finalMessages = [...withQuestion, reply];
        const finalList = [{ ...pending, updatedAt: new Date().toISOString(), messages: finalMessages }, ...sessions.filter((s) => s.id !== session.id)];
        setMessages(finalMessages);
        setSessions(finalList);
        setFreshReplyId(reply.id);
        void saveChatSessions(finalList, userId);

        // O Cofi falou de um padrão: guarda a observação para retomar depois
        if (reply.patterns?.length) {
          const at = new Date().toISOString();
          onPatternMemoryChange((current) => {
            const next = { ...current };
            for (const p of reply.patterns!) {
              const prev = next[p.key];
              next[p.key] = {
                key: p.key,
                title: p.title,
                status: prev?.status && prev.status !== "novo" ? prev.status : "conversado",
                updatedAt: at,
                baseline: prev?.baseline,
                lastObservation: p.observation || prev?.lastObservation,
                timesDiscussed: (prev?.timesDiscussed ?? 0) + 1,
              };
            }
            return next;
          });
        }
      } catch (err) {
        // Sem resposta inventada: mostra o motivo real e permite tentar de novo.
        setChatError({
          message: err instanceof AIRequestError ? err.message : "Não consegui falar com o servidor. Tente novamente.",
          text,
          simulation,
          sessionId: session.id,
        });
      } finally {
        sendingRef.current = false;
        setIsSending(false);
        setLiveSteps([]);
      }
    },
    [activeSessionId, buildContextPayload, expandOnMobile, input, onPatternMemoryChange, patternCatalog, patternMemory, sessions, user, userId]
  );

  /**
   * Reação a um padrão: vira status na memória (regra do app, não da IA) e só
   * chama a IA quando a pessoa quer conversar.
   */
  const reactToPattern = useCallback(
    (key: string, reaction: PatternReaction, origin?: { messageId: string }) => {
      const pattern = patternCatalog.find((p) => p.key === key);
      const title = pattern?.title ?? patternMemory[key]?.title ?? "esse padrão";
      const at = new Date().toISOString();
      const nextMemory = onPatternMemoryChange((current) => {
        const prev = current[key];
        const status = REACTION_STATUS[reaction];
        return {
          ...current,
          [key]: {
            key,
            title,
            status,
            updatedAt: at,
            // Ao pedir para acompanhar, guarda o valor de hoje para comparar depois
            baseline:
              status === "acompanhar" && pattern
                ? { value: pattern.metric.value, kind: pattern.metric.kind, at: localDateKey(), period: localDateKey().slice(0, 7) }
                : prev?.baseline,
            lastObservation: prev?.lastObservation,
            timesDiscussed: prev?.timesDiscussed ?? 0,
          },
        };
      });
      if (origin) setSettledFollowUps((s) => ({ ...s, [origin.messageId]: reaction }));

      // A pergunta já sai com a memória atualizada (o estado só muda no próximo render)
      const opts = { memory: nextMemory };
      if (reaction === "reduzir") void send(`Quero reduzir isso: "${title}". Me ajuda a montar um plano e acompanha comigo?`, undefined, opts);
      else if (reaction === "explicar") void send(`Me explica melhor este padrão: "${title}". Por que ele aparece e o que eu faço?`, undefined, opts);
      else if (reaction === "conversar") void send(`Você notou este padrão: "${title}". ${pattern?.detail ?? ""} O que isso significa para mim e o que eu faço?`.trim(), undefined, opts);
    },
    [onPatternMemoryChange, patternCatalog, patternMemory, send]
  );

  useImperativeHandle(
    ref,
    () => ({
      ask(text: string) {
        if (!window.matchMedia(MOBILE_QUERY).matches) sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        void send(text);
      },
      reactToPattern: (key, reaction) => reactToPattern(key, reaction),
    }),
    [reactToPattern, send]
  );

  const newConversation = () => {
    const fresh = createChatSession("Nova conversa");
    const list = [fresh, ...sessions.filter((s) => (s.messages?.length || 0) > 0)];
    setSessions(list);
    setActiveSessionId(fresh.id);
    setMessages([]);
    setChatError(null);
    setHistoryOpen(false);
    void saveChatSessions(list, userId);
    inputRef.current?.focus();
  };

  const openSession = (id: string) => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    setActiveSessionId(id);
    setMessages((target.messages as ChatMessage[]) || []);
    setChatError(null);
    setHistoryOpen(false);
  };

  const deleteSession = (id: string) => {
    const list = sessions.filter((s) => s.id !== id);
    if (id === activeSessionId) {
      const fresh = createChatSession("Nova conversa");
      const next = [fresh, ...list];
      setSessions(next);
      setActiveSessionId(fresh.id);
      setMessages([]);
      void saveChatSessions(next, userId);
    } else {
      setSessions(list);
      void saveChatSessions(list, userId);
    }
  };

  const copy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
  };

  const simulate = () => {
    const amount = parseFloat(simAmount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const card = cards.find((c) => c.id === activeSimCardId);
    const payload: SimulationPayload = { amount, method: simMethod, installments: simMethod === "credit" ? simInstallments : 1, cardId: activeSimCardId, description: simDescription };
    const value = amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const question =
      simMethod === "credit"
        ? `Se eu comprar "${simDescription}" de R$ ${value} em ${simInstallments}x no ${card?.name || "cartão"}, como isso afeta meu mês e minha meta?`
        : `Se eu pagar R$ ${value} à vista em "${simDescription}", como fica meu saldo e minhas contas?`;
    setIsSimOpen(false);
    void send(question, payload);
  };

  const pastSessions = sessions.filter((s) => (s.messages?.length || 0) > 0);
  const filteredSessions = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return q ? pastSessions.filter((s) => (s.title || "").toLowerCase().includes(q) || s.messages.some((m) => m.content.toLowerCase().includes(q))) : pastSessions;
  }, [historyQuery, pastSessions]);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const questions = (suggestedQuestions.length ? suggestedQuestions : FALLBACK_QUESTIONS).slice(0, 3);

  const sectionClass = fullscreen
    ? "fixed inset-x-0 z-[70] flex flex-col overflow-hidden bg-[var(--ai-card)]"
    : docked
      ? "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-[45] px-3"
      : "relative flex flex-col overflow-hidden rounded-[24px] bg-[var(--ai-card)] shadow-[var(--ai-shadow)] lg:h-full";

  return (
    <section
      ref={sectionRef}
      aria-labelledby="cofi-chat-title"
      data-fullscreen={fullscreen || undefined}
      role={fullscreen ? "dialog" : undefined}
      aria-modal={fullscreen || undefined}
      style={fullscreen ? { height: viewport ? `${viewport.height}px` : "100dvh", top: viewport ? `${viewport.top}px` : 0 } : undefined}
      className={sectionClass}
    >
      {/* Cabeçalho (estilo app do Claude): histórico · título · nova conversa */}
      <header className={`${docked ? "hidden" : "flex"} h-14 shrink-0 items-center gap-1 border-b border-[var(--ai-line)] px-2 ${fullscreen ? "box-content pt-[env(safe-area-inset-top)]" : ""}`}>
        {fullscreen && <IconButton label="Fechar conversa" onClick={() => setExpanded(false)} icon={<ChevronDown size={20} />} />}
        <IconButton label="Histórico de conversas" onClick={() => setHistoryOpen(true)} icon={<PanelLeft size={18} />} pressed={historyOpen} />
        <div className="min-w-0 flex-1 px-1 text-center">
          <h3 id="cofi-chat-title" className="truncate text-[15px] font-semibold text-[var(--ai-text)]">
            {activeSession && messages.length ? activeSession.title : "Converse com o Cofi"}
          </h3>
          <p className="truncate text-[11px] text-[var(--ai-text-3)]">Auditor financeiro · confere cada valor</p>
        </div>
        <IconButton label="Nova conversa" onClick={newConversation} icon={<SquarePen size={18} />} />
      </header>

      {/* Conversa */}
      <div
        ref={feedRef}
        data-testid="ai-chat-feed"
        aria-live="polite"
        className={`relative overflow-y-auto overflow-x-hidden overscroll-contain ${docked ? "hidden" : fullscreen ? "min-h-0 flex-1" : "max-h-[min(64vh,600px)] min-h-[320px] lg:max-h-none lg:min-h-0 lg:flex-1"}`}
      >
        <div className="mx-auto w-full max-w-[720px] space-y-6 px-4 py-5 sm:px-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center px-2 pt-6 text-center">
              <Cofi state="ocioso" size={56} />
              <p className="mt-3 text-[20px] font-semibold tracking-[-0.01em] text-[var(--ai-text)]">Como posso ajudar?</p>
              <p className="mt-1 max-w-[300px] text-[13px] leading-[1.45] text-[var(--ai-text-2)]">Pergunte sobre seu dinheiro. Eu mostro o raciocínio e confiro cada valor com seus dados.</p>
              <div className="mt-5 grid w-full gap-2">
                {questions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="touch-min rounded-[14px] border border-[var(--ai-line)] px-3.5 py-2.5 text-left text-[14px] text-[var(--ai-text)] outline-none transition-colors hover:bg-[var(--ai-card-2)] focus-visible:shadow-[var(--mac-focus-ring)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} data-msg-id={msg.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-[20px] bg-[var(--ai-card-2)] px-4 py-2.5 text-[15px] leading-[1.45] text-[var(--ai-text)] [overflow-wrap:anywhere]">{msg.content}</div>
              </div>
            ) : (
              <article key={msg.id} data-msg-id={msg.id} className={`space-y-3 text-[var(--ai-text)] ${msg.id === freshReplyId ? "cofi-rise" : ""}`}>
                {msg.reasoning && <ReasoningPanel reasoning={msg.reasoning} defaultOpen={msg.id === freshReplyId} />}
                {msg.simulationResult && (
                  <div
                    className={`rounded-[14px] px-3.5 py-2.5 text-[13px] ${
                      msg.simulationResult.verdict === "safe" ? "bg-[var(--ai-good-bg)] text-[var(--ai-good)]" : msg.simulationResult.verdict === "warning" ? "bg-[var(--ai-warn-bg)] text-[var(--ai-warn)]" : "bg-[var(--ai-bad-bg)] text-[var(--ai-bad)]"
                    }`}
                  >
                    <p className="flex items-center gap-1.5 font-semibold">
                      {msg.simulationResult.verdict === "safe" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {msg.simulationResult.verdict === "safe" ? "Cabe no seu orçamento" : "Pede cuidado"}
                    </p>
                    <p className="mt-0.5 leading-[1.45]">{msg.simulationResult.verdictMessage}</p>
                  </div>
                )}
                <FormattedMessage content={msg.content} role="assistant" />

                {msg.patterns && msg.patterns.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Padrões que o Cofi relacionou">
                    {msg.patterns.map((p) => (
                      <li key={p.key} title={p.observation} className="inline-flex items-center gap-1 rounded-full bg-[var(--ai-accent-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--ai-accent)]">
                        <Sparkles size={11} aria-hidden /> {p.title}
                      </li>
                    ))}
                  </ul>
                )}

                {msg.followUp && msg.id === lastMessage?.id && !isSending && (
                  <FollowUpCard
                    followUp={msg.followUp}
                    settled={settledFollowUps[msg.id]}
                    status={msg.followUp.patternKey ? patternMemory[msg.followUp.patternKey]?.status : undefined}
                    onReact={(reaction) => reactToPattern(msg.followUp!.patternKey, reaction, { messageId: msg.id })}
                    onAnswer={(text) => {
                      setSettledFollowUps((s) => ({ ...s, [msg.id]: "respondido" }));
                      void send(text);
                    }}
                    onDismiss={() => setSettledFollowUps((s) => ({ ...s, [msg.id]: "dispensado" }))}
                    onFocusInput={() => inputRef.current?.focus()}
                  />
                )}

                <div className="flex items-center gap-1 text-[var(--ai-text-3)]">
                  <button
                    type="button"
                    onClick={() => copy(msg.id, msg.content)}
                    aria-label={copiedId === msg.id ? "Copiado" : "Copiar resposta"}
                    className="touch-target flex h-7 w-7 items-center justify-center rounded-full outline-none hover:bg-[var(--ai-card-2)] hover:text-[var(--ai-text)] focus-visible:shadow-[var(--mac-focus-ring)]"
                  >
                    {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <span className="text-[11px]">{msg.timestamp}</span>
                </div>
              </article>
            )
          )}

          {isSending && <LiveReasoning steps={liveSteps} />}

          {chatError && chatError.sessionId === activeSessionId && !isSending && (
            <div role="alert" className="flex flex-wrap items-start gap-2.5 rounded-[16px] bg-[var(--ai-warn-bg)] px-3.5 py-3 text-[13px] text-[var(--ai-warn)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">A IA não respondeu</p>
                <p className="mt-0.5 leading-[1.45]">{chatError.message}</p>
              </div>
              <button
                type="button"
                onClick={() => void send(chatError.text, chatError.simulation, { retry: true })}
                className="touch-min inline-flex items-center gap-1 rounded-full bg-[var(--ai-card)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ai-text)] outline-none focus-visible:shadow-[var(--mac-focus-ring)]"
              >
                <RefreshCw size={11} /> Tentar novamente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Simulador de compra */}
      {isSimOpen && !docked && (
        <div className={`space-y-3 border-t border-[var(--ai-line)] bg-[var(--ai-card-2)] px-4 py-3 ${fullscreen ? "max-h-[45%] shrink-0 overflow-y-auto" : ""}`}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--ai-text)]">
              <Calculator size={15} className="text-[var(--ai-accent)]" /> Simular uma compra
            </span>
            <IconButton label="Fechar simulador" onClick={() => setIsSimOpen(false)} icon={<X size={16} />} />
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
            <MacFormRow label="O que deseja comprar?" htmlFor="sim-description">
              <MacTextField id="sim-description" size="large" value={simDescription} onChange={(e) => setSimDescription(e.target.value)} placeholder="Ex.: Tênis" />
            </MacFormRow>
            <MacFormRow label="Valor (R$)" htmlFor="sim-amount">
              <MacTextField id="sim-amount" size="large" inputMode="decimal" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} className="font-mono" />
            </MacFormRow>
            {simMethod === "credit" && (
              <MacFormRow label="Parcelas">
                <PopUpButton
                  value={String(simInstallments)}
                  onChange={(n) => setSimInstallments(Number(n))}
                  ariaLabel="Número de parcelas"
                  options={[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => ({ value: String(n), label: `${n}x` }))}
                />
              </MacFormRow>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <MacSegmentedControl
                ariaLabel="Forma de pagamento da simulação"
                value={simMethod}
                onChange={setSimMethod}
                options={[
                  { value: "credit", label: "Crédito" },
                  { value: "cash", label: "À vista" },
                ]}
              />
              {simMethod === "credit" && creditCards.length > 1 && (
                <PopUpButton ariaLabel="Cartão da simulação" value={activeSimCardId} onChange={setSimCardId} options={creditCards.map((c) => ({ value: c.id, label: c.name }))} />
              )}
            </div>
            <button type="button" onClick={simulate} className="touch-min rounded-full bg-[var(--ai-text)] px-4 py-2 text-[14px] font-semibold text-[var(--ai-card)] outline-none focus-visible:shadow-[var(--mac-focus-ring)]">
              Simular com o Cofi
            </button>
          </div>
        </div>
      )}

      {/* Campo de pergunta */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        data-testid="ai-chat-composer"
        className={docked ? "" : `shrink-0 px-3 pb-3 pt-2 ${fullscreen ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : ""}`}
      >
        <div
          className={`mx-auto flex w-full max-w-[720px] items-end gap-1.5 rounded-[24px] border border-[var(--ai-line)] bg-[var(--ai-card)] p-1.5 ${docked ? "shadow-[0_8px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl" : "shadow-[0_1px_2px_rgba(0,0,0,0.04)]"}`}
        >
          <IconButton
            label="Simular"
            title="Simular o impacto de uma compra"
            pressed={isSimOpen}
            onClick={() => {
              expandOnMobile();
              setIsSimOpen((v) => !v);
            }}
            icon={<Calculator size={17} />}
          />
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onFocus={expandOnMobile}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (input.trim() && !isSending) void send();
              }
            }}
            enterKeyHint="send"
            maxLength={1000}
            placeholder="Pergunte ao Cofi…"
            aria-label="Mensagem para o Cofi"
            className="max-h-[140px] min-h-[34px] min-w-0 flex-1 resize-none bg-transparent px-1 py-[7px] text-[16px] leading-[20px] text-[var(--ai-text)] placeholder:text-[var(--ai-text-3)] focus:outline-none"
          />
          {docked && <IconButton label="Abrir conversa em tela cheia" onClick={() => setExpanded(true)} icon={<MessagesSquare size={17} />} />}
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            aria-label="Enviar mensagem"
            className="touch-min flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--ai-text)] text-[var(--ai-card)] outline-none transition-opacity disabled:opacity-25 focus-visible:shadow-[var(--mac-focus-ring)]"
          >
            <ArrowUp size={17} strokeWidth={2.6} />
          </button>
        </div>
      </form>

      {/* Histórico de conversas (gaveta lateral) */}
      {historyOpen && !docked && (
        <div className="absolute inset-0 z-20 flex" role="dialog" aria-label="Histórico de conversas">
          <div className="flex h-full w-[min(320px,86%)] flex-col bg-[var(--ai-card)] shadow-[8px_0_40px_rgba(0,0,0,0.18)] cofi-drawer-in">
            <div className={`flex items-center gap-2 px-3 pb-2 ${fullscreen ? "pt-[max(0.75rem,env(safe-area-inset-top))]" : "pt-3"}`}>
              <p className="min-w-0 flex-1 px-1 text-[17px] font-semibold text-[var(--ai-text)]">Conversas</p>
              <IconButton label="Fechar histórico" onClick={() => setHistoryOpen(false)} icon={<X size={17} />} />
            </div>
            <div className="px-3">
              <label className="flex items-center gap-2 rounded-[12px] bg-[var(--ai-card-2)] px-3 py-2">
                <Search size={14} className="text-[var(--ai-text-3)]" aria-hidden />
                <input
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Buscar"
                  aria-label="Buscar conversas"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--ai-text)] placeholder:text-[var(--ai-text-3)] focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={newConversation}
                className="mt-2 flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2.5 text-[15px] font-semibold text-[var(--ai-accent)] outline-none hover:bg-[var(--ai-card-2)] focus-visible:shadow-[var(--mac-focus-ring)]"
              >
                <SquarePen size={16} aria-hidden /> Nova conversa
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              {filteredSessions.length === 0 ? (
                <p className="px-2 pt-6 text-center text-[13px] text-[var(--ai-text-3)]">{historyQuery ? "Nada encontrado." : "Suas conversas aparecem aqui."}</p>
              ) : (
                groupSessions(filteredSessions).map((group) => (
                  <div key={group.label} className="mt-3">
                    <p className="px-2 pb-1 text-[12px] font-semibold text-[var(--ai-text-3)]">{group.label}</p>
                    <ul>
                      {group.items.map((s) => (
                        <li key={s.id} className={`group flex items-center rounded-[10px] ${s.id === activeSessionId ? "bg-[var(--ai-card-2)]" : "hover:bg-[var(--ai-card-2)]"}`}>
                          <button type="button" onClick={() => openSession(s.id)} className="min-w-0 flex-1 px-2 py-2 text-left outline-none focus-visible:shadow-[var(--mac-focus-ring)]" aria-current={s.id === activeSessionId ? "true" : undefined}>
                            <span className="block truncate text-[14px] text-[var(--ai-text)]">{s.title || "Conversa"}</span>
                            <span className="block text-[11px] text-[var(--ai-text-3)]">
                              {s.messages.length} {s.messages.length === 1 ? "mensagem" : "mensagens"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSession(s.id)}
                            aria-label={`Apagar conversa: ${s.title || "Conversa"}`}
                            className="touch-target mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ai-text-3)] opacity-60 outline-none hover:text-[var(--ai-bad)] hover:opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
          <button type="button" aria-label="Fechar histórico" onClick={() => setHistoryOpen(false)} className="min-w-0 flex-1 bg-black/25 backdrop-blur-[2px]" />
        </div>
      )}
    </section>
  );
});

function IconButton({ label, title, onClick, icon, pressed }: { label: string; title?: string; onClick: () => void; icon: React.ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
      className={`touch-min flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:shadow-[var(--mac-focus-ring)] ${pressed ? "bg-[var(--ai-accent-bg)] text-[var(--ai-accent)]" : "text-[var(--ai-text-2)] hover:bg-[var(--ai-card-2)] hover:text-[var(--ai-text)]"}`}
    >
      {icon}
    </button>
  );
}

/**
 * Pergunta de retorno do Cofi. Quando é sobre um padrão, as respostas rápidas
 * viram status na memória ("Quero reduzir" passa a ser acompanhado; "É esperado"
 * faz o Cofi parar de insistir) e só chamam a IA quando a pessoa quer conversar.
 */
function FollowUpCard({
  followUp,
  settled,
  status,
  onReact,
  onAnswer,
  onDismiss,
  onFocusInput,
}: {
  followUp: ChatFollowUp;
  settled?: string;
  status?: PatternStatus;
  onReact: (reaction: PatternReaction) => void;
  onAnswer: (text: string) => void;
  onDismiss: () => void;
  onFocusInput: () => void;
}) {
  const isPattern = Boolean(followUp.patternKey);
  const done = settled || (isPattern && (status === "esperado" || status === "ignorado"));
  const doneText =
    settled === "esperado" || status === "esperado"
      ? "Combinado: não vou insistir nesse padrão."
      : settled === "ignorado" || status === "ignorado"
        ? "Ok, vou deixar esse padrão de lado."
        : settled === "dispensado"
          ? "Tudo bem, fica para outra hora."
          : null;
  const chip = "touch-min rounded-full border border-[var(--ai-line)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--ai-text)] outline-none transition-colors hover:bg-[var(--ai-card-2)] focus-visible:shadow-[var(--mac-focus-ring)]";

  return (
    <div data-testid="ai-follow-up" className="space-y-2">
      <p className="flex items-start gap-2 text-[14px] font-medium leading-[1.4] text-[var(--ai-text)]">
        <MessageCircleQuestion size={16} className="mt-[1px] shrink-0 text-[var(--ai-accent)]" aria-hidden />
        <span>{followUp.question}</span>
      </p>
      {done ? (
        doneText && <p className="pl-6 text-[12px] text-[var(--ai-text-2)]">{doneText}</p>
      ) : isPattern ? (
        <div className="flex flex-wrap gap-1.5 pl-6">
          <button type="button" className={`${chip} border-transparent bg-[var(--ai-text)] !text-[var(--ai-card)] hover:!bg-[var(--ai-text)]`} onClick={() => onReact("reduzir")}>
            Quero reduzir isso
          </button>
          <button type="button" className={chip} onClick={() => onReact("esperado")}>
            É esperado
          </button>
          <button type="button" className={chip} onClick={() => onReact("explicar")}>
            Me explica melhor
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 pl-6">
          <button type="button" className={chip} onClick={() => onAnswer("Sim.")}>
            Sim
          </button>
          <button type="button" className={chip} onClick={onFocusInput}>
            Responder
          </button>
          <button type="button" className={`${chip} border-transparent text-[var(--ai-text-2)]`} onClick={onDismiss}>
            Agora não
          </button>
        </div>
      )}
    </div>
  );
}
