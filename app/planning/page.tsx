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
import { formatAccountLabel, getLedgerEntryDate } from "@/lib/utils/ledger";
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
  const [isAddingMenuOpen, setIsAddingMenuOpen] = useState(false);
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

  // Duração: uma vez, por um número de meses ou contínuo.
  const [durationMode, setDurationMode] = useState<"one-time" | "continuous" | "installments">("continuous");
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

  const isScheduledForSelectedMonth = (item: RecurringItem) => {
    const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
    return monthOffset >= 0 && (
      !item.installmentsCount ||
      item.installmentsCount <= 0 ||
      monthOffset < item.installmentsCount
    );
  };

  const visiblePlannedIncomes = plannedIncomes.filter(isScheduledForSelectedMonth);
  const visiblePlannedDebitExpenses = plannedDebitExpenses.filter(isScheduledForSelectedMonth);
  const visiblePlannedCreditExpenses = plannedCreditExpenses.filter(isScheduledForSelectedMonth);

  const totalIncomesActive = plannedIncomes
    .filter(isActiveInSelectedMonth)
    .reduce((acc, r) => acc + r.amount, 0);

  const totalDebitExpensesActive = plannedDebitExpenses
    .filter(isActiveInSelectedMonth)
    .reduce((acc, r) => acc + r.amount, 0);

  const totalAvailable = projection.openingBalance + projection.projectedIncome;
  const freePercentage =
    totalAvailable > 0
      ? Math.max(
          0,
          Math.round((projection.projectedFreeBalance / totalAvailable) * 100)
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

  // Informações de cartões de crédito
  const creditCards = cards.filter((c) => c.type === "credit");
  const primaryCreditCard = creditCards[0];
  const creditCardNameText =
    creditCards.length > 0
      ? creditCards.length === 1
        ? creditCards[0].name
        : creditCards.map((c) => c.name).join(", ")
      : "Nubank";
  const creditCardDueDayText = primaryCreditCard?.dueDay
    ? `dia ${primaryCreditCard.dueDay}`
    : "dia 15";

  const handleOpenModal = (mode: "income" | "expense" | "expense-debit" | "expense-credit") => {
    const isIncome = mode === "income";
    const isCredit = mode === "expense-credit";

    setModalType(isIncome ? "income" : "expense");
    setNewCategory(isIncome ? "Salário / Extra" : isCredit ? "Assinaturas & Lazer" : "Moradia & Contas");

    const checkingAcc =
      cards.find((card) => card.type === "checking")?.name ||
      accountOptions.find((acc) => acc.includes("Débito") || acc.includes("Pix")) ||
      "Débito/Pix";

    const creditAcc =
      cards.find((card) => card.type === "credit")?.name ||
      accountOptions.find((acc) => !acc.includes("Débito") && !acc.includes("Pix")) ||
      "Cartão de Crédito";

    setNewAccount(isIncome ? checkingAcc : isCredit ? creditAcc : checkingAcc);
    setRecurrenceSelection(isIncome ? "business_day_5" : "fixed_day");
    setIsCustomDayActive(false);
    setDurationMode(isIncome ? "continuous" : isCredit ? "continuous" : "one-time");
    setInstallmentsCount(3);
    setIsCustomInstallment(false);
    setIsAddingMenuOpen(false);
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
        installmentsCount:
          durationMode === "one-time"
            ? 1
            : durationMode === "installments"
              ? installmentsCount
              : undefined,
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
    <div className="min-h-full bg-[#F2F2F7] p-6 md:p-10 text-[#1D1D1F] font-sans space-y-7 animate-in fade-in duration-500 relative">
      {/* 1. CABEÇALHO */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Visão futura & previsibilidade
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Planejamento Mensal
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          {/* Indicador de Saldo em Conta / Saldo Vindo do Mês Anterior */}
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-black/[0.04] shadow-2xs">
            <span className="text-xs text-[#86868B]">
              {selectedMonthIndex === 0
                ? "Saldo em conta:"
                : `Saldo de ${planningMonths[selectedMonthIndex - 1]?.short}:`}
            </span>
            <span className="text-xs font-semibold text-[#1D1D1F]">
              R$ {formatCurrency(projection.openingBalance)}
            </span>
          </div>

          {/* Ação Principal: + Adicionar com Menu Contextual Elegante */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddingMenuOpen((prev) => !prev)}
              className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-xs cursor-pointer select-none"
            >
              <Plus strokeWidth={2} size={15} />
              <span>Adicionar</span>
            </button>

          {isAddingMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsAddingMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-60 bg-white/95 backdrop-blur-xl border border-black/[0.08] rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans">
                <button
                  type="button"
                  onClick={() => handleOpenModal("income")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F2F2F7] transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <ArrowDownLeft size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#1D1D1F]">
                      Recebimento futuro
                    </span>
                    <span className="block text-[10px] text-[#86868B]">
                      Entrada prevista no saldo
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenModal("expense-debit")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F2F2F7] transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
                    <Building2 size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#1D1D1F]">
                      Conta planejada
                    </span>
                    <span className="block text-[10px] text-[#86868B]">
                      Desconto direto da conta
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenModal("expense-credit")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F2F2F7] transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                    <CreditCard size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#1D1D1F]">
                      Compra no cartão
                    </span>
                    <span className="block text-[10px] text-[#86868B]">
                      Entra na fatura futura
                    </span>
                  </div>
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navegação entre Meses (Controle Segmentado Suave Estilo iOS) */}
        <div className="bg-[#E5E5EA]/60 p-1 rounded-full flex items-center gap-1 overflow-x-auto border border-black/5 scrollbar-none">
          {planningMonths.map((m, idx) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setSelectedMonthIndex(idx)}
              className={`flex-1 min-w-[100px] py-1.5 px-3 rounded-full text-xs font-semibold transition-all select-none text-center cursor-pointer ${
                selectedMonthIndex === idx
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* 2. RESUMO FINANCEIRO PRINCIPAL (Superfície Única Apple com 3 Métricas Essenciais) */}
        <div className="bg-white rounded-[24px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_1px_6px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* 1. Entradas previstas */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#86868B] tracking-tight">
                Entradas previstas
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                R$ {formatCurrency(projection.projectedIncome)}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                R$ {formatCurrency(projection.actualIncomeTotal)} recebidos · R${" "}
                {formatCurrency(projection.plannedIncomesTotal)} pendentes
              </p>
            </div>

            {/* 2. Compromissos */}
            <div className="pt-5 sm:pt-0 sm:pl-8 space-y-1">
              <span className="text-xs font-medium text-[#86868B] tracking-tight">
                Compromissos
              </span>
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                R$ {formatCurrency(projection.totalCommitted)}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                R$ {formatCurrency(projection.actualOutflowTotal)} pagos · R${" "}
                {formatCurrency(projection.pendingCommitted)} pendentes
              </p>
            </div>

            {/* 3. Saldo livre projetado (Destaque Principal) */}
            <div className="pt-5 sm:pt-0 sm:pl-8 space-y-1">
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                Saldo livre projetado
              </span>
              <div
                className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                  projection.projectedFreeBalance >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                R$ {formatCurrency(projection.projectedFreeBalance)}
              </div>
              <p className="text-xs text-[#86868B] pt-0.5">
                {selectedMonthIndex === 0
                  ? `Considera R$ ${formatCurrency(projection.openingBalance)} em conta · ${freePercentage}% livre`
                  : `Inclui R$ ${formatCurrency(projection.openingBalance)} de ${planningMonths[selectedMonthIndex - 1]?.name}`}
              </p>
            </div>
          </div>
        </div>

        {/* 3. COMPOSIÇÃO DOS COMPROMISSOS (Área Simples e Silenciosa) */}
        <section
          data-testid="monthly-macro-summary"
          className="bg-white rounded-[22px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_1px_4px_rgba(0,0,0,0.02)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
              Composição dos compromissos
            </h2>
            <span className="text-xs text-[#86868B]">
              Total: R$ {formatCurrency(projection.totalCommitted)}
            </span>
          </div>

          {/* Três métricas limpas */}
          <div className="grid grid-cols-3 gap-4 pt-1">
            <div>
              <span className="text-xs text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8E8E93]" />
                Saiu
              </span>
              <div className="text-base sm:text-lg font-semibold text-[#1D1D1F] mt-0.5">
                R$ {formatCurrency(projection.actualOutflowTotal)}
              </div>
            </div>

            <div>
              <span className="text-xs text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D1D1F]" />
                Sai da conta
              </span>
              <div className="text-base sm:text-lg font-semibold text-[#1D1D1F] mt-0.5">
                R$ {formatCurrency(debitCommitments)}
              </div>
            </div>

            <div>
              <span className="text-xs text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                Cartão / faturas
              </span>
              <div className="text-base sm:text-lg font-semibold text-[#1D1D1F] mt-0.5">
                R$ {formatCurrency(creditCommitments)}
              </div>
            </div>
          </div>

          {/* Barra Horizontal de Composição */}
          <div
            className="h-2 rounded-full bg-[#F2F2F7] overflow-hidden flex gap-0.5"
            aria-label="Distribuição dos compromissos"
          >
            {projection.totalCommitted > 0 ? (
              <>
                <div
                  className="h-full bg-[#8E8E93] transition-all duration-500"
                  style={{ width: `${realizedShare}%` }}
                  title={`Saiu: R$ ${formatCurrency(projection.actualOutflowTotal)}`}
                />
                <div
                  className="h-full bg-[#1D1D1F] transition-all duration-500"
                  style={{ width: `${debitShare}%` }}
                  title={`Sai da conta: R$ ${formatCurrency(debitCommitments)}`}
                />
                <div
                  className="h-full bg-[#6366F1] transition-all duration-500"
                  style={{ width: `${creditShare}%` }}
                  title={`Faturas: R$ ${formatCurrency(creditCommitments)}`}
                />
              </>
            ) : (
              <div className="h-full w-full bg-gray-200/50" />
            )}
          </div>

          {/* Pequeno Insight Complementar */}
          <p className="text-xs text-[#86868B] leading-relaxed pt-0.5">
            R$ {formatCurrency(debitCommitments)} ainda sairão da sua conta e R${" "}
            {formatCurrency(creditCommitments)} estão concentrados nas faturas.
          </p>
        </section>

        {/* 4. PLANEJAMENTO DO MÊS */}
        <section className="space-y-6 pt-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#86868B]">
              Planejamento
            </h2>
          </div>

          {/* 4.1 Recebimentos Previstos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                Recebimentos previstos
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-emerald-600">
                  + R$ {formatCurrency(totalIncomesActive)}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenModal("income")}
                  className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[22px] border border-black/[0.04] shadow-[0_1px_4px_rgba(0,0,0,0.02)] overflow-hidden divide-y divide-gray-100">
              {visiblePlannedIncomes.length === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <p className="text-sm font-medium text-[#1D1D1F]">
                    Nenhum recebimento previsto em {activeMonthObj.name}
                  </p>
                  <p className="text-xs text-[#86868B]">
                    Agende salários, comissões ou rendimentos previstos.
                  </p>
                </div>
              ) : (
                visiblePlannedIncomes.map((item) => {
                  const effectiveDay = getEffectiveDueDay(item, targetYear, targetMonth);
                  const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
                  const hasInstallments = Boolean(item.installmentsCount && item.installmentsCount > 1);
                  const isFinishedInThisMonth = hasInstallments && monthOffset >= (item.installmentsCount || 0);
                  const currentInstallmentNum = monthOffset >= 0 ? monthOffset + 1 : 1;
                  const dateDescription = item.recurrenceType === "business_day_5"
                    ? `5º dia útil (dia ${effectiveDay})`
                    : `Previsão dia ${effectiveDay}`;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-[#F9F9FB] transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => { void handleToggleRecurring(item.id); }}
                          className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                            item.active
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-gray-300 bg-white"
                          }`}
                          title={item.active ? "Desativar" : "Ativar"}
                        >
                          {item.active && <Check size={11} strokeWidth={3} />}
                        </button>
                        <div className="min-w-0">
                          <h4
                            className={`text-sm font-medium truncate ${
                              item.active ? "text-[#1D1D1F]" : "text-gray-400 line-through"
                            }`}
                          >
                            {item.title}
                          </h4>
                          <p className="text-xs text-[#86868B] truncate mt-0.5">
                            {dateDescription} · {formatAccountLabel(item.account)} · {item.category}
                            {hasInstallments && ` · Parcela ${currentInstallmentNum} de ${item.installmentsCount}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-sm font-semibold tracking-tight ${
                            isFinishedInThisMonth
                              ? "text-gray-400 line-through text-xs"
                              : item.active
                              ? "text-emerald-600"
                              : "text-gray-400"
                          }`}
                        >
                          {isFinishedInThisMonth ? "Quitado" : `+ R$ ${formatCurrency(item.amount)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="text-gray-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4.2 Saídas da Conta (Débito Direto) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  Saídas da conta
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Valores planejados que serão descontados diretamente do seu saldo.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-[#1D1D1F]">
                  R$ {formatCurrency(totalDebitExpensesActive)}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenModal("expense-debit")}
                  className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[22px] border border-black/[0.04] shadow-[0_1px_4px_rgba(0,0,0,0.02)] overflow-hidden divide-y divide-gray-100">
              {visiblePlannedDebitExpenses.length === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <p className="text-sm font-medium text-[#1D1D1F]">
                    Nenhuma saída da conta planejada em {activeMonthObj.name}
                  </p>
                  <p className="text-xs text-[#86868B]">
                    Cadastre contas fixas como Aluguel, Luz, Internet ou Condomínio.
                  </p>
                </div>
              ) : (
                visiblePlannedDebitExpenses.map((item) => {
                  const effectiveDay = getEffectiveDueDay(item, targetYear, targetMonth);
                  const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
                  const hasInstallments = Boolean(item.installmentsCount && item.installmentsCount > 1);
                  const isFinishedInThisMonth = hasInstallments && monthOffset >= (item.installmentsCount || 0);
                  const currentInstallmentNum = monthOffset >= 0 ? monthOffset + 1 : 1;
                  const dateDescription = item.recurrenceType === "business_day_5"
                    ? `5º dia útil (dia ${effectiveDay})`
                    : `Dia ${effectiveDay}`;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-[#F9F9FB] transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => { void handleToggleRecurring(item.id); }}
                          className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                            item.active
                              ? "bg-[#1D1D1F] border-[#1D1D1F] text-white"
                              : "border-gray-300 bg-white"
                          }`}
                          title={item.active ? "Desativar" : "Ativar"}
                        >
                          {item.active && <Check size={11} strokeWidth={3} />}
                        </button>
                        <div className="min-w-0">
                          <h4
                            className={`text-sm font-medium truncate ${
                              item.active ? "text-[#1D1D1F]" : "text-gray-400 line-through"
                            }`}
                          >
                            {item.title}
                          </h4>
                          <p className="text-xs text-[#86868B] truncate mt-0.5">
                            {dateDescription} · {formatAccountLabel(item.account)}
                            {hasInstallments && ` · Parcela ${currentInstallmentNum} de ${item.installmentsCount}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-sm font-semibold tracking-tight ${
                            isFinishedInThisMonth
                              ? "text-gray-400 line-through text-xs"
                              : item.active
                              ? "text-[#1D1D1F]"
                              : "text-gray-400"
                          }`}
                        >
                          {isFinishedInThisMonth ? "Quitado" : `R$ ${formatCurrency(item.amount)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="text-gray-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4.3 Cartão de Crédito (Tonalidade Muito Sutil Diferenciada Estilo Apple Wallet) */}
          <div className="bg-[#F8F8FA] rounded-[22px] p-5 sm:p-6 border border-black/[0.04] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Cartão de crédito
                </span>
                <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight mt-0.5">
                  Fatura de {activeMonthObj.name}
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Vencimento {creditCardDueDayText} · Cartão {creditCardNameText}
                </p>
              </div>

              <div className="flex sm:flex-col sm:items-end justify-between items-center shrink-0">
                <span className="text-xl font-semibold text-[#1D1D1F] tracking-tight">
                  R$ {formatCurrency(creditCommitments)}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenModal("expense-credit")}
                  className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] cursor-pointer mt-0.5"
                >
                  Adicionar compra
                </button>
              </div>
            </div>

            {/* Lista de Compras do Cartão */}
            <div className="bg-white rounded-[18px] border border-black/[0.04] overflow-hidden divide-y divide-gray-100">
              {visiblePlannedCreditExpenses.length === 0 && projection.cardInstallments === 0 ? (
                <div className="p-7 text-center space-y-1">
                  <p className="text-xs font-medium text-[#1D1D1F]">
                    Nenhuma assinatura ou compra cadastrada no cartão para {activeMonthObj.name}.
                  </p>
                  <p className="text-[11px] text-[#86868B]">
                    Assinaturas como iCloud, Netflix ou compras parceladas entrarão na fatura deste mês.
                  </p>
                </div>
              ) : (
                <>
                  {visiblePlannedCreditExpenses.map((item) => {
                    const effectiveDay = getEffectiveDueDay(item, targetYear, targetMonth);
                    const monthOffset = getRecurringMonthOffset(item, targetYear, targetMonth);
                    const hasInstallments = Boolean(item.installmentsCount && item.installmentsCount > 1);
                    const isFinishedInThisMonth = hasInstallments && monthOffset >= (item.installmentsCount || 0);
                    const currentInstallmentNum = monthOffset >= 0 ? monthOffset + 1 : 1;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 p-4 hover:bg-[#F9F9FB] transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => { void handleToggleRecurring(item.id); }}
                            className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                              item.active
                                ? "bg-[#1D1D1F] border-[#1D1D1F] text-white"
                                : "border-gray-300 bg-white"
                            }`}
                            title={item.active ? "Desativar" : "Ativar"}
                          >
                            {item.active && <Check size={11} strokeWidth={3} />}
                          </button>
                          <div className="min-w-0">
                            <h4
                              className={`text-sm font-medium truncate ${
                                item.active ? "text-[#1D1D1F]" : "text-gray-400 line-through"
                              }`}
                            >
                              {item.title}
                            </h4>
                            <p className="text-xs text-[#86868B] truncate mt-0.5">
                              Cobrado dia {effectiveDay} · {formatAccountLabel(item.account)}
                              {hasInstallments && ` · Parcela ${currentInstallmentNum} de ${item.installmentsCount}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-sm font-semibold tracking-tight ${
                              isFinishedInThisMonth
                                ? "text-gray-400 line-through text-xs"
                                : item.active
                                ? "text-[#1D1D1F]"
                                : "text-gray-400"
                            }`}
                          >
                            {isFinishedInThisMonth ? "Quitado" : `R$ ${formatCurrency(item.amount)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="text-gray-300 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {projection.cardInstallments > 0 && (
                    <div className="flex items-center justify-between gap-4 p-4 bg-gray-50/40">
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-[#1D1D1F] truncate">
                          Compras faturadas no cartão
                        </h4>
                        <p className="text-xs text-[#86868B] truncate mt-0.5">
                          Lançamentos e parcelas de compras com vencimento em {activeMonthObj.short}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tracking-tight text-[#1D1D1F] shrink-0">
                        R$ {formatCurrency(projection.cardInstallments)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* 5. MOVIMENTAÇÕES REALIZADAS (O que já aconteceu) */}
        <MonthlyMovementOverview
          transactions={selectedTransactions}
          cards={cards}
          monthLabel={activeMonthObj.name}
        />
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

                    {/* Dia 20 */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("fixed_day");
                        setFixedDayValue("20");
                        setIsCustomDayActive(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceSelection === "fixed_day" && fixedDayValue === "20" && !isCustomDayActive
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 20</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>
                  </div>

                  {/* Dia Personalizado */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceSelection("fixed_day");
                        setIsCustomDayActive(true);
                      }}
                      className={`text-xs font-semibold hover:underline cursor-pointer ${
                        isCustomDayActive ? "text-[#1D1D1F] font-bold" : "text-[#86868B]"
                      }`}
                    >
                      Outro dia fixo do mês:
                    </button>
                    {isCustomDayActive && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#86868B]">Dia</span>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={customDayInput}
                          onChange={(e) => setCustomDayInput(e.target.value)}
                          className="w-14 h-7 text-center rounded-lg border border-black/10 bg-white font-semibold text-xs outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* DURAÇÃO: Uma vez / Parcelado / Contínuo */}
                <div className="px-6 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                      DURAÇÃO DO COMPROMISSO
                    </span>
                    <span className="text-[11px] text-[#86868B]">
                      {durationMode === "one-time"
                        ? "Apenas neste mês"
                        : durationMode === "installments"
                          ? `${installmentsCount} parcelas mensais`
                          : "Recorrente contínuo"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDurationMode("one-time")}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        durationMode === "one-time"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Apenas 1 mês</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Pagamento único</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDurationMode("installments");
                        if (!isCustomInstallment) {
                          setInstallmentsCount(3);
                        }
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        durationMode === "installments"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Parcelado</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Duração definida</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDurationMode("continuous")}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        durationMode === "continuous"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Contínuo</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Sem prazo final</span>
                    </button>
                  </div>

                  {durationMode === "installments" && (
                    <div className="rounded-xl border border-black/5 bg-[#F9F9FB] p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#86868B]">
                        <span>Número de meses:</span>
                        <span className="font-semibold text-[#1D1D1F]">
                          {installmentsCount} parcelas
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[2, 3, 6, 12].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => {
                              setIsCustomInstallment(false);
                              setInstallmentsCount(count);
                            }}
                            className={`h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              !isCustomInstallment && installmentsCount === count
                                ? "bg-[#1D1D1F] text-white"
                                : "bg-white border border-black/5 text-[#1D1D1F] hover:bg-gray-100"
                            }`}
                          >
                            {count}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* LINHA: CONTA DE DESTINO / CARTÃO */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    {modalType === "income" ? "DESTINO" : "FORMA"}
                  </span>
                  <select
                    value={newAccount}
                    onChange={(e) => setNewAccount(e.target.value)}
                    className="flex-1 text-xs font-medium text-[#1D1D1F] bg-transparent outline-none cursor-pointer"
                  >
                    {accountOptions.map((acc) => (
                      <option key={acc} value={acc}>
                        {formatAccountLabel(acc)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* LINHA: CATEGORIA */}
                <div className="flex items-center px-6 py-3.5">
                  <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                    CATEGORIA
                  </span>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex-1 text-xs font-medium text-[#1D1D1F] bg-transparent outline-none cursor-pointer"
                  >
                    {modalType === "income" ? (
                      <>
                        <option value="Salário / Extra">Salário / Renda Principal</option>
                        <option value="13º / Bônus">13º / Bônus / PLR</option>
                        <option value="Freelance / Extra">Freelance / Extra</option>
                        <option value="Rendimentos">Rendimentos de Investimento</option>
                        <option value="Reembolso">Reembolso / Outros</option>
                      </>
                    ) : (
                      <>
                        <option value="Moradia & Contas">Moradia & Contas Fixas</option>
                        <option value="Assinaturas & Lazer">Assinaturas & Lazer</option>
                        <option value="Alimentação">Alimentação & Supermercado</option>
                        <option value="Transporte">Transporte & Mobilidade</option>
                        <option value="Saúde & Bem-estar">Saúde & Bem-estar</option>
                        <option value="Educação">Educação</option>
                        <option value="Outros">Outros Compromissos</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* BOTÃO CONFIRMAR APPLE PAY */}
              <div className="p-6">
                <WPayButton
                  type="submit"
                  label="Confirmar Planejamento"
                  theme="black"
                  disabled={!newTitle.trim() || !newAmount.trim()}
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO DE EXCLUSÃO APPLE HIG */}
      <AppleConfirmModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={async () => {
          if (itemToDelete) {
            try {
              await deleteRecurringItem(itemToDelete.id);
            } catch (error) {
              alert(error instanceof Error ? error.message : "Não foi possível excluir o planejamento.");
            } finally {
              setItemToDelete(null);
            }
          }
        }}
        title="Excluir Planejamento"
        description={`Tem certeza que deseja remover "${itemToDelete?.title || ""}" dos seus compromissos futuros?`}
        confirmLabel="Excluir"
        cancelLabel="Manter"
        variant="danger"
        iconType="trash"
      />
    </div>
  );
}
