"use client";

import React, { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Leaf,
  MessageCircle,
  RefreshCw,
  Rows3,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import type { CardItem, GoalItem, RecurringItem } from "@/types";
import type { MonthProjection, TransactionItem } from "@/context/WalletContext";
import type { FinancialDiagnosis } from "@/lib/services/financialDiagnosisService";
import {
  buildAgentOfficeAnalysis,
  type OfficeAnalysis,
} from "@/lib/services/agentOfficeService";
import {
  WalletCharacter,
  type WalletCharacterId,
} from "@/components/companion/WalletCharacters";

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
    prompt:
      "Rubi, abra minha projeção de caixa e explique os meses que exigem mais atenção.",
    animation: "office-walk-rubi",
    duration: 13,
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

  return (
    <section className="overflow-hidden rounded-[30px] border border-black/[0.06] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:rounded-[36px]">
      <OfficeHeader
        analysis={analysis}
        isAnalyzing={isAnalyzing}
        onRefresh={onRefresh}
      />

      <div className="grid border-b border-black/[0.06] bg-[#F4F4F1] xl:grid-cols-[minmax(0,1fr)_230px]">
        <OfficeScene
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
        />
        <TeamAgenda
          analysis={analysis}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
        />
      </div>

      <AgentWorkbench
        agent={selectedAgent}
        analysis={analysis}
        onSelectAgent={setSelectedAgentId}
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
                Escritório Wallet+
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Expediente aberto
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#6E6E73]">
              Entre em uma mesa para consultar números, comparativos e próximos passos.
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
  selectedAgentId,
  onSelectAgent,
}: {
  selectedAgentId: OfficeAgentId;
  onSelectAgent: (agentId: OfficeAgentId) => void;
}) {
  return (
    <div className="relative min-h-[500px] overflow-hidden p-3 sm:min-h-[560px] sm:p-5">
      <style>{`
        @keyframes office-walk-rubi {
          0%, 18%, 100% { transform: translate3d(0,0,0); }
          34% { transform: translate3d(74px,34px,0); }
          52% { transform: translate3d(112px,2px,0); }
          70% { transform: translate3d(48px,-24px,0); }
        }
        @keyframes office-walk-sol {
          0%, 16%, 100% { transform: translate3d(0,0,0); }
          31% { transform: translate3d(-62px,34px,0); }
          54% { transform: translate3d(-104px,-2px,0); }
          75% { transform: translate3d(-36px,-25px,0); }
        }
        @keyframes office-walk-nanquim {
          0%, 20%, 100% { transform: translate3d(0,0,0); }
          38% { transform: translate3d(68px,-34px,0); }
          58% { transform: translate3d(108px,0,0); }
          78% { transform: translate3d(44px,28px,0); }
        }
        @keyframes office-walk-atlos {
          0%, 15%, 100% { transform: translate3d(0,0,0); }
          32% { transform: translate3d(-70px,-34px,0); }
          56% { transform: translate3d(-112px,0,0); }
          76% { transform: translate3d(-42px,26px,0); }
        }
        @keyframes office-step {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .office-worker { will-change: transform; }
        .office-worker:hover, .office-worker:focus-visible { animation-play-state: paused !important; z-index: 50 !important; }
        .office-worker-body { animation: office-step .42s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .office-worker, .office-worker-body { animation: none !important; }
        }
      `}</style>

      <div className="absolute inset-3 overflow-hidden rounded-[28px] border border-black/[0.08] bg-[#DDE2DD] shadow-inner sm:inset-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,.95),transparent_42%)]" />

        <div
          className="absolute left-1/2 top-[46%] h-[520px] w-[650px] rounded-[44px] border-[10px] border-white/80 bg-[#E9E2D6] shadow-[0_45px_60px_rgba(42,50,44,.3)] sm:h-[570px] sm:w-[760px]"
          style={{
            transform:
              "translate(-50%, -50%) perspective(1100px) rotateX(52deg) rotateZ(-25deg) scale(.82)",
            transformStyle: "preserve-3d",
            backgroundImage:
              "linear-gradient(30deg, rgba(96,82,62,.07) 12%, transparent 12.5%, transparent 87%, rgba(96,82,62,.07) 87.5%), linear-gradient(150deg, rgba(96,82,62,.07) 12%, transparent 12.5%, transparent 87%, rgba(96,82,62,.07) 87.5%)",
            backgroundSize: "32px 56px",
          }}
        >
          <div className="absolute inset-x-[5%] top-[7%] h-5 rounded-full bg-white/70 shadow-[0_6px_0_rgba(123,107,84,.12)]" />
          <div className="absolute inset-x-[5%] bottom-[7%] h-5 rounded-full bg-white/70 shadow-[0_6px_0_rgba(123,107,84,.12)]" />
          <div className="absolute bottom-[10%] top-[10%] left-[5%] w-5 rounded-full bg-white/70 shadow-[6px_0_0_rgba(123,107,84,.12)]" />
          <div className="absolute bottom-[10%] top-[10%] right-[5%] w-5 rounded-full bg-white/70 shadow-[-6px_0_0_rgba(123,107,84,.12)]" />

          <OfficeDesk className="left-[13%] top-[18%]" color="#EF4444" />
          <OfficeDesk className="right-[13%] top-[18%]" color="#F59E0B" flip />
          <OfficeDesk className="bottom-[18%] left-[13%]" color="#3B82F6" />
          <OfficeDesk className="bottom-[18%] right-[13%]" color="#10B981" flip />

          <div className="absolute left-1/2 top-1/2 h-[72px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[5px] border-[#8D7353] bg-[#B99A70] shadow-[0_12px_0_#765F45,0_20px_22px_rgba(58,46,32,.25)]">
            <div className="absolute left-1/2 top-1/2 h-9 w-16 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-[#252527] p-1 shadow-md">
              <div className="h-full w-full rounded bg-gradient-to-br from-cyan-300/70 to-blue-900" />
            </div>
            <span className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-black/[0.06] bg-white/90 px-2 py-1 text-[8px] font-bold text-[#555] shadow-sm">
              Mesa de reunião
            </span>
          </div>

          <Leaf className="absolute left-[7%] top-[8%] text-emerald-600" size={30} />
          <Coffee className="absolute right-[7%] top-[9%] text-amber-800" size={23} />
          <WalletCards className="absolute bottom-[8%] left-[7%] text-blue-600" size={24} />
          <Target className="absolute bottom-[8%] right-[7%] text-emerald-700" size={25} />
        </div>

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/90 px-3 py-1.5 text-[9px] font-semibold text-[#555] shadow-sm backdrop-blur-md">
          <Users size={11} />
          4 pessoas em atividade
        </div>

        <OfficeWorker
          agent={AGENTS[0]}
          active={selectedAgentId === AGENTS[0].id}
          className="left-[12%] top-[22%]"
          onSelect={() => onSelectAgent(AGENTS[0].id)}
        />
        <OfficeWorker
          agent={AGENTS[1]}
          active={selectedAgentId === AGENTS[1].id}
          className="right-[13%] top-[22%]"
          onSelect={() => onSelectAgent(AGENTS[1].id)}
        />
        <OfficeWorker
          agent={AGENTS[2]}
          active={selectedAgentId === AGENTS[2].id}
          className="bottom-[20%] left-[12%]"
          onSelect={() => onSelectAgent(AGENTS[2].id)}
        />
        <OfficeWorker
          agent={AGENTS[3]}
          active={selectedAgentId === AGENTS[3].id}
          className="bottom-[20%] right-[13%]"
          onSelect={() => onSelectAgent(AGENTS[3].id)}
        />

        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-white/70 bg-white/85 px-3 py-2 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#1D1D1F] text-white">
              <BriefcaseBusiness size={13} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-[#1D1D1F]">Niko na recepção</p>
              <p className="text-[8px] text-[#86868B]">Direcionando cada assunto à mesa certa</p>
            </div>
          </div>
          <span className="hidden text-[8px] font-mono text-[#86868B] sm:block">
            base sincronizada
          </span>
        </div>
      </div>
    </div>
  );
}

function OfficeDesk({
  className,
  color,
  flip = false,
}: {
  className: string;
  color: string;
  flip?: boolean;
}) {
  return (
    <div className={`absolute h-[72px] w-[150px] ${className}`}>
      <div className="absolute inset-x-0 bottom-0 h-10 rounded-lg border border-[#9B805C] bg-[#C3A47A] shadow-[0_8px_0_#927653,0_14px_18px_rgba(70,53,32,.18)]" />
      <div
        className={`absolute top-0 h-10 w-[66px] rounded-md border-4 border-[#353537] bg-[#171719] p-1 shadow-md ${
          flip ? "right-5" : "left-5"
        }`}
      >
        <div
          className="h-full w-full rounded-sm"
          style={{
            background: `linear-gradient(145deg, ${color}aa, #151517 72%)`,
          }}
        />
      </div>
      <div
        className={`absolute top-4 h-3 w-8 rounded bg-white/90 shadow-sm ${
          flip ? "left-4" : "right-4"
        }`}
      />
    </div>
  );
}

function OfficeWorker({
  agent,
  active,
  className,
  onSelect,
}: {
  agent: AgentDefinition;
  active: boolean;
  className: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`office-worker absolute z-30 flex flex-col items-center rounded-2xl p-1 outline-none ${className}`}
      style={{
        animation: `${agent.animation} ${agent.duration}s ease-in-out infinite`,
      }}
      aria-label={`Abrir a mesa de ${agent.name}`}
    >
      <span
        className={`absolute -inset-2 rounded-full transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
        style={{ backgroundColor: `${agent.color}18` }}
      />
      <div className="office-worker-body relative flex flex-col items-center">
        <div className="relative z-20 rounded-full bg-white/90 p-0.5 shadow-[0_4px_12px_rgba(0,0,0,.18)]">
          <WalletCharacter
            id={agent.id}
            state={active ? "falando" : "ocioso"}
            size="md"
            showBadge={false}
            showGlow={false}
          />
        </div>
        <div
          className="relative -mt-1.5 h-6 w-7 rounded-t-xl rounded-b-md border-2 border-white/60 shadow-sm"
          style={{ backgroundColor: agent.color }}
        >
          <span className="absolute -bottom-2 left-1 h-3 w-1.5 rounded-full bg-[#343436]" />
          <span className="absolute -bottom-2 right-1 h-3 w-1.5 rounded-full bg-[#343436]" />
        </div>
      </div>
      <span
        className={`relative z-30 mt-2 whitespace-nowrap rounded-full border bg-white/95 px-2 py-1 text-[8px] font-bold shadow-sm transition-all ${
          active
            ? "border-black/15 text-[#1D1D1F]"
            : "border-black/[0.05] text-[#6E6E73]"
        }`}
      >
        {agent.name} · {active ? "mesa aberta" : "trabalhando"}
      </span>
    </button>
  );
}

function TeamAgenda({
  analysis,
  selectedAgentId,
  onSelectAgent,
}: {
  analysis: OfficeAnalysis;
  selectedAgentId: OfficeAgentId;
  onSelectAgent: (agentId: OfficeAgentId) => void;
}) {
  return (
    <aside className="border-t border-black/[0.06] bg-white p-4 xl:border-l xl:border-t-0">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-[#1D1D1F]">Agenda da equipe</h3>
          <p className="mt-0.5 text-[9px] text-[#86868B]">Clique para abrir uma mesa</p>
        </div>
        <Clock3 size={14} className="text-[#AEAEB2]" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {AGENTS.map((agent) => {
          const finding = analysis.findings.find(
            (item) => item.agentId === agent.id
          );
          const active = selectedAgentId === agent.id;

          return (
            <button
              type="button"
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={`group rounded-2xl border p-3 text-left transition-all ${
                active
                  ? "border-black/15 bg-[#F5F5F7] shadow-sm"
                  : "border-black/[0.05] bg-white hover:bg-[#FAFAFA]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.04]"
                  style={{ backgroundColor: agent.softColor }}
                >
                  <WalletCharacter
                    id={agent.id}
                    state={finding?.severity === "warning" ? "alerta" : "pensando"}
                    size="sm"
                    showBadge={false}
                    showGlow={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <strong className="text-[10px] text-[#1D1D1F]">{agent.name}</strong>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <p className="truncate text-[9px] text-[#86868B]">{agent.area}</p>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-[9.5px] font-medium leading-relaxed text-[#555]">
                {finding?.title || agent.task}
              </p>
              <div className="mt-2 flex items-center justify-between border-t border-black/[0.04] pt-2">
                <span className="text-[8px] text-[#86868B]">{agent.desk}</span>
                <ChevronRight
                  size={11}
                  className="text-[#AEAEB2] transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </button>
          );
        })}
      </div>
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
            <WalletCharacter
              id={agent.id}
              state="falando"
              size="md"
              showBadge={false}
              showGlow={false}
            />
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
