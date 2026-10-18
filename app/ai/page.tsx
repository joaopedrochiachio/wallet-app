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
  Zap,
  Sliders,
  Compass,
  Plus,
  MessageSquare,
  Users,
  CalendarDays,
  X,
  ArrowRight,
  Building2,
  ArrowDownLeft,
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
import { FinancialMindMap } from "@/components/ai/FinancialMindMap";
import { SpendingCalendarHeatmap } from "@/components/ai/SpendingCalendarHeatmap";
import { VisualPatternStorytelling } from "@/components/ai/VisualPatternStorytelling";
import { AgentAvatar } from "@/components/companion/AgentAvatar";
import { WalletCharacter, CharacterId, WALLET_CHARACTERS, normalizeCharacterId } from "@/components/companion/WalletCharacters";
import { InteractiveFinancialCalendar } from "@/components/companion/InteractiveFinancialCalendar";
import { PurchaseSimulatorModal } from "@/components/companion/PurchaseSimulatorModal";
import {
  calculateDailySafeSpend,
  getUpcomingFinancialEvents,
  generateDailyCompanionAdvice,
  calculateWeeklySpendingVelocity,
  getBestCardToSpendToday,
} from "@/lib/services/dailyCompanionService";
import { FinancialDiagnosis, SpecificExpenseAlert } from "@/app/api/ai/analyze/route";
import { PurchaseSimulationResult } from "@/lib/services/financialContextService";
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

  // Modo Mobile: Alternador entre Consultor (Chat) e Dossiê (Análises)
  const [mobilePane, setMobilePane] = useState<"chat" | "dossier">("chat");

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
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [activeDossierTab, setActiveDossierTab] = useState<"mindmap" | "calendar" | "storytelling" | "overview">("mindmap");
  const [payingBillId, setPayingBillId] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

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

  // Conselho e Personalidade do Agente Auditor
  const companionAdvice = useMemo(() => {
    return generateDailyCompanionAdvice({
      userName: userProfile.name,
      projectedFreeBalance: effectiveProjectedFree,
      targetEndMonthBalance,
      safeDailyAllowance: safeSpendMetric.safeDailyAllowance,
      upcomingEventsCount: upcomingEvents.length,
      streakCount: 0,
      persona: selectedPersona,
    });
  }, [
    userProfile.name,
    selectedPersona,
    effectiveProjectedFree,
    targetEndMonthBalance,
    safeSpendMetric.safeDailyAllowance,
    upcomingEvents.length,
  ]);

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

      const idToken = user ? await user.getIdToken() : "";
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
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
        const errorMsg =
          data?.error ||
          (res.status === 408 || res.status === 504
            ? "Tempo limite esgotado no servidor. Tente novamente."
            : res.status === 500
              ? "Erro no servidor (500). Verifique as variáveis de ambiente."
              : `Erro ao gerar diagnóstico (${res.status}).`);
        throw new Error(errorMsg);
      }

      if (data && data.success && data.diagnosis) {
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
        throw new Error(data?.error || "Não foi possível carregar a análise no momento.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao conectar com o assistente.";
      setAnalysisError(msg);
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

        setDiagnosis((prev) => {
          if (!prev) return prev;
          const existing = prev.specificExpensesAlerts || [];
          const existingNames = new Set(existing.map((e) => e.item.toLowerCase().trim()));
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

    // Se estiver no mobile e no dossiê, transfere suavemente para o chat
    setMobilePane("chat");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
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

      const idToken = user ? await user.getIdToken() : "";
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
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
        throw new Error(data?.error || `Erro de comunicação com o auditor (${res.status}).`);
      }

      if (data && data.success && data.message) {
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
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
        throw new Error(data?.error || "O auditor não conseguiu processar a resposta.");
      }
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Dificuldade temporária na auditoria: ${
          err instanceof Error ? err.message : "Tente novamente em instantes"
        }.`,
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      const finalMessages = [...newMessages, errorMsg];
      setMessages(finalMessages);
    } finally {
      setIsSending(false);
    }
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
  const visibleSpecificAlerts = (diagnosis?.specificExpensesAlerts || []).filter((item) => {
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
  visibleSpecificAlerts.forEach((item) => {
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

  const filteredPatterns = visibleSpecificAlerts.filter((item) => {
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

  const personasList: { id: CharacterId; name: string; role: string; shortRole: string }[] = [
    { id: "wallet-rubi", name: "Rubi", role: "CFO & Fluxo de Caixa", shortRole: "CFO & Caixa" },
    { id: "wallet-sol", name: "Sol", role: "Reserva & Proteção", shortRole: "Reserva & Fôlego" },
    { id: "wallet-nanquim", name: "Nanquim", role: "Crédito & Faturas", shortRole: "Crédito & Fatura" },
    { id: "wallet-atlos", name: "Atlos", role: "Metas & Multiplicação", shortRole: "Metas & Aportes" },
  ];

  return (
    <div className="min-h-full w-full bg-[#F2F2F7] text-[#1D1D1F] font-sans selection:bg-[#1D1D1F] selection:text-white pb-12">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        
        {/* =========================================================
            1. HEADER EXECUTIVO WALLET+ COM APPLE WHITE IDENTITY
           ========================================================= */}
        <header className="rounded-[28px] bg-white border border-black/[0.05] p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
              <Compass size={20} className="text-white" />
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
                  <span>Auditoria Executiva em Tempo Real</span>
                </div>
              </div>
              <p className="text-xs text-[#86868B] truncate mt-0.5">
                Consultoria contábil inteligente e diagnóstico de fluxo de caixa em tela unificada.
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
              <span className="hidden sm:inline">{isAnalyzing ? "Auditando..." : "Auditar Agora"}</span>
            </button>
          </div>
        </header>

        {/* =========================================================
            2. SEGMENT CONTROLLER MOBILE (< lg)
            Permite alternar entre o Chat e o Dossiê sem perder estado
           ========================================================= */}
        <div className="lg:hidden flex items-center p-1 bg-[#E5E5EA]/80 backdrop-blur-md rounded-2xl border border-black/5">
          <button
            type="button"
            onClick={() => setMobilePane("chat")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mobilePane === "chat"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <MessageSquare size={13} />
            <span>Consultor & Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("dossier")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mobilePane === "dossier"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <Compass size={13} />
            <span>Dossiê do Auditor ({diagnosis?.healthScore || 82} pts)</span>
          </button>
        </div>

        {/* =========================================================
            3. WORKSPACE INTEGRADO EM TELA ÚNICA (2 COLUNAS NO DESKTOP)
           ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* =======================================================
              COLUNA ESQUERDA: O CONSULTOR / COPILOT CONVERSACIONAL
             ======================================================= */}
          <div
            className={`lg:col-span-5 flex flex-col space-y-4 ${
              mobilePane === "chat" ? "block" : "hidden lg:flex"
            }`}
          >
            {/* 1. SELETOR DE ARQUÉTIPO / AUDITOR ESPECIALISTA */}
            <div className="bg-white rounded-[24px] p-3 border border-black/[0.05] shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                  Especialista em Atendimento
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Pronto para análise
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {personasList.map((p) => {
                  const isSelected =
                    selectedPersona === p.id ||
                    selectedPersona.includes(p.id.replace("wallet-", "")) ||
                    (p.id === "wallet-rubi" && selectedPersona === "optimizer") ||
                    (p.id === "wallet-sol" && selectedPersona === "guardian") ||
                    (p.id === "wallet-nanquim" && selectedPersona === "builder") ||
                    (p.id === "wallet-atlos" && selectedPersona === "scaler");
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPersona(p.id)}
                      className={`p-1.5 sm:p-2 rounded-2xl text-center transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 sm:gap-1 active:scale-95 ${
                        isSelected
                          ? "bg-[#1D1D1F] text-white border-black shadow-md ring-1 ring-black/20"
                          : "bg-[#F8F8FA] hover:bg-[#F2F2F7] text-[#1D1D1F] border-black/[0.04]"
                      }`}
                    >
                      <div className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center">
                        <WalletCharacter
                          id={p.id}
                          size="sm"
                          state={isSelected ? "falando" : "ocioso"}
                          showBadge={false}
                          className="pointer-events-none scale-85 sm:scale-90"
                        />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold tracking-tight leading-tight">
                        {p.name}
                      </span>
                      <span
                        className={`text-[8.5px] sm:text-[9px] truncate max-w-full font-medium ${
                          isSelected ? "text-white/70" : "text-[#86868B]"
                        }`}
                      >
                        {p.shortRole}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. CARD DO AUDITOR ATIVO & PARECER DE HOJE */}
            {(() => {
              const activeCharId = normalizeCharacterId(selectedPersona);
              const activeCharMeta = WALLET_CHARACTERS[activeCharId] || WALLET_CHARACTERS["wallet-rubi"];
              return (
                <div className="bg-white rounded-[24px] p-4 border border-black/[0.05] shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-2.5">
                  <div className="flex items-start gap-3">
                    <AgentAvatar
                      persona={selectedPersona}
                      state={companionAdvice.avatarState}
                      size="md"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-[#1D1D1F] truncate">
                            {activeCharMeta.name}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#1D1D1F] text-white">
                            {activeCharMeta.badgeText}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                          Teto R$ {formatCurrency(safeSpendMetric.safeDailyAllowance)}/d
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[#86868B] font-medium leading-tight">
                        {activeCharMeta.role}
                      </p>
                    </div>
                  </div>

                  {/* Parecer do Auditor Especialista */}
                  <div className="bg-[#F8F8FA] rounded-2xl p-3 border border-black/[0.04] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                        Parecer de Hoje
                      </span>
                      <span className="text-[9.5px] font-mono text-blue-600 font-medium truncate max-w-[190px]">
                        {activeCharMeta.quantFoundation}
                      </span>
                    </div>
                    <p className="text-xs text-[#1D1D1F] font-semibold leading-snug">
                      {companionAdvice.headline}
                    </p>
                    <p className="text-[11px] text-[#86868B] leading-relaxed">
                      {companionAdvice.advice}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* 3. CARROSSEL DE PROMPTS RÁPIDOS DE AUDITORIA */}
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

            {/* 4. FEED DE CONVERSA ESTILO APPLE MESSAGES */}
            <div className="bg-white rounded-[28px] border border-black/[0.05] shadow-[0_8px_30px_rgba(0,0,0,0.03)] h-[560px] flex flex-col justify-between overflow-hidden">
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
                        Pergunte sobre limites de gastos, planeje cortes ou clique em "Conversar sobre isto" em qualquer indicador ao lado.
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
          </div>


          {/* =======================================================
              COLUNA DIREITA: O DOSSIÊ DO AUDITOR (ANÁLISES E AÇÕES)
             ======================================================= */}
          <div
            className={`lg:col-span-7 flex flex-col space-y-4 ${
              mobilePane === "dossier" ? "block" : "hidden lg:flex"
            }`}
          >
            {/* =======================================================
                BARRA SELETORA DE MODOS DE ANÁLISE INTERATIVA (NOVO)
               ======================================================= */}
            <div className="grid grid-cols-2 sm:grid-cols-4 p-1 sm:p-1.5 bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-[22px] border border-black/[0.06] shadow-xs gap-1">
              <button
                type="button"
                onClick={() => setActiveDossierTab("mindmap")}
                className={`w-full py-2 px-1.5 sm:px-2 rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  activeDossierTab === "mindmap"
                    ? "bg-[#1D1D1F] text-white shadow-xs font-bold"
                    : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7]"
                }`}
              >
                <Compass size={14} className={activeDossierTab === "mindmap" ? "text-cyan-400" : ""} />
                <span className="truncate">Mapa Mental</span>
                <span className={`hidden md:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeDossierTab === "mindmap" ? "bg-cyan-500/30 text-cyan-200" : "bg-black/5 text-[#86868B]"
                }`}>
                  Grafo
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDossierTab("calendar")}
                className={`w-full py-2 px-1.5 sm:px-2 rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  activeDossierTab === "calendar"
                    ? "bg-[#1D1D1F] text-white shadow-xs font-bold"
                    : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7]"
                }`}
              >
                <CalendarDays size={14} className={activeDossierTab === "calendar" ? "text-blue-400" : ""} />
                <span className="truncate">Calendário</span>
                <span className={`hidden md:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeDossierTab === "calendar" ? "bg-blue-500/30 text-blue-200" : "bg-black/5 text-[#86868B]"
                }`}>
                  Fluxo
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDossierTab("storytelling")}
                className={`w-full py-2 px-1.5 sm:px-2 rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  activeDossierTab === "storytelling"
                    ? "bg-[#1D1D1F] text-white shadow-xs font-bold"
                    : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7]"
                }`}
              >
                <Flame size={14} className={activeDossierTab === "storytelling" ? "text-rose-400" : ""} />
                <span className="truncate">Padrões</span>
                <span className={`hidden md:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeDossierTab === "storytelling" ? "bg-rose-500/30 text-rose-200" : "bg-black/5 text-[#86868B]"
                }`}>
                  IA
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDossierTab("overview")}
                className={`w-full py-2 px-1.5 sm:px-2 rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                  activeDossierTab === "overview"
                    ? "bg-[#1D1D1F] text-white shadow-xs font-bold"
                    : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7]"
                }`}
              >
                <Sparkles size={14} className={activeDossierTab === "overview" ? "text-amber-400" : ""} />
                <span className="truncate">Visão Geral</span>
                <span className={`hidden md:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeDossierTab === "overview" ? "bg-amber-500/30 text-amber-200" : "bg-black/5 text-[#86868B]"
                }`}>
                  {currentScore} pts
                </span>
              </button>
            </div>

            {/* ABA 1: MAPA MENTAL NEURAL INTERATIVO */}
            {activeDossierTab === "mindmap" && (
              <FinancialMindMap
                diagnosis={diagnosis}
                cards={cards}
                transactions={transactions}
                recurringItems={recurringItems}
                mainBalance={mainBalance}
                monthIncome={monthIncome}
                monthExpense={monthExpense}
                targetEndMonthBalance={targetEndMonthBalance}
                effectiveProjectedFree={effectiveProjectedFree}
                safeDailyAllowance={safeSpendMetric.safeDailyAllowance}
                remainingDays={safeSpendMetric.remainingDaysInMonth}
                activePersona={selectedPersona}
                onDiscussWithAI={(topic) => handleSendMessage(topic)}
                onOpenSimulator={(params) => {
                  if (params?.description) setSimDescription(params.description);
                  if (params?.amount) setSimAmount(String(params.amount));
                  setIsInlineSimOpen(true);
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
                onDiscussWithAI={(topic) => handleSendMessage(topic)}
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
                onDiscussWithAI={(prompt) => handleSendMessage(prompt)}
                onOpenSimulator={(params) => {
                  if (params?.description) setSimDescription(params.description);
                  if (params?.amount) setSimAmount(String(params.amount));
                  setIsInlineSimOpen(true);
                }}
                onDismissPattern={handleDismissPattern}
                onRefreshPatterns={handleFetchMorePatterns}
                isSearchingPatterns={isSearchingPatterns}
              />
            )}

            {/* ABA 4: VISÃO GERAL EXECUTIVA TRADICIONAL */}
            {activeDossierTab === "overview" && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* 1. ANEL DE SAÚDE CONTÁBIL & 3 KPIS AUDITADOS */}
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
                  onOpenSimulator={() => setIsInlineSimOpen(true)}
                  onDiscussWithAI={(topic) => {
                    handleSendMessage(topic);
                  }}
                />

                {/* 2. PRÓXIMOS VENCIMENTOS COM BAIXA DIRETA EM 1 CLIQUE */}
                <section className="bg-white rounded-[28px] p-5 border border-black/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarClock size={16} className="text-[#1D1D1F]" />
                      <div>
                        <h3 className="text-sm font-bold text-[#1D1D1F]">
                          Próximos Vencimentos de Hoje em Diante
                        </h3>
                        <p className="text-[11px] text-[#86868B]">
                          Avisos de contas futuras. Baixe com 1 toque sem sair da tela.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveDossierTab("calendar")}
                      className="px-3 py-1.5 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs border border-black/5"
                    >
                      <CalendarDays size={13} className="text-blue-600" />
                      <span>Ver Calendário Completo</span>
                    </button>
                  </div>

                  {upcomingEvents.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#FAFAFC] text-center text-xs text-[#86868B] space-y-1">
                      <CheckCircle2 size={20} className="mx-auto text-emerald-500" />
                      <p>Nenhuma conta pendente para os próximos 7 dias. Tudo em dia!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {upcomingEvents.slice(0, 4).map((event) => (
                        <div
                          key={event.id}
                          className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                            event.isUrgent
                              ? "bg-amber-50/60 border-amber-200/70 text-amber-900"
                              : "bg-[#FAFAFC] border-black/[0.04] text-[#1D1D1F]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {event.type === "credit_invoice" ? (
                              <CreditCard size={15} className="shrink-0 text-indigo-600" />
                            ) : (
                              <Building2 size={15} className="shrink-0 text-[#86868B]" />
                            )}
                            <div className="min-w-0">
                              <strong className="block font-semibold truncate text-[#1D1D1F]">
                                {event.title}
                              </strong>
                              <span className="text-[10px] text-[#86868B]">
                                {event.dueDate} ({event.daysRemaining === 0 ? "Vence hoje" : `em ${event.daysRemaining}d`})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <strong className="font-mono text-xs font-bold text-[#1D1D1F]">
                              R$ {formatCurrency(event.amount)}
                            </strong>

                            {event.id.startsWith("recurring_") && (
                              <button
                                type="button"
                                onClick={() => handlePayUpcomingItem(event.id)}
                                disabled={payingBillId === event.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                              >
                                <CheckCircle2 size={11} />
                                <span>{payingBillId === event.id ? "Baixando..." : "Baixar"}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 3. FLUXO DE CAIXA & ESPECTRO DE GASTOS */}
                <CashflowBarChart
                  currentMonthName={diagnosis?.cashflowWindow?.currentMonth.monthName || "Mês Atual"}
                  currentBalance={diagnosis?.cashflowWindow?.currentMonth.checkingBalance ?? mainBalance}
                  currentPending={diagnosis?.cashflowWindow?.currentMonth.pendingBills ?? monthExpense}
                  currentFree={diagnosis?.cashflowWindow?.currentMonth.projectedFreeBalance ?? mainBalance}
                  nextMonthName={diagnosis?.cashflowWindow?.nextMonth.monthName || "Próximo Mês"}
                  nextIncome={diagnosis?.cashflowWindow?.nextMonth.projectedIncome ?? monthlyIncome}
                  nextExpenses={diagnosis?.cashflowWindow?.nextMonth.committedExpenses ?? totalInvoices}
                  nextFree={diagnosis?.cashflowWindow?.nextMonth.projectedFreeBalance ?? (monthlyIncome - totalInvoices)}
                />

                {spectrumCategories.length > 0 && (
                  <CategorySpectrumBar
                    categories={spectrumCategories}
                    selectedCategory={selectedCategoryFilter}
                    onSelectCategory={setSelectedCategoryFilter}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
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
