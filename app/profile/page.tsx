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
import { WalletIdTitaniumCard, PERSONA_METADATA } from "@/components/profile/WalletIdTitaniumCard";
import { PersonaAnalyzerCard } from "@/components/profile/PersonaAnalyzerCard";
import {
  ChevronLeft,
  CheckCircle2,
  LogOut,
  Trash2,
  Download,
  ShieldCheck,
  FileText,
  Loader2,
  Brain,
  SlidersHorizontal,
  User,
  Mail,
  Briefcase,
  DollarSign,
  Target,
  Sparkles,
  Lock,
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuth();
  const { userProfile, updateUserProfile, cards, mainBalance } = useWallet();

  // Abas de navegação segmentada Apple
  const [activeTab, setActiveTab] = useState<"advisor" | "account" | "security">("advisor");

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

  const isDirty =
    name !== userProfile.name ||
    email !== userProfile.email ||
    role !== userProfile.role ||
    incomeInput !== userProfile.monthlyIncomeBase.toString() ||
    primaryFocus !== userProfile.primaryFocus;

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
        showToast("Confirmação de identidade cancelada. Seus dados continuam preservados.");
      } else if (code === "auth/requires-recent-login") {
        showToast("Por segurança, saia e entre novamente antes de solicitar a exclusão.");
      } else {
        showToast(error instanceof Error ? error.message : "Não foi possível excluir sua conta.");
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdatePersona = (personaId: FinancialPersonaId) => {
    const chosen = PERSONA_METADATA[personaId];
    updateUserProfile({ persona: personaId });
    showToast(`Arquétipo atualizado para ${chosen?.emoji} ${chosen?.title || personaId}`);
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

    showToast("Dados atualizados com sucesso no Wallet ID!");
  };

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-28 md:pb-16">
      {/* Toast Feedback Apple */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 z-50 bg-[#1D1D1F] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-2 border border-white/10">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header com Navegação Apple */}
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
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
              Perfil & Arquétipo
            </h1>
          </div>
        </div>
      </header>

      {/* Hero Apple Wallet Titanium Card com Emojis e Modo Duplo Interativo */}
      <section>
        <WalletIdTitaniumCard
          userProfile={userProfile}
          cardsCount={cards.length}
          mainBalance={mainBalance}
          onOpenArchetypeModal={() => setIsArchetypeModalOpen(true)}
          formatCurrency={formatCurrency}
        />
      </section>

      {/* Barra de Segmented Control Apple (Organiza todas as informações em abas focadas) */}
      <nav aria-label="Seções do Perfil" className="pt-1">
        <div className="bg-[#E5E5EA]/80 p-1 rounded-2xl flex items-center gap-1 border border-black/[0.04] shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("advisor")}
            className={`flex-1 py-2 sm:py-2.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "advisor"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <Brain size={14} className={activeTab === "advisor" ? "text-purple-600" : "text-[#86868B]"} />
            <span className="truncate">Inteligência & IA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={`flex-1 py-2 sm:py-2.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "account"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <SlidersHorizontal size={14} className={activeTab === "account" ? "text-blue-600" : "text-[#86868B]"} />
            <span className="truncate">Conta & Parâmetros</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex-1 py-2 sm:py-2.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "security"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <ShieldCheck size={14} className={activeTab === "security" ? "text-emerald-600" : "text-[#86868B]"} />
            <span className="truncate">Segurança & LGPD</span>
          </button>
        </div>
      </nav>

      {/* ABA 1: INTELIGÊNCIA & ADVISOR */}
      {activeTab === "advisor" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Analisador Visual Cognitivo com Seletor Rápido de Emojis e Live Preview */}
          <PersonaAnalyzerCard
            currentPersonaId={userProfile.persona || "optimizer"}
            aiTone={userProfile.aiTone}
            userName={userProfile.name}
            monthlyIncome={userProfile.monthlyIncomeBase}
            mainBalance={mainBalance}
            onSelectPersona={handleUpdatePersona}
            formatCurrency={formatCurrency}
          />

          {/* Diretrizes & Parâmetros de Postura do Advisor */}
          <section className="bg-white rounded-[26px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold tracking-tight text-[#1D1D1F]">
                  Estilo & Diretrizes do Advisor
                </h3>
                <p className="text-xs text-[#86868B]">
                  Defina o rigor matemático e os limites prudenciais das recomendações
                </p>
              </div>
              <Sparkles size={16} className="text-purple-500" />
            </div>

            {/* Estilo das recomendações (Tons de IA) */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-[#86868B] uppercase tracking-wider block">
                Tom de Comunicação
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
                      userProfile.aiTone === t.id
                        ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-xs"
                        : "bg-[#F2F2F7]/70 text-[#1D1D1F] border-transparent hover:bg-[#F2F2F7]"
                    }`}
                  >
                    <div className="font-semibold text-xs">{t.label}</div>
                    <div
                      className={`text-[10px] mt-1 leading-snug ${
                        userProfile.aiTone === t.id ? "text-white/70" : "text-[#86868B]"
                      }`}
                    >
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Teto de Alerta de Faturas */}
            <div className="space-y-3 pt-3 border-t border-black/[0.05]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <label className="text-xs font-semibold text-[#1D1D1F]">
                    Teto de Alerta de Comprometimento de Fatura
                  </label>
                  <p className="text-xs text-[#86868B]">
                    O Advisor emitirá alerta prioritário se a fatura somada ultrapassar esse limite da renda.
                  </p>
                </div>
                <div className="self-start sm:self-auto flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#1D1D1F] bg-[#F2F2F7] px-3 py-1 rounded-full font-mono tabular-nums">
                    {maxCommitment}% da renda
                  </span>
                  <span className="text-[11px] text-[#86868B] font-mono">
                    (R$ {formatCurrency((userProfile.monthlyIncomeBase * maxCommitment) / 100)})
                  </span>
                </div>
              </div>

              {/* Botões Táteis com Barra de Teto Visual */}
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
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
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

            {/* Perfil de Risco */}
            <div className="space-y-2 pt-3 border-t border-black/[0.05]">
              <label className="text-xs font-semibold text-[#1D1D1F]">
                Perfil de Risco & Alavancagem
              </label>
              <div className="bg-[#E5E5EA]/80 p-1 rounded-xl grid grid-cols-3 gap-1 border border-black/5">
                {[
                  { id: "low" as RiskToleranceId, label: "Conservador" },
                  { id: "moderate" as RiskToleranceId, label: "Equilibrado" },
                  { id: "high" as RiskToleranceId, label: "Arrojado" },
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
          </section>
        </div>
      )}

      {/* ABA 2: CONTA & PARÂMETROS PESSOAIS (Padrão iOS Settings Grouped) */}
      {activeTab === "account" && (
        <form onSubmit={handleSaveProfileData} className="space-y-5 animate-in fade-in duration-300">
          <div className="bg-white rounded-[26px] overflow-hidden border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.04)] font-sans">
            <div className="p-5 sm:p-6 pb-3 border-b border-black/[0.05] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold tracking-tight text-[#1D1D1F]">
                  Parâmetros Pessoais & Financeiros
                </h3>
                <p className="text-xs text-[#86868B]">
                  Dados utilizados para calibrar suas métricas de fluxo de caixa e metas
                </p>
              </div>
              {isDirty && (
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  Alterações não salvas
                </span>
              )}
            </div>

            {/* Inset Grouped Rows */}
            <div className="divide-y divide-black/[0.05]">
              {/* Linha 1: Nome Completo */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#F9F9FB] transition-colors">
                <div className="flex items-center gap-3 sm:w-1/3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                  <span className="text-xs font-semibold text-[#1D1D1F]">Nome Completo</span>
                </div>
                <div className="sm:w-2/3">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#F2F2F7] focus:bg-white rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#1D1D1F] font-medium border border-transparent focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/15 transition-all"
                  />
                </div>
              </div>

              {/* Linha 2: Email */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#F9F9FB] transition-colors">
                <div className="flex items-center gap-3 sm:w-1/3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Mail size={16} />
                  </div>
                  <span className="text-xs font-semibold text-[#1D1D1F]">Email</span>
                </div>
                <div className="sm:w-2/3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#F2F2F7] focus:bg-white rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#1D1D1F] font-mono border border-transparent focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/15 transition-all"
                  />
                </div>
              </div>

              {/* Linha 3: Profissão ou Especialidade */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#F9F9FB] transition-colors">
                <div className="flex items-center gap-3 sm:w-1/3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Briefcase size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#1D1D1F] block">Profissão / Cargo</span>
                    <span className="text-[10px] text-[#86868B] block">Ajuda a IA no contexto</span>
                  </div>
                </div>
                <div className="sm:w-2/3">
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Ex: Engenheiro de Software, Médico, Designer..."
                    className="w-full bg-[#F2F2F7] focus:bg-white rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#1D1D1F] font-medium border border-transparent focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/15 transition-all"
                  />
                </div>
              </div>

              {/* Linha 4: Renda Base Mensal Estimada */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#F9F9FB] transition-colors">
                <div className="flex items-center gap-3 sm:w-1/3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <DollarSign size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#1D1D1F] block">Renda Base Mensal</span>
                    <span className="text-[10px] text-[#86868B] block">Base de cálculo do orçamento</span>
                  </div>
                </div>
                <div className="sm:w-2/3">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#86868B] font-mono">
                      R$
                    </span>
                    <input
                      type="text"
                      required
                      value={incomeInput}
                      onChange={(e) => setIncomeInput(e.target.value)}
                      className="w-full bg-[#F2F2F7] focus:bg-white rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-[#1D1D1F] font-semibold border border-transparent focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/15 transition-all font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Linha 5: Objetivo Prioritário da Carteira */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#F9F9FB] transition-colors">
                <div className="flex items-center gap-3 sm:w-1/3">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <Target size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#1D1D1F] block">Foco Estratégico</span>
                    <span className="text-[10px] text-[#86868B] block">Prioridade número 1</span>
                  </div>
                </div>
                <div className="sm:w-2/3">
                  <input
                    type="text"
                    value={primaryFocus}
                    onChange={(e) => setPrimaryFocus(e.target.value)}
                    placeholder="Ex: Otimização de Cartões e Fluxo de Caixa"
                    className="w-full bg-[#F2F2F7] focus:bg-white rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#1D1D1F] font-medium border border-transparent focus:border-black/10 focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/15 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Barra de Ação Inferior */}
            <div className="p-4 sm:p-5 bg-[#FAFAFC] border-t border-black/[0.05] flex items-center justify-between">
              <span className="text-[11px] text-[#86868B]">
                Suas informações são salvas com criptografia local e no Firestore
              </span>
              <button
                type="submit"
                className="bg-[#1D1D1F] hover:bg-black text-white px-6 py-2.5 rounded-xl text-xs font-semibold active:scale-[0.98] transition-all shadow-xs cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ABA 3: SEGURANÇA, LGPD & CONTA */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-in fade-in duration-300 font-sans">
          {/* Card de Sessão Apple ID */}
          <section className="bg-white rounded-[26px] p-6 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-[#2C2C2E] to-[#1C1C1E] text-white flex items-center justify-center font-semibold text-sm shadow-xs">
                  {userProfile.avatarInitials}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1D1D1F]">
                    Sessão Apple ID Ativa
                  </h3>
                  <p className="text-xs text-[#86868B] font-mono">
                    {user?.email || userProfile.email}
                  </p>
                </div>
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
          </section>

          {/* Card de Privacidade & Conformidade LGPD */}
          <section className="bg-white rounded-[26px] p-6 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>Proteção de Dados & Privacidade (LGPD)</span>
                  </h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                    Lei 13.709/2018
                  </span>
                </div>
                <p className="text-xs text-[#86868B] mt-1 max-w-lg leading-relaxed">
                  Seus dados financeiros são processados em conformidade com as diretrizes de segurança da Apple. Você tem direito à portabilidade completa e transparência contábil.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsLgpdModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#1D1D1F] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-all cursor-pointer"
                >
                  <FileText size={13} />
                  <span>Ver Termos LGPD</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={isExportingData}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1D1D1F] hover:bg-black active:scale-95 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
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
          </section>

          {/* Card de Exclusão Definitiva (Área Sensível Apple) */}
          <section className="bg-rose-50/40 rounded-[26px] p-6 border border-rose-200/60 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                  <Lock size={13} />
                  <span>Exclusão Definitiva de Dados (LGPD Art. 18, VI)</span>
                </h4>
                <p className="text-[11px] text-[#86868B] mt-1 max-w-md leading-relaxed">
                  Apaga permanentemente todo o seu histórico de transações, faturas, cartões, metas, diagnósticos e conversas de IA no Firestore. Esta ação é irreversível.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDeleteAccountOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 border border-rose-200 bg-white hover:bg-rose-100 active:scale-95 transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 size={13} strokeWidth={2} />
                <span>Excluir Minha Conta</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modais Apple do Sistema */}
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

      <LgpdTermsModal
        isOpen={isLgpdModalOpen}
        onClose={() => setIsLgpdModalOpen(false)}
        hasAccepted={true}
      />
    </div>
  );
}
