"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import {
  saveUserProfile,
  checkIsUserOnboarded,
  markUserOnboardedLocal,
} from "@/lib/services/userService";
import { saveCardToFirestore } from "@/lib/services/cardsService";
import { sanitizeTextInput, validateCurrency } from "@/lib/utils/security";
import { CURRENT_LEDGER_BALANCE_VERSION } from "@/lib/utils/ledger";
import { FinancialPersonaId, CardItem } from "@/types";
import { StatementImportModal } from "@/components/import/StatementImportModal";
import { ONBOARDING_DIRECT_STEPS } from "@/lib/utils/tutorialData";
import {
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Compass,
  Loader2,
  FileText,
  Sparkles,
  BookOpen,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [importedSummary, setImportedSummary] = useState<{
    cardsCount: number;
    recurringCount: number;
    transactionsCount: number;
    institutionName: string;
  } | null>(null);

  // Etapa 1: Dados Pessoais
  const [name, setName] = useState("");
  const [role, setRole] = useState("Investidor & Especialista");
  const [monthlyIncome, setMonthlyIncome] = useState("5.000,00");

  // Etapa 2: Arquétipo Financeiro
  const [persona, setPersona] = useState<FinancialPersonaId>("optimizer");

  // Etapa 3: Primeiro Cartão/Conta
  const [cardName, setCardName] = useState("Minha Conta Principal");
  const [initialAmount, setInitialAmount] = useState("2.500,00");
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.displayName) {
      setName((prev) => (prev.trim() ? prev : user.displayName || ""));
    }

    let cancelled = false;
    checkIsUserOnboarded(user.uid, user.metadata)
      .then((alreadyOnboarded) => {
        if (cancelled) return;
        if (alreadyOnboarded) {
          router.replace("/dashboard");
        } else {
          setCheckingOnboarding(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCheckingOnboarding(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  if (authLoading || !user || checkingOnboarding) {
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
      const sanitizedName = sanitizeTextInput(name, 100);
      const sanitizedRole = sanitizeTextInput(role, 80);
      const sanitizedCardName = sanitizeTextInput(cardName, 80);

      const incomeVal = validateCurrency(monthlyIncome);
      if (!incomeVal.isValid) {
        setErrorMessage(incomeVal.error || "Renda mensal informada é inválida.");
        setSubmitting(false);
        return;
      }

      const amountVal = validateCurrency(initialAmount);
      if (!amountVal.isValid) {
        setErrorMessage(amountVal.error || "Saldo inicial informado é inválido.");
        setSubmitting(false);
        return;
      }

      const cleanIncome = incomeVal.value;
      const cleanAmount = amountVal.value;

      const parts = sanitizedName.trim().split(" ");
      const initials =
        parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : sanitizedName.slice(0, 2).toUpperCase() || "WI";

      // 1. Salvar Perfil do Usuário
      await saveUserProfile(user.uid, {
        name: sanitizedName.trim() || "Usuário",
        email: user.email || "",
        role: sanitizedRole.trim() || "Membro",
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

      // 2. Criar Primeiro Cartão no Firestore apenas se ainda não foi importado via Extrato PDF
      if (!importedSummary || importedSummary.cardsCount === 0) {
        const firstCard: CardItem = {
          id: `card-${Date.now()}`,
          name: sanitizedCardName.trim() || "Conta Principal",
          brand: "Conta",
          type: "checking",
          balance: cleanAmount,
          openingBalance: cleanAmount,
          ledgerBalanceVersion: CURRENT_LEDGER_BALANCE_VERSION,
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
      }

      markUserOnboardedLocal(user.uid);

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
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo2.png"
              alt="Wallet Logo"
              width={34}
              height={34}
              className="rounded-xl object-contain shadow-xs shrink-0"
              priority
            />
            <div>
              <span className="font-semibold text-sm text-[#1D1D1F] block leading-tight">
                Configuração Passo a Passo
              </span>
              <span className="text-[11px] text-[#86868B]">
                Deixe seu app pronto em menos de 1 minuto
              </span>
            </div>
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
                    ? "w-4 bg-emerald-500"
                    : "w-4 bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Barra Didática de Passos Diretos */}
        <div className="grid grid-cols-3 gap-2">
          {ONBOARDING_DIRECT_STEPS.map((item) => {
            const isCurrent = step === item.step;
            const isDone = step > item.step;
            return (
              <div
                key={item.step}
                className={`px-3 py-2 rounded-2xl border text-left transition-all ${
                  isCurrent
                    ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs"
                    : isDone
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200/80"
                    : "bg-white/70 text-[#86868B] border-black/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Passo {item.step}
                  </span>
                  {isDone && <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />}
                </div>
                <p className="text-[11px] font-semibold truncate mt-0.5">
                  {item.shortLabel.replace(/^\d+\.\s*/, "")}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Container Principal do Card de Onboarding */}
      <div className="w-full max-w-xl bg-white rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] border border-black/[0.04] p-7 md:p-10 space-y-8 my-6 animate-in fade-in duration-300">
        {errorMessage && (
          <div className="bg-red-50 text-red-600 border border-red-200/60 rounded-xl px-4 py-2.5 text-xs font-medium animate-in fade-in duration-200">
            {errorMessage}
          </div>
        )}

        {/* Etapa 1: Coloque seu nome e sua renda */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                <BookOpen size={11} />
                Passo 1 de 3 • Dados Básicos
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                Coloque seu nome e sua renda mensal
              </h2>
              <p className="text-xs text-[#86868B] max-w-md mx-auto">
                Com o seu nome e quanto entra por mês, o app já calcula quanto você pode gastar por dia sem ficar no vermelho.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1">
                  1. Qual é o seu nome?
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
                  2. Sua Profissão ou Ocupação (Opcional)
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
                  3. Quanto você recebe por mês (Salário / Renda Líquida)?
                </label>
                <div className="flex justify-center items-baseline gap-1.5">
                  <span className="text-xl font-medium text-gray-400 font-mono tabular-nums">R$</span>
                  <input
                    type="text"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    placeholder="5.000,00"
                    className="text-4xl font-light text-[#1D1D1F] text-center w-56 outline-none bg-transparent font-mono tabular-nums"
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
              <span>Próximo Passo: Exportar Extrato em PDF</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Etapa 2: Exporte aqui seu PDF do extrato + Conta Inicial */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                <FileText size={11} />
                Passo 2 de 3 • Contas & Gastos
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                Exporte aqui seu PDF do extrato
              </h2>
              <p className="text-xs text-[#86868B] max-w-md mx-auto">
                Envie o PDF do extrato do seu banco para o app identificar e cadastrar suas contas, cartões e gastos automaticamente.
              </p>
            </div>

            {/* Mini-tutorial direto de como exportar e importar o PDF */}
            <div className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/[0.04] space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1D1D1F] block">
                Como funciona (3 passos simples):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-[#636366]">
                <div className="bg-white p-2.5 rounded-xl border border-black/[0.04]">
                  <strong className="text-[#1D1D1F] block">1. No app do banco</strong>
                  Abra seu Extrato ou Fatura e escolha <em>Exportar PDF</em>.
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-black/[0.04]">
                  <strong className="text-[#1D1D1F] block">2. Envie aqui abaixo</strong>
                  Clique no botão abaixo e selecione o PDF no celular ou PC.
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-black/[0.04]">
                  <strong className="text-[#1D1D1F] block">3. Revise e confirme</strong>
                  Veja as contas, fixas e gastos achados e confirme com 1 clique.
                </div>
              </div>
            </div>

            {/* Card Principal: Importação Inteligente de Extrato PDF */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1D1D1F] via-[#151517] to-[#0A0A0C] text-white space-y-3 shadow-md border border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">
                        Importar Extrato do Banco em PDF
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30">
                        Automático
                      </span>
                    </div>
                    <p className="text-[11px] text-white/70 mt-0.5 leading-relaxed">
                      Identifica suas contas, cartões, despesas fixas, parcelamentos e histórico com sua confirmação.
                    </p>
                  </div>
                </div>
              </div>

              {importedSummary ? (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-200 font-medium">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    <span>
                      {importedSummary.institutionName}: {importedSummary.cardsCount} conta(s),{" "}
                      {importedSummary.recurringCount} fixa(s) e {importedSummary.transactionsCount} lançamentos cadastrados!
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStatementModalOpen(true)}
                    className="text-[11px] font-semibold text-white underline shrink-0 cursor-pointer"
                  >
                    Importar outro
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsStatementModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-white text-[#1D1D1F] hover:bg-gray-100 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  data-testid="onboarding-import-statement-btn"
                >
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Enviar Extrato PDF e Cadastrar Automaticamente</span>
                </button>
              )}
            </div>

            {!importedSummary && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px bg-black/[0.06] flex-1" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B]">
                    Ou digite sua conta manualmente se preferir
                  </span>
                  <div className="h-px bg-black/[0.06] flex-1" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1">
                    Nome do seu Banco Principal
                  </label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="Ex: Nubank, Itaú, Inter..."
                    className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none border border-transparent focus:border-black/10 transition-all"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider px-1 block text-center">
                    Quanto você tem na conta hoje?
                  </label>
                  <div className="flex justify-center items-baseline gap-1.5">
                    <span className="text-xl font-medium text-gray-400 font-mono tabular-nums">R$</span>
                    <input
                      type="text"
                      value={initialAmount}
                      onChange={(e) => setInitialAmount(e.target.value)}
                      placeholder="2.500,00"
                      className="text-4xl font-light text-[#1D1D1F] text-center w-56 outline-none bg-transparent font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}

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
                <span>Próximo Passo: Escolher Perfil</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Etapa 3: Arquétipo Financeiro e Finalização */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                <CheckCircle2 size={11} />
                Passo 3 de 3 • Seu Estilo
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                Qual é o seu objetivo principal?
              </h2>
              <p className="text-xs text-[#86868B] max-w-md mx-auto">
                Escolha como você prefere cuidar do seu dinheiro para o app ajustar os alertas para você.
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
                    <span>Concluir e Entrar no App</span>
                    <CheckCircle2 size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Importação de Extrato PDF no Onboarding */}
      <StatementImportModal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        onImportedSuccess={({ result, analysis, confirmedAccounts }) => {
          if (user) {
            markUserOnboardedLocal(user.uid);
          }
          const checkingAcc = confirmedAccounts.find((a) => a.type === "checking");
          if (checkingAcc) {
            setCardName(checkingAcc.name);
            setInitialAmount(
              checkingAcc.balance.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            );
          }
          if (analysis.summary.estimatedMonthlyIncome > 0) {
            setMonthlyIncome(
              analysis.summary.estimatedMonthlyIncome.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            );
          }
          setImportedSummary({
            cardsCount: result.createdCardsCount + result.updatedCardsCount,
            recurringCount: result.createdRecurringCount,
            transactionsCount: result.createdTransactionsCount,
            institutionName: analysis.summary.institutionName,
          });
        }}
      />

      <div className="text-xs text-[#86868B]">
        Seus dados são transmitidos por HTTPS e protegidos pelo seu Wallet ID.
      </div>
    </div>
  );
}
