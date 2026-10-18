"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  TrendingUp,
  CreditCard,
  Building2,
  Compass,
  Maximize2,
  Minimize2,
  Zap,
  Flame,
  ShieldCheck,
  CalendarDays,
  MessageSquare,
  X,
  ArrowRight,
  Calculator,
  Coins,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { FinancialDiagnosis } from "@/lib/services/financialDiagnosisService";
import { WalletCharacter, WalletCharacterId, WALLET_CHARACTERS } from "@/components/companion/WalletCharacters";
import {
  calculateCashflowAtRisk,
  calculateEmergencyProtection,
  calculateCreditFloatOpportunity,
  calculateGoalEfficiency,
} from "@/lib/services/financialMathService";

export interface MindMapNode {
  id: string;
  parentId?: string;
  label: string;
  agentId: WalletCharacterId;
  agentRole: string;
  category: "core" | "income" | "fixed" | "credit" | "drains" | "reserve" | "goals";
  amount?: number;
  percentage?: number;
  status: "healthy" | "warning" | "alert" | "neutral";
  iconName: string;
  description: string;
  quantSummary: string; // Resumo quantitativo traduzido
  agentSpeech: string; // O que o agente fala ao usuário
  suggestedPrompt: string; // Pergunta pronta para o chat
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  details: {
    kpis: Array<{ label: string; value: string; highlight?: boolean }>;
    actionLabel?: string;
    actionPrompt?: string;
  };
}

interface FinancialMindMapProps {
  diagnosis: FinancialDiagnosis | null;
  cards: any[];
  transactions: any[];
  recurringItems: any[];
  mainBalance: number;
  monthIncome: number;
  monthExpense: number;
  targetEndMonthBalance: number;
  effectiveProjectedFree: number;
  safeDailyAllowance: number;
  remainingDays: number;
  activePersona: string;
  onDiscussWithAI: (topic: string) => void;
  onOpenSimulator?: (params?: { description?: string; amount?: number }) => void;
}

export function FinancialMindMap({
  diagnosis,
  cards,
  transactions,
  recurringItems,
  mainBalance,
  monthIncome,
  monthExpense,
  targetEndMonthBalance,
  effectiveProjectedFree,
  safeDailyAllowance,
  remainingDays,
  activePersona,
  onDiscussWithAI,
  onOpenSimulator,
}: FinancialMindMapProps) {
  // Filtro de clusters de especialistas
  const [activeFilter, setActiveFilter] = useState<"all" | "rubi" | "sol" | "nanquim" | "atlos">("all");

  // Nó selecionado para inspeção
  const [selectedNodeId, setSelectedNodeId] = useState<string>("core");
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Cálculos quantitativos por especialista
  const cfaR = useMemo(() => {
    return calculateCashflowAtRisk({
      mainBalance,
      projectedFreeBalance: effectiveProjectedFree,
      targetEndMonthBalance,
      monthExpense,
      monthIncome,
      remainingDays,
      safeDailyAllowance,
    });
  }, [mainBalance, effectiveProjectedFree, targetEndMonthBalance, monthExpense, monthIncome, remainingDays, safeDailyAllowance]);

  const emergencyFund = useMemo(() => {
    const fixedExpenses = recurringItems
      .filter((i: any) => i.type === "expense" || i.type === "despesa")
      .reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
    const drains = (diagnosis?.specificExpensesAlerts || []).reduce(
      (acc: number, curr: any) => acc + (curr.totalAmount || 0),
      0
    );

    return calculateEmergencyProtection({
      reserveBalance: mainBalance,
      monthlyFixedExpense: fixedExpenses > 0 ? fixedExpenses : 1200,
      invisibleDrainsTotal: drains,
    });
  }, [mainBalance, recurringItems, diagnosis]);

  const creditFloat = useMemo(() => {
    const openInvoicesTotal = cards
      .filter((c: any) => c.type === "credit")
      .reduce((acc: number, curr: any) => acc + (curr.spent || 0), 0);
    return calculateCreditFloatOpportunity({
      openInvoicesTotal,
      bestCardDaysUntilDue: 24, // Estimativa média de prazo livre
    });
  }, [cards]);

  const goalAlloc = useMemo(() => {
    return calculateGoalEfficiency({
      projectedFreeBalance: effectiveProjectedFree,
      targetEndMonthBalance,
      totalGoalsTarget: 5000,
      currentGoalsSaved: 1800,
    });
  }, [effectiveProjectedFree, targetEndMonthBalance]);

  // 1. CONSTRUÇÃO DO GRAFO (DESIGN BRANCO APPLE COM 4 AGENTES)
  const nodes = useMemo<MindMapNode[]>(() => {
    const list: MindMapNode[] = [];

    const isTargetMet = effectiveProjectedFree >= targetEndMonthBalance;
    const margin = effectiveProjectedFree - targetEndMonthBalance;

    // NÓ 1 (CENTRAL): NÚCLEO DE LIQUIDEZ & PROJEÇÃO (Rubi / CFO)
    list.push({
      id: "core",
      label: "Núcleo de Liquidez & Meta",
      agentId: "wallet-rubi",
      agentRole: "CFO & Fluxo de Caixa",
      category: "core",
      amount: effectiveProjectedFree,
      status: isTargetMet ? "healthy" : "warning",
      iconName: "compass",
      description: isTargetMet
        ? `Superando a meta com margem livre de R$ ${formatCurrency(margin)}.`
        : `Defasagem de R$ ${formatCurrency(Math.abs(margin))} para bater a meta de R$ ${formatCurrency(targetEndMonthBalance)}.`,
      quantSummary: cfaR.headline,
      agentSpeech: isTargetMet
        ? `Olá! Como seu CFO, auditei seu fechamento: mantendo o teto de gastos diário em R$ ${formatCurrency(safeDailyAllowance)}, você cumpre a meta de R$ ${formatCurrency(targetEndMonthBalance)} com tranquilidade total.`
        : `Alerta do CFO: estamos a R$ ${formatCurrency(Math.abs(margin))} de alcançar o saldo desejado. Trave gastos supérfluos pelas próximas 48h para recuperar o ritmo.`,
      suggestedPrompt: "Rubi, como posso blindar meu teto de gastos para garantir o fechamento no azul?",
      x: 50,
      y: 48,
      details: {
        kpis: [
          { label: "Saldo em Conta Hoje", value: `R$ ${formatCurrency(mainBalance)}` },
          { label: "Saldo Projetado Fechamento", value: `R$ ${formatCurrency(effectiveProjectedFree)}`, highlight: true },
          { label: "Meta de Fechamento Estipulada", value: `R$ ${formatCurrency(targetEndMonthBalance)}` },
          { label: "Probabilidade de Sucesso (CFaR)", value: `${cfaR.probabilityOfSurplus}%` },
        ],
        actionLabel: "Pedir Estratégia de Fechamento ao Rubi",
        actionPrompt: "Rubi, desenhe um plano de corte diário para aumentar meu saldo de fechamento.",
      },
    });

    // NÓ 2: TETO DIÁRIO SEGURO (Rubi / CFO)
    list.push({
      id: "safe_allowance",
      parentId: "core",
      label: "Teto Seguro Diário",
      agentId: "wallet-rubi",
      agentRole: "CFO & Fluxo de Caixa",
      category: "income",
      amount: safeDailyAllowance,
      status: safeDailyAllowance > 30 ? "healthy" : "warning",
      iconName: "zap",
      description: `R$ ${formatCurrency(safeDailyAllowance)}/dia disponíveis nos próximos ${remainingDays} dias.`,
      quantSummary: "Cashflow at Risk & Limite Discricionário",
      agentSpeech: `Seu teto seguro de hoje é de R$ ${formatCurrency(safeDailyAllowance)}. Se gastar menos que isso hoje, a sobra se acumula para os próximos dias!`,
      suggestedPrompt: "Rubi, se eu gastar R$ 80 hoje em um jantar, quanto meu teto diário cai amanhã?",
      x: 32,
      y: 28,
      details: {
        kpis: [
          { label: "Limite Seguro Hoje", value: `R$ ${formatCurrency(safeDailyAllowance)}/dia`, highlight: true },
          { label: "Dias Restantes no Mês", value: `${remainingDays} dias` },
          { label: "Margem Livre Disponível", value: `R$ ${formatCurrency(Math.max(0, margin))}` },
        ],
        actionLabel: "Simular Gasto Hoje com Rubi",
      },
    });

    // NÓ 3: RENDA & ENTRADAS (Rubi / CFO)
    list.push({
      id: "income",
      parentId: "core",
      label: "Renda & Entradas",
      agentId: "wallet-rubi",
      agentRole: "CFO & Fluxo de Caixa",
      category: "income",
      amount: monthIncome,
      status: "healthy",
      iconName: "trending-up",
      description: `Total de entradas registradas e planejadas para este mês.`,
      quantSummary: "Fluxo de Entrada Recorrente e Previsibilidade",
      agentSpeech: `Suas entradas somam R$ ${formatCurrency(monthIncome)}. Toda entrada antecipada reduz seu risco de fluxo de caixa e aumenta sua liquidez real.`,
      suggestedPrompt: "Rubi, qual a data ideal para receber receitas adicionais e otimizar meu fluxo?",
      x: 68,
      y: 28,
      details: {
        kpis: [
          { label: "Total de Renda do Mês", value: `R$ ${formatCurrency(monthIncome)}`, highlight: true },
          { label: "Comprometimento da Renda", value: `${monthIncome > 0 ? Math.round((monthExpense / monthIncome) * 100) : 0}%` },
        ],
        actionLabel: "Analisar Previsibilidade com Rubi",
      },
    });

    // NÓ 4: RESERVA DE EMERGÊNCIA & RUNWAY (Sol / Reserva)
    list.push({
      id: "reserve",
      parentId: "core",
      label: "Reserva & Proteção Antifrágil",
      agentId: "wallet-sol",
      agentRole: "Reserva & Proteção",
      category: "reserve",
      amount: mainBalance,
      status: emergencyFund.sortinoQuality === "excelente" ? "healthy" : emergencyFund.sortinoQuality === "moderada" ? "warning" : "alert",
      iconName: "shield",
      description: emergencyFund.headline,
      quantSummary: `Runway de ${emergencyFund.runwayMonths} meses de contas fixas`,
      agentSpeech: `Aqui é a Sol! Minha missão é blindar você contra o imprevisível. Sua reserva atual garante ${emergencyFund.runwayDays} dias de sobrevivência sem endividamento.`,
      suggestedPrompt: "Sol, quanto preciso ter na reserva de emergência para ficar 100% tranquila?",
      x: 20,
      y: 50,
      details: {
        kpis: [
          { label: "Autonomia de Sobrevivência", value: `${emergencyFund.runwayDays} dias (${emergencyFund.runwayMonths} meses)`, highlight: true },
          { label: "Meta Recomendada (6 meses)", value: `R$ ${formatCurrency(emergencyFund.safeReserveTarget)}` },
          { label: "Qualidade Antifrágil (Sortino)", value: emergencyFund.sortinoQuality.toUpperCase() },
        ],
        actionLabel: "Perguntar à Sol como Aportar na Reserva",
      },
    });

    // NÓ 5: RADAR DE RALOS & HÁBITOS (Sol / Reserva)
    const drainAlerts = diagnosis?.specificExpensesAlerts || [];
    const drainAmount = drainAlerts.reduce((acc: number, curr: any) => acc + (curr.totalAmount || 0), 0) || 340;
    list.push({
      id: "drains",
      parentId: "reserve",
      label: "Radar de Ralos Invisíveis",
      agentId: "wallet-sol",
      agentRole: "Reserva & Proteção",
      category: "drains",
      amount: drainAmount,
      status: drainAmount > 200 ? "alert" : "neutral",
      iconName: "flame",
      description: `${drainAlerts.length > 0 ? drainAlerts.length : 3} hábitos pequenos consumindo caixa.`,
      quantSummary: "Downside Volatility (Vazamentos de Liquidez)",
      agentSpeech: `Atenção aos pequenos ralos diários! Detectei cerca de R$ ${formatCurrency(drainAmount)} em micro-gastos (lanches, transportes curtos, entregas). Cortar metade disso adiciona quase R$ 200 na sua reserva este mês.`,
      suggestedPrompt: "Sol, quais são os 3 maiores ralos invisíveis no meu extrato este mês?",
      x: 22,
      y: 72,
      details: {
        kpis: [
          { label: "Total em Ralos Identificados", value: `R$ ${formatCurrency(drainAmount)}`, highlight: true },
          { label: "Impacto Anual Projetado", value: `R$ ${formatCurrency(drainAmount * 12)}` },
        ],
        actionLabel: "Pedir à Sol Dicas para Estancar Ralos",
      },
    });

    // NÓ 6: FATURAS & CARTÕES DE CRÉDITO (Nanquim / Crédito)
    const totalInvoices = cards
      .filter((c: any) => c.type === "credit")
      .reduce((acc: number, curr: any) => acc + (curr.spent || 0), 0);

    list.push({
      id: "credit",
      parentId: "core",
      label: "Faturas & Ciclo de Crédito",
      agentId: "wallet-nanquim",
      agentRole: "Crédito & Arbitragem",
      category: "credit",
      amount: totalInvoices,
      status: totalInvoices > 0 ? "warning" : "healthy",
      iconName: "credit-card",
      description: creditFloat.headline,
      quantSummary: "Duration do Passivo & Arbitragem sem Juros",
      agentSpeech: `Nanquim no comando. O cartão de crédito bem usado é alavanca: ao comprar no melhor dia do ciclo, você ganha até 40 dias de prazo enquanto seu dinheiro rende 100% do CDI na conta corrente.`,
      suggestedPrompt: "Nanquim, qual o melhor cartão para eu fazer compras hoje e ganhar mais prazo?",
      x: 78,
      y: 50,
      details: {
        kpis: [
          { label: "Total em Faturas Abertas", value: `R$ ${formatCurrency(totalInvoices)}`, highlight: true },
          { label: "Prazo Médio Livre até Vencimento", value: `${creditFloat.averageDurationDays} dias` },
          { label: "Estratégia Recomendada", value: creditFloat.bestStrategy === "aproveitar_fatura" ? "Usar Cartão no Melhor Dia" : "Pagar à Vista com Desconto" },
        ],
        actionLabel: "Consultar Nanquim sobre Melhor Cartão",
      },
    });

    // NÓ 7: CONTAS FIXAS & CONTABILIDADE (Nanquim / Crédito)
    const fixedTotal = recurringItems
      .filter((i: any) => i.type === "expense" || i.type === "despesa")
      .reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);

    list.push({
      id: "fixed",
      parentId: "credit",
      label: "Contas Fixas & Vencimentos",
      agentId: "wallet-nanquim",
      agentRole: "Crédito & Arbitragem",
      category: "fixed",
      amount: fixedTotal,
      status: "neutral",
      iconName: "building-2",
      description: `${recurringItems.length} despesas estruturais cadastradas.`,
      quantSummary: "Passivos Contratuais & Pontualidade",
      agentSpeech: `Seus custos fixos somam R$ ${formatCurrency(fixedTotal)}. Mantenha sempre a conta abastecida na véspera dos vencimentos para garantir zero pagamento de juros ou multas bancárias.`,
      suggestedPrompt: "Nanquim, como negociar ou reduzir minhas despesas fixas recorrentes?",
      x: 76,
      y: 72,
      details: {
        kpis: [
          { label: "Custo Fixo Mensal", value: `R$ ${formatCurrency(fixedTotal)}`, highlight: true },
          { label: "Quantidade de Assinaturas/Contas", value: `${recurringItems.length}` },
        ],
        actionLabel: "Auditar Contas com Nanquim",
      },
    });

    // NÓ 8: METAS & MULTIPLICAÇÃO (Atlos / Metas)
    list.push({
      id: "goals",
      parentId: "core",
      label: "Metas & Multiplicação",
      agentId: "wallet-atlos",
      agentRole: "Metas & Multiplicação",
      category: "goals",
      amount: targetEndMonthBalance,
      status: isTargetMet ? "healthy" : "warning",
      iconName: "sparkles",
      description: goalAlloc.headline,
      quantSummary: "Fronteira Eficiente & Índice Sharpe Simplificado",
      agentSpeech: `Atlos aqui! Meu foco é o crescimento do seu patrimônio. A meta de R$ ${formatCurrency(targetEndMonthBalance)} é seu degrau para a liberdade financeira. Cada real economizado hoje vira rendimento composto amanhã.`,
      suggestedPrompt: "Atlos, qual a meta ideal de economia para meu perfil este mês?",
      x: 50,
      y: 75,
      details: {
        kpis: [
          { label: "Meta de Fechamento", value: `R$ ${formatCurrency(targetEndMonthBalance)}`, highlight: true },
          { label: "Eficiência de Alocação (Sharpe)", value: `${goalAlloc.sharpeEfficiencyScore}/100` },
          { label: "Status de Alocação", value: goalAlloc.diversificationStatus.toUpperCase() },
        ],
        actionLabel: "Calcular Alocação de Metas com Atlos",
      },
    });

    return list;
  }, [
    effectiveProjectedFree,
    targetEndMonthBalance,
    safeDailyAllowance,
    remainingDays,
    mainBalance,
    monthIncome,
    monthExpense,
    recurringItems,
    cards,
    cfaR,
    emergencyFund,
    creditFloat,
    goalAlloc,
    diagnosis,
  ]);

  // Filtragem por especialista
  const filteredNodes = useMemo(() => {
    if (activeFilter === "all") return nodes;
    if (activeFilter === "rubi") return nodes.filter((n) => n.agentId === "wallet-rubi");
    if (activeFilter === "sol") return nodes.filter((n) => n.agentId === "wallet-sol");
    if (activeFilter === "nanquim") return nodes.filter((n) => n.agentId === "wallet-nanquim");
    if (activeFilter === "atlos") return nodes.filter((n) => n.agentId === "wallet-atlos");
    return nodes;
  }, [nodes, activeFilter]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const activeAgentMeta = WALLET_CHARACTERS[selectedNode.agentId] || WALLET_CHARACTERS["wallet-rubi"];

  return (
    <div className="w-full rounded-[28px] sm:rounded-[36px] bg-white border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-4 sm:p-7 space-y-6">
      {/* 1. TOPO: TÍTULO, SUBTÍTULO E SELETOR DE ESPECIALISTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.05] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs shrink-0">
            <Compass size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#1D1D1F]">
                Mapa Mental Neural do Dinheiro
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
                Grafo com 4 Agentes
              </span>
            </div>
            <p className="text-xs text-[#86868B]">
              Toque em qualquer nó para abrir o parecer e interagir diretamente com o especialista.
            </p>
          </div>
        </div>

        {/* Filtro de Especialista na Mesa */}
        <div className="flex items-center p-1 bg-[#F2F2F7] rounded-2xl border border-black/[0.04] gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === "all" ? "bg-white text-[#1D1D1F] shadow-xs font-bold" : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Todos (9)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("rubi")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeFilter === "rubi" ? "bg-white text-rose-700 shadow-xs font-bold" : "text-[#86868B] hover:text-rose-600"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Rubi (CFO)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("sol")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeFilter === "sol" ? "bg-white text-amber-700 shadow-xs font-bold" : "text-[#86868B] hover:text-amber-600"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Sol (Reserva)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("nanquim")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeFilter === "nanquim" ? "bg-white text-blue-700 shadow-xs font-bold" : "text-[#86868B] hover:text-blue-600"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Nanquim (Crédito)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("atlos")}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeFilter === "atlos" ? "bg-white text-emerald-700 shadow-xs font-bold" : "text-[#86868B] hover:text-emerald-600"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Atlos (Metas)</span>
          </button>
        </div>
      </div>

      {/* 2. CANVAS DO MAPA MENTAL EM DESIGN BRANCO APPLE (CLEAN & ELEGANT) */}
      <div className="relative w-full h-[460px] sm:h-[520px] rounded-3xl bg-[#FBFBFD] border border-black/[0.06] overflow-hidden select-none shadow-inner">
        {/* Linhas SVG Conectando os Nós */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="appleLineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0071E3" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#34C759" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {nodes.map((node) => {
            if (!node.parentId) return null;
            const parent = nodes.find((p) => p.id === node.parentId);
            if (!parent) return null;

            const isPathActive = selectedNodeId === node.id || selectedNodeId === parent.id;

            return (
              <g key={`line_${node.id}_${parent.id}`}>
                {/* Linha Curva Fluida */}
                <path
                  d={`M ${parent.x}% ${parent.y}% Q ${(parent.x + node.x) / 2}% ${node.y}%, ${node.x}% ${node.y}%`}
                  fill="none"
                  stroke={isPathActive ? "#0071E3" : "#E5E5EA"}
                  strokeWidth={isPathActive ? 2.5 : 1.5}
                  strokeDasharray={isPathActive ? "none" : "3,3"}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>

        {/* Nós Renderizados como Cards Brancos com o Agente */}
        {filteredNodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const agentMeta = WALLET_CHARACTERS[node.agentId];

          return (
            <div
              key={node.id}
              onClick={() => {
                setSelectedNodeId(node.id);
                setIsDrawerOpen(true);
              }}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              className={`absolute z-10 cursor-pointer transition-all duration-300 group ${
                isSelected ? "scale-105 z-30" : "hover:scale-102 hover:z-20"
              }`}
            >
              <div
                className={`p-2 sm:p-2.5 rounded-2xl bg-white border transition-all flex items-center gap-2 shadow-[0_4px_16px_rgba(0,0,0,0.04)] min-w-[130px] sm:min-w-[170px] max-w-[210px] ${
                  isSelected
                    ? "border-black ring-2 ring-black/10 shadow-lg"
                    : "border-black/[0.08] hover:border-black/20"
                }`}
              >
                {/* Mini Avatar do Agente Responsável */}
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-[#F8F8FA] border border-black/[0.06] flex items-center justify-center p-0.5">
                    <WalletCharacter
                      id={node.agentId}
                      size="sm"
                      state={isSelected ? "falando" : "ocioso"}
                      showBadge={false}
                      className="pointer-events-none scale-75"
                    />
                  </div>
                </div>

                {/* Dados do Nó */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold text-[#86868B] truncate block">
                      {node.label}
                    </span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        node.status === "healthy"
                          ? "bg-emerald-500"
                          : node.status === "warning"
                          ? "bg-amber-500"
                          : node.status === "alert"
                          ? "bg-rose-500"
                          : "bg-blue-500"
                      }`}
                    />
                  </div>

                  {typeof node.amount === "number" && (
                    <strong className="text-xs sm:text-sm font-bold font-mono text-[#1D1D1F] block tabular-nums leading-tight truncate">
                      R$ {formatCurrency(node.amount)}
                    </strong>
                  )}

                  <span className="text-[8.5px] text-[#86868B] truncate block font-medium">
                    {agentMeta.name} • {agentMeta.badgeText}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Card Dica Flutuante no Topo do Canvas */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-black/[0.06] shadow-2xs text-[10px] font-semibold text-[#86868B] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ecossistema Ativo: 4 Especialistas Auditando</span>
          </div>
        </div>
      </div>

      {/* 3. GAVETA DE INSPEÇÃO & DIÁLOGO INTERATIVO COM O AGENTE (BOTTOM DRAWER) */}
      {isDrawerOpen && selectedNode && (
        <div className="bg-[#F8F8FA] rounded-3xl p-4 sm:p-6 border border-black/[0.06] shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Cabeçalho com o Agente Especialista e Fechamento */}
          <div className="flex items-start justify-between gap-3 border-b border-black/[0.05] pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-black/[0.08] p-1 flex items-center justify-center shadow-xs shrink-0">
                <WalletCharacter
                  id={selectedNode.agentId}
                  size="md"
                  state="falando"
                  showBadge={false}
                  className="pointer-events-none"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-bold text-[#1D1D1F]">
                    {activeAgentMeta.name}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1D1D1F] text-white">
                    {activeAgentMeta.title}
                  </span>
                  <span className="text-[10px] text-[#86868B] font-medium hidden sm:inline">
                    • {selectedNode.label}
                  </span>
                </div>
                <p className="text-[11px] text-[#86868B] font-mono mt-0.5">
                  Base Quantitativa: {activeAgentMeta.quantFoundation}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 rounded-xl hover:bg-black/5 text-[#86868B] transition-all cursor-pointer"
              title="Fechar painel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Fala do Agente Especialista (Parecer Humano & Didático) */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.05] shadow-2xs space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1D1D1F]">
              <Sparkles size={14} className="text-amber-500" />
              <span>Parecer do Especialista:</span>
            </div>
            <p className="text-xs sm:text-sm text-[#1D1D1F] font-medium leading-relaxed">
              "{selectedNode.agentSpeech}"
            </p>
          </div>

          {/* Grid de KPIs Reais do Nó */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {selectedNode.details.kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-3 border border-black/[0.05] shadow-2xs space-y-0.5"
              >
                <span className="text-[10px] font-semibold text-[#86868B] block truncate">
                  {kpi.label}
                </span>
                <strong
                  className={`text-xs sm:text-sm font-bold font-mono block truncate ${
                    kpi.highlight ? "text-[#1D1D1F]" : "text-[#1D1D1F]"
                  }`}
                >
                  {kpi.value}
                </strong>
              </div>
            ))}
          </div>

          {/* Ações Rápidas com o Agente */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-black/[0.05]">
            <span className="text-[11px] text-[#86868B]">
              Interaja diretamente com o auditor para aprofundar:
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenSimulator && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenSimulator({
                      description: `Gasto relacionado a ${selectedNode.label}`,
                      amount: 150,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-white hover:bg-[#F2F2F7] text-xs font-semibold text-[#1D1D1F] border border-black/[0.08] shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Calculator size={13} className="text-[#1D1D1F]" />
                  <span>Simular Impacto</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onDiscussWithAI(selectedNode.suggestedPrompt)}
                className="px-4 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <MessageSquare size={13} className="text-white" />
                <span>Conversar com {activeAgentMeta.name} no Chat</span>
                <ArrowRight size={13} className="text-white/70" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
