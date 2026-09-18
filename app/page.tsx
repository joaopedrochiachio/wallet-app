"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Wallet3DShowcase } from "@/components/ui/Wallet3DShowcase";
import {
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Compass,
  UserPlus,
  Sliders,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";

export default function PresentationPage() {
  const { userProfile } = useWallet();

  return (
    <div className="w-full min-h-screen bg-[#F2F2F7] text-[#1D1D1F] font-sans selection:bg-[#1D1D1F] selection:text-white pb-24">
      
      {/* Top Navbar Wallet Intelligence Standard */}
      <header className="sticky top-0 z-50 w-full bg-[#F2F2F7]/85 backdrop-blur-xl border-b border-black/[0.04]">
        <div className="w-full max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/logo2.png"
              alt="Wallet Logo"
              width={36}
              height={36}
              className="rounded-xl object-contain shadow-xs shrink-0"
              priority
            />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-[#1D1D1F]">
                Wallet
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#1D1D1F] text-white">
                Intelligence
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6E6E73]">
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
              href="/login"
              className="hidden sm:inline-flex text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors px-2 py-1"
            >
              Entrar
            </Link>
            <Link
              href="/login"
              className="bg-[#1D1D1F] hover:bg-black text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <span>Acessar Carteira</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full max-w-4xl mx-auto px-6 pt-10 md:pt-14 pb-6 text-center space-y-5">
        
        {/* Logo Icon Hero */}
        <div className="flex justify-center animate-in fade-in zoom-in-95 duration-500">
          <div className="relative group p-1">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-500 rounded-[28px] blur-md opacity-20 group-hover:opacity-35 transition duration-500" />
            <Image
              src="/logo2.png"
              alt="Wallet App Icon"
              width={84}
              height={84}
              className="relative rounded-[24px] shadow-[0_12px_32px_rgba(0,0,0,0.1)] border border-black/5 hover:scale-105 transition-transform duration-300"
              priority
            />
          </div>
        </div>

        {/* Badge Luminoso */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-black/[0.06] shadow-xs text-xs font-medium text-[#6E6E73] animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[#1D1D1F] font-semibold">Wallet Intelligence</span>
          <span>•</span>
          <span>Pass Kit Standard</span>
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
            href="/login"
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

      {/* SEÇÃO DA INTELIGÊNCIA INTEGRADA (Estilo Cupertino Minimalista & Tátil) */}
      <section id="ai-engine" className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-black/[0.05] shadow-2xs text-[11px] font-semibold uppercase tracking-widest text-[#86868B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1D1D1F]" />
            <span>Engenharia de Dados Financeiros</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] tracking-tight">
            Como o Wallet Intelligence opera na prática.
          </h2>
          <p className="text-sm text-[#86868B] leading-relaxed">
            Sem chatbots invasivos ou assistentes ruidosos. O sistema atua silenciosamente no núcleo da sua carteira,
            alinhando calendários de vencimento, blindando sua conta corrente e projetando sua liquidez futura com precisão cirúrgica.
          </p>
        </div>

        {/* Grade de 4 Módulos Visuais 3D Táteis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Módulo 1: Timeline de Prazos Inteligente (Janela sem Juros) */}
          <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-black/[0.05] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-all group">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1D1D1F]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Prazos & Liquidez
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-[#F2F2F7] px-2.5 py-0.5 rounded-full text-[#1D1D1F] font-semibold">
                +40 Dias sem Juros
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Janela Ótima de Compra no Crédito
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                Ao selecionar o cartão no momento da compra, o motor sincroniza os dias de fechamento e vencimento de todos os seus passes, indicando o cartão com o maior prazo de pagamento para manter sua conta corrente rendendo.
              </p>
            </div>

            {/* Visual 3D Tátil da Timeline de Prazos */}
            <div className="bg-[#F2F2F7]/80 rounded-2xl p-4 border border-black/[0.03] space-y-3">
              <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-[#86868B]">
                <span>Fluxo de Pagamento Otimizado</span>
                <span className="text-emerald-600 font-bold">0% Juros</span>
              </div>

              {/* Timeline em cápsula elegante */}
              <div className="relative flex items-center justify-between pt-1">
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                    1
                  </div>
                  <span className="text-[10px] font-semibold text-[#1D1D1F]">Compra Hoje</span>
                  <span className="text-[9px] text-[#86868B]">Dia 09</span>
                </div>

                <div className="flex-1 h-0.5 bg-gradient-to-r from-[#1D1D1F] via-gray-300 to-emerald-500 mx-2 -mt-4 relative">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-white text-[9px] font-mono font-semibold text-[#1D1D1F] shadow-2xs border border-black/5">
                    38 dias livres
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-white border border-black/15 text-[#1D1D1F] flex items-center justify-center text-[10px] font-semibold shadow-2xs">
                    2
                  </div>
                  <span className="text-[10px] font-semibold text-[#1D1D1F]">Fechamento</span>
                  <span className="text-[9px] text-[#86868B]">08 do Mês Seg.</span>
                </div>

                <div className="flex-1 h-0.5 bg-gray-300 mx-2 -mt-4" />

                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                    ✓
                  </div>
                  <span className="text-[10px] font-semibold text-[#1D1D1F]">Vencimento</span>
                  <span className="text-[9px] text-emerald-600 font-semibold">18 Quitação</span>
                </div>
              </div>
            </div>
          </div>

          {/* Módulo 2: Blindagem Estrutural da Conta Corrente */}
          <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-black/[0.05] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-all group">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1D1D1F]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Arquitetura de Caixa
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-[#F2F2F7] px-2.5 py-0.5 rounded-full text-[#1D1D1F] font-semibold">
                Isolamento Físico
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Separação Clara entre Saldo e Faturas
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                Compras parceladas ou no crédito não descontam o seu saldo no ato. Elas são provisionadas em compartimentos virtuais separados, eliminando falsas impressões de saldo zerado e evitando o endividamento por desorganização.
              </p>
            </div>

            {/* Visual de 2 Mini Passes Sobrepostos 3D */}
            <div className="bg-[#F2F2F7]/80 rounded-2xl p-4 border border-black/[0.03] space-y-2.5">
              <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-black/5 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#1D1D1F] text-white flex items-center justify-center text-[10px] font-bold">
                    $
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#1D1D1F] block">Conta Corrente</span>
                    <span className="text-[10px] text-[#86868B]">Saldo líquido disponível</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  100% Protegido
                </span>
              </div>

              <div className="flex items-center justify-between bg-white/70 rounded-xl p-3 border border-black/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gray-200 text-[#1D1D1F] flex items-center justify-center text-[10px] font-bold">
                    💳
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#1D1D1F] block">Faturas Provisionadas</span>
                    <span className="text-[10px] text-[#86868B]">Compromisso isolado do mês</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#86868B]">
                  Liquidação programada
                </span>
              </div>
            </div>
          </div>

          {/* Módulo 3: Horizonte Previsível de 4 Meses */}
          <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-black/[0.05] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-all group">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1D1D1F]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Planejamento Futuro
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-[#F2F2F7] px-2.5 py-0.5 rounded-full text-[#1D1D1F] font-semibold">
                Projeção Contínua
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Cálculo de Saldo Livre Antecipado
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                O motor computa seus custos fixos e parcelas de compras passadas em um horizonte contínuo, revelando com precisão quanto dinheiro estará 100% desimpedido para aportes em cada um dos próximos meses.
              </p>
            </div>

            {/* Visual de Barras Delicadas de Projeção */}
            <div className="bg-[#F2F2F7]/80 rounded-2xl p-4 border border-black/[0.03] space-y-2">
              <div className="flex justify-between items-center text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
                <span>Taxa de Liquidez Livre Estimada</span>
                <span className="text-[#1D1D1F] font-mono">Ciclos 2026</span>
              </div>

              <div className="space-y-2 pt-1">
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-[#1D1D1F] mb-1">
                    <span>Mês Atual</span>
                    <span className="font-semibold text-emerald-600">65% Livre</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1D1D1F] rounded-full w-[65%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-[#1D1D1F] mb-1">
                    <span>Mês Seguinte</span>
                    <span className="font-semibold text-emerald-600">74% Livre</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1D1D1F] rounded-full w-[74%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-[#1D1D1F] mb-1">
                    <span>Em 60 Dias</span>
                    <span className="font-semibold text-emerald-600">82% Livre</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1D1D1F] rounded-full w-[82%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Módulo 4: Monitoramento Silencioso */}
          <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-black/[0.05] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-all group">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1D1D1F]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Experiência Silenciosa
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-[#F2F2F7] px-2.5 py-0.5 rounded-full text-[#1D1D1F] font-semibold">
                Zero Poluição
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Insights Pontuais que Respeitam sua Atenção
              </h3>
              <p className="text-xs text-[#86868B] leading-relaxed">
                Sem banners intrusivos ou avisos de pânico. A inteligência contextual emite relatórios compactos e recomendações no momento exato em que você precisa decidir sobre faturas, investimentos ou metas.
              </p>
            </div>

            {/* Micro Notificação Estilo Apple */}
            <div className="bg-[#F2F2F7]/80 rounded-2xl p-4 border border-black/[0.03] space-y-2">
              <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-black/5 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0">
                  <ShieldCheck size={16} strokeWidth={1.5} />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-[#1D1D1F] block">
                    Fatura Consolidada Liquidada
                  </span>
                  <p className="text-[11px] text-[#86868B] leading-relaxed">
                    Saldo corrente intacto. Janela de 12 dias favorável para alocação do excedente na meta prioritária.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SEÇÃO DE ARQUÉTIPOS: VISUAL DELICADO, TÁTIL E COM ARQUITETURA DE PASSES */}
      <section id="personas" className="max-w-5xl mx-auto px-6 py-14">
        <div className="bg-gradient-to-b from-white/95 to-white/70 backdrop-blur-2xl rounded-[36px] p-8 md:p-12 border border-black/[0.06] shadow-[0_20px_50px_rgba(0,0,0,0.04)] space-y-10">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F2F2F7] border border-black/[0.04] text-[11px] font-semibold uppercase tracking-widest text-[#86868B]">
              <span>Wallet Pass Kit • Filosofias Financeiras</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] tracking-tight">
              Quatro arquétipos. Uma experiência sob medida.
            </h2>
            <p className="text-sm text-[#86868B] leading-relaxed">
              O Wallet Intelligence não impõe uma conduta única. Ele se calibra à sua mentalidade patrimonial,
              priorizando retorno em pontos, liquidez de segurança ou aceleração contínua.
            </p>
          </div>

          {/* Grid de Passes de Arquétipo com Estética Física Delicada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                id: "optimizer",
                icon: TrendingUp,
                name: "The Optimizer",
                badge: "Pontos & Cashback",
                desc: "Concentra o fluxo no crédito, maximiza prazos de vencimento e quita faturas no dia exato sem incidência de juros.",
                metric: "Retorno por Gasto",
                accent: "text-amber-500",
                chipBorder: "border-amber-200/60",
              },
              {
                id: "guardian",
                icon: ShieldCheck,
                name: "The Guardian",
                badge: "Segurança 12 Meses",
                desc: "Privilegia a previsibilidade absoluta, mantém colchão de liquidez protegido e evita compromissos de longo prazo.",
                metric: "Reserva Intocável",
                accent: "text-emerald-500",
                chipBorder: "border-emerald-200/60",
              },
              {
                id: "scaler",
                icon: Compass,
                name: "The Scaler",
                badge: "Crescimento Ativo",
                desc: "Gerencia múltiplos cartões com estratégia, suporta alavancagem planejada e direciona fluxo para metas de alto impacto.",
                metric: "Aporte Patrimonial",
                accent: "text-blue-500",
                chipBorder: "border-blue-200/60",
              },
              {
                id: "minimalist",
                icon: Sliders,
                name: "The Minimalist",
                badge: "Poupança > 50%",
                desc: "Elimina custos fixos supérfluos, mantém poucas assinaturas ativas e foca na clareza de viver abaixo da renda.",
                metric: "Custo Fixo Mínimo",
                accent: "text-purple-500",
                chipBorder: "border-purple-200/60",
              },
            ].map((p) => {
              const Icon = p.icon;
              const isActive = userProfile.persona === p.id;
              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-[24px] p-5 border flex flex-col justify-between space-y-4 transition-all duration-300 shadow-2xs hover:shadow-md hover:-translate-y-1 relative overflow-hidden ${
                    isActive
                      ? "border-[#1D1D1F] ring-1 ring-[#1D1D1F]"
                      : "border-black/[0.06] hover:border-black/20"
                  }`}
                >
                  {/* Micro Chip EMV Tátil no topo do Pass */}
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#F2F2F7] border border-black/5 flex items-center justify-center shadow-2xs">
                      <Icon size={17} className={p.accent} strokeWidth={1.5} />
                    </div>

                    <span className="text-[10px] font-mono uppercase tracking-wider bg-[#F2F2F7] px-2 py-0.5 rounded-full text-[#86868B] font-semibold">
                      {p.metric}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-[#1D1D1F] tracking-tight">
                      {p.name}
                    </h3>
                    <span className="text-[11px] text-[#86868B] font-medium block mt-0.5">
                      {p.badge}
                    </span>
                    <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                    <span className="text-[#86868B]">Configuração</span>
                    {isActive ? (
                      <span className="font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Ativo
                      </span>
                    ) : (
                      <span className="font-semibold text-[#1D1D1F] group-hover:underline">
                        Selecionável
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-black/[0.04] text-xs text-[#86868B]">
            <span>
              Você pode alterar seu arquétipo a qualquer momento nas configurações do seu perfil.
            </span>
            <Link
              href="/login"
              className="font-semibold text-[#1D1D1F] hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Ajustar meu Arquétipo no Perfil</span>
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
              href="/login"
              className="w-full sm:w-auto bg-[#1D1D1F] hover:bg-black text-white text-sm font-semibold px-8 py-3.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
            >
              <span>Criar Meu Wallet ID Agora</span>
              <ArrowRight size={16} />
            </Link>

            <Link
              href="#showcase"
              className="w-full sm:w-auto bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold px-8 py-3.5 rounded-full transition-all border border-black/[0.05] flex items-center justify-center"
            >
              <span>Ver demonstração 3D</span>
            </Link>
          </div>

        </div>
      </section>

      {/* Rodapé Minimalista Wallet Intelligence */}
      <footer className="max-w-5xl mx-auto px-6 pt-10 border-t border-black/[0.06] text-center text-xs text-[#86868B] space-y-3 flex flex-col items-center">
        <Image
          src="/logo2.png"
          alt="Wallet Logo"
          width={36}
          height={36}
          className="rounded-xl opacity-90 mx-auto"
        />
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
