"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MessageCircle,
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
  liveStatus: string;
  roleMark: string;
  skin: string;
  hair: string;
}

const AGENTS: AgentDefinition[] = [
  {
    id: "wallet-rubi",
    name: "Rubi",
    area: "Caixa e renda",
    desk: "Mesa 01",
    task: "Fechamento dos próximos 6 meses",
    color: "#EF4444",
    softColor: "#FFF1F2",
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
    task: "Conferência das faturas em aberto",
    color: "#3B82F6",
    softColor: "#EFF6FF",
    liveStatus: "Monitorando faturas abertas",
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
    liveStatus: "Calculando margem de aporte",
    roleMark: "↗",
    skin: "#D89A72",
    hair: "#513126",
  },
];

function formatCurrency(value: number) {
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
  onDiscussWithAI,
}: FinancialOfficeProps) {
  const [selectedAgentId, setSelectedAgentId] =
    useState<OfficeAgentId>("wallet-rubi");
  const [hoveredAgentId, setHoveredAgentId] =
    useState<OfficeAgentId | null>(null);
  const [meetingMode, setMeetingMode] = useState(false);

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

  const selectAgent = (agentId: OfficeAgentId) => {
    setSelectedAgentId(agentId);
    setMeetingMode(false);
  };

  const toggleMeeting = () => {
    setMeetingMode((prev) => !prev);
  };

  return (
    <section className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:rounded-[34px]">
      <OfficeHeader analysis={analysis} />

      <div className="grid border-b border-black/[0.06] bg-[#F4F4F1] xl:grid-cols-[minmax(0,1fr)_300px]">
        <OfficeScene
          selectedAgentId={selectedAgentId}
          hoveredAgentId={hoveredAgentId}
          meetingMode={meetingMode}
          onSelectAgent={selectAgent}
          onHoverAgent={setHoveredAgentId}
          onCallMeeting={toggleMeeting}
        />
        <TeamAgenda
          analysis={analysis}
          selectedAgentId={selectedAgentId}
          hoveredAgentId={hoveredAgentId}
          meetingMode={meetingMode}
          onSelectAgent={selectAgent}
          onHoverAgent={setHoveredAgentId}
          onCallMeeting={toggleMeeting}
        />
      </div>

      {meetingMode && (
        <ExecutiveMeetingBanner
          analysis={analysis}
          onSelectAgent={selectAgent}
          onClose={() => setMeetingMode(false)}
        />
      )}

      <AgentWorkbench
        agent={selectedAgent}
        analysis={analysis}
        onSelectAgent={selectAgent}
        onDiscuss={() => onDiscussWithAI("")}
      />
    </section>
  );
}

function OfficeHeader({ analysis }: { analysis: OfficeAnalysis }) {
  const attentionCount = analysis.findings.filter(
    (finding) => finding.severity === "warning"
  ).length;

  return (
    <>
      <header className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1D1D1F] text-white sm:h-11 sm:w-11">
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-[#1D1D1F] sm:text-lg">
                Escritório vivo Wallet+
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                4 especialistas ativos
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#6E6E73]">
              Toque em qualquer especialista ou mesa para inspecionar os cálculos reais da sua conta.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 border-t border-black/[0.05] sm:grid-cols-4">
        <HeaderMetric
          label="Meses abaixo da meta"
          value={String(analysis.liquidity.riskMonths)}
          tone={analysis.liquidity.riskMonths > 0 ? "warning" : "positive"}
        />
        <HeaderMetric
          label={
            analysis.credit.peakInvoice > 0
              ? `Maior fatura aberta (${analysis.credit.peakMonth})`
              : "Faturas em aberto"
          }
          value={
            analysis.credit.peakInvoice > 0
              ? formatCurrency(analysis.credit.peakInvoice)
              : "Quitadas"
          }
          tone={analysis.credit.peakInvoice > 0 ? "neutral" : "positive"}
        />
        <HeaderMetric
          label="Categorias em alta"
          value={String(analysis.patterns.risingCount)}
          tone={analysis.patterns.risingCount > 0 ? "warning" : "neutral"}
        />
        <HeaderMetric
          label="Margem para metas"
          value={formatCurrency(analysis.investments.suggestedMonthlyContribution)}
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
        last ? "" : "border-r border-black/[0.05]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-[#86868B]">
          {label}
        </span>
        {badge && (
          <span className="hidden rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium text-[#6E6E73] lg:block">
            {badge}
          </span>
        )}
      </div>
      <strong className={`mt-1 block truncate font-mono text-sm sm:text-base ${color}`}>
        {value}
      </strong>
    </div>
  );
}

function OfficeScene({
  selectedAgentId,
  hoveredAgentId,
  meetingMode,
  onSelectAgent,
  onHoverAgent,
  onCallMeeting,
}: {
  selectedAgentId: OfficeAgentId;
  hoveredAgentId: OfficeAgentId | null;
  meetingMode: boolean;
  onSelectAgent: (agentId: OfficeAgentId) => void;
  onHoverAgent: (agentId: OfficeAgentId | null) => void;
  onCallMeeting: () => void;
}) {
  return (
    <div className="p-3 sm:p-5">
      <div className="relative aspect-[960/610] w-full overflow-hidden rounded-[20px] border border-black/[0.08] bg-[#D6DED9] shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_12px_32px_rgba(46,59,52,.10)] sm:rounded-[30px]">
        <svg
          viewBox="0 0 960 610"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
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
            <radialGradient id="office-vignette" cx="50%" cy="43%" r="70%">
              <stop offset="58%" stopColor="#0E181D" stopOpacity="0" />
              <stop offset="100%" stopColor="#0E181D" stopOpacity=".28" />
            </radialGradient>
            <pattern id="office-brick" width="42" height="22" patternUnits="userSpaceOnUse">
              <rect width="42" height="22" fill="#C8B79D" />
              <path d="M0 0H42M0 22H42M21 0V11M0 11H42M10.5 11V22M31.5 11V22" fill="none" stroke="#A69276" strokeWidth="1.2" opacity=".56" />
            </pattern>
            <clipPath id="office-floor-clip">
              <path d="M65 183H895L944 574H16Z" />
            </clipPath>
          </defs>

          {/* Sala: parede, janelas e piso */}
          <rect width="960" height="610" fill="#CCD7D1" />
          <rect x="64" y="24" width="832" height="174" rx="18" fill="url(#office-wall)" stroke="#B6C0B9" strokeWidth="3" />
          <rect x="82" y="42" width="142" height="138" rx="8" fill="url(#office-brick)" />
          <rect x="736" y="42" width="142" height="138" rx="8" fill="url(#office-brick)" />
          <rect x="244" y="42" width="472" height="126" rx="10" fill="url(#office-window)" stroke="#536F6A" strokeWidth="7" />
          <path d="M362 46V164M480 46V164M598 46V164" stroke="#D9E6E3" strokeWidth="4" opacity=".72" />
          <path d="M253 50L390 50L310 164L248 164Z" fill="#FFFFFF" opacity=".18" />
          <path d="M510 47L608 47L534 164L447 164Z" fill="#FFFFFF" opacity=".1" />

          <path d="M65 183H895L944 574H16Z" fill="url(#office-floor)" stroke="#E9ECE6" strokeWidth="8" />
          <g clipPath="url(#office-floor-clip)" opacity=".11">
            <path d="M480 184L355 574M480 184L230 574M480 184L105 574M480 184L605 574M480 184L730 574M480 184L855 574" stroke="#D9E4E7" strokeWidth="1.2" />
            <path d="M55 235H905M46 300H914M38 382H922M27 476H933" stroke="#D9E4E7" strokeWidth="1.2" />
          </g>
          <path d="M65 183H895" stroke="#F5F4ED" strokeWidth="14" />
          <path d="M65 183L16 574M895 183L944 574" stroke="#AFBBB5" strokeWidth="4" opacity=".5" />

          {/* Mobiliário de apoio */}
          <g>
            <rect x="91" y="72" width="102" height="108" rx="5" fill="#6D7880" />
            <path d="M142 72V180" stroke="#9EA8AE" strokeWidth="2" />
            <circle cx="132" cy="126" r="3" fill="#D5D9DC" />
            <circle cx="152" cy="126" r="3" fill="#D5D9DC" />
          </g>
          <g>
            <rect x="748" y="137" width="118" height="39" rx="6" fill="#8C684B" />
            <rect x="757" y="145" width="100" height="6" rx="2" fill="#D4B68D" />
            <rect x="757" y="160" width="100" height="6" rx="2" fill="#D4B68D" />
          </g>
          <g>
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

          {/* Mesa colaborativa central */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Alternar resumo executivo"
            onClick={onCallMeeting}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onCallMeeting();
            }}
            className="cursor-pointer outline-none"
          >
            <rect x="375" y="334" width="210" height="108" rx="48" fill="url(#office-rug)" opacity=".72" />
            <ellipse cx="480" cy="386" rx="83" ry="38" fill="#8A6848" />
            <ellipse cx="480" cy="378" rx="83" ry="38" fill="url(#office-wood)" stroke="#735438" strokeWidth="4" />
            <rect x="438" y="360" width="84" height="37" rx="7" fill="#22282D" />
            <rect x="445" y="366" width="70" height="25" rx="4" fill="#4FC0C0" />
            <rect x="473" y="415" width="14" height="28" fill="#63472F" />
            <ellipse cx="480" cy="446" rx="30" ry="8" fill="#19232A" opacity=".3" />
          </g>

          <path d="M480 210V315M480 451V540" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="7 11" opacity=".16" />
          <path d="M120 358H349M611 358H840" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="7 11" opacity=".12" />
          <rect width="960" height="610" fill="url(#office-vignette)" pointerEvents="none" />
        </svg>

        <OfficeWorker
          agent={AGENTS[0]}
          active={selectedAgentId === AGENTS[0].id}
          hovered={hoveredAgentId === AGENTS[0].id}
          meeting={meetingMode}
          className={meetingMode ? "left-[40%] top-[46%]" : "left-[23%] top-[34%]"}
          onSelect={() => onSelectAgent(AGENTS[0].id)}
          onHover={(hovered) => onHoverAgent(hovered ? AGENTS[0].id : null)}
        />
        <OfficeWorker
          agent={AGENTS[1]}
          active={selectedAgentId === AGENTS[1].id}
          hovered={hoveredAgentId === AGENTS[1].id}
          meeting={meetingMode}
          className={meetingMode ? "right-[40%] top-[46%]" : "right-[24%] top-[34%]"}
          onSelect={() => onSelectAgent(AGENTS[1].id)}
          onHover={(hovered) => onHoverAgent(hovered ? AGENTS[1].id : null)}
        />
        <OfficeWorker
          agent={AGENTS[2]}
          active={selectedAgentId === AGENTS[2].id}
          hovered={hoveredAgentId === AGENTS[2].id}
          meeting={meetingMode}
          className={meetingMode ? "bottom-[18%] left-[40%]" : "bottom-[12%] left-[23%]"}
          onSelect={() => onSelectAgent(AGENTS[2].id)}
          onHover={(hovered) => onHoverAgent(hovered ? AGENTS[2].id : null)}
        />
        <OfficeWorker
          agent={AGENTS[3]}
          active={selectedAgentId === AGENTS[3].id}
          hovered={hoveredAgentId === AGENTS[3].id}
          meeting={meetingMode}
          className={meetingMode ? "bottom-[18%] right-[40%]" : "bottom-[12%] right-[24%]"}
          onSelect={() => onSelectAgent(AGENTS[3].id)}
          onHover={(hovered) => onHoverAgent(hovered ? AGENTS[3].id : null)}
        />
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
      className="cursor-pointer outline-none"
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
        opacity={highlighted ? ".22" : ".05"}
        stroke={color}
        strokeWidth={highlighted ? "3" : "1"}
        strokeDasharray="8 7"
      />
      <g>
        <rect x="0" y="4" width="202" height="72" rx="11" fill="#7B5839" />
        <rect x="0" y="0" width="202" height="64" rx="11" fill="url(#office-wood)" stroke="#7F5C3D" strokeWidth="3" />
        <rect x="4" y="57" width="194" height="12" rx="4" fill="#6F4D32" opacity=".72" />
        <rect x="8" y="54" width="186" height="13" rx="4" fill="#8D6844" />
        <rect x="15" y="66" width="13" height="36" rx="4" fill="#6B4E35" />
        <rect x="174" y="66" width="13" height="36" rx="4" fill="#6B4E35" />
        <g transform={`translate(${monitorX} -29)`}>
          <rect width="66" height="44" rx="6" fill="#242A2F" />
          <rect x="6" y="6" width="54" height="31" rx="3" fill={color} opacity=".85" />
          <path d="M11 29L20 22L28 25L37 14L45 20L55 11" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
          <g opacity=".82">
            <rect x="12" y="18" width="4" height="10" rx="1" fill="#FFFFFF" />
            <rect x="19" y="14" width="4" height="14" rx="1" fill="#FFFFFF" />
            <rect x="26" y="10" width="4" height="18" rx="1" fill="#FFFFFF" />
          </g>
          <rect x="29" y="44" width="8" height="13" fill="#242A2F" />
          <rect x="20" y="55" width="26" height="5" rx="2" fill="#242A2F" />
        </g>
        <rect x={monitorX + 8} y="24" width="52" height="12" rx="4" fill="#E6D6BE" />
        <rect x={paperX} y="17" width="38" height="28" rx="3" fill="#F4F1E9" transform={`rotate(${flip ? 5 : -5} ${paperX + 19} 31)`} />
        <circle cx={flip ? 78 : 124} cy="31" r="11" fill={color} opacity=".88" />
        <text x="14" y="51" fontSize="9" fontWeight="700" letterSpacing="1.1" fill="#5C4028">{label}</text>

        <g transform={`translate(${flip ? 126 : 28} 79)`}>
          <ellipse cx="25" cy="30" rx="31" ry="12" fill="#15212A" opacity=".25" />
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
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="72" rx="27" ry="9" fill="#14221B" opacity=".22" />
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
        className={`absolute left-1/2 -translate-x-1/2 overflow-hidden border border-white/50 shadow-[inset_0_3px_6px_rgba(255,255,255,.22),0_4px_8px_rgba(0,0,0,.16)] ${
          compact ? "top-1 h-8 w-8 rounded-[12px]" : "top-0 h-10 w-9 rounded-[15px]"
        }`}
        style={{ backgroundColor: agent.skin }}
      >
        <span
          className="absolute -left-1 -right-1 -top-2 h-5 rounded-[50%]"
          style={{ backgroundColor: agent.hair }}
        />
        <span className="absolute left-[9px] top-[18px] h-1.5 w-1.5 rounded-full bg-[#2A2422]" />
        <span className="absolute right-[9px] top-[18px] h-1.5 w-1.5 rounded-full bg-[#2A2422]" />
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
      className={`absolute z-30 flex origin-center scale-[0.58] flex-col items-center rounded-2xl p-1 outline-none transition-all duration-300 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-white sm:scale-[0.82] lg:scale-100 ${className}`}
      aria-label={`Abrir a mesa de ${agent.name}`}
    >
      <span
        className={`absolute -inset-2.5 rounded-[22px] border transition-all ${
          active || hovered ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
        style={{
          backgroundColor: `${agent.color}20`,
          borderColor: `${agent.color}90`,
        }}
      />
      <div className="relative flex flex-col items-center">
        <AgentPortrait agent={agent} />
        <div
          className="relative -mt-1.5 h-9 w-9 rounded-t-[14px] rounded-b-lg border border-white/55 shadow-md"
          style={{ background: `linear-gradient(145deg, ${agent.color}, ${agent.color}b8 65%, #222A2F 145%)` }}
        >
          <span className="absolute left-1/2 top-2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-md bg-white/20 text-[8px] font-black text-white">
            {agent.roleMark}
          </span>
          <span className="absolute -left-2 top-3 h-5 w-2 rounded-full" style={{ backgroundColor: agent.skin }} />
          <span className="absolute -right-2 top-3 h-5 w-2 rounded-full" style={{ backgroundColor: agent.skin }} />
          <span className="absolute -bottom-3 left-1.5 h-4 w-2.5 rounded-b-full bg-[#20282E]" />
          <span className="absolute -bottom-3 right-1.5 h-4 w-2.5 rounded-b-full bg-[#20282E]" />
        </div>
      </div>
      <span
        className={`relative z-30 mt-3.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-bold shadow-sm transition-all ${
          active
            ? "border-[#1D1D1F] bg-[#1D1D1F] text-white"
            : "border-white/80 bg-white/95 text-[#1D1D1F]"
        }`}
      >
        {agent.name} {meeting ? "· reunião" : active ? "· ativa" : ""}
      </span>
    </button>
  );
}

function ExecutiveMeetingBanner({
  analysis,
  onSelectAgent,
  onClose,
}: {
  analysis: OfficeAnalysis;
  onSelectAgent: (agentId: OfficeAgentId) => void;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-black/[0.06] bg-[#141D1A] px-4 py-5 text-white sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
            <Users size={16} />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
              Reunião Executiva
            </span>
            <h3 className="text-sm font-bold text-white">
              Síntese integrada dos 4 especialistas
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Fechar resumo executivo"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {analysis.findings.map((item) => {
          const itemAgent =
            AGENTS.find((candidate) => candidate.id === item.agentId) || AGENTS[0];
          return (
            <button
              key={item.agentId}
              type="button"
              onClick={() => onSelectAgent(itemAgent.id)}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 text-left transition-colors hover:bg-white/[0.1]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: itemAgent.color }}
                  />
                  <strong className="text-xs text-white">{itemAgent.name}</strong>
                  <span className="text-[11px] text-white/50">· {itemAgent.area}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-white/95">
                  {item.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/65">
                  {item.description}
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                Ver dados da mesa <ChevronRight size={12} />
              </span>
            </button>
          );
        })}
      </div>
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
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[.12em] text-emerald-700">
            Especialistas
          </span>
          <h3 className="mt-0.5 text-sm font-bold text-[#1D1D1F]">
            Pareceres em tempo real
          </h3>
        </div>
        <Clock3 size={15} className="text-[#AEAEB2]" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
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
              className={`group rounded-2xl border p-3 text-left transition-all ${
                highlighted
                  ? "border-[#1D1D1F] bg-[#1D1D1F] text-white shadow-md"
                  : "border-black/[0.06] bg-white hover:border-black/15 hover:bg-[#FAFAFC]"
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
                    <strong className={`text-xs ${highlighted ? "text-white" : "text-[#1D1D1F]"}`}>
                      {agent.name}
                    </strong>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                  </div>
                  <p className={`truncate text-[11px] ${highlighted ? "text-white/65" : "text-[#6E6E73]"}`}>
                    {agent.area}
                  </p>
                </div>
              </div>
              <p className={`mt-2 line-clamp-2 text-xs font-semibold leading-snug ${highlighted ? "text-white/90" : "text-[#1D1D1F]"}`}>
                {finding?.title || agent.task}
              </p>
              <p className={`mt-1 line-clamp-2 text-[11px] leading-relaxed ${highlighted ? "text-white/65" : "text-[#6E6E73]"}`}>
                {finding?.description || agent.liveStatus}
              </p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCallMeeting}
        className={`mt-3 flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition-all ${
          meetingMode
            ? "border-emerald-500/40 bg-emerald-950 text-white shadow-md"
            : "border-black/[0.07] bg-[#F5F7F5] text-[#1D1D1F] hover:bg-[#ECEFEC]"
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            meetingMode ? "bg-white/10 text-emerald-300" : "bg-white text-emerald-700 shadow-sm"
          }`}
        >
          <Users size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-xs">
            {meetingMode ? "Ocultar reunião executiva" : "Chamar reunião executiva"}
          </strong>
          <span className={`mt-0.5 block text-[11px] ${meetingMode ? "text-white/65" : "text-[#6E6E73]"}`}>
            Cruzar os 4 pareceres lado a lado
          </span>
        </span>
        <ChevronRight size={14} className={meetingMode ? "text-white/65" : "text-[#86868B]"} />
      </button>
    </aside>
  );
}

function getInspectorSeries(agentId: OfficeAgentId, analysis: OfficeAnalysis) {
  if (agentId === "wallet-rubi") {
    return analysis.liquidity.series.slice(0, 6).map((item) => ({
      label: item.label,
      value: Math.max(0, item.balance),
      formatted: formatCurrency(item.balance),
    }));
  }

  if (agentId === "wallet-nanquim") {
    return analysis.credit.series.slice(0, 6).map((item) => ({
      label: item.label,
      value: item.amount,
      formatted: formatCurrency(item.amount),
    }));
  }

  if (agentId === "wallet-sol") {
    return analysis.patterns.categories.slice(0, 6).map((item) => ({
      label: item.category,
      value: item.total,
      formatted: formatCurrency(item.total),
    }));
  }

  return [
    {
      label: "12m",
      value: analysis.investments.projection12Months,
      formatted: formatCurrency(analysis.investments.projection12Months),
    },
    {
      label: "24m",
      value: analysis.investments.projection24Months,
      formatted: formatCurrency(analysis.investments.projection24Months),
    },
    {
      label: "36m",
      value: analysis.investments.projection36Months,
      formatted: formatCurrency(analysis.investments.projection36Months),
    },
  ];
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
      description: "Entradas, compromissos e saldo livre projetado por mês.",
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
      description: "Faturas pagas e compromissos abertos nos próximos ciclos.",
      columns: ["Mês", "Total da fatura", "Em aberto", "Diferença p/ média", "Situação"],
      rows: analysis.credit.series.map<WorkbenchRow>((item) => {
        const delta = item.amount - analysis.credit.averageInvoice;
        const isPeakOpen =
          !item.isPaid &&
          item.pendingAmount > 0 &&
          item.pendingAmount === analysis.credit.peakInvoice;
        return {
          label: item.label,
          primary: formatCurrency(item.amount),
          secondary: item.isPaid ? "R$ 0,00 (Quitada)" : formatCurrency(item.pendingAmount),
          change: `${delta >= 0 ? "+" : ""}${formatCurrency(delta)}`,
          status: item.isPaid
            ? "Fatura paga"
            : item.pendingAmount <= 0
              ? "Sem fatura"
              : isPeakOpen
                ? "Maior fatura aberta"
                : "Em aberto",
          tone: item.isPaid
            ? "positive"
            : isPeakOpen
              ? "warning"
              : "neutral",
        };
      }),
      metrics: [
        ["Total em 6 meses", formatCurrency(analysis.credit.totalSixMonths)],
        ["Média mensal", formatCurrency(analysis.credit.averageInvoice)],
        ["Uso atual do limite", `${analysis.credit.utilizationPercent}%`],
      ],
    };
  }

  if (agentId === "wallet-sol") {
    return {
      title: "Gastos por categoria",
      description: "Comparação direta dos últimos 30 dias com o período anterior.",
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
        ["Fixos ativos no mês", formatCurrency(analysis.patterns.recurringExpense)],
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
      ["Total guardado", formatCurrency(analysis.investments.totalGoalSaved)],
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
  const series = getInspectorSeries(agent.id, analysis);
  const maxSeriesValue = Math.max(...series.map((item) => item.value), 1);

  return (
    <div className="bg-white p-4 sm:p-6">
      {/* Seletor rápido de mesas */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {AGENTS.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelectAgent(item.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all ${
              agent.id === item.id
                ? "border-[#1D1D1F] bg-[#1D1D1F] text-white shadow-sm"
                : "border-black/[0.08] bg-white text-[#6E6E73] hover:bg-[#F5F5F7]"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
            <span className={`hidden text-[11px] sm:inline ${agent.id === item.id ? "text-white/70" : "text-[#86868B]"}`}>
              · {item.area}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/[0.05]"
            style={{ backgroundColor: agent.softColor }}
          >
            <AgentPortrait agent={agent} compact />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#86868B]">
              {agent.desk} · {agent.name}
            </span>
            <h3 className="mt-0.5 text-base font-bold text-[#1D1D1F] sm:text-lg">
              {workbench.title}
            </h3>
            <p className="mt-0.5 text-xs text-[#6E6E73]">{workbench.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDiscuss}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1D1D1F] px-4 text-xs font-bold text-white transition-transform active:scale-95"
        >
          <MessageCircle size={14} />
          Conversar com a IA
        </button>
      </div>

      {/* KPIs e Gráfico da Mesa */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col justify-between gap-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {workbench.metrics.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-black/[0.06] bg-[#F8F8FA] px-3.5 py-3"
              >
                <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-[#86868B]">
                  {label}
                </span>
                <strong className="mt-1 block truncate font-mono text-sm text-[#1D1D1F]">
                  {value}
                </strong>
              </div>
            ))}
          </div>

          {finding && (
            <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3.5 shadow-sm">
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: agent.softColor, color: agent.color }}
              >
                {finding.severity === "warning" ? (
                  <TrendingUp size={15} />
                ) : (
                  <CheckCircle2 size={15} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#1D1D1F]">{finding.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#6E6E73]">
                  {finding.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Monitor gráfico legível */}
        <div className="rounded-2xl border border-black/[0.06] bg-[#F8F8FA] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#1D1D1F]">
              <BarChart3 size={14} style={{ color: agent.color }} />
              Evolução visual · {agent.name}
            </span>
            <span className="text-[11px] font-medium text-[#6E6E73]">
              {agent.liveStatus}
            </span>
          </div>
          {series.length > 0 ? (
            <div className="flex h-28 items-end gap-2 sm:gap-3">
              {series.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                >
                  <span className="max-w-full truncate font-mono text-[10px] font-semibold text-[#6E6E73]">
                    {item.formatted}
                  </span>
                  <div className="relative flex h-16 w-full items-end overflow-hidden rounded-lg bg-black/[0.04]">
                    <span
                      className="w-full rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${Math.max(10, (item.value / maxSeriesValue) * 100)}%`,
                        backgroundColor: agent.color,
                      }}
                    />
                  </div>
                  <span className="max-w-full truncate text-[11px] font-semibold text-[#1D1D1F]">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center text-xs text-[#86868B]">
              Sem dados suficientes no período.
            </div>
          )}
        </div>
      </div>

      {/* Dados detalhados da mesa (Cards no mobile, Tabela no desktop) */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.07]">
        <div className="flex items-center justify-between border-b border-black/[0.06] bg-[#F5F5F7] px-4 py-3">
          <div className="flex items-center gap-2">
            <Rows3 size={14} className="text-[#6E6E73]" />
            <span className="text-xs font-bold text-[#1D1D1F]">Dados da mesa</span>
          </div>
          <span className="text-[11px] font-mono text-[#6E6E73]">
            valores sincronizados da conta
          </span>
        </div>

        {/* Mobile View: Cards empilhados sem corte horizontal */}
        <div className="divide-y divide-black/[0.05] sm:hidden">
          {workbench.rows.length > 0 ? (
            workbench.rows.map((row, index) => (
              <div key={`${row.label}-${index}`} className="p-3.5 space-y-2 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-xs font-bold text-[#1D1D1F]">
                    {row.label}
                  </strong>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      row.tone === "positive"
                        ? "bg-emerald-50 text-emerald-700"
                        : row.tone === "warning"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-[#F2F2F7] text-[#6E6E73]"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="block text-[10px] text-[#86868B]">
                      {workbench.columns[1]}
                    </span>
                    <strong className="font-mono text-xs text-[#1D1D1F]">
                      {row.primary}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#86868B]">
                      {workbench.columns[2]}
                    </span>
                    <span className="font-mono text-xs text-[#6E6E73]">
                      {row.secondary}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#86868B]">
                      {workbench.columns[3]}
                    </span>
                    <strong
                      className={`font-mono text-xs ${
                        row.tone === "positive"
                          ? "text-emerald-700"
                          : row.tone === "warning"
                            ? "text-amber-700"
                            : "text-[#1D1D1F]"
                      }`}
                    >
                      {row.change}
                    </strong>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-xs text-[#86868B]">
              Ainda não há dados suficientes para preencher esta mesa.
            </div>
          )}
        </div>

        {/* Desktop/Tablet View: Tabela completa legível */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[580px] border-collapse text-left">
            <thead>
              <tr className="border-b border-black/[0.05] bg-white">
                {workbench.columns.map((column) => (
                  <th
                    key={column}
                    className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#86868B]"
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
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-[#1D1D1F]">
                      {row.label}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#3A3A3C]">
                      {row.primary}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#6E6E73]">
                      {row.secondary}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 font-mono text-xs font-bold ${
                        row.tone === "positive"
                          ? "text-emerald-700"
                          : row.tone === "warning"
                            ? "text-amber-700"
                            : "text-[#3A3A3C]"
                      }`}
                    >
                      {row.change}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
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
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#86868B]">
                    Ainda não há dados suficientes para preencher esta mesa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-[11px] text-[#86868B] sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={12} />
          As projeções usam somente lançamentos, cartões, recorrências ativas e metas cadastradas.
        </span>
        {agent.id === "wallet-atlos" && (
          <span>Cenário ilustrativo; não constitui recomendação de investimento.</span>
        )}
      </div>
    </div>
  );
}
