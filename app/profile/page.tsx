"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet, FinancialPersonaId, RiskToleranceId, AIToneId } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { AppleArchetypeModal } from "@/components/ui/AppleArchetypeModal";
import { LgpdTermsModal } from "@/components/legal/LgpdTermsModal";
import { exportUserDataJson } from "@/lib/services/userService";
import { sanitizeTextInput, validateCurrency, validateEmail } from "@/lib/utils/security";
import {
  ChevronLeft,
  Check,
  CheckCircle2,
  Award,
  LogOut,
  Trash2,
  Download,
  ShieldCheck,
  FileText,
  Loader2,
} from "lucide-react";

interface PersonaConfig {
  id: FinancialPersonaId;
  title: string;
  subtitle: string;
  overview: string;
  advisorGuidance: string;
  modalSummary: string;
  attributes: string[];
}

const PERSONAS: PersonaConfig[] = [
  {
    id: "optimizer",
    title: "The Optimizer",
    subtitle: "Eficiência e otimização financeira",
    overview:
      "Seu Advisor prioriza eficiência no uso do crédito, benefícios, pontos e redução de custos financeiros.",
    advisorGuidance:
      "Prioriza eficiência financeira, uso estratégico dos cartões, benefícios e redução de custos. Entre alternativas semelhantes, tende a favorecer a opção com melhor relação entre benefício e custo.",
    modalSummary:
      "Prioriza eficiência, benefícios e melhor utilização dos recursos.",
    attributes: ["Eficiência", "Benefícios", "Menor custo"],
  },
  {
    id: "guardian",
    title: "The Guardian",
    subtitle: "Segurança e previsibilidade",
    overview:
      "Seu Advisor prioriza reserva de emergência, estabilidade e controle dos compromissos.",
    advisorGuidance:
      "Prioriza reserva, estabilidade e controle dos compromissos. Alerta preventivamente sobre despesas supérfluas e favorece a previsibilidade do fluxo de caixa.",
    modalSummary:
      "Prioriza reserva, estabilidade e controle dos compromissos.",
    attributes: ["Segurança", "Previsibilidade", "Reserva"],
  },
  {
    id: "scaler",
    title: "The Scaler",
    subtitle: "Crescimento e oportunidades",
    overview:
      "Seu Advisor prioriza expansão patrimonial, investimentos e utilização estratégica da renda.",
    advisorGuidance:
      "Prioriza expansão patrimonial, investimentos e utilização estratégica da renda. Analisa sazonalidades e sugere o momento ideal para aportes e expansões.",
    modalSummary:
      "Prioriza expansão patrimonial, investimentos e utilização estratégica da renda.",
    attributes: ["Crescimento", "Oportunidades", "Patrimônio"],
  },
  {
    id: "minimalist",
    title: "The Minimalist",
    subtitle: "Simplicidade e independência",
    overview:
      "Seu Advisor prioriza redução de custos, controle financeiro e construção de independência.",
    advisorGuidance:
      "Prioriza redução de custos, controle financeiro e construção de independência. Favorece a alta taxa de poupança e simplificação máxima da vida financeira.",
    modalSummary:
      "Prioriza redução de custos, controle financeiro e construção de independência.",
    attributes: ["Simplicidade", "Independência", "Frugalidade"],
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuth();
  const { userProfile, updateUserProfile, cards, mainBalance } = useWallet();

  const [name, setName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);
  const [role, setRole] = useState(userProfile.role);
  const [incomeInput, setIncomeInput] = useState(userProfile.monthlyIncomeBase.toString());
  const [primaryFocus, setPrimaryFocus] = useState(userProfile.primaryFocus);
  const [maxCommitment, setMaxCommitment] = useState(userProfile.maxCommitmentAlertPercent);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isArchetypeModalOpen, setIsArchetypeModalOpen] = useState(false);
  const [initialSelectedPersona, setInitialSelectedPersona] = useState<FinancialPersonaId | null>(null);
  const [isLgpdModalOpen, setIsLgpdModalOpen] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);

  // Sincronizar inputs locais quando o perfil for carregado do Firestore
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setName(userProfile.name);
      setEmail(userProfile.email);
      setRole(userProfile.role);
      setIncomeInput(userProfile.monthlyIncomeBase.toString());
      setPrimaryFocus(userProfile.primaryFocus);
      setMaxCommitment(userProfile.maxCommitmentAlertPercent);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [userProfile]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setIsSignOutConfirmOpen(false);
      router.replace("/");
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
      showToast("Não foi possível encerrar a sessão. Tente novamente.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      setIsDeleteAccountOpen(false);
      router.replace("/");
    } catch (error: unknown) {
      console.error("Erro ao excluir conta:", error);
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        showToast("Confirmação de identidade cancelada. Seus dados e sua conta continuam preservados.");
      } else if (code === "auth/requires-recent-login") {
        showToast("Por segurança, saia e entre novamente na sua conta antes de solicitar a exclusão definitiva.");
      } else {
        showToast(error instanceof Error ? error.message : "Não foi possível excluir sua conta. Tente novamente.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleExportData = async () => {
    if (!user?.uid) {
      showToast("Você precisa estar autenticado para exportar seus dados.");
      return;
    }

    setIsExportingData(true);
    try {
      const data = await exportUserDataJson(user.uid);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `wallet-lgpd-dados-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Relatório de dados pessoais baixado com sucesso!");
    } catch (err: unknown) {
      console.error("Erro ao exportar dados:", err);
      showToast("Falha ao exportar seus dados. Tente novamente.");
    } finally {
      setIsExportingData(false);
    }
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const activePersona = PERSONAS.find((p) => p.id === userProfile.persona) || null;
  const hasDefinedPersona = Boolean(userProfile?.persona && activePersona);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdatePersona = (personaId: FinancialPersonaId) => {
    const chosen = PERSONAS.find((p) => p.id === personaId);
    updateUserProfile({ persona: personaId });
    showToast(`Arquétipo atualizado para ${chosen?.title || personaId}`);
  };

  const handleSelectTone = (tone: AIToneId) => {
    updateUserProfile({ aiTone: tone });
    showToast("Estilo das recomendações atualizado!");
  };

  const handleSelectRisk = (risk: RiskToleranceId) => {
    updateUserProfile({ riskTolerance: risk });
    showToast("Perfil de risco atualizado!");
  };

  const handleSaveProfileData = (e: React.FormEvent) => {
    e.preventDefault();

    const sanitizedName = sanitizeTextInput(name, 100);
    const sanitizedRole = sanitizeTextInput(role, 80);
    const sanitizedFocus = sanitizeTextInput(primaryFocus, 150);

    if (email && !validateEmail(email)) {
      showToast("E-mail em formato inválido.");
      return;
    }

    const incomeVal = validateCurrency(incomeInput, { min: 100, max: 10_000_000 });
    const finalIncome = incomeVal.isValid ? incomeVal.value : userProfile.monthlyIncomeBase;

    const clampedCommitment = Math.max(5, Math.min(100, maxCommitment));

    updateUserProfile({
      name: sanitizedName || userProfile.name,
      email: email.trim() || userProfile.email,
      role: sanitizedRole || userProfile.role,
      monthlyIncomeBase: finalIncome,
      primaryFocus: sanitizedFocus || userProfile.primaryFocus,
      maxCommitmentAlertPercent: clampedCommitment,
    });

    showToast("Perfil atualizado com sucesso!");
  };

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-24 md:pb-12">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 z-50 bg-[#1D1D1F] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header com Navegação */}
      <header className="flex items-center justify-between pt-2 md:pt-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-white text-[#1D1D1F] flex items-center justify-center border border-black/[0.04] shadow-xs hover:bg-[#E5E5EA] transition-colors"
            title="Voltar ao Dashboard"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </Link>
          <div>
            <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
              Wallet ID & Configurações
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
              Perfil & Arquétipo
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-black/[0.04] shadow-2xs text-xs font-medium text-[#86868B]">
          <Award size={14} className="text-amber-500" />
          <span className="text-[#1D1D1F] font-semibold">Wallet Pro</span>
        </div>
      </header>

      {/* Hero Apple ID / Titanium Card */}
      <section className="relative overflow-hidden rounded-[26px] bg-[#161618] border border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.18)] p-5 sm:p-7 text-white font-sans">
        {/* Apple Titanium ambient sheen & watermark */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 rounded-full bg-radial from-white/[0.06] to-transparent blur-2xl pointer-events-none" />
        <div className="absolute top-4 right-5 text-white/[0.06] font-semibold text-3xl tracking-tighter select-none pointer-events-none hidden sm:block font-mono">
          WALLET ID
        </div>

        <div className="relative z-10 space-y-5">
          {/* Linha Superior: Avatar, Identidade e Badge de Arquétipo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {/* Avatar Monograma estilo Apple ID */}
              <div className="relative shrink-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-[#3A3A3C] to-[#242426] text-white font-semibold text-xl sm:text-2xl flex items-center justify-center border border-white/20 shadow-inner">
                  {userProfile.avatarInitials}
                </div>
                <span
                  className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#161618] shadow-2xs flex items-center justify-center"
                  title="Carteira Ativa"
                >
                  <span className="w-1 h-1 rounded-full bg-white" />
                </span>
              </div>

              {/* Informações Pessoais */}
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-white truncate">
                  {userProfile.name}
                </h2>
                <p className="text-xs text-white/65 truncate">{userProfile.role}</p>
                <p className="text-[11px] text-white/40 font-mono truncate">{userProfile.email}</p>
              </div>
            </div>

            {/* Badge do Arquétipo Ativo */}
            {activePersona && (
              <div className="self-start sm:self-center shrink-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/10 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-semibold tracking-wide text-white/90">
                    {activePersona.title}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Shelf: 3 Colunas Horizontais estilo Apple Card */}
          <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 sm:p-4 text-center">
            <div className="px-1.5 sm:px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 block truncate">
                Renda Base
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight mt-0.5 block truncate">
                R$ {formatCurrency(userProfile.monthlyIncomeBase)}
              </span>
            </div>

            <div className="px-1.5 sm:px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 block truncate">
                Cartões
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight mt-0.5 block truncate">
                {cards.length} {cards.length === 1 ? "ativo" : "ativos"}
              </span>
            </div>

            <div className="px-1.5 sm:px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 block truncate">
                Saldo Atual
              </span>
              <span className="text-xs sm:text-sm font-semibold text-emerald-400 tracking-tight mt-0.5 block truncate">
                R$ {formatCurrency(mainBalance)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Arquétipo da Carteira */}
      {hasDefinedPersona && activePersona ? (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
              Seu arquétipo
            </h2>
          </div>

          <div className="bg-white rounded-[24px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-5">
            {/* Topo com Título, Subtítulo e Indicador Ativo */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
                    {activePersona.title}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Ativo
                  </span>
                </div>
                <p className="text-xs text-[#86868B] font-medium">
                  {activePersona.subtitle}
                </p>
              </div>
            </div>

            {/* Descrição principal */}
            <p className="text-sm text-[#1D1D1F]/90 leading-relaxed font-normal">
              {activePersona.overview}
            </p>

            {/* Divisor sutil */}
            <div className="border-t border-black/[0.06]" />

            {/* Como isso orienta seu Advisor */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                Como isso orienta seu Advisor
              </h4>
              <p className="text-xs text-[#86868B] leading-relaxed">
                {activePersona.advisorGuidance}
              </p>

              {/* Atributos discretos (texto simples, sem badges pesados) */}
              <div className="text-[11px] font-medium text-[#86868B] pt-1 tracking-wide">
                {activePersona.attributes.join(" · ")}
              </div>
            </div>

            {/* Divisor sutil */}
            <div className="border-t border-black/[0.06]" />

            {/* Ação secundária para alteração explícita */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
              <span className="text-xs text-[#86868B]">
                Contexto persistente utilizado nas análises do Advisor
              </span>
              <button
                type="button"
                onClick={() => setIsArchetypeModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] active:scale-[0.98] rounded-xl transition-all cursor-pointer self-start sm:self-auto"
              >
                Alterar arquétipo
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Estado de Primeiro Acesso: Usuário sem arquétipo definido */
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
              Defina seu arquétipo
            </h2>
          </div>

          <div className="bg-white rounded-[24px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Defina seu arquétipo
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                Escolha o perfil financeiro que melhor representa seus objetivos atuais. Ele será utilizado pelo Advisor como contexto para suas análises e recomendações.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {PERSONAS.map((p) => {
                const isSelected = initialSelectedPersona === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setInitialSelectedPersona(p.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex items-start gap-3.5 ${
                      isSelected
                        ? "border-[#1D1D1F] bg-[#F2F2F7]/50 shadow-2xs"
                        : "border-black/[0.06] bg-white hover:border-black/15 hover:bg-[#F2F2F7]/20"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "border-[#1D1D1F] bg-[#1D1D1F]"
                          : "border-[#C7C7CC] bg-white"
                      }`}
                    >
                      {isSelected && <Check size={10} className="text-white stroke-[3]" />}
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                        {p.title}
                      </h4>
                      <p className="text-xs text-[#86868B] font-medium">
                        {p.subtitle}
                      </p>
                      <p className="text-xs text-[#636366] leading-relaxed pt-0.5">
                        {p.modalSummary}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-black/[0.05] flex justify-end">
              <button
                type="button"
                disabled={!initialSelectedPersona}
                onClick={() => {
                  if (initialSelectedPersona) {
                    handleUpdatePersona(initialSelectedPersona);
                  }
                }}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1D1D1F] hover:bg-black active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              >
                Definir meu arquétipo
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Diretrizes & Parâmetros do Advisor */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B] px-1">
            ADVISOR
          </h2>
          <p className="text-xs text-[#86868B] px-1 mt-0.5">
            Personalize como suas recomendações são apresentadas.
          </p>
        </div>

        <div className="bg-white rounded-[20px] p-6 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-6">
          
          {/* Estilo das recomendações */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-[#1D1D1F]">
                Estilo das recomendações
              </label>
              <span className="text-xs text-[#86868B]">Como o Advisor formulará recomendações</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: "analytical" as AIToneId,
                  label: "Analítico Suíço",
                  desc: "Foco em números exatos, taxas e precisão matemática.",
                },
                {
                  id: "direct" as AIToneId,
                  label: "Mentor Direto",
                  desc: "Sem rodeios, focado em disciplina e cumprimento de metas.",
                },
                {
                  id: "collaborative" as AIToneId,
                  label: "Parceiro Estratégico",
                  desc: "Equilíbrio entre bem-estar e crescimento financeiro.",
                },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTone(t.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    userProfile.aiTone === t.id
                      ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs"
                      : "bg-[#F2F2F7]/70 text-[#1D1D1F] border-transparent hover:bg-[#F2F2F7]"
                  }`}
                >
                  <div className="font-semibold text-xs">{t.label}</div>
                  <div className={`text-[10px] mt-0.5 leading-snug ${userProfile.aiTone === t.id ? "text-white/70" : "text-[#86868B]"}`}>
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Teto de Alerta de Faturas */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <label className="text-xs font-semibold text-[#1D1D1F]">
                  Teto de Alerta de Comprometimento de Fatura
                </label>
                <p className="text-xs text-[#86868B]">
                  O Advisor enviará alertas prioritários se as faturas superarem esta porcentagem da sua renda.
                </p>
              </div>
              <span className="text-sm font-semibold text-[#1D1D1F] bg-[#F2F2F7] px-3 py-1 rounded-full">
                {maxCommitment}% da renda
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[25, 35, 45, 50].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setMaxCommitment(pct);
                    updateUserProfile({ maxCommitmentAlertPercent: pct });
                    showToast(`Teto de alerta ajustado para ${pct}%`);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    maxCommitment === pct
                      ? "bg-[#1D1D1F] text-white shadow-2xs"
                      : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  {pct}% {pct === 35 ? "(Recomendado)" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Perfil de risco */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="text-xs font-semibold text-[#1D1D1F]">
              Perfil de risco
            </label>
            <div className="bg-[#E5E5EA]/80 p-1 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-1 border border-black/5">
              {[
                { id: "low" as RiskToleranceId, label: "Conservador" },
                { id: "moderate" as RiskToleranceId, label: "Equilibrado" },
                { id: "high" as RiskToleranceId, label: "Arrojado / Crescimento" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRisk(r.id)}
                  className={`py-2 px-2 text-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    userProfile.riskTolerance === r.id
                      ? "bg-white text-[#1D1D1F] shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Formulário de Dados Pessoais & Renda Base */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B] px-1">
          Dados da Conta & Parâmetros Financeiros
        </h2>

        <form onSubmit={handleSaveProfileData} className="bg-white rounded-[20px] p-6 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Nome Completo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#86868B]">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-sm text-[#1D1D1F] border border-transparent focus:bg-white focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 transition-all"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#86868B]">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-sm text-[#1D1D1F] border border-transparent focus:bg-white focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 transition-all"
              />
            </div>

            {/* Cargo / Ocupação */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#86868B]">
                Profissão ou Especialidade
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-sm text-[#1D1D1F] border border-transparent focus:bg-white focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 transition-all"
              />
            </div>

            {/* Renda Base Estimada */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#86868B]">
                Renda Base Mensal Estimada (R$)
              </label>
              <input
                type="text"
                required
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
                className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-sm text-[#1D1D1F] font-semibold border border-transparent focus:bg-white focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 transition-all"
              />
            </div>
          </div>

          {/* Foco Prioritário Atual */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-[#86868B]">
              Objetivo Prioritário da Carteira
            </label>
            <input
              type="text"
              value={primaryFocus}
              onChange={(e) => setPrimaryFocus(e.target.value)}
              placeholder="Ex: Quitar faturas, Acelerar meta MacBook, Comprar imóvel..."
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-2.5 text-sm text-[#1D1D1F] border border-transparent focus:bg-white focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 transition-all"
            />
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              className="bg-[#1D1D1F] text-white px-6 py-2.5 rounded-xl text-xs font-semibold hover:bg-black active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </section>

      {/* Seção de Sessão, Conta e Privacidade LGPD */}
      <section className="bg-white rounded-[24px] p-6 shadow-sm border border-black/[0.04] space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F]">
              Sessão & Conta
            </h3>
            <p className="text-xs text-[#86868B] mt-0.5">
              Conectado como {user?.email || userProfile.email}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsSignOutConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-[#F2F2F7] hover:bg-gray-200 active:scale-95 transition-all cursor-pointer"
          >
            <LogOut size={14} strokeWidth={2} />
            <span>Encerrar Sessão</span>
          </button>
        </div>

        {/* Conformidade LGPD e Portabilidade de Dados */}
        <div className="pt-4 border-t border-black/[0.05] space-y-3">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Proteção de Dados & Conformidade LGPD</span>
                </h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                  Lei 13.709/2018
                </span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-0.5 max-w-lg">
                Seus dados financeiros são criptografados e higienizados contra identificadores pessoais. Você pode exportar uma cópia completa das suas informações ou consultar os termos aceitos a qualquer momento.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsLgpdModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-all cursor-pointer"
              >
                <FileText size={13} />
                <span>Ver Termos LGPD</span>
              </button>

              <button
                type="button"
                onClick={handleExportData}
                disabled={isExportingData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#1D1D1F] hover:bg-black active:scale-95 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
              >
                {isExportingData ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                <span>Exportar Dados (JSON)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Exclusão Definitiva */}
        <div className="pt-4 border-t border-black/[0.05] flex items-center justify-between flex-wrap gap-3">
          <div>
            <h4 className="text-xs font-semibold text-rose-600">
              Exclusão Definitiva de Dados (LGPD Art. 18, VI)
            </h4>
            <p className="text-[11px] text-[#86868B] mt-0.5 max-w-md">
              Apaga permanentemente todo o seu histórico de transações, faturas, cartões, metas, diagnósticos e conversas de IA no Firestore. Esta ação é irreversível.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsDeleteAccountOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 border border-rose-200 bg-rose-50/60 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
          >
            <Trash2 size={13} strokeWidth={2} />
            <span>Excluir Minha Conta</span>
          </button>
        </div>
      </section>

      <AppleConfirmModal
        isOpen={isSignOutConfirmOpen}
        onClose={() => setIsSignOutConfirmOpen(false)}
        onConfirm={handleSignOut}
        title="Sair da conta?"
        description="Tem certeza que deseja encerrar sua sessão neste dispositivo?"
        confirmLabel="Sair"
        cancelLabel="Continuar conectado"
        variant="danger"
        iconType="alert"
        isLoading={isSigningOut}
      />

      <AppleConfirmModal
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Excluir conta definitivamente?"
        description="Todos os seus lançamentos, cartões, metas e planejamentos salvos no Firestore serão apagados permanentemente de acordo com a LGPD. Esta operação é irreversível."
        confirmLabel="Excluir Definitivamente"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
        isLoading={isDeletingAccount}
      />

      <AppleArchetypeModal
        isOpen={isArchetypeModalOpen}
        currentPersonaId={userProfile.persona}
        onClose={() => setIsArchetypeModalOpen(false)}
        onConfirm={handleUpdatePersona}
      />

      {/* Modal de Consulta aos Termos LGPD */}
      <LgpdTermsModal
        isOpen={isLgpdModalOpen}
        onClose={() => setIsLgpdModalOpen(false)}
        hasAccepted={true}
      />

    </div>
  );
}
