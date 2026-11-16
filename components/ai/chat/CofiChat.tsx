"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, Calculator, Check, CheckCircle2, Copy, RefreshCw, SquarePen, X } from "lucide-react";
import { Cofi } from "@/components/assistant/Cofi";
import { FormattedMessage } from "@/components/ai/FormattedMessage";
import { PopUpButton } from "@/components/ui/macos/PopUpButton";
import { MacButton } from "@/components/ui/macos/Button";
import { MacSegmentedControl } from "@/components/ui/macos/SegmentedControl";
import { MacFormRow, MacTextField } from "@/components/ui/macos/TextField";
import { postAI, AIRequestError } from "@/lib/ai/clientRequests";
import { ChatSession, createChatSession, loadChatSessions, saveChatSessions } from "@/lib/services/aiChatService";
import type { PurchaseSimulationResult } from "@/lib/services/financialContextService";
import type { CardItem } from "@/types";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  modelUsed?: string;
  simulationResult?: PurchaseSimulationResult | null;
}

interface SimulationPayload {
  amount: number;
  method: "cash" | "credit";
  installments: number;
  cardId: string;
  description: string;
}

export interface CofiChatHandle {
  /** Envia uma pergunta (ex.: vinda de um ponto de atenção) e rola até o chat. */
  ask: (text: string) => void;
}

interface CofiChatProps {
  userId?: string;
  user?: { getIdToken: (forceRefresh?: boolean) => Promise<string> } | null;
  cards: CardItem[];
  suggestedQuestions: string[];
  /** Dados financeiros enviados junto com cada pergunta. */
  buildContextPayload: () => Record<string, unknown>;
}

const FALLBACK_QUESTIONS = [
  "Quanto posso gastar por dia até o fim do mês?",
  "Qual conta eu devo pagar primeiro?",
  "Onde eu consigo economizar este mês?",
];

const nowLabel = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const CofiChat = forwardRef<CofiChatHandle, CofiChatProps>(function CofiChat(
  { userId, user, cards, suggestedQuestions, buildContextPayload },
  ref
) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<{ message: string; text: string; simulation?: SimulationPayload; sessionId: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Mantém a conversa no fim quando chegam mensagens
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const frame = window.requestAnimationFrame(() => feed.scrollTo({ top: feed.scrollHeight, behavior: messages.length <= 2 ? "auto" : "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, isSending]);

  const send = useCallback(
    async (rawText?: string, simulation?: SimulationPayload, options?: { retry?: boolean }) => {
      if (sendingRef.current) return;
      const text = (rawText ?? input).trim();
      if (!text) return;
      sendingRef.current = true;
      setChatError(null);

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

      try {
        const data = await postAI<{ message: string; modelUsed?: string; simulationResult?: PurchaseSimulationResult | null }>(
          "/api/ai/chat",
          {
            ...buildContextPayload(),
            messages: previous.map((m) => ({ role: m.role, content: m.content })),
            userMessage: text,
            simulation,
          },
          user
        );
        const reply: ChatMessage = {
          id: globalThis.crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          timestamp: nowLabel(),
          modelUsed: data.modelUsed,
          simulationResult: data.simulationResult,
        };
        const finalMessages = [...withQuestion, reply];
        const finalList = [{ ...pending, updatedAt: new Date().toISOString(), messages: finalMessages }, ...sessions.filter((s) => s.id !== session.id)];
        setMessages(finalMessages);
        setSessions(finalList);
        void saveChatSessions(finalList, userId);
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
      }
    },
    [activeSessionId, buildContextPayload, input, sessions, user, userId]
  );

  useImperativeHandle(
    ref,
    () => ({
      ask(text: string) {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        void send(text);
      },
    }),
    [send]
  );

  const newConversation = () => {
    const fresh = createChatSession("Nova conversa");
    const list = [fresh, ...sessions.filter((s) => (s.messages?.length || 0) > 0)];
    setSessions(list);
    setActiveSessionId(fresh.id);
    setMessages([]);
    setChatError(null);
    void saveChatSessions(list, userId);
    inputRef.current?.focus();
  };

  const openSession = (id: string) => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    setActiveSessionId(id);
    setMessages((target.messages as ChatMessage[]) || []);
    setChatError(null);
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
  const questions = (suggestedQuestions.length ? suggestedQuestions : FALLBACK_QUESTIONS).slice(0, 3);
  const cofiState = isSending ? "escrevendo" : chatError ? "erro" : "ocioso";

  return (
    <section ref={sectionRef} aria-labelledby="cofi-chat-title" className="scroll-mt-4 overflow-hidden rounded-[20px] bg-[var(--ai-card)] shadow-[var(--ai-shadow)]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--ai-line)] px-4 py-3 sm:px-5">
        <Cofi state={cofiState} size={36} />
        <div className="min-w-0 flex-1">
          <h3 id="cofi-chat-title" className="text-[16px] font-semibold text-[var(--ai-text)]">Converse com o Cofi</h3>
          <p className="truncate text-[12px] text-[var(--ai-text-2)]">Responde com base nos seus números de hoje</p>
        </div>
        <div className="flex items-center gap-2">
          {pastSessions.length > 1 && (
            <PopUpButton
              ariaLabel="Conversas anteriores"
              value={activeSessionId}
              onChange={openSession}
              options={pastSessions.map((s) => ({ value: s.id, label: s.title || "Conversa" }))}
              className="max-w-[160px]"
            />
          )}
          <MacButton variant="bordered" shape="capsule" onClick={newConversation} icon={<SquarePen size={13} />}>
            Nova conversa
          </MacButton>
        </div>
      </header>

      <div
        ref={feedRef}
        data-testid="ai-chat-feed"
        aria-live="polite"
        className="max-h-[min(62vh,560px)] min-h-[220px] space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 sm:px-5"
      >
        {messages.length === 0 && (
          <div className="py-2">
            <p className="text-[14px] text-[var(--ai-text-2)]">Pergunte o que quiser sobre o seu dinheiro. Algumas ideias:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {questions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="touch-min rounded-full border border-[var(--ai-line)] bg-[var(--ai-card-2)] px-3.5 py-2 text-left text-[13px] font-medium text-[var(--ai-text)] outline-none transition-colors hover:border-[var(--ai-accent)] focus-visible:border-[var(--ai-accent)]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[86%] rounded-[18px] rounded-br-[6px] bg-[var(--ai-user-bubble)] px-3.5 py-2.5 text-white sm:max-w-[75%]">
                <FormattedMessage content={msg.content} role="user" />
                <div className="mt-1 text-right text-[10px] text-white/70">{msg.timestamp}</div>
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex gap-2.5">
              <Cofi size={28} className="mt-0.5" />
              <div className="min-w-0 max-w-[94%] flex-1 space-y-2.5 rounded-[18px] rounded-tl-[6px] bg-[var(--ai-card-2)] px-4 py-3 text-[var(--ai-text)]">
                {msg.simulationResult && (
                  <div
                    className={`rounded-[12px] px-3 py-2.5 text-[13px] ${
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
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[11px] text-[var(--ai-text-3)]">Cofi · {msg.timestamp}</span>
                  <button
                    type="button"
                    onClick={() => copy(msg.id, msg.content)}
                    className="touch-target inline-flex items-center gap-1 text-[12px] font-medium text-[var(--ai-text-2)] outline-none hover:text-[var(--ai-text)] focus-visible:text-[var(--ai-accent)]"
                  >
                    {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedId === msg.id ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        {isSending && (
          <div className="flex items-center gap-2.5 text-[13px] text-[var(--ai-text-2)]" role="status">
            <Cofi state="pensando" size={28} />
            O Cofi está lendo seus números…
          </div>
        )}

        {chatError && chatError.sessionId === activeSessionId && !isSending && (
          <div role="alert" className="flex flex-wrap items-start gap-2.5 rounded-[14px] bg-[var(--ai-warn-bg)] px-3.5 py-3 text-[13px] text-[var(--ai-warn)]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">A IA não respondeu</p>
              <p className="mt-0.5 leading-[1.45]">{chatError.message}</p>
            </div>
            <MacButton variant="bordered" size="small" shape="capsule" onClick={() => void send(chatError.text, chatError.simulation, { retry: true })} icon={<RefreshCw size={11} />}>
              Tentar novamente
            </MacButton>
          </div>
        )}
      </div>

      {isSimOpen && (
        <div className="space-y-3 border-t border-[var(--ai-line)] bg-[var(--ai-card-2)] px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--ai-text)]">
              <Calculator size={15} className="text-[var(--ai-accent)]" /> Simular uma compra
            </span>
            <MacButton variant="borderless" size="small" shape="capsule" iconOnly aria-label="Fechar simulador" onClick={() => setIsSimOpen(false)} icon={<X size={14} />} />
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
            <MacButton variant="prominent" size="large" shape="capsule" onClick={simulate}>
              Simular com o Cofi
            </MacButton>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        data-testid="ai-chat-composer"
        className="border-t border-[var(--ai-line)] px-3 py-2.5 sm:px-4"
      >
        <div className="flex items-end gap-1.5 rounded-[22px] border border-[var(--ai-line)] bg-[var(--ai-card-2)] p-1.5">
          <button
            type="button"
            onClick={() => setIsSimOpen((v) => !v)}
            aria-pressed={isSimOpen}
            aria-label="Simular"
            title="Simular o impacto de uma compra"
            className={`touch-min flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:shadow-[var(--mac-focus-ring)] ${isSimOpen ? "bg-[var(--ai-accent-bg)] text-[var(--ai-accent)]" : "text-[var(--ai-text-2)] hover:text-[var(--ai-text)]"}`}
          >
            <Calculator size={16} />
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
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
            className="max-h-[120px] min-h-[32px] min-w-0 flex-1 resize-none bg-transparent px-1 py-[6px] text-[16px] leading-[20px] text-[var(--ai-text)] placeholder:text-[var(--ai-text-3)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            aria-label="Enviar mensagem"
            className="touch-min flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ai-accent)] text-white outline-none transition-opacity disabled:opacity-35 focus-visible:shadow-[var(--mac-focus-ring)]"
          >
            <ArrowUp size={16} strokeWidth={2.6} />
          </button>
        </div>
      </form>
    </section>
  );
});
