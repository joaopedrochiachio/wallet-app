"use client";

import React, { useMemo } from "react";
import { useWallet } from "@/context/WalletContext";
import { AgentAvatar } from "./AgentAvatar";
import {
  Shield,
  Flame,
  Compass,
  Zap,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Target,
  Clock,
} from "lucide-react";

interface AgentTeamHubProps {
  onSelectAgentForChat: (agentId: string, initialPrompt?: string) => void;
}

export function AgentTeamHub({ onSelectAgentForChat }: AgentTeamHubProps) {
  const {
    userProfile,
    cards,
    goals,
    recurringItems,
    monthIncome,
    monthExpense,
    mainBalance,
    getMonthlyProjection,
  } = useWallet();

  const currentMonthProj = getMonthlyProjection(0);
  const effectiveProjectedFree =
    currentMonthProj?.projectedFreeBalance ?? (mainBalance - monthExpense);
  const targetEndMonthBalance = userProfile?.targetMonthEndBalance || 700;

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Agentes do Time Wallet+
  const agents = useMemo(() => {
    return [
      {
        id: "guardian",
        name: "Sol",
        role: "Analista de Liquidez & Cartões",
        personaKey: "guardian",
        description: "Supervisiona seu fluxo de caixa diário, teto de gastos e faturas de cartão de crédito.",
        statsBadge: `${cards.length} cartões • Saldo R$ ${formatCurrency(mainBalance)}`,
        thought:
          effectiveProjectedFree >= targetEndMonthBalance
            ? `Fluxo sob controle contábil. Temos R$ ${formatCurrency(
                effectiveProjectedFree - targetEndMonthBalance
              )} de folga além da meta do mês.`
            : `Atenção à liquidez: estamos a R$ ${formatCurrency(
                targetEndMonthBalance - effectiveProjectedFree
              )} da meta estipulada de R$ ${formatCurrency(targetEndMonthBalance)}.`,
        promptSuggestion: "Como otimizar o pagamento das minhas faturas e proteger minha liquidez?",
        avatarState: effectiveProjectedFree >= targetEndMonthBalance ? ("idle" as const) : ("alert" as const),
      },
      {
        id: "optimizer",
        name: "Rubi",
        role: "Estrategista de Metas & Rotina",
        personaKey: "optimizer",
        description: "Acelera o cumprimento das suas metas, monitora hábitos e evita gastos supérfluos.",
        statsBadge: `${goals.length} metas ativas`,
        thought:
          goals.length > 0
            ? `Acompanhando ${goals.length} meta(s). Priorize aportes semanais consistentes para antecipar prazos.`
            : "Você ainda não definiu metas no app. Crie uma meta de Reserva de Emergência para blindar sua rotina.",
        promptSuggestion: "Onde posso cortar pequenos gastos nesta semana para bater minhas metas?",
        avatarState: goals.length > 0 ? ("celebrating" as const) : ("thinking" as const),
      },
      {
        id: "builder",
        name: "Nanquim",
        role: "Mentor & Estrategista Patrimonial",
        personaKey: "builder",
        description: "Avalia a saúde estrutural das suas finanças, taxa de poupança e projeções a longo prazo.",
        statsBadge: `Receita base R$ ${formatCurrency(userProfile?.monthlyIncomeBase || 5000)}`,
        thought:
          monthIncome > 0
            ? `Sua taxa de poupança projetada para este ciclo está em ${Math.max(
                0,
                Math.round(((monthIncome - monthExpense) / monthIncome) * 100)
              )}%. O ideal recomendado é 20%.`
            : "Avaliando indicadores de patrimônio líquido e consistência financeira.",
        promptSuggestion: "Faça um diagnóstico executivo da minha saúde financeira e taxa de poupança.",
        avatarState: "thinking" as const,
      },
      {
        id: "scaler",
        name: "Atlas",
        role: "Engenheiro de Eficiência & Recorrências",
        personaKey: "scaler",
        description: "Audita contas fixas, assinaturas de streaming e identifica oportunidades de economia contínua.",
        statsBadge: `${recurringItems.length} despesas fixas cadastradas`,
        thought:
          recurringItems.length > 0
            ? `Você possui ${recurringItems.length} despesas fixas somando R$ ${formatCurrency(
                recurringItems.reduce((acc, r) => acc + (r.amount || 0), 0)
              )}/mês. Revise assinaturas em desuso.`
            : "Sem despesas fixas cadastradas no momento.",
        promptSuggestion: "Quais são minhas maiores contas fixas e como posso reduzir despesas recorrentes?",
        avatarState: "idle" as const,
      },
    ];
  }, [
    cards.length,
    goals.length,
    recurringItems,
    monthIncome,
    monthExpense,
    mainBalance,
    effectiveProjectedFree,
    targetEndMonthBalance,
    userProfile?.monthlyIncomeBase,
  ]);

  return (
    <div className="w-full space-y-6">
      {/* Apresentação do Time */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
              Ecossistema Wallet+
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight mt-0.5">
            Seu Time de Especialistas Financeiros
          </h2>
          <p className="text-xs text-[#86868B] mt-0.5">
            Quatro agentes com papéis dedicados cuidando da sua rotina, liquidez e patrimônio.
          </p>
        </div>
      </div>

      {/* Grade de Agentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const isCurrentUserPersona =
            (userProfile.persona || "guardian") === agent.personaKey;

          return (
            <div
              key={agent.id}
              className={`p-5 rounded-3xl bg-white/95 backdrop-blur-2xl border transition-all space-y-4 shadow-sm hover:shadow-md flex flex-col justify-between ${
                isCurrentUserPersona
                  ? "border-amber-400/50 ring-2 ring-amber-400/20"
                  : "border-black/[0.06] hover:border-black/15"
              }`}
            >
              <div className="space-y-3.5">
                {/* Header do Agente */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AgentAvatar
                      persona={agent.personaKey}
                      state={agent.avatarState}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#1D1D1F] truncate">
                          {agent.name}
                        </h3>
                        {isCurrentUserPersona && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                            Principal
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-[#86868B] block truncate">
                        {agent.role}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F2F2F7] text-[#1D1D1F] shrink-0">
                    {agent.statsBadge}
                  </span>
                </div>

                <p className="text-xs text-[#636366] leading-relaxed">
                  {agent.description}
                </p>

                {/* Balão de Pensamento Vivo do Agente */}
                <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                    💬 Pensamento de {agent.name}:
                  </span>
                  <p className="text-[#1D1D1F] italic leading-relaxed">
                    "{agent.thought}"
                  </p>
                </div>
              </div>

              {/* Ação de Conversa com o Agente */}
              <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#86868B] truncate">
                  Foco: {agent.role.split("&")[0]}
                </span>

                <button
                  type="button"
                  onClick={() => onSelectAgentForChat(agent.personaKey, agent.promptSuggestion)}
                  className="px-3.5 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                >
                  <span>Consultar {agent.name}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
