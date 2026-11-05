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
  Send,
  RefreshCw,
  CreditCard,
  Clock,
  ChevronRight,
  ChevronDown,
  Trash2,
  UtensilsCrossed,
  CalendarClock,
  Coins,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  CalendarDays,
  X,
  Building2,
  Flame,
  Shield,
  History,
} from "lucide-react";
import { FormattedMessage } from "@/components/ai/FormattedMessage";
import { FinancialHealthRing } from "@/components/ai/FinancialHealthRing";
import { CashflowBarChart } from "@/components/ai/CashflowBarChart";
import {
  CategorySpectrumBar,
  CategoryDistribution,
  resolveAppleCategoryTheme,
} from "@/components/ai/CategorySpectrumBar";
import { InstallmentTimelineChart } from "@/components/ai/InstallmentTimelineChart";
import { InteractivePatternCard } from "@/components/ai/InteractivePatternCard";
import { FinancialOffice } from "@/components/ai/FinancialOffice";
import { SpendingCalendarHeatmap } from "@/components/ai/SpendingCalendarHeatmap";
import { VisualPatternStorytelling } from "@/components/ai/VisualPatternStorytelling";
import { normalizeCharacterId } from "@/components/companion/WalletCharacters";
import { InteractiveFinancialCalendar } from "@/components/companion/InteractiveFinancialCalendar";
import { PurchaseSimulatorModal } from "@/components/companion/PurchaseSimulatorModal";
import {
  calculateDailySafeSpend,
  getUpcomingFinancialEvents,
  calculateWeeklySpendingVelocity,
  getBestCardToSpendToday,
} from "@/lib/services/dailyCompanionService";
import {
  FinancialDiagnosis,
  SpecificExpenseAlert,
  safeParseFinancialDiagnosis,
} from "@/lib/services/financialDiagnosisService";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  simulatePurchaseImpact,
  PurchaseSimulationInput,
  PurchaseSimulationResult,
} from "@/lib/services/financialContextService";
import {
  generateDeterministicAuditDossier,
  generateDeterministicAnalystChatReply,
} from "@/lib/services/agentManagerService";
import { auth } from "@/lib/firebase";
import {
  ChatSession,
  loadChatSessions,
  saveChatSessions,
  createChatSession,
  deleteChatSession,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  loadPersistentDiagnosis,
  savePersistentDiagnosis,
  loadInitialDiagnosisSync,
  loadDismissedPatterns,
  dismissPattern,
} from "@/lib/services/aiChatService";

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

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCopilotOpen) return;
    const focusTimer = window.setTimeout(() => chatInputRef.current?.focus(), 260);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsCopilotOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCopilotOpen]);

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
          plannedIncomesTotal: p.plannedIncomesTotal,
          recurringDebitTotal: p.recurringDebitTotal,
          recurringCreditTotal: p.recurringCreditTotal,
          cardInstallments: p.cardInstallments,
          totalCommitted: p.totalCommitted,
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
          plannedIncomesTotal: p.plannedIncomesTotal,
          recurringDebitTotal: p.recurringDebitTotal,
          recurringCreditTotal: p.recurringCreditTotal,
          cardInstallments: p.cardInstallments,
          totalCommitted: p.totalCommitted,
          projectedFreeBalance: p.projectedFreeBalance,
          monthNetSurplus: p.monthNetSurplus,
        };
      });
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

  // Scroll automático no chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

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

  const handleSendMessage = async (textToSend?: string, simulationPayload?: unknown) => {
    const text = (textToSend || inputMessage).trim();
    if (!text && !simulationPayload) return;
    setIsCopilotOpen(true);

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

    const currentMsgs = activeSess.messages || [];
    const newMessages = [...currentMsgs, userMsg];
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

    if (!textToSend) setInputMessage("");
    setIsSending(true);

    try {
      const monthlyProjections = [0, 1, 2, 3, 4, 5].map((idx) => {
        const p = getMonthlyProjection(idx);
        return {
          monthName: p.monthName,
          year: p.year,
          openingBalance: p.openingBalance,
          plannedIncomesTotal: p.plannedIncomesTotal,
          recurringDebitTotal: p.recurringDebitTotal,
          recurringCreditTotal: p.recurringCreditTotal,
          cardInstallments: p.cardInstallments,
          totalCommitted: p.totalCommitted,
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
        throw new Error(data?.error || "Fallback local acionado");
      }
    } catch {
      const monthlyProjections = [0, 1, 2, 3, 4, 5].map((idx) => {
        const p = getMonthlyProjection(idx);
        return {
          monthName: p.monthName,
          year: p.year,
          openingBalance: p.openingBalance,
          plannedIncomesTotal: p.plannedIncomesTotal,
          recurringDebitTotal: p.recurringDebitTotal,
          recurringCreditTotal: p.recurringCreditTotal,
          cardInstallments: p.cardInstallments,
          totalCommitted: p.totalCommitted,
          projectedFreeBalance: p.projectedFreeBalance,
          monthNetSurplus: p.monthNetSurplus,
        };
      });
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
      const localSim =
        simulationPayload && typeof (simulationPayload as { amount?: number }).amount === "number"
          ? simulatePurchaseImpact(simulationPayload as PurchaseSimulationInput, telemetry, cards)
          : null;
      const auditDossier = generateDeterministicAuditDossier({
        context: safeContext,
        userMessage: text,
      });
      const fallbackReply = generateDeterministicAnalystChatReply({
        context: safeContext,
        auditDossier,
        userMessage: text,
        simulationResult: localSim,
      });

      const assistantMsg: ChatMessage = {
        id: globalThis.crypto.randomUUID(),
        role: "assistant",
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        modelUsed: "motor-contabil-local",
        simulationResult: localSim,
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
    } finally {
      setIsSending(false);
    }
  };

  const openCopilotWithContext = (
    context: CopilotContext,
    prompt: string
  ) => {
    setCopilotContext(context);
    setIsCopilotOpen(true);
    void handleSendMessage(prompt);
  };

  const handleNewChat = () => {
    const newSess = createChatSession("Nova Consulta");
    const updated = [newSess, ...sessions];
    setSessions(updated);
    setActiveSessionId(newSess.id);
    setMessages([]);
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
  const totalInvoices = creditCards.reduce((acc, c) => acc + (c.spent || c.invoiceAmount || 0), 0);
  const monthlyIncome = userProfile?.monthlyIncomeBase || (monthIncome > 0 ? monthIncome : 5000);
  const commitmentRatio =
    monthlyIncome > 0 ? Math.round(((monthExpense + totalInvoices) / monthlyIncome) * 100) : 0;

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

  return (
    <div className="relative min-h-full w-full overflow-x-hidden bg-[linear-gradient(180deg,#F5F6F8_0%,#EFF1F4_46%,#F5F5F7_100%)] pb-12 font-sans text-[#1D1D1F] selection:bg-[#1D1D1F] selection:text-white">
      <div className="pointer-events-none absolute -left-48 top-28 h-[520px] w-[520px] rounded-full bg-emerald-200/20 blur-[110px]" />
      <div className="pointer-events-none absolute -right-56 top-[420px] h-[620px] w-[620px] rounded-full bg-blue-200/20 blur-[130px]" />
      <div className="relative z-10 mx-auto w-full max-w-[1440px] space-y-5 px-3 py-4 sm:px-6 sm:py-6">
        
        {/* =========================================================
            1. HEADER EXECUTIVO WALLET+ COM APPLE WHITE IDENTITY
           ========================================================= */}
        <header className="flex flex-col justify-between gap-4 rounded-[28px] border border-white/80 bg-white/78 p-4 shadow-[0_16px_50px_rgba(27,38,33,0.055)] backdrop-blur-2xl md:flex-row md:items-center sm:p-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
              <Building2 size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-baseline">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
                    Wallet
                  </span>
                  <span className="text-2xl font-black text-[#1D1D1F] ml-0.5 leading-none">
                    +
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F2F2F7] text-[11px] font-semibold text-[#1D1D1F] border border-black/[0.05]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Central financeira pessoal</span>
                </div>
              </div>
              <p className="text-xs text-[#86868B] truncate mt-0.5">
                Conta, cartões, agenda, hábitos e metas organizados em uma visão de trabalho.
              </p>
            </div>
          </div>

          {/* Indicadores Vitais & Ações de Topo */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {/* Meta Interativa */}
            <div className="flex items-center gap-1.5 bg-[#F8F8FA] border border-black/[0.06] px-3 py-1.5 rounded-full text-xs">
              <span className="text-[#86868B] font-medium">Meta Fechamento:</span>
              {isEditingTarget ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={tempTargetInput}
                    onChange={(e) => setTempTargetInput(e.target.value)}
                    className="w-16 px-1 py-0.5 text-xs font-mono font-bold bg-white border rounded"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const num = parseFloat(tempTargetInput);
                      if (!isNaN(num) && num >= 0) handleUpdateTarget(num);
                      setIsEditingTarget(false);
                    }}
                    className="text-[10px] font-bold text-emerald-600 px-1"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTempTargetInput(String(targetEndMonthBalance));
                    setIsEditingTarget(true);
                  }}
                  className="font-bold font-mono text-[#1D1D1F] hover:underline cursor-pointer"
                  title="Clique para editar sua meta de saldo"
                >
                  R$ {formatCurrency(targetEndMonthBalance)}
                </button>
              )}
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1 ${
                  targetStatus === "on_track"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {targetStatus === "on_track" ? `+R$ ${formatCurrency(safeSpendingMargin)}` : `-R$ ${formatCurrency(missingAmount)}`}
              </span>
            </div>

            {/* Botão Sincronizar Análise */}
            <button
              type="button"
              onClick={runDiagnosis}
              disabled={isAnalyzing}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F2F2F7] active:scale-95 border border-black/[0.08] text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw size={12} className={isAnalyzing ? "animate-spin text-[#1D1D1F]" : "text-[#86868B]"} />
              <span className="hidden sm:inline">{isAnalyzing ? "Atualizando..." : "Atualizar dados"}</span>
            </button>
          </div>
        </header>

        {/* =========================================================
            2. WORKSPACE WALLET+: ESCRITÓRIO PRIMEIRO, NIKO COMO APOIO
           ========================================================= */}
        <div className="flex flex-col gap-5">

          {/* NIKO COPILOT: UMA ÚNICA CAMADA GLOBAL, FORA DO FLUXO DA PÁGINA */}
          {isCopilotOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar Niko Copilot"
                onClick={() => setIsCopilotOpen(false)}
                className="fixed inset-0 z-[120] cursor-default bg-black/20 backdrop-blur-md animate-in fade-in duration-200"
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Niko Copilot"
                className="fixed inset-y-0 right-0 z-[130] flex w-full max-w-[500px] flex-col border-l border-black/[0.06] bg-white/95 p-4 shadow-[-24px_0_70px_rgba(0,0,0,0.14)] backdrop-blur-2xl animate-in slide-in-from-right duration-300 sm:bottom-3 sm:right-3 sm:top-16 sm:rounded-[32px] sm:border sm:p-5"
              >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                  Niko Copilot · contexto ativo
                </span>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#1D1D1F]">
                  Converse sem sair da análise
                </h2>
                <p className="mt-0.5 text-[11px] text-[#6E6E73]">
                  Niko mantém o card e os números que abriram esta conversa.
                </p>
              </div>
              <button type="button" onClick={() => setIsCopilotOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F2F7] text-[#6E6E73] transition-colors hover:bg-[#E5E5EA] hover:text-[#1D1D1F]" aria-label="Fechar Copilot"><X size={14} /></button>
            </div>

            {copilotContext && (
              <div className="mb-3 rounded-[18px] border border-black/[0.05] bg-[linear-gradient(135deg,#F5F5F7,#FFFFFF)] p-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.025)]">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[#1D1D1F] text-white"><Sparkles size={14} /></span>
                  <div className="min-w-0"><span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#86868B]">{copilotContext.eyebrow}</span><strong className="mt-0.5 block text-[11px] font-semibold text-slate-900">{copilotContext.title}</strong>{copilotContext.detail && <p className="mt-0.5 text-[9px] text-[#86868B]">{copilotContext.detail}</p>}</div>
                </div>
              </div>
            )}

            {/* ATALHOS DE CONVERSA */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-[#F8F8FA] active:scale-95 text-[#1D1D1F] text-[11px] font-semibold border border-black/[0.06] shadow-2xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* FEED DE CONVERSA */}
            <div className="mt-3 flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-[24px] border border-black/[0.06] bg-white">
              {/* Header da conversa ativa */}
              <div className="p-3.5 px-4 border-b border-black/[0.05] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-bold text-[#1D1D1F] truncate max-w-[200px]">
                    {currentSession?.title || "Consulta com Auditor"}
                  </span>
                  <span className="text-[10px] font-medium text-[#86868B] bg-[#F2F2F7] px-2 py-0.5 rounded-full">
                    {messages.length} msgs
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
                    className="p-1.5 rounded-lg text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors cursor-pointer"
                    title="Histórico de conversas salvas"
                  >
                    <History size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="p-1.5 rounded-lg text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors cursor-pointer"
                    title="Iniciar nova conversa"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 touch-scroll">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
                      <Sparkles size={22} className="text-white" />
                    </div>
                    <div className="max-w-xs space-y-1">
                      <h4 className="text-sm font-bold text-[#1D1D1F]">
                        Como posso ajudar na sua auditoria?
                      </h4>
                      <p className="text-[11px] text-[#86868B]">
                        Pergunte sobre limites de gastos, planeje cortes ou clique em &ldquo;Conversar sobre isto&rdquo; em qualquer indicador ao lado.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[88%] sm:max-w-[84%] rounded-[22px] p-3.5 sm:p-4 text-xs leading-relaxed space-y-2 ${
                          msg.role === "user"
                            ? "bg-[#1D1D1F] text-white rounded-br-xs shadow-2xs"
                            : "bg-[#FAFAFC] text-[#1D1D1F] border border-black/[0.06] rounded-bl-xs shadow-2xs"
                        }`}
                      >
                        {/* Card de Simulação de Compra se houver */}
                        {msg.simulationResult && (
                          <div
                            className={`p-3 rounded-xl border text-[11px] font-medium space-y-1 ${
                              msg.simulationResult.verdict === "safe"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : msg.simulationResult.verdict === "warning"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold">
                              <CheckCircle2 size={13} />
                              <span>Veredito do Auditor: {msg.simulationResult.verdict === "safe" ? "Compra Viável" : "Requer Atenção"}</span>
                            </div>
                            <p className="text-[10px] leading-relaxed">{msg.simulationResult.verdictMessage}</p>
                          </div>
                        )}

                        <FormattedMessage content={msg.content} role={msg.role} />

                        <div
                          className={`flex items-center justify-between text-[9px] pt-1 border-t ${
                            msg.role === "user"
                              ? "text-white/60 border-white/10"
                              : "text-[#86868B] border-black/[0.04]"
                          }`}
                        >
                          <span>{msg.role === "assistant" ? "Auditor Wallet" : "Você"}</span>
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isSending && (
                  <div className="flex items-center gap-2 p-3 text-xs text-[#86868B] bg-[#FAFAFC] rounded-2xl w-fit border border-black/[0.04]">
                    <RefreshCw size={13} className="animate-spin text-[#1D1D1F]" />
                    <span>O auditor está calculando o impacto no seu livro-caixa...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* SIMULADOR DE COMPRA INLINE (DROPDOWN RETRÁTIL) */}
              {isInlineSimOpen && (
                <div className="p-3 bg-[#F8F8FA] border-t border-black/[0.06] space-y-2 animate-in slide-in-from-bottom duration-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1D1D1F] flex items-center gap-1.5">
                      <Calculator size={14} className="text-emerald-600" />
                      <span>Simulador Rápido de Compra</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsInlineSimOpen(false)}
                      className="text-[#86868B] hover:text-[#1D1D1F]"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Descrição (ex: Tênis)"
                      value={simDescription}
                      onChange={(e) => setSimDescription(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-black/10 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Valor R$ (ex: 350)"
                      value={simAmount}
                      onChange={(e) => setSimAmount(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-black/10 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-black/5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSimMethod("credit")}
                        className={`px-2.5 py-0.5 rounded-lg font-semibold ${simMethod === "credit" ? "bg-[#1D1D1F] text-white" : "text-[#86868B]"}`}
                      >
                        Crédito
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimMethod("cash")}
                        className={`px-2.5 py-0.5 rounded-lg font-semibold ${simMethod === "cash" ? "bg-[#1D1D1F] text-white" : "text-[#86868B]"}`}
                      >
                        À vista
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={executeSimulation}
                      className="px-4 py-1.5 rounded-xl bg-[#1D1D1F] hover:bg-black text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
                    >
                      Calcular Impacto
                    </button>
                  </div>
                </div>
              )}

              {/* BARRA DE ENTRADA DO CHAT */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 border-t border-black/[0.05] flex items-center gap-2 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setIsInlineSimOpen(!isInlineSimOpen)}
                  title="Simular compra antes de gastar"
                  className={`p-2.5 rounded-full transition-all cursor-pointer border ${
                    isInlineSimOpen
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] border-black/[0.04]"
                  }`}
                >
                  <Calculator size={15} />
                </button>

                <input
                  ref={chatInputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Pergunte ao auditor ou converse sobre seus números..."
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/10 placeholder:text-[#86868B] transition-all"
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isSending}
                  className="w-9 h-9 rounded-full bg-[#1D1D1F] hover:bg-black text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shadow-xs shrink-0 active:scale-95"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
              </section>
            </>
          )}


          {/* =======================================================
              COLUNA DIREITA: O DOSSIÊ DO AUDITOR (ANÁLISES E AÇÕES)
             ======================================================= */}
          <div className="order-1 flex flex-col space-y-4">
            {/* QUATRO AMBIENTES DE TRABALHO */}
            <nav
              aria-label="Ambientes do Wallet+"
              className="grid grid-cols-2 gap-2 rounded-[28px] border border-black/[0.06] bg-white p-2 shadow-[0_8px_28px_rgba(0,0,0,0.025)] lg:grid-cols-4"
            >
              <button
                type="button"
                onClick={() => setActiveDossierTab("mindmap")}
                className={`group min-h-[86px] rounded-[21px] border p-3 text-left transition-all active:scale-[.98] ${
                  activeDossierTab === "mindmap"
                    ? "border-[#1D1D1F] bg-[#1D1D1F] text-white shadow-lg"
                    : "border-transparent bg-[#F5F6F3] text-[#1D1D1F] hover:border-black/10 hover:bg-[#EFF2ED]"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${activeDossierTab === "mindmap" ? "bg-white/10 text-emerald-300" : "bg-white text-emerald-700 shadow-sm"}`}>
                    <Building2 size={15} />
                  </span>
                  <span className={`font-mono text-[9px] ${activeDossierTab === "mindmap" ? "text-white/45" : "text-[#AEAEB2]"}`}>01</span>
                </span>
                <strong className="mt-2 block text-[12px]">Escritório</strong>
                <span className={`mt-0.5 block text-[9px] ${activeDossierTab === "mindmap" ? "text-white/60" : "text-[#86868B]"}`}>Agentes e análises em andamento</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDossierTab("calendar")}
                className={`group min-h-[86px] rounded-[21px] border p-3 text-left transition-all active:scale-[.98] ${
                  activeDossierTab === "calendar"
                    ? "border-[#1D1D1F] bg-[#1D1D1F] text-white shadow-lg"
                    : "border-transparent bg-[#F4F7FC] text-[#1D1D1F] hover:border-black/10 hover:bg-[#EDF3FB]"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${activeDossierTab === "calendar" ? "bg-white/10 text-blue-300" : "bg-white text-blue-700 shadow-sm"}`}>
                    <CalendarDays size={15} />
                  </span>
                  <span className={`font-mono text-[9px] ${activeDossierTab === "calendar" ? "text-white/45" : "text-[#AEAEB2]"}`}>02</span>
                </span>
                <strong className="mt-2 block text-[12px]">Agenda financeira</strong>
                <span className={`mt-0.5 block text-[9px] ${activeDossierTab === "calendar" ? "text-white/60" : "text-[#86868B]"}`}>Entradas, contas e vencimentos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDossierTab("storytelling")}
                className={`group min-h-[86px] rounded-[21px] border p-3 text-left transition-all active:scale-[.98] ${
                  activeDossierTab === "storytelling"
                    ? "border-[#1D1D1F] bg-[#1D1D1F] text-white shadow-lg"
                    : "border-transparent bg-[#FBF5F3] text-[#1D1D1F] hover:border-black/10 hover:bg-[#F9EFEB]"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${activeDossierTab === "storytelling" ? "bg-white/10 text-rose-300" : "bg-white text-rose-700 shadow-sm"}`}>
                    <Flame size={15} />
                  </span>
                  <span className={`font-mono text-[9px] ${activeDossierTab === "storytelling" ? "text-white/45" : "text-[#AEAEB2]"}`}>03</span>
                </span>
                <strong className="mt-2 block text-[12px]">Padrões</strong>
                <span className={`mt-0.5 block text-[9px] ${activeDossierTab === "storytelling" ? "text-white/60" : "text-[#86868B]"}`}>Hábitos, excessos e oportunidades</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDossierTab("overview")}
                className={`group min-h-[86px] rounded-[21px] border p-3 text-left transition-all active:scale-[.98] ${
                  activeDossierTab === "overview"
                    ? "border-[#1D1D1F] bg-[#1D1D1F] text-white shadow-lg"
                    : "border-transparent bg-[#F5F4FA] text-[#1D1D1F] hover:border-black/10 hover:bg-[#F0EEF8]"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${activeDossierTab === "overview" ? "bg-white/10 text-violet-300" : "bg-white text-violet-700 shadow-sm"}`}>
                    <Shield size={15} />
                  </span>
                  <span className={`font-mono text-[9px] ${activeDossierTab === "overview" ? "text-white/45" : "text-[#AEAEB2]"}`}>04</span>
                </span>
                <strong className="mt-2 block text-[12px]">Visão geral</strong>
                <span className={`mt-0.5 block text-[9px] ${activeDossierTab === "overview" ? "text-white/60" : "text-[#86868B]"}`}>Saúde da conta · {currentScore} pontos</span>
              </button>
            </nav>

            {/* ABA 1: ESCRITÓRIO VIVO DOS AGENTES WALLET+ */}
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
                onDiscussWithAI={(prompt, agentId) => {
                  if (agentId) setSelectedPersona(agentId);
                  const agentNames: Record<string, string> = { "wallet-rubi": "Rubi · Caixa", "wallet-sol": "Sol · Hábitos", "wallet-nanquim": "Nanquim · Crédito", "wallet-atlos": "Atlos · Metas" };
                  openCopilotWithContext({ eyebrow: "Escritório Wallet+", title: agentNames[agentId || ""] || "Análise da equipe", detail: "Contexto enviado diretamente pela mesa do agente." }, prompt);
                }}
              />
            )}

            {/* ABA 2: CALENDÁRIO DE GASTOS COM HEATMAP */}
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

            {/* ABA 3: STORYTELLING CONTÁBIL & PADRÕES DIDÁTICOS */}
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

            {/* ABA 4: VISÃO GERAL EM BENTO GRID, COM HIERARQUIA APPLE */}
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
                    pendingBills={diagnosis?.cashflowWindow?.currentMonth.pendingBills ?? monthExpense}
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
                    currentPending={diagnosis?.cashflowWindow?.currentMonth.pendingBills ?? monthExpense}
                    currentFree={diagnosis?.cashflowWindow?.currentMonth.projectedFreeBalance ?? mainBalance}
                    nextMonthName={diagnosis?.cashflowWindow?.nextMonth.monthName || "Próximo mês"}
                    nextIncome={diagnosis?.cashflowWindow?.nextMonth.projectedIncome ?? monthlyIncome}
                    nextExpenses={diagnosis?.cashflowWindow?.nextMonth.committedExpenses ?? totalInvoices}
                    nextFree={diagnosis?.cashflowWindow?.nextMonth.projectedFreeBalance ?? (monthlyIncome - totalInvoices)}
                  />
                </div>

                <section className="col-span-12 flex min-h-[360px] flex-col rounded-[30px] border border-black/[0.05] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] lg:col-span-5">
                  <div className="flex items-start justify-between gap-3 border-b border-black/[0.05] pb-4">
                    <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#F2F2F7] text-[#1D1D1F]"><CalendarClock size={16} /></span><div><h3 className="text-sm font-semibold tracking-tight text-slate-900">Próximos vencimentos</h3><p className="text-[10px] text-[#86868B]">Lembretes e baixas rápidas.</p></div></div>
                    <button type="button" onClick={() => setActiveDossierTab("calendar")} className="rounded-full p-2 text-blue-600 transition-colors hover:bg-blue-50" title="Abrir agenda completa"><CalendarDays size={14} /></button>
                  </div>

                  {upcomingEvents.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-center text-[11px] text-[#86868B]"><CheckCircle2 size={22} className="mb-2 text-emerald-500" /><p>Nenhuma conta pendente nos próximos dias.</p></div>
                  ) : (
                    <div className="mt-2 divide-y divide-black/[0.05]">
                      {upcomingEvents.slice(0, 5).map((event) => (
                        <div key={event.id} className="group flex items-center gap-3 py-3">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${event.isUrgent ? "bg-amber-50 text-amber-700" : "bg-[#F2F2F7] text-indigo-600"}`}>{event.type === "credit_invoice" ? <CreditCard size={14} /> : <Building2 size={14} />}</span>
                          <div className="min-w-0 flex-1"><strong className="block truncate text-[11px] font-medium text-slate-900">{event.title}</strong><span className="text-[9px] text-[#86868B]">{event.daysRemaining === 0 ? "vence hoje" : `em ${event.daysRemaining}d`} · {event.dueDate}</span></div>
                          <div className="text-right"><strong className="block text-[11px] font-semibold tabular-nums text-slate-900">R$ {formatCurrency(event.amount)}</strong>{event.id.startsWith("recurring_") && <button type="button" onClick={() => handlePayUpcomingItem(event.id)} disabled={payingBillId === event.id} className="mt-1 text-[9px] font-semibold text-blue-600 opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40">{payingBillId === event.id ? "Baixando…" : "Baixar"}</button>}</div>
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

      {!isCopilotOpen && (
        <button
          type="button"
          onClick={() => {
            setCopilotContext(null);
            setIsCopilotOpen(true);
          }}
          className="fixed bottom-5 right-5 z-[90] flex items-center gap-2.5 rounded-full border border-white/70 bg-[#1D1D1F]/95 py-2.5 pl-3 pr-4 text-white shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-black active:scale-95 sm:bottom-7 sm:right-7"
          aria-label="Abrir Niko Copilot"
        >
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/10"><Sparkles size={14} /><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-[#1D1D1F] bg-emerald-400" /></span>
          <span className="text-left"><strong className="block text-[10px] font-semibold leading-none">Niko Copilot</strong><span className="mt-1 block text-[8px] text-white/55">Pergunte sobre esta tela</span></span>
        </button>
      )}

      {/* =========================================================
          MODAIS GLOBAIS INTEGRADOS (SEM SAIR DA TELA UNIFICADA)
         ========================================================= */}
      
      {/* 1. Modal do Calendário Financeiro Interativo Completo */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[92dvh] overflow-y-auto rounded-[32px] bg-[#F2F2F7] border border-black/10 shadow-[0_24px_60px_rgba(0,0,0,0.2)] p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-[#1D1D1F]" />
                <h3 className="text-base font-bold text-[#1D1D1F]">
                  Calendário Financeiro Contábil
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalendarModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-[#E5E5EA] text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer border border-black/5"
              >
                <X size={15} />
              </button>
            </div>
            <InteractiveFinancialCalendar />
          </div>
        </div>
      )}

      {/* 2. Drawer de Histórico de Conversas */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[28px] bg-white border border-black/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.2)] p-5 space-y-4 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#1D1D1F]" />
                <h4 className="text-sm font-bold text-[#1D1D1F]">Histórico de Consultas</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="w-7 h-7 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => handleSelectSession(sess.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    sess.id === activeSessionId
                      ? "bg-[#1D1D1F] text-white border-black shadow-xs"
                      : "bg-[#FAFAFC] hover:bg-white text-[#1D1D1F] border-black/[0.05]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <strong className="block text-xs font-semibold truncate">{sess.title}</strong>
                    <span className={`text-[10px] ${sess.id === activeSessionId ? "text-white/70" : "text-[#86868B]"}`}>
                      {formatSessionDate(sess.updatedAt || sess.createdAt)} • {sess.messages?.length || 0} msgs
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(sess.id, e)}
                    className="p-1 text-[#86868B] hover:text-rose-500 transition-colors ml-2"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
