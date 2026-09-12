"use client";

import {
  Laptop,
  Sparkles,
  ShieldCheck,
  Plane,
  Plus,
  Target,
} from "lucide-react";

interface GoalItem {
  id: string;
  title: string;
  category: string;
  current: number;
  target: number;
  icon: React.ReactNode;
  deadline?: string;
}

export default function GoalsPage() {
  const goals: GoalItem[] = [
    {
      id: "1",
      title: "MacBook Pro M3",
      category: "Equipamento & Trabalho",
      current: 11200,
      target: 14000,
      icon: <Laptop strokeWidth={1.5} size={18} />,
      deadline: "Dezembro 2026",
    },
    {
      id: "2",
      title: "Tênis Nike SB",
      category: "Lifestyle & Vestuário",
      current: 400,
      target: 4500,
      icon: <Sparkles strokeWidth={1.5} size={18} />,
      deadline: "Outubro 2026",
    },
    {
      id: "3",
      title: "Reserva de Emergência",
      category: "Segurança Financeira",
      current: 18500,
      target: 25000,
      icon: <ShieldCheck strokeWidth={1.5} size={18} />,
      deadline: "Em andamento",
    },
    {
      id: "4",
      title: "Viagem Europa",
      category: "Lazer & Turismo",
      current: 3200,
      target: 15000,
      icon: <Plane strokeWidth={1.5} size={18} />,
      deadline: "Julho 2027",
    },
  ];

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalCurrent = goals.reduce((acc, g) => acc + g.current, 0);
  const totalTarget = goals.reduce((acc, g) => acc + g.target, 0);
  const overallPercentage = Math.round((totalCurrent / totalTarget) * 100);

  return (
    <div className="min-h-full bg-[#F2F2F7] p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Planejamento Financeiro
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Metas e Objetivos
          </h1>
        </div>

        <button className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs self-start sm:self-auto">
          <Plus strokeWidth={1.5} size={15} />
          <span>Nova Meta</span>
        </button>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Card de Visão Geral das Metas */}
        <section className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] p-5 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2 text-[#86868B] font-semibold uppercase tracking-wider">
              <Target strokeWidth={1.5} size={15} className="text-[#1D1D1F]" />
              <span>Progresso Global</span>
            </div>
            <span className="font-semibold text-[#1D1D1F] px-2.5 py-0.5 rounded-full bg-[#F2F2F7]">
              {overallPercentage}% acumulado
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
              {formatCurrency(totalCurrent)}
            </div>
            <div className="text-xs text-[#86868B]">
              Objetivo total: <strong className="text-[#1D1D1F] font-medium">{formatCurrency(totalTarget)}</strong>
            </div>
          </div>

          <div className="w-full h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1D1D1F] rounded-full transition-all duration-500"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </section>

        {/* Grid de Metas */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const percentage = Math.min(
              100,
              Math.round((goal.current / goal.target) * 100)
            );

            return (
              <div
                key={goal.id}
                className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] p-5 flex flex-col justify-between space-y-4 hover:border-black/10 transition-all"
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
                      {goal.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#1D1D1F]">
                        {goal.title}
                      </h3>
                      <p className="text-xs text-[#86868B]">{goal.category}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F2F2F7] text-[#86868B]">
                    {percentage}%
                  </span>
                </div>

                {/* Informações de Valores e Prazo */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-[#86868B]">
                      <strong className="text-[#1D1D1F] font-semibold">
                        {formatCurrency(goal.current)}
                      </strong>{" "}
                      guardados de {formatCurrency(goal.target)}
                    </span>
                  </div>

                  {/* Barra de Progresso Fina estilo Apple */}
                  <div className="w-full h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1D1D1F] rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {goal.deadline && (
                    <div className="text-[11px] text-[#86868B] pt-0.5 flex justify-end">
                      <span>Prazo: {goal.deadline}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

      </div>
    </div>
  );
}
