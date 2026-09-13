"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  Laptop,
  Sparkles,
  ShieldCheck,
  Plane,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  X,
  Check,
  Coins,
  ArrowUpRight,
} from "lucide-react";
import { GoalItem } from "@/types";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";

export default function GoalsPage() {
  const { goals, addGoal, updateGoalProgress, deleteGoal } = useWallet();

  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [goalToDelete, setGoalToDelete] = useState<GoalItem | null>(null);

  // Formulário Nova Meta
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Segurança Financeira");
  const [targetAmount, setTargetAmount] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [deadline, setDeadline] = useState("Dezembro 2026");

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalCurrent = goals.reduce((acc, g) => acc + g.current, 0);
  const totalTarget = goals.reduce((acc, g) => acc + g.target, 0);
  const overallPercentage =
    totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0;

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = parseFloat(targetAmount.replace(/\./g, "").replace(",", "."));
    const cleanInitial = parseFloat(initialAmount.replace(/\./g, "").replace(",", ".")) || 0;

    if (isNaN(cleanTarget) || cleanTarget <= 0 || !title.trim()) return;

    addGoal({
      title: title.trim(),
      category: category.trim() || "Objetivo Geral",
      current: cleanInitial,
      target: cleanTarget,
      deadline: deadline.trim() || "Em andamento",
    });

    setTitle("");
    setTargetAmount("");
    setInitialAmount("");
    setIsNewGoalModalOpen(false);
  };

  const handleQuickAddTemplate = (template: {
    title: string;
    category: string;
    target: number;
    deadline: string;
  }) => {
    addGoal({
      title: template.title,
      category: template.category,
      current: 0,
      target: template.target,
      deadline: template.deadline,
    });
  };

  const handleContributeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeGoalId) return;
    const cleanAmount = parseFloat(contributeAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(cleanAmount) || cleanAmount <= 0) return;

    updateGoalProgress(contributeGoalId, cleanAmount);
    setContributeGoalId(null);
    setContributeAmount("");
  };

  const getCategoryIcon = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("segurança") || lower.includes("reserva"))
      return <ShieldCheck strokeWidth={1.5} size={18} />;
    if (lower.includes("viagem") || lower.includes("lazer") || lower.includes("turismo"))
      return <Plane strokeWidth={1.5} size={18} />;
    if (lower.includes("trabalho") || lower.includes("computador") || lower.includes("equipamento"))
      return <Laptop strokeWidth={1.5} size={18} />;
    return <Sparkles strokeWidth={1.5} size={18} />;
  };

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

        <button
          onClick={() => setIsNewGoalModalOpen(true)}
          className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus strokeWidth={2} size={15} />
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
              Objetivo total:{" "}
              <strong className="text-[#1D1D1F] font-medium">
                {formatCurrency(totalTarget)}
              </strong>
            </div>
          </div>

          <div className="w-full h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1D1D1F] rounded-full transition-all duration-500"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </section>

        {/* Lista / Grid de Metas */}
        {goals.length === 0 ? (
          <section className="bg-white rounded-[24px] border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-8 text-center space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center mx-auto">
              <Target size={24} strokeWidth={1.5} />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-semibold text-[#1D1D1F]">
                Nenhuma meta cadastrada ainda
              </h3>
              <p className="text-xs text-[#86868B]">
                Crie metas com valores e prazos definidos. Você pode escolher um dos modelos recomendados abaixo ou criar a sua própria meta personalizada.
              </p>
            </div>

            {/* Modelos de 1-Clique */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
              {[
                {
                  title: "Reserva de Emergência",
                  category: "Segurança Financeira",
                  target: 15000,
                  deadline: "6 meses",
                  icon: <ShieldCheck size={18} className="text-emerald-600" />,
                },
                {
                  title: "Viagem dos Sonhos",
                  category: "Lazer & Turismo",
                  target: 10000,
                  deadline: "Julho 2027",
                  icon: <Plane size={18} className="text-blue-600" />,
                },
                {
                  title: "Novo Notebook / Setup",
                  category: "Equipamento & Trabalho",
                  target: 8500,
                  deadline: "Dezembro 2026",
                  icon: <Laptop size={18} className="text-purple-600" />,
                },
              ].map((tmpl) => (
                <div
                  key={tmpl.title}
                  onClick={() => handleQuickAddTemplate(tmpl)}
                  className="p-4 rounded-2xl border border-black/[0.06] hover:border-black/20 hover:shadow-xs transition-all cursor-pointer bg-[#F2F2F7]/50 space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-2xs">
                      {tmpl.icon}
                    </div>
                    <span className="text-[10px] font-semibold text-[#86868B] group-hover:text-[#1D1D1F]">
                      + Adicionar
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#1D1D1F]">{tmpl.title}</h4>
                    <p className="text-[11px] text-[#86868B]">{tmpl.category}</p>
                    <p className="text-xs font-semibold text-[#1D1D1F] pt-1">
                      {formatCurrency(tmpl.target)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsNewGoalModalOpen(true)}
                className="bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>Criar Meta Personalizada</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => {
              const percentage = Math.min(
                100,
                goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0
              );

              return (
                <div
                  key={goal.id}
                  className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] p-5 flex flex-col justify-between space-y-4 hover:border-black/10 transition-all group"
                >
                  {/* Header do Card */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
                        {getCategoryIcon(goal.category)}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#1D1D1F]">
                          {goal.title}
                        </h3>
                        <p className="text-xs text-[#86868B]">{goal.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F2F2F7] text-[#86868B]">
                        {percentage}%
                      </span>
                      <button
                        onClick={() => setGoalToDelete(goal)}
                        className="text-gray-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title="Excluir meta"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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

                    {/* Barra de Progresso Fina estilo Pass Kit */}
                    <div className="w-full h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1D1D1F] rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {goal.deadline ? (
                        <span className="text-[11px] text-[#86868B]">
                          Prazo: {goal.deadline}
                        </span>
                      ) : (
                        <span />
                      )}

                      <button
                        onClick={() => {
                          setContributeGoalId(goal.id);
                          setContributeAmount("");
                        }}
                        className="text-xs font-semibold px-3 py-1 rounded-full bg-[#F2F2F7] hover:bg-black hover:text-white text-[#1D1D1F] transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Aportar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      {/* MODAL NOVA META */}
      {isNewGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsNewGoalModalOpen(false)}
            className="fixed inset-0 bg-black/45 animate-apple-backdrop"
          />

          <div className="relative w-full max-w-md bg-white rounded-[28px] p-6 space-y-5 shadow-2xl z-50 animate-apple-modal font-sans">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B]">
                  Objetivo Patrimonial
                </span>
                <h3 className="text-lg font-semibold text-[#1D1D1F]">
                  Criar Nova Meta
                </h3>
              </div>
              <button
                onClick={() => setIsNewGoalModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                  Nome da Meta
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Reserva de Emergência, Viagem Europa..."
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                  Categoria
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Segurança, Lazer, Equipamento, Bens..."
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                    Valor Alvo (R$)
                  </label>
                  <input
                    type="text"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="10.000,00"
                    className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                    Já guardado (R$)
                  </label>
                  <input
                    type="text"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                  Prazo Estimado
                </label>
                <input
                  type="text"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  placeholder="Ex: Dezembro 2026, Em andamento..."
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm py-3.5 rounded-xl transition-all cursor-pointer"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL APORTAR EM UMA META */}
      {contributeGoalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setContributeGoalId(null)}
            className="fixed inset-0 bg-black/45 animate-apple-backdrop"
          />

          <div className="relative w-full max-w-sm bg-white rounded-[28px] p-6 space-y-4 shadow-2xl z-50 animate-apple-modal font-sans">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1D1D1F]">
                Aportar na Meta
              </h3>
              <button
                onClick={() => setContributeGoalId(null)}
                className="w-8 h-8 rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleContributeSubmit} className="space-y-4">
              <div className="space-y-1 text-center py-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B] block">
                  Quanto deseja guardar agora?
                </label>
                <div className="flex justify-center items-baseline gap-1.5 pt-1">
                  <span className="text-xl font-medium text-gray-400">R$</span>
                  <input
                    type="text"
                    value={contributeAmount}
                    onChange={(e) => setContributeAmount(e.target.value)}
                    placeholder="100,00"
                    className="text-3xl font-light text-[#1D1D1F] text-center w-48 outline-none bg-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-center">
                {[50, 100, 200, 500].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setContributeAmount(quick.toString() + ",00")}
                    className="text-xs font-semibold px-3 py-1 rounded-full bg-[#F2F2F7] hover:bg-black hover:text-white transition-all cursor-pointer"
                  >
                    +R${quick}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm py-3.5 rounded-xl transition-all cursor-pointer"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Excluir Meta */}
      <AppleConfirmModal
        isOpen={!!goalToDelete}
        onClose={() => setGoalToDelete(null)}
        onConfirm={() => {
          if (goalToDelete) {
            deleteGoal(goalToDelete.id);
            setGoalToDelete(null);
          }
        }}
        title="Excluir Meta"
        description={`Tem certeza que deseja excluir a meta "${goalToDelete?.title}"? O progresso acumulado de ${goalToDelete ? formatCurrency(goalToDelete.current) : ""} será removido.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />
    </div>
  );
}
