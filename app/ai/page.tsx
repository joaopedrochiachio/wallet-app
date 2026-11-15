"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  RefreshCw,
  CreditCard,
  ChevronDown,
  Trash2,
  CalendarClock,
  ArrowUpRight,
  ShieldCheck,
  CalendarDays,
  X,
  Building2,
  Flame,
  Shield,
  History,
  ArrowUp,
  Copy,
  Check,
  MessageSquare,
  PanelLeft,
  SquarePen,
} from "lucide-react";
import { FormattedMessage } from "@/components/ai/FormattedMessage";
import { ChatDialog } from "@/components/ai/ChatDialog";
import { FinancialHealthRing } from "@/components/ai/FinancialHealthRing";
import { CashflowBarChart } from "@/components/ai/CashflowBarChart";
import {
  CategorySpectrumBar,
  CategoryDistribution,
  resolveAppleCategoryTheme,
} from "@/components/ai/CategorySpectrumBar";
import { FinancialOffice } from "@/components/ai/FinancialOffice";
import { SpendingCalendarHeatmap } from "@/components/ai/SpendingCalendarHeatmap";
import { VisualPatternStorytelling } from "@/components/ai/VisualPatternStorytelling";
import { normalizeCharacterId } from "@/components/companion/WalletCharacters";
import { InteractiveFinancialCalendar } from "@/components/companion/InteractiveFinancialCalendar";
import {
  calculateDailySafeSpend,
  getUpcomingFinancialEvents,
} from "@/lib/services/dailyCompanionService";
import {
  FinancialDiagnosis,
  SpecificExpenseAlert,
  safeParseFinancialDiagnosis,
} from "@/lib/services/financialDiagnosisService";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  PurchaseSimulationResult,
} from "@/lib/services/financialContextService";
import { auth } from "@/lib/firebase";
import {
  ChatSession,
  loadChatSessions,
  saveChatSessions,
  createChatSession,
  loadPersistentDiagnosis,
  savePersistentDiagnosis,
  loadInitialDiagnosisSync,
  loadDismissedPatterns,
  dismissPattern,
} from "@/lib/services/aiChatService";
import { PopUpButton } from "@/components/ui/macos/PopUpButton";
import { MacButton, MacSpinner, MacToolbarButton, MacToolbarGroup } from "@/components/ui/macos/Button";
import { MacSegmentedControl } from "@/components/ui/macos/SegmentedControl";
import { MacFormRow, MacSearchField, MacTextField } from "@/components/ui/macos/TextField";
import { MacSidebar, MacSidebarItem, MacSidebarItems, MacSidebarSection } from "@/components/ui/macos/Sidebar";
import { MacSheet, MacWindowToolbar } from "@/components/ui/macos/Window";

/** Falha real do chat: carrega a mensagem do servidor para mostrar ao usuário. */
class ChatRequestError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "ChatRequestError";
  }
}

function describeChatFailure(status: number): string {
  if (status === 401) return "Sua sessão expirou. Entre novamente para continuar a conversa.";
  if (status === 429) return "Você atingiu o limite de mensagens com a IA por agora. Tente mais tarde.";
  if (status === 413) return "A conversa ficou grande demais para enviar. Inicie uma nova conversa.";
  return "A IA está indisponível no momento. Tente novamente em instantes.";
}

function cleanExecutiveSummary(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/^Olá!\s*Analisei\s*(todo\s*o\s*)?seu\s*fluxo\s*(deste\s*mês)?\.?\s*/i, "")
    .replace(/^Olá!\s*/i, "")
    .replace(/^Oi!\s*/i, "")
    .trim();
}

function formatSessionDate(isoStr?: string): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Hoje às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  modelUsed?: string;
  simulationResult?: PurchaseSimulationResult | null;
}

interface CopilotContext {
  eyebrow: string;
  title: string;
  detail?: string;
}

export default function AIAnalystPage() {
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
  } = useWallet();

  // Auditor Persona Ativa
  const [selectedPersona, setSelectedPersona] = useState<string>(
    () => userProfile?.persona || "optimizer"
  );

  // Meta de Saldo Alvo Estipulado para o Fechamento do Mês
  const [targetEndMonthBalance, setTargetEndMonthBalance] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("wallet_monthly_target");
      if (saved && !isNaN(parseFloat(saved))) return parseFloat(saved);
    }
    return userProfile?.targetMonthEndBalance || 700;
  });

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTargetInput, setTempTargetInput] = useState(String(targetEndMonthBalance));

  const handleUpdateTarget = useCallback((newTarget: number) => {
    setTargetEndMonthBalance(newTarget);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("wallet_monthly_target", String(newTarget));
    }
  }, []);

  // Projeção do Mês Corrente e Indicadores de Meta
  const currentMonthProj = getMonthlyProjection(0);
  const effectiveProjectedFree = currentMonthProj?.projectedFreeBalance ?? (mainBalance - monthExpense);
  const safeSpendingMargin = Math.max(0, effectiveProjectedFree - targetEndMonthBalance);
  const missingAmount = Math.max(0, targetEndMonthBalance - effectiveProjectedFree);
  const targetStatus: "on_track" | "at_risk" = effectiveProjectedFree >= targetEndMonthBalance ? "on_track" : "at_risk";

  // Margem Diária Segura
  const safeSpendMetric = useMemo(() => {
    return calculateDailySafeSpend({
      projectedFreeBalance: effectiveProjectedFree,
      targetEndMonthBalance,
    });
  }, [effectiveProjectedFree, targetEndMonthBalance]);

  // Próximos Vencimentos Contábeis (hoje em diante)
  const upcomingEvents = useMemo(() => {
    return getUpcomingFinancialEvents({
      cards,
      recurringItems,
      transactions,
      cardInvoiceProjections: currentMonthProj?.cardInvoices,
      onlyExpenses: true,
    });
  }, [cards, recurringItems, transactions, currentMonthProj?.cardInvoices]);

  const urgentEvents = upcomingEvents.filter((e) => e.isUrgent);

  // Estados do Diagnóstico
  const [diagnosis, setDiagnosis] = useState<FinancialDiagnosis | null>(() => {
    const cached = loadInitialDiagnosisSync();
    return (cached?.diagnosis as FinancialDiagnosis) || null;
  });
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(() => {
    const cached = loadInitialDiagnosisSync();
    return cached?.timestamp || null;
  });
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisModel, setAnalysisModel] = useState<string>(() => {
    const cached = loadInitialDiagnosisSync();
    return cached?.modelUsed || "gpt-6-luna";
  });
  const [dismissedPatterns, setDismissedPatterns] = useState<string[]>(() => loadDismissedPatterns(user?.uid));
  const [isSearchingPatterns, setIsSearchingPatterns] = useState<boolean>(false);
  const [patternsFeedback, setPatternsFeedback] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<"all" | "alerts" | "recurring" | "habits">("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // Estados do Chat e Histórico de Sessões
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotContext, setCopilotContext] = useState<CopilotContext | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [chatError, setChatError] = useState<{
    message: string;
    text: string;
    simulationPayload?: unknown;
    sessionId: string;
  } | null>(null);
  const [activeDossierTab, setActiveDossierTab] = useState<"mindmap" | "calendar" | "storytelling" | "overview">("mindmap");

  // Permite que o Niko abra diretamente a agenda financeira completa.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedView = new URLSearchParams(window.location.search).get("view");
      if (requestedView === "calendar") setActiveDossierTab("calendar");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [sessionSearchQuery, setSessionSearchQuery] = useState<string>("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesLenRef = useRef<number>(0);
  const sendingMessageRef = useRef(false);

  useEffect(() => {
    if (!isCopilotOpen) return;
    const focusTimer = window.setTimeout(() => {
      if (window.innerWidth >= 640) {
        chatInputRef.current?.focus();
      }
    }, 180);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isHistoryDrawerOpen) {
          setIsHistoryDrawerOpen(false);
        } else {
          setIsCopilotOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCopilotOpen, isHistoryDrawerOpen]);

  // Sessão atual ativa
  const currentSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || null;

  // Estados do Simulador de Compra Inline
  const [isInlineSimOpen, setIsInlineSimOpen] = useState(false);
  const [simAmount, setSimAmount] = useState<string>("1200");
  const [simMethod, setSimMethod] = useState<"cash" | "credit">("credit");
  const [simInstallments, setSimInstallments] = useState<number>(6);
  const [simCardId, setSimCardId] = useState<string>("");
  const [simDescription, setSimDescription] = useState<string>("Novo Smartphone");

  const creditCards = cards.filter((c) => c.type === "credit");
  const activeSimCardId = simCardId || (creditCards[0]?.id ?? "");

  const officeMonthlyProjections = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((monthIndex) => getMonthlyProjection(monthIndex)),
    [getMonthlyProjection]
  );

  const runDiagnosis = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const monthlyProjections = [0, 1, 2, 3, 4, 5].map((idx) => {
        const p = getMonthlyProjection(idx);
        return {
          monthName: p.monthName,
          year: p.year,
          openingBalance: p.openingBalance,
          actualClosingBalance: p.actualClosingBalance,
          plannedIncomesTotal: p.plannedIncomesTotal,
          recurringDebitTotal: p.recurringDebitTotal,
          recurringCreditTotal: p.recurringCreditTotal,
          cardInstallments: p.cardInstallments,
          totalCommitted: p.totalCommitted,
          pendingCommitted: p.pendingCommitted,
          totalInvoicesPending: p.totalInvoicesPending,
          projectedFreeBalance: p.projectedFreeBalance,
          monthNetSurplus: p.monthNetSurplus,
        };
      });

      const activeUser = auth.currentUser || user;
      let idToken = activeUser ? await activeUser.getIdToken() : "";
      const requestBody = JSON.stringify({
        userProfile: {
          ...userProfile,
          persona: selectedPersona,
        },
        cards,
        transactions,
        recurringItems,
        goals,
        mainBalance,
        monthIncome,
        monthExpense,
        monthlyProjections,
        dismissedPatterns,
        targetEndMonthBalance,
      });

      let res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: requestBody,
      });

      if (res.status === 401 && activeUser) {
        idToken = await activeUser.getIdToken(true);
        res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: requestBody,
        });
      }

      const resText = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;
      try {
        data = resText ? JSON.parse(resText) : null;
      } catch {
        data = null;
      }

      if (res.ok && data && data.success && data.diagnosis) {
        const timestamp = new Date().toISOString();
        setDiagnosis(data.diagnosis);
        setLastAnalyzedAt(timestamp);
        if (data.modelUsed) setAnalysisModel(data.modelUsed);

        await savePersistentDiagnosis(
          data.diagnosis,
          {
            timestamp,
            modelUsed: data.modelUsed,
            persona: selectedPersona,
            aiTone: userProfile.aiTone || "analytical",
          },
          user?.uid
        );

        if (typeof window !== "undefined") {
          window.localStorage.removeItem("wallet_ai_needs_reanalysis");
          window.localStorage.removeItem("wallet_ai_pending_persona");
        }
      } else {
        // Fallback local imediato para que o diagnóstico sempre funcione em produção
        const telemetry = synthesizeFinancialTelemetry({
          userProfile: { ...userProfile, persona: selectedPersona as typeof userProfile.persona },
          cards,
          transactions,
          recurringItems,
          goals,
          mainBalance,
          monthIncome,
          monthExpense,
          monthlyProjections,
          targetEndMonthBalance,
        });
        const safeContext = createSafeFinancialContext(telemetry);
        const localDiagnosis = safeParseFinancialDiagnosis("", safeContext, dismissedPatterns);
        const timestamp = new Date().toISOString();
        setDiagnosis(localDiagnosis);
        setLastAnalyzedAt(timestamp);
        setAnalysisModel("motor-contabil-local");

        await savePersistentDiagnosis(
          localDiagnosis,
          {
            timestamp,
            modelUsed: "motor-contabil-local",
            persona: selectedPersona,
            aiTone: userProfile.aiTone || "analytical",
          },
          user?.uid
        );
      }
    } catch {
      // Fallback local imediato em caso de erro de rede/timeout
      const monthlyProjections = [0, 1, 2, 3, 4, 5].map((idx) => {
        const p = getMonthlyProjection(idx);
        return {
          monthName: p.monthName,
          year: p.year,
          openingBalance: p.openingBalance,
          actualClosingBalance: p.actualClosingBalance,
          plannedIncomesTotal: p.plannedIncomesTotal,
          recurringDebitTotal: p.recurringDebitTotal,
          recurringCreditTotal: p.recurringCreditTotal,
          cardInstallments: p.cardInstallments,
          totalCommitted: p.totalCommitted,
          pendingCommitted: p.pendingCommitted,
          totalInvoicesPending: p.totalInvoicesPending,
          projectedFreeBalance: p.projectedFreeBalance,
          monthNetSurplus: p.monthNetSurplus,
        };
      });
      const telemetry = synthesizeFinancialTelemetry({
        userProfile,
        cards,
        transactions,
        recurringItems,
        goals,
        mainBalance,
        monthIncome,
        monthExpense,
        monthlyProjections,
        targetEndMonthBalance,
      });
      const safeContext = createSafeFinancialContext(telemetry);
      const localDiagnosis = safeParseFinancialDiagnosis("", safeContext, dismissedPatterns);
      const timestamp = new Date().toISOString();
      setDiagnosis(localDiagnosis);
      setLastAnalyzedAt(timestamp);
      setAnalysisModel("motor-contabil-local");
      await savePersistentDiagnosis(
        localDiagnosis,
        {
          timestamp,
          modelUsed: "motor-contabil-local",
          persona: selectedPersona,
          aiTone: userProfile.aiTone || "analytical",
        },
        user?.uid
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    getMonthlyProjection,
    user,
    userProfile,
    selectedPersona,
    cards,
    transactions,
    recurringItems,
    goals,
    mainBalance,
    monthIncome,
    monthExpense,
    dismissedPatterns,
    targetEndMonthBalance,
  ]);

  // Carrega diagnóstico persistido e sessões
  useEffect(() => {
    let isMounted = true;

    loadPersistentDiagnosis(user?.uid).then((saved) => {
      if (isMounted) {
        setDismissedPatterns(loadDismissedPatterns(user?.uid));
        if (saved?.diagnosis) {
          setDiagnosis(saved.diagnosis as FinancialDiagnosis);
          if (saved.timestamp) setLastAnalyzedAt(saved.timestamp);
          if (saved.modelUsed) setAnalysisModel(saved.modelUsed);
        } else if (user?.uid) {
          const userCached = loadInitialDiagnosisSync(user.uid);
          if (userCached?.diagnosis) {
            setDiagnosis(userCached.diagnosis as FinancialDiagnosis);
            if (userCached.timestamp) setLastAnalyzedAt(userCached.timestamp);
            if (userCached.modelUsed) setAnalysisModel(userCached.modelUsed);
          }
        }
      }
    });

    loadChatSessions(user?.uid).then((savedSessions) => {
      if (isMounted) {
        if (savedSessions.length > 0) {
          setSessions(savedSessions);
          setActiveSessionId(savedSessions[0].id);
          setMessages(savedSessions[0].messages || []);
        } else {
          const initial = createChatSession("Nova Consulta");
          setSessions([initial]);
          setActiveSessionId(initial.id);
          setMessages([]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Scroll inteligente no chat: quando envia mensagem vai ao fim; quando chega resposta da IA posiciona no início da resposta para leitura fluida
  useEffect(() => {
    if (!isCopilotOpen) return;
    const prevLen = prevMessagesLenRef.current;
    const currLen = messages.length;
    prevMessagesLenRef.current = currLen;

    const frame = window.requestAnimationFrame(() => {
      const feed = chatFeedRef.current;
      if (!feed) return;
      const lastMessage = lastMessageRef.current;
      if (!isSending && currLen > prevLen && messages[currLen - 1]?.role === "assistant" && lastMessage) {
        feed.scrollTo({ top: feed.scrollTop + lastMessage.getBoundingClientRect().top - feed.getBoundingClientRect().top - 16, behavior: "smooth" });
      } else {
        feed.scrollTo({ top: feed.scrollHeight, behavior: currLen <= 2 ? "auto" : "smooth" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, isSending, isCopilotOpen]);

  const handleChatScroll = useCallback(() => {
    const el = chatFeedRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 140);
  }, []);

  const scrollToChatBottom = useCallback(() => {
    const feed = chatFeedRef.current;
    feed?.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  }, []);

  const handleCopyMessage = useCallback((msgId: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      window.setTimeout(() => {
        setCopiedMessageId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    }
  }, []);

  const handleDismissPattern = (patternKey: string) => {
    const updated = dismissPattern(patternKey, user?.uid);
    setDismissedPatterns(updated);
  };

  const handleFetchMorePatterns = async () => {
    setIsSearchingPatterns(true);
    setPatternsFeedback(null);
    try {
      const idToken = user ? await user.getIdToken() : "";
      const res = await fetch("/api/ai/patterns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          userProfile,
          cards,
          transactions,
          recurringItems,
          dismissedPatterns,
        }),
      });

      const resText = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;
      try {
        data = resText ? JSON.parse(resText) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || `Falha ao buscar novos padrões (${res.status}).`);
      }

      if (data && data.success && Array.isArray(data.patterns)) {
        if (data.patterns.length === 0) {
          setPatternsFeedback("Nenhum novo padrão recorrente identificado no momento.");
          setTimeout(() => setPatternsFeedback(null), 4000);
          return;
        }

        setDiagnosis((prev: FinancialDiagnosis | null) => {
          if (!prev) return prev;
          const existing = prev.specificExpensesAlerts || [];
          const existingNames = new Set(existing.map((e: SpecificExpenseAlert) => e.item.toLowerCase().trim()));
          const newAlerts = data.patterns.filter(
            (p: SpecificExpenseAlert) => !existingNames.has(p.item.toLowerCase().trim())
          );

          if (newAlerts.length === 0) {
            setPatternsFeedback("Todos os padrões identificados já estão exibidos.");
            setTimeout(() => setPatternsFeedback(null), 4000);
            return prev;
          }

          const updatedDiagnosis: FinancialDiagnosis = {
            ...prev,
            specificExpensesAlerts: [...existing, ...newAlerts],
          };

          if (lastAnalyzedAt) {
            void savePersistentDiagnosis(
              updatedDiagnosis,
              { timestamp: lastAnalyzedAt, modelUsed: analysisModel },
              user?.uid
            );
          }

          setPatternsFeedback(`${newAlerts.length} novo(s) padrão(ões) mapeado(s)!`);
          setTimeout(() => setPatternsFeedback(null), 4000);
          return updatedDiagnosis;
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar padrões.";
      setPatternsFeedback(msg);
      setTimeout(() => setPatternsFeedback(null), 4000);
    } finally {
      setIsSearchingPatterns(false);
    }
  };

  const handleSendMessage = async (
    textToSend?: string,
    simulationPayload?: unknown,
    options?: { retry?: boolean }
  ) => {
    if (sendingMessageRef.current) return;
    const text = (textToSend || inputMessage).trim();
    if (!text && !simulationPayload) return;
    sendingMessageRef.current = true;
    setIsCopilotOpen(true);
    setChatError(null);

    const userMsg: ChatMessage = {
      id: globalThis.crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    let activeSess = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    if (!activeSess) {
      activeSess = createChatSession();
    }
    const currentId = activeSess.id;

    let updatedTitle = activeSess.title;
    if (
      activeSess.title === "Nova Conversa" ||
      activeSess.title === "Nova Consulta" ||
      !activeSess.messages ||
      activeSess.messages.length === 0
    ) {
      updatedTitle = text.length > 36 ? text.slice(0, 34) + "..." : text;
    }

    // No reenvio, a pergunta já está na conversa: não duplica e não a manda duas vezes no histórico.
    const sessionMsgs = activeSess.messages || [];
    const isRetry = Boolean(options?.retry) && sessionMsgs[sessionMsgs.length - 1]?.role === "user";
    const currentMsgs = isRetry ? sessionMsgs.slice(0, -1) : sessionMsgs;
    const newMessages = isRetry ? sessionMsgs : [...currentMsgs, userMsg];
    setMessages(newMessages);

    const updatedSession: ChatSession = {
      ...activeSess,
      id: currentId,
      title: updatedTitle,
      updatedAt: new Date().toISOString(),
      messages: newMessages,
    };

    const updatedSessionsList = [
      updatedSession,
      ...sessions.filter((s) => s.id !== currentId),
    ];
    setSessions(updatedSessionsList);
    setActiveSessionId(currentId);
    void saveChatSessions(updatedSessionsList, user?.uid);

    if (!textToSend && !isRetry) {
      setInputMessage("");
      if (chatInputRef.current) {
        chatInputRef.current.style.height = "auto";
      }
    }
    setIsSending(true);

    try {
      const monthlyProjections = [0, 1, 2, 3, 4, 5].map((idx) => {
        const p = getMonthlyProjection(idx);
        return {
          monthName: p.monthName,
          year: p.year,
          openingBalance: p.openingBalance,
          actualClosingBalance: p.actualClosingBalance,
          plannedIncomesTotal: p.plannedIncomesTotal,
          recurringDebitTotal: p.recurringDebitTotal,
          recurringCreditTotal: p.recurringCreditTotal,
          cardInstallments: p.cardInstallments,
          totalCommitted: p.totalCommitted,
          pendingCommitted: p.pendingCommitted,
          totalInvoicesPending: p.totalInvoicesPending,
          projectedFreeBalance: p.projectedFreeBalance,
          monthNetSurplus: p.monthNetSurplus,
        };
      });

      const activeUser = auth.currentUser || user;
      let idToken = activeUser ? await activeUser.getIdToken() : "";
      const requestBody = JSON.stringify({
        messages: currentMsgs.map((m) => ({ role: m.role, content: m.content })),
        userMessage: text,
        simulation: simulationPayload,
        userProfile,
        cards,
        transactions,
        recurringItems,
        goals,
        mainBalance,
        monthIncome,
        monthExpense,
        monthlyProjections,
        targetEndMonthBalance,
      });

      let res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: requestBody,
      });

      if (res.status === 401 && activeUser) {
        idToken = await activeUser.getIdToken(true);
        res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: requestBody,
        });
      }

      const resText = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;
      try {
        data = resText ? JSON.parse(resText) : null;
      } catch {
        data = null;
      }

      if (res.ok && data && data.success && data.message) {
        const assistantMsg: ChatMessage = {
          id: globalThis.crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          timestamp: new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          modelUsed: data.modelUsed,
          simulationResult: data.simulationResult,
        };
        const finalMessages = [...newMessages, assistantMsg];
        setMessages(finalMessages);

        const finalSession: ChatSession = {
          ...updatedSession,
          updatedAt: new Date().toISOString(),
          messages: finalMessages,
        };
        const finalSessionsList = [
          finalSession,
          ...sessions.filter((s) => s.id !== currentId),
        ];
        setSessions(finalSessionsList);
        void saveChatSessions(finalSessionsList, user?.uid);
      } else {
        throw new ChatRequestError(
          data?.error || describeChatFailure(res.status),
          data?.code
        );
      }
    } catch (error) {
      // Sem resposta inventada: o usuário vê o motivo real e pode tentar de novo.
      setChatError({
        message:
          error instanceof ChatRequestError
            ? error.message
            : "Não consegui falar com o servidor. Verifique sua conexão e tente novamente.",
        text,
        simulationPayload,
        sessionId: currentId,
      });
    } finally {
      sendingMessageRef.current = false;
      setIsSending(false);
    }
  };

  const openCopilotWithContext = (
    context?: CopilotContext,
    prompt?: string
  ) => {
    setCopilotContext(context || null);
    setIsCopilotOpen(true);
    if (prompt && prompt.trim()) {
      setInputMessage(prompt.trim());
    }
    setTimeout(() => {
      if (typeof window !== "undefined" && window.innerWidth >= 640) {
        chatInputRef.current?.focus();
      }
    }, 80);
  };

  const handleNewChat = () => {
    const newSess = createChatSession("Nova Consulta");
    const updated = [newSess, ...sessions];
    setSessions(updated);
    setActiveSessionId(newSess.id);
    setMessages([]);
    setIsHistoryDrawerOpen(false);
    void saveChatSessions(updated, user?.uid);
  };

  const handleSelectSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;
    setActiveSessionId(sessionId);
    setMessages(target.messages || []);
    setIsHistoryDrawerOpen(false);
  };

  const handleDeleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const remaining = sessions.filter((s) => s.id !== sessionId);
    if (remaining.length === 0) {
      const fresh = createChatSession("Nova Consulta");
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      setMessages([]);
      await saveChatSessions([fresh], user?.uid);
    } else {
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
        setMessages(remaining[0].messages || []);
      }
      await saveChatSessions(remaining, user?.uid);
    }
  };

  const executeSimulation = () => {
    const amountVal = parseFloat(simAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(amountVal) || amountVal <= 0) return;

    const simPayload = {
      amount: amountVal,
      method: simMethod,
      installments: simMethod === "credit" ? simInstallments : 1,
      cardId: activeSimCardId,
      description: simDescription,
    };

    const selectedCard = cards.find((c) => c.id === activeSimCardId);
    const cardName = selectedCard?.name || "Cartão";
    const promptText =
      simMethod === "credit"
        ? `Auditor, se eu comprar "${simDescription}" no valor de R$ ${amountVal.toFixed(
            2
          )} em ${simInstallments}x no ${cardName}, como isso impacta minha margem de segurança e a meta de R$ ${targetEndMonthBalance.toFixed(2)}?`
        : `Auditor, se eu pagar à vista R$ ${amountVal.toFixed(
            2
          )} por "${simDescription}", como fica meu saldo disponível e contas fixas?`;

    setIsInlineSimOpen(false);
    handleSendMessage(promptText, simPayload);
  };

  const handlePayUpcomingItem = async (eventId: string) => {
    if (!eventId.startsWith("recurring_")) return;
    const realId = eventId.replace("recurring_", "");
    const item = recurringItems.find((r) => r.id === realId);
    if (!item) return;

    setPayingBillId(eventId);
    try {
      const now = new Date();
      await realizeRecurringItemNow(item, now.getFullYear(), now.getMonth());
    } catch (err) {
      console.error("Erro ao dar baixa:", err);
    } finally {
      setPayingBillId(null);
    }
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatLastAnalyzed = (isoStr: string | null) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return null;
    }
  };

  const currentScore = diagnosis?.healthScore ?? 82;
  const totalInvoices =
    currentMonthProj?.totalInvoicesPending ??
    creditCards.reduce((acc, c) => acc + (c.invoiceAmount || 0), 0);
  const currentPendingCommitted = currentMonthProj?.pendingCommitted ?? 0;
  const monthlyIncome = userProfile?.monthlyIncomeBase || (monthIncome > 0 ? monthIncome : 5000);
  const commitmentRatio =
    monthlyIncome > 0
      ? Math.round(((monthExpense + currentPendingCommitted) / monthlyIncome) * 100)
      : 0;

  const quickPrompts = useMemo(() => {
    const p = normalizeCharacterId(selectedPersona);
    if (p === "wallet-rubi") {
      return [
        "💡 Rubi, qual meu teto diário seguro hoje?",
        `🎯 Como fechar com R$ ${formatCurrency(targetEndMonthBalance)} no fim do mês?`,
        "📊 Como está meu risco de fluxo de caixa (Cashflow at Risk)?",
        "⚡ Simular o impacto de uma nova compra no orçamento",
      ];
    }
    if (p === "wallet-sol") {
      return [
        "🛡️ Sol, quantos dias de sobrevivência e fôlego eu tenho hoje?",
        "🔥 Quais ralos invisíveis estão vazando meu dinheiro?",
        "🚨 Como blindar meu caixa contra imprevistos?",
        "📦 Qual o tamanho ideal do meu fundo de emergência?",
      ];
    }
    if (p === "wallet-nanquim") {
      return [
        "💳 Nanquim, qual o melhor cartão para comprar hoje?",
        "📅 Quantos dias livres sem juros tenho na fatura?",
        "⚖️ Compensa pagar à vista com desconto ou parcelar?",
        "📑 Como sincronizar os vencimentos das minhas faturas?",
      ];
    }
    // wallet-atlos
    return [
      "🚀 Atlos, como está a eficiência de alocação da minha sobra?",
      `💰 Quanto posso destinar para metas sem comprometer o mês?`,
      "📈 Como fazer meu excedente render com segurança?",
      "🎯 Como acelerar o alcance dos meus objetivos?",
    ];
  }, [selectedPersona, targetEndMonthBalance]);

  // Padrões de consumo mapeados
  const visibleSpecificAlerts = (diagnosis?.specificExpensesAlerts || []).filter((item: SpecificExpenseAlert) => {
    const itemName = (item.item || "").toLowerCase().trim();
    const habitCat = (item.habitCategory || "").toLowerCase().trim();
    return !dismissedPatterns.some((d) => {
      const norm = d.toLowerCase().trim();
      return (
        itemName === norm ||
        itemName.includes(norm) ||
        norm.includes(itemName) ||
        (habitCat && (habitCat === norm || habitCat.includes(norm) || norm.includes(habitCat)))
      );
    });
  });

  const categoryTotals: Record<string, number> = {};
  visibleSpecificAlerts.forEach((item: SpecificExpenseAlert) => {
    const cat = item.habitCategory || "Outros";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + item.totalAmount;
  });

  if (Object.keys(categoryTotals).length === 0 && transactions.length > 0) {
    transactions
      .filter((t) => t.type === "despesa")
      .forEach((t) => {
        const cat = t.category || "Outros";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
      });
  }

  const spectrumCategories: CategoryDistribution[] = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => {
      const theme = resolveAppleCategoryTheme(category);
      return {
        category,
        total,
        color: theme.color,
      };
    });

  const filteredPatterns = visibleSpecificAlerts.filter((item: SpecificExpenseAlert) => {
    if (selectedCategoryFilter && (item.habitCategory || "Outros") !== selectedCategoryFilter) {
      return false;
    }
    if (selectedCluster === "alerts") {
      return item.alertType === "alert" || item.alertType === "warning" || item.totalAmount >= 120;
    }
    if (selectedCluster === "recurring") {
      const cat = (item.habitCategory || "").toLowerCase();
      const name = item.item.toLowerCase();
      return (
        cat.includes("assinatura") ||
        cat.includes("streaming") ||
        name.includes("netflix") ||
        name.includes("spotify")
      );
    }
    if (selectedCluster === "habits") {
      const cat = (item.habitCategory || "").toLowerCase();
      return cat.includes("lanche") || cat.includes("café") || cat.includes("delivery");
    }
    return true;
  });

  // Ambientes de trabalho (Segmented Control da toolbar)
  const dossierEnvironments = [
    { value: "mindmap" as const, label: "Escritório", icon: <Building2 size={14} />, caption: "Agentes e análises em andamento" },
    { value: "calendar" as const, label: "Agenda", icon: <CalendarDays size={14} />, caption: "Entradas, contas e vencimentos" },
    { value: "storytelling" as const, label: "Padrões", icon: <Flame size={14} />, caption: "Hábitos, excessos e oportunidades" },
    { value: "overview" as const, label: "Visão geral", icon: <Shield size={14} />, caption: `Saúde da conta · ${currentScore} pontos` },
  ];
  const activeEnvironment = dossierEnvironments.find((env) => env.value === activeDossierTab) ?? dossierEnvironments[0];

  // Conversas agrupadas por data, como as seções de uma Sidebar do macOS
  const filteredSessions = sessions.filter((s) => {
    if (!sessionSearchQuery.trim()) return true;
    const q = sessionSearchQuery.toLowerCase();
    const inTitle = (s.title || "").toLowerCase().includes(q);
    const inMsgs = (s.messages || []).some((m) => m.content.toLowerCase().includes(q));
    return inTitle || inMsgs;
  });
  const sessionGroups = (() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000;
    const groups: { label: string; items: typeof sessions }[] = [
      { label: "Hoje", items: [] },
      { label: "Últimos 7 dias", items: [] },
      { label: "Anteriores", items: [] },
    ];
    for (const sess of filteredSessions) {
      const time = new Date(sess.updatedAt || sess.createdAt || 0).getTime();
      if (time >= startOfToday.getTime()) groups[0].items.push(sess);
      else if (time >= weekAgo) groups[1].items.push(sess);
      else groups[2].items.push(sess);
    }
    return groups.filter((group) => group.items.length > 0);
  })();

  return (
    <div className="relative min-h-full w-full overflow-x-hidden bg-[#F5F5F7] pb-32 md:pb-24 font-sans text-mac-label">
      {/* =========================================================
          1. TOOLBAR UNIFICADA (macOS 27): título, ambientes e ações
         ========================================================= */}
      <header className="mac-window-toolbar sticky top-0 z-30 !min-h-0 flex-wrap gap-y-2.5 !px-3 !py-2.5 sm:!px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#1D1D1F] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]" aria-hidden>
            <Sparkles size={15} className="text-emerald-300" />
          </span>
          <div className="min-w-0">
            <h1 className="mac-window-title truncate">Wallet+</h1>
            <p className="mac-window-subtitle truncate">Central financeira pessoal</p>
          </div>
        </div>

        <div className="order-3 w-full md:order-none md:w-auto md:flex-1 md:flex md:justify-center">
          <MacSegmentedControl
            ariaLabel="Ambientes do Wallet+"
            variant="toolbar"
            fullWidth
            className="md:!inline-flex md:!w-auto"
            value={activeDossierTab}
            onChange={setActiveDossierTab}
            options={dossierEnvironments.map((env) => ({ value: env.value, label: env.label, icon: <span className="hidden sm:inline-flex" aria-hidden>{env.icon}</span> }))}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Meta de fechamento: campo de texto do kit dentro de um grupo de vidro */}
          <MacToolbarGroup className="!pl-3 !pr-1.5 text-[12px] font-medium">
            <span className="text-mac-label-2 hidden sm:inline">Meta</span>
            {isEditingTarget ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const num = parseFloat(tempTargetInput);
                  if (!isNaN(num) && num >= 0) handleUpdateTarget(num);
                  setIsEditingTarget(false);
                }}
              >
                <MacTextField
                  type="number"
                  inputMode="decimal"
                  aria-label="Meta de saldo no fechamento"
                  value={tempTargetInput}
                  onChange={(e) => setTempTargetInput(e.target.value)}
                  className="!w-24 font-mono"
                  autoFocus
                />
                <MacButton type="submit" variant="prominent" size="small" shape="capsule">
                  OK
                </MacButton>
              </form>
            ) : (
              <MacToolbarButton
                onClick={() => {
                  setTempTargetInput(String(targetEndMonthBalance));
                  setIsEditingTarget(true);
                }}
                title="Editar sua meta de saldo"
                className="font-mono !text-[12px] !font-semibold"
              >
                R$ {formatCurrency(targetEndMonthBalance)}
              </MacToolbarButton>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                targetStatus === "on_track" ? "bg-mac-green/15 text-[#248a3d]" : "bg-mac-orange/15 text-[#c45500]"
              }`}
            >
              {targetStatus === "on_track" ? `+R$ ${formatCurrency(safeSpendingMargin)}` : `-R$ ${formatCurrency(missingAmount)}`}
            </span>
          </MacToolbarGroup>

          <MacToolbarGroup>
            <MacToolbarButton
              onClick={runDiagnosis}
              disabled={isAnalyzing}
              aria-label={isAnalyzing ? "Atualizando..." : "Atualizar dados"}
              title="Atualizar dados"
              icon={isAnalyzing ? <MacSpinner size={14} /> : <RefreshCw size={14} />}
            />
          </MacToolbarGroup>

          <MacButton
            variant="prominent"
            shape="capsule"
            size="large"
            onClick={() => openCopilotWithContext()}
            icon={<Sparkles size={13} />}
          >
            Chat IA
          </MacButton>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[1440px] space-y-4 px-3 py-4 sm:px-6 sm:py-5">
        <p className="px-1 text-[11px] font-medium text-mac-label-2">
          <span className="font-semibold text-mac-label">{activeEnvironment.label}</span> · {activeEnvironment.caption}
        </p>

        {/* =========================================================
            2. JANELA DO CHAT (Window + Sidebar + Toolbar unificada)
           ========================================================= */}
        <div className="flex flex-col gap-5">
          {isCopilotOpen && (
            <ChatDialog showHistory={isHistoryDrawerOpen} onClose={() => setIsCopilotOpen(false)}>
              {/* Alça de arraste no celular */}
              <div className="flex shrink-0 justify-center pt-2 pb-0.5 sm:hidden">
                <span className="h-1 w-9 rounded-full bg-black/15" />
              </div>

              {/* TOOLBAR UNIFICADA DA JANELA */}
              <MacWindowToolbar
                className="!pl-3 sm:!pl-4"
                leading={
                  <MacToolbarGroup>
                    <MacToolbarButton
                      onClick={() => setIsHistoryDrawerOpen((prev) => !prev)}
                      aria-label="Ver conversas anteriores"
                      aria-pressed={isHistoryDrawerOpen}
                      title="Conversas anteriores"
                      icon={<PanelLeft size={15} />}
                    />
                    <MacToolbarButton
                      onClick={handleNewChat}
                      aria-label="Nova conversa"
                      title="Iniciar uma nova conversa"
                      icon={<SquarePen size={15} />}
                    />
                  </MacToolbarGroup>
                }
                title={
                  currentSession?.title && currentSession.title !== "Nova Consulta"
                    ? currentSession.title
                    : "Wallet+ Intelligence"
                }
                subtitle={`Livre: R$ ${formatCurrency(effectiveProjectedFree)} · Hoje: R$ ${formatCurrency(safeSpendMetric.safeDailyAllowance)}`}
                trailing={
                  <MacToolbarGroup>
                    <MacToolbarButton
                      onClick={() => setIsCopilotOpen(false)}
                      aria-label="Fechar Chat"
                      title="Fechar"
                      icon={<X size={15} />}
                    />
                  </MacToolbarGroup>
                }
              />

              {/* CORPO: SIDEBAR DE CONVERSAS + CONVERSA */}
              <div className="relative flex min-h-0 flex-1 overflow-hidden">
                {isHistoryDrawerOpen && (
                  <>
                    {/* Fundo para fechar a sidebar no celular */}
                    <button
                      type="button"
                      aria-label="Fechar lista de conversas"
                      onClick={() => setIsHistoryDrawerOpen(false)}
                      className="absolute inset-0 z-20 bg-black/20 sm:hidden"
                    />
                    <MacSidebar
                      aria-label="Conversas"
                      className="absolute inset-y-0 left-0 z-30 w-[84%] max-w-[300px] border-r border-black/[0.06] animate-in slide-in-from-left duration-200 sm:relative sm:w-64 sm:shrink-0"
                    >
                      <div className="shrink-0 px-3 pb-2 pt-3">
                        <MacSearchField
                          size="medium"
                          value={sessionSearchQuery}
                          onChange={setSessionSearchQuery}
                          placeholder="Buscar nas conversas..."
                          aria-label="Buscar nas conversas"
                        />
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
                        <MacSidebarItems>
                          {sessionGroups.length === 0 && (
                            <p className="px-1 py-6 text-center text-[12px] text-mac-label-2">Nenhuma conversa encontrada.</p>
                          )}
                          {sessionGroups.map((group) => (
                            <React.Fragment key={group.label}>
                              <MacSidebarSection>{group.label}</MacSidebarSection>
                              {group.items.map((sess) => {
                                const lastMsg = sess.messages?.length ? sess.messages[sess.messages.length - 1] : null;
                                const previewText = lastMsg ? lastMsg.content.replace(/[#*`]/g, "").slice(0, 120) : "Sem mensagens ainda";
                                return (
                                  <MacSidebarItem
                                    key={sess.id}
                                    selected={sess.id === activeSessionId}
                                    onClick={() => handleSelectSession(sess.id)}
                                    icon={<MessageSquare size={15} />}
                                    label={sess.title || "Nova Consulta"}
                                    title={`${formatSessionDate(sess.updatedAt || sess.createdAt)} · ${previewText}`}
                                    detail={<span className="group-hover/sidebar:opacity-0">{sess.messages?.length || 0}</span>}
                                    accessory={
                                      <MacButton
                                        variant="borderless"
                                        size="small"
                                        shape="capsule"
                                        iconOnly
                                        aria-label="Excluir conversa"
                                        title="Excluir conversa"
                                        className="!text-mac-label-2 hover:!text-mac-red"
                                        onClick={(e) => handleDeleteSession(sess.id, e)}
                                        icon={<Trash2 size={13} />}
                                      />
                                    }
                                  />
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </MacSidebarItems>
                      </div>
                    </MacSidebar>
                  </>
                )}

                {/* COLUNA PRINCIPAL DA CONVERSA */}
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-mac-window">
                  {/* Troca rápida entre conversas recentes */}
                  {sessions.length > 1 && !isHistoryDrawerOpen && (
                    <div className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-black/[0.05] px-4 py-2 no-scrollbar">
                      <span className="mac-group-title mr-1 shrink-0">Recentes</span>
                      {sessions.slice(0, 6).map((sess) => (
                        <MacButton
                          key={sess.id}
                          size="small"
                          shape="capsule"
                          variant={sess.id === activeSessionId ? "tinted" : "bordered"}
                          onClick={() => handleSelectSession(sess.id)}
                          className="max-w-[180px] shrink-0"
                        >
                          <span className="truncate">{sess.title || "Nova Consulta"}</span>
                        </MacButton>
                      ))}
                    </div>
                  )}

                  {/* Contexto vindo de um módulo */}
                  {copilotContext && (
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-mac-blue/15 bg-mac-blue/[0.07] px-4 py-2 text-[12px]">
                      <div className="min-w-0 truncate">
                        <span className="mr-2 text-[11px] font-semibold text-mac-blue">{copilotContext.eyebrow}</span>
                        <span className="font-medium text-mac-label">{copilotContext.title}</span>
                      </div>
                      <MacButton
                        variant="borderless"
                        size="small"
                        shape="capsule"
                        iconOnly
                        aria-label="Remover contexto"
                        className="!text-mac-label-2"
                        onClick={() => setCopilotContext(null)}
                        icon={<X size={13} />}
                      />
                    </div>
                  )}

                  {/* MENSAGENS */}
                  <div className="relative min-h-0 min-w-0 flex-1">
                    <div
                      ref={chatFeedRef}
                      onScroll={handleChatScroll}
                      data-testid="ai-chat-feed"
                      className="h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 space-y-4 overscroll-contain touch-scroll"
                    >
                      {messages.length === 0 ? (
                        <div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[#1D1D1F] text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
                            <Sparkles size={24} className="text-emerald-300" />
                          </div>
                          <h2 className="text-[17px] font-bold tracking-tight text-mac-label">
                            Como posso ajudar nas suas finanças hoje?
                          </h2>
                          <p className="mt-1 max-w-md text-[13px] leading-[18px] text-mac-label-2">
                            Pergunte livremente sobre compras, parcelamentos, faturas, fluxo de caixa ou metas. A IA responde em tempo real com base nos seus dados.
                          </p>

                          {/* Sugestões de um toque (Group Boxes clicáveis) */}
                          <div className="mt-5 grid w-full max-w-lg grid-cols-1 gap-2 text-left sm:grid-cols-2">
                            {[
                              { label: "Simular compra ou parcela", icon: <Calculator size={14} />, prompt: "Se eu fizer uma compra parcelada hoje, qual o impacto no meu fluxo e na minha meta do mês?" },
                              { label: "Melhor cartão para usar hoje", icon: <CreditCard size={14} />, prompt: "Qual dos meus cartões vale mais a pena usar hoje considerando limite e fechamento?" },
                              { label: "Onde posso economizar", icon: <TrendingUp size={14} />, prompt: "Analise meus gastos atuais e me diga de forma direta onde posso economizar neste mês." },
                              { label: "Garantir minha meta do mês", icon: <ShieldCheck size={14} />, prompt: `O que preciso fazer para fechar o mês com pelo menos R$ ${formatCurrency(targetEndMonthBalance)} livres?` },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => handleSendMessage(item.prompt)}
                                className="mac-group-box group flex flex-col gap-1 p-3 text-left outline-none transition-colors hover:bg-mac-fill-2 active:bg-mac-fill focus-visible:shadow-[var(--mac-focus-ring)]"
                              >
                                <span className="flex items-center gap-2 text-[13px] font-semibold text-mac-label">
                                  <span className="text-mac-blue" aria-hidden>{item.icon}</span>
                                  <span className="flex-1">{item.label}</span>
                                  <ArrowUpRight size={13} className="text-mac-label-3 group-hover:text-mac-label-2" />
                                </span>
                                <span className="text-[11px] leading-[14px] text-mac-label-2 line-clamp-2">{item.prompt}</span>
                              </button>
                            ))}
                          </div>

                          {sessions.some((s) => (s.messages?.length || 0) > 0 && s.id !== activeSessionId) && (
                            <MacButton
                              variant="bordered"
                              shape="capsule"
                              className="mt-5"
                              onClick={() => setIsHistoryDrawerOpen(true)}
                              icon={<History size={13} />}
                            >
                              Ver conversas anteriores ({sessions.filter((s) => (s.messages?.length || 0) > 0).length})
                            </MacButton>
                          )}
                        </div>
                      ) : (
                        messages.map((msg, index) => {
                          const isLast = index === messages.length - 1;
                          const isUser = msg.role === "user";

                          return (
                            <div
                              key={msg.id}
                              ref={isLast ? lastMessageRef : undefined}
                              className={`flex min-w-0 max-w-full flex-col scroll-mt-4 ${isUser ? "items-end" : "items-start"}`}
                            >
                              {isUser ? (
                                <div className="min-w-0 max-w-[86%] sm:max-w-[78%] rounded-[18px] rounded-br-[5px] bg-mac-blue px-3.5 py-2.5 text-white">
                                  <FormattedMessage content={msg.content} role="user" />
                                  <div className="mt-1 text-right text-[10px] text-white/70">{msg.timestamp}</div>
                                </div>
                              ) : (
                                <div className="mac-group-box min-w-0 w-full max-w-[96%] sm:max-w-[90%] !rounded-[18px] !rounded-tl-[5px] p-4 text-mac-label space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-[#1D1D1F] text-white" aria-hidden>
                                        <Sparkles size={10} className="text-emerald-300" />
                                      </span>
                                      <span className="text-[12px] font-semibold text-mac-label">Wallet+ IA</span>
                                      <span className="text-[11px] text-mac-label-2">{msg.timestamp}</span>
                                    </div>

                                    <MacButton
                                      variant="borderless"
                                      size="small"
                                      shape="capsule"
                                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                                      title="Copiar resposta"
                                      icon={copiedMessageId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                                      className={copiedMessageId === msg.id ? "!text-[#248a3d]" : ""}
                                    >
                                      {copiedMessageId === msg.id ? "Copiado" : "Copiar"}
                                    </MacButton>
                                  </div>

                                  {msg.simulationResult && (
                                    <div
                                      className={`rounded-[10px] px-3 py-2.5 text-[12px] ${
                                        msg.simulationResult.verdict === "safe"
                                          ? "bg-mac-green/12 text-[#1d6b31]"
                                          : msg.simulationResult.verdict === "warning"
                                          ? "bg-mac-orange/14 text-[#8a4a00]"
                                          : "bg-mac-red/12 text-[#a1191c]"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 font-semibold">
                                        {msg.simulationResult.verdict === "safe" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                        <span>
                                          Veredito da Simulação: {msg.simulationResult.verdict === "safe" ? "Compra Viável" : "Requer Atenção"}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-[11px] leading-[15px]">{msg.simulationResult.verdictMessage}</p>
                                    </div>
                                  )}

                                  <FormattedMessage content={msg.content} role="assistant" />

                                  {isLast && !isSending && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                      {["E se for em menos parcelas?", "Como reduzir esse impacto?", "Simular outro valor"].map((followUp) => (
                                        <MacButton
                                          key={followUp}
                                          variant="bordered"
                                          size="small"
                                          shape="capsule"
                                          onClick={() => {
                                            if (followUp === "Simular outro valor") setIsInlineSimOpen(true);
                                            else handleSendMessage(followUp);
                                          }}
                                        >
                                          {followUp}
                                        </MacButton>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      {chatError && chatError.sessionId === activeSessionId && !isSending && (
                        <div role="alert" className="flex w-full max-w-[96%] sm:max-w-[90%] items-start gap-2.5 rounded-[14px] bg-mac-orange/12 px-3.5 py-3 text-[12px] text-[#8a4a00]">
                          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">A IA não respondeu</p>
                            <p className="mt-0.5 leading-[16px]">{chatError.message}</p>
                          </div>
                          <MacButton
                            variant="bordered"
                            size="small"
                            shape="capsule"
                            className="shrink-0"
                            onClick={() => void handleSendMessage(chatError.text, chatError.simulationPayload, { retry: true })}
                            icon={<RefreshCw size={11} />}
                          >
                            Tentar novamente
                          </MacButton>
                        </div>
                      )}

                      {isSending && (
                        <div className="mac-group-box flex w-fit items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-mac-label-2">
                          <MacSpinner size={14} />
                          <span>Analisando seu fluxo de caixa e cartões...</span>
                        </div>
                      )}
                      <div ref={chatBottomRef} className="h-1" />
                    </div>

                    {showScrollToBottom && messages.length > 0 && (
                      <MacButton
                        variant="glass"
                        size="large"
                        onClick={scrollToChatBottom}
                        icon={<ChevronDown size={14} />}
                        className="!absolute bottom-3 right-5 z-20"
                      >
                        Ir para o final
                      </MacButton>
                    )}
                  </div>

                  {/* SIMULADOR RÁPIDO (formulário macOS) */}
                  {isInlineSimOpen && (
                    <div className="max-h-[45%] shrink-0 overflow-y-auto overscroll-contain border-t border-black/[0.06] bg-[#F5F5F7] px-4 py-3 sm:px-5 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-mac-label">
                          <Calculator size={14} className="text-mac-blue" />
                          Simulador rápido de compra
                        </span>
                        <MacButton
                          variant="borderless"
                          size="small"
                          shape="capsule"
                          iconOnly
                          aria-label="Fechar simulador"
                          className="!text-mac-label-2"
                          onClick={() => setIsInlineSimOpen(false)}
                          icon={<X size={14} />}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
                        <MacFormRow label="O que deseja comprar?" htmlFor="sim-description">
                          <MacTextField
                            id="sim-description"
                            size="large"
                            placeholder="Ex: Tênis"
                            value={simDescription}
                            onChange={(e) => setSimDescription(e.target.value)}
                          />
                        </MacFormRow>
                        <MacFormRow label="Valor (R$)" htmlFor="sim-amount">
                          <MacTextField
                            id="sim-amount"
                            size="large"
                            inputMode="decimal"
                            placeholder="Ex: 350"
                            value={simAmount}
                            onChange={(e) => setSimAmount(e.target.value)}
                            className="font-mono"
                          />
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
                        <MacSegmentedControl
                          ariaLabel="Forma de pagamento da simulação"
                          value={simMethod}
                          onChange={setSimMethod}
                          options={[
                            { value: "credit", label: "Crédito" },
                            { value: "cash", label: "À vista" },
                          ]}
                        />
                        <MacButton variant="prominent" size="large" shape="capsule" onClick={executeSimulation}>
                          Simular na IA
                        </MacButton>
                      </div>
                    </div>
                  )}

                  {/* COMPOSER — campo de vidro do macOS 27 */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    data-testid="ai-chat-composer"
                    className="min-w-0 shrink-0 border-t border-black/[0.05] bg-mac-window px-3 py-2.5 sm:px-5 sm:py-3 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))]"
                  >
                    <div className="mac-search-field !h-auto min-h-[40px] items-end !gap-1.5 !rounded-[20px] !px-1.5 !py-1.5">
                      <MacToolbarButton
                        onClick={() => setIsInlineSimOpen(!isInlineSimOpen)}
                        aria-pressed={isInlineSimOpen}
                        title="Simular impacto de uma compra"
                        aria-label="Simular"
                        icon={<Calculator size={15} className={isInlineSimOpen ? "text-mac-blue" : undefined} />}
                      />

                      <textarea
                        ref={chatInputRef}
                        rows={1}
                        value={inputMessage}
                        onChange={(e) => {
                          setInputMessage(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            if (inputMessage.trim() && !isSending) {
                              void handleSendMessage();
                            }
                          }
                        }}
                        enterKeyHint="send"
                        placeholder="Mensagem para Wallet+ IA..."
                        aria-label="Mensagem para Wallet+ IA"
                        maxLength={1000}
                        className="max-h-[120px] min-h-[28px] min-w-0 flex-1 resize-none bg-transparent px-1 py-[5px] text-[16px] sm:text-[13px] leading-[18px] font-medium text-mac-label placeholder:text-mac-label-2 placeholder:font-normal focus:outline-none"
                      />

                      <button
                        type="submit"
                        disabled={!inputMessage.trim() || isSending}
                        aria-label="Enviar mensagem"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mac-blue text-white outline-none transition-[filter,opacity] active:brightness-90 disabled:bg-mac-fill disabled:text-mac-label-3 focus-visible:shadow-[var(--mac-focus-ring)] [@media(pointer:coarse)]:h-8 [@media(pointer:coarse)]:w-8"
                      >
                        <ArrowUp size={15} strokeWidth={2.6} />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </ChatDialog>
          )}

          {/* =======================================================
              3. AMBIENTE ATIVO
             ======================================================= */}
          <div className="order-1 flex flex-col space-y-4">
            {activeDossierTab === "mindmap" && (
              <FinancialOffice
                cards={cards}
                transactions={transactions}
                recurringItems={recurringItems}
                goals={goals}
                monthlyProjections={officeMonthlyProjections}
                diagnosis={diagnosis}
                targetEndMonthBalance={targetEndMonthBalance}
                isAnalyzing={isAnalyzing}
                onRefresh={runDiagnosis}
                onDiscussWithAI={() => openCopilotWithContext()}
              />
            )}

            {activeDossierTab === "calendar" && (
              <SpendingCalendarHeatmap
                recurringItems={recurringItems}
                cards={cards}
                transactions={transactions}
                mainBalance={mainBalance}
                safeDailyAllowance={safeSpendMetric.safeDailyAllowance}
                targetEndMonthBalance={targetEndMonthBalance}
                monthlyProjection={currentMonthProj}
                onRealizeItem={realizeRecurringItemNow}
                onDiscussWithAI={(topic) => openCopilotWithContext({ eyebrow: "Agenda financeira", title: "Entrada, conta ou vencimento selecionado", detail: "Niko recebeu o contexto do calendário." }, topic)}
              />
            )}

            {activeDossierTab === "storytelling" && (
              <VisualPatternStorytelling
                diagnosis={diagnosis}
                targetEndMonthBalance={targetEndMonthBalance}
                effectiveProjectedFree={effectiveProjectedFree}
                safeDailyAllowance={safeSpendMetric.safeDailyAllowance}
                mainBalance={mainBalance}
                monthExpense={monthExpense}
                transactions={transactions}
                onDiscussWithAI={(prompt) => openCopilotWithContext({ eyebrow: "Diagnóstico de hábitos", title: "Padrão de gasto selecionado", detail: "Impacto, transações relacionadas e estratégia de redução." }, prompt)}
                onOpenSimulator={(params) => {
                  if (params?.description) setSimDescription(params.description);
                  if (params?.amount) setSimAmount(String(params.amount));
                  setCopilotContext({ eyebrow: "Simulador", title: params?.description || "Impacto de uma nova compra", detail: "A decisão será comparada com sua meta e sua margem real." });
                  setIsCopilotOpen(true);
                  setIsInlineSimOpen(true);
                }}
                onDismissPattern={handleDismissPattern}
                onRefreshPatterns={handleFetchMorePatterns}
                isSearchingPatterns={isSearchingPatterns}
              />
            )}

            {activeDossierTab === "overview" && (
              <div className="grid grid-cols-12 gap-4 animate-in fade-in duration-300">
                <div className="col-span-12">
                  <FinancialHealthRing
                    score={currentScore}
                    healthStatus={diagnosis?.healthStatus}
                    commitmentRatio={commitmentRatio}
                    commitmentCeiling={userProfile?.maxCommitmentAlertPercent || 60}
                    mainBalance={mainBalance}
                    totalInvoices={totalInvoices}
                    pendingBills={diagnosis?.cashflowWindow?.currentMonth.pendingBills ?? currentPendingCommitted}
                    targetEndMonthBalance={targetEndMonthBalance}
                    projectedFreeBalance={diagnosis?.targetAnalysis?.projectedEndMonthBalance ?? effectiveProjectedFree}
                    safeSpendingMargin={diagnosis?.targetAnalysis?.safeSpendingMargin ?? safeSpendingMargin}
                    missingAmount={diagnosis?.targetAnalysis?.missingAmount ?? missingAmount}
                    targetStatus={diagnosis?.targetAnalysis?.status ?? targetStatus}
                    onUpdateTarget={handleUpdateTarget}
                    executiveSummary={cleanExecutiveSummary(diagnosis?.executiveSummary)}
                    onOpenSimulator={() => { setCopilotContext({ eyebrow: "Simulador", title: "Impacto de uma nova compra", detail: "Use os dados reais da conta para testar a decisão." }); setIsCopilotOpen(true); setIsInlineSimOpen(true); }}
                    onDiscussWithAI={(topic) => openCopilotWithContext({ eyebrow: "Visão geral", title: "Saúde financeira & meta", detail: `${currentScore} pontos · saldo projetado de R$ ${formatCurrency(effectiveProjectedFree)}` }, topic)}
                  />
                </div>

                <div className="col-span-12 lg:col-span-7">
                  <CashflowBarChart
                    currentMonthName={diagnosis?.cashflowWindow?.currentMonth.monthName || "Mês atual"}
                    currentBalance={diagnosis?.cashflowWindow?.currentMonth.checkingBalance ?? mainBalance}
                    currentPending={diagnosis?.cashflowWindow?.currentMonth.pendingBills ?? currentPendingCommitted}
                    currentFree={diagnosis?.cashflowWindow?.currentMonth.projectedFreeBalance ?? mainBalance}
                    nextMonthName={diagnosis?.cashflowWindow?.nextMonth.monthName || "Próximo mês"}
                    nextIncome={diagnosis?.cashflowWindow?.nextMonth.projectedIncome ?? monthlyIncome}
                    nextExpenses={diagnosis?.cashflowWindow?.nextMonth.committedExpenses ?? totalInvoices}
                    nextFree={diagnosis?.cashflowWindow?.nextMonth.projectedFreeBalance ?? (monthlyIncome - totalInvoices)}
                  />
                </div>

                {/* Próximos vencimentos — lista no padrão "Lists and Tables" */}
                <section className="col-span-12 flex min-h-[360px] flex-col rounded-[20px] border border-black/[0.04] bg-mac-window py-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] lg:col-span-5">
                  <div className="flex items-center justify-between gap-3 px-4 pb-2">
                    <div className="flex items-center gap-2.5">
                      <CalendarClock size={16} className="text-mac-blue" />
                      <div>
                        <h3 className="text-[13px] font-semibold text-mac-label">Próximos vencimentos</h3>
                        <p className="text-[11px] text-mac-label-2">Lembretes e baixas rápidas</p>
                      </div>
                    </div>
                    <MacButton
                      variant="borderless"
                      size="small"
                      shape="capsule"
                      onClick={() => setActiveDossierTab("calendar")}
                      title="Abrir agenda completa"
                    >
                      Ver agenda
                    </MacButton>
                  </div>

                  {upcomingEvents.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-center text-[12px] text-mac-label-2">
                      <CheckCircle2 size={22} className="mb-2 text-mac-green" />
                      <p>Nenhuma conta pendente nos próximos dias.</p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div className="mac-group-title px-4 pb-1">Esta semana</div>
                      {upcomingEvents.slice(0, 5).map((event, index) => (
                        <div key={event.id} data-alternate={index % 2 === 1} className="mac-row flex items-center gap-3 px-4 py-2">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${event.isUrgent ? "bg-mac-orange/15 text-[#c45500]" : "bg-mac-fill-3 text-mac-indigo"}`}>
                            {event.type === "credit_invoice" ? <CreditCard size={13} /> : <Building2 size={13} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="block truncate text-[13px] font-medium text-mac-label">{event.title}</strong>
                            <span className="text-[11px] text-mac-label-2">
                              {event.daysRemaining === 0 ? "vence hoje" : `em ${event.daysRemaining}d`} · {event.dueDate}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <strong className="text-[13px] font-semibold tabular-nums text-mac-label">R$ {formatCurrency(event.amount)}</strong>
                            {event.id.startsWith("recurring_") && (
                              <MacButton
                                variant="tinted"
                                size="small"
                                onClick={() => handlePayUpcomingItem(event.id)}
                                disabled={payingBillId === event.id}
                              >
                                {payingBillId === event.id ? "Baixando…" : "Baixar"}
                              </MacButton>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {spectrumCategories.length > 0 && (
                  <div className="col-span-12">
                    <CategorySpectrumBar
                      categories={spectrumCategories}
                      selectedCategory={selectedCategoryFilter}
                      onSelectCategory={setSelectedCategoryFilter}
                      transactions={transactions}
                      insights={visibleSpecificAlerts}
                      onDiscussWithAI={(prompt) => openCopilotWithContext({ eyebrow: "Gastos por categoria", title: selectedCategoryFilter || spectrumCategories[0]?.category || "Categoria", detail: "Lançamentos e concentração de gastos." }, prompt)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BARRA FLUTUANTE DE PERGUNTA RÁPIDA — Liquid Glass */}
      {!isCopilotOpen && (
        <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-5 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-1.5rem)] max-w-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputMessage.trim()) {
                handleSendMessage();
              } else {
                openCopilotWithContext();
              }
            }}
            className="mac-search-field !h-12 !gap-1.5 !pl-1.5 !pr-1.5 shadow-[var(--mac-glass-control-shadow),0_18px_48px_rgba(0,0,0,0.16)]"
          >
            <MacToolbarButton
              onClick={() => openCopilotWithContext()}
              title="Abrir Chat IA"
              aria-label="Abrir Chat IA"
              className="relative !h-9 !w-9"
              icon={<Sparkles size={16} className="text-mac-blue" />}
            />

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onFocus={() => {
                if (messages.length > 0) setIsCopilotOpen(true);
              }}
              enterKeyHint="send"
              aria-label="Pergunte qualquer coisa para a IA Wallet+"
              placeholder="Pergunte qualquer coisa para a IA Wallet+..."
              maxLength={1000}
            />

            {sessions.length > 1 && (
              <MacToolbarButton
                onClick={() => {
                  setIsCopilotOpen(true);
                  setIsHistoryDrawerOpen(true);
                }}
                title="Ver conversas salvas"
                aria-label={`Ver conversas salvas (${sessions.length})`}
                icon={<History size={14} />}
                label={String(sessions.length)}
                hideLabelOnMobile
              />
            )}

            <MacButton type="submit" variant="prominent" shape="capsule" size="large" icon={<ArrowUp size={14} strokeWidth={2.5} />}>
              {inputMessage.trim() ? "Enviar" : "Chat"}
            </MacButton>
          </form>
        </div>
      )}

      {/* Calendário financeiro completo — Sheet do macOS */}
      <MacSheet
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        title="Calendário Financeiro Contábil"
        icon={<CalendarDays size={16} />}
      >
        <InteractiveFinancialCalendar />
      </MacSheet>
    </div>
  );
}
