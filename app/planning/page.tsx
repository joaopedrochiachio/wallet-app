"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  Plus,
  Trash2,
  Check,
  Building2,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { WPayLogo, WPayButton } from "@/components/ui/WPayLogo";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { MonthlyMovementOverview } from "@/components/planning/MonthlyMovementOverview";
import {
  get5thBusinessDay,
  getEffectiveDueDay,
  getPlanningMonths,
  getPeriodKey,
  getRecurringMonthOffset,
  isRecurringActiveInMonth,
} from "@/lib/utils/dateUtils";
import { getLedgerEntryDate } from "@/lib/utils/ledger";
import { RecurrenceType, RecurringItem } from "@/types";

export default function PlanningPage() {
  const {
    recurringItems,
    addRecurringItem,
    toggleRecurringItem,
    deleteRecurringItem,
    getMonthlyProjection,
    accountOptions,
    cards,
    transactions,
  } = useWallet();

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"income" | "expense">("income");
  const [itemToDelete, setItemToDelete] = useState<RecurringItem | null>(null);

  // Form para novo item de planejamento
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newAccount, setNewAccount] = useState("Débito/Pix");
  const [newCategory, setNewCategory] = useState("Salário / Extra");

  // Recorrência e cálculo inteligente
  const [recurrenceSelection, setRecurrenceSelection] =
    useState<RecurrenceType>("business_day_5");
  const [fixedDayValue, setFixedDayValue] = useState("10");
  const [isCustomDayActive, setIsCustomDayActive] = useState(false);
  const [customDayInput, setCustomDayInput] = useState("10");

  // Parcelamento / Duração (ex: 3, 4, 5 meses ou contínuo)
  const [durationMode, setDurationMode] = useState<"continuous" | "installments">("continuous");
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [isCustomInstallment, setIsCustomInstallment] = useState(false);
  const [customInstallmentInput, setCustomInstallmentInput] = useState("4");


  const planningMonths = getPlanningMonths();

  const activeMonthObj = planningMonths[selectedMonthIndex] || planningMonths[0];
  const targetYear = activeMonthObj.year;
  const targetMonth = activeMonthObj.monthIndex;
  const currentMonth5thBusinessDay = get5thBusinessDay(targetYear, targetMonth);

  const projection = getMonthlyProjection(selectedMonthIndex);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isCheckingAccount = (item: RecurringItem) =>
    item.account === "Débito/Pix" || cards.some((card) =>
      card.type === "checking" &&
      (card.id === item.cardId || card.id === item.account || card.name === item.account)
    );

  const isActiveInSelectedMonth = (item: RecurringItem) =>
    isRecurringActiveInMonth(item, targetYear, targetMonth);

  const selectedTransactions = transactions.filter((transaction) => {
    if (transaction.kind === "invoice_settlement") return false;
    const occurredAt = getLedgerEntryDate(transaction);
    return occurredAt?.getFullYear() === targetYear && occurredAt.getMonth() === targetMonth;
  });

  // Separar recebidos futuros vs pagamentos futuros
  const plannedIncomes = recurringItems.filter((r) => r.type === "income");
  const plannedDebitExpenses = recurringItems.filter(
    (r) => r.type !== "income" && isCheckingAccount(r)
  );
  const plannedCreditExpenses = recurringItems.filter(
    (r) => r.type !== "income" && !isCheckingAccount(r)
  );

  const totalIncomesActive = plannedIncomes
    .filter(isActiveInSelectedMonth)
    .reduce((acc, r) => acc + r.amount, 0);

  const totalDebitExpensesActive = plannedDebitExpenses
    .filter(isActiveInSelectedMonth)
    .reduce((acc, r) => acc + r.amount, 0);

  const freePercentage =
    projection.projectedIncome > 0
      ? Math.max(
          0,
          Math.round((projection.projectedFreeBalance / projection.projectedIncome) * 100)
        )
      : 0;

  const creditCommitments =
    projection.cardInstallments + projection.recurringCreditTotal;
  const debitCommitments = projection.recurringDebitTotal;
  const realizedShare =
    projection.totalCommitted > 0
      ? (projection.actualOutflowTotal / projection.totalCommitted) * 100
      : 0;
  const creditShare =
    projection.totalCommitted > 0
      ? (creditCommitments / projection.totalCommitted) * 100
      : 0;
  const debitShare =
    projection.totalCommitted > 0
      ? (debitCommitments / projection.totalCommitted) * 100
      : 0;

  const handleOpenModal = (type: "income" | "expense") => {
    setModalType(type);
    setNewCategory(type === "income" ? "Salário / Extra" : "Moradia & Contas");
    // Para recebimentos, sugere prioritariamente Débito/Pix (Conta Corrente)
    const checkingAcc =
      cards.find((card) => card.type === "checking")?.name ||
      accountOptions[0] ||
      "Débito/Pix";
    setNewAccount(type === "income" ? checkingAcc : accountOptions[0] || "Débito/Pix");
    setRecurrenceSelection(type === "income" ? "business_day_5" : "fixed_day");
    setIsCustomDayActive(false);
    setDurationMode("continuous");
    setInstallmentsCount(3);
    setIsCustomInstallment(false);
    setIsAddingModalOpen(true);
  };

  const handleCreatePlannedItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(newAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(cleanAmount) || cleanAmount <= 0 || !newTitle.trim()) return;

    let computedDay = 10;
    if (recurrenceSelection === "business_day_5") {
      computedDay = currentMonth5thBusinessDay;
    } else if (isCustomDayActive) {
      computedDay = parseInt(customDayInput) || 10;
    } else {
      computedDay = parseInt(fixedDayValue) || 10;
    }

    try {
      await addRecurringItem({
        title: newTitle.trim(),
        amount: cleanAmount,
        type: modalType,
        account: newAccount,
        cardId: cards.find((card) => card.name === newAccount)?.id || null,
        category: newCategory,
        dueDay: computedDay,
        recurrenceType: recurrenceSelection,
        installmentsCount: durationMode === "installments" ? installmentsCount : undefined,
        startMonth: targetMonth,
        startYear: targetYear,
        active: true,
      });
      setNewTitle("");
      setNewAmount("");
      setIsAddingModalOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível salvar o planejamento.");
    }
  };

  const handleToggleRecurring = async (id: string) => {
    try {
      await toggleRecurringItem(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível alterar o planejamento.");
    }
  };

  return (
    <div className="min-h-full bg-[#F2F2F7] p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500 relative">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Visão Futura & Previsibilidade
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Planejamento Mensal
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => handleOpenModal("income")}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus strokeWidth={2} size={15} />
            <span>+ Recebido Futuro</span>
          </button>
          <button
            onClick={() => handleOpenModal("expense")}
            className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus strokeWidth={2} size={15} />
            <span>+ Pagamento Futuro</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Seletor de Mês (Segmented Control iOS) */}
        <div className="bg-[#E5E5EA]/70 p-1 rounded-full flex items-center gap-1 overflow-x-auto border border-black/5 scrollbar-none">
          {planningMonths.map((m, idx) => (
            <button
              key={m.name}
              onClick={() => setSelectedMonthIndex(idx)}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-full text-xs font-semibold transition-all select-none text-center cursor-pointer ${
                selectedMonthIndex === idx
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* 3 Cartões Chave (Visão Clara e Direta) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Renda Prevista (Recebimentos Futuros Planejados) */}
          <div className="bg-white rounded-[20px] p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700">
                Entradas do Mês
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
              R$ {formatCurrency(projection.projectedIncome)}
            </div>
            <p className="text-xs text-[#86868B]">
              R$ {formatCurrency(projection.actualIncomeTotal)} realizados + R${" "}
              {formatCurrency(projection.plannedIncomesTotal)} pendentes
            </p>
          </div>

          {/* 2. Total Comprometido */}
          <div className="bg-white rounded-[20px] p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#86868B]">
              Saídas + Compromissos
            </span>
            <div className="text-2xl font-semibold text-rose-600 tracking-tight">
              − R$ {formatCurrency(projection.totalCommitted)}
            </div>
            <p className="text-xs text-[#86868B]">
              R$ {formatCurrency(projection.actualOutflowTotal)} pagos + R${" "}
              {formatCurrency(projection.pendingCommitted)} pendentes
            </p>
          </div>

          {/* 3. Saldo Livre Projetado */}
          <div className="bg-white rounded-[20px] p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#86868B]">
                Saldo Livre Projetado
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  projection.projectedFreeBalance >= 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {freePercentage}% livre
              </span>
            </div>
            <div
              className={`text-2xl font-semibold tracking-tight ${
                projection.projectedFreeBalance >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              R$ {formatCurrency(projection.projectedFreeBalance)}
            </div>
            <p className="text-xs text-[#86868B]">
              {selectedMonthIndex === 0
                ? "Saldo atual menos compromissos ainda pendentes"
                : "Fluxo mensal previsto para aportes e metas"}
            </p>
          </div>
        </div>

        {/* Panorama que conecta realizado, débito futuro e faturas em uma leitura única. */}
        <section
          className="overflow-hidden rounded-[24px] border border-black/[0.05] bg-[#1D1D1F] text-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          data-testid="monthly-macro-summary"
        >
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  Visão macro de {activeMonthObj.short}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">
                Seu mês inteiro, em uma leitura.
              </h2>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-white/65">
                Dos{" "}
                <strong className="text-white">
                  R$ {formatCurrency(projection.totalCommitted)}
                </strong>{" "}
                comprometidos, R$ {formatCurrency(projection.actualOutflowTotal)} já saíram
                do saldo, R$ {formatCurrency(debitCommitments)} ainda sairão no Pix ou
                débito e R$ {formatCurrency(creditCommitments)} estão concentrados em
                faturas.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/80">
                  {Math.round(realizedShare)}% já realizado
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                    projection.projectedFreeBalance >= 0
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-rose-400/15 text-rose-300"
                  }`}
                >
                  R$ {formatCurrency(Math.abs(projection.projectedFreeBalance))}{" "}
                  {projection.projectedFreeBalance >= 0 ? "livres" : "de déficit"}
                </span>
              </div>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/55">
                  Composição dos compromissos
                </span>
                <span className="text-[10px] text-white/45">
                  R$ {formatCurrency(projection.totalCommitted)} no mês
                </span>
              </div>

              <div
                className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/10"
                aria-label="Distribuição dos compromissos do mês"
              >
                {projection.totalCommitted > 0 ? (
                  <>
                    <div
                      className="h-full bg-white"
                      style={{ width: `${realizedShare}%` }}
                      title={`Já saiu do saldo: ${Math.round(realizedShare)}%`}
                    />
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${debitShare}%` }}
                      title={`Pix e débito pendentes: ${Math.round(debitShare)}%`}
                    />
                    <div
                      className="h-full bg-indigo-400"
                      style={{ width: `${creditShare}%` }}
                      title={`Faturas: ${Math.round(creditShare)}%`}
                    />
                  </>
                ) : (
                  <div className="h-full w-full bg-white/10" />
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <MacroMetric
                  dotClass="bg-white"
                  label="Já saiu"
                  value={projection.actualOutflowTotal}
                />
                <MacroMetric
                  dotClass="bg-emerald-400"
                  label="Pix pendente"
                  value={debitCommitments}
                />
                <MacroMetric
                  dotClass="bg-indigo-400"
                  label="Em faturas"
                  value={creditCommitments}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Livro-caixa realizado: a mesma fonte exibida no Dashboard e em Transações. */}
        <MonthlyMovementOverview
          transactions={selectedTransactions}
          cards={cards}
          monthLabel={activeMonthObj.name}
        />

        {/* SEÇÃO 1: RECEBIMENTOS FUTUROS PLANEJADOS */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ArrowDownLeft size={14} strokeWidth={2.5} />
              </div>
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[#1D1D1F]">
                Recebimentos Futuros Planejados (Entram na conta)
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-emerald-700">
                Total: + R$ {formatCurrency(totalIncomesActive)}
              </span>
              <button
                onClick={() => handleOpenModal("income")}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            {plannedIncomes.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-medium text-[#1D1D1F]">
                  Nenhum recebimento futuro planejado ainda.
                </p>
                <p className="text-xs text-[#86868B] max-w-sm mx-auto">
                  Você pode agendar salários extras, 13º, comissões, freelas e rendimentos configurados para o 5º dia útil ou dias fixos.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenModal("income")}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Planejar Primeiro Recebimento</span>
                </button>
              </div>
            ) : (
              plannedIncomes.map((item, idx) => {
                const effectiveDay = getEffectiveDueDay(item, targetYear, targetMonth);
                const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
                const hasInstallments = Boolean(item.installmentsCount && item.installmentsCount > 0);
                const isFinishedInThisMonth = hasInstallments && monthOffset >= (item.installmentsCount || 0);
                const currentInstallmentNum = monthOffset >= 0 ? monthOffset + 1 : 1;
                const isRealized = item.realizedPeriods?.includes(getPeriodKey(targetYear, targetMonth));

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 hover:bg-[#F2F2F7]/50 transition-colors ${
                      idx !== plannedIncomes.length - 1 ? "border-b border-gray-100" : ""
                    } ${isFinishedInThisMonth ? "opacity-60 bg-gray-50/50" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { void handleToggleRecurring(item.id); }}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                          item.active
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-gray-300 bg-white"
                        }`}
                        title={item.active ? "Desativar" : "Ativar"}
                      >
                        {item.active && <Check size={12} strokeWidth={3} />}
                      </button>
                      <div>
                        <h3
                          className={`text-sm font-semibold transition-all ${
                            item.active ? "text-[#1D1D1F]" : "text-gray-400 line-through"
                          }`}
                        >
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {item.recurrenceType === "business_day_5" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              ⚡ 5º Dia Útil (cai dia {effectiveDay} em {activeMonthObj.short})
                            </span>
                          ) : (
                            <span className="text-xs text-[#86868B]">
                              Previsão dia {effectiveDay}
                            </span>
                          )}
                          {isRealized && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              Recebido neste mês
                            </span>
                          )}
                          {hasInstallments && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isFinishedInThisMonth
                                  ? "bg-gray-100 text-gray-500 border-gray-200"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-200/60"
                              }`}
                            >
                              {isFinishedInThisMonth
                                ? `Quitado (${item.installmentsCount}x)`
                                : `Parcela ${currentInstallmentNum} de ${item.installmentsCount}`}
                            </span>
                          )}
                          <span className="text-xs text-[#86868B]">• Destino: {item.account}</span>
                          <span className="text-xs text-[#86868B]">• {item.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-semibold tracking-tight ${
                          isFinishedInThisMonth
                            ? "text-gray-400 line-through text-xs"
                            : item.active
                            ? "text-emerald-600"
                            : "text-gray-400"
                        }`}
                      >
                        {isFinishedInThisMonth
                          ? "Quitado"
                          : `+ R$ ${formatCurrency(item.amount)}`}
                      </span>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="text-gray-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* SEÇÃO 2: CONTAS NO DÉBITO / CONTA PRINCIPAL */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-[#1D1D1F]" />
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                Pagamentos no Débito (Saem direto do saldo)
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#86868B]">
                Total: R$ {formatCurrency(totalDebitExpensesActive)}
              </span>
              <button
                onClick={() => handleOpenModal("expense")}
                className="text-xs text-[#1D1D1F] hover:text-black font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            {plannedDebitExpenses.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-medium text-[#1D1D1F]">
                  Nenhuma despesa fixa de débito cadastrada.
                </p>
                <p className="text-xs text-[#86868B]">
                  Cadastre contas fixas como Aluguel, Luz, Internet ou Condomínio.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenModal("expense")}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#F2F2F7] text-[#1D1D1F] hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Cadastrar Conta Fixa</span>
                </button>
              </div>
            ) : (
              plannedDebitExpenses.map((item, idx) => {
                const effectiveDay = getEffectiveDueDay(item, targetYear, targetMonth);
                const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
                const hasInstallments = Boolean(item.installmentsCount && item.installmentsCount > 0);
                const isFinishedInThisMonth = hasInstallments && monthOffset >= (item.installmentsCount || 0);
                const currentInstallmentNum = monthOffset >= 0 ? monthOffset + 1 : 1;
                const isRealized = item.realizedPeriods?.includes(getPeriodKey(targetYear, targetMonth));

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 hover:bg-[#F2F2F7]/50 transition-colors ${
                      idx !== plannedDebitExpenses.length - 1 ? "border-b border-gray-100" : ""
                    } ${isFinishedInThisMonth ? "opacity-60 bg-gray-50/50" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { void handleToggleRecurring(item.id); }}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                          item.active
                            ? "bg-[#1D1D1F] border-[#1D1D1F] text-white"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {item.active && <Check size={12} strokeWidth={3} />}
                      </button>
                      <div>
                        <h3
                          className={`text-sm font-semibold transition-all ${
                            item.active ? "text-[#1D1D1F]" : "text-gray-400 line-through"
                          }`}
                        >
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {item.recurrenceType === "business_day_5" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                              ⚡ 5º Dia Útil (cai dia {effectiveDay} em {activeMonthObj.short})
                            </span>
                          ) : (
                            <span className="text-xs text-[#86868B]">
                              Débito dia {effectiveDay}
                            </span>
                          )}
                          {isRealized && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              Pago neste mês
                            </span>
                          )}
                          {hasInstallments && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isFinishedInThisMonth
                                  ? "bg-gray-100 text-gray-500 border-gray-200"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-200/60"
                              }`}
                            >
                              {isFinishedInThisMonth
                                ? `Quitado (${item.installmentsCount}x)`
                                : `Parcela ${currentInstallmentNum} de ${item.installmentsCount}`}
                            </span>
                          )}
                          <span className="text-xs text-[#86868B]">• {item.account}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-semibold tracking-tight ${
                          isFinishedInThisMonth
                            ? "text-gray-400 line-through text-xs"
                            : item.active
                            ? "text-[#1D1D1F]"
                            : "text-gray-400"
                        }`}
                      >
                        {isFinishedInThisMonth
                          ? "Quitado"
                          : `R$ ${formatCurrency(item.amount)}`}
                      </span>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="text-gray-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* SEÇÃO 3: ASSINATURAS NO CARTÃO DE CRÉDITO */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-[#1D1D1F]" />
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                No Cartão de Crédito (Entram nas faturas futuras)
              </h2>
            </div>
            <span className="text-xs font-semibold text-[#86868B]">
              Faturas no mês: R${" "}
              {formatCurrency(projection.cardInstallments + projection.recurringCreditTotal)}
            </span>
          </div>

          {projection.cardInstallments > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-[16px] p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-indigo-900">
                  Fatura aberta com vencimento em {activeMonthObj.short}
                </p>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  Compras agrupadas pelo fechamento e vencimento configurados nos cartões
                </p>
              </div>
              <span className="text-sm font-semibold text-indigo-900 whitespace-nowrap">
                R$ {formatCurrency(projection.cardInstallments)}
              </span>
            </div>
          )}

          <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            {plannedCreditExpenses.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-medium text-[#1D1D1F]">
                  Nenhuma assinatura cadastrada no cartão.
                </p>
                <p className="text-xs text-[#86868B]">
                  Cadastre assinaturas como Netflix, Spotify, iCloud ou academia cobradas no cartão.
                </p>
              </div>
            ) : (
              plannedCreditExpenses.map((item, idx) => {
                const effectiveDay = getEffectiveDueDay(item, targetYear, targetMonth);
                const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
                const hasInstallments = Boolean(item.installmentsCount && item.installmentsCount > 0);
                const isFinishedInThisMonth = hasInstallments && monthOffset >= (item.installmentsCount || 0);
                const currentInstallmentNum = monthOffset >= 0 ? monthOffset + 1 : 1;
                const isRealized = item.realizedPeriods?.includes(getPeriodKey(targetYear, targetMonth));

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 hover:bg-[#F2F2F7]/50 transition-colors ${
                      idx !== plannedCreditExpenses.length - 1 ? "border-b border-gray-100" : ""
                    } ${isFinishedInThisMonth ? "opacity-60 bg-gray-50/50" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { void handleToggleRecurring(item.id); }}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                          item.active
                            ? "bg-[#1D1D1F] border-[#1D1D1F] text-white"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {item.active && <Check size={12} strokeWidth={3} />}
                      </button>
                      <div>
                        <h3
                          className={`text-sm font-semibold transition-all ${
                            item.active ? "text-[#1D1D1F]" : "text-gray-400 line-through"
                          }`}
                        >
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {item.recurrenceType === "business_day_5" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                              ⚡ 5º Dia Útil (cai dia {effectiveDay} em {activeMonthObj.short})
                            </span>
                          ) : (
                            <span className="text-xs text-[#86868B]">
                              Cobrado dia {effectiveDay}
                            </span>
                          )}
                          {isRealized && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              Lançado na fatura
                            </span>
                          )}
                          {hasInstallments && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isFinishedInThisMonth
                                  ? "bg-gray-100 text-gray-500 border-gray-200"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-200/60"
                              }`}
                            >
                              {isFinishedInThisMonth
                                ? `Quitado (${item.installmentsCount}x)`
                                : `Parcela ${currentInstallmentNum} de ${item.installmentsCount}`}
                            </span>
                          )}
                          <span className="text-xs text-[#86868B]">• Cartão {item.account}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-semibold tracking-tight ${
                          isFinishedInThisMonth
                            ? "text-gray-400 line-through text-xs"
                            : item.active
                            ? "text-[#1D1D1F]"
                            : "text-gray-400"
                        }`}
                      >
                        {isFinishedInThisMonth
                          ? "Quitado"
                          : `R$ ${formatCurrency(item.amount)}`}
                      </span>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="text-gray-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* MODAL PADRÃO APPLE PAY (SMART ANIMATE APPLE PAY INTERACTION) */}
      {isAddingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            onClick={() => setIsAddingModalOpen(false)}
            className="fixed inset-0 bg-black/45 animate-apple-backdrop"
          />


          <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] z-50 animate-apple-sheet sm:animate-apple-modal max-h-[92vh] overflow-y-auto font-sans">
            {/* Pílula Apple */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

            {/* HEADER OFICIAL APPLE PAY */}
            <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-[#E5E5EA]">
              <div className="flex items-center gap-2">
                <WPayLogo size="lg" />
                <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider ml-1 bg-gray-100 px-2 py-0.5 rounded-md">
                  Previsão Futura
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingModalOpen(false)}
                className="text-[#0071E3] hover:text-[#0077ED] font-normal text-base cursor-pointer active:opacity-60 transition-opacity"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleCreatePlannedItem}>
              {/* TABELA AGRUPADA ESTILO APPLE */}
              <div className="divide-y divide-[#E5E5EA] border-b border-[#E5E5EA] bg-white">
                {/* LINHA: TIPO */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    TIPO
                  </span>
                  <div className="flex-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModalType("income");
                        setNewCategory("Salário / Extra");
                        const checkingAcc =
                          cards.find((card) => card.type === "checking")?.name || "Débito/Pix";
                        setNewAccount(checkingAcc);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        modalType === "income"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <ArrowDownLeft size={13} />
                      <span>Recebimento</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalType("expense");
                        setNewCategory("Moradia & Contas");
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        modalType === "expense"
                          ? "bg-[#1D1D1F] text-white shadow-2xs"
                          : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <ArrowUpRight size={13} />
                      <span>Pagamento</span>
                    </button>
                  </div>
                </div>

                {/* LINHA: IDENTIFICAÇÃO */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    ITEM
                  </span>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={
                      modalType === "income"
                        ? "Ex: Hacktown Ingresso, Salário Quinzena, Freelance..."
                        : "Ex: Aluguel, Academia, Internet, Luz..."
                    }
                    className="flex-1 text-sm font-medium text-[#1D1D1F] placeholder:text-[#86868B] outline-none bg-transparent"
                  />
                </div>


                {/* LINHA: VALOR */}
                <div className="flex items-center px-6 py-4">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    VALOR
                  </span>
                  <div className="flex-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold text-[#1D1D1F]">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="w-full text-2xl sm:text-3xl font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* LINHA: DIA PREVISTO / 5º DIA ÚTIL */}
                <div className="px-6 py-4 space-y-3 bg-[#FAFAFC]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                      DATA / RECORRÊNCIA
                    </span>
                    <span className="text-xs font-semibold text-[#1D1D1F]">
                      Mês Base: {activeMonthObj.short}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Botão 5º Dia Útil Dinâmico */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("business_day_5");
                        setIsCustomDayActive(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceSelection === "business_day_5"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-700 font-bold">⚡ 5º Dia Útil</span>
                        {recurrenceSelection === "business_day_5" && (
                          <Check size={14} className="text-emerald-700" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">
                        Cálculo bancário
                      </span>
                    </button>

                    {/* Dia 5 */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("fixed_day");
                        setFixedDayValue("5");
                        setIsCustomDayActive(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceSelection === "fixed_day" && fixedDayValue === "5" && !isCustomDayActive
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 5</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>

                    {/* Dia 10 */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("fixed_day");
                        setFixedDayValue("10");
                        setIsCustomDayActive(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceSelection === "fixed_day" && fixedDayValue === "10" && !isCustomDayActive
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 10</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>

                    {/* Dia 20 ou Outro */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("fixed_day");
                        setIsCustomDayActive(true);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        isCustomDayActive
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Outro Dia...</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">
                        {isCustomDayActive ? `Dia ${customDayInput}` : "Personalizado"}
                      </span>
                    </button>
                  </div>

                  {/* Campo customizado */}
                  {isCustomDayActive && (
                    <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                      <span className="text-xs text-[#86868B]">Dia do mês (1 a 31):</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={customDayInput}
                        onChange={(e) => setCustomDayInput(e.target.value)}
                        className="w-16 bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-bold text-[#1D1D1F] outline-none"
                      />
                    </div>
                  )}

                  {/* Banner de Feedback em Tempo Real */}
                  <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-xl p-2.5 flex items-start gap-2">
                    <Sparkles size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                      {recurrenceSelection === "business_day_5" ? (
                        <>
                          Configurado para o <strong>5º dia útil</strong>. Em{" "}
                          <strong>{activeMonthObj.short}</strong>, cai no{" "}
                          <strong>Dia {currentMonth5thBusinessDay}</strong>. O sistema recalcula todo mês
                          automaticamente pulando fins de semana e feriados!
                        </>
                      ) : (
                        <>
                          Configurado para o{" "}
                          <strong>Dia {isCustomDayActive ? customDayInput : fixedDayValue}</strong> de todo
                          mês.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* LINHA: DURAÇÃO / PARCELAMENTO */}
                <div className="px-6 py-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                      DURAÇÃO / PARCELAMENTO
                    </span>
                    <span className="text-xs font-semibold text-[#1D1D1F]">
                      {durationMode === "continuous"
                        ? "Recorrente contínuo"
                        : `${installmentsCount} parcelas`}
                    </span>
                  </div>

                  <div className="flex gap-2 bg-[#F2F2F7] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDurationMode("continuous")}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        durationMode === "continuous"
                          ? "bg-white text-[#1D1D1F] shadow-2xs"
                          : "text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      Contínuo (Fixo todo mês)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDurationMode("installments")}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        durationMode === "installments"
                          ? "bg-[#1D1D1F] text-white shadow-2xs"
                          : "text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      Parcelado (X meses)
                    </button>
                  </div>

                  {durationMode === "installments" && (
                    <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                      <span className="text-[10px] text-[#86868B] block font-semibold uppercase tracking-wider">
                        QUANTAS VEZES VAI REPETIR?
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[2, 3, 4, 5, 6, 10, 12].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              setInstallmentsCount(num);
                              setIsCustomInstallment(false);
                            }}
                            className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              installmentsCount === num && !isCustomInstallment
                                ? "bg-[#1D1D1F] border-[#1D1D1F] text-white shadow-xs"
                                : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                            }`}
                          >
                            {num}x
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setIsCustomInstallment(true)}
                          className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isCustomInstallment
                              ? "bg-[#1D1D1F] border-[#1D1D1F] text-white shadow-xs"
                              : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                          }`}
                        >
                          Outro...
                        </button>
                      </div>

                      {isCustomInstallment && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-[#86868B]">Número de parcelas / meses:</span>
                          <input
                            type="number"
                            min="2"
                            max="60"
                            value={customInstallmentInput}
                            onChange={(e) => {
                              setCustomInstallmentInput(e.target.value);
                              const v = parseInt(e.target.value);
                              if (!isNaN(v) && v >= 1) setInstallmentsCount(v);
                            }}
                            className="w-16 bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-bold text-[#1D1D1F] outline-none"
                          />
                        </div>
                      )}

                      <p className="text-[11px] text-[#86868B]">
                        Repetirá por <strong>{installmentsCount} meses</strong> consecutivos a partir de{" "}
                        <strong>{activeMonthObj.short}</strong>.
                      </p>
                    </div>
                  )}
                </div>

                {/* LINHA: CONTA DE DESTINO / MÉTODO */}
                <div className="flex flex-col sm:flex-row sm:items-center px-6 py-3.5 gap-2 sm:gap-0">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    {modalType === "income" ? "DESTINO" : "ONDE COBRA"}
                  </span>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {accountOptions.map((acc) => {
                      const isSelected = newAccount === acc;
                      return (
                        <button
                          key={acc}
                          type="button"
                          onClick={() => setNewAccount(acc)}
                          className={`py-1.5 px-3 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? modalType === "income"
                                ? "bg-emerald-600 text-white border-transparent shadow-2xs"
                                : "bg-[#1D1D1F] text-white border-transparent shadow-2xs"
                              : "bg-[#F2F2F7] text-[#1D1D1F] border-transparent hover:bg-gray-200"
                          }`}
                        >
                          {acc === "Débito/Pix" ? <Building2 size={13} /> : <CreditCard size={13} />}
                          <span>{acc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CONFIRMAÇÃO OFICIAL PADRÃO APPLE PAY */}
              <div className="px-6 py-5 flex flex-col items-center gap-3">
                {/* Face ID Icon */}
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <div className="w-10 h-10 rounded-full border-2 border-[#0071E3] flex items-center justify-center text-[#0071E3] transition-transform active:scale-95">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M7 3H5a2 2 0 0 0-2 2v2" />
                      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M3 17v2a2 2 0 0 0 2 2h2" />
                      <line x1="9" y1="10" x2="9.01" y2="10" />
                      <line x1="15" y1="10" x2="15.01" y2="10" />
                      <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
                    </svg>
                  </div>
                  <span className="text-[11px] text-[#86868B] font-medium tracking-tight">
                    Confirmar Previsão com W Pay
                  </span>
                </div>

                <WPayButton
                  type="submit"
                  disabled={!newTitle.trim() || !newAmount}
                  label={modalType === "income" ? "Salvar Entrada com" : "Salvar Pagamento com"}
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Excluir Planejamento */}
      <AppleConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={async () => {
          if (itemToDelete) {
            try {
              await deleteRecurringItem(itemToDelete.id);
              setItemToDelete(null);
            } catch (error) {
              alert(error instanceof Error ? error.message : "Não foi possível excluir o planejamento.");
            }
          }
        }}
        title="Excluir Planejamento"
        description={`Tem certeza que deseja remover "${itemToDelete?.title}"? Este item deixará de ser projetado nos meses futuros.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />
    </div>
  );
}

function MacroMetric({
  dotClass,
  label,
  value,
}: {
  dotClass: string;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
        <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-white/45">
          {label}
        </span>
      </div>
      <strong className="mt-1 block truncate text-[11px] font-semibold text-white sm:text-xs">
        {"R$ "}
        {value.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </strong>
    </div>
  );
}
