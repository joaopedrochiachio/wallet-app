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
  HelpCircle,
  Clock,
  Zap,
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
  } = useWallet();

  const [activeTab, setActiveTab] = useState<"diagnosis" | "chat">("diagnosis");

  // Estados do Diagnóstico
  const [diagnosis, setDiagnosis] = useState<FinancialDiagnosis | null>(null);
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

  // Executa o diagnóstico inicial automaticamente quando os dados carregam
  useEffect(() => {
    if (isDataLoaded && !diagnosis && !isAnalyzing && !analysisError) {
      runDiagnosis();
    }
  }, [isDataLoaded]);

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
        }),
      });

      const data = await res.json();
      if (data.success && data.diagnosis) {
        setDiagnosis(data.diagnosis);
        if (data.modelUsed) setAnalysisModel(data.modelUsed);
      } else {
        throw new Error(data.error || "Falha ao gerar diagnóstico.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao conectar com o analista.";
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
        throw new Error(data.error || "Erro ao obter resposta da IA.");
      }
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ Não foi possível obter uma resposta: ${
          err instanceof Error ? err.message : "Falha na conexão"
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
    const amountVal = parseFloat(simAmount.replace(",", "."));
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
          )} parcelado em ${simInstallments}x no ${cardName}, como isso impacta meu orçamento e metas?`
        : `Se eu fizer uma compra à vista de "${simDescription}" no valor de R$ ${amountVal.toFixed(
            2
          )}, como isso afeta meu saldo e planejamento?`;

    setActiveTab("chat");
    setIsSimulatorOpen(false);
    handleSendMessage(promptText, simPayload);
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getPersonaLabel = () => {
    switch (userProfile?.persona) {
      case "optimizer":
        return "🎯 Optimizer";
      case "guardian":
        return "🛡️ Guardian";
      case "scaler":
        return "⚡ Scaler";
      case "minimalist":
        return "🌱 Minimalist";
      default:
        return "🎯 Analista";
    }
  };

  const getHealthBadge = (status?: string) => {
    switch (status) {
      case "excellent":
        return { label: "Excelente", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "healthy":
        return { label: "Saudável", bg: "bg-blue-50 text-blue-700 border-blue-200" };
      case "attention":
        return { label: "Atenção", bg: "bg-amber-50 text-amber-700 border-amber-200" };
      case "critical":
        return { label: "Crítico", bg: "bg-rose-50 text-rose-700 border-rose-200" };
      default:
        return { label: "Calculando...", bg: "bg-gray-100 text-gray-700 border-gray-200" };
    }
  };

  const quickPrompts = [
    "Posso comprar um notebook de R$ 4.500 em 10x?",
    "Como economizar 15% das minhas despesas este mês?",
    "Qual dos meus cartões devo priorizar para novas compras?",
    "Estou no caminho de cumprir minha principal meta financeira?",
  ];

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* 1. TOPO & CABEÇALHO DO ANALISTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 backdrop-blur-xl border border-black/[0.04] p-5 sm:p-6 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1D1D1F] to-[#434346] text-white flex items-center justify-center shadow-md shrink-0">
            <Sparkles size={22} className="text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
                Analista Financeiro IA
              </h1>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-black/5 text-[#1D1D1F] border border-black/5">
                {getPersonaLabel()}
              </span>
            </div>
            <p className="text-xs text-[#86868B] mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Conectado ao Gemini via Cascata Ativa ({analysisModel})
            </p>
          </div>
        </div>

        {/* Alternador de Abas e Botão de Atualização */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-[#F2F2F7] rounded-full border border-black/5">
            <button
              onClick={() => setActiveTab("diagnosis")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "diagnosis"
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Diagnóstico
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "chat"
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Chat & Simulação
            </button>
          </div>

          <button
            onClick={runDiagnosis}
            disabled={isAnalyzing}
            title="Atualizar diagnóstico com dados atuais"
            className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-white hover:bg-black/5 border border-black/5 text-xs font-medium text-[#1D1D1F] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw size={14} className={isAnalyzing ? "animate-spin text-[#86868B]" : ""} />
            <span className="hidden sm:inline">Recalcular</span>
          </button>
        </div>
      </div>

      {/* 2. CONTEÚDO PRINCIPAL BASEADO NA ABA ATIVA */}
      {activeTab === "diagnosis" ? (
        <div className="space-y-6">
          {/* Card de Score e Resumo Executivo */}
          <div className="bg-white/90 backdrop-blur-xl border border-black/[0.04] p-6 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.05] pb-5">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 flex items-center justify-center bg-emerald-50/50">
                    <span className="text-2xl font-extrabold text-[#1D1D1F]">
                      {diagnosis?.healthScore ?? (isAnalyzing ? "..." : 80)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#1D1D1F]">Índice de Saúde Financeira</h2>
                    {diagnosis?.healthStatus && (
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          getHealthBadge(diagnosis.healthStatus).bg
                        }`}
                      >
                        {getHealthBadge(diagnosis.healthStatus).label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#86868B] mt-0.5">
                    Avaliação baseada no fluxo de caixa, cartões e metas cadastradas
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveTab("chat");
                  setIsSimulatorOpen(true);
                }}
                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Calculator size={15} />
                <span>Simulador de Compra</span>
              </button>
            </div>

            {/* Parecer do Analista */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] flex items-center gap-1.5">
                <Zap size={13} className="text-amber-500" />
                Parecer do Analista Executivo
              </span>
              <p className="text-sm text-[#1D1D1F] leading-relaxed font-normal">
                {isAnalyzing
                  ? "Analisando telemetria financeira em tempo real com Gemini Flash..."
                  : diagnosis?.executiveSummary ||
                    "Seu perfil demonstra equilíbrio entre gastos e receitas realizadas. É recomendável manter a taxa de comprometimento monitorada para acelerar a conclusão das suas metas."}
              </p>
            </div>
          </div>

          {/* Grade: Padrões de Gastos & Grupos Futuros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Padrões Detectados */}
            <div className="bg-white/90 backdrop-blur-xl border border-black/[0.04] p-6 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#1D1D1F]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
                    Padrões de Consumo Detectados
                  </h3>
                </div>
                <span className="text-[10px] bg-black/5 px-2 py-0.5 rounded-full text-[#86868B] font-medium">
                  {diagnosis?.spendingPatterns?.length || 0} identificados
                </span>
              </div>

              <div className="space-y-3">
                {isAnalyzing ? (
                  <div className="py-6 text-center text-xs text-[#86868B]">
                    Identificando padrões e anomalias de gastos...
                  </div>
                ) : (
                  diagnosis?.spendingPatterns?.map((pat, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-[#F9F9FB] border border-black/[0.03] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1D1D1F]">{pat.title}</span>
                        {pat.type === "warning" && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Atenção
                          </span>
                        )}
                        {pat.type === "alert" && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Alerta
                          </span>
                        )}
                        {pat.type === "info" && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Info
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#86868B] leading-relaxed">{pat.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Grupos Futuros & Projeções de Fatura */}
            <div className="bg-white/90 backdrop-blur-xl border border-black/[0.04] p-6 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[#1D1D1F]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
                    Projeção de Grupos Futuros
                  </h3>
                </div>
                <span className="text-[10px] bg-black/5 px-2 py-0.5 rounded-full text-[#86868B] font-medium">
                  Próximos ciclos
                </span>
              </div>

              <div className="space-y-3">
                {isAnalyzing ? (
                  <div className="py-6 text-center text-xs text-[#86868B]">
                    Projetando faturas e recorrências futuras...
                  </div>
                ) : (
                  diagnosis?.futureProjections?.map((proj, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-[#F9F9FB] border border-black/[0.03] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1D1D1F]">{proj.period}</span>
                        <span className="text-[10px] font-medium text-[#86868B]">Faturas & Fixos</span>
                      </div>
                      <p className="text-xs text-[#86868B] leading-relaxed">{proj.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sugestões e Oportunidades de Melhoria */}
          <div className="bg-white/90 backdrop-blur-xl border border-black/[0.04] p-6 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
                Recomendações e Melhorias Práticas
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {diagnosis?.actionableSuggestions?.map((sug, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-2 hover:border-black/15 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#1D1D1F]">{sug.title}</h4>
                      {sug.potentialGain && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {sug.potentialGain}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#86868B] leading-relaxed">{sug.action}</p>
                  </div>

                  {sug.targetGoal && (
                    <div className="pt-2 flex items-center justify-between border-t border-black/[0.04] text-[11px] text-[#86868B]">
                      <span>Meta: {sug.targetGoal}</span>
                      <button
                        onClick={() => {
                          setActiveTab("chat");
                          handleSendMessage(`Como posso implementar a recomendação "${sug.title}"?`);
                        }}
                        className="text-xs font-semibold text-[#1D1D1F] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Aprofundar</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ABA 2: CHAT DO ANALISTA & SIMULADOR DE COMPRA */
        <div className="space-y-4">
          {/* Card Flutuante / Botão do Simulador de Compra */}
          <div className="bg-white/90 backdrop-blur-xl border border-black/[0.04] p-4 sm:p-5 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center">
                  <Calculator size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F]">
                    Simulador de Impacto de Compra
                  </h3>
                  <p className="text-[11px] text-[#86868B]">
                    Projete o impacto exato no saldo, faturas e metas antes de gastar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#F2F2F7] hover:bg-black/10 text-[#1D1D1F] transition-colors cursor-pointer"
              >
                {isSimulatorOpen ? "Recolher" : "Configurar Compra"}
              </button>
            </div>

            {isSimulatorOpen && (
              <div className="pt-3 border-t border-black/[0.05] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-300">
                <div>
                  <label className="text-[11px] font-medium text-[#86868B] block mb-1">
                    Descrição do Item
                  </label>
                  <input
                    type="text"
                    value={simDescription}
                    onChange={(e) => setSimDescription(e.target.value)}
                    placeholder="Ex: Notebook novo"
                    className="w-full px-3 py-2 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#86868B] block mb-1">
                    Valor da Compra (R$)
                  </label>
                  <input
                    type="text"
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                    placeholder="Ex: 1500"
                    className="w-full px-3 py-2 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#86868B] block mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={simMethod}
                    onChange={(e) => setSimMethod(e.target.value as "cash" | "credit")}
                    className="w-full px-3 py-2 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                  >
                    <option value="credit">Cartão de Crédito</option>
                    <option value="cash">À vista (Débito / PIX)</option>
                  </select>
                </div>

                {simMethod === "credit" ? (
                  <div>
                    <label className="text-[11px] font-medium text-[#86868B] block mb-1">
                      Parcelas ({simInstallments}x de R${" "}
                      {((parseFloat(simAmount) || 0) / simInstallments).toFixed(2)})
                    </label>
                    <select
                      value={simInstallments}
                      onChange={(e) => setSimInstallments(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                        <option key={n} value={n}>
                          {n}x de R$ {((parseFloat(simAmount) || 0) / n).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-end">
                    <span className="text-xs text-[#86868B] py-2">
                      Débito imediato da conta corrente
                    </span>
                  </div>
                )}

                {simMethod === "credit" && creditCards.length > 0 && (
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-medium text-[#86868B] block mb-1">
                      Qual Cartão Usar?
                    </label>
                    <select
                      value={simCardId}
                      onChange={(e) => setSimCardId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
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
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles size={14} className="text-amber-300" />
                    <span>Perguntar ao Analista sobre esse Impacto</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Área das Mensagens do Chat */}
          <div className="bg-white/90 backdrop-blur-xl border border-black/[0.04] p-5 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] h-[460px] flex flex-col justify-between">
            <div className="overflow-y-auto space-y-4 pr-1 touch-scroll flex-1">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h4 className="text-sm font-bold text-[#1D1D1F]">
                      Converse com seu Analista Financeiro
                    </h4>
                    <p className="text-xs text-[#86868B] leading-relaxed">
                      Pergunte sobre compras planejadas, estratégias de economia, antecipação de
                      faturas ou formas de acelerar suas metas.
                    </p>
                  </div>

                  {/* Pílulas de Perguntas Rápidas */}
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg pt-2">
                    {quickPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendMessage(prompt)}
                        className="text-xs px-3.5 py-1.5 rounded-full bg-[#F2F2F7] hover:bg-black/5 text-[#1D1D1F] border border-black/5 transition-all text-left cursor-pointer"
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
                      className={`max-w-[85%] rounded-[20px] p-4 text-xs leading-relaxed space-y-2.5 ${
                        msg.role === "user"
                          ? "bg-[#1D1D1F] text-white rounded-br-xs"
                          : "bg-[#F9F9FB] text-[#1D1D1F] border border-black/[0.04] rounded-bl-xs"
                      }`}
                    >
                      {/* Veredito de Simulação se houver */}
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
                            {msg.simulationResult.verdict === "safe" ? (
                              <CheckCircle2 size={14} className="text-emerald-600" />
                            ) : (
                              <AlertTriangle size={14} className="text-amber-600" />
                            )}
                            <span>
                              Veredito Matemático:{" "}
                              {msg.simulationResult.verdict.toUpperCase()}
                            </span>
                          </div>
                          <p>{msg.simulationResult.verdictMessage}</p>
                          <div className="pt-1 text-[10px] opacity-85">
                            Comprometimento: {msg.simulationResult.before.monthlyCommitmentPercent}%
                            ➔ {msg.simulationResult.after.monthlyCommitmentPercent}%
                          </div>
                        </div>
                      )}

                      <div className="whitespace-pre-line">{msg.content}</div>

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
                <div className="flex items-center gap-2 p-3 text-xs text-[#86868B] bg-[#F9F9FB] rounded-2xl w-fit">
                  <RefreshCw size={14} className="animate-spin text-[#1D1D1F]" />
                  <span>O analista está calculando o impacto...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input de Mensagem */}
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
                placeholder="Pergunte ao analista... ex: 'Se eu comprar tal coisa, como impacta?'"
                className="flex-1 px-4 py-2.5 rounded-full bg-[#F2F2F7] text-xs font-medium text-[#1D1D1F] border border-black/5 focus:outline-none focus:ring-1 focus:ring-black"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="w-9 h-9 rounded-full bg-[#1D1D1F] hover:bg-black text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shadow-xs shrink-0"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
