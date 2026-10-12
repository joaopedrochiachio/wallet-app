"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  Target,
  RefreshCw,
} from "lucide-react";
import { FormattedMessage } from "./FormattedMessage";
import type { PurchaseSimulationResult } from "@/lib/services/financialContextService";

export interface SiriChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  modelUsed?: string;
  simulationResult?: PurchaseSimulationResult | null;
}

interface SiriFinancialAssistantProps {
  userName?: string;
  targetEndMonthBalance: number;
  projectedFreeBalance: number;
  safeSpendingMargin: number;
  missingAmount: number;
  targetStatus: "on_track" | "at_risk";
  messages: SiriChatMessage[];
  isSending: boolean;
  onSendMessage: (text?: string) => void;
  onNewChat: () => void;
  onClearChat: () => void;
  onOpenSimulator: () => void;
  onScrollToDiagnosis?: () => void;
}

export function SiriFinancialAssistant({
  userName = "você",
  targetEndMonthBalance,
  projectedFreeBalance,
  safeSpendingMargin,
  missingAmount,
  targetStatus,
  messages,
  isSending,
  onSendMessage,
  onNewChat,
  onClearChat,
  onOpenSimulator,
  onScrollToDiagnosis,
}: SiriFinancialAssistantProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceWaveLevel, setVoiceWaveLevel] = useState(1);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const firstName = userName.split(" ")[0] || "você";

  const isTargetMet = targetStatus === "on_track";

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Micro-animação simulando a onda de voz da Siri quando o microfone está ativo
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => {
      setVoiceWaveLevel(Math.floor(Math.random() * 4) + 1);
    }, 180);
    return () => clearInterval(interval);
  }, [isListening]);

  // Auto-scroll suave para a última mensagem
  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;
    const text = inputMessage;
    setInputMessage("");
    setIsListening(false);
    onSendMessage(text);
  };

  const quickPrompts = [
    `Como fechar o mês na meta de R$ ${formatCurrency(targetEndMonthBalance)} positivo?`,
    "Quais foram os maiores vilões do meu orçamento recente?",
    "Quanto posso gastar com segurança hoje?",
    "Simular compra parcelada no cartão",
  ];

  return (
    <div className="w-full rounded-[32px] bg-white/80 backdrop-blur-2xl border border-black/[0.06] shadow-[0_12px_40px_rgba(0,0,0,0.04)] overflow-hidden relative transition-all">
      {/* =========================================================
          SIRI AMBIENT GLOWING AURA (Top Dynamic Mesh)
         ========================================================= */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[550px] h-[220px] bg-gradient-to-r from-cyan-400/15 via-fuchsia-500/15 to-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-0 animate-pulse duration-1000" />

      {/* =========================================================
          1. HEADER CONVERSACIONAL APPLE SIRI COM ORBE VIVO
         ========================================================= */}
      <header className="px-5 sm:px-7 pt-6 pb-4 border-b border-black/[0.04] relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Bloco Siri Orb & Saudação */}
        <div className="flex items-center gap-4 min-w-0">
          {/* O ORBE SIRI (Multi-Camada Animada com Efeito Gradiente Vivo) */}
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
            {/* Halo de Brilho Externo */}
            <div
              className={`absolute inset-0 rounded-full blur-md opacity-75 transition-all duration-700 ${
                isSending || isListening
                  ? "bg-gradient-to-tr from-cyan-500 via-fuchsia-500 to-amber-400 animate-spin"
                  : "bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 animate-pulse"
              }`}
            />

            {/* Núcleo do Orbe Líquido Siri */}
            <div className="relative w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#311042] p-0.5 shadow-inner flex items-center justify-center overflow-hidden border border-white/20">
              {/* Ondas Fluidas Internas */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-400/40 via-fuchsia-500/40 to-transparent animate-pulse" />
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-purple-500/30 blur-xs animate-spin duration-3000" />

              {/* Ícone Siri Central */}
              <div className="relative z-10 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]">
                <Sparkles size={18} className={isSending ? "animate-spin text-purple-200" : "text-white"} />
              </div>
            </div>

            {/* Micro Ponto Pulsante de Status Online */}
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-2xs" />
          </div>

          {/* Textos de Status da Siri */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[#1D1D1F]">
                Analista Siri
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#1D1D1F] text-white shadow-2xs">
                Wallet+ AI
              </span>
            </div>

            <p className="text-xs text-[#86868B] truncate">
              {isSending
                ? "Processando livro-caixa e projeções contábeis..."
                : isListening
                ? "Siri ouvindo... pode falar."
                : `Olá, ${firstName}. Pronto para auditar suas metas e fluxo de caixa.`}
            </p>
          </div>
        </div>

        {/* Status da Meta & Controles Rápidos */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Pill de Meta Ativa */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
              isTargetMet
                ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-800 border-amber-500/20"
            }`}
          >
            <Target size={11} className={isTargetMet ? "text-emerald-600" : "text-amber-600"} />
            <span>
              Meta: fechar com +R$ {formatCurrency(targetEndMonthBalance)} (
              {isTargetMet ? `+R$ ${formatCurrency(safeSpendingMargin)} livre` : `faltam R$ ${formatCurrency(missingAmount)}`})
            </span>
          </div>

          {/* Botão Nova Conversa */}
          <button
            type="button"
            onClick={onNewChat}
            className="p-1.5 rounded-full bg-white hover:bg-[#F2F2F7] active:scale-95 border border-black/[0.06] text-[#1D1D1F] transition-all cursor-pointer shadow-2xs"
            title="Iniciar nova conversa limpa"
          >
            <Plus size={14} />
          </button>

          {/* Botão Limpar Conversa se houver mensagens */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              className="p-1.5 rounded-full bg-white hover:bg-rose-50 active:scale-95 border border-black/[0.06] text-[#86868B] hover:text-rose-600 transition-all cursor-pointer shadow-2xs"
              title="Limpar histórico desta conversa"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* Atalho para descer ao dashboard de análise */}
          {onScrollToDiagnosis && (
            <button
              type="button"
              onClick={onScrollToDiagnosis}
              className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] px-3 py-1 rounded-full transition-all cursor-pointer border border-black/[0.04]"
              title="Ir para o visual do diagnóstico abaixo"
            >
              <span>Ver Visual da Análise</span>
              <ArrowDown size={11} />
            </button>
          )}
        </div>
      </header>

      {/* =========================================================
          2. FEED DE CONVERSA SIRI (MESSAGES CONTAINER)
         ========================================================= */}
      <div className="p-4 sm:p-6 min-h-[340px] max-h-[460px] overflow-y-auto space-y-4 touch-scroll relative z-10">
        {messages.length === 0 ? (
          /* ESTADO INICIAL SIRI (Boas-vindas Elegante + Prompts Táticos) */
          <div className="h-full py-8 flex flex-col items-center justify-center text-center space-y-5">
            {/* Orbe Siri Grande Centrado */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full blur-xl bg-gradient-to-tr from-cyan-400/40 via-purple-500/40 to-pink-500/40 animate-pulse" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-[#0F172A] via-[#1E1B4B] to-[#3B0764] flex items-center justify-center border border-white/25 shadow-lg">
                <Sparkles size={28} className="text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
              </div>
            </div>

            <div className="max-w-md space-y-1.5">
              <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-[#1D1D1F]">
                Como posso ajudar hoje, {firstName}?
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                Audito estritamente seus números: saldo em conta, faturas abertas, contas fixas e o caminho exato para fechar o mês com{" "}
                <span className="font-semibold text-[#1D1D1F]">R$ {formatCurrency(targetEndMonthBalance)} positivo</span>.
              </p>
            </div>

            {/* Quick Action Pills Siri */}
            <div className="flex flex-wrap gap-2 justify-center max-w-xl pt-2">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSendMessage(prompt)}
                  className="text-xs px-3.5 py-2 rounded-full bg-white/90 hover:bg-[#F2F2F7] active:scale-95 text-[#1D1D1F] border border-black/[0.06] shadow-xs transition-all text-left cursor-pointer break-words max-w-full font-medium"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* MENSAGENS EM FORMATO APPLE INTELLIGENCE / MESSAGES */
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} space-y-1`}
            >
              {/* Badge de Remetente com Ícone */}
              <div className="flex items-center gap-1.5 px-2 text-[10px] text-[#86868B]">
                {msg.role === "assistant" ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500" />
                    <span className="font-semibold text-[#1D1D1F]">Siri</span>
                  </>
                ) : (
                  <span>Você</span>
                )}
                <span>• {msg.timestamp}</span>
              </div>

              {/* Balão de Mensagem */}
              <div
                className={`max-w-[94%] sm:max-w-[85%] rounded-[24px] p-4 sm:p-5 text-xs leading-relaxed space-y-3 ${
                  msg.role === "user"
                    ? "bg-[#1D1D1F] text-white rounded-br-xs shadow-xs selection:bg-white selection:text-black"
                    : "bg-white/95 text-[#1D1D1F] border border-black/[0.06] rounded-bl-xs shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
                }`}
              >
                {/* Cartão de Veredito Apple Pass para Simulação de Compra */}
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
                          ? "Compra Viável no Orçamento"
                          : msg.simulationResult.verdict === "warning"
                          ? "Atenção no Orçamento"
                          : "Alerta de Comprometimento"}
                      </span>
                    </div>
                    <p className="leading-relaxed">{msg.simulationResult.verdictMessage}</p>
                    <div className="pt-1 text-[10px] opacity-85 border-t border-black/5 flex items-center justify-between">
                      <span>{msg.simulationResult.impactSummary}</span>
                      <span>{msg.simulationResult.installments}x</span>
                    </div>
                  </div>
                )}

                <FormattedMessage content={msg.content} role={msg.role} />
              </div>
            </div>
          ))
        )}

        {/* Feedback visual de digitação / cálculo contábil */}
        {isSending && (
          <div className="flex items-center gap-2 p-3 text-xs text-[#1D1D1F] bg-white/90 rounded-2xl w-fit border border-black/[0.06] shadow-2xs">
            <RefreshCw size={13} className="animate-spin text-purple-600 shrink-0" />
            <span className="font-medium">Siri auditando fluxo de caixa e impacto na meta...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* =========================================================
          3. SIRI FLOATING INPUT BAR (Cápsula Apple Intelligence)
         ========================================================= */}
      <footer className="p-3 sm:p-4 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-black/[0.05] relative z-10">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 relative">
          {/* Botão Simulador de Compra */}
          <button
            type="button"
            onClick={onOpenSimulator}
            className="w-10 h-10 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-95 text-[#1D1D1F] flex items-center justify-center transition-all cursor-pointer border border-black/[0.04] shrink-0"
            title="Abrir Simulador de Compra Parcelada"
          >
            <Calculator size={16} />
          </button>

          {/* Input Cápsula com Efeito Vidro Líquido */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                isListening
                  ? "Siri ouvindo... pode falar."
                  : "Converse com a Siri sobre sua meta de R$ " + formatCurrency(targetEndMonthBalance) + ", gastos e compras..."
              }
              className={`w-full pl-4 pr-11 py-3 rounded-full text-xs font-medium text-[#1D1D1F] border transition-all ${
                isListening
                  ? "bg-purple-50/80 border-purple-300 ring-2 ring-purple-200 placeholder:text-purple-600"
                  : "bg-[#F2F2F7] border-black/5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 placeholder:text-[#86868B]"
              }`}
            />

            {/* Botão Microfone / Onda Sonora Interativa */}
            <button
              type="button"
              onClick={() => setIsListening(!isListening)}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isListening
                  ? "bg-gradient-to-tr from-cyan-500 to-purple-600 text-white animate-pulse"
                  : "text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5"
              }`}
              title={isListening ? "Desativar microfone" : "Falar com a Siri"}
            >
              {isListening ? (
                <div className="flex items-center gap-0.5 h-3">
                  <span className="w-0.5 bg-white rounded-full animate-bounce h-2" />
                  <span className="w-0.5 bg-white rounded-full animate-bounce h-3.5 delay-100" />
                  <span className="w-0.5 bg-white rounded-full animate-bounce h-1.5 delay-200" />
                </div>
              ) : (
                <Mic size={14} />
              )}
            </button>
          </div>

          {/* Botão Enviar Mensagem */}
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            className="w-10 h-10 rounded-full bg-[#1D1D1F] hover:bg-black active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer shadow-xs shrink-0"
            title="Enviar para a Siri"
          >
            <Send size={15} />
          </button>
        </form>
      </footer>
    </div>
  );
}
