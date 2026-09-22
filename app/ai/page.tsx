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
} from "lucide-react";
import { FinancialDiagnosis } from "@/app/api/ai/analyze/route";
import { PurchaseSimulationResult } from "@/lib/services/financialContextService";
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  loadPersistentDiagnosis,
  savePersistentDiagnosis,
  loadInitialDiagnosisSync,
} from "@/lib/services/aiChatService";

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
    return cached?.modelUsed || "gemini-3.6-flash";
  });

  // Estados do Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Estados do Simulador de Compra (Apple Interactive Sheet)
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simAmount, setSimAmount] = useState<string>("1200");
  const [simMethod, setSimMethod] = useState<"cash" | "credit">("credit");
  const [simInstallments, setSimInstallments] = useState<number>(6);
  const [simCardId, setSimCardId] = useState<string>("");
  const [simDescription, setSimDescription] = useState<string>("Novo Smartphone");

  // Cartões de crédito para o simulador
  const creditCards = cards.filter((c) => c.type === "credit");

  // Inicializa o cartão padrão do simulador
  useEffect(() => {
    if (!simCardId && creditCards.length > 0) {
      setSimCardId(creditCards[0].id);
    }
  }, [creditCards, simCardId]);

  // Carrega diagnóstico persistido e histórico salvo de mensagens do chat (Firestore / localStorage)
  useEffect(() => {
    let isMounted = true;

    // Se já tiver cache local para o user específico, aplica de imediato
    if (user?.uid) {
      const userCached = loadInitialDiagnosisSync(user.uid);
      if (userCached?.diagnosis) {
        setDiagnosis(userCached.diagnosis as FinancialDiagnosis);
        if (userCached.timestamp) setLastAnalyzedAt(userCached.timestamp);
        if (userCached.modelUsed) setAnalysisModel(userCached.modelUsed);
      }
    }

    loadPersistentDiagnosis(user?.uid).then((saved) => {
      if (isMounted && saved?.diagnosis) {
        setDiagnosis(saved.diagnosis as FinancialDiagnosis);
        if (saved.timestamp) setLastAnalyzedAt(saved.timestamp);
        if (saved.modelUsed) setAnalysisModel(saved.modelUsed);
      }
    });

    loadChatHistory(user?.uid).then((savedMsgs) => {
      if (isMounted && savedMsgs.length > 0) {
        setMessages(savedMsgs);
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
        };
      });

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        }),
      });

      const data = await res.json();
      if (data.success && data.diagnosis) {
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
        throw new Error(data.error || "Não foi possível carregar a análise no momento.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao conectar com o assistente.";
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
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

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    void saveChatHistory(newMessages, user?.uid);

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
        };
      });

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
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

      const data = await res.json();

      if (data.success && data.message) {
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
        const updated = [...newMessages, assistantMsg];
        setMessages(updated);
        void saveChatHistory(updated, user?.uid);
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
      const updated = [...newMessages, errorMsg];
      setMessages(updated);
      void saveChatHistory(updated, user?.uid);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    if (messages.length === 0) return;
    const confirmClear = window.confirm(
      "Deseja realmente limpar o histórico de conversas com o assistente?"
    );
    if (confirmClear) {
      setMessages([]);
      await clearChatHistory(user?.uid);
    }
  };

  const executeSimulation = () => {
    const amountVal = parseFloat(simAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(amountVal) || amountVal <= 0) return;

    const simPayload = {
      amount: amountVal,
      method: simMethod,
      installments: simMethod === "credit" ? simInstallments : 1,
      cardId: simCardId,
      description: simDescription,
    };

    const selectedCard = cards.find((c) => c.id === simCardId);
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

  return (
    <div className="min-h-full bg-[#F2F2F7] text-[#1D1D1F] font-sans selection:bg-[#1D1D1F] selection:text-white">
      {/* Container Central com Padding Dinâmico Apple */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* =========================================================
            1. HEADER APPLE INTELLIGENCE
           ========================================================= */}
        <header className="relative rounded-[28px] bg-white/75 backdrop-blur-xl border border-white/60 p-5 sm:p-6 shadow-[0_8px_28px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Luz de Fundo Iridescente Apple Intelligence */}
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-gradient-to-br from-violet-400/20 via-sky-400/20 to-amber-300/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-gradient-to-tr from-emerald-400/15 via-blue-400/15 to-purple-400/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              {/* Badge de Metadados Apple Style */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#86868B]">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500/10 via-sky-500/10 to-amber-500/10 border border-violet-500/15 text-[#1D1D1F] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-violet-600 to-amber-500" />
                  <span>Apple Intelligence</span>
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

              {/* Título com Ícone de Aura Fluida */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1D1D1F] via-[#2C2C2E] to-[#48484A] text-white flex items-center justify-center shadow-md shrink-0">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-violet-500/30 via-sky-400/30 to-amber-400/30 blur-sm" />
                  <Sparkles size={18} className="relative z-10 text-amber-300" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                    Analista Financeiro
                  </h1>
                  <p className="text-xs text-[#86868B]">
                    Inteligência contábil sob demanda com validação de fluxo de caixa
                  </p>
                </div>
              </div>
            </div>

            {/* Segmented Control & Botão Recalcular */}
            <div className="flex items-center gap-2 self-start sm:self-auto pt-2 sm:pt-0">
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
              <div className="p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-purple-500/20 shadow-xs flex items-center justify-between gap-3 text-xs text-[#1D1D1F] animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-purple-600 shrink-0" />
                  <span className="font-medium text-[#1D1D1F]">
                    O Analista está recalculando seu diagnóstico com as informações mais recentes...
                  </span>
                </div>
              </div>
            )}

            {/* ESTADO 1: ANALISANDO DO ZERO (SKELETON ELEGANTE COM EFEITO SHIMMER) */}
            {isAnalyzing && !diagnosis ? (
              <section className="bg-white rounded-[28px] p-8 sm:p-12 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-500/20 via-sky-400/20 to-amber-300/20 blur-md animate-pulse" />
                  <div className="w-14 h-14 rounded-full bg-[#F2F2F7] flex items-center justify-center relative z-10">
                    <RefreshCw size={24} className="text-[#1D1D1F] animate-spin" />
                  </div>
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
                  <Sparkles size={12} className="text-amber-500" />
                  <span>Modelo ativo: {analysisModel}</span>
                </div>
              </section>
            ) : !diagnosis ? (
              /* ESTADO 2: SEM ANÁLISE SALVA (HERO SOB DEMANDA) */
              <section className="relative bg-white rounded-[28px] p-7 sm:p-10 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-6 text-center overflow-hidden">
                <div className="w-16 h-16 rounded-[22px] bg-gradient-to-tr from-[#1D1D1F] via-[#2C2C2E] to-[#48484A] text-amber-300 mx-auto flex items-center justify-center shadow-lg">
                  <Sparkles size={28} />
                </div>

                <div className="space-y-2 max-w-lg mx-auto">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                    Diagnóstico Financeiro Sob Demanda
                  </h2>
                  <p className="text-xs sm:text-sm text-[#86868B] leading-relaxed">
                    O diagnóstico é gerado apenas sob sua solicitação para economizar chamadas e garantir privacidade. Uma vez calculado, ele fica salvo no seu dispositivo e na nuvem.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={runDiagnosis}
                    className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs sm:text-sm font-semibold px-6 py-3 rounded-full transition-all inline-flex items-center gap-2.5 shadow-md cursor-pointer"
                  >
                    <Sparkles size={16} className="text-amber-300" />
                    <span>Gerar Diagnóstico com IA</span>
                  </button>
                </div>

                {/* Métricas Rápidas Apple Health Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-black/[0.04] text-left">
                  <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                    <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                      Comprometimento Atual
                    </span>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <strong className="text-lg font-semibold text-[#1D1D1F]">
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
                    <strong className="mt-1 block text-lg font-semibold text-emerald-600 truncate">
                      R$ {formatCurrency(mainBalance)}
                    </strong>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                    <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                      Faturas em Aberto
                    </span>
                    <strong className="mt-1 block text-lg font-semibold text-[#1D1D1F] truncate">
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
                          className={`text-base font-semibold ${
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
                      <strong className="mt-1 block text-base font-semibold text-emerald-600 truncate">
                        R$ {formatCurrency(mainBalance)}
                      </strong>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                      <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                        Faturas em Aberto
                      </span>
                      <strong className="mt-1 block text-base font-semibold text-[#1D1D1F] truncate">
                        R$ {formatCurrency(totalInvoices)}
                      </strong>
                    </div>
                  </div>

                  {/* Parecer Apple Intelligence Summary Note */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-500/[0.03] via-sky-500/[0.03] to-amber-500/[0.03] border border-black/[0.05] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F]">
                      <div className="w-5 h-5 rounded-md bg-[#1D1D1F] text-amber-300 flex items-center justify-center shadow-2xs">
                        <Sparkles size={11} />
                      </div>
                      <span>Síntese do Analista</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#1D1D1F] leading-relaxed font-normal">
                      {diagnosis?.executiveSummary ||
                        "Seu fluxo de caixa opera de maneira regular. Mantenha os vencimentos futuros sob observação para preservar sua liquidez."}
                    </p>
                  </div>
                </section>

                {/* 2. LIQUIDEZ REAL: HOJE vs PRÓXIMO MÊS (APPLE CARD WIDGET) */}
                <section className="bg-white rounded-[28px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Coins size={17} />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-[#1D1D1F]">
                          Quanto Tenho para Gastar
                        </h2>
                        <p className="text-[11px] text-[#86868B]">
                          Liquidez disponível hoje versus projeção de sobra no próximo ciclo
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#F2F2F7] text-[#1D1D1F]">
                      Livro-Caixa
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Bloco 1: Agora / Mês Atual */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-[#FAFAFC] to-[#F2F2F7]/70 border border-black/[0.04] space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                          <CalendarClock size={14} className="text-[#86868B]" />
                          <span>Agora ({diagnosis?.cashflowWindow?.currentMonth.monthName || "Mês Atual"})</span>
                        </span>
                        <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
                          Disponível Imediato
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] text-[#86868B]">Saldo livre que resta no mês:</div>
                        <div className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                          R$ {formatCurrency(diagnosis?.cashflowWindow?.currentMonth.projectedFreeBalance ?? mainBalance)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-black/5 text-[11px]">
                        <div>
                          <span className="text-[#86868B] block text-[10px]">Saldo na Conta</span>
                          <span className="font-semibold text-emerald-700 truncate block">
                            R$ {formatCurrency(diagnosis?.cashflowWindow?.currentMonth.checkingBalance ?? mainBalance)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#86868B] block text-[10px]">Contas a Fechar</span>
                          <span className="font-semibold text-[#1D1D1F] truncate block">
                            R$ {formatCurrency(diagnosis?.cashflowWindow?.currentMonth.pendingBills ?? monthExpense)}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#86868B] leading-relaxed pt-1">
                        {diagnosis?.cashflowWindow?.currentMonth.insight ||
                          "Seu saldo cobre as pendências deste ciclo com tranquilidade."}
                      </p>
                    </div>

                    {/* Bloco 2: Próximo Mês */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-[#FAFAFC] to-[#F2F2F7]/70 border border-black/[0.04] space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                          <TrendingUp size={14} className="text-blue-600" />
                          <span>Próximo Mês ({diagnosis?.cashflowWindow?.nextMonth.monthName || "Mês Seguinte"})</span>
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">
                          Projetado
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] text-[#86868B]">Livre para gastar mês que vem:</div>
                        <div className="text-3xl font-semibold tracking-tight text-emerald-700">
                          R$ {formatCurrency(diagnosis?.cashflowWindow?.nextMonth.projectedFreeBalance ?? (monthlyIncome - totalInvoices))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-black/5 text-[11px]">
                        <div>
                          <span className="text-[#86868B] block text-[10px]">Entradas Previstas</span>
                          <span className="font-semibold text-[#1D1D1F] truncate block">
                            R$ {formatCurrency(diagnosis?.cashflowWindow?.nextMonth.projectedIncome ?? monthlyIncome)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#86868B] block text-[10px]">Gastos Comprometidos</span>
                          <span className="font-semibold text-rose-600 truncate block">
                            R$ {formatCurrency(diagnosis?.cashflowWindow?.nextMonth.committedExpenses ?? totalInvoices)}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#86868B] leading-relaxed pt-1">
                        {diagnosis?.cashflowWindow?.nextMonth.insight ||
                          "Suas despesas previstas deixam folga no orçamento após quitar as faturas e contas fixas."}
                      </p>
                    </div>
                  </div>
                </section>

                {/* 3. GASTOS ESPECÍFICOS & HÁBITOS DE CONSUMO (SCREEN TIME STYLE) */}
                {diagnosis?.specificExpensesAlerts && diagnosis.specificExpensesAlerts.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed size={14} className="text-[#86868B]" />
                        <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                          Gastos Específicos & Hábitos de Consumo
                        </h2>
                      </div>
                      <span className="text-xs text-[#86868B]">
                        {diagnosis.specificExpensesAlerts.length} itens mapeados
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {diagnosis.specificExpensesAlerts.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded-[24px] p-5 border border-black/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.025)] hover:border-black/15 transition-all flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-[#1D1D1F]">
                                {item.item}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  item.alertType === "alert"
                                    ? "bg-rose-50 text-rose-700 border-rose-200/60"
                                    : item.alertType === "warning"
                                    ? "bg-amber-50 text-amber-700 border-amber-200/60"
                                    : "bg-blue-50 text-blue-700 border-blue-200/60"
                                }`}
                              >
                                {item.alertType === "alert"
                                  ? "Gasto Alto"
                                  : item.alertType === "warning"
                                  ? "Atenção"
                                  : "Frequente"}
                              </span>
                            </div>

                            <div className="text-lg font-bold text-[#1D1D1F]">
                              R$ {formatCurrency(item.totalAmount)}
                              {item.count && (
                                <span className="text-xs font-normal text-[#86868B] ml-2">
                                  ({item.count} compra{item.count > 1 ? "s" : ""})
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-[#86868B] leading-relaxed">
                              {item.message}
                            </p>
                          </div>

                          <div className="pt-2.5 border-t border-black/[0.04] flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab("chat");
                                handleSendMessage(`Como posso otimizar meus gastos com ${item.item}?`);
                              }}
                              className="text-xs font-semibold text-[#1D1D1F] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>Conversar sobre esse gasto</span>
                              <ChevronRight size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 4. GASTOS PARCELADOS MÊS A MÊS (FLUXO DILUÍDO) */}
                {diagnosis?.installmentSchedule && diagnosis.installmentSchedule.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-[#86868B]" />
                        <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                          Gastos Parcelados Mês a Mês (Fluxo Diluído)
                        </h2>
                      </div>
                      <span className="text-xs text-[#86868B]">Vencimentos futuros</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {diagnosis.installmentSchedule.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded-[22px] p-4.5 border border-black/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.02)] space-y-2 hover:border-black/15 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#1D1D1F]">{item.period}</span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                item.status === "alert"
                                  ? "bg-rose-50 text-rose-700 border-rose-200/60"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                              }`}
                            >
                              {item.status === "alert" ? "Pressão" : "Equilibrado"}
                            </span>
                          </div>
                          <div>
                            <span className="text-base font-bold text-[#1D1D1F]">
                              R$ {formatCurrency(item.cardInstallmentsAmount)}
                            </span>
                            {item.dueDateHint && (
                              <span className="text-[10px] text-[#86868B] block mt-0.5">
                                {item.dueDateHint}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#86868B] leading-relaxed">
                            {item.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {diagnosis?.actionableSuggestions?.map((sug, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-[24px] p-5 border border-black/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.025)] hover:border-black/15 transition-all flex flex-col justify-between space-y-3.5"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xs font-semibold text-[#1D1D1F]">{sug.title}</h3>
                            {sug.potentialGain && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                                {sug.potentialGain}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#86868B] leading-relaxed">{sug.action}</p>
                        </div>

                        <div className="pt-2.5 flex items-center justify-between border-t border-black/[0.04] text-[11px] text-[#86868B]">
                          <span>{sug.targetGoal ? `Meta: ${sug.targetGoal}` : "Equilíbrio"}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("chat");
                              handleSendMessage(`Como posso colocar em prática a recomendação "${sug.title}"?`);
                            }}
                            className="text-xs font-semibold text-[#1D1D1F] hover:underline flex items-center gap-1 cursor-pointer"
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F2F2F7] text-xs font-semibold text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black"
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
                        <span className="text-xs font-semibold text-emerald-700">
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
                      <Sparkles size={14} className="text-amber-300" />
                      <span>Simular Impacto no Chat</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 2. BARRA DE STATUS DO CHAT */}
            <div className="flex items-center justify-between px-2 text-xs text-[#86868B]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1D1D1F]">Conversas Salvas</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#E5E5EA] text-[#1D1D1F] font-medium">
                  {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
                </span>
                {diagnosis && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("diagnosis")}
                    className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-full transition-all cursor-pointer"
                  >
                    <Sparkles size={10} />
                    <span>Ver Diagnóstico ({diagnosis.healthScore} pts)</span>
                  </button>
                )}
              </div>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  title="Limpar histórico da conversa"
                  className="flex items-center gap-1 text-[11px] text-[#86868B] hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Limpar conversa</span>
                </button>
              )}
            </div>

            {/* 3. ÁREA DE MENSAGENS ESTILO APPLE MESSAGES & SIRI */}
            <section className="bg-white rounded-[28px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] h-[540px] flex flex-col justify-between">
              <div className="overflow-y-auto space-y-4 pr-1 touch-scroll flex-1">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1D1D1F] via-[#2C2C2E] to-[#48484A] text-white flex items-center justify-center shadow-md">
                      <Sparkles size={22} className="text-amber-300" />
                    </div>
                    <div className="max-w-md space-y-1.5">
                      <h3 className="text-lg font-semibold tracking-tight text-[#1D1D1F]">
                        Como posso orientar suas finanças hoje?
                      </h3>
                      <p className="text-xs text-[#86868B] leading-relaxed">
                        Faça perguntas diretas sobre suas contas, faturas ou simule compras parceladas para entender o impacto no fluxo de caixa.
                      </p>
                    </div>

                    {/* Quick Prompts Padrão Apple Pills */}
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg pt-2">
                      {quickPrompts.map((prompt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendMessage(prompt)}
                          className="text-xs px-4 py-2 rounded-full bg-white hover:bg-[#F2F2F7] active:scale-95 text-[#1D1D1F] border border-black/[0.06] shadow-xs transition-all text-left cursor-pointer"
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
                        className={`max-w-[85%] rounded-[24px] p-4 sm:p-4.5 text-xs leading-relaxed space-y-2.5 ${
                          msg.role === "user"
                            ? "bg-[#1D1D1F] text-white rounded-br-xs shadow-xs"
                            : "bg-[#FAFAFC] text-[#1D1D1F] border border-black/[0.05] rounded-bl-xs shadow-2xs"
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
                                Comprometimento: {msg.simulationResult.before.monthlyCommitmentPercent}% ➔{" "}
                                {msg.simulationResult.after.monthlyCommitmentPercent}%
                              </span>
                              <span>{msg.simulationResult.installments}x no cartão</span>
                            </div>
                          </div>
                        )}

                        <div className="whitespace-pre-line font-normal">{msg.content}</div>

                        <div
                          className={`flex items-center justify-between text-[10px] pt-1 ${
                            msg.role === "user" ? "text-white/60" : "text-[#86868B]"
                          }`}
                        >
                          <span>{msg.timestamp}</span>
                          {msg.modelUsed && <span>⚡ {msg.modelUsed}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isSending && (
                  <div className="flex items-center gap-2 p-3 text-xs text-[#86868B] bg-[#FAFAFC] rounded-2xl w-fit border border-black/[0.04]">
                    <RefreshCw size={13} className="animate-spin text-[#1D1D1F]" />
                    <span>O assistente está calculando os impactos contábeis...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* 4. INPUT DE MENSAGEM SIRI / SPOTLIGHT (iOS 18) */}
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
                    placeholder="Pergunte ao assistente... (ex: 'Quanto tenho para gastar este mês?')"
                    className="w-full pl-4 pr-10 py-3 rounded-full bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/10 placeholder:text-[#86868B] transition-all"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none">
                    <Sparkles size={14} className="text-amber-500" />
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
          </div>
        )}
      </div>
    </div>
  );
}
