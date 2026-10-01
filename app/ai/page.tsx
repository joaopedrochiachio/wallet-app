"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { FormattedMessage } from "@/components/ai/FormattedMessage";
import { CashflowBarChart } from "@/components/ai/CashflowBarChart";
import { CategorySpectrumBar, CategoryDistribution } from "@/components/ai/CategorySpectrumBar";
import { InstallmentTimelineChart } from "@/components/ai/InstallmentTimelineChart";
import { InteractivePatternCard } from "@/components/ai/InteractivePatternCard";
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
  } = useWallet();

  const [activeTab, setActiveTab] = useState<"diagnosis" | "chat">("diagnosis");

  // Estados do Diagnóstico (Inicializados de forma síncrona do cache local para nunca sumir no F5)
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
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLElement>(null);

  // Sessão atual ativa
  const currentSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || null;

  // Estados do Simulador de Compra (Apple Interactive Sheet)
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simAmount, setSimAmount] = useState<string>("1200");
  const [simMethod, setSimMethod] = useState<"cash" | "credit">("credit");
  const [simInstallments, setSimInstallments] = useState<number>(6);
  const [simCardId, setSimCardId] = useState<string>("");
  const [simDescription, setSimDescription] = useState<string>("Novo Smartphone");

  // Cartões de crédito para o simulador
  const creditCards = cards.filter((c) => c.type === "credit");

  const activeSimCardId = simCardId || (creditCards[0]?.id ?? "");

  // Carrega diagnóstico persistido e histórico de sessões do chat (Firestore / localStorage)
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
          const initial = createChatSession("Nova Conversa");
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
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const runDiagnosis = async () => {
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
          userProfile,
          cards,
          transactions,
          recurringItems,
          goals,
          mainBalance,
          monthIncome,
          monthExpense,
          monthlyProjections,
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
        const errorMsg =
          data?.error ||
          (res.status === 408 || res.status === 504
            ? "Tempo limite esgotado no servidor da Vercel. Tente novamente."
            : res.status === 500
            ? "Erro no servidor (500). Verifique as variáveis de ambiente na Vercel."
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
          { timestamp, modelUsed: data.modelUsed },
          user?.uid
        );
      } else {
        throw new Error(data?.error || "Não foi possível carregar a análise no momento.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao conectar com o assistente.";
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
          const existingNames = new Set(
            existing.map((e) => e.item.toLowerCase().trim())
          );
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
      } else {
        throw new Error(data.error || "Falha ao buscar novos padrões.");
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

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    // Identifica ou cria sessão ativa
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
          userProfile,
          cards,
          transactions,
          recurringItems,
          goals,
          mainBalance,
          monthIncome,
          monthExpense,
          monthlyProjections,
        }),
      });

      // Leitura resiliente da resposta (previne crash de 'Unexpected end of JSON input' da Vercel)
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
            ? "Tempo limite de resposta esgotado (Timeout da Vercel). Tente novamente com uma consulta mais direta."
            : res.status === 500
            ? "Erro no servidor (500). Verifique se as variáveis FIREBASE_SERVICE_ACCOUNT_KEY e OPENAI_API_KEY estão cadastradas na Vercel."
            : res.status === 401
            ? "Sessão expirada. Faça login novamente no aplicativo."
            : `Erro de comunicação com o servidor (${res.status}).`);
        throw new Error(errorMsg);
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
        throw new Error(data.error || "O assistente não conseguiu responder agora.");
      }
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Desculpe, tive uma dificuldade de conexão temporária: ${
          err instanceof Error ? err.message : "Tente novamente em instantes"
        }.`,
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      const finalMessages = [...newMessages, errorMsg];
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

  const handleNewChat = () => {
    const newSess = createChatSession("Nova Conversa");
    const updated = [newSess, ...sessions];
    setSessions(updated);
    setActiveSessionId(newSess.id);
    setMessages([]);
    void saveChatSessions(updated, user?.uid);
    chatSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSelectSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;
    setActiveSessionId(sessionId);
    setMessages(target.messages || []);
    chatSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const confirmed = window.confirm("Deseja realmente excluir esta conversa do histórico?");
    if (!confirmed) return;

    const remaining = sessions.filter((s) => s.id !== sessionId);
    if (remaining.length === 0) {
      const fresh = createChatSession("Nova Conversa");
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

  const handleClearCurrentSession = async () => {
    if (messages.length === 0) return;
    const confirmClear = window.confirm(
      "Deseja realmente limpar as mensagens desta conversa?"
    );
    if (confirmClear) {
      setMessages([]);
      const updated = sessions.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [], updatedAt: new Date().toISOString() }
          : s
      );
      setSessions(updated);
      await saveChatSessions(updated, user?.uid);
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
        ? `Se eu comprar "${simDescription}" no valor de R$ ${amountVal.toFixed(
            2
          )} parcelado em ${simInstallments}x no ${cardName}, como isso impacta meu fluxo de caixa e metas?`
        : `Se eu fizer uma compra à vista de "${simDescription}" no valor de R$ ${amountVal.toFixed(
            2
          )}, como isso afeta meu saldo disponível e contas fixas?`;

    setActiveTab("chat");
    setIsSimulatorOpen(false);
    handleSendMessage(promptText, simPayload);
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatLastAnalyzed = (isoStr: string | null) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return null;
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      if (isToday) {
        return `Hoje às ${timeStr}`;
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();
      if (isYesterday) {
        return `Ontem às ${timeStr}`;
      }
      const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return `${dateStr} às ${timeStr}`;
    } catch {
      return null;
    }
  };

  const getPersonaLabel = () => {
    switch (userProfile?.persona) {
      case "optimizer":
        return "Optimizer • Maximizador";
      case "guardian":
        return "Guardian • Protetor";
      case "scaler":
        return "Scaler • Crescimento";
      case "minimalist":
        return "Minimalist • Essencial";
      default:
        return "Perfil Pessoal";
    }
  };

  const getHealthBadge = (status?: string, score = 75) => {
    if (status === "excellent" || score >= 80) {
      return {
        label: "Excelente",
        color: "text-emerald-700",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        ringColor: "#10B981",
        gradient: "from-emerald-500 to-teal-400",
      };
    }
    if (status === "healthy" || score >= 65) {
      return {
        label: "Saudável",
        color: "text-blue-700",
        bg: "bg-blue-500/10 border-blue-500/20",
        ringColor: "#007AFF",
        gradient: "from-blue-500 to-indigo-400",
      };
    }
    if (status === "attention" || score >= 45) {
      return {
        label: "Requer Atenção",
        color: "text-amber-700",
        bg: "bg-amber-500/10 border-amber-500/20",
        ringColor: "#F59E0B",
        gradient: "from-amber-500 to-orange-400",
      };
    }
    return {
      label: "Alerta de Risco",
      color: "text-rose-700",
      bg: "bg-rose-500/10 border-rose-500/20",
      ringColor: "#F43F5E",
      gradient: "from-rose-500 to-pink-500",
    };
  };

  const currentScore = diagnosis?.healthScore ?? 75;
  const healthBadge = getHealthBadge(diagnosis?.healthStatus, currentScore);

  const totalInvoices = creditCards.reduce((acc, c) => acc + (c.spent || c.invoiceAmount || 0), 0);
  const monthlyIncome = userProfile?.monthlyIncomeBase || (monthIncome > 0 ? monthIncome : 5000);
  const commitmentRatio =
    monthlyIncome > 0 ? Math.round(((monthExpense + totalInvoices) / monthlyIncome) * 100) : 0;

  const quickPrompts = [
    "Quanto eu tenho ainda para gastar este mês?",
    "Quanto terei livre para gastar mês que vem?",
    "Estou gastando muito com iFood ou delivery?",
    "Como minhas parcelas estão divididas mês a mês?",
    "Posso comprar um notebook de R$ 4.500 em 10x?",
  ];

  const parsedSimAmount = parseFloat(simAmount.replace(/\./g, "").replace(",", ".")) || 0;
  const installmentValue = simInstallments > 0 ? parsedSimAmount / simInstallments : 0;

  const visibleSpecificAlerts = (diagnosis?.specificExpensesAlerts || []).filter((item) => {
    const itemName = (item.item || "").toLowerCase().trim();
    const habitCat = (item.habitCategory || "").toLowerCase().trim();
    return !dismissedPatterns.some((d) => {
      const norm = d.toLowerCase().trim();
      if (!norm) return false;
      return (
        itemName === norm ||
        itemName.includes(norm) ||
        norm.includes(itemName) ||
        (habitCat && (habitCat === norm || habitCat.includes(norm) || norm.includes(habitCat)))
      );
    });
  });

  // Meta primária para relacionar às economias calculadas
  const primaryGoal = goals.find((g) => g.current < g.target) || goals[0] || null;
  const targetGoalName = primaryGoal?.title || userProfile?.primaryFocus || "Reserva Financeira";

  // Agrupamento por Categoria para a barra de espectro estilo Apple Card
  const categoryColors: Record<string, string> = {
    "Alimentação & Delivery": "#FF9500", // Apple Orange
    "Transporte & Mobilidade": "#007AFF", // Apple Blue
    "Assinaturas & Streaming": "#AF52DE", // Apple Purple
    "Fixas & Moradia": "#5856D6", // Apple Indigo
    "Compras & Lazer": "#FF2D55", // Apple Pink
    "Saúde & Bem-estar": "#30B0C7", // Apple Teal
    "Outros": "#8E8E93", // Apple Gray
  };

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
    .map(([category, total]) => ({
      category,
      total,
      color: categoryColors[category] || "#8E8E93",
    }));

  // Filtro por Cluster de Padrões e Categoria do Apple Card
  const filteredPatterns = visibleSpecificAlerts.filter((item) => {
    if (selectedCategoryFilter && (item.habitCategory || "Outros") !== selectedCategoryFilter) {
      return false;
    }
    if (selectedCluster === "alerts") {
      return item.alertType === "alert";
    }
    if (selectedCluster === "recurring") {
      const cat = (item.habitCategory || "").toLowerCase();
      const name = item.item.toLowerCase();
      return (
        cat.includes("assinatura") ||
        cat.includes("streaming") ||
        name.includes("spotify") ||
        name.includes("netflix") ||
        name.includes("amazon") ||
        name.includes("mensalidade")
      );
    }
    if (selectedCluster === "habits") {
      return item.alertType !== "alert";
    }
    return true;
  });

  const alertsCount = visibleSpecificAlerts.filter((i) => i.alertType === "alert").length;
  const recurringCount = visibleSpecificAlerts.filter((i) => {
    const cat = (i.habitCategory || "").toLowerCase();
    const name = i.item.toLowerCase();
    return (
      cat.includes("assinatura") ||
      cat.includes("streaming") ||
      name.includes("spotify") ||
      name.includes("netflix") ||
      name.includes("amazon") ||
      name.includes("mensalidade")
    );
  }).length;
  const habitsCount = visibleSpecificAlerts.filter((i) => i.alertType !== "alert").length;

  return (
    <div className="min-h-full w-full max-w-full overflow-x-hidden bg-[#F2F2F7] text-[#1D1D1F] font-sans selection:bg-[#1D1D1F] selection:text-white">
      {/* Container Central com Padding Dinâmico Apple */}
      <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-5 sm:py-8 space-y-6 min-w-0">
        {/* =========================================================
            1. HEADER DIAGNÓSTICO FINANCEIRO
           ========================================================= */}
        <header className="rounded-[28px] bg-white/90 backdrop-blur-xl border border-black/[0.05] p-4.5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              {/* Badge de Metadados Apple Style */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#86868B]">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F2F2F7] border border-black/[0.05] text-[#1D1D1F] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Diagnóstico em Tempo Real</span>
                </div>
                <span>•</span>
                <span>{getPersonaLabel()}</span>
                {lastAnalyzedAt && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-[#86868B]" />
                      <span>{formatLastAnalyzed(lastAnalyzedAt)}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Título com Ícone Apple Minimalista */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Compass size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1D1D1F] truncate">
                      Diagnóstico Financeiro
                    </h1>
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#1D1D1F] border border-white/10 text-white shadow-2xs">
                      <span className="text-[11px] font-semibold tracking-tight">Wallet</span>
                      <span className="text-[12px] font-bold text-white tracking-tighter drop-shadow-[0_0_8px_rgba(255,255,255,0.85)] ml-0.5 leading-none">+</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#86868B] truncate">
                    Auditoria contábil de fluxo de caixa, cartões e inteligência estratégica
                  </p>
                </div>
              </div>
            </div>

            {/* Segmented Control & Botão Recalcular */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto pt-2 sm:pt-0">
              <div className="flex items-center p-1 bg-[#E5E5EA]/75 backdrop-blur-md rounded-full border border-black/5">
                <button
                  type="button"
                  onClick={() => setActiveTab("diagnosis")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "diagnosis"
                      ? "bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Visão Geral
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("chat")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "chat"
                      ? "bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Conversar & Simular
                </button>
              </div>

              <button
                type="button"
                onClick={runDiagnosis}
                disabled={isAnalyzing}
                title={diagnosis ? "Recalcular análise com dados recentes" : "Gerar diagnóstico sob demanda"}
                className="px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white active:scale-95 border border-black/[0.06] text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <RefreshCw size={13} className={isAnalyzing ? "animate-spin text-[#86868B]" : ""} />
                <span className="hidden sm:inline">{diagnosis ? "Atualizar" : "Gerar"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* =========================================================
            2. CONTEÚDO PRINCIPAL (TABS)
           ========================================================= */}
        {activeTab === "diagnosis" ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Mensagem de Erro se houver */}
            {analysisError && (
              <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                  <span>{analysisError}</span>
                </div>
                <button
                  type="button"
                  onClick={runDiagnosis}
                  className="px-3 py-1 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-all cursor-pointer shrink-0"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Banner delicado ao recalcular mantendo o dashboard visível */}
            {isAnalyzing && diagnosis && (
              <div className="p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-black/[0.08] shadow-xs flex items-center justify-between gap-3 text-xs text-[#1D1D1F] animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-[#1D1D1F] shrink-0" />
                  <span className="font-medium text-[#1D1D1F]">
                    O Analista está recalculando seu diagnóstico com as informações mais recentes...
                  </span>
                </div>
              </div>
            )}

            {/* ESTADO 1: ANALISANDO DO ZERO (SKELETON ELEGANTE COM EFEITO SHIMMER) */}
            {isAnalyzing && !diagnosis ? (
              <section className="bg-white rounded-[28px] p-8 sm:p-12 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto">
                  <RefreshCw size={24} className="text-[#1D1D1F] animate-spin" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-base sm:text-lg font-semibold tracking-tight text-[#1D1D1F]">
                    Sintetizando Livro-Caixa e Projeções...
                  </h3>
                  <p className="text-xs text-[#86868B] leading-relaxed">
                    Cruzando extratos de conta, faturas vigentes, parcelas diluídas e compromissos futuros com precisão contábil.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2F2F7] text-[11px] font-medium text-[#86868B]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Auditoria Contábil de Caixa & Cartões</span>
                </div>
              </section>
            ) : !diagnosis ? (
              /* ESTADO 2: SEM ANÁLISE SALVA (HERO SOB DEMANDA) */
              <section className="relative bg-white rounded-[28px] p-7 sm:p-10 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-6 text-center overflow-hidden">
                <div className="w-14 h-14 rounded-[22px] bg-[#1D1D1F] text-white mx-auto flex items-center justify-center shadow-xs">
                  <Compass size={24} className="text-white" />
                </div>

                <div className="space-y-2 max-w-lg mx-auto">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                    Diagnóstico Financeiro Sob Demanda
                  </h2>
                  <p className="text-xs sm:text-sm text-[#86868B] leading-relaxed">
                    O diagnóstico é gerado sob sua solicitação para manter privacidade total e processamento local. Uma vez calculado, ele fica salvo no seu dispositivo e na nuvem.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={runDiagnosis}
                    className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs sm:text-sm font-semibold px-6 py-3 rounded-full transition-all inline-flex items-center gap-2.5 shadow-md cursor-pointer"
                  >
                    <Compass size={16} className="text-white" />
                    <span>Gerar Diagnóstico Estratégico</span>
                  </button>
                </div>

                {/* Métricas Rápidas Apple Health Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-black/[0.04] text-left">
                  <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                    <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                      Comprometimento Atual
                    </span>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <strong className="text-lg font-semibold text-[#1D1D1F] font-mono tabular-nums">
                        {commitmentRatio}%
                      </strong>
                      <span className="text-[10px] text-[#86868B]">
                        (teto {userProfile?.maxCommitmentAlertPercent || 60}%)
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                    <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                      Saldo em Conta
                    </span>
                    <strong className="mt-1 block text-lg font-semibold text-emerald-600 truncate font-mono tabular-nums">
                      R$ {formatCurrency(mainBalance)}
                    </strong>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                    <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                      Faturas em Aberto
                    </span>
                    <strong className="mt-1 block text-lg font-semibold text-[#1D1D1F] truncate font-mono tabular-nums">
                      R$ {formatCurrency(totalInvoices)}
                    </strong>
                  </div>
                </div>
              </section>
            ) : (
              /* ESTADO 3: DIAGNÓSTICO COMPLETO (APPLE HEALTH + APPLE CARD) */
              <>
                {/* 1. HERO HEALTH RING CARD */}
                <section className="bg-white rounded-[28px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      {/* Anel de Atividade Apple Health */}
                      <div className="relative w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
                          <circle
                            cx="36"
                            cy="36"
                            r="30"
                            className="stroke-black/[0.05]"
                            strokeWidth="6"
                            fill="none"
                          />
                          <circle
                            cx="36"
                            cy="36"
                            r="30"
                            stroke={healthBadge.ringColor}
                            strokeWidth="6"
                            strokeDasharray="188.5"
                            strokeDashoffset={188.5 - (188.5 * currentScore) / 100}
                            strokeLinecap="round"
                            fill="none"
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center text-center">
                          <span className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
                            {currentScore}
                          </span>
                          <span className="text-[9px] font-semibold text-[#86868B] uppercase tracking-wider">
                            Pontos
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-semibold text-[#1D1D1F] tracking-tight">
                            Saúde Financeira
                          </h2>
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${healthBadge.bg} ${healthBadge.color}`}
                          >
                            {healthBadge.label}
                          </span>
                        </div>
                        <p className="text-xs text-[#86868B] leading-relaxed max-w-sm">
                          Balanço ponderado entre saldo líquido, liquidez projetada e comprometimento de faturas.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("chat");
                        setIsSimulatorOpen(true);
                      }}
                      className="self-start sm:self-auto bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-4 py-2.5 rounded-full transition-all flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
                    >
                      <Calculator size={14} />
                      <span>Simulador de Compra</span>
                    </button>
                  </div>

                  {/* Grid de 3 Métricas Apple Health Style */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-black/[0.04]">
                    <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                      <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                        Comprometimento
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <strong
                          className={`text-base font-semibold font-mono tabular-nums ${
                            commitmentRatio > (userProfile?.maxCommitmentAlertPercent || 60)
                              ? "text-rose-600"
                              : "text-[#1D1D1F]"
                          }`}
                        >
                          {commitmentRatio}%
                        </strong>
                        <span className="text-[11px] text-[#86868B]">
                          (teto {userProfile?.maxCommitmentAlertPercent || 60}%)
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                      <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                        Saldo em Conta
                      </span>
                      <strong className="mt-1 block text-base font-semibold text-emerald-600 truncate font-mono tabular-nums">
                        R$ {formatCurrency(mainBalance)}
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                      <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                        Faturas em Aberto
                      </span>
                      <strong className="mt-1 block text-base font-semibold text-[#1D1D1F] truncate font-mono tabular-nums">
                        R$ {formatCurrency(totalInvoices)}
                      </strong>
                    </div>
                  </div>

                  {/* Parecer Executivo do Mês */}
                  <div className="p-5 rounded-2xl bg-[#F9F9FB] border border-black/[0.05] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F]">
                      <div className="w-5 h-5 rounded-md bg-[#1D1D1F] text-white flex items-center justify-center shadow-2xs">
                        <TrendingUp size={11} />
                      </div>
                      <span>Parecer do Mês</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#1D1D1F] leading-relaxed font-normal">
                      {cleanExecutiveSummary(diagnosis?.executiveSummary) ||
                        "Fluxo de caixa sob acompanhamento regular. Mantenha os vencimentos futuros sob observação para preservar sua liquidez."}
                    </p>
                  </div>
                </section>

                {/* PERFIL DO CLIENTE & ALINHAMENTO ESTRATÉGICO */}
                {diagnosis?.clientProfileAssessment && (
                  <section className="bg-white rounded-[28px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center">
                          <Sliders size={17} />
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold text-[#1D1D1F]">
                            Perfil Estratégico & Metas
                          </h2>
                          <p className="text-[11px] text-[#86868B]">
                            Alinhamento entre sua renda fixa base, arquétipo financeiro e metas
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#F2F2F7] text-[#1D1D1F] border border-black/[0.06]">
                        {diagnosis.clientProfileAssessment.persona}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                        <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                          Renda Fixa Mensal
                        </span>
                        <strong className="mt-1 block text-base font-semibold text-[#1D1D1F] font-mono tabular-nums">
                          R$ {formatCurrency(diagnosis.clientProfileAssessment.monthlyIncomeBase)}
                        </strong>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                        <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                          Tolerância a Risco
                        </span>
                        <strong className="mt-1 block text-base font-semibold text-[#1D1D1F]">
                          {diagnosis.clientProfileAssessment.riskTolerance}
                        </strong>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                        <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                          Foco Primário
                        </span>
                        <strong className="mt-1 block text-xs font-semibold text-[#1D1D1F] truncate" title={diagnosis.clientProfileAssessment.primaryFocus}>
                          {diagnosis.clientProfileAssessment.primaryFocus}
                        </strong>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1.5 text-xs">
                      <span className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-[#1D1D1F]" />
                        <span>Diagnóstico de Alinhamento com o Perfil</span>
                      </span>
                      <p className="text-[#86868B] leading-relaxed">
                        {diagnosis.clientProfileAssessment.profileAlignmentInsight}
                      </p>
                      {diagnosis.clientProfileAssessment.recommendedActionForGoal && (
                        <p className="text-[#1D1D1F] font-medium pt-1 border-t border-black/5">
                          🎯 <strong>Ação tática recomendada:</strong> {diagnosis.clientProfileAssessment.recommendedActionForGoal}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* REALITY CHECK PARA MESES FUTUROS (PREVENÇÃO CONTÁBIL) */}
                {diagnosis?.futureMonthsRealityCheck && (
                  <section className="bg-white rounded-[28px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                          <CalendarClock size={17} />
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold text-[#1D1D1F]">
                            Previsão Realista para Meses Futuros
                          </h2>
                          <p className="text-[11px] text-[#86868B]">
                            Ponderação de gastos variáveis do dia a dia nas projeções futuras (ex: Dezembro)
                          </p>
                        </div>
                      </div>
                      {diagnosis.futureMonthsRealityCheck.historicalVariableBaseline > 0 && (
                        <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 self-start sm:self-auto max-w-full break-words">
                          Gasto variável habitual: ~R$ {formatCurrency(diagnosis.futureMonthsRealityCheck.historicalVariableBaseline)}/mês
                        </span>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/50 text-xs text-[#1D1D1F] leading-relaxed">
                      <p>{diagnosis.futureMonthsRealityCheck.realityNote}</p>
                    </div>
                  </section>
                )}

                {/* 2. FLUXO & LIQUIDEZ INTERATIVA (GRÁFICO VISUAL APPLE) */}
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

                {/* 3. ESPECTRO DE GASTOS & CATEGORIAS (APPLE CARD STYLE) */}
                {spectrumCategories.length > 0 && (
                  <CategorySpectrumBar
                    categories={spectrumCategories}
                    selectedCategory={selectedCategoryFilter}
                    onSelectCategory={setSelectedCategoryFilter}
                  />
                )}

                {/* 4. HUB DE INTELIGÊNCIA DE PADRÕES ORGANIZADOS (COM SIMULAÇÃO TÁTIL) */}
                {diagnosis && (
                  <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed size={15} className="text-[#86868B]" />
                        <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                          Padrões & Hábitos de Consumo
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-xs text-[#86868B]">
                          {filteredPatterns.length} de {visibleSpecificAlerts.length} mapeados
                        </span>
                        <button
                          type="button"
                          onClick={handleFetchMorePatterns}
                          disabled={isSearchingPatterns}
                          className="text-[11px] font-semibold text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] border border-black/[0.05] px-3 py-1 rounded-full transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
                          title="Escanear lançamentos em busca de padrões recorrentes"
                        >
                          <RefreshCw size={11} className={isSearchingPatterns ? "animate-spin text-[#1D1D1F]" : "text-[#86868B]"} />
                          <span>{isSearchingPatterns ? "Auditando..." : "Buscar Mais Padrões"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Filtros em Clusters Apple Style */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-[#E5E5EA]/60 p-1 rounded-2xl w-fit border border-black/[0.04]">
                      <button
                        type="button"
                        onClick={() => setSelectedCluster("all")}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          selectedCluster === "all"
                            ? "bg-white text-[#1D1D1F] shadow-xs"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        Todos ({visibleSpecificAlerts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCluster("alerts")}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          selectedCluster === "alerts"
                            ? "bg-white text-rose-700 shadow-xs"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>Ralos Financeiros ({alertsCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCluster("recurring")}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          selectedCluster === "recurring"
                            ? "bg-white text-purple-700 shadow-xs"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span>Assinaturas & Fixas ({recurringCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCluster("habits")}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          selectedCluster === "habits"
                            ? "bg-white text-[#1D1D1F] shadow-xs"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <span>Estilo de Vida ({habitsCount})</span>
                      </button>
                    </div>

                    {patternsFeedback && (
                      <div className="px-3.5 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-black/5 text-xs text-[#1D1D1F] flex items-center justify-between shadow-sm animate-in fade-in duration-200">
                        <span className="font-medium">{patternsFeedback}</span>
                        <button
                          type="button"
                          onClick={() => setPatternsFeedback(null)}
                          className="text-[#86868B] hover:text-[#1D1D1F] text-xs font-bold px-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {filteredPatterns.length === 0 ? (
                      <div className="bg-white rounded-[24px] p-6 border border-black/[0.04] text-center space-y-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                          <CheckCircle2 size={20} />
                        </div>
                        <h3 className="text-sm font-semibold text-[#1D1D1F]">
                          Nenhum padrão encontrado neste filtro
                        </h3>
                        <p className="text-xs text-[#86868B] max-w-md mx-auto leading-relaxed">
                          {selectedCategoryFilter
                            ? `Não encontramos hábitos registrados na categoria "${selectedCategoryFilter}".`
                            : "Altere o filtro acima ou clique em 'Buscar Mais Padrões' para auditar novamente."}
                        </p>
                        {selectedCategoryFilter && (
                          <button
                            type="button"
                            onClick={() => setSelectedCategoryFilter(null)}
                            className="text-xs font-semibold text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
                          >
                            Limpar filtro de categoria
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {filteredPatterns.map((item, idx) => (
                          <InteractivePatternCard
                            key={`${item.item}-${idx}`}
                            item={item}
                            targetGoalName={targetGoalName}
                            onDismiss={handleDismissPattern}
                            onDiscuss={(prompt) => {
                              setActiveTab("chat");
                              handleSendMessage(prompt);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* 5. LINHA DO TEMPO DE FATURAS & PARCELAS DILUÍDAS (APPLE TIMELINE) */}
                {diagnosis?.installmentSchedule && diagnosis.installmentSchedule.length > 0 && (
                  <InstallmentTimelineChart
                    schedule={diagnosis.installmentSchedule}
                    onSelectPeriod={(period) => {
                      // Feedback visual instantâneo
                    }}
                  />
                )}

                {/* 5. PADRÕES DETECTADOS & PRÓXIMOS CICLOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Padrões de Gastos */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                        Padrões Detectados
                      </h2>
                      <span className="text-xs text-[#86868B]">
                        {diagnosis?.spendingPatterns?.length || 1} observados
                      </span>
                    </div>

                    <div className="space-y-3">
                      {diagnosis?.spendingPatterns?.map((pat, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded-[22px] p-4.5 border border-black/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.02)] space-y-1.5 hover:border-black/15 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#1D1D1F]">{pat.title}</span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                pat.type === "warning"
                                  ? "bg-amber-50 text-amber-700 border-amber-200/60"
                                  : pat.type === "alert"
                                  ? "bg-rose-50 text-rose-700 border-rose-200/60"
                                  : "bg-blue-50 text-blue-700 border-blue-200/60"
                              }`}
                            >
                              {pat.type === "warning"
                                ? "Atenção"
                                : pat.type === "alert"
                                ? "Alerta"
                                : "Observação"}
                            </span>
                          </div>
                          <p className="text-xs text-[#86868B] leading-relaxed">{pat.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Próximos Ciclos & Faturas */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                        Próximos Ciclos & Faturas
                      </h2>
                      <span className="text-xs text-[#86868B]">Compromissos</span>
                    </div>

                    <div className="space-y-3">
                      {diagnosis?.futureProjections?.map((proj, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded-[22px] p-4.5 border border-black/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.02)] space-y-1.5 hover:border-black/15 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#1D1D1F]">{proj.period}</span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                proj.severity === "alert"
                                  ? "bg-rose-50 text-rose-700 border-rose-200/60"
                                  : proj.severity === "warning"
                                  ? "bg-amber-50 text-amber-700 border-amber-200/60"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                              }`}
                            >
                              {proj.severity === "alert"
                                ? "Alerta"
                                : proj.severity === "warning"
                                ? "Atenção"
                                : "Estável"}
                            </span>
                          </div>
                          <p className="text-xs text-[#86868B] leading-relaxed">{proj.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* 6. RECOMENDAÇÕES PRÁTICAS (APPLE ACTION CARDS) */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                      Recomendações do Assistente
                    </h2>
                    <span className="text-xs text-[#86868B]">Ações sugeridas</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                    {diagnosis?.actionableSuggestions?.map((sug, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-[24px] p-5 border border-black/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.025)] hover:border-black/15 transition-all flex flex-col justify-between space-y-3.5 min-w-0 overflow-hidden"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 min-w-0">
                            <h3 className="text-xs font-semibold text-[#1D1D1F] break-words flex-1 min-w-0">{sug.title}</h3>
                            {sug.potentialGain && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 max-w-full break-words self-start sm:self-auto">
                                {sug.potentialGain}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#86868B] leading-relaxed break-words">{sug.action}</p>
                        </div>

                        <div className="pt-2.5 flex items-center justify-between border-t border-black/[0.04] text-[11px] text-[#86868B] gap-2">
                          <span className="truncate">{sug.targetGoal ? `Meta: ${sug.targetGoal}` : "Equilíbrio"}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("chat");
                              handleSendMessage(`Como posso colocar em prática a recomendação "${sug.title}"?`);
                            }}
                            className="text-xs font-semibold text-[#1D1D1F] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <span>Conversar sobre isso</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        ) : (
          /* =========================================================
             ABA 2: CHAT SIRI & SIMULADOR DE COMPRAS
             ========================================================= */
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* 1. WIDGET DO SIMULADOR DE COMPRAS ESTILO APPLE SHEET */}
            <section className="bg-white rounded-[28px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Calculator size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1D1D1F]">
                      Simulador de Impacto de Compra
                    </h3>
                    <p className="text-xs text-[#86868B]">
                      Simule à vista ou parcelado para ver o impacto no limite e nas faturas
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
                  className="text-xs font-semibold px-4 py-1.5 rounded-full bg-[#F2F2F7] hover:bg-black/5 active:scale-95 text-[#1D1D1F] transition-all cursor-pointer"
                >
                  {isSimulatorOpen ? "Fechar" : "Configurar Compra"}
                </button>
              </div>

              {isSimulatorOpen && (
                <div className="pt-4 border-t border-black/[0.05] space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                        O que deseja comprar?
                      </label>
                      <input
                        type="text"
                        value={simDescription}
                        onChange={(e) => setSimDescription(e.target.value)}
                        placeholder="Ex: Smartphone, Notebook..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                        Valor total (R$)
                      </label>
                      <input
                        type="text"
                        value={simAmount}
                        onChange={(e) => setSimAmount(e.target.value)}
                        placeholder="1200"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F2F2F7] text-xs font-semibold text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black font-mono tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                        Forma de Pagamento
                      </label>
                      <div className="flex gap-1 bg-[#F2F2F7] p-1 rounded-xl border border-black/5">
                        <button
                          type="button"
                          onClick={() => setSimMethod("credit")}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            simMethod === "credit"
                              ? "bg-white text-[#1D1D1F] shadow-xs"
                              : "text-[#86868B]"
                          }`}
                        >
                          Crédito
                        </button>
                        <button
                          type="button"
                          onClick={() => setSimMethod("cash")}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            simMethod === "cash"
                              ? "bg-white text-[#1D1D1F] shadow-xs"
                              : "text-[#86868B]"
                          }`}
                        >
                          À vista (PIX)
                        </button>
                      </div>
                    </div>
                  </div>

                  {simMethod === "credit" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                          Parcelas no Cartão
                        </label>
                        <span className="text-xs font-semibold text-emerald-700 font-mono tabular-nums">
                          {simInstallments}x de R$ {formatCurrency(installmentValue)}
                        </span>
                      </div>

                      {/* Seletor Tátil de Parcelas Apple Segmented */}
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 4, 6, 8, 10, 12, 18, 24].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSimInstallments(n)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              simInstallments === n
                                ? "bg-[#1D1D1F] text-white shadow-xs"
                                : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                            }`}
                          >
                            {n}x
                          </button>
                        ))}
                      </div>

                      {creditCards.length > 0 && (
                        <div className="pt-1">
                          <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                            Cartão de Crédito
                          </label>
                          <select
                            value={simCardId}
                            onChange={(e) => setSimCardId(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                          >
                            {creditCards.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} — Limite restante: R${" "}
                                {formatCurrency(Math.max(0, c.limit - (c.spent || 0)))}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={executeSimulation}
                      className="w-full sm:w-auto py-2.5 px-6 rounded-full bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Calculator size={14} className="text-white" />
                      <span>Simular Impacto no Fluxo</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 2. BARRA DE STATUS DO CHAT & SESSÃO ATIVA */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#86868B]">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-semibold text-[#1D1D1F] truncate max-w-[220px]">
                  {currentSession?.title || "Conversa Atual"}
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#E5E5EA] text-[#1D1D1F] font-medium shrink-0">
                  {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
                </span>
                {diagnosis && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("diagnosis")}
                    className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] px-2.5 py-0.5 rounded-full transition-all cursor-pointer border border-black/[0.04]"
                  >
                    <Compass size={10} />
                    <span>Ver Diagnóstico ({diagnosis.healthScore} pts)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#1D1D1F] hover:bg-black active:scale-95 px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-xs"
                >
                  <Plus size={12} />
                  <span>Nova Conversa</span>
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCurrentSession}
                    title="Limpar histórico desta conversa"
                    className="flex items-center gap-1 text-[11px] text-[#86868B] hover:text-rose-600 transition-colors cursor-pointer px-2 py-1"
                  >
                    <Trash2 size={12} />
                    <span className="hidden sm:inline">Limpar</span>
                  </button>
                )}
              </div>
            </div>

            {/* 3. ÁREA DE MENSAGENS ESTILO APPLE MESSAGES */}
            <section
              ref={chatSectionRef}
              className="bg-white rounded-[28px] p-4.5 sm:p-6 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] h-[540px] flex flex-col justify-between min-w-0 overflow-hidden"
            >
              <div className="overflow-y-auto space-y-4 pr-1 touch-scroll flex-1">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-6 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
                      <Compass size={22} className="text-white" />
                    </div>
                    <div className="max-w-md space-y-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                          Wallet
                        </span>
                        <span className="text-2xl font-black tracking-tighter text-[#1D1D1F] leading-none">
                          +
                        </span>
                      </div>
                      <p className="text-xs text-[#86868B] leading-relaxed">
                        Consulte detalhes do seu fluxo, faturas abertas, hábitos recorrentes ou simule o impacto de compras parceladas.
                      </p>
                    </div>

                    {/* Quick Prompts Padrão Apple Pills */}
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg pt-2">
                      {quickPrompts.map((prompt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendMessage(prompt)}
                          className="text-xs px-3.5 py-2 rounded-full bg-white hover:bg-[#F2F2F7] active:scale-95 text-[#1D1D1F] border border-black/[0.06] shadow-xs transition-all text-left cursor-pointer break-words max-w-full"
                        >
                          {prompt}
                        </button>
                      ))}
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
                        className={`max-w-[92%] sm:max-w-[85%] rounded-[24px] p-4 sm:p-4.5 text-xs leading-relaxed space-y-3 ${
                          msg.role === "user"
                            ? "bg-[#1D1D1F] text-white rounded-br-xs shadow-xs"
                            : "bg-[#FAFAFC] text-[#1D1D1F] border border-black/[0.06] rounded-bl-xs shadow-2xs"
                        }`}
                      >
                        {/* Cartão de Veredito Apple Wallet Pass */}
                        {msg.simulationResult && (
                          <div
                            className={`p-3.5 rounded-2xl border text-[11px] font-medium space-y-1.5 ${
                              msg.simulationResult.verdict === "safe"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200/60"
                                : msg.simulationResult.verdict === "warning"
                                ? "bg-amber-50 text-amber-800 border-amber-200/60"
                                : "bg-rose-50 text-rose-800 border-rose-200/60"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold">
                              {msg.simulationResult.verdict === "safe" ? (
                                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                              ) : (
                                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                              )}
                              <span>
                                {msg.simulationResult.verdict === "safe"
                                  ? "Compra Viável"
                                  : msg.simulationResult.verdict === "warning"
                                  ? "Atenção no Orçamento"
                                  : "Alerta de Comprometimento"}
                              </span>
                            </div>
                            <p className="leading-relaxed">{msg.simulationResult.verdictMessage}</p>
                            <div className="pt-1 text-[10px] opacity-85 border-t border-black/5 flex items-center justify-between">
                              <span>
                                Comprometimento: <span className="font-mono tabular-nums">{msg.simulationResult.before.monthlyCommitmentPercent}%</span> ➔{" "}
                                <span className="font-mono tabular-nums">{msg.simulationResult.after.monthlyCommitmentPercent}%</span>
                              </span>
                              <span>{msg.simulationResult.installments}x no cartão</span>
                            </div>
                          </div>
                        )}

                        <FormattedMessage content={msg.content} role={msg.role} />

                        <div
                          className={`flex items-center justify-between text-[10px] pt-1.5 border-t ${
                            msg.role === "user"
                              ? "text-white/60 border-white/10"
                              : "text-[#86868B] border-black/[0.04]"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {msg.role === "assistant" && (
                              <span className="font-semibold text-[#1D1D1F]">Parecer Financeiro</span>
                            )}
                          </div>
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isSending && (
                  <div className="flex items-center gap-2 p-3 text-xs text-[#86868B] bg-[#FAFAFC] rounded-2xl w-fit border border-black/[0.04]">
                    <RefreshCw size={13} className="animate-spin text-[#1D1D1F]" />
                    <span>Calculando impactos no fluxo de caixa...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* 4. INPUT DE MENSAGEM */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="mt-3 flex items-center gap-2 border-t border-black/[0.05] pt-3"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Pergunte sobre seus gastos, faturas ou simule compras..."
                    className="w-full pl-4 pr-10 py-3 rounded-full bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/10 placeholder:text-[#86868B] transition-all"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none">
                    <Compass size={14} className="text-[#86868B]" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isSending}
                  className="w-10 h-10 rounded-full bg-[#1D1D1F] hover:bg-black text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shadow-xs shrink-0 active:scale-95"
                >
                  <Send size={15} />
                </button>
              </form>
            </section>

            {/* =========================================================
                5. HISTÓRICO DE CONVERSAS (SESSÕES SALVAS ABAIXO)
               ========================================================= */}
            <section className="bg-white rounded-[28px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#1D1D1F]">
                        Histórico de Conversas
                      </h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F2F2F7] text-[#1D1D1F] border border-black/[0.06]">
                        {sessions.length} {sessions.length === 1 ? "conversa" : "conversas"}
                      </span>
                    </div>
                    <p className="text-xs text-[#86868B]">
                      Visualize, alterne ou interaja com diferentes conversas salvas
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1D1D1F] hover:bg-black active:scale-95 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <Plus size={14} />
                  <span>Nova Conversa</span>
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#86868B] bg-[#FAFAFC] rounded-2xl border border-black/[0.04]">
                  Nenhuma conversa gravada no momento. Suas consultas e simulações aparecerão aqui automaticamente.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {sessions.map((sess) => {
                    const isActive = sess.id === activeSessionId;
                    const lastMsg = sess.messages && sess.messages.length > 0
                      ? sess.messages[sess.messages.length - 1]
                      : null;
                    const preview = lastMsg
                      ? lastMsg.content.slice(0, 95) + (lastMsg.content.length > 95 ? "..." : "")
                      : "Conversa pronta para iniciar...";

                    return (
                      <div
                        key={sess.id}
                        onClick={() => handleSelectSession(sess.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          isActive
                            ? "bg-white border-[#1D1D1F]/40 shadow-xs ring-1 ring-[#1D1D1F]/15"
                            : "bg-[#FAFAFC] hover:bg-white border-black/[0.04] hover:border-black/15 shadow-2xs"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isActive && (
                                <span className="w-2 h-2 rounded-full bg-[#1D1D1F] shrink-0" />
                              )}
                              <h4 className="text-xs font-semibold text-[#1D1D1F] truncate">
                                {sess.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#86868B] border border-black/5">
                                {sess.messages ? sess.messages.length : 0} msgs
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSession(sess.id, e)}
                                title="Excluir esta conversa"
                                className="p-1 rounded-lg text-[#86868B] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-[#86868B] line-clamp-2 leading-relaxed">
                            {preview}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between text-[10px] text-[#86868B]">
                          <span>
                            {formatSessionDate(sess.updatedAt || sess.createdAt)}
                          </span>
                          <span
                            className={`font-semibold flex items-center gap-0.5 ${
                              isActive ? "text-[#1D1D1F]" : "text-[#86868B]"
                            }`}
                          >
                            <span>{isActive ? "Aberta agora" : "Abrir conversa"}</span>
                            <ChevronRight size={11} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
