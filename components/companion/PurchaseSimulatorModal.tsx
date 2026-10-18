"use client";

import React, { useState, useMemo } from "react";
import { useWallet } from "@/context/WalletContext";
import { simulatePurchaseDecision } from "@/lib/services/dailyCompanionService";
import { AgentAvatar } from "./AgentAvatar";
import {
  X,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  CreditCard,
  Banknote,
  CheckCircle2,
} from "lucide-react";

interface PurchaseSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterTransaction?: () => void;
}

export function PurchaseSimulatorModal({
  isOpen,
  onClose,
  onRegisterTransaction,
}: PurchaseSimulatorModalProps) {
  const {
    cards,
    userProfile,
    mainBalance,
    monthExpense,
    getMonthlyProjection,
    addTransaction,
  } = useWallet();

  const [title, setTitle] = useState("Compra simulada");
  const [amountStr, setAmountStr] = useState("250");
  const [isCredit, setIsCredit] = useState(true);
  const [installments, setInstallments] = useState(3);
  const [selectedCardId, setSelectedCardId] = useState<string>(() => cards[0]?.id || "");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  // Projeção atual de saldo livre
  const currentMonthProj = getMonthlyProjection(0);
  const effectiveProjectedFree =
    currentMonthProj?.projectedFreeBalance ?? (mainBalance - monthExpense);
  const targetEndMonthBalance = userProfile?.targetMonthEndBalance || 700;

  const selectedCard = cards.find((c) => c.id === selectedCardId) || cards[0];
  const cardLimitAvailable = selectedCard?.limit
    ? selectedCard.limit - (selectedCard.spent || 0)
    : Infinity;

  const numericAmount = parseFloat(amountStr.replace(",", ".")) || 0;

  // Executa o cálculo da simulação
  const simulation = useMemo(() => {
    return simulatePurchaseDecision({
      amount: numericAmount,
      installments: isCredit ? installments : 1,
      isCredit,
      projectedFreeBalance: effectiveProjectedFree,
      targetEndMonthBalance,
      cardLimitAvailable,
    });
  }, [
    numericAmount,
    installments,
    isCredit,
    effectiveProjectedFree,
    targetEndMonthBalance,
    cardLimitAvailable,
  ]);

  if (!isOpen) return null;

  const handleRegisterReal = async () => {
    if (numericAmount <= 0 || isRegistering) return;
    setIsRegistering(true);

    try {
      await addTransaction({
        title: title.trim() || "Compra aprovada no simulador",
        amount: numericAmount,
        type: "despesa",
        category: "Compras",
        account: isCredit && selectedCard ? selectedCard.name : "Débito/Pix",
        cardId: isCredit && selectedCard ? selectedCard.id : null,
        date: new Date().toISOString().split("T")[0],
        occurredAt: new Date().toISOString(),
        installmentsCount: isCredit ? installments : 1,
      });

      setRegisteredSuccess(true);
      if (onRegisterTransaction) onRegisterTransaction();

      setTimeout(() => {
        setIsRegistering(false);
        setRegisteredSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Erro ao registrar compra da simulação:", err);
      setIsRegistering(false);
    }
  };

  const verdictStyles = {
    approved: {
      bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
      badge: "bg-emerald-600 text-white",
      icon: <ShieldCheck size={20} className="text-emerald-600" />,
      avatarState: "celebrating" as const,
    },
    warning: {
      bg: "bg-amber-50 border-amber-200 text-amber-900",
      badge: "bg-amber-600 text-white",
      icon: <AlertTriangle size={20} className="text-amber-600" />,
      avatarState: "warning" as const,
    },
    danger: {
      bg: "bg-rose-50 border-rose-200 text-rose-900",
      badge: "bg-rose-600 text-white",
      icon: <AlertOctagon size={20} className="text-rose-600" />,
      avatarState: "alert" as const,
    },
  }[simulation.verdict];

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center items-end justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90dvh] pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Pull Indicator para Mobile PWA */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mt-2.5 sm:hidden relative z-20 shrink-0" />

        {/* Glow Superior */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-blue-500/10 via-indigo-500/5 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-black/[0.05] relative z-10">
          <div className="flex items-center gap-3">
            <AgentAvatar
              persona={userProfile.persona || "guardian"}
              state={verdictStyles.avatarState}
              size="md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Simulador de Decisão
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                  Devo Comprar?
                </span>
              </div>
              <h2 className="text-base font-bold text-[#1D1D1F]">
                Análise de Impacto Instantânea
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-5 relative z-10 max-h-[80vh] overflow-y-auto">
          {registeredSuccess ? (
            <div className="py-8 text-center space-y-3 animate-in zoom-in duration-300">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1D1D1F]">
                  Compra Lançada com Sucesso!
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Atualizamos o saldo projetado e sua agenda de faturas.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Formulário Interativo de Parâmetros */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#86868B] block mb-1">
                      O que você quer comprar?
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Tênis esportivo"
                      className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl bg-[#F2F2F7] border border-black/5 focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#86868B] block mb-1">
                      Valor total (R$)
                    </label>
                    <input
                      type="text"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      placeholder="Ex: 350,00"
                      className="w-full text-sm font-semibold px-3.5 py-2.5 rounded-xl bg-[#F2F2F7] border border-black/5 focus:bg-white focus:border-blue-500 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[#86868B] block">
                    Forma de pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCredit(false)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        !isCredit
                          ? "bg-[#1D1D1F] text-white border-black"
                          : "bg-white text-[#1D1D1F] border-black/10 hover:bg-[#F2F2F7]"
                      }`}
                    >
                      <Banknote size={14} />
                      <span>À vista (Pix / Débito)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCredit(true)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        isCredit
                          ? "bg-[#1D1D1F] text-white border-black"
                          : "bg-white text-[#1D1D1F] border-black/10 hover:bg-[#F2F2F7]"
                      }`}
                    >
                      <CreditCard size={14} />
                      <span>Cartão de Crédito</span>
                    </button>
                  </div>
                </div>

                {/* Se crédito: parcelas e cartão */}
                {isCredit && (
                  <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1D1D1F]">
                        Parcelar em: {installments}x de R${" "}
                        {(numericAmount / Math.max(1, installments)).toFixed(2)}
                      </span>
                      <span className="text-[11px] text-[#86868B]">
                        {installments === 1 ? "1x (Sem parcelar)" : `${installments} parcelas`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={installments}
                      onChange={(e) => setInstallments(parseInt(e.target.value, 10))}
                      className="w-full accent-[#1D1D1F] cursor-pointer"
                    />

                    {cards.length > 0 && (
                      <div className="pt-1">
                        <label className="text-[10px] font-semibold text-[#86868B] block mb-1">
                          Selecionar Cartão:
                        </label>
                        <select
                          value={selectedCardId}
                          onChange={(e) => setSelectedCardId(e.target.value)}
                          className="w-full text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white border border-black/10"
                        >
                          {cards.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} (Disp: R${" "}
                              {((c.limit || 0) - (c.spent || 0)).toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CARD DE VEREDITO INTELIGENTE */}
              <div className={`p-4 rounded-2xl border ${verdictStyles.bg} space-y-2.5`}>
                <div className="flex items-center gap-2">
                  {verdictStyles.icon}
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {simulation.headline}
                  </span>
                </div>

                <p className="text-xs leading-relaxed">{simulation.explanation}</p>

                {/* Métricas de Impacto */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-black/5 text-[11px]">
                  <div>
                    <span className="text-[#86868B] block text-[10px]">Teto diário novo</span>
                    <strong className="font-mono text-xs">
                      R$ {simulation.newSafeDailyAllowance.toFixed(2)}/dia
                    </strong>
                  </div>

                  <div>
                    <span className="text-[#86868B] block text-[10px]">Impacto no dia</span>
                    <strong className="font-mono text-xs text-rose-600">
                      -R$ {simulation.dailyReduction.toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[#86868B] block text-[10px]">Sobrará no mês</span>
                    <strong
                      className={`font-mono text-xs ${
                        simulation.impactOnMonthlyTarget >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      R$ {(targetEndMonthBalance + simulation.impactOnMonthlyTarget).toFixed(2)}
                    </strong>
                  </div>
                </div>

                <div className="pt-1 text-[11px] font-medium text-[#1D1D1F] bg-white/60 p-2.5 rounded-xl border border-black/[0.04]">
                  💡 <strong>Conselho do Guardião:</strong> {simulation.recommendation}
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-black/10 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={handleRegisterReal}
                  disabled={numericAmount <= 0 || isRegistering}
                  className="flex-2 py-3 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.99] cursor-pointer"
                >
                  <span>Registrar compra agora</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
