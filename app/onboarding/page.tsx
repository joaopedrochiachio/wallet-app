"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { saveUserProfile } from "@/lib/services/userService";
import { saveCardToFirestore } from "@/lib/services/cardsService";
import { FinancialPersonaId, CardItem } from "@/types";
import {
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Compass,
  Loader2,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Etapa 1: Dados Pessoais
  const [name, setName] = useState("");
  const [role, setRole] = useState("Investidor & Especialista");
  const [monthlyIncome, setMonthlyIncome] = useState("5.000,00");

  // Etapa 2: Arquétipo Financeiro
  const [persona, setPersona] = useState<FinancialPersonaId>("optimizer");

  // Etapa 3: Primeiro Cartão/Conta
  const [cardName, setCardName] = useState("Minha Conta Principal");
  const [initialAmount, setInitialAmount] = useState("2.500,00");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#86868B]" size={24} />
      </div>
    );
  }

  const PERSONAS = [
    {
      id: "optimizer" as FinancialPersonaId,
      name: "Otimizador",
      subtitle: "Milhas, Cashback & Prazos",
      desc: "Concentra gastos no crédito, maximiza pontos e paga faturas no dia exato do vencimento.",
      icon: TrendingUp,
      accent: "text-amber-500",
    },
    {
      id: "guardian" as FinancialPersonaId,
      name: "Guardião",
      subtitle: "Previsibilidade & Reserva",
      desc: "Prioriza manter o saldo da conta corrente intocado e constrói reserva sólida de emergência.",
      icon: ShieldCheck,
      accent: "text-emerald-500",
    },
    {
      id: "scaler" as FinancialPersonaId,
      name: "Escalonador",
      subtitle: "Crescimento & Risco Calculado",
      desc: "Foco em alocar a maior parcela possível da renda em ativos e expansão patrimonial.",
      icon: Compass,
      accent: "text-blue-500",
    },
    {
      id: "minimalist" as FinancialPersonaId,
      name: "Minimalista",
      subtitle: "Despesas Enxutas & Sem Débitos",
      desc: "Evita parcelamentos desnecessários e mantém poucas contas ativas com total clareza.",
      icon: Sliders,
      accent: "text-purple-500",
    },
  ];

  const parseNumber = (str: string) => {
    const clean = parseFloat(str.replace(/\./g, "").replace(",", "."));
    return isNaN(clean) ? 0 : clean;
  };

  const handleFinish = async () => {
    if (!user) return;
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const cleanIncome = parseNumber(monthlyIncome);
      const cleanAmount = parseNumber(initialAmount);

      const parts = name.trim().split(" ");
      const initials =
        parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : name.slice(0, 2).toUpperCase() || "WI";

      // 1. Salvar Perfil do Usuário
      await saveUserProfile(user.uid, {
        name: name.trim() || "Usuário",
        email: user.email || "",
        role: role.trim() || "Membro",
        avatarInitials: initials,
        monthlyIncomeBase: cleanIncome,
        currency: "BRL",
        persona,
        riskTolerance: persona === "guardian" ? "low" : persona === "scaler" ? "high" : "moderate",
        aiTone: "analytical",
        maxCommitmentAlertPercent: 35,
        primaryFocus:
          persona === "optimizer"
            ? "Otimização de Cartões e Fluxo de Caixa"
            : persona === "guardian"
            ? "Construção de Reserva de Emergência"
            : persona === "scaler"
            ? "Aceleração de Investimentos"
            : "Controle Essencial de Gastos",
        isOnboarded: true,
      });

      // 2. Criar Primeiro Cartão no Firestore
      const firstCard: CardItem = {
        id: `card-${Date.now()}`,
        name: cardName.trim() || "Conta Principal",
        brand: "Conta",
        type: "checking",
        balance: cleanAmount,
        openingBalance: cleanAmount,
        limit: 0,
        spent: 0,
        invoiceAmount: 0,
        closingDay: 10,
        dueDay: 18,
        colorScheme: {
          gradient: "from-[#1D1D1F] via-[#121214] to-[#0A0A0C]",
          border: "border-white/10",
          accent: "text-gray-300",
          badgeText: "Conta Principal",
          chipGradient: "from-amber-200 to-yellow-500",
        },
      };

      await saveCardToFirestore(user.uid, firstCard);

      // 3. Redirecionar ao Dashboard
      router.replace("/dashboard");
    } catch (err: unknown) {
      console.error("Erro ao finalizar onboarding:", err);
      setErrorMessage(err instanceof Error ? err.message : "Ocorreu um erro ao salvar suas informações. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col justify-between items-center px-4 py-8 md:py-12 font-sans selection:bg-[#1D1D1F] selection:text-white">
      {/* Top Header com Indicador de Passos */}
      <div className="w-full max-w-xl flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo2.png"
            alt="Wallet Logo"
            width={34}
            height={34}
            className="rounded-xl object-contain shadow-xs shrink-0"
            priority
          />
          <span className="font-semibold text-sm text-[#1D1D1F]">Configuração Inicial</span>
        </div>

        {/* Indicador de 3 Etapas */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step
                  ? "w-8 bg-[#1D1D1F]"
                  : s < step
                  ? "w-4 bg-gray-400"
                  : "w-4 bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Container Principal do Card de Onboarding */}
      <div className="w-full max-w-xl bg-white rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] border border-black/[0.04] p-7 md:p-10 space-y-8 my-auto animate-in fade-in duration-300">
        {errorMessage && (
          <div className="bg-red-50 text-red-600 border border-red-200/60 rounded-xl px-4 py-2.5 text-xs font-medium animate-in fade-in duration-200">
            {errorMessage}
          </div>
        )}
        
        {/* Etapa 1: Dados Pessoais & Renda */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B]">
                Passo 1 de 3
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                Como devemos chamar você?
              </h2>
              <p className="text-xs text-[#86868B] max-w-md mx-auto">
                Essas informações personalizam o seu Wallet ID e ajustam a base do seu fluxo mensal.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1">
                  Seu Nome Completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none border border-transparent focus:border-black/10 transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1">
                  Profissão / Cargo
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Ex: Designer, Desenvolvedor, Médico..."
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none border border-transparent focus:border-black/10 transition-all"
                />
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1 block text-center">
                  Renda Líquida Mensal Estimada
                </label>
                <div className="flex justify-center items-baseline gap-1.5">
                  <span className="text-xl font-medium text-gray-400">R$</span>
                  <input
                    type="text"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    placeholder="5.000,00"
                    className="text-4xl font-light text-[#1D1D1F] text-center w-56 outline-none bg-transparent"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!name.trim()) {
                  alert("Por favor, digite seu nome.");
                  return;
                }
                setStep(2);
              }}
              className="w-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm py-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span>Continuar para Arquétipo</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Etapa 2: Arquétipo Financeiro */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B]">
                Passo 2 de 3
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                Qual é o seu perfil financeiro?
              </h2>
              <p className="text-xs text-[#86868B] max-w-md mx-auto">
                O motor do Wallet adapta relatórios e avisos ao seu comportamento de consumo.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PERSONAS.map((p) => {
                const isSelected = persona === p.id;
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersona(p.id)}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? "border-[#1D1D1F] bg-[#F2F2F7]/80 shadow-xs ring-1 ring-[#1D1D1F]"
                        : "border-black/[0.06] bg-white hover:bg-[#F2F2F7]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="w-8 h-8 rounded-xl bg-white border border-black/5 flex items-center justify-center shadow-2xs">
                        <Icon size={16} className={p.accent} strokeWidth={1.5} />
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={16} className="text-[#1D1D1F]" />
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[#1D1D1F]">
                        {p.name}
                      </h3>
                      <p className="text-[11px] font-medium text-[#86868B]">
                        {p.subtitle}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                        {p.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 bg-[#F2F2F7] hover:bg-gray-200 text-[#1D1D1F] font-semibold text-sm py-4 rounded-2xl transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-2/3 bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm py-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <span>Continuar para Carteira</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Etapa 3: Primeiro Cartão ou Conta */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B]">
                Passo 3 de 3
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                Configure sua conta principal
              </h2>
              <p className="text-xs text-[#86868B] max-w-md mx-auto">
                Informe onde fica seu saldo. Cartões de crédito podem ser adicionados depois.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1">
                  Nome do Cartão ou Banco
                </label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Ex: Nubank, Itaú, conta principal..."
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none border border-transparent focus:border-black/10 transition-all"
                />
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1 block text-center">
                  Quanto você tem na conta hoje?
                </label>
                <div className="flex justify-center items-baseline gap-1.5">
                  <span className="text-xl font-medium text-gray-400">R$</span>
                  <input
                    type="text"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                    placeholder="2.500,00"
                    className="text-4xl font-light text-[#1D1D1F] text-center w-56 outline-none bg-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="w-1/3 bg-[#F2F2F7] hover:bg-gray-200 text-[#1D1D1F] font-semibold text-sm py-4 rounded-2xl transition-all cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinish}
                className="w-2/3 bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm py-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Configurando Carteira...</span>
                  </>
                ) : (
                  <>
                    <span>Concluir e Acessar</span>
                    <CheckCircle2 size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-[#86868B]">
        Seus dados permanecem criptografados e acessíveis apenas pelo seu Wallet ID.
      </div>
    </div>
  );
}
