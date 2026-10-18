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
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
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
  // Filtro de clusters
  const [activeFilter, setActiveFilter] = useState<"all" | "drains" | "cashflow" | "credit">("all");
  
  // Nó selecionado para inspeção detalhada
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("core");
  
  // Controle de Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isExpandedFull, setIsExpandedFull] = useState<boolean>(false);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 1. CONSTRUÇÃO DO GRAFO COM COORDENADAS RESPONSIVAS (SAFE BOUNDS PARA MOBILE)
  const nodes = useMemo<MindMapNode[]>(() => {
    const list: MindMapNode[] = [];

    const isTargetMet = effectiveProjectedFree >= targetEndMonthBalance;
    const margin = effectiveProjectedFree - targetEndMonthBalance;

    // NÓ CENTRAL (Núcleo de Saúde & Meta)
    list.push({
      id: "core",
      label: "Núcleo de Liquidez",
      category: "core",
      amount: effectiveProjectedFree,
      status: isTargetMet ? "healthy" : "warning",
      iconName: "Compass",
      description: `Meta de R$ ${formatCurrency(targetEndMonthBalance)} para o fim do mês`,
      insight: isTargetMet
        ? `Meta cumprida com folga segura de R$ ${formatCurrency(Math.max(0, margin))}.`
        : `Abaixo da meta por R$ ${formatCurrency(Math.abs(margin))}. Trave novos custos discricionários.`,
      x: 50,
      y: 50,
      details: {
        actionLabel: "Discutir Fechamento do Mês",
        actionPrompt: `Auditor, como fechar o mês na meta de R$ ${targetEndMonthBalance.toFixed(2)} positivo com folga máxima?`,
        subItems: [
          { name: "Saldo em Conta Hoje", value: mainBalance },
          { name: "Saldo Projetado Fechamento", value: effectiveProjectedFree },
          { name: "Alvo Estipulado", value: targetEndMonthBalance },
        ],
      },
    });

    // RAMO 1: RENDA & ENTRADAS (Superior Direito - x: 74%, y: 24%)
    const totalIncome = monthIncome > 0 ? monthIncome : 2500;
    list.push({
      id: "node_income",
      parentId: "core",
      label: "Renda & Entradas",
      category: "income",
      amount: totalIncome,
      status: "healthy",
      iconName: "TrendingUp",
      description: "Receitas do mês e rendimento CDI",
      insight: "Entradas alimentando a conta para quitação de compromissos.",
      x: 75,
      y: 24,
      details: {
        actionLabel: "Analisar Capacidade de Aporte",
        actionPrompt: "Auditor, qual o valor ideal da minha renda para direcionar para metas este mês?",
        subItems: [
          { name: "Receitas do Mês", value: totalIncome },
          { name: "Rendimento Automático CDI", value: 6.37 },
        ],
      },
    });

    // RAMO 2: CONTAS FIXAS & SOBREVIVÊNCIA (Inferior Direito - x: 74%, y: 76%)
    const totalRecurring = recurringItems.reduce((acc: number, r: any) => acc + (r.amount || 0), 0);
    list.push({
      id: "node_fixed",
      parentId: "core",
      label: "Contas Fixas",
      category: "fixed",
      amount: totalRecurring > 0 ? totalRecurring : monthExpense,
      status: "warning",
      iconName: "Building2",
      description: `${recurringItems.length} despesas obrigatórias`,
      insight: "Contas essenciais que exigem quitação pontual.",
      x: 75,
      y: 76,
      details: {
        actionLabel: "Auditar Próximos Vencimentos",
        actionPrompt: "Auditor, liste as contas fixas pendentes desta semana e garanta que haverá saldo.",
        subItems: recurringItems.slice(0, 3).map((r: any) => ({
          name: r.title,
          value: r.amount,
          status: r.dueDay ? `Dia ${r.dueDay}` : "Recorrente",
        })),
      },
    });

    // RAMO 3: CARTÕES & CRÉDITO (Inferior Esquerdo - x: 25%, y: 76%)
    const totalCardDebt = cards
      .filter((c: any) => c.type === "credit")
      .reduce((acc: number, c: any) => acc + (c.spent || c.balance || 0), 0);

    list.push({
      id: "node_credit",
      parentId: "core",
      label: "Faturas & Cartões",
      category: "credit",
      amount: totalCardDebt,
      status: totalCardDebt > 1000 ? "warning" : "healthy",
      iconName: "CreditCard",
      description: `${cards.filter((c: any) => c.type === "credit").length} cartões ativos`,
      insight: "Faturas em aberto que vencem nos próximos ciclos.",
      x: 25,
      y: 76,
      details: {
        actionLabel: "Ver Janela Ótima sem Juros",
        actionPrompt: "Auditor, qual o melhor cartão para compras esta semana para ganhar mais prazo?",
        subItems: cards.map((c: any) => ({
          name: c.name,
          value: c.spent || 0,
          status: `Fecha dia ${c.closingDay} • Vence ${c.dueDay}`,
        })),
      },
    });

    // RAMO 4: RALOS & HÁBITOS (Superior Esquerdo - x: 25%, y: 24%)
    const specificAlerts = diagnosis?.specificExpensesAlerts || [];
    const totalDrains = specificAlerts.reduce((acc: number, a: any) => acc + (a.totalAmount || 0), 0);

    list.push({
      id: "node_drains",
      parentId: "core",
      label: "Radar de Ralos",
      category: "drains",
      amount: totalDrains > 0 ? totalDrains : 340,
      status: totalDrains > 200 ? "alert" : "warning",
      iconName: "Flame",
      description: `${specificAlerts.length || 2} hábitos com vazamento`,
      insight: "Gastos repetitivos discricionários nos últimos 30 dias.",
      x: 25,
      y: 24,
      details: {
        actionLabel: "Auditar Vilões e Economizar",
        actionPrompt: "Auditor, quais os maiores ralos de consumo identificados e como cortar 20% deles?",
        subItems: specificAlerts.length > 0
          ? specificAlerts.slice(0, 3).map((a: any) => ({
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

    // RAMO 5: TETO SEGURO DIÁRIO (Topo Central - x: 50%, y: 15%)
    list.push({
      id: "node_reserve",
      parentId: "core",
      label: "Teto Diário Seguro",
      category: "reserve",
      amount: safeDailyAllowance,
      status: safeDailyAllowance > 30 ? "healthy" : "warning",
      iconName: "Zap",
      description: `R$ ${formatCurrency(safeDailyAllowance)}/dia restantes`,
      insight: "Limite diário seguro de hoje para garantir o cumprimento da meta.",
      x: 50,
      y: 15,
      details: {
        actionLabel: "Simular Gasto Hoje",
        actionPrompt: `Auditor, se eu gastar R$ 80 hoje, quanto cairá o meu teto diário seguro para os dias restantes?`,
        subItems: [
          { name: "Teto de Hoje", value: safeDailyAllowance },
          { name: "Dias Restantes", value: remainingDays },
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

  const filteredNodes = useMemo(() => {
    if (activeFilter === "all") return nodes;
    if (activeFilter === "drains") {
      return nodes.filter((n) => n.id === "core" || n.category === "drains" || n.category === "reserve");
    }
    if (activeFilter === "cashflow") {
      return nodes.filter((n) => n.id === "core" || n.category === "income" || n.category === "fixed");
    }
    if (activeFilter === "credit") {
      return nodes.filter((n) => n.id === "core" || n.category === "credit" || n.category === "reserve");
    }
    return nodes;
  }, [nodes, activeFilter]);

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const renderNodeIcon = (name: string, size = 15) => {
    switch (name) {
      case "Compass":
        return <Compass size={size} />;
      case "TrendingUp":
        return <TrendingUp size={size} />;
      case "Building2":
        return <Building2 size={size} />;
      case "CreditCard":
        return <CreditCard size={size} />;
      case "Flame":
        return <Flame size={size} />;
      case "Zap":
        return <Zap size={size} />;
      default:
        return <Sparkles size={size} />;
    }
  };

  const getNodeStyles = (category: MindMapNode["category"]) => {
    switch (category) {
      case "core":
        return {
          bg: "bg-[#0F172A]",
          border: "border-cyan-400/90 shadow-[0_0_30px_rgba(34,211,238,0.35)]",
          glow: "#22d3ee",
          badge: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40",
          iconBg: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40",
        };
      case "income":
        return {
          bg: "bg-[#064E3B]/80",
          border: "border-emerald-400/70 shadow-[0_0_20px_rgba(52,211,153,0.3)]",
          glow: "#34d399",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
          iconBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
        };
      case "fixed":
        return {
          bg: "bg-[#78350F]/80",
          border: "border-amber-400/70 shadow-[0_0_20px_rgba(251,191,36,0.3)]",
          glow: "#fbbf24",
          badge: "bg-amber-500/20 text-amber-300 border-amber-400/40",
          iconBg: "bg-amber-500/20 text-amber-300 border-amber-400/40",
        };
      case "credit":
        return {
          bg: "bg-[#1E1B4B]/80",
          border: "border-indigo-400/70 shadow-[0_0_20px_rgba(129,140,248,0.3)]",
          glow: "#818cf8",
          badge: "bg-indigo-500/20 text-indigo-300 border-indigo-400/40",
          iconBg: "bg-indigo-500/20 text-indigo-300 border-indigo-400/40",
        };
      case "drains":
        return {
          bg: "bg-[#881337]/80",
          border: "border-rose-400/80 shadow-[0_0_25px_rgba(244,63,94,0.35)]",
          glow: "#f43f5e",
          badge: "bg-rose-500/20 text-rose-300 border-rose-400/40",
          iconBg: "bg-rose-500/20 text-rose-300 border-rose-400/40",
        };
      case "reserve":
        return {
          bg: "bg-[#134E4A]/80",
          border: "border-teal-400/70 shadow-[0_0_20px_rgba(45,212,191,0.3)]",
          glow: "#2dd4bf",
          badge: "bg-teal-500/20 text-teal-300 border-teal-400/40",
          iconBg: "bg-teal-500/20 text-teal-300 border-teal-400/40",
        };
    }
  };

  return (
    <div
      className={`relative w-full rounded-[28px] sm:rounded-[36px] overflow-hidden border border-cyan-500/20 bg-[#0B0D13] text-white transition-all duration-300 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ${
        isExpandedFull ? "fixed inset-2 sm:inset-4 z-[120] max-h-[96vh]" : "min-h-[580px] sm:min-h-[620px]"
      }`}
    >
      {/* GLOW DE FUNDO CÓSMICO SEM NENHUM QUADRICULADO OU PONTOS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-cyan-600/12 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-600/12 rounded-full blur-[90px]" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-emerald-600/10 rounded-full blur-[80px]" />
      </div>

      {/* HEADER DO MAPA MENTAL (RESPONSIVO PARA MOBILE) */}
      <div className="relative z-20 p-3.5 sm:p-5 flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
            <Compass size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold tracking-tight truncate">
                Mapa Mental Neural
              </h3>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                Kiko Core
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              Toque em qualquer nó para inspecionar métricas e ações.
            </p>
          </div>
        </div>

        {/* CONTROLES: FILTROS + ZOOM + EXPANDIR */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Filtros em Pílulas */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                activeFilter === "all" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("drains")}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                activeFilter === "drains" ? "bg-rose-500 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Ralos
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("cashflow")}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                activeFilter === "cashflow" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Fluxo
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center gap-1 p-0.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-400">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.85, z - 0.1))}
              className="p-1 hover:text-white transition-colors"
              title="Reduzir zoom"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1 hover:text-white transition-colors"
              title="Resetar zoom"
            >
              <RotateCcw size={12} />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.2, z + 0.1))}
              className="p-1 hover:text-white transition-colors"
              title="Aumentar zoom"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Tela Cheia */}
          <button
            type="button"
            onClick={() => setIsExpandedFull(!isExpandedFull)}
            className="p-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            title={isExpandedFull ? "Fechar tela cheia" : "Tela cheia"}
          >
            {isExpandedFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* ÁREA INTERATIVA DO GRAFO SVG + NÓS (COM SCALING RESPONSIVO) */}
      <div
        className="relative w-full h-[480px] sm:h-[540px] overflow-hidden select-none"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
      >
        {/* LINHAS SINÁPTICAS (SVG BEZIER) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="sin-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="sin-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="sin-rose" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="sin-amber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="sin-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {filteredNodes.map((node) => {
            if (!node.parentId) return null;
            const parent = filteredNodes.find((p) => p.id === node.parentId);
            if (!parent) return null;

            const strokeGrad =
              node.category === "drains"
                ? "url(#sin-rose)"
                : node.category === "income"
                ? "url(#sin-emerald)"
                : node.category === "fixed"
                ? "url(#sin-amber)"
                : node.category === "credit"
                ? "url(#sin-indigo)"
                : "url(#sin-cyan)";

            const isHighlighted = selectedNodeId === node.id || selectedNodeId === parent.id;

            return (
              <g key={`sin_${parent.id}_${node.id}`}>
                <path
                  d={`M ${parent.x}% ${parent.y}% Q ${(parent.x + node.x) / 2}% ${
                    (parent.y + node.y) / 2 + (node.category === "drains" ? -6 : 6)
                  }%, ${node.x}% ${node.y}%`}
                  fill="none"
                  stroke={strokeGrad}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  className="transition-all duration-300"
                />

                <circle r={isHighlighted ? 2.5 : 1.5} fill="#22d3ee" className="animate-pulse">
                  <animateMotion
                    path={`M ${parent.x}% ${parent.y}% Q ${(parent.x + node.x) / 2}% ${
                      (parent.y + node.y) / 2 + (node.category === "drains" ? -6 : 6)
                    }%, ${node.x}% ${node.y}%`}
                    dur={isHighlighted ? "2.5s" : "4.5s"}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })}
        </svg>

        {/* NÓS INTERATIVOS COM COORDENADAS RESPONSIVAS E PADDING SEGURO */}
        {filteredNodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isCore = node.category === "core";
          const styles = getNodeStyles(node.category);

          return (
            <div
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: `translate(-50%, -50%) scale(${isSelected ? 1.06 : 1})`,
              }}
              className={`absolute z-10 cursor-pointer transition-all duration-300 border backdrop-blur-xl ${
                isCore
                  ? "p-3 sm:p-4 rounded-3xl min-w-[140px] sm:min-w-[170px]"
                  : "p-2 sm:p-2.5 rounded-2xl min-w-[110px] sm:min-w-[140px]"
              } ${styles.bg} ${styles.border} ${
                isSelected ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-black" : "hover:scale-105"
              }`}
            >
              {isCore ? (
                <div className="flex flex-col items-center text-center space-y-1">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 flex items-center justify-center relative shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                    <Compass size={22} />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block opacity-75">
                      {node.label}
                    </span>
                    <strong className="text-xs sm:text-sm font-bold font-mono block tabular-nums text-white">
                      R$ {formatCurrency(node.amount || 0)}
                    </strong>
                  </div>
                  <span className={`text-[8px] sm:text-[9px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>
                    Meta: R$ {formatCurrency(targetEndMonthBalance)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 border ${styles.iconBg}`}>
                    {renderNodeIcon(node.iconName, 14)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-semibold block truncate leading-tight opacity-90">
                      {node.label}
                    </span>
                    {node.amount !== undefined && (
                      <strong className="text-[11px] sm:text-xs font-bold font-mono block truncate tabular-nums text-white">
                        R$ {formatCurrency(node.amount)}
                      </strong>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DRAWER RETRÁTIL DE INSPEÇÃO (NUNCA COBRE OS NÓS NO MOBILE) */}
      {selectedNode && (
        <div className="relative z-30 p-3.5 sm:p-4 bg-slate-950/95 border-t border-cyan-500/30 backdrop-blur-2xl transition-all animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center">
                {renderNodeIcon(selectedNode.iconName, 13)}
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  {selectedNode.label}
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedNode.amount !== undefined
                    ? `Impacto: R$ ${formatCurrency(selectedNode.amount)}`
                    : "Métrica Estrutural"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  selectedNode.status === "healthy"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                    : selectedNode.status === "alert"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-400/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                }`}
              >
                {selectedNode.status || "OK"}
              </span>

              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Fechar inspeção"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed my-2 text-slate-300">
            {selectedNode.insight || selectedNode.description}
          </p>

          {/* Sub-itens auditados */}
          {selectedNode.details?.subItems && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 my-2">
              {selectedNode.details.subItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[10px] p-1.5 rounded-lg bg-slate-900/80 border border-slate-800"
                >
                  <span className="truncate max-w-[120px] text-slate-400">{item.name}</span>
                  <strong className="font-mono text-white tabular-nums">
                    R$ {formatCurrency(item.value)}
                  </strong>
                </div>
              ))}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            {selectedNode.details?.actionPrompt && (
              <button
                type="button"
                onClick={() => onDiscussWithAI(selectedNode.details!.actionPrompt!)}
                className="flex-1 py-1.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <MessageSquare size={13} />
                <span>Discutir com o Consultor no Chat</span>
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
                className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all cursor-pointer active:scale-95"
              >
                Simular Corte
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
