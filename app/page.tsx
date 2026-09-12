"use client";

import React from "react";
import Link from "next/link";
import { Wallet3DShowcase } from "@/components/ui/Wallet3DShowcase";
import {
  Sparkles,
  ShieldCheck,
  CreditCard,
  TrendingUp,
  ArrowRight,
  Layers,
  ChevronRight,
  Zap,
  CheckCircle2,
  Lock,
  Compass,
  UserPlus,
  Sliders,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";

export default function PresentationPage() {
  const { userProfile } = useWallet();

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-[#1D1D1F] font-sans selection:bg-[#1D1D1F] selection:text-white pb-24">
      
      {/* Top Navbar Wallet Intelligence Standard */}
      <header className="sticky top-0 z-50 bg-[#F2F2F7]/85 backdrop-blur-xl border-b border-black/[0.04]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              W
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-[#1D1D1F]">
                Wallet
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1D1D1F] text-white font-mono">
                Intelligence
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-[#86868B]">
            <a href="#showcase" className="hover:text-[#1D1D1F] transition-colors">
              Passes 3D
            </a>
            <a href="#ai-engine" className="hover:text-[#1D1D1F] transition-colors">
              Inteligência Integrada
            </a>
            <a href="#personas" className="hover:text-[#1D1D1F] transition-colors">
              Arquétipos
            </a>
            <a href="#onboarding" className="hover:text-[#1D1D1F] transition-colors">
              Criar Perfil
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="hidden sm:inline-flex text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              Meu Perfil
            </Link>
            <Link
              href="/dashboard"
              className="bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <span>Acessar Carteira</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-12 md:pt-16 pb-6 text-center space-y-5">
        
        {/* Badge Luminoso */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-black/[0.06] shadow-xs text-xs font-medium text-[#86868B] animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[#1D1D1F] font-semibold">Wallet Intelligence</span>
          <span>•</span>
          <span className="font-mono text-[11px]">Pass Kit Standard</span>
        </div>

        {/* Headline Principal */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F] leading-[1.08] max-w-3xl mx-auto">
          Uma nova dimensão para a sua vida financeira.
        </h1>

        {/* Subtítulo */}
        <p className="text-base sm:text-lg text-[#86868B] max-w-2xl mx-auto font-normal leading-relaxed">
          Esqueça planilhas e registradores estáticos. O Wallet Intelligence une o padrão físico
          do Pass Kit a um motor de IA contextual que antecipa vencimentos, isola o crédito da conta
          corrente e personaliza conselhos ao seu arquétipo.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="bg-[#1D1D1F] hover:bg-black text-white text-sm font-semibold px-6 py-3.5 rounded-full transition-all flex items-center gap-2 shadow-[0_4px_16px_rgba(0,0,0,0.15)] active:scale-98 cursor-pointer"
          >
            <span>Abrir Minha Carteira</span>
            <ChevronRight size={16} />
          </Link>

          <a
            href="#onboarding"
            className="bg-white hover:bg-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold px-6 py-3.5 rounded-full transition-all border border-black/[0.06] shadow-xs cursor-pointer"
          >
            Criar Perfil de Carteira
          </a>
        </div>
      </section>

      {/* 3D Physical Wallet Showcase Stage */}
      <section id="showcase" className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-gradient-to-b from-white/95 to-white/70 backdrop-blur-2xl rounded-[36px] p-6 sm:p-10 border border-black/[0.04] shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative overflow-hidden">
          
          <div className="text-center max-w-lg mx-auto mb-4 space-y-1">
            <span className="text-[11px] uppercase font-semibold tracking-widest text-[#86868B] font-mono">
              Wallet Pass Kit Interativo
            </span>
            <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
              A Carteira Física no seu Navegador
            </h2>
            <p className="text-xs text-[#86868B]">
              Compartimento em couro e titânio com entalhe thumb scoop. Clique em qualquer pass para deslizá-lo para fora.
            </p>
          </div>

          <Wallet3DShowcase />
        </div>
      </section>

      {/* SEÇÃO DA INTELIGÊNCIA INTEGRADA (Estilo Pass Kit Minimalista) */}
      <section id="ai-engine" className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-[11px] uppercase font-semibold tracking-widest text-[#86868B] font-mono">
            Motor de Inteligência Contextual
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] tracking-tight">
            Como a IA do Wallet Intelligence funciona na prática.
          </h2>
          <p className="text-sm text-[#86868B] leading-relaxed">
            Em vez de um chatbot genérico que exige perguntas soltas, o Wallet Intelligence
            opera como um sistema silencioso em segundo plano, monitorando snapshots da sua carteira.
          </p>
        </div>

        {/* Grade de Passes de Inteligência (Pass Kit Anatomy) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Pass 1: Otimização Preditiva de Fatura */}
          <div className="bg-white rounded-[26px] p-6 border border-black/[0.05] shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-xs font-semibold uppercase tracking-wider font-mono text-[#1D1D1F]">
                  PASS #01 • MOTOR PREDITIVO
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-[#F2F2F7] px-2 py-0.5 rounded-full text-[#86868B]">
                TEMPO REAL
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Janela Ideal de Compra sem Juros
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                A IA cruza as datas de fechamento e vencimento de todos os seus cartões cadastrados. Ao registrar uma despesa, ela indica automaticamente qual cartão oferece a maior janela de prazo (até 40 dias para pagar) mantendo sua conta corrente intocada.
              </p>
            </div>

            <div className="bg-[#F2F2F7] rounded-xl p-3.5 border border-black/[0.03] space-y-1 text-xs">
              <div className="flex justify-between items-center text-[10px] uppercase font-mono text-[#86868B]">
                <span>DIRETRIZ DA IA</span>
                <span className="text-purple-600 font-semibold">ATIVO</span>
              </div>
              <p className="text-[#1D1D1F] font-medium leading-relaxed">
                "Fatura do Nubank fecha dia 08. Compras realizadas hoje serão cobradas somente no mês seguinte."
              </p>
            </div>
          </div>

          {/* Pass 2: Proteção Anti-Juros Rotativos */}
          <div className="bg-white rounded-[26px] p-6 border border-black/[0.05] shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-wider font-mono text-[#1D1D1F]">
                  PASS #02 • BLINDAGEM DE CRÉDITO
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-[#F2F2F7] px-2 py-0.5 rounded-full text-[#86868B]">
                ZERO JUROS
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Separação Física de Faturas e Conta Corrente
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                Nenhuma compra em cartão de crédito abate seu Saldo Principal imediatamente. A IA aloca na fatura aberta correspondente e só calcula o débito na liquidação consciente, eliminando o susto de faturas inesperadas.
              </p>
            </div>

            <div className="bg-[#F2F2F7] rounded-xl p-3.5 border border-black/[0.03] space-y-1 text-xs">
              <div className="flex justify-between items-center text-[10px] uppercase font-mono text-[#86868B]">
                <span>MÉTRICA DE SEGURANÇA</span>
                <span className="text-blue-600 font-semibold">100% QUITAÇÃO</span>
              </div>
              <p className="text-[#1D1D1F] font-medium leading-relaxed">
                "O saldo disponível para quitação cobre integralmente todas as faturas em aberto no ciclo atual."
              </p>
            </div>
          </div>

          {/* Pass 3: Previsibilidade Futura de 4 Meses */}
          <div className="bg-white rounded-[26px] p-6 border border-black/[0.05] shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider font-mono text-[#1D1D1F]">
                  PASS #03 • FLUXO FUTURO
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-[#F2F2F7] px-2 py-0.5 rounded-full text-[#86868B]">
                PROJEÇÃO
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Cálculo de Saldo Livre Antecipado
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                A IA projeta quanto dinheiro líquido você terá nos próximos meses, deduzindo automaticamente aluguel, condomínio, assinaturas fixas e parcelas de compras passadas.
              </p>
            </div>

            <div className="bg-[#F2F2F7] rounded-xl p-3.5 border border-black/[0.03] space-y-1 text-xs">
              <div className="flex justify-between items-center text-[10px] uppercase font-mono text-[#86868B]">
                <span>HORIZONTE 2026</span>
                <span className="text-amber-600 font-semibold">OUT • NOV • DEZ</span>
              </div>
              <p className="text-[#1D1D1F] font-medium leading-relaxed">
                "Comprometimento de 38% em Outubro reduzindo para 22% em Dezembro. Janela ideal para aportes em metas."
              </p>
            </div>
          </div>

          {/* Pass 4: Calibração por Arquétipo */}
          <div className="bg-white rounded-[26px] p-6 border border-black/[0.05] shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wider font-mono text-[#1D1D1F]">
                  PASS #04 • ADAPTAÇÃO AO PERFIL
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-[#F2F2F7] px-2 py-0.5 rounded-full text-[#86868B]">
                CUSTOMIZÁVEL
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Raciocínio Moldado ao seu Momento
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                A IA não aplica uma fórmula rígida para todos. Ela consulta seu Arquétipo e o tom escolhido (Analítico Suíço, Mentor Direto ou Parceiro Estratégico) antes de emitir qualquer parecer.
              </p>
            </div>

            <div className="bg-[#F2F2F7] rounded-xl p-3.5 border border-black/[0.03] space-y-1 text-xs">
              <div className="flex justify-between items-center text-[10px] uppercase font-mono text-[#86868B]">
                <span>ARQUÉTIPO ATIVO</span>
                <span className="text-emerald-600 font-semibold">{userProfile.persona.toUpperCase()}</span>
              </div>
              <p className="text-[#1D1D1F] font-medium leading-relaxed">
                "Foco calibrado em: {userProfile.primaryFocus}."
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* SEÇÃO DE ARQUÉTIPOS (Wallet Personas) */}
      <section id="personas" className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        <div className="bg-gradient-to-br from-[#1C1C1E] via-[#151518] to-[#0D0D10] text-white rounded-[32px] p-8 md:p-12 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.2)] space-y-8">
          
          <div className="space-y-2 max-w-2xl">
            <span className="text-[10px] uppercase font-mono tracking-widest text-purple-400 font-semibold">
              WALLET ID • FINANCIAL PERSONAS
            </span>
            <h2 className="text-3xl font-semibold text-white tracking-tight">
              Qual é o seu Arquétipo de Carteira?
            </h2>
            <p className="text-xs text-white/70 leading-relaxed">
              O Wallet Intelligence se adapta a 4 estratégias de conduta financeira reconhecidas globalmente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                id: "optimizer",
                symbol: "💎",
                title: "The Optimizer",
                badge: "Milhas & Cashback",
                desc: "Concentra gastos no crédito, maximiza pontos e paga 100% da fatura em dia.",
              },
              {
                id: "guardian",
                symbol: "🛡️",
                title: "The Guardian",
                badge: "Segurança 12 Meses",
                desc: "Alta previsibilidade, colchão de liquidez robusto e aversão a riscos desnecessários.",
              },
              {
                id: "scaler",
                symbol: "🚀",
                title: "The Scaler",
                badge: "Alto Crescimento",
                desc: "Múltiplos fluxos, tolerância calculada ao risco e reinvestimento contínuo.",
              },
              {
                id: "minimalist",
                symbol: "🌿",
                title: "The Minimalist",
                badge: "Taxa Poupança >50%",
                desc: "Custos essenciais enxutos, consumo consciente e meta de independência financeira.",
              },
            ].map((p) => {
              const isActive = userProfile.persona === p.id;
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl p-5 flex flex-col justify-between space-y-3 transition-all ${
                    isActive
                      ? "bg-white/15 border-2 border-white/40 shadow-lg scale-102"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div>
                    <div className="text-2xl mb-2">{p.symbol}</div>
                    <h4 className="font-semibold text-sm text-white">{p.title}</h4>
                    <span className="text-[10px] text-white/50 font-mono block mt-0.5">
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">{p.desc}</p>
                  {isActive && (
                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 pt-1 border-t border-white/10">
                      <CheckCircle2 size={12} /> Seu Arquétipo Ativo
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex justify-end">
            <Link
              href="/profile"
              className="text-xs font-semibold text-white hover:underline flex items-center gap-1.5"
            >
              <span>Personalizar meu Arquétipo no Perfil</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* SEÇÃO ONBOARDING: CRIAR PERFIL DE CARTEIRA (Para novos usuários / sem login) */}
      <section id="onboarding" className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-[32px] p-8 md:p-12 border border-black/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.04)] space-y-8">
          
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center mx-auto shadow-xs">
              <UserPlus size={22} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] tracking-tight">
              Novo no Wallet? Crie sua Identidade.
            </h2>
            <p className="text-xs sm:text-sm text-[#86868B] leading-relaxed">
              Configure sua renda base, ative seu arquétipo e defina o tom do seu consultor com IA em menos de 1 minuto.
            </p>
          </div>

          {/* 3 Passos Simples */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="p-4 rounded-2xl bg-[#F2F2F7] space-y-1.5 border border-black/[0.02]">
              <span className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h4 className="font-semibold text-xs text-[#1D1D1F]">Defina sua Renda Base</h4>
              <p className="text-[11px] text-[#86868B]">
                Informe sua média de entradas mensais para calibrar as projeções de faturas.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F2F2F7] space-y-1.5 border border-black/[0.02]">
              <span className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h4 className="font-semibold text-xs text-[#1D1D1F]">Escolha seu Arquétipo</h4>
              <p className="text-[11px] text-[#86868B]">
                Selecione entre The Optimizer, The Guardian, The Scaler ou The Minimalist.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F2F2F7] space-y-1.5 border border-black/[0.02]">
              <span className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h4 className="font-semibold text-xs text-[#1D1D1F]">Adicione seus Passes</h4>
              <p className="text-[11px] text-[#86868B]">
                Cadastre seus cartões reais com limite e dias de vencimento.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/profile"
              className="w-full sm:w-auto bg-[#1D1D1F] hover:bg-black text-white text-sm font-semibold px-8 py-3.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
            >
              <span>Criar Meu Perfil Agora</span>
              <ArrowRight size={16} />
            </Link>

            <Link
              href="/dashboard"
              className="w-full sm:w-auto bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold px-8 py-3.5 rounded-full transition-all border border-black/[0.05] flex items-center justify-center"
            >
              <span>Explorar Demo no Dashboard</span>
            </Link>
          </div>

        </div>
      </section>

      {/* Rodapé Minimalista Wallet Intelligence */}
      <footer className="max-w-5xl mx-auto px-6 pt-10 border-t border-black/[0.06] text-center text-xs text-[#86868B] space-y-2">
        <p className="font-medium text-[#1D1D1F]">
          Wallet Intelligence • Wallet Pass Kit Architecture
        </p>
        <p className="text-[11px] text-[#86868B]/70">
          Controle financeiro avançado, motor de crédito e consultoria preditiva com IA.
        </p>
      </footer>

    </div>
  );
}