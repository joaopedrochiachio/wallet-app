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
  Coffee,
  ShieldCheck,
  CalendarDays,
  MessageSquare,
} from "lucide-react";
import { FinancialDiagnosis } from "@/lib/services/financialDiagnosisService";

export interface MindMapNode {
  id: string;
  parentId?: string;
  label: string;
  category: "core" | "income" | "fixed" | "credit" | "drains" | "reserve";
  amount?: number;
  percentage?: number;
  status?: "healthy" | "warning" | "alert" | "neutral";
  iconName: string;
  description: string;
  insight?: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  details?: {
    actionLabel?: string;
    actionPrompt?: string;
    subItems?: Array<{ name: string; value: number; status?: string }>;
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
  // Tema visual: "cosmic" (estilo imagem 3 de constelações holográficas) ou "apple" (estilo Cupertino tátil imagem 1/2)
  const [theme, setTheme] = useState<"cosmic" | "apple">("cosmic");
  
  // Filtro de clusters
  const [activeFilter, setActiveFilter] = useState<"all" | "drains" | "cashflow" | "credit">("all");
  
  // Nó selecionado para inspeção detalhada
  const [selectedNodeId, setSelectedNodeId] = useState<string>("core");
  
  const [isExpandedFull, setIsExpandedFull] = useState<boolean>(false);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 1. CONSTRUÇÃO DETERMINÍSTICA DO GRAFO MENTAL
  const nodes = useMemo<MindMapNode[]>(() => {
    const list: MindMapNode[] = [];

    // NÓ CENTRAL (O Núcleo de Saúde & Meta)
    const isTargetMet = effectiveProjectedFree >= targetEndMonthBalance;
    const margin = effectiveProjectedFree - targetEndMonthBalance;

    list.push({
      id: "core",
      label: "Núcleo de Liquidez & Meta",
      category: "core",
      amount: effectiveProjectedFree,
      status: isTargetMet ? "healthy" : "warning",
      iconName: "Compass",
      description: `Meta de R$ ${formatCurrency(targetEndMonthBalance)} para o dia 31`,
      insight: isTargetMet
        ? `Superando a meta com margem livre de R$ ${formatCurrency(Math.max(0, margin))}.`
        : `Abaixo da meta por R$ ${formatCurrency(Math.abs(margin))}. Requer travas em gastos supérfluos.`,
      x: 50,
      y: 50,
      details: {
        actionLabel: "Discutir Fechamento do Mês",
        actionPrompt: `Auditor, como fechar o mês na meta de R$ ${targetEndMonthBalance.toFixed(2)} positivo com a maior folga possível?`,
        subItems: [
          { name: "Saldo em Conta Hoje", value: mainBalance },
          { name: "Saldo Projetado Fechamento", value: effectiveProjectedFree },
          { name: "Alvo Estipulado", value: targetEndMonthBalance },
        ],
      },
    });

    // RAMO 1: RENDA & ENTRADAS (Superior Direito)
    const totalIncome = monthIncome > 0 ? monthIncome : 2500;
    list.push({
      id: "node_income",
      parentId: "core",
      label: "Renda & Entradas",
      category: "income",
      amount: totalIncome,
      status: "healthy",
      iconName: "TrendingUp",
      description: "Entradas realizadas e rendimento de conta",
      insight: "Fluxo de receita alimentando a conta corrente para cobrir compromissos.",
      x: 78,
      y: 22,
      details: {
        actionLabel: "Analisar Capacidade de Aporte",
        actionPrompt: "Auditor, com base na minha renda deste mês, qual o valor ideal para direcionar a metas?",
        subItems: [
          { name: "Receitas do Mês", value: totalIncome },
          { name: "Rendimento Automático CDI", value: 6.37 },
        ],
      },
    });

    // Subnó Renda: Rendimento CDI
    list.push({
      id: "sub_income_yield",
      parentId: "node_income",
      label: "Rendimento CDI",
      category: "income",
      amount: 6.37,
      status: "healthy",
      iconName: "Zap",
      description: "Rendimento da conta corrente 100% CDI",
      x: 92,
      y: 12,
    });

    // RAMO 2: COMPROMISSOS FIXOS (Sobrevivência) (Inferior Direito)
    const totalRecurring = recurringItems.reduce((acc, r) => acc + (r.amount || 0), 0);

    list.push({
      id: "node_fixed",
      parentId: "core",
      label: "Contas Fixas & Sobrevivência",
      category: "fixed",
      amount: totalRecurring > 0 ? totalRecurring : monthExpense,
      status: "warning",
      iconName: "Building2",
      description: `${recurringItems.length} despesas obrigatórias cadastradas`,
      insight: "Contas essenciais que precisam ser honradas sem atraso na data certa.",
      x: 80,
      y: 78,
      details: {
        actionLabel: "Auditar Próximos Vencimentos",
        actionPrompt: "Auditor, liste as contas fixas pendentes desta semana e garanta que haverá saldo.",
        subItems: recurringItems.slice(0, 4).map((r: any) => ({
          name: r.title,
          value: r.amount,
          status: r.dueDay ? `Vence dia ${r.dueDay}` : "Recorrente",
        })),
      },
    });

    // Subnó Fixas: Próximas Contas
    if (recurringItems.length > 0) {
      const firstBill = recurringItems[0];
      list.push({
        id: "sub_fixed_bill",
        parentId: "node_fixed",
        label: firstBill.title,
        category: "fixed",
        amount: firstBill.amount,
        status: "neutral",
        iconName: "CalendarDays",
        description: `Vencimento dia ${firstBill.dueDay || 10}`,
        x: 93,
        y: 88,
      });
    }

    // RAMO 3: CARTÕES & CRÉDITO INTELIGENTE (Inferior Esquerdo)
    const totalCardDebt = cards
      .filter((c: any) => c.type === "credit")
      .reduce((acc: number, c: any) => acc + (c.spent || c.balance || 0), 0);

    list.push({
      id: "node_credit",
      parentId: "core",
      label: "Faturas & Crédito",
      category: "credit",
      amount: totalCardDebt,
      status: totalCardDebt > 1000 ? "warning" : "healthy",
      iconName: "CreditCard",
      description: `${cards.filter((c: any) => c.type === "credit").length} cartões ativos`,
      insight: "O crédito posterga o desembolso e gera janela sem juros se pago integralmente.",
      x: 22,
      y: 80,
      details: {
        actionLabel: "Ver Janela Ótima sem Juros",
        actionPrompt: "Auditor, qual o melhor cartão de crédito para compras nesta semana para ganhar mais prazo?",
        subItems: cards.map((c: any) => ({
          name: c.name,
          value: c.spent || 0,
          status: `Fecha dia ${c.closingDay} • Vence ${c.dueDay}`,
        })),
      },
    });

    // Subnó Cartão: Janela Ótima (+40 Dias)
    list.push({
      id: "sub_credit_window",
      parentId: "node_credit",
      label: "Janela +40 Dias",
      category: "credit",
      amount: totalCardDebt > 0 ? totalCardDebt : undefined,
      status: "healthy",
      iconName: "ShieldCheck",
      description: "Estratégia de compra pós-fechamento",
      x: 8,
      y: 90,
    });

    // RAMO 4: RALOS & PADRÕES OCULTOS DETECTADOS PELA IA (Superior Esquerdo)
    const specificAlerts = diagnosis?.specificExpensesAlerts || [];
    const totalDrains = specificAlerts.reduce((acc, a) => acc + (a.totalAmount || 0), 0);

    list.push({
      id: "node_drains",
      parentId: "core",
      label: "Radar de Ralos & Hábitos",
      category: "drains",
      amount: totalDrains > 0 ? totalDrains : 340,
      status: totalDrains > 200 ? "alert" : "warning",
      iconName: "Flame",
      description: `${specificAlerts.length || 2} hábitos com potencial de vazamento`,
      insight: "Padrões invisíveis de micro-consumo detectados nos últimos 30 dias.",
      x: 22,
      y: 22,
      details: {
        actionLabel: "Auditar Vilões e Economizar",
        actionPrompt: "Auditor, quais os maiores ralos de consumo identificados e como cortar 20% deles?",
        subItems: specificAlerts.length > 0
          ? specificAlerts.map((a) => ({
              name: a.item,
              value: a.totalAmount,
              status: `${a.count || 2} compras`,
            }))
          : [
              { name: "Delivery / Refeições", value: 240, status: "Alta repetição" },
              { name: "Micro-gastos App", value: 100, status: "Dispensável" },
            ],
      },
    });

    // Subnó Ralos: Maior Vilão Detectado
    const topDrain = specificAlerts[0] || { item: "Delivery & Lanches", totalAmount: 240 };
    list.push({
      id: "sub_drains_top",
      parentId: "node_drains",
      label: topDrain.item,
      category: "drains",
      amount: topDrain.totalAmount,
      status: "alert",
      iconName: "Coffee",
      description: "Maior impacto discricionário recente",
      x: 8,
      y: 10,
    });

    // RAMO 5: TETO DIÁRIO & RESERVA LIVRE (Topo Central)
    list.push({
      id: "node_reserve",
      parentId: "core",
      label: "Teto Seguro Diário",
      category: "reserve",
      amount: safeDailyAllowance,
      status: safeDailyAllowance > 30 ? "healthy" : "warning",
      iconName: "Zap",
      description: `R$ ${formatCurrency(safeDailyAllowance)}/dia para os próximos ${remainingDays} dias`,
      insight: "Seu velocímetro de gasto diário para garantir a meta com tranquilidade.",
      x: 50,
      y: 12,
      details: {
        actionLabel: "Simular Gasto Hoje",
        actionPrompt: `Auditor, se eu gastar R$ 80 hoje, quanto cairá o meu teto diário seguro para os dias restantes?`,
        subItems: [
          { name: "Teto de Hoje", value: safeDailyAllowance },
          { name: "Dias Restantes no Mês", value: remainingDays },
          { name: "Margem de Folga Total", value: Math.max(0, margin) },
        ],
      },
    });

    return list;
  }, [
    effectiveProjectedFree,
    targetEndMonthBalance,
    mainBalance,
    monthIncome,
    monthExpense,
    recurringItems,
    cards,
    diagnosis,
    safeDailyAllowance,
    remainingDays,
  ]);

  // Filtra nós de acordo com o preset ativo
  const filteredNodes = useMemo(() => {
    if (activeFilter === "all") return nodes;
    if (activeFilter === "drains") {
      return nodes.filter(
        (n) => n.id === "core" || n.category === "drains" || n.category === "reserve"
      );
    }
    if (activeFilter === "cashflow") {
      return nodes.filter(
        (n) => n.id === "core" || n.category === "income" || n.category === "fixed"
      );
    }
    if (activeFilter === "credit") {
      return nodes.filter(
        (n) => n.id === "core" || n.category === "credit" || n.category === "reserve"
      );
    }
    return nodes;
  }, [nodes, activeFilter]);

  // Nó atualmente selecionado para inspeção
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  }, [nodes, selectedNodeId]);

  // Ícone helper
  const renderNodeIcon = (name: string, size = 16, className = "") => {
    switch (name) {
      case "Compass":
        return <Compass size={size} className={className} />;
      case "TrendingUp":
        return <TrendingUp size={size} className={className} />;
      case "Building2":
        return <Building2 size={size} className={className} />;
      case "CreditCard":
        return <CreditCard size={size} className={className} />;
      case "Flame":
        return <Flame size={size} className={className} />;
      case "Zap":
        return <Zap size={size} className={className} />;
      case "Coffee":
        return <Coffee size={size} className={className} />;
      case "ShieldCheck":
        return <ShieldCheck size={size} className={className} />;
      case "CalendarDays":
        return <CalendarDays size={size} className={className} />;
      default:
        return <Sparkles size={size} className={className} />;
    }
  };

  // Cores por categoria para o tema cósmico e Apple
  const getCategoryStyles = (category: MindMapNode["category"]) => {
    if (theme === "cosmic") {
      switch (category) {
        case "core":
          return {
            bg: "bg-slate-900/90",
            border: "border-cyan-400/80 shadow-[0_0_35px_rgba(34,211,238,0.45)]",
            text: "text-cyan-200",
            glow: "#22d3ee",
            badge: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40",
          };
        case "income":
          return {
            bg: "bg-emerald-950/80",
            border: "border-emerald-400/70 shadow-[0_0_25px_rgba(52,211,153,0.35)]",
            text: "text-emerald-200",
            glow: "#34d399",
            badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
          };
        case "fixed":
          return {
            bg: "bg-amber-950/80",
            border: "border-amber-400/70 shadow-[0_0_25px_rgba(251,191,36,0.35)]",
            text: "text-amber-200",
            glow: "#fbbf24",
            badge: "bg-amber-500/20 text-amber-300 border-amber-400/40",
          };
        case "credit":
          return {
            bg: "bg-indigo-950/80",
            border: "border-indigo-400/70 shadow-[0_0_25px_rgba(129,140,248,0.35)]",
            text: "text-indigo-200",
            glow: "#818cf8",
            badge: "bg-indigo-500/20 text-indigo-300 border-indigo-400/40",
          };
        case "drains":
          return {
            bg: "bg-rose-950/80",
            border: "border-rose-400/80 shadow-[0_0_25px_rgba(244,63,94,0.4)]",
            text: "text-rose-200",
            glow: "#f43f5e",
            badge: "bg-rose-500/20 text-rose-300 border-rose-400/40",
          };
        case "reserve":
          return {
            bg: "bg-teal-950/80",
            border: "border-teal-400/70 shadow-[0_0_25px_rgba(45,212,191,0.35)]",
            text: "text-teal-200",
            glow: "#2dd4bf",
            badge: "bg-teal-500/20 text-teal-300 border-teal-400/40",
          };
      }
    } else {
      // Tema Apple Glass
      switch (category) {
        case "core":
          return {
            bg: "bg-white/95",
            border: "border-black/20 shadow-[0_12px_40px_rgba(0,0,0,0.12)]",
            text: "text-[#1D1D1F]",
            glow: "#1D1D1F",
            badge: "bg-[#1D1D1F] text-white",
          };
        case "income":
          return {
            bg: "bg-emerald-50/90",
            border: "border-emerald-200 shadow-[0_8px_24px_rgba(16,185,129,0.12)]",
            text: "text-emerald-950",
            glow: "#10b981",
            badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
          };
        case "fixed":
          return {
            bg: "bg-amber-50/90",
            border: "border-amber-200 shadow-[0_8px_24px_rgba(245,158,11,0.12)]",
            text: "text-amber-950",
            glow: "#f59e0b",
            badge: "bg-amber-100 text-amber-800 border-amber-300",
          };
        case "credit":
          return {
            bg: "bg-indigo-50/90",
            border: "border-indigo-200 shadow-[0_8px_24px_rgba(99,102,241,0.12)]",
            text: "text-indigo-950",
            glow: "#6366f1",
            badge: "bg-indigo-100 text-indigo-800 border-indigo-300",
          };
        case "drains":
          return {
            bg: "bg-rose-50/90",
            border: "border-rose-200 shadow-[0_8px_24px_rgba(239,68,68,0.12)]",
            text: "text-rose-950",
            glow: "#ef4444",
            badge: "bg-rose-100 text-rose-800 border-rose-300",
          };
        case "reserve":
          return {
            bg: "bg-teal-50/90",
            border: "border-teal-200 shadow-[0_8px_24px_rgba(20,184,166,0.12)]",
            text: "text-teal-950",
            glow: "#14b8a6",
            badge: "bg-teal-100 text-teal-800 border-teal-300",
          };
      }
    }
  };

  return (
    <div
      className={`relative w-full rounded-[28px] sm:rounded-[36px] overflow-hidden border transition-all duration-300 ${
        isExpandedFull ? "fixed inset-3 z-[110] max-h-[96vh]" : "min-h-[640px]"
      } ${
        theme === "cosmic"
          ? "bg-[#07090E] border-cyan-500/20 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          : "bg-gradient-to-b from-white/95 to-[#F8F8FC]/90 backdrop-blur-2xl border-black/[0.08] text-[#1D1D1F] shadow-[0_12px_45px_rgba(0,0,0,0.06)]"
      }`}
    >
      {/* GLOW DE FUNDO & CONSTELAÇÃO CÓSMICA (Inspirado na Imagem 3) */}
      {theme === "cosmic" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_#22d3ee_1px,_transparent_1px)] [background-size:24px_24px]" />
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-[90px]" />
          <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-emerald-600/10 rounded-full blur-[80px]" />
        </div>
      )}

      {/* HEADER DO MAPA MENTAL COM CONTROLES TÁTEIS */}
      <div className="relative z-20 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              theme === "cosmic"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                : "bg-[#1D1D1F] text-white"
            }`}
          >
            <Compass size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold tracking-tight">
                Mapa Mental Neural do Dinheiro
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  theme === "cosmic"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                    : "bg-[#F2F2F7] text-[#1D1D1F]"
                }`}
              >
                Grafo Interativo
              </span>
            </div>
            <p
              className={`text-xs ${
                theme === "cosmic" ? "text-slate-400" : "text-[#86868B]"
              }`}
            >
              Toque em qualquer nó para abrir o diagnóstico do consultor ou simular impacto.
            </p>
          </div>
        </div>

        {/* CONTROLES: FILTROS + ALTERNADOR DE TEMA + TELA CHEIA */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtros de Ramo */}
          <div
            className={`flex items-center gap-1 p-1 rounded-2xl text-[11px] font-semibold border ${
              theme === "cosmic"
                ? "bg-slate-900/80 border-slate-700/60"
                : "bg-[#F2F2F7] border-black/5"
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                activeFilter === "all"
                  ? theme === "cosmic"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                    : "bg-white text-[#1D1D1F] shadow-xs"
                  : theme === "cosmic"
                  ? "text-slate-400 hover:text-white"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("drains")}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                activeFilter === "drains"
                  ? theme === "cosmic"
                    ? "bg-rose-500 text-white font-bold"
                    : "bg-white text-rose-700 shadow-xs"
                  : theme === "cosmic"
                  ? "text-slate-400 hover:text-white"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Ralos & Hábitos
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("cashflow")}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                activeFilter === "cashflow"
                  ? theme === "cosmic"
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : "bg-white text-emerald-800 shadow-xs"
                  : theme === "cosmic"
                  ? "text-slate-400 hover:text-white"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Renda vs Fixas
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("credit")}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                activeFilter === "credit"
                  ? theme === "cosmic"
                    ? "bg-indigo-500 text-white font-bold"
                    : "bg-white text-indigo-800 shadow-xs"
                  : theme === "cosmic"
                  ? "text-slate-400 hover:text-white"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Crédito
            </button>
          </div>

          {/* Alternador de Tema Visual (Cosmic vs Apple) */}
          <div
            className={`flex items-center p-1 rounded-2xl border text-[11px] font-semibold ${
              theme === "cosmic"
                ? "bg-slate-900/80 border-slate-700/60"
                : "bg-[#F2F2F7] border-black/5"
            }`}
          >
            <button
              type="button"
              onClick={() => setTheme("cosmic")}
              className={`px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                theme === "cosmic"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
              title="Modo Constelação Cyber"
            >
              <span>🌌</span>
              <span className="hidden sm:inline">Constelação</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("apple")}
              className={`px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                theme === "apple"
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Modo Vidro Apple"
            >
              <span>✨</span>
              <span className="hidden sm:inline">Vidro</span>
            </button>
          </div>

          {/* Botão de Tela Cheia */}
          <button
            type="button"
            onClick={() => setIsExpandedFull(!isExpandedFull)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              theme === "cosmic"
                ? "bg-slate-900/80 border-slate-700 hover:text-cyan-300"
                : "bg-white border-black/5 text-[#86868B] hover:text-[#1D1D1F]"
            }`}
            title={isExpandedFull ? "Reduzir tela" : "Expandir em tela cheia"}
          >
            {isExpandedFull ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* ÁREA INTERATIVA DO GRAFO SVG + NÓS HOLOGRÁFICOS */}
      <div className="relative w-full h-[540px] sm:h-[580px] overflow-hidden select-none">
        {/* LINHAS SINÁPTICAS CONECTORAS (SVG BEZIER) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="grad-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="grad-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="grad-rose" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="grad-amber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="grad-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Desenha as conexões entre nós */}
          {filteredNodes.map((node) => {
            if (!node.parentId) return null;
            const parent = filteredNodes.find((p) => p.id === node.parentId);
            if (!parent) return null;

            const strokeColor =
              theme === "cosmic"
                ? node.category === "drains"
                  ? "url(#grad-rose)"
                  : node.category === "income"
                  ? "url(#grad-emerald)"
                  : node.category === "fixed"
                  ? "url(#grad-amber)"
                  : node.category === "credit"
                  ? "url(#grad-indigo)"
                  : "url(#grad-cyan)"
                : node.category === "drains"
                ? "rgba(244, 63, 94, 0.4)"
                : node.category === "income"
                ? "rgba(16, 185, 129, 0.4)"
                : node.category === "fixed"
                ? "rgba(245, 158, 11, 0.4)"
                : node.category === "credit"
                ? "rgba(99, 102, 241, 0.4)"
                : "rgba(0, 0, 0, 0.15)";

            const isHighlighted =
              selectedNodeId === node.id || selectedNodeId === parent.id;

            return (
              <g key={`link_${parent.id}_${node.id}`}>
                <path
                  d={`M ${parent.x}% ${parent.y}% Q ${(parent.x + node.x) / 2}% ${
                    (parent.y + node.y) / 2 + (node.category === "drains" ? -8 : 8)
                  }%, ${node.x}% ${node.y}%`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? 3 : 1.75}
                  strokeDasharray={node.id.startsWith("sub_") ? "4 4" : "none"}
                  className="transition-all duration-300"
                />

                {theme === "cosmic" && (
                  <circle
                    r={isHighlighted ? 3 : 2}
                    fill={node.category === "drains" ? "#f43f5e" : "#22d3ee"}
                    className="animate-pulse"
                  >
                    <animateMotion
                      path={`M ${parent.x}% ${parent.y}% Q ${(parent.x + node.x) / 2}% ${
                        (parent.y + node.y) / 2 + (node.category === "drains" ? -8 : 8)
                      }%, ${node.x}% ${node.y}%`}
                      dur={isHighlighted ? "2.5s" : "4.5s"}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* NÓS RENDERIZADOS EM CAMADA INTERATIVA */}
        {filteredNodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isCore = node.category === "core";
          const styles = getCategoryStyles(node.category);

          return (
            <div
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: `translate(-50%, -50%) scale(${isSelected ? 1.08 : 1})`,
              }}
              className={`absolute z-10 cursor-pointer transition-all duration-300 group ${
                isCore ? "p-3 sm:p-4 rounded-3xl" : "p-2.5 sm:p-3 rounded-2xl"
              } ${styles.bg} ${styles.border} ${
                isSelected
                  ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-black"
                  : "hover:scale-105"
              }`}
            >
              {isCore ? (
                <div className="flex flex-col items-center text-center max-w-[170px] sm:max-w-[190px] space-y-1.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center relative ${
                      theme === "cosmic"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.5)]"
                        : "bg-[#1D1D1F] text-white shadow-md"
                    }`}
                  >
                    <Compass size={24} className="animate-spin-slow" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                      {node.label}
                    </span>
                    <strong className="text-sm sm:text-base font-bold font-mono block tabular-nums">
                      R$ {formatCurrency(node.amount || 0)}
                    </strong>
                  </div>

                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}
                  >
                    Meta: R$ {formatCurrency(targetEndMonthBalance)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 max-w-[160px] sm:max-w-[180px]">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                      theme === "cosmic"
                        ? "bg-slate-900 text-white border-slate-700"
                        : "bg-white text-[#1D1D1F] border-black/10 shadow-2xs"
                    }`}
                  >
                    {renderNodeIcon(node.iconName, 15)}
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold block truncate leading-tight">
                      {node.label}
                    </span>
                    {node.amount !== undefined && (
                      <strong className="text-xs font-bold font-mono block truncate tabular-nums">
                        R$ {formatCurrency(node.amount)}
                      </strong>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* PAINEL FLUTUANTE DE INSPEÇÃO DO NÓ SELECIONADO (HUD HOLOGRÁFICO) */}
        {selectedNode && (
          <div
            className={`absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80 rounded-2xl sm:rounded-3xl p-4 z-30 transition-all border backdrop-blur-xl animate-in slide-in-from-bottom duration-300 ${
              theme === "cosmic"
                ? "bg-slate-900/95 border-cyan-500/40 text-white shadow-[0_12px_40px_rgba(0,0,0,0.7)]"
                : "bg-white/95 border-black/10 text-[#1D1D1F] shadow-[0_12px_36px_rgba(0,0,0,0.1)]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-2.5">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                    theme === "cosmic"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                      : "bg-[#F2F2F7] text-[#1D1D1F] border-black/5"
                  }`}
                >
                  {renderNodeIcon(selectedNode.iconName, 14)}
                </div>
                <div>
                  <h4 className="text-xs font-bold tracking-tight">{selectedNode.label}</h4>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {selectedNode.amount !== undefined
                      ? `Impacto: R$ ${formatCurrency(selectedNode.amount)}`
                      : "Métrica Estrutural"}
                  </span>
                </div>
              </div>

              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  selectedNode.status === "healthy"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
                    : selectedNode.status === "alert"
                    ? "bg-rose-500/20 text-rose-400 border border-rose-400/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-400/30"
                }`}
              >
                {selectedNode.status || "OK"}
              </span>
            </div>

            <p className="text-[11px] leading-relaxed my-2.5 opacity-90">
              {selectedNode.insight || selectedNode.description}
            </p>

            {/* Sub-itens auditados do nó se houver */}
            {selectedNode.details?.subItems && (
              <div className="space-y-1 mb-3 max-h-24 overflow-y-auto no-scrollbar">
                {selectedNode.details.subItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between text-[10px] p-1.5 rounded-lg border ${
                      theme === "cosmic"
                        ? "bg-slate-950/60 border-slate-800"
                        : "bg-[#FAFAFC] border-black/[0.04]"
                    }`}
                  >
                    <span className="truncate max-w-[160px]">{item.name}</span>
                    <strong className="font-mono tabular-nums">
                      R$ {formatCurrency(item.value)}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            {/* Ações Rápidas Conectadas com o Chat e Simulador */}
            <div className="flex items-center gap-2 pt-1 border-t border-black/[0.06]">
              {selectedNode.details?.actionPrompt && (
                <button
                  type="button"
                  onClick={() => onDiscussWithAI(selectedNode.details!.actionPrompt!)}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                    theme === "cosmic"
                      ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                      : "bg-[#1D1D1F] hover:bg-black text-white"
                  }`}
                >
                  <MessageSquare size={12} />
                  <span>Discutir no Chat</span>
                </button>
              )}

              {onOpenSimulator && selectedNode.category === "drains" && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenSimulator({
                      description: selectedNode.label,
                      amount: selectedNode.amount || 100,
                    })
                  }
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer active:scale-95 ${
                    theme === "cosmic"
                      ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                      : "bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] border-black/5"
                  }`}
                  title="Simular corte deste item"
                >
                  Simular Corte
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER DO MAPA MENTAL COM GUIA DE INTERAÇÃO DIDÁTICA */}
      <div
        className={`p-3 px-5 text-[11px] flex flex-wrap items-center justify-between gap-2 border-t backdrop-blur-md ${
          theme === "cosmic"
            ? "bg-slate-950/80 border-slate-800 text-slate-400"
            : "bg-white/80 border-black/5 text-[#86868B]"
        }`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Núcleo & Meta</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Renda</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Contas Fixas</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span>Cartões</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>Ralos (IA)</span>
          </span>
        </div>

        <span className="font-mono text-[10px]">
          Fórmula de Sobra: (Saldo + Renda) - (Fixas + Faturas) = R$ {formatCurrency(effectiveProjectedFree)}
        </span>
      </div>
    </div>
  );
}
