"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet, FinancialPersonaId, RiskToleranceId, AIToneId } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  Shield,
  Zap,
  Leaf,
  ChevronLeft,
  Check,
  CheckCircle2,
  Bot,
  Award,
  LogOut,
} from "lucide-react";

interface PersonaConfig {
  id: FinancialPersonaId;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
  gradient: string;
  border: string;
  accent: string;
  description: string;
  aiDirective: string;
}

const PERSONAS: PersonaConfig[] = [
  {
    id: "optimizer",
    title: "The Optimizer",
    subtitle: "Milhas, Pontos & Eficiência",
    badge: "Eficiência Máxima",
    icon: <Sparkles size={18} strokeWidth={1.5} />,
    gradient: "from-[#1F0A2E] via-[#150620] to-[#0C0212]",
    border: "border-purple-500/30",
    accent: "text-purple-300",
    description:
      "Concentra compras no crédito para acúmulo de pontos/cashback e quita 100% da fatura no vencimento, sem pagar 1 centavo de juros.",
    aiDirective:
      "A IA priorizará estratégias de concentração de gastos em cartões de benefícios e otimização de faturas.",
  },
  {
    id: "guardian",
    title: "The Guardian",
    subtitle: "Segurança & Reserva Forte",
    badge: "Alta Previsibilidade",
    icon: <Shield size={18} strokeWidth={1.5} />,
    gradient: "from-[#0A192F] via-[#081224] to-[#040914]",
    border: "border-blue-500/30",
    accent: "text-blue-300",
    description:
      "Preza pela previsibilidade absoluta, manutenção de 6 a 12 meses de reserva e mínimo comprometimento com dívidas.",
    aiDirective:
      "A IA alertará com rigor sobre qualquer gasto supérfluo que ameace a reserva de emergência.",
  },
  {
    id: "scaler",
    title: "The Scaler",
    subtitle: "Empreendedor & Alto Crescimento",
    badge: "Renda Variável & Oportunidades",
    icon: <Zap size={18} strokeWidth={1.5} />,
    gradient: "from-[#2B170B] via-[#1E0F06] to-[#100703]",
    border: "border-orange-500/30",
    accent: "text-orange-300",
    description:
      "Múltiplos fluxos de receita, disposição calculada a investimentos de crescimento e reinvestimento no próprio negócio.",
    aiDirective:
      "A IA analisará sazonalidades de receita e sugerirá momento ideal para aportes e expansões.",
  },
  {
    id: "minimalist",
    title: "The Minimalist",
    subtitle: "Frugalidade Elegante & FIRE",
    badge: "Taxa de Poupança > 50%",
    icon: <Leaf size={18} strokeWidth={1.5} />,
    gradient: "from-[#062419] via-[#041911] to-[#020D09]",
    border: "border-emerald-500/30",
    accent: "text-emerald-300",
    description:
      "Controle cirúrgico de custos fixos, busca por independência financeira antecipada e consumo consciente sem desperdício.",
    aiDirective:
      "A IA calculará constantemente o tempo restante até a independência financeira com base na taxa de poupança.",
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { userProfile, updateUserProfile, cards, mainBalance } = useWallet();

  const [name, setName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);
  const [role, setRole] = useState(userProfile.role);
  const [incomeInput, setIncomeInput] = useState(userProfile.monthlyIncomeBase.toString());
  const [primaryFocus, setPrimaryFocus] = useState(userProfile.primaryFocus);
  const [maxCommitment, setMaxCommitment] = useState(userProfile.maxCommitmentAlertPercent);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    if (window.confirm("Deseja realmente encerrar sua sessão?")) {
      await signOut();
      router.push("/login");
    }
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const activePersona = PERSONAS.find((p) => p.id === userProfile.persona) || PERSONAS[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectPersona = (personaId: FinancialPersonaId) => {
    updateUserProfile({ persona: personaId });
    showToast(`Arquétipo atualizado para ${PERSONAS.find((p) => p.id === personaId)?.title}!`);
  };

  const handleSelectTone = (tone: AIToneId) => {
    updateUserProfile({ aiTone: tone });
    showToast("Tom do Consultor IA atualizado!");
  };

  const handleSelectRisk = (risk: RiskToleranceId) => {
    updateUserProfile({ riskTolerance: risk });
    showToast("Tolerância a risco atualizada!");
  };

  const handleSaveProfileData = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIncome = parseFloat(incomeInput.replace(/\./g, "").replace(",", "."));
    const finalIncome = isNaN(cleanIncome) || cleanIncome <= 0 ? userProfile.monthlyIncomeBase : cleanIncome;

    updateUserProfile({
      name: name.trim() || userProfile.name,
      email: email.trim() || userProfile.email,
      role: role.trim() || userProfile.role,
      monthlyIncomeBase: finalIncome,
      primaryFocus: primaryFocus.trim() || userProfile.primaryFocus,
      maxCommitmentAlertPercent: maxCommitment,
    });

    showToast("Perfil atualizado com sucesso!");
  };

  return (
    <div className="min-h-full bg-[#F2F2F7] p-6 md:p-10 text-[#1D1D1F] font-sans space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-24 md:pb-12">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#1D1D1F] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-2">
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

      {/* Hero Apple ID Card */}
      <section className="bg-gradient-to-br from-[#1C1C1E] via-[#141416] to-[#0A0A0C] text-white rounded-[28px] p-6 md:p-8 shadow-[0_20px_40px_rgba(0,0,0,0.12)] border border-white/10 relative overflow-hidden">
        {/* Glow dinâmico no fundo */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar Monograma com Aura */}
            <div className="relative">
              <div className="w-18 h-18 md:w-20 md:h-20 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-500 text-white font-semibold text-2xl flex items-center justify-center border-2 border-white/20 shadow-lg">
                {userProfile.avatarInitials}
              </div>
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#1C1C1E] shadow-xs flex items-center justify-center" title="Carteira Ativa">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  {userProfile.name}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/15 text-white/90 border border-white/10">
                  {activePersona.title}
                </span>
              </div>
              <p className="text-xs text-white/70">{userProfile.role}</p>
              <p className="text-xs text-white/40 font-mono">{userProfile.email}</p>
            </div>
          </div>

          {/* Quick Metrics no Cartão */}
          <div className="grid grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 text-left">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/50 block">Renda Base</span>
              <span className="text-sm font-semibold text-white">
                R$ {formatCurrency(userProfile.monthlyIncomeBase)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/50 block">Cartões</span>
              <span className="text-sm font-semibold text-white">{cards.length} ativos</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/50 block">Saldo Atual</span>
              <span className="text-sm font-semibold text-emerald-400">
                R$ {formatCurrency(mainBalance)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Seletor de Arquétipos Financeiros (Wallet Persona) */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B] px-1">
              Arquétipo de Carteira (Wallet Persona)
            </h2>
            <span className="text-xs text-[#86868B]">Define o raciocínio da IA</span>
          </div>
          <p className="text-xs text-[#86868B] px-1 mt-0.5">
            Selecione a identidade financeira que melhor descreve o seu momento de vida e objetivos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PERSONAS.map((p) => {
            const isSelected = userProfile.persona === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPersona(p.id)}
                className={`rounded-[22px] p-5 cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? `bg-white border-2 border-[#1D1D1F] shadow-[0_8px_24px_rgba(0,0,0,0.08)] scale-[1.01]`
                    : `bg-white border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-black/10`
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.gradient} text-white flex items-center justify-center shadow-xs`}
                    >
                      {p.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                        <span>{p.title}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#1D1D1F]" />
                        )}
                      </h3>
                      <p className="text-[11px] text-[#86868B]">{p.subtitle}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                      isSelected
                        ? "bg-[#1D1D1F] text-white"
                        : "bg-[#F2F2F7] text-[#86868B]"
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>

                <p className="text-xs text-[#86868B] leading-relaxed">
                  {p.description}
                </p>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-[#86868B] flex items-center gap-1">
                    <Bot size={13} className="text-[#1D1D1F]" />
                    <strong className="text-[#1D1D1F]">Diretriz da IA:</strong> {p.badge}
                  </span>
                  {isSelected && (
                    <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                      <Check size={14} /> Ativo
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Diretrizes & Parâmetros do Consultor IA (Gemini) */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B] px-1">
          Comportamento da Inteligência Artificial (Gemini Advisor)
        </h2>

        <div className="bg-white rounded-[20px] p-6 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-6">
          
          {/* Tom de Voz */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-[#1D1D1F]">
                Tom de Voz do Consultor
              </label>
              <span className="text-xs text-[#86868B]">Como a IA formulará conselhos</span>
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
                  className={`p-3 rounded-xl border text-left transition-all ${
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
                  A IA enviará alertas prioritários se as faturas superarem esta porcentagem da sua renda.
                </p>
              </div>
              <span className="text-sm font-semibold text-[#1D1D1F] bg-[#F2F2F7] px-3 py-1 rounded-full">
                {maxCommitment}% da renda
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {[25, 35, 45, 50].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setMaxCommitment(pct);
                    updateUserProfile({ maxCommitmentAlertPercent: pct });
                    showToast(`Teto de alerta ajustado para ${pct}%`);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
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

          {/* Tolerância ao Risco */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="text-xs font-semibold text-[#1D1D1F]">
              Tolerância a Risco em Recomendações
            </label>
            <div className="bg-[#E5E5EA]/80 p-1 rounded-xl flex items-center gap-1 border border-black/5">
              {[
                { id: "low" as RiskToleranceId, label: "Conservador" },
                { id: "moderate" as RiskToleranceId, label: "Equilibrado" },
                { id: "high" as RiskToleranceId, label: "Arrojado / Crescimento" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRisk(r.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
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

      {/* Seção de Sessão e Logout Estilo Apple HIG */}
      <section className="bg-white rounded-[24px] p-6 shadow-sm border border-black/[0.04] space-y-4">
        <div className="flex items-center justify-between">
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
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100/80 active:scale-95 transition-all cursor-pointer"
          >
            <LogOut size={14} strokeWidth={2} />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </section>

    </div>
  );
}
