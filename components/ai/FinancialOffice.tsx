"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Focus,
  Maximize2,
  MessageCircle,
  MonitorUp,
  Presentation,
  RefreshCw,
  Radio,
  Rows3,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { CardItem, GoalItem, RecurringItem } from "@/types";
import type { MonthProjection, TransactionItem } from "@/context/WalletContext";
import type { FinancialDiagnosis } from "@/lib/services/financialDiagnosisService";
import {
  buildAgentOfficeAnalysis,
  type OfficeAnalysis,
} from "@/lib/services/agentOfficeService";
import type { WalletCharacterId } from "@/components/companion/WalletCharacters";

type OfficeAgentId = WalletCharacterId;

interface FinancialOfficeProps {
  cards: CardItem[];
  transactions: TransactionItem[];
  recurringItems: RecurringItem[];
  goals: GoalItem[];
  monthlyProjections: MonthProjection[];
  diagnosis: FinancialDiagnosis | null;
  targetEndMonthBalance: number;
  isAnalyzing?: boolean;
  onRefresh: () => void;
  onDiscussWithAI: (prompt: string, agentId?: string) => void;
}

interface AgentDefinition {
  id: OfficeAgentId;
  name: string;
  area: string;
  desk: string;
  task: string;
  color: string;
  softColor: string;
  prompt: string;
  animation: string;
  duration: number;
  liveStatus: string;
  roleMark: string;
  skin: string;
  hair: string;
}

type OfficeViewMode = "overview" | "focus";

type InspectionTarget =
  | { kind: "agent"; agentId: OfficeAgentId }
  | { kind: "meeting" }
  | { kind: "wall" }
  | null;

const AGENTS: AgentDefinition[] = [
  {
    id: "wallet-rubi",
    name: "Rubi",
    area: "Caixa e renda",
    desk: "Mesa 01",
    task: "Fechamento dos próximos 6 meses",
    color: "#EF4444",
    softColor: "#FFF1F2",
    prompt:
      "Rubi, abra minha projeção de caixa e explique os meses que exigem mais atenção.",
    animation: "office-walk-rubi",
    duration: 13,
    liveStatus: "Projetando caixa · 6 meses",
    roleMark: "R$",
    skin: "#B97855",
    hair: "#32231F",
  },
  {
    id: "wallet-sol",
    name: "Sol",
    area: "Hábitos e recorrências",
    desk: "Mesa 02",
    task: "Revisão das despesas dos últimos 30 dias",
    color: "#F59E0B",
    softColor: "#FFFBEB",
    prompt:
      "Sol, abra meus padrões de gastos e mostre o que mudou nos últimos 30 dias.",
    animation: "office-walk-sol",
    duration: 15,
    liveStatus: "Comparando últimos 30 dias",
    roleMark: "◌",
    skin: "#E8B58E",
    hair: "#8A4E2B",
  },
  {
    id: "wallet-nanquim",
    name: "Nanquim",
    area: "Cartões e parcelas",
    desk: "Mesa 03",
    task: "Conferência das próximas faturas",
    color: "#3B82F6",
    softColor: "#EFF6FF",
    prompt:
      "Nanquim, abra a previsão das minhas faturas e detalhe os meses de maior valor.",
    animation: "office-walk-nanquim",
    duration: 14,
    liveStatus: "Analisando faturas de Nov.",
    roleMark: "▣",
    skin: "#9B6348",
    hair: "#171719",
  },
  {
    id: "wallet-atlos",
    name: "Atlos",
    area: "Metas e patrimônio",
    desk: "Mesa 04",
    task: "Atualização dos cenários de aporte",
    color: "#10B981",
    softColor: "#ECFDF5",
    prompt:
      "Atlos, abra meus cenários de aporte e compare os horizontes de 12, 24 e 36 meses.",
    animation: "office-walk-atlos",
    duration: 16,
    liveStatus: "Calculando margem de aporte",
    roleMark: "↗",
    skin: "#D89A72",
    hair: "#513126",
  },
];

function formatCurrency(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mil`;
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function FinancialOffice({
  cards,
  transactions,
  recurringItems,
  goals,
  monthlyProjections,
  targetEndMonthBalance,
  isAnalyzing = false,
  onRefresh,
  onDiscussWithAI,
}: FinancialOfficeProps) {
  const [selectedAgentId, setSelectedAgentId] =
    useState<OfficeAgentId>("wallet-rubi");
  const [hoveredAgentId, setHoveredAgentId] =
    useState<OfficeAgentId | null>(null);
  const [viewMode, setViewMode] = useState<OfficeViewMode>("overview");
  const [meetingMode, setMeetingMode] = useState(false);
  const [inspectionTarget, setInspectionTarget] =
    useState<InspectionTarget>(null);

  const analysis = useMemo(
    () =>
      buildAgentOfficeAnalysis({
        cards,
        transactions,
        recurringItems,
        goals,
        monthlyProjections,
        targetEndMonthBalance,
      }),
    [
      cards,
      transactions,
      recurringItems,
      goals,
      monthlyProjections,
      targetEndMonthBalance,
    ]
  );

  const selectedAgent =
    AGENTS.find((agent) => agent.id === selectedAgentId) || AGENTS[0];

  const inspectAgent = (agentId: OfficeAgentId) => {
    setSelectedAgentId(agentId);
    setMeetingMode(false);
    setInspectionTarget({ kind: "agent", agentId });
  };

  const callMeeting = () => {
    setMeetingMode(true);
    setViewMode("overview");
    setInspectionTarget({ kind: "meeting" });
  };

  return (
    <section className="overflow-hidden rounded-[30px] border border-black/[0.06] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:rounded-[36px]">
      <OfficeHeader
        analysis={analysis}
        isAnalyzing={isAnalyzing}
        onRefresh={onRefresh}
      />

      <div className="grid border-b border-black/[0.06] bg-[#F4F4F1] xl:grid-cols-[minmax(0,1fr)_280px]">
        <OfficeScene
          analysis={analysis}
          selectedAgentId={selectedAgentId}
          hoveredAgentId={hoveredAgentId}
          viewMode={viewMode}
          meetingMode={meetingMode}
          inspectionTarget={inspectionTarget}
          onSelectAgent={inspectAgent}
          onHoverAgent={setHoveredAgentId}
          onChangeView={setViewMode}
          onCallMeeting={callMeeting}
          onOpenWall={() => setInspectionTarget({ kind: "wall" })}
          onCloseInspector={() => {
            setInspectionTarget(null);
            setMeetingMode(false);
          }}
          onDiscussWithAI={onDiscussWithAI}
        />
        <TeamAgenda
          analysis={analysis}
          selectedAgentId={selectedAgentId}
          hoveredAgentId={hoveredAgentId}
          meetingMode={meetingMode}
          onSelectAgent={inspectAgent}
          onHoverAgent={setHoveredAgentId}
          onCallMeeting={callMeeting}
        />
      </div>

      <AgentWorkbench
        agent={selectedAgent}
        analysis={analysis}
        onSelectAgent={inspectAgent}
        onDiscuss={() => onDiscussWithAI(selectedAgent.prompt, selectedAgent.id)}
      />
    </section>
  );
}

function OfficeHeader({
  analysis,
  isAnalyzing,
  onRefresh,
}: {
  analysis: OfficeAnalysis;
  isAnalyzing: boolean;
  onRefresh: () => void;
}) {
  const attentionCount = analysis.findings.filter(
    (finding) => finding.severity === "warning"
  ).length;

  return (
    <>
      <header className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1D1D1F] text-white">
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-[#1D1D1F]">
                Escritório vivo Wallet+
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Expediente aberto
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#6E6E73]">
              Quatro agentes trabalhando sobre a mesma base financeira, cada um em sua especialidade.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isAnalyzing}
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-xl border border-black/[0.07] bg-[#F7F7F7] px-3 text-[11px] font-semibold text-[#1D1D1F] transition-colors hover:bg-[#ECECEE] disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw size={13} className={isAnalyzing ? "animate-spin" : ""} />
          Atualizar dados
        </button>
      </header>

      <div className="grid grid-cols-2 border-t border-black/[0.05] sm:grid-cols-4">
        <HeaderMetric
          label="Meses abaixo da meta"
          value={String(analysis.liquidity.riskMonths)}
          tone={analysis.liquidity.riskMonths > 0 ? "warning" : "positive"}
        />
        <HeaderMetric
          label="Pico de fatura"
          value={formatCurrency(analysis.credit.peakInvoice, true)}
        />
        <HeaderMetric
          label="Categorias em alta"
          value={String(analysis.patterns.risingCount)}
          tone={analysis.patterns.risingCount > 0 ? "warning" : "neutral"}
        />
        <HeaderMetric
          label="Margem para metas"
          value={formatCurrency(
            analysis.investments.suggestedMonthlyContribution,
            true
          )}
          tone="positive"
          last
          badge={attentionCount > 0 ? `${attentionCount} atenção` : "Em ordem"}
        />
      </div>
    </>
  );
}

function HeaderMetric({
  label,
  value,
  tone = "neutral",
  last = false,
  badge,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "positive";
  last?: boolean;
  badge?: string;
}) {
  const color =
    tone === "warning"
      ? "text-amber-700"
      : tone === "positive"
        ? "text-emerald-700"
        : "text-[#1D1D1F]";

  return (
    <div
      className={`min-w-0 border-t border-black/[0.05] px-4 py-3 sm:border-t-0 sm:px-6 ${
        last ? "" : "border-r"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
          {label}
        </span>
        {badge && (
          <span className="hidden rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[8px] text-[#6E6E73] lg:block">
            {badge}
          </span>
        )}
      </div>
      <strong className={`mt-1 block truncate font-mono text-sm ${color}`}>
        {value}
      </strong>
    </div>
  );
}

function OfficeScene({
  analysis,
  selectedAgentId,
  hoveredAgentId,
  viewMode,
  meetingMode,
  inspectionTarget,
  onSelectAgent,
  onHoverAgent,
  onChangeView,
  onCallMeeting,
  onOpenWall,
  onCloseInspector,
  onDiscussWithAI,
}: {
  analysis: OfficeAnalysis;
  selectedAgentId: OfficeAgentId;
  hoveredAgentId: OfficeAgentId | null;
  viewMode: OfficeViewMode;
  meetingMode: boolean;
  inspectionTarget: InspectionTarget;
  onSelectAgent: (agentId: OfficeAgentId) => void;
  onHoverAgent: (agentId: OfficeAgentId | null) => void;
  onChangeView: (mode: OfficeViewMode) => void;
  onCallMeeting: () => void;
  onOpenWall: () => void;
  onCloseInspector: () => void;
  onDiscussWithAI: (prompt: string, agentId?: string) => void;
}) {
  const selectedAgent =
    AGENTS.find((agent) => agent.id === selectedAgentId) || AGENTS[0];
  const focusOrigins: Record<OfficeAgentId, string> = {
    "wallet-rubi": "32% 45%",
    "wallet-sol": "68% 45%",
    "wallet-nanquim": "32% 76%",
    "wallet-atlos": "68% 76%",
  };

  return (
    <div className="relative min-h-[590px] overflow-hidden p-3 sm:min-h-[680px] sm:p-5">
      <style>{`
        @keyframes office-walk-rubi {
          0%, 62%, 100% { transform: translate3d(0,0,0); }
          72% { transform: translate3d(14px,8px,0); }
          84% { transform: translate3d(5px,17px,0); }
        }
        @keyframes office-walk-sol {
          0%, 58%, 100% { transform: translate3d(0,0,0); }
          70% { transform: translate3d(-15px,9px,0); }
          84% { transform: translate3d(-6px,18px,0); }
        }
        @keyframes office-walk-nanquim {
          0%, 66%, 100% { transform: translate3d(0,0,0); }
          76% { transform: translate3d(16px,-7px,0); }
          88% { transform: translate3d(7px,-15px,0); }
        }
        @keyframes office-walk-atlos {
          0%, 60%, 100% { transform: translate3d(0,0,0); }
          72% { transform: translate3d(-16px,-8px,0); }
          86% { transform: translate3d(-6px,-16px,0); }
        }
        @keyframes office-step {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes office-screen {
          0%, 100% { opacity: .76; }
          50% { opacity: 1; }
        }
        @keyframes office-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes office-blink {
          0%, 45%, 48%, 100% { transform: scaleY(1); }
          46.5% { transform: scaleY(.08); }
        }
        @keyframes office-type-left {
          0%, 100% { transform: rotate(5deg) translateY(0); }
          50% { transform: rotate(-5deg) translateY(2px); }
        }
        @keyframes office-type-right {
          0%, 100% { transform: rotate(-5deg) translateY(2px); }
          50% { transform: rotate(5deg) translateY(0); }
        }
        @keyframes office-steam {
          0% { opacity: 0; transform: translateY(4px) scale(.8); }
          35% { opacity: .75; }
          100% { opacity: 0; transform: translateY(-12px) translateX(3px) scale(1.2); }
        }
        @keyframes office-data-flow {
          from { stroke-dashoffset: 42; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes office-bar-pulse {
          0%, 100% { transform: scaleY(.68); opacity: .58; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes office-light-shift {
          0%, 100% { opacity: .16; transform: translateX(0); }
          50% { opacity: .25; transform: translateX(10px); }
        }
        .office-worker { will-change: transform; }
        .office-worker:hover, .office-worker:focus-visible { animation-play-state: paused !important; z-index: 50 !important; }
        .office-worker-body { animation: office-step .72s ease-in-out infinite; }
        .office-monitor-glow { animation: office-screen 3.8s ease-in-out infinite; }
        .office-status-float { animation: office-float 2.8s ease-in-out infinite; }
        .office-eye { animation: office-blink 5.4s ease-in-out infinite; transform-origin: center; }
        .office-hand-left { animation: office-type-left .58s ease-in-out infinite; transform-origin: top center; }
        .office-hand-right { animation: office-type-right .58s ease-in-out infinite; transform-origin: top center; }
        .office-steam { animation: office-steam 2.2s ease-out infinite; transform-origin: center; }
        .office-screen-line { animation: office-data-flow 2.4s linear infinite; }
        .office-screen-bar { animation: office-bar-pulse 2.1s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom; }
        .office-light-beam { animation: office-light-shift 7s ease-in-out infinite; }
        .office-station-inner { transition: transform .35s cubic-bezier(.2,.8,.2,1), filter .35s ease; transform-box: fill-box; transform-origin: center; }
        .office-station:hover .office-station-inner, .office-station[data-highlighted="true"] .office-station-inner { transform: translateY(-4px) scale(1.025); filter: saturate(1.08) brightness(1.03); }
        @media (prefers-reduced-motion: reduce) {
          .office-worker, .office-worker-body, .office-monitor-glow, .office-status-float,
          .office-eye, .office-hand-left, .office-hand-right, .office-steam,
          .office-screen-line, .office-screen-bar, .office-light-beam { animation: none !important; }
        }
      `}</style>

      <div className="absolute inset-3 overflow-hidden rounded-[28px] border border-black/[0.08] bg-[#D6DED9] shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_20px_50px_rgba(46,59,52,.12)] sm:inset-5 sm:rounded-[34px]">
        <svg
          viewBox="0 0 960 610"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{
            transform: viewMode === "focus" && !meetingMode ? "scale(1.085)" : "scale(1)",
            transformOrigin: focusOrigins[selectedAgentId],
          }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="office-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E9ECE7" />
              <stop offset="1" stopColor="#D3D7CF" />
            </linearGradient>
            <linearGradient id="office-window" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#B7D2CE" />
              <stop offset="0.52" stopColor="#6E918B" />
              <stop offset="1" stopColor="#466A65" />
            </linearGradient>
            <linearGradient id="office-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#485868" />
              <stop offset="1" stopColor="#293847" />
            </linearGradient>
            <linearGradient id="office-wood" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#D9BD91" />
              <stop offset="1" stopColor="#A67D50" />
            </linearGradient>
            <linearGradient id="office-rug" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#788A85" />
              <stop offset="1" stopColor="#516662" />
            </linearGradient>
            <linearGradient id="office-light-beam" x1="0" y1="0" x2="0.9" y2="1">
              <stop offset="0" stopColor="#FFFBEA" stopOpacity=".82" />
              <stop offset=".7" stopColor="#FFFBEA" stopOpacity=".16" />
              <stop offset="1" stopColor="#FFFBEA" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="office-vignette" cx="50%" cy="43%" r="70%">
              <stop offset="58%" stopColor="#0E181D" stopOpacity="0" />
              <stop offset="100%" stopColor="#0E181D" stopOpacity=".34" />
            </radialGradient>
            <pattern id="office-brick" width="42" height="22" patternUnits="userSpaceOnUse">
              <rect width="42" height="22" fill="#C8B79D" />
              <path d="M0 0H42M0 22H42M21 0V11M0 11H42M10.5 11V22M31.5 11V22" fill="none" stroke="#A69276" strokeWidth="1.2" opacity=".56" />
            </pattern>
            <pattern id="office-carpet" width="34" height="34" patternUnits="userSpaceOnUse">
              <rect width="34" height="34" fill="transparent" />
              <path d="M0 34L34 0M-8 8L8-8M26 42L42 26" stroke="#C4D0D8" strokeWidth="1" opacity=".08" />
            </pattern>
            <clipPath id="office-floor-clip">
              <path d="M65 183H895L944 574H16Z" />
            </clipPath>
            <filter id="office-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#101820" floodOpacity=".28" />
            </filter>
            <filter id="office-soft-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#101820" floodOpacity=".2" />
            </filter>
            <filter id="office-red-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="13" result="blur" />
              <feFlood floodColor="#EF4444" floodOpacity=".38" />
              <feComposite in2="blur" operator="in" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="office-amber-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="13" result="blur" />
              <feFlood floodColor="#F59E0B" floodOpacity=".34" />
              <feComposite in2="blur" operator="in" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="office-blue-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="13" result="blur" />
              <feFlood floodColor="#3B82F6" floodOpacity=".36" />
              <feComposite in2="blur" operator="in" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="office-green-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="13" result="blur" />
              <feFlood floodColor="#10B981" floodOpacity=".36" />
              <feComposite in2="blur" operator="in" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Sala completa: parede, janelas e piso */}
          <rect width="960" height="610" fill="#CCD7D1" />
          <rect x="64" y="24" width="832" height="174" rx="18" fill="url(#office-wall)" stroke="#B6C0B9" strokeWidth="3" />
          <rect x="82" y="42" width="142" height="138" rx="8" fill="url(#office-brick)" />
          <rect x="736" y="42" width="142" height="138" rx="8" fill="url(#office-brick)" />
          <rect x="244" y="42" width="472" height="126" rx="10" fill="url(#office-window)" stroke="#536F6A" strokeWidth="7" />
          <path d="M362 46V164M480 46V164M598 46V164" stroke="#D9E6E3" strokeWidth="4" opacity=".72" />
          <path d="M253 50L390 50L310 164L248 164Z" fill="#FFFFFF" opacity=".18" />
          <path d="M510 47L608 47L534 164L447 164Z" fill="#FFFFFF" opacity=".1" />
          <g
            role="button"
            tabIndex={0}
            aria-label="Abrir painel de indicadores do escritório"
            onClick={onOpenWall}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onOpenWall();
            }}
            className="cursor-pointer outline-none"
            filter="url(#office-soft-shadow)"
          >
            <rect x="758" y="55" width="98" height="72" rx="9" fill="#152126" stroke="#9BB9B2" strokeWidth="2" />
            <rect x="766" y="63" width="82" height="56" rx="5" fill="#1E3335" />
            <path className="office-screen-line" d="M773 104L786 91L799 98L814 78L829 86L842 69" fill="none" stroke="#69D5BC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="42" />
            <circle cx="842" cy="69" r="4" fill="#69D5BC" />
            <text x="773" y="75" fontSize="7" fill="#B8D6CF" letterSpacing="1">WALLET LIVE</text>
          </g>
          <path d="M65 183H895L944 574H16Z" fill="url(#office-floor)" stroke="#E9ECE6" strokeWidth="8" />
          <rect x="0" y="175" width="960" height="410" fill="url(#office-carpet)" clipPath="url(#office-floor-clip)" />
          <g clipPath="url(#office-floor-clip)" opacity=".11">
            <path d="M480 184L355 574M480 184L230 574M480 184L105 574M480 184L605 574M480 184L730 574M480 184L855 574" stroke="#D9E4E7" strokeWidth="1.2" />
            <path d="M55 235H905M46 300H914M38 382H922M27 476H933" stroke="#D9E4E7" strokeWidth="1.2" />
          </g>
          <g clipPath="url(#office-floor-clip)">
            <path className="office-light-beam" d="M260 167H374L510 520H310Z" fill="url(#office-light-beam)" />
            <path className="office-light-beam" d="M486 167H588L776 520H565Z" fill="url(#office-light-beam)" style={{ animationDelay: "-2.5s" }} />
          </g>
          <path d="M65 183H895" stroke="#F5F4ED" strokeWidth="14" />
          <path d="M65 183L16 574M895 183L944 574" stroke="#AFBBB5" strokeWidth="4" opacity=".5" />

          {/* Armários e lounge, dando escala ao ambiente */}
          <g filter="url(#office-soft-shadow)">
            <rect x="91" y="72" width="102" height="108" rx="5" fill="#6D7880" />
            <path d="M142 72V180" stroke="#9EA8AE" strokeWidth="2" />
            <circle cx="132" cy="126" r="3" fill="#D5D9DC" />
            <circle cx="152" cy="126" r="3" fill="#D5D9DC" />
          </g>
          <g filter="url(#office-soft-shadow)">
            <rect x="748" y="137" width="118" height="39" rx="6" fill="#8C684B" />
            <rect x="757" y="145" width="100" height="6" rx="2" fill="#D4B68D" />
            <rect x="757" y="160" width="100" height="6" rx="2" fill="#D4B68D" />
          </g>
          <g filter="url(#office-soft-shadow)">
            <rect x="76" y="225" width="134" height="54" rx="18" fill="#A77857" />
            <rect x="83" y="231" width="120" height="31" rx="13" fill="#C59873" />
            <circle cx="97" cy="246" r="7" fill="#D8B18E" />
            <circle cx="189" cy="246" r="7" fill="#D8B18E" />
            <ellipse cx="244" cy="261" rx="28" ry="16" fill="#B98C5F" />
          </g>

          <OfficePlantSvg x={222} y={98} scale={1.05} />
          <OfficePlantSvg x={724} y={113} scale={0.86} />
          <OfficePlantSvg x={55} y={483} scale={0.92} />
          <OfficePlantSvg x={862} y={476} scale={1.05} />

          {/* Quatro estações de trabalho */}
          {AGENTS.map((agent, index) => {
            const positions = [
              { x: 230, y: 264, flip: false },
              { x: 555, y: 264, flip: true },
              { x: 230, y: 446, flip: false },
              { x: 555, y: 446, flip: true },
            ];
            const position = positions[index];
            return (
              <OfficeDeskSvg
                key={agent.id}
                x={position.x}
                y={position.y}
                color={agent.color}
                label={agent.area.toUpperCase()}
                flip={position.flip}
                highlighted={selectedAgentId === agent.id || hoveredAgentId === agent.id}
                onSelect={() => onSelectAgent(agent.id)}
                onHover={(hovered) => onHoverAgent(hovered ? agent.id : null)}
              />
            );
          })}

          {/* Núcleo colaborativo central */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Chamar reunião executiva"
            onClick={onCallMeeting}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onCallMeeting();
            }}
            className="cursor-pointer outline-none"
            filter="url(#office-shadow)"
          >
            <rect x="375" y="334" width="210" height="108" rx="48" fill="url(#office-rug)" opacity=".72" />
            <ellipse cx="480" cy="386" rx="83" ry="38" fill="#8A6848" />
            <ellipse cx="480" cy="378" rx="83" ry="38" fill="url(#office-wood)" stroke="#735438" strokeWidth="4" />
            <rect x="438" y="360" width="84" height="37" rx="7" fill="#22282D" />
            <rect className="office-monitor-glow" x="445" y="366" width="70" height="25" rx="4" fill="#4FC0C0" />
            <rect x="473" y="415" width="14" height="28" fill="#63472F" />
            <ellipse cx="480" cy="446" rx="30" ry="8" fill="#19232A" opacity=".3" />
          </g>

          {/* Pequenos objetos e caminhos de circulação */}
          <path d="M480 210V315M480 451V540" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="7 11" opacity=".16" />
          <path d="M120 358H349M611 358H840" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="7 11" opacity=".12" />
          <g transform="translate(815 247)" filter="url(#office-soft-shadow)">
            <rect width="54" height="72" rx="7" fill="#D4D8D5" />
            <rect x="8" y="10" width="38" height="24" rx="4" fill="#5C7C78" />
            <circle cx="19" cy="50" r="6" fill="#86A39E" />
            <circle cx="35" cy="50" r="6" fill="#86A39E" />
          </g>
          <rect width="960" height="610" fill="url(#office-vignette)" pointerEvents="none" />
        </svg>

        <div className="absolute left-4 top-4 z-40 flex items-center gap-2 rounded-full border border-white/70 bg-white/88 px-3 py-1.5 text-[9px] font-semibold text-[#435049] shadow-[0_8px_24px_rgba(44,62,53,.12)] backdrop-blur-xl sm:left-6 sm:top-6">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Escritório ao vivo · 4 agentes
        </div>

        <div className="office-status-float absolute right-4 top-4 z-40 hidden max-w-[210px] rounded-2xl border border-white/70 bg-[#15201B]/90 px-3 py-2 text-white shadow-[0_12px_30px_rgba(29,43,36,.24)] backdrop-blur-xl sm:block sm:right-6 sm:top-6">
          <span className="block text-[8px] font-bold uppercase tracking-[.12em] text-white/45">Mesa selecionada</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedAgent.color }} />
            <strong className="text-[10px]">{selectedAgent.name}</strong>
            <span className="truncate text-[9px] text-white/55">· {selectedAgent.area}</span>
          </div>
        </div>

        <OfficeWorker
          agent={AGENTS[0]}
          active={selectedAgentId === AGENTS[0].id}
          hovered={hoveredAgentId === AGENTS[0].id}
          meeting={meetingMode}
          className={meetingMode ? "left-[42%] top-[54%]" : "left-[24%] top-[39%]"}
          onSelect={() => onSelectAgent(AGENTS[0].id)}
          onHover={(hovered) => onHoverAgent(hovered ? AGENTS[0].id : null)}
        />
        <OfficeWorker
          agent={AGENTS[1]}
          active={selectedAgentId === AGENTS[1].id}
          hovered={hoveredAgentId === AGENTS[1].id}
          meeting={meetingMode}
          className={meetingMode ? "right-[42%] top-[54%]" : "right-[25%] top-[39%]"}
          onSelect={() => onSelectAgent(AGENTS[1].id)}
          onHover={(hovered) => onHoverAgent(hovered ? AGENTS[1].id : null)}
        />
        <OfficeWorker
          agent={AGENTS[2]}
          active={selectedAgentId === AGENTS[2].id}
          hovered={hoveredAgentId === AGENTS[2].id}
          meeting={meetingMode}
          className={meetingMode ? "bottom-[24%] left-[42%]" : "bottom-[17%] left-[25%]"}
          onSelect={() => onSelectAgent(AGENTS[2].id)}
          onHover={(hovered) => onHoverAgent(hovered ? AGENTS[2].id : null)}
        />
        <OfficeWorker
          agent={AGENTS[3]}
          active={selectedAgentId === AGENTS[3].id}
          hovered={hoveredAgentId === AGENTS[3].id}
          meeting={meetingMode}
          className={meetingMode ? "bottom-[24%] right-[42%]" : "bottom-[17%] right-[24%]"}
          onSelect={() => onSelectAgent(AGENTS[3].id)}
          onHover={(hovered) => onHoverAgent(hovered ? AGENTS[3].id : null)}
        />

        {hoveredAgentId && !inspectionTarget && !meetingMode && (
          <AgentHoverCard
            agent={AGENTS.find((agent) => agent.id === hoveredAgentId) || AGENTS[0]}
            analysis={analysis}
          />
        )}

        <OfficeHud
          viewMode={viewMode}
          meetingMode={meetingMode}
          onChangeView={onChangeView}
          onCallMeeting={onCallMeeting}
        />

        {inspectionTarget && (
          <OfficeInspector
            target={inspectionTarget}
            analysis={analysis}
            onClose={onCloseInspector}
            onDiscussWithAI={onDiscussWithAI}
            onSelectAgent={onSelectAgent}
          />
        )}

        <div className="absolute bottom-4 left-4 right-4 z-40 flex items-center justify-between rounded-2xl border border-white/75 bg-white/88 px-3 py-2.5 shadow-[0_10px_30px_rgba(45,60,52,.14)] backdrop-blur-xl sm:bottom-6 sm:left-6 sm:right-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#1D1D1F] text-white">
              <BriefcaseBusiness size={13} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-[#1D1D1F]">Niko · recepção central</p>
              <p className="text-[8px] text-[#86868B]">Clique em um agente para abrir a mesa e conferir os dados</p>
            </div>
          </div>
          <span className="hidden text-[8px] font-mono text-[#86868B] sm:block">
            dados da conta sincronizados
          </span>
        </div>
      </div>
    </div>
  );
}

function OfficeDeskSvg({
  x,
  y,
  color,
  label,
  flip = false,
  highlighted,
  onSelect,
  onHover,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  flip?: boolean;
  highlighted: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}) {
  const monitorX = flip ? 102 : 36;
  const paperX = flip ? 28 : 138;

  return (
    <g
      transform={`translate(${x} ${y})`}
      className="office-station cursor-pointer outline-none"
      data-highlighted={highlighted}
      role="button"
      tabIndex={0}
      aria-label={`Abrir estação de ${label.toLowerCase()}`}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
    >
      <ellipse
        cx="101"
        cy="83"
        rx="124"
        ry="58"
        fill={color}
        opacity={highlighted ? ".18" : ".04"}
        stroke={color}
        strokeWidth={highlighted ? "3" : "1"}
        strokeDasharray="8 7"
        className="transition-all duration-300"
      />
      <g className="office-station-inner" filter="url(#office-shadow)">
      <rect x="0" y="4" width="202" height="72" rx="11" fill="#7B5839" />
      <rect x="0" y="0" width="202" height="64" rx="11" fill="url(#office-wood)" stroke="#7F5C3D" strokeWidth="3" />
      <rect x="4" y="57" width="194" height="12" rx="4" fill="#6F4D32" opacity=".72" />
      <rect x="8" y="54" width="186" height="13" rx="4" fill="#8D6844" />
      <rect x="15" y="66" width="13" height="36" rx="4" fill="#6B4E35" />
      <rect x="174" y="66" width="13" height="36" rx="4" fill="#6B4E35" />
      <ellipse cx={monitorX + 33} cy="16" rx="60" ry="33" fill={color} opacity=".13" filter={`url(#office-${color === "#EF4444" ? "red" : color === "#F59E0B" ? "amber" : color === "#3B82F6" ? "blue" : "green"}-glow)`} />
      <g transform={`translate(${monitorX} -29)`}>
        <rect width="66" height="44" rx="6" fill="#242A2F" />
        <rect className="office-monitor-glow" x="6" y="6" width="54" height="31" rx="3" fill={color} opacity=".82" />
        <path className="office-screen-line" d="M11 29L20 22L28 25L37 14L45 20L55 11" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="42" opacity=".8" />
        <g opacity=".78">
          <rect className="office-screen-bar" x="12" y="18" width="4" height="10" rx="1" fill="#FFFFFF" />
          <rect className="office-screen-bar" x="19" y="14" width="4" height="14" rx="1" fill="#FFFFFF" style={{ animationDelay: "-.4s" }} />
          <rect className="office-screen-bar" x="26" y="10" width="4" height="18" rx="1" fill="#FFFFFF" style={{ animationDelay: "-.8s" }} />
        </g>
        <rect x="29" y="44" width="8" height="13" fill="#242A2F" />
        <rect x="20" y="55" width="26" height="5" rx="2" fill="#242A2F" />
      </g>
      <rect x={monitorX + 8} y="24" width="52" height="12" rx="4" fill="#E6D6BE" />
      <rect x={paperX} y="17" width="38" height="28" rx="3" fill="#F4F1E9" transform={`rotate(${flip ? 5 : -5} ${paperX + 19} 31)`} />
      <circle cx={flip ? 78 : 124} cy="31" r="11" fill={color} opacity=".88" />
      <g transform={`translate(${flip ? 62 : 142} 27)`}>
        <ellipse cx="0" cy="7" rx="9" ry="5" fill="#E9E0D4" />
        <rect x="-9" y="-2" width="18" height="10" rx="3" fill="#F6F0E8" />
        <path d="M9 0C17 0 17 7 9 7" fill="none" stroke="#F6F0E8" strokeWidth="3" />
        <path className="office-steam" d="M-4 -5C-8 -10 0 -12 -3 -18" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        <path className="office-steam" d="M3 -5C-1 -10 7 -12 4 -18" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" style={{ animationDelay: "-.8s" }} />
      </g>
      <text x="14" y="51" fontSize="8" fontWeight="700" letterSpacing="1.2" fill="#6A4D34">{label}</text>

      <g transform={`translate(${flip ? 126 : 28} 79)`}>
        <ellipse cx="25" cy="30" rx="31" ry="12" fill="#15212A" opacity=".3" />
        <rect x="5" y="0" width="40" height="42" rx="15" fill="#5B686E" stroke="#3B464B" strokeWidth="3" />
        <rect x="10" y="6" width="30" height="18" rx="9" fill="#738087" />
        <rect x="22" y="39" width="6" height="22" fill="#3B464B" />
        <path d="M8 61H42M13 61L5 69M37 61L45 69" stroke="#3B464B" strokeWidth="5" strokeLinecap="round" />
      </g>
      </g>
    </g>
  );
}

function OfficePlantSvg({
  x,
  y,
  scale = 1,
}: {
  x: number;
  y: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} filter="url(#office-soft-shadow)">
      <ellipse cx="0" cy="72" rx="27" ry="9" fill="#14221B" opacity=".24" />
      <path d="M-17 45H17L12 75H-12Z" fill="#B9895D" />
      <path d="M0 49C-2 29 0 14 0 0" stroke="#3C6D4C" strokeWidth="5" />
      <ellipse cx="-11" cy="16" rx="13" ry="25" fill="#4E8A5B" transform="rotate(-35 -11 16)" />
      <ellipse cx="14" cy="20" rx="13" ry="25" fill="#5A9A66" transform="rotate(38 14 20)" />
      <ellipse cx="-19" cy="36" rx="12" ry="21" fill="#3E7D50" transform="rotate(-58 -19 36)" />
      <ellipse cx="19" cy="38" rx="12" ry="21" fill="#66A56C" transform="rotate(56 19 38)" />
      <ellipse cx="2" cy="7" rx="11" ry="23" fill="#73AF76" />
    </g>
  );
}

function AgentPortrait({
  agent,
  compact = false,
}: {
  agent: AgentDefinition;
  compact?: boolean;
}) {
  const hasGlasses = agent.id === "wallet-nanquim";

  return (
    <div className={`relative ${compact ? "h-9 w-9" : "h-[46px] w-[42px]"}`}>
      <div
        className={`absolute left-1/2 -translate-x-1/2 overflow-hidden border border-white/50 shadow-[inset_0_3px_6px_rgba(255,255,255,.22),0_5px_10px_rgba(0,0,0,.18)] ${
          compact ? "top-1 h-8 w-8 rounded-[12px]" : "top-0 h-10 w-9 rounded-[15px]"
        }`}
        style={{ backgroundColor: agent.skin }}
      >
        <span
          className="absolute -left-1 -right-1 -top-2 h-5 rounded-[50%]"
          style={{ backgroundColor: agent.hair }}
        />
        <span className="office-eye absolute left-[9px] top-[18px] h-1.5 w-1.5 rounded-full bg-[#2A2422]" />
        <span className="office-eye absolute right-[9px] top-[18px] h-1.5 w-1.5 rounded-full bg-[#2A2422]" style={{ animationDelay: "-.15s" }} />
        <span className="absolute left-1/2 top-[26px] h-1.5 w-3 -translate-x-1/2 rounded-b-full border-b border-[#6C3B35]/70" />
        {hasGlasses && (
          <span className="absolute left-1/2 top-[14px] h-3 w-7 -translate-x-1/2 rounded-md border border-[#20272A] after:absolute after:left-1/2 after:top-1/2 after:h-px after:w-2 after:-translate-x-1/2 after:bg-[#20272A]" />
        )}
      </div>
      {!compact && (
        <>
          <span className="absolute left-0 top-3 h-5 w-2 rounded-l-full border-2 border-r-0 border-[#20272A]" />
          <span className="absolute right-0 top-3 h-5 w-2 rounded-r-full border-2 border-l-0 border-[#20272A]" />
          <span className="absolute right-0 top-7 h-1.5 w-3 rounded-full bg-[#20272A]" />
        </>
      )}
    </div>
  );
}

function OfficeWorker({
  agent,
  active,
  hovered,
  meeting,
  className,
  onSelect,
  onHover,
}: {
  agent: AgentDefinition;
  active: boolean;
  hovered: boolean;
  meeting: boolean;
  className: string;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={`office-worker absolute z-30 flex flex-col items-center rounded-2xl p-1 outline-none transition-[top,left,right,bottom,filter] duration-700 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-white ${className}`}
      style={{
        animation: meeting
          ? "none"
          : `${agent.animation} ${agent.duration}s ease-in-out infinite`,
      }}
      aria-label={`Abrir a mesa de ${agent.name}`}
    >
      <span
        className={`office-status-float absolute -top-10 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/60 bg-[#15201B]/88 px-2.5 py-1.5 text-[7.5px] font-semibold text-white shadow-[0_8px_22px_rgba(0,0,0,.22)] backdrop-blur-xl transition-all ${
          active || hovered || meeting
            ? "translate-y-0 opacity-100"
            : "translate-y-1 opacity-0"
        }`}
      >
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: agent.color }} />
        {meeting ? "Reunião executiva" : agent.liveStatus}
      </span>
      <span
        className={`absolute -inset-3 rounded-[24px] border transition-all ${
          active || hovered ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
        style={{
          backgroundColor: `${agent.color}18`,
          borderColor: `${agent.color}80`,
          boxShadow: `0 0 30px ${agent.color}42`,
        }}
      />
      <span className="absolute left-1/2 top-[65px] h-4 w-14 -translate-x-1/2 rounded-[50%] bg-black/30 blur-[3px]" />
      <div className="office-worker-body relative flex flex-col items-center">
        <AgentPortrait agent={agent} />
        <div
          className="relative -mt-1.5 h-9 w-9 rounded-t-[14px] rounded-b-lg border border-white/55 shadow-[inset_0_4px_5px_rgba(255,255,255,.2),0_5px_8px_rgba(0,0,0,.2)]"
          style={{ background: `linear-gradient(145deg, ${agent.color}, ${agent.color}b8 65%, #222A2F 145%)` }}
        >
          <span className="absolute left-1/2 top-2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-md bg-white/18 text-[7px] font-black text-white">
            {agent.roleMark}
          </span>
          <span className="office-hand-left absolute -left-2 top-3 h-5 w-2 rounded-full shadow-sm" style={{ backgroundColor: agent.skin }} />
          <span className="office-hand-right absolute -right-2 top-3 h-5 w-2 rounded-full shadow-sm" style={{ backgroundColor: agent.skin }} />
          <span className="absolute -bottom-3 left-1.5 h-4 w-2.5 rounded-b-full bg-[#20282E] shadow-sm" />
          <span className="absolute -bottom-3 right-1.5 h-4 w-2.5 rounded-b-full bg-[#20282E] shadow-sm" />
        </div>
      </div>
      <span
        className={`relative z-30 mt-4 whitespace-nowrap rounded-full border bg-white/92 px-2.5 py-1 text-[7.5px] font-bold shadow-[0_6px_14px_rgba(0,0,0,.13)] backdrop-blur-md transition-all ${
          active
            ? "border-black/20 text-[#1D1D1F]"
            : "border-white/70 text-[#50565A]"
        }`}
      >
        {agent.name} · {meeting ? "em reunião" : active ? "mesa aberta" : "trabalhando"}
      </span>
    </button>
  );
}

function AgentHoverCard({
  agent,
  analysis,
}: {
  agent: AgentDefinition;
  analysis: OfficeAnalysis;
}) {
  const finding = analysis.findings.find((item) => item.agentId === agent.id);
  const positions: Record<OfficeAgentId, string> = {
    "wallet-rubi": "left-[31%] top-[29%]",
    "wallet-sol": "right-[30%] top-[29%]",
    "wallet-nanquim": "bottom-[25%] left-[31%]",
    "wallet-atlos": "bottom-[25%] right-[30%]",
  };

  return (
    <div
      className={`pointer-events-none absolute z-50 hidden w-48 rounded-2xl border border-white/60 bg-[#111B18]/88 p-3 text-white shadow-[0_16px_38px_rgba(0,0,0,.28)] backdrop-blur-xl sm:block ${positions[agent.id]}`}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: agent.color }} />
        <strong className="text-[9px]">{agent.name} está processando</strong>
      </div>
      <p className="mt-1.5 text-[8.5px] leading-relaxed text-white/65">
        {finding?.title || agent.liveStatus}
      </p>
      <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2 text-[7.5px] text-white/45">
        <Activity size={9} /> Atualização em tempo real
      </div>
    </div>
  );
}

function OfficeHud({
  viewMode,
  meetingMode,
  onChangeView,
  onCallMeeting,
}: {
  viewMode: OfficeViewMode;
  meetingMode: boolean;
  onChangeView: (mode: OfficeViewMode) => void;
  onCallMeeting: () => void;
}) {
  return (
    <div className="absolute left-4 top-16 z-50 flex flex-col gap-1.5 rounded-2xl border border-white/65 bg-white/82 p-1.5 shadow-[0_12px_30px_rgba(31,47,40,.16)] backdrop-blur-xl sm:left-6">
      <button
        type="button"
        onClick={() => onChangeView(viewMode === "overview" ? "focus" : "overview")}
        title={viewMode === "overview" ? "Focar no agente selecionado" : "Voltar à visão geral"}
        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
          viewMode === "focus"
            ? "bg-[#1D1D1F] text-white shadow-md"
            : "text-[#55605A] hover:bg-white"
        }`}
      >
        {viewMode === "overview" ? <Focus size={14} /> : <Maximize2 size={14} />}
      </button>
      <button
        type="button"
        onClick={onCallMeeting}
        title="Chamar reunião executiva"
        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
          meetingMode
            ? "bg-emerald-600 text-white shadow-md"
            : "text-[#55605A] hover:bg-white"
        }`}
      >
        <Users size={14} />
      </button>
      <span className="mx-auto my-0.5 h-px w-5 bg-black/10" />
      <span className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600" title="Dados sincronizados">
        <Radio size={14} />
      </span>
    </div>
  );
}

function getInspectorSeries(agentId: OfficeAgentId, analysis: OfficeAnalysis) {
  if (agentId === "wallet-rubi") {
    return analysis.liquidity.series.slice(0, 6).map((item) => ({
      label: item.label,
      value: Math.max(0, item.balance),
    }));
  }

  if (agentId === "wallet-nanquim") {
    return analysis.credit.series.slice(0, 6).map((item) => ({
      label: item.label,
      value: item.amount,
    }));
  }

  if (agentId === "wallet-sol") {
    return analysis.patterns.categories.slice(0, 6).map((item) => ({
      label: item.category,
      value: item.total,
    }));
  }

  return [
    { label: "12m", value: analysis.investments.projection12Months },
    { label: "24m", value: analysis.investments.projection24Months },
    { label: "36m", value: analysis.investments.projection36Months },
  ];
}

function getActivityLog(agentId: OfficeAgentId, analysis: OfficeAnalysis) {
  if (agentId === "wallet-rubi") {
    return [
      `Recalculou ${analysis.liquidity.series.length} ciclos de caixa`,
      `Identificou ${analysis.liquidity.riskMonths} mês(es) abaixo da meta`,
      `Validou menor saldo de ${formatCurrency(analysis.liquidity.minimumBalance)}`,
    ];
  }
  if (agentId === "wallet-nanquim") {
    return [
      `Verificou pico de ${formatCurrency(analysis.credit.peakInvoice)}`,
      `Conferiu ${analysis.credit.series.length} próximas faturas`,
      `Atualizou uso do limite para ${analysis.credit.utilizationPercent}%`,
    ];
  }
  if (agentId === "wallet-sol") {
    return [
      `Comparou ${analysis.patterns.categories.length} categorias`,
      `Detectou ${analysis.patterns.risingCount} categoria(s) em alta`,
      `Conferiu fixos de ${formatCurrency(analysis.patterns.recurringExpense)}`,
    ];
  }
  return [
    `Calculou aporte de ${formatCurrency(analysis.investments.suggestedMonthlyContribution)}`,
    `Atualizou progresso das metas para ${analysis.investments.goalsProgress}%`,
    "Simulou horizontes de 12, 24 e 36 meses",
  ];
}

function OfficeInspector({
  target,
  analysis,
  onClose,
  onDiscussWithAI,
  onSelectAgent,
}: {
  target: Exclude<InspectionTarget, null>;
  analysis: OfficeAnalysis;
  onClose: () => void;
  onDiscussWithAI: (prompt: string, agentId?: string) => void;
  onSelectAgent: (agentId: OfficeAgentId) => void;
}) {
  const agent =
    target.kind === "agent"
      ? AGENTS.find((item) => item.id === target.agentId) || AGENTS[0]
      : null;
  const finding = agent
    ? analysis.findings.find((item) => item.agentId === agent.id)
    : null;
  const series = agent ? getInspectorSeries(agent.id, analysis) : [];
  const maxSeriesValue = Math.max(...series.map((item) => item.value), 1);
  const workbench = agent ? getWorkbench(agent.id, analysis) : null;

  return (
    <aside className="absolute inset-y-3 right-3 z-[70] flex w-[min(390px,calc(100%-24px))] flex-col overflow-hidden rounded-[26px] border border-white/15 bg-[#111917]/94 text-white shadow-[0_28px_70px_rgba(7,14,11,.48)] backdrop-blur-2xl animate-in slide-in-from-right-8 duration-300 sm:inset-y-5 sm:right-5">
      <div className="flex items-start justify-between border-b border-white/10 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8">
            {agent ? <AgentPortrait agent={agent} compact /> : target.kind === "meeting" ? <Users size={17} /> : <MonitorUp size={17} />}
          </span>
          <div className="min-w-0">
            <span className="text-[8px] font-bold uppercase tracking-[.14em] text-emerald-300/70">
              {target.kind === "agent" ? "Inspeção ao vivo" : target.kind === "meeting" ? "Modo reunião" : "Painel da parede"}
            </span>
            <h3 className="mt-1 truncate text-sm font-bold">
              {agent ? `Tela de ${agent.name}` : target.kind === "meeting" ? "Resumo executivo geral" : "Central de indicadores"}
            </h3>
          </div>
        </div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/55 transition-colors hover:bg-white/10 hover:text-white" aria-label="Fechar inspeção">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {agent && workbench ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[8px] uppercase tracking-[.12em] text-white/35">Descoberta principal</span>
                  <p className="mt-1 text-[10px] font-semibold leading-relaxed text-white/90">{finding?.title || agent.task}</p>
                </div>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${agent.color}24`, color: agent.color }}>
                  <Sparkles size={12} />
                </span>
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-white/48">{finding?.description || workbench.description}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1110] p-3.5 shadow-inner">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[9px] font-bold"><BarChart3 size={11} /> Monitor da mesa</span>
                <span className="flex items-center gap-1 text-[7.5px] text-emerald-300/70"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> ao vivo</span>
              </div>
              <div className="flex h-24 items-end gap-1.5">
                {series.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <div className="relative flex h-[72px] w-full items-end overflow-hidden rounded-md bg-white/[0.035]">
                      <span
                        className="w-full rounded-t-md transition-all duration-700"
                        style={{
                          height: `${Math.max(8, (item.value / maxSeriesValue) * 100)}%`,
                          background: `linear-gradient(180deg, ${agent.color}, ${agent.color}55)`,
                          boxShadow: `0 0 16px ${agent.color}45`,
                        }}
                      />
                    </div>
                    <span className="max-w-full truncate text-[6.5px] text-white/35">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {workbench.metrics.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/8 bg-white/[0.045] p-2.5">
                  <span className="block truncate text-[6.5px] uppercase tracking-[.08em] text-white/30">{label}</span>
                  <strong className="mt-1 block truncate font-mono text-[9px] text-white/85">{value}</strong>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-[.12em] text-white/35">Log de atividade</span>
                <Activity size={11} className="text-emerald-300/70" />
              </div>
              <div className="space-y-1.5">
                {getActivityLog(agent.id, analysis).map((item, index) => (
                  <div key={item} className="flex items-start gap-2 rounded-xl bg-white/[0.035] px-2.5 py-2 text-[8.5px] text-white/60">
                    <span className="shrink-0 font-mono text-emerald-300/60">{index === 0 ? "agora" : `-${index}m`}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <InspectorMetric label="Meses em atenção" value={String(analysis.liquidity.riskMonths)} tone="warning" />
              <InspectorMetric label="Pico de fatura" value={formatCurrency(analysis.credit.peakInvoice, true)} />
              <InspectorMetric label="Categorias em alta" value={String(analysis.patterns.risingCount)} tone="warning" />
              <InspectorMetric label="Aporte possível" value={formatCurrency(analysis.investments.suggestedMonthlyContribution, true)} tone="positive" />
            </div>

            <div className="space-y-2">
              {analysis.findings.slice(0, 4).map((item) => {
                const itemAgent = AGENTS.find((candidate) => candidate.id === item.agentId) || AGENTS[0];
                return (
                  <button key={item.agentId} type="button" onClick={() => onSelectAgent(itemAgent.id)} className="flex w-full items-start gap-2.5 rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-left transition-colors hover:bg-white/[0.08]">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: itemAgent.color }} />
                    <span className="min-w-0 flex-1">
                      <strong className="block text-[9px] text-white/90">{itemAgent.name} · {item.title}</strong>
                      <span className="mt-1 line-clamp-2 block text-[8px] leading-relaxed text-white/42">{item.description}</span>
                    </span>
                    <ChevronRight size={11} className="mt-1 text-white/25" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-white/10 bg-black/10 p-3">
        {agent ? (
          <button
            type="button"
            onClick={() => onDiscussWithAI(agent.prompt, agent.id)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-[9px] font-bold text-[#151817] transition-transform active:scale-[.98]"
          >
            <MessageCircle size={12} /> Perguntar a {agent.name}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDiscussWithAI("Niko, reúna os quatro pareceres e me dê um resumo executivo da minha conta.")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-[9px] font-bold text-emerald-950 transition-transform active:scale-[.98]"
          >
            <Presentation size={12} /> Pedir veredito conjunto
          </button>
        )}
      </div>
    </aside>
  );
}

function InspectorMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "positive";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <span className="text-[7px] uppercase tracking-[.1em] text-white/35">{label}</span>
      <strong className={`mt-1.5 block font-mono text-[11px] ${tone === "warning" ? "text-amber-300" : tone === "positive" ? "text-emerald-300" : "text-white"}`}>{value}</strong>
    </div>
  );
}

function TeamAgenda({
  analysis,
  selectedAgentId,
  hoveredAgentId,
  meetingMode,
  onSelectAgent,
  onHoverAgent,
  onCallMeeting,
}: {
  analysis: OfficeAnalysis;
  selectedAgentId: OfficeAgentId;
  hoveredAgentId: OfficeAgentId | null;
  meetingMode: boolean;
  onSelectAgent: (agentId: OfficeAgentId) => void;
  onHoverAgent: (agentId: OfficeAgentId | null) => void;
  onCallMeeting: () => void;
}) {
  return (
    <aside className="border-t border-black/[0.06] bg-white p-4 xl:border-l xl:border-t-0">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="text-[8px] font-bold uppercase tracking-[.13em] text-emerald-700">Mesas em atividade</span>
          <h3 className="mt-1 text-xs font-bold text-[#1D1D1F]">Fila de análises</h3>
          <p className="mt-0.5 text-[9px] text-[#86868B]">Abra uma mesa para ver os dados</p>
        </div>
        <Clock3 size={14} className="text-[#AEAEB2]" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {AGENTS.map((agent) => {
          const finding = analysis.findings.find(
            (item) => item.agentId === agent.id
          );
          const active = selectedAgentId === agent.id;
          const highlighted = active || hoveredAgentId === agent.id;

          return (
            <button
              type="button"
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              onMouseEnter={() => onHoverAgent(agent.id)}
              onMouseLeave={() => onHoverAgent(null)}
              onFocus={() => onHoverAgent(agent.id)}
              onBlur={() => onHoverAgent(null)}
              className={`group rounded-[20px] border p-3 text-left transition-all ${
                highlighted
                  ? "border-[#1D1D1F] bg-[#1D1D1F] text-white shadow-[0_10px_22px_rgba(0,0,0,.12)]"
                  : "border-black/[0.05] bg-white hover:-translate-y-0.5 hover:border-black/10 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.04]"
                  style={{ backgroundColor: active ? `${agent.color}24` : agent.softColor }}
                >
                  <AgentPortrait agent={agent} compact />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <strong className={`text-[10px] ${highlighted ? "text-white" : "text-[#1D1D1F]"}`}>{agent.name}</strong>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <p className={`truncate text-[9px] ${highlighted ? "text-white/55" : "text-[#86868B]"}`}>{agent.area}</p>
                </div>
              </div>
              <p className={`mt-2 line-clamp-2 text-[9.5px] font-medium leading-relaxed ${highlighted ? "text-white/75" : "text-[#555]"}`}>
                {finding?.title || agent.task}
              </p>
              <div className={`mt-2 flex items-center justify-between border-t pt-2 ${highlighted ? "border-white/10" : "border-black/[0.04]"}`}>
                <span className={`text-[8px] ${highlighted ? "text-white/45" : "text-[#86868B]"}`}>{agent.liveStatus}</span>
                <ChevronRight
                  size={11}
                  className={`transition-transform group-hover:translate-x-0.5 ${highlighted ? "text-white/60" : "text-[#AEAEB2]"}`}
                />
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCallMeeting}
        className={`mt-3 flex w-full items-center gap-2 rounded-2xl border px-3 py-3 text-left transition-all ${
          meetingMode
            ? "border-emerald-400/40 bg-emerald-950 text-white shadow-lg"
            : "border-black/[0.06] bg-[#F5F7F5] text-[#1D1D1F] hover:bg-[#ECEFEC]"
        }`}
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${meetingMode ? "bg-white/10 text-emerald-300" : "bg-white text-emerald-700 shadow-sm"}`}>
          <Users size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-[9.5px]">Chamar reunião executiva</strong>
          <span className={`mt-0.5 block text-[8px] ${meetingMode ? "text-white/50" : "text-[#86868B]"}`}>Cruzar os quatro pareceres</span>
        </span>
        <ChevronRight size={12} className={meetingMode ? "text-white/55" : "text-[#AEAEB2]"} />
      </button>
    </aside>
  );
}

interface WorkbenchRow {
  label: string;
  primary: string;
  secondary: string;
  change: string;
  status: string;
  tone: "positive" | "warning" | "neutral";
}

function getWorkbench(agentId: OfficeAgentId, analysis: OfficeAnalysis) {
  if (agentId === "wallet-rubi") {
    return {
      title: "Projeção de caixa",
      description: "Entradas, compromissos e saldo livre por mês.",
      columns: ["Mês", "Entradas", "Compromissos", "Saldo livre", "Situação"],
      rows: analysis.liquidity.series.map<WorkbenchRow>((item) => ({
        label: item.label,
        primary: formatCurrency(item.income),
        secondary: formatCurrency(item.committed),
        change: formatCurrency(item.balance),
        status:
          item.balance >= analysis.liquidity.target ? "Acima da meta" : "Abaixo da meta",
        tone: item.balance >= analysis.liquidity.target ? "positive" : "warning",
      })),
      metrics: [
        ["Menor saldo", formatCurrency(analysis.liquidity.minimumBalance)],
        ["Meta mensal", formatCurrency(analysis.liquidity.target)],
        ["Meses em atenção", String(analysis.liquidity.riskMonths)],
      ],
    };
  }

  if (agentId === "wallet-nanquim") {
    return {
      title: "Agenda de faturas",
      description: "Valores já conhecidos para os próximos ciclos.",
      columns: ["Mês", "Fatura prevista", "Média do período", "Diferença", "Situação"],
      rows: analysis.credit.series.map<WorkbenchRow>((item) => {
        const delta = item.amount - analysis.credit.averageInvoice;
        return {
          label: item.label,
          primary: formatCurrency(item.amount),
          secondary: formatCurrency(analysis.credit.averageInvoice),
          change: `${delta >= 0 ? "+" : ""}${formatCurrency(delta)}`,
          status: item.amount === analysis.credit.peakInvoice ? "Maior fatura" : "Programada",
          tone: item.amount === analysis.credit.peakInvoice ? "warning" : "neutral",
        };
      }),
      metrics: [
        ["Total em 6 meses", formatCurrency(analysis.credit.totalSixMonths)],
        ["Média mensal", formatCurrency(analysis.credit.averageInvoice)],
        ["Uso do limite", `${analysis.credit.utilizationPercent}%`],
      ],
    };
  }

  if (agentId === "wallet-sol") {
    return {
      title: "Gastos por categoria",
      description: "Comparação direta com os 30 dias anteriores.",
      columns: ["Categoria", "Últimos 30 dias", "Período anterior", "Variação", "Lançamentos"],
      rows: analysis.patterns.categories.map<WorkbenchRow>((item) => ({
        label: item.category,
        primary: formatCurrency(item.total),
        secondary: formatCurrency(item.previousTotal),
        change: `${item.changePercent > 0 ? "+" : ""}${item.changePercent}%`,
        status: `${item.count} ${item.count === 1 ? "registro" : "registros"}`,
        tone:
          item.changePercent >= 15
            ? "warning"
            : item.changePercent < 0
              ? "positive"
              : "neutral",
      })),
      metrics: [
        ["Maior categoria", analysis.patterns.topCategory],
        ["Fixos mensais", formatCurrency(analysis.patterns.recurringExpense)],
        ["Categorias em alta", String(analysis.patterns.risingCount)],
      ],
    };
  }

  const contribution = analysis.investments.suggestedMonthlyContribution;
  return {
    title: "Cenários de patrimônio",
    description: "Simulação usando apenas a margem disponível após a meta de caixa.",
    columns: ["Horizonte", "Aporte mensal", "Total aportado", "Valor projetado", "Cenário"],
    rows: [
      [12, analysis.investments.projection12Months],
      [24, analysis.investments.projection24Months],
      [36, analysis.investments.projection36Months],
    ].map<WorkbenchRow>(([months, projection]) => ({
      label: `${months} meses`,
      primary: formatCurrency(contribution),
      secondary: formatCurrency(contribution * months),
      change: formatCurrency(projection),
      status: `${analysis.investments.annualScenarioRate}% a.a.`,
      tone: contribution > 0 ? "positive" : "warning",
    })),
    metrics: [
      ["Aporte possível", formatCurrency(contribution)],
      ["Progresso das metas", `${analysis.investments.goalsProgress}%`],
      ["Guardado", formatCurrency(analysis.investments.totalGoalSaved)],
    ],
  };
}

function AgentWorkbench({
  agent,
  analysis,
  onSelectAgent,
  onDiscuss,
}: {
  agent: AgentDefinition;
  analysis: OfficeAnalysis;
  onSelectAgent: (agentId: OfficeAgentId) => void;
  onDiscuss: () => void;
}) {
  const workbench = getWorkbench(agent.id, analysis);
  const finding = analysis.findings.find((item) => item.agentId === agent.id);

  return (
    <div className="bg-white p-4 sm:p-6">
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {AGENTS.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelectAgent(item.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold transition-all ${
              agent.id === item.id
                ? "border-[#1D1D1F] bg-[#1D1D1F] text-white"
                : "border-black/[0.07] bg-white text-[#6E6E73] hover:bg-[#F5F5F7]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/[0.05]"
            style={{ backgroundColor: agent.softColor }}
          >
            <AgentPortrait agent={agent} compact />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
              {agent.desk} · {agent.name}
            </span>
            <h3 className="mt-0.5 text-base font-bold text-[#1D1D1F]">{workbench.title}</h3>
            <p className="mt-0.5 text-[10px] text-[#6E6E73]">{workbench.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDiscuss}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1D1D1F] px-3 text-[10px] font-bold text-white transition-transform active:scale-95"
        >
          <MessageCircle size={13} />
          Perguntar a {agent.name}
        </button>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {workbench.metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-black/[0.05] bg-[#F8F8F8] px-3 py-3">
            <span className="block text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
              {label}
            </span>
            <strong className="mt-1 block truncate font-mono text-xs text-[#1D1D1F]">{value}</strong>
          </div>
        ))}
      </div>

      {finding && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-black/[0.05] bg-white px-3.5 py-3 shadow-sm">
          <div
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: agent.softColor, color: agent.color }}
          >
            {finding.severity === "warning" ? <TrendingUp size={12} /> : <CheckCircle2 size={12} />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[#1D1D1F]">{finding.title}</p>
            <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#6E6E73]">{finding.description}</p>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-black/[0.07]">
        <div className="flex items-center justify-between border-b border-black/[0.06] bg-[#F5F5F7] px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Rows3 size={13} className="text-[#6E6E73]" />
            <span className="text-[10px] font-bold text-[#1D1D1F]">Dados da mesa</span>
          </div>
          <span className="text-[8px] font-mono text-[#86868B]">valores da conta</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-b border-black/[0.05] bg-white">
                {workbench.columns.map((column) => (
                  <th
                    key={column}
                    className="px-3.5 py-2.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#86868B]"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbench.rows.length > 0 ? (
                workbench.rows.map((row, index) => (
                  <tr
                    key={`${row.label}-${index}`}
                    className="border-b border-black/[0.045] last:border-b-0 hover:bg-[#FAFAFA]"
                  >
                    <td className="whitespace-nowrap px-3.5 py-3 text-[10px] font-bold text-[#1D1D1F]">
                      {row.label}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 font-mono text-[10px] text-[#3A3A3C]">
                      {row.primary}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 font-mono text-[10px] text-[#6E6E73]">
                      {row.secondary}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3.5 py-3 font-mono text-[10px] font-bold ${
                        row.tone === "positive"
                          ? "text-emerald-700"
                          : row.tone === "warning"
                            ? "text-amber-700"
                            : "text-[#3A3A3C]"
                      }`}
                    >
                      {row.change}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[8px] font-bold ${
                          row.tone === "positive"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.tone === "warning"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-[#F2F2F7] text-[#6E6E73]"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[10px] text-[#86868B]">
                    Ainda não há dados suficientes para preencher esta mesa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-[8.5px] text-[#86868B] sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={10} />
          As projeções usam somente lançamentos, cartões, recorrências e metas cadastradas.
        </span>
        {agent.id === "wallet-atlos" && (
          <span>Cenário ilustrativo; não constitui recomendação de investimento.</span>
        )}
      </div>
    </div>
  );
}
