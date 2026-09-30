"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  Laptop,
  Sparkles,
  ShieldCheck,
  Plane,
  Plus,
  Target,
  Trash2,
  X,
  CreditCard,
  Wallet,
  PiggyBank,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Check,
} from "lucide-react";
import { GoalItem } from "@/types";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { sanitizeTextInput, validateCurrency } from "@/lib/utils/security";

export default function GoalsPage() {
  const {
    goals,
    cards,
    mainBalance,
    addGoal,
    contributeToGoal,
    withdrawFromGoal,
    deleteGoal,
  } = useWallet();

  // Modais e Feedback
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [activeMovementGoal, setActiveMovementGoal] = useState<GoalItem | null>(null);
  const [movementTab, setMovementTab] = useState<"contribute" | "withdraw">("contribute");
  const [goalToDelete, setGoalToDelete] = useState<GoalItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  // Formulário Nova Meta
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Segurança Financeira");
  const [targetAmount, setTargetAmount] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [deadline, setDeadline] = useState("Dezembro 2026");
  const [initialSourceType, setInitialSourceType] = useState<"already_saved" | "account">("already_saved");
  const [selectedInitialAccountId, setSelectedInitialAccountId] = useState<string>("");

  // Formulário Movimentar Meta (Aportar / Resgatar)
  const [movementAmount, setMovementAmount] = useState("");
  const [contributeSourceType, setContributeSourceType] = useState<"account" | "already_saved">("account");
  const [selectedContributeAccountId, setSelectedContributeAccountId] = useState<string>("");
  const [withdrawDestType, setWithdrawDestType] = useState<"account" | "already_withdrawn">("account");
  const [selectedWithdrawAccountId, setSelectedWithdrawAccountId] = useState<string>("");

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Contas correntes / débito disponíveis para movimentação
  const checkingAccounts = useMemo(() => {
    const explicit = cards.filter((c) => c.type === "checking");
    if (explicit.length > 0) return explicit;
    return [
      {
        id: "checking-default",
        name: "Conta Principal (Débito/Pix)",
        balance: mainBalance,
        type: "checking" as const,
        brand: "Conta",
        limit: 0,
        spent: 0,
        colorScheme: {
          gradient: "from-[#1D1D1F] to-[#0A0A0C]",
          border: "border-white/10",
          accent: "text-gray-300",
          badgeText: "Débito",
          chipGradient: "from-amber-200 to-yellow-500",
        },
      },
    ];
  }, [cards, mainBalance]);

  // Contas selecionadas com fallback seguro
  const selectedInitialAccount = useMemo(() => {
    return (
      checkingAccounts.find((c) => c.id === selectedInitialAccountId) ||
      checkingAccounts[0]
    );
  }, [checkingAccounts, selectedInitialAccountId]);

  const selectedContributeAccount = useMemo(() => {
    return (
      checkingAccounts.find((c) => c.id === selectedContributeAccountId) ||
      checkingAccounts[0]
    );
  }, [checkingAccounts, selectedContributeAccountId]);

  const selectedWithdrawAccount = useMemo(() => {
    return (
      checkingAccounts.find((c) => c.id === selectedWithdrawAccountId) ||
      checkingAccounts[0]
    );
  }, [checkingAccounts, selectedWithdrawAccountId]);

  const totalCurrent = goals.reduce((acc, g) => acc + g.current, 0);
  const totalTarget = goals.reduce((acc, g) => acc + g.target, 0);
  const overallPercentage =
    totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0;

  // Criação de Nova Meta
  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const targetValidation = validateCurrency(targetAmount, { min: 10, max: 100_000_000 });
    const initialValidation = validateCurrency(initialAmount, { min: 0, max: 100_000_000, fallback: 0 });
    const sanitizedTitle = sanitizeTextInput(title, 80);
    const sanitizedCategory = sanitizeTextInput(category, 60) || "Objetivo Geral";
    const sanitizedDeadline = sanitizeTextInput(deadline, 50) || "Em andamento";

    if (!targetValidation.isValid || !sanitizedTitle) return;

    const hasInitialValue = initialValidation.value > 0;
    const isDeductFromAccount = hasInitialValue && initialSourceType === "account";

    addGoal(
      {
        title: sanitizedTitle,
        category: sanitizedCategory,
        current: initialValidation.value,
        target: targetValidation.value,
        deadline: sanitizedDeadline,
      },
      hasInitialValue
        ? {
            type: initialSourceType,
            cardId: isDeductFromAccount && selectedInitialAccount?.id !== "checking-default" ? selectedInitialAccount?.id : null,
            accountName: isDeductFromAccount ? selectedInitialAccount?.name : undefined,
          }
        : undefined
    );

    if (isDeductFromAccount) {
      showToast(
        `Meta "${sanitizedTitle}" criada com ${formatCurrency(initialValidation.value)} debitados de ${selectedInitialAccount?.name}!`
      );
    } else {
      showToast(`Meta "${sanitizedTitle}" criada com sucesso!`);
    }

    setTitle("");
    setCategory("");
    setTargetAmount("");
    setInitialAmount("");
    setDeadline("");
    setInitialSourceType("already_saved");
    setIsNewGoalModalOpen(false);
  };

  const handleOpenNewGoal = () => {
    setTitle("");
    setCategory("Segurança Financeira");
    setTargetAmount("");
    setInitialAmount("");
    setDeadline("Dezembro 2026");
    setInitialSourceType("already_saved");
    setSelectedInitialAccountId(checkingAccounts[0]?.id || "");
    setIsNewGoalModalOpen(true);
  };

  const handleOpenTemplateModal = (template: {
    title: string;
    category: string;
    target: number;
    deadline: string;
  }) => {
    setTitle(template.title);
    setCategory(template.category);
    setTargetAmount(formatCurrency(template.target).replace("R$", "").trim());
    setInitialAmount("0,00");
    setDeadline(template.deadline);
    setInitialSourceType("already_saved");
    setSelectedInitialAccountId(checkingAccounts[0]?.id || "");
    setIsNewGoalModalOpen(true);
  };

  // Abrir Modal de Movimentação em Aporte
  const handleOpenContribute = (goal: GoalItem) => {
    setActiveMovementGoal(goal);
    setMovementTab("contribute");
    setMovementAmount("");
    setContributeSourceType("account");
    setSelectedContributeAccountId(checkingAccounts[0]?.id || "");
  };

  // Abrir Modal de Movimentação em Resgate
  const handleOpenWithdraw = (goal: GoalItem) => {
    setActiveMovementGoal(goal);
    setMovementTab("withdraw");
    setMovementAmount("");
    setWithdrawDestType("account");
    setSelectedWithdrawAccountId(checkingAccounts[0]?.id || "");
  };

  // Confirmar Aporte na Meta
  const handleContributeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMovementGoal || isSubmittingMovement) return;

    const contributeValidation = validateCurrency(movementAmount, { min: 0.01, max: 50_000_000 });
    if (!contributeValidation.isValid) return;

    setIsSubmittingMovement(true);
    try {
      const isAccount = contributeSourceType === "account";
      await contributeToGoal(activeMovementGoal.id, contributeValidation.value, {
        type: contributeSourceType,
        cardId: isAccount && selectedContributeAccount?.id !== "checking-default" ? selectedContributeAccount?.id : null,
        accountName: isAccount ? selectedContributeAccount?.name : undefined,
      });

      if (isAccount) {
        showToast(
          `${formatCurrency(contributeValidation.value)} guardados na meta "${activeMovementGoal.title}"! Debitado de ${selectedContributeAccount?.name}.`
        );
      } else {
        showToast(
          `${formatCurrency(contributeValidation.value)} somados à meta "${activeMovementGoal.title}" (saldo da conta inalterado).`
        );
      }

      setActiveMovementGoal(null);
      setMovementAmount("");
    } catch (err) {
      console.error("Erro ao realizar aporte:", err);
      showToast("Não foi possível registrar o aporte. Tente novamente.");
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  // Confirmar Resgate da Meta
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMovementGoal || isSubmittingMovement) return;

    const maxAllowed = activeMovementGoal.current;
    if (maxAllowed <= 0) return;

    const withdrawValidation = validateCurrency(movementAmount, { min: 0.01, max: maxAllowed });
    if (!withdrawValidation.isValid) return;

    setIsSubmittingMovement(true);
    try {
      const isAccount = withdrawDestType === "account";
      await withdrawFromGoal(activeMovementGoal.id, withdrawValidation.value, {
        type: withdrawDestType,
        cardId: isAccount && selectedWithdrawAccount?.id !== "checking-default" ? selectedWithdrawAccount?.id : null,
        accountName: isAccount ? selectedWithdrawAccount?.name : undefined,
      });

      if (isAccount) {
        showToast(
          `${formatCurrency(withdrawValidation.value)} resgatados com sucesso para ${selectedWithdrawAccount?.name}!`
        );
      } else {
        showToast(
          `${formatCurrency(withdrawValidation.value)} retirados da meta "${activeMovementGoal.title}".`
        );
      }

      setActiveMovementGoal(null);
      setMovementAmount("");
    } catch (err) {
      console.error("Erro ao realizar resgate:", err);
      showToast("Não foi possível registrar o resgate. Tente novamente.");
    } finally {
      setIsSubmittingMovement(false);
    }
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

  // Valor numérico digitado no modal de movimentação
  const parsedMovementAmount = useMemo(() => {
    const clean = movementAmount.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }, [movementAmount]);

  // Valor numérico inicial digitado na criação de nova meta
  const parsedInitialAmount = useMemo(() => {
    const clean = initialAmount.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }, [initialAmount]);

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500">
      {/* Toast Feedback Flutuante */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 z-[120] bg-[#1D1D1F] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2 border border-white/10">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

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
          onClick={handleOpenNewGoal}
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
            <span className="font-semibold text-[#1D1D1F] px-2.5 py-0.5 rounded-full bg-[#F2F2F7] font-mono tabular-nums">
              {overallPercentage}% acumulado
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight font-mono tabular-nums">
              {formatCurrency(totalCurrent)}
            </div>
            <div className="text-xs text-[#86868B]">
              Objetivo total:{" "}
              <strong className="text-[#1D1D1F] font-medium font-mono tabular-nums">
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
                Crie metas com valores e prazos definidos. Você pode escolher um dos modelos recomendados abaixo para personalizar ou criar a sua própria meta do zero.
              </p>
            </div>

            {/* Modelos Recomendados para Personalizar */}
            <div className="space-y-2 pt-2 text-left">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#86868B] block text-center sm:text-left">
                Toque em um modelo para personalizar antes de salvar:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    onClick={() => handleOpenTemplateModal(tmpl)}
                    className="p-4 rounded-2xl border border-black/[0.06] hover:border-black/20 hover:shadow-xs transition-all cursor-pointer bg-[#F2F2F7]/50 space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-2xs">
                        {tmpl.icon}
                      </div>
                      <span className="text-[11px] font-semibold text-[#0071E3] group-hover:text-[#0077ED] flex items-center gap-0.5">
                        Personalizar &rarr;
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
            </div>

            <div>
              <button
                type="button"
                onClick={handleOpenNewGoal}
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
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F2F2F7] text-[#86868B] font-mono tabular-nums">
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
                        <strong className="text-[#1D1D1F] font-semibold font-mono tabular-nums">
                          {formatCurrency(goal.current)}
                        </strong>{" "}
                        guardados de <span className="font-mono tabular-nums">{formatCurrency(goal.target)}</span>
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

                      <div className="flex items-center gap-1.5">
                        {goal.current > 0 && (
                          <button
                            onClick={() => handleOpenWithdraw(goal)}
                            className="text-xs font-medium px-2.5 py-1 rounded-full bg-white hover:bg-rose-50 text-rose-600 border border-black/[0.08] hover:border-rose-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Resgatar valor guardado desta meta para sua conta"
                          >
                            <ArrowDownLeft size={13} />
                            <span>Resgatar</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenContribute(goal)}
                          className="text-xs font-semibold px-3 py-1 rounded-full bg-[#1D1D1F] hover:bg-black text-white transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Aportar e guardar dinheiro nesta meta"
                        >
                          <Plus size={13} />
                          <span>Aportar</span>
                        </button>
                      </div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            onClick={() => setIsNewGoalModalOpen(false)}
            className="fixed inset-0 bg-black/45 animate-apple-backdrop"
          />

          <div className="relative w-full max-w-md bg-white rounded-[28px] p-6 space-y-5 shadow-2xl z-50 animate-apple-modal font-sans max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B]">
                  Objetivo Patrimonial
                </span>
                <h3 className="text-lg font-semibold text-[#1D1D1F]">
                  Personalizar Meta
                </h3>
              </div>
              <button
                onClick={() => setIsNewGoalModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Atalhos Rápidos de Modelos */}
            <div className="space-y-1.5 bg-[#F2F2F7]/60 p-2.5 rounded-2xl border border-black/[0.04]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                Modelos Rápidos (preenche e personaliza):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  {
                    title: "Reserva de Emergência",
                    category: "Segurança Financeira",
                    target: 15000,
                    deadline: "6 meses",
                  },
                  {
                    title: "Viagem dos Sonhos",
                    category: "Lazer & Turismo",
                    target: 10000,
                    deadline: "Julho 2027",
                  },
                  {
                    title: "Novo Notebook / Setup",
                    category: "Equipamento & Trabalho",
                    target: 8500,
                    deadline: "Dezembro 2026",
                  },
                ].map((tmpl) => (
                  <button
                    key={tmpl.title}
                    type="button"
                    onClick={() => {
                      setTitle(tmpl.title);
                      setCategory(tmpl.category);
                      setTargetAmount(tmpl.target.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
                      setDeadline(tmpl.deadline);
                    }}
                    className="text-[11px] font-medium bg-white hover:bg-black hover:text-white px-2.5 py-1 rounded-full border border-black/[0.05] shadow-2xs transition-all cursor-pointer text-[#1D1D1F]"
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>
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
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none font-medium focus:ring-2 focus:ring-black/10 transition-all"
                  required
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
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none focus:ring-2 focus:ring-black/10 transition-all"
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
                    className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none font-semibold focus:ring-2 focus:ring-black/10 transition-all font-mono tabular-nums"
                    required
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
                    className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none focus:ring-2 focus:ring-black/10 transition-all font-mono tabular-nums"
                  />
                </div>
              </div>

              {/* PERGUNTA: De onde vem o dinheiro já guardado? (Exibido quando initialAmount > 0) */}
              {parsedInitialAmount > 0 && (
                <div className="p-3.5 bg-[#F2F2F7]/70 rounded-2xl border border-black/[0.06] space-y-3 animate-in fade-in duration-300">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                      <Wallet size={14} className="text-emerald-600" />
                      De onde vem esse valor inicial de <span className="font-mono tabular-nums">{formatCurrency(parsedInitialAmount)}</span>?
                    </span>
                    <p className="text-[10px] text-[#86868B]">
                      Escolha se deseja debitar da sua conta agora ou se esse dinheiro já estava guardado externamente.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Opção 1: Já está guardado */}
                    <div
                      onClick={() => setInitialSourceType("already_saved")}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-1 ${
                        initialSourceType === "already_saved"
                          ? "bg-white border-black text-[#1D1D1F] shadow-2xs ring-1 ring-black"
                          : "bg-white/60 border-black/[0.06] text-[#86868B] hover:border-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <PiggyBank size={16} className={initialSourceType === "already_saved" ? "text-emerald-600" : ""} />
                        {initialSourceType === "already_saved" && (
                          <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Já está guardado</div>
                        <div className="text-[10px] text-[#86868B] leading-tight">
                          Reserva externa. Não altera o saldo das contas.
                        </div>
                      </div>
                    </div>

                    {/* Opção 2: Tirar do débito / conta */}
                    <div
                      onClick={() => setInitialSourceType("account")}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-1 ${
                        initialSourceType === "account"
                          ? "bg-white border-black text-[#1D1D1F] shadow-2xs ring-1 ring-black"
                          : "bg-white/60 border-black/[0.06] text-[#86868B] hover:border-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <CreditCard size={16} className={initialSourceType === "account" ? "text-blue-600" : ""} />
                        {initialSourceType === "account" && (
                          <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Tirar do Débito</div>
                        <div className="text-[10px] text-[#86868B] leading-tight">
                          Debita da conta corrente e gera lançamento.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seletor de Conta quando escolhido 'account' */}
                  {initialSourceType === "account" && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                        Selecione a conta para debitar:
                      </label>
                      <div className="space-y-1.5">
                        {checkingAccounts.map((acc) => {
                          const isSelected = selectedInitialAccount?.id === acc.id;
                          return (
                            <div
                              key={acc.id}
                              onClick={() => setSelectedInitialAccountId(acc.id)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? "bg-white border-black text-[#1D1D1F] shadow-2xs"
                                  : "bg-white/50 border-black/[0.06] hover:border-black/20 text-[#86868B]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Wallet size={15} className={isSelected ? "text-[#1D1D1F]" : "text-gray-400"} />
                                <span className="text-xs font-semibold text-[#1D1D1F]">{acc.name}</span>
                              </div>
                              <span className="text-xs font-medium text-[#1D1D1F]">
                                Saldo: <strong className="font-mono tabular-nums">{formatCurrency(acc.balance ?? 0)}</strong>
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Aviso se o saldo for menor que o valor inicial */}
                      {(selectedInitialAccount?.balance ?? 0) < parsedInitialAmount && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>
                            Atenção: o saldo na conta é de <span className="font-mono tabular-nums">{formatCurrency(selectedInitialAccount?.balance ?? 0)}</span> e ficará negativo.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                  Prazo Estimado
                </label>
                <input
                  type="text"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  placeholder="Ex: Dezembro 2026, Em andamento..."
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none focus:ring-2 focus:ring-black/10 transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm py-3.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE MOVIMENTAÇÃO DE META (APORTAR OU RESGATAR) */}
      {activeMovementGoal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            onClick={() => setActiveMovementGoal(null)}
            className="fixed inset-0 bg-black/45 animate-apple-backdrop"
          />

          <div className="relative w-full max-w-md bg-white rounded-[28px] p-6 space-y-4 shadow-2xl z-50 animate-apple-modal font-sans max-h-[90dvh] overflow-y-auto">
            {/* Header da Meta */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
                  {getCategoryIcon(activeMovementGoal.category)}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1D1D1F] leading-tight">
                    {activeMovementGoal.title}
                  </h3>
                  <p className="text-[11px] text-[#86868B]">
                    {formatCurrency(activeMovementGoal.current)} guardados de {formatCurrency(activeMovementGoal.target)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveMovementGoal(null)}
                className="w-8 h-8 rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Alternador de Abas: Guardar Dinheiro (Aporte) vs Resgatar (Retirada) */}
            <div className="grid grid-cols-2 gap-1 bg-[#F2F2F7] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMovementTab("contribute");
                  setMovementAmount("");
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  movementTab === "contribute"
                    ? "bg-white text-[#1D1D1F] shadow-2xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Guardar Dinheiro</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMovementTab("withdraw");
                  setMovementAmount("");
                }}
                disabled={activeMovementGoal.current <= 0}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  movementTab === "withdraw"
                    ? "bg-white text-[#1D1D1F] shadow-2xs"
                    : activeMovementGoal.current <= 0
                    ? "opacity-40 cursor-not-allowed text-[#86868B]"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                <ArrowDownLeft size={14} strokeWidth={2.5} />
                <span>Resgatar Valor</span>
              </button>
            </div>

            {/* ABA 1: GUARDAR DINHEIRO (APORTE) */}
            {movementTab === "contribute" && (
              <form onSubmit={handleContributeSubmit} className="space-y-4">
                <div className="space-y-1 text-center py-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B] block">
                    Quanto deseja guardar agora?
                  </label>
                  <div className="flex justify-center items-baseline gap-1.5 pt-1">
                    <span className="text-2xl font-light text-gray-400 font-mono tabular-nums">R$</span>
                    <input
                      type="text"
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                      placeholder="100,00"
                      className="text-3xl font-light text-[#1D1D1F] text-center w-52 outline-none bg-transparent font-mono tabular-nums"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Atalhos rápidos de valores */}
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {[50, 100, 200, 500].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setMovementAmount(quick.toString() + ",00")}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#F2F2F7] hover:bg-black hover:text-white transition-all cursor-pointer"
                    >
                      +R$ {quick}
                    </button>
                  ))}
                  {activeMovementGoal.target > activeMovementGoal.current && (
                    <button
                      type="button"
                      onClick={() => {
                        const diff = activeMovementGoal.target - activeMovementGoal.current;
                        setMovementAmount(diff.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-700 hover:text-white transition-all cursor-pointer border border-emerald-200"
                    >
                      Completar Meta
                    </button>
                  )}
                </div>

                {/* PERGUNTA CENTRAL DO USUÁRIO: DE ONDE TIRAR O DINHEIRO */}
                <div className="p-3.5 bg-[#F2F2F7]/70 rounded-2xl border border-black/[0.06] space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-[#1D1D1F] block">
                      De onde você quer tirar esse dinheiro?
                    </span>
                    <p className="text-[11px] text-[#86868B]">
                      Indique se o valor sairá do débito da sua conta corrente ou se já está guardado por fora.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Opção A: Tirar do Débito da Conta */}
                    <div
                      onClick={() => setContributeSourceType("account")}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                        contributeSourceType === "account"
                          ? "bg-white border-black text-[#1D1D1F] shadow-2xs ring-1 ring-black"
                          : "bg-white/60 border-black/[0.06] text-[#86868B] hover:border-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <CreditCard size={16} className={contributeSourceType === "account" ? "text-blue-600" : ""} />
                        {contributeSourceType === "account" && (
                          <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Tirar do Débito</div>
                        <div className="text-[10px] text-[#86868B] leading-tight">
                          Debita da conta corrente e gera lançamento de saída.
                        </div>
                      </div>
                    </div>

                    {/* Opção B: Já está guardado */}
                    <div
                      onClick={() => setContributeSourceType("already_saved")}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                        contributeSourceType === "already_saved"
                          ? "bg-white border-black text-[#1D1D1F] shadow-2xs ring-1 ring-black"
                          : "bg-white/60 border-black/[0.06] text-[#86868B] hover:border-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <PiggyBank size={16} className={contributeSourceType === "already_saved" ? "text-emerald-600" : ""} />
                        {contributeSourceType === "already_saved" && (
                          <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Já está guardado</div>
                        <div className="text-[10px] text-[#86868B] leading-tight">
                          Apenas soma na meta. Não altera o saldo das contas.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seletor de Conta Corrente quando 'account' está selecionado */}
                  {contributeSourceType === "account" && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                        Conta para debitar:
                      </label>
                      <div className="space-y-1.5">
                        {checkingAccounts.map((acc) => {
                          const isSelected = selectedContributeAccount?.id === acc.id;
                          return (
                            <div
                              key={acc.id}
                              onClick={() => setSelectedContributeAccountId(acc.id)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? "bg-white border-black text-[#1D1D1F] shadow-2xs"
                                  : "bg-white/50 border-black/[0.06] hover:border-black/20 text-[#86868B]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Wallet size={15} className={isSelected ? "text-[#1D1D1F]" : "text-gray-400"} />
                                <span className="text-xs font-semibold text-[#1D1D1F]">{acc.name}</span>
                              </div>
                              <span className="text-xs font-medium text-[#1D1D1F]">
                                Saldo: <strong className="font-mono tabular-nums">{formatCurrency(acc.balance ?? 0)}</strong>
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Prévia do saldo após o débito */}
                      {parsedMovementAmount > 0 && selectedContributeAccount && (
                        <div className="pt-1 flex items-center justify-between text-[11px] text-[#86868B] px-1">
                          <span>Saldo após guardar:</span>
                          <span
                            className={`font-semibold font-mono tabular-nums ${
                              (selectedContributeAccount.balance ?? 0) - parsedMovementAmount < 0
                                ? "text-amber-600"
                                : "text-[#1D1D1F]"
                            }`}
                          >
                            {formatCurrency((selectedContributeAccount.balance ?? 0) - parsedMovementAmount)}
                          </span>
                        </div>
                      )}

                      {/* Alerta se o saldo for insuficiente */}
                      {(selectedContributeAccount?.balance ?? 0) < parsedMovementAmount && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>
                            Saldo disponível (<span className="font-mono tabular-nums">{formatCurrency(selectedContributeAccount?.balance ?? 0)}</span>) é menor que o valor a guardar.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingMovement || parsedMovementAmount <= 0}
                    className="w-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm py-3.5 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    <span>
                      {contributeSourceType === "account"
                        ? `Tirar do Débito e Guardar ${parsedMovementAmount > 0 ? formatCurrency(parsedMovementAmount) : ""}`
                        : `Confirmar Aporte de ${parsedMovementAmount > 0 ? formatCurrency(parsedMovementAmount) : ""}`}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* ABA 2: RESGATAR VALOR DA META (RETIRADA) */}
            {movementTab === "withdraw" && (
              <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                <div className="space-y-1 text-center py-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B] block">
                    Quanto deseja resgatar?
                  </label>
                  <p className="text-[11px] text-[#86868B]">
                    Disponível nesta meta: <strong className="text-[#1D1D1F] font-mono tabular-nums">{formatCurrency(activeMovementGoal.current)}</strong>
                  </p>
                  <div className="flex justify-center items-baseline gap-1.5 pt-1">
                    <span className="text-2xl font-light text-gray-400 font-mono tabular-nums">R$</span>
                    <input
                      type="text"
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                      placeholder="100,00"
                      className="text-3xl font-light text-[#1D1D1F] text-center w-52 outline-none bg-transparent font-mono tabular-nums"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Atalhos rápidos de resgate */}
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {[50, 100, 200].filter((val) => val <= activeMovementGoal.current).map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setMovementAmount(quick.toString() + ",00")}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#F2F2F7] hover:bg-black hover:text-white transition-all cursor-pointer"
                    >
                      R$ {quick}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const half = activeMovementGoal.current / 2;
                      setMovementAmount(half.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#F2F2F7] hover:bg-black hover:text-white transition-all cursor-pointer"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMovementAmount(activeMovementGoal.current.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-700 hover:text-white transition-all cursor-pointer border border-rose-200"
                  >
                    Tudo ({formatCurrency(activeMovementGoal.current)})
                  </button>
                </div>

                {/* Destino do dinheiro resgatado */}
                <div className="p-3.5 bg-[#F2F2F7]/70 rounded-2xl border border-black/[0.06] space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-[#1D1D1F] block">
                      Para onde vai esse dinheiro?
                    </span>
                    <p className="text-[11px] text-[#86868B]">
                      Você pode depositar de volta na sua conta corrente ou apenas abater da meta.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Opção A: Depositar na Conta */}
                    <div
                      onClick={() => setWithdrawDestType("account")}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                        withdrawDestType === "account"
                          ? "bg-white border-black text-[#1D1D1F] shadow-2xs ring-1 ring-black"
                          : "bg-white/60 border-black/[0.06] text-[#86868B] hover:border-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <CreditCard size={16} className={withdrawDestType === "account" ? "text-emerald-600" : ""} />
                        {withdrawDestType === "account" && (
                          <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Depositar na Conta</div>
                        <div className="text-[10px] text-[#86868B] leading-tight">
                          Adiciona ao saldo da conta corrente via receita.
                        </div>
                      </div>
                    </div>

                    {/* Opção B: Já retirado / Não alterar saldo */}
                    <div
                      onClick={() => setWithdrawDestType("already_withdrawn")}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                        withdrawDestType === "already_withdrawn"
                          ? "bg-white border-black text-[#1D1D1F] shadow-2xs ring-1 ring-black"
                          : "bg-white/60 border-black/[0.06] text-[#86868B] hover:border-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <PiggyBank size={16} className={withdrawDestType === "already_withdrawn" ? "text-gray-600" : ""} />
                        {withdrawDestType === "already_withdrawn" && (
                          <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1D1D1F]">Apenas abater</div>
                        <div className="text-[10px] text-[#86868B] leading-tight">
                          Subtrai da meta sem alterar o saldo das contas.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seletor de Conta de Destino quando 'account' está selecionado */}
                  {withdrawDestType === "account" && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                        Conta para creditar o resgate:
                      </label>
                      <div className="space-y-1.5">
                        {checkingAccounts.map((acc) => {
                          const isSelected = selectedWithdrawAccount?.id === acc.id;
                          return (
                            <div
                              key={acc.id}
                              onClick={() => setSelectedWithdrawAccountId(acc.id)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? "bg-white border-black text-[#1D1D1F] shadow-2xs"
                                  : "bg-white/50 border-black/[0.06] hover:border-black/20 text-[#86868B]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Wallet size={15} className={isSelected ? "text-[#1D1D1F]" : "text-gray-400"} />
                                <span className="text-xs font-semibold text-[#1D1D1F]">{acc.name}</span>
                              </div>
                              <span className="text-xs font-medium text-[#1D1D1F]">
                                Saldo: <strong className="font-mono tabular-nums">{formatCurrency(acc.balance ?? 0)}</strong>
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Prévia do saldo após o resgate */}
                      {parsedMovementAmount > 0 && selectedWithdrawAccount && (
                        <div className="pt-1 flex items-center justify-between text-[11px] text-[#86868B] px-1">
                          <span>Saldo após resgate:</span>
                          <span className="font-semibold text-emerald-600 font-mono tabular-nums">
                            {formatCurrency((selectedWithdrawAccount.balance ?? 0) + parsedMovementAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingMovement || parsedMovementAmount <= 0 || parsedMovementAmount > activeMovementGoal.current}
                    className="w-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm py-3.5 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ArrowDownLeft size={16} />
                    <span>
                      {withdrawDestType === "account"
                        ? `Resgatar para a Conta ${parsedMovementAmount > 0 ? formatCurrency(parsedMovementAmount) : ""}`
                        : `Confirmar Retirada de ${parsedMovementAmount > 0 ? formatCurrency(parsedMovementAmount) : ""}`}
                    </span>
                  </button>
                </div>
              </form>
            )}
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
            showToast(`Meta "${goalToDelete.title}" excluída.`);
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
