"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  Send,
  RefreshCw,
  CreditCard,
  Wallet,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
  Clock,
  Zap,
  ChevronRight,
  PieChart,
  ShieldCheck,
  Check,
} from "lucide-react";
import { FinancialDiagnosis } from "@/app/api/ai/analyze/route";
import { PurchaseSimulationResult } from "@/lib/services/financialContextService";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  modelUsed?: string;
  simulationResult?: PurchaseSimulationResult | null;
}

export default function AIAnalystPage() {
  const {
    userProfile,
    cards,
    transactions,
    recurringItems,
    goals,
    mainBalance,
    monthIncome,
    monthExpense,
    isDataLoaded,
    getMonthlyProjection,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<"diagnosis" | "chat">("diagnosis");

  // Estados do Diagnóstico
  const [diagnosis, setDiagnosis] = useState<FinancialDiagnosis | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisModel, setAnalysisModel] = useState<string>("gemini-3.6-flash");

  // Estados do Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Estados do Simulador de Compra
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

  // Carrega diagnóstico persistido no localStorage (evita novas chamadas ao trocar de aba ou dar F5)
  useEffect(() => {
    try {
      const savedDiagnosis = localStorage.getItem("wallet_ai_diagnosis");
      const savedTimestamp = localStorage.getItem("wallet_ai_diagnosis_timestamp");
      const savedModel = localStorage.getItem("wallet_ai_model");

      if (savedDiagnosis) {
        const parsed = JSON.parse(savedDiagnosis);
        if (parsed && typeof parsed === "object") {
          setDiagnosis(parsed);
        }
      }
      if (savedTimestamp) {
        setLastAnalyzedAt(savedTimestamp);
      }
      if (savedModel) {
        setAnalysisModel(savedModel);
      }
    } catch (err) {
      console.warn("Falha ao recuperar diagnóstico em cache", err);
    }
  }, []);

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
      // Coleta rigorosa das projeções mês a mês calculadas pelo motor do livro-caixa (0 = mês atual até +5 meses)
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

        try {
          localStorage.setItem("wallet_ai_diagnosis", JSON.stringify(data.diagnosis));
          localStorage.setItem("wallet_ai_diagnosis_timestamp", timestamp);
          if (data.modelUsed) localStorage.setItem("wallet_ai_model", data.modelUsed);
        } catch (e) {
          console.warn("Falha ao persistir análise no cache local", e);
        }
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

    setMessages((prev) => [...prev, userMsg]);
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
        setMessages((prev) => [...prev, assistantMsg]);
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
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
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
        bg: "bg-emerald-50 border-emerald-200/60",
        ringColor: "#10B981",
      };
    }
    if (status === "healthy" || score >= 65) {
      return {
        label: "Saudável",
        color: "text-blue-700",
        bg: "bg-blue-50 border-blue-200/60",
        ringColor: "#007AFF",
      };
    }
    if (status === "attention" || score >= 45) {
      return {
        label: "Requer Atenção",
        color: "text-amber-700",
        bg: "bg-amber-50 border-amber-200/60",
        ringColor: "#F59E0B",
      };
    }
    return {
      label: "Alerta de Risco",
      color: "text-rose-700",
      bg: "bg-rose-50 border-rose-200/60",
      ringColor: "#F43F5E",
    };
  };

  const currentScore = diagnosis?.healthScore ?? 75;
  const healthBadge = getHealthBadge(diagnosis?.healthStatus, currentScore);

  // Cálculos rápidos de métricas para os cards estilo Apple Health
  const totalInvoices = creditCards.reduce((acc, c) => acc + (c.spent || c.invoiceAmount || 0), 0);
  const monthlyIncome = userProfile?.monthlyIncomeBase || (monthIncome > 0 ? monthIncome : 5000);
  const commitmentRatio = monthlyIncome > 0 ? Math.round(((monthExpense + totalInvoices) / monthlyIncome) * 100) : 0;

  const quickPrompts = [
    "Posso comprar um notebook de R$ 4.500 em 10x?",
    "Como economizar R$ 300 nas minhas contas este mês?",
    "Qual dos meus cartões devo priorizar para novas compras?",
    "Estou no caminho de cumprir minha principal meta financeira?",
  ];

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* 1. HEADER APPLE WALLET STYLE */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 md:pt-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
              Assistente Pessoal
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
            <span className="text-xs font-medium text-[#86868B]">{getPersonaLabel()}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
            <span className="text-xs text-[#86868B] flex items-center gap-1">
              <Clock size={11} className="text-[#86868B]" />
              <span>
                {lastAnalyzedAt
                  ? `Última análise: ${formatLastAnalyzed(lastAnalyzedAt)}`
                  : "Ainda não analisado"}
              </span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5 flex items-center gap-2.5">
            <span>Analista Financeiro</span>
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#1D1D1F] to-[#434346] text-white flex items-center justify-center shadow-xs">
              <Sparkles size={13} className="text-amber-300" />
            </div>
          </h1>
        </div>

        {/* Segmented Control (Apple style) e Botão Recalcular */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center p-1 bg-[#E5E5EA]/80 rounded-full border border-black/5">
            <button
              onClick={() => setActiveTab("diagnosis")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "diagnosis"
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "chat"
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Conversar & Simular
            </button>
          </div>

          <button
            onClick={runDiagnosis}
            disabled={isAnalyzing}
            title={diagnosis ? "Recalcular análise com dados recentes" : "Gerar nova análise financeira com IA"}
            className="p-2 sm:px-3.5 sm:py-1.5 rounded-full bg-white hover:bg-black/5 active:scale-95 border border-black/[0.04] text-xs font-medium text-[#1D1D1F] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw size={13} className={isAnalyzing ? "animate-spin text-[#86868B]" : ""} />
            <span className="hidden sm:inline">{diagnosis ? "Recalcular" : "Gerar Análise"}</span>
          </button>
        </div>
      </header>

      {/* 2. CONTEÚDO PRINCIPAL BASEADO NA ABA ATIVA */}
      {activeTab === "diagnosis" ? (
        <div className="space-y-6">
          {/* Mensagem de Erro se houver */}
          {analysisError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/70 text-rose-800 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                <span>{analysisError}</span>
              </div>
              <button
                onClick={runDiagnosis}
                className="px-3 py-1 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-all cursor-pointer shrink-0"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Estado 1: Carregando Diagnóstico (Skeleton / Pulse) */}
          {isAnalyzing ? (
            <section className="bg-white rounded-[26px] p-8 sm:p-12 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.035)] text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#F2F2F7] mx-auto flex items-center justify-center">
                <RefreshCw size={24} className="text-[#1D1D1F] animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-semibold text-[#1D1D1F]">
                  Analisando Livro-Caixa e Projeções Mês a Mês...
                </h3>
                <p className="text-xs text-[#86868B] max-w-md mx-auto leading-relaxed">
                  Cruzando saldo em conta, faturas de cartão, parcelamentos e o livro-caixa projetado dos próximos ciclos para garantir validação contábil exata.
                </p>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#A1A1A6] pt-2">
                <Sparkles size={13} className="text-amber-400" />
                <span>Consultando IA sob demanda via {analysisModel}</span>
              </div>
            </section>
          ) : !diagnosis ? (
            /* Estado 2: Sem análise salva (Inicial / On-Demand) */
            <section className="bg-white rounded-[26px] p-7 sm:p-10 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.035)] space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1D1D1F] to-[#434346] text-amber-300 mx-auto flex items-center justify-center shadow-md">
                <Sparkles size={28} />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                  Diagnóstico Financeiro Sob Demanda
                </h2>
                <p className="text-xs sm:text-sm text-[#86868B] leading-relaxed">
                  Para economizar requisições de IA e garantir que você visualize apenas informações sob sua solicitação, o diagnóstico é gerado sob demanda. Uma vez gerado, ele fica salvo para suas próximas consultas sem gastar chamadas adicionais.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={runDiagnosis}
                  className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs sm:text-sm font-semibold px-6 py-3 rounded-full transition-all inline-flex items-center gap-2.5 shadow-md cursor-pointer"
                >
                  <Sparkles size={16} className="text-amber-300" />
                  <span>Gerar Diagnóstico com IA</span>
                </button>
              </div>

              {/* Grade de 3 Métricas Rápidas Apple Style (Dados em Tempo Real sem custo de IA) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-black/[0.05] text-left">
                <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.03]">
                  <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
                    Comprometimento Atual
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
                    Saldo na Conta
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
            </section>
          ) : (
            /* Estado 3: Diagnóstico Concluído e Carregado (do cache ou recém-gerado) */
            <>
              {/* Card Principal: Índice de Saúde com Anel Apple Health */}
              <section className="bg-white rounded-[26px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.035)] space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    {/* Gauge Circular (SVG) */}
                    <div className="relative w-18 h-18 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
                        <circle
                          cx="36"
                          cy="36"
                          r="30"
                          className="stroke-black/[0.06]"
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
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
                          {currentScore}
                        </span>
                        <span className="text-[9px] font-semibold text-[#86868B] uppercase">Pontos</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-[#1D1D1F]">Saúde Financeira</h2>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${healthBadge.bg} ${healthBadge.color}`}
                        >
                          {healthBadge.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#86868B] leading-relaxed">
                        Cruzamento em tempo real de saldo em conta, faturas e metas cadastradas.
                      </p>
                      <div className="text-[11px] text-[#A1A1A6] flex items-center gap-1.5 pt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Conectado via {analysisModel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Ação Rápida */}
                  <button
                    onClick={() => {
                      setActiveTab("chat");
                      setIsSimulatorOpen(true);
                    }}
                    className="self-start sm:self-auto bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-4 py-2.5 rounded-full transition-all flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
                  >
                    <Calculator size={15} />
                    <span>Simulador de Compra</span>
                  </button>
                </div>

                {/* Grade de 3 Métricas Apple Style */}
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
                      Saldo na Conta
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

                {/* Parecer do Assistente (Estilo Apple Callout Note) */}
                <div className="p-5 rounded-[22px] bg-gradient-to-br from-[#FAFAFC] to-[#F2F2F7]/50 border border-black/[0.04] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F]">
                    <div className="w-5 h-5 rounded-md bg-[#1D1D1F] text-amber-300 flex items-center justify-center">
                      <Sparkles size={11} />
                    </div>
                    <span>Parecer do seu Assistente</span>
                  </div>
                  <p className="text-sm text-[#1D1D1F] leading-relaxed font-normal">
                    {diagnosis?.executiveSummary ||
                      "Olá! Seus dados mostram um fluxo de caixa ativo este mês. Acompanhe suas faturas para manter seus compromissos sob controle e acelerar suas metas."}
                  </p>
                </div>
              </section>

              {/* Grade de Padrões Detectados & Projeção de Faturas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Padrões de Gastos */}
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
                        className="bg-white rounded-[20px] p-4 sm:p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.025)] space-y-1.5 hover:border-black/15 transition-all"
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

                {/* 2. Grupos Futuros & Faturas */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                      Próximos Ciclos & Faturas
                    </h2>
                    <span className="text-xs text-[#86868B]">Compromissos futuros</span>
                  </div>

                  <div className="space-y-3">
                    {diagnosis?.futureProjections?.map((proj, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-[20px] p-4 sm:p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.025)] space-y-1.5 hover:border-black/15 transition-all"
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
                              ? "Déficit / Alerta"
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

              {/* 3. Recomendações e Melhorias Práticas (Apple Action Cards) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                    Recomendações do Assistente
                  </h2>
                  <span className="text-xs text-[#86868B]">Passos práticos</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {diagnosis?.actionableSuggestions?.map((sug, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-[22px] p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.025)] hover:border-black/15 transition-all flex flex-col justify-between space-y-3"
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

                      <div className="pt-2 flex items-center justify-between border-t border-black/[0.04] text-[11px] text-[#86868B]">
                        <span>{sug.targetGoal ? `Meta: ${sug.targetGoal}` : "Equilíbrio financeiro"}</span>
                        <button
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
        /* ABA 2: CHAT DO ASSISTENTE & SIMULADOR DE COMPRA */
        <div className="space-y-4">
          {/* Card do Simulador de Impacto de Compra (Apple Sheet Style) */}
          <section className="bg-white rounded-[26px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.035)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0">
                  <Calculator size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1D1D1F]">
                    Simulador de Impacto de Compra
                  </h3>
                  <p className="text-xs text-[#86868B]">
                    Descubra como uma nova compra afeta suas faturas e saldo antes de gastar.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#F2F2F7] hover:bg-black/5 active:scale-95 text-[#1D1D1F] transition-all cursor-pointer"
              >
                {isSimulatorOpen ? "Recolher" : "Configurar Compra"}
              </button>
            </div>

            {isSimulatorOpen && (
              <div className="pt-4 border-t border-black/[0.05] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 animate-in fade-in duration-300">
                <div>
                  <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                    O que deseja comprar?
                  </label>
                  <input
                    type="text"
                    value={simDescription}
                    onChange={(e) => setSimDescription(e.target.value)}
                    placeholder="Ex: Smartphone novo"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black"
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
                    placeholder="Ex: 1200"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F2F2F7] text-xs font-semibold text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={simMethod}
                    onChange={(e) => setSimMethod(e.target.value as "cash" | "credit")}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                  >
                    <option value="credit">Cartão de Crédito</option>
                    <option value="cash">À vista (Débito / PIX)</option>
                  </select>
                </div>

                {simMethod === "credit" ? (
                  <div>
                    <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                      Parcelas ({simInstallments}x de R${" "}
                      {((parseFloat(simAmount.replace(",", ".")) || 0) / simInstallments).toFixed(2)})
                    </label>
                    <select
                      value={simInstallments}
                      onChange={(e) => setSimInstallments(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                        <option key={n} value={n}>
                          {n}x de R$ {((parseFloat(simAmount.replace(",", ".")) || 0) / n).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-end">
                    <span className="text-xs text-[#86868B] py-2">
                      Débito imediato da Conta Principal
                    </span>
                  </div>
                )}

                {simMethod === "credit" && creditCards.length > 0 && (
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                      Cartão de Crédito
                    </label>
                    <select
                      value={simCardId}
                      onChange={(e) => setSimCardId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
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

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={executeSimulation}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles size={14} className="text-amber-300" />
                    <span>Perguntar ao Assistente sobre esse Impacto</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Área de Conversa do Assistente (Apple Messages / Siri style) */}
          <section className="bg-white rounded-[26px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.035)] h-[480px] flex flex-col justify-between">
            <div className="overflow-y-auto space-y-4 pr-1 touch-scroll flex-1">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shadow-2xs">
                    <Sparkles size={20} className="text-[#1D1D1F]" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="text-base font-semibold text-[#1D1D1F]">
                      Como posso ajudar suas finanças hoje?
                    </h3>
                    <p className="text-xs text-[#86868B] leading-relaxed">
                      Converse comigo em linguagem natural. Posso simular compras, analisar faturas ou sugerir como economizar com facilidade.
                    </p>
                  </div>

                  {/* Pílulas de Sugestão Apple Style */}
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg pt-2">
                    {quickPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendMessage(prompt)}
                        className="text-xs px-4 py-2 rounded-full bg-white hover:bg-[#F2F2F7] active:scale-95 text-[#1D1D1F] border border-black/[0.06] shadow-2xs transition-all text-left cursor-pointer"
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
                      className={`max-w-[85%] rounded-[22px] p-4 sm:p-4.5 text-xs leading-relaxed space-y-2.5 ${
                        msg.role === "user"
                          ? "bg-[#1D1D1F] text-white rounded-br-xs shadow-xs"
                          : "bg-[#FAFAFC] text-[#1D1D1F] border border-black/[0.04] rounded-bl-xs shadow-2xs"
                      }`}
                    >
                      {/* Cartão de Veredito se houver simulação de compra */}
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
                                ? "Compra Segura"
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
                  <span>O assistente está analisando seus dados...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input de Mensagem estilo Apple */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="mt-3 flex items-center gap-2 border-t border-black/[0.05] pt-3"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Pergunte ao assistente... ex: 'Se eu fizer tal compra, como impacta?'"
                className="flex-1 px-4 py-2.5 rounded-full bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black placeholder:text-[#86868B]"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="w-9 h-9 rounded-full bg-[#1D1D1F] hover:bg-black text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shadow-xs shrink-0 active:scale-95"
              >
                <Send size={15} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
