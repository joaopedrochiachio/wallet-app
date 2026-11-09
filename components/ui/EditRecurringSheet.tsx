"use client";

import React, { useState } from "react";
import {
  X,
  CalendarClock,
  Repeat,
  Trash2,
  Save,
  ChevronDown,
} from "lucide-react";
import type { CardItem, RecurringItem } from "@/types";
import { EXPENSE_CATEGORIES } from "./AddTransactionSheet";
import { AppleConfirmModal } from "./AppleConfirmModal";
import { Portal } from "./Portal";
import { AutoConfirmToggle } from "./AutoConfirmToggle";
import {
  sanitizeTextInput,
  validateCurrency,
  validateDayOfMonth,
  validateInstallmentsCount,
} from "@/lib/utils/security";
import { formatAccountLabel } from "@/lib/utils/ledger";

export interface EditRecurringSheetProps {
  isOpen: boolean;
  onClose: () => void;
  item: RecurringItem | null;
  currentPeriodKey?: string;
  currentMonthName?: string;
  accounts: string[];
  cards: CardItem[];
  onSave: (
    id: string,
    updates: Partial<RecurringItem>,
    scope: "all" | "single",
    periodKey?: string
  ) => Promise<void>;
  onDelete?: (
    id: string,
    scope: "all" | "single",
    periodKey?: string
  ) => Promise<void>;
}

export function EditRecurringSheet(props: EditRecurringSheetProps) {
  if (!props.isOpen || !props.item) return null;

  return (
    <EditRecurringModalInner
      {...props}
      item={props.item}
      key={`${props.item.id}-${props.currentPeriodKey || "default"}`}
    />
  );
}

interface InnerProps extends EditRecurringSheetProps {
  item: RecurringItem;
}

function EditRecurringModalInner({
  onClose,
  item,
  currentPeriodKey,
  currentMonthName,
  accounts,
  cards,
  onSave,
  onDelete,
}: InnerProps) {
  const override = currentPeriodKey ? item.overrides?.[currentPeriodKey] : undefined;
  const initialTitle = override?.title || item.title || "";
  const initialAmount = override?.amount ?? item.amount ?? 0;
  const initialAccount = override?.account || item.account || accounts[0] || "NuBank";
  const initialCategory = override?.category || item.category || EXPENSE_CATEGORIES[0];
  const initialDueDay = override?.dueDay || item.dueDay || 10;
  const initialDurationMode: "continuous" | "installments" =
    !item.installmentsCount || item.installmentsCount <= 0 ? "continuous" : "installments";
  const initialInstallments =
    !item.installmentsCount || item.installmentsCount <= 0
      ? "3"
      : String(item.installmentsCount);

  const [title, setTitle] = useState(initialTitle);
  const [amountInput, setAmountInput] = useState(() =>
    initialAmount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
  const [account, setAccount] = useState(initialAccount);
  const [category, setCategory] = useState(initialCategory);
  const [dueDay, setDueDay] = useState(String(initialDueDay));
  const [autoConfirm, setAutoConfirm] = useState(override?.autoConfirm ?? item.autoConfirm ?? false);
  const [durationMode, setDurationMode] = useState<"continuous" | "installments">(initialDurationMode);
  const [installmentsInput, setInstallmentsInput] = useState(initialInstallments);
  const [scope, setScope] = useState<"all" | "single">("all");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, "");
    if (!rawDigits) {
      setAmountInput("");
      return;
    }
    const val = parseInt(rawDigits, 10) / 100;
    setAmountInput(
      val.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const sanitizedTitle = sanitizeTextInput(title, 80);
    if (!sanitizedTitle) {
      setErrorMessage("Informe uma descrição válida para a compra.");
      return;
    }

    const amountValidation = validateCurrency(amountInput);
    if (!amountValidation.isValid) {
      setErrorMessage(amountValidation.error || "Informe um valor monetário válido.");
      return;
    }

    const dayValidation = validateDayOfMonth(dueDay);
    const safeDueDay = dayValidation.isValid ? dayValidation.value : 10;

    const safeInstallments =
      durationMode === "installments"
        ? validateInstallmentsCount(installmentsInput).value
        : undefined;

    const selectedCard = cards.find(
      (c) => c.name === account || c.id === account
    );

    const updates: Partial<RecurringItem> = {
      title: sanitizedTitle,
      amount: amountValidation.value,
      account,
      cardId: selectedCard?.id || null,
      category,
      dueDay: safeDueDay,
      installmentsCount: safeInstallments,
      autoConfirm,
    };

    setIsSaving(true);
    try {
      await onSave(item.id, updates, scope, currentPeriodKey);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(item.id, scope, currentPeriodKey);
      setIsDeleteModalOpen(false);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao excluir programação.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop com Blur Suave */}
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        />

        {/* Modal / Bottom Sheet */}
        <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[28px] shadow-2xl z-50 flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
          {/* Top Bar Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-black/[0.05] flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 shadow-2xs">
                <CalendarClock size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-semibold text-[#1D1D1F] tracking-tight truncate">
                    Editar Compra Programada
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 shrink-0">
                    Programada
                  </span>
                </div>
                <p className="text-xs text-[#86868B] truncate mt-0.5">
                  Atualize valores, dia de cobrança ou condições da fatura
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in fade-in">
                {errorMessage}
              </div>
            )}

            {/* Descrição e Valor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#86868B]">
                  Descrição / Título
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: iCloud, Academia, Notebook..."
                  className="w-full px-3.5 py-2.5 bg-[#F2F2F7] focus:bg-white text-[#1D1D1F] rounded-xl border border-transparent focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-sm font-medium outline-none transition-all placeholder:text-[#86868B]/60"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#86868B]">
                  Valor da Cobrança
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#86868B]">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amountInput}
                    onChange={handleAmountChange}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#F2F2F7] focus:bg-white text-[#1D1D1F] rounded-xl border border-transparent focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-sm font-semibold font-mono tabular-nums outline-none transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Cartão / Conta de Cobrança e Categoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#86868B]">
                  Cartão ou Conta
                </label>
                <div className="relative">
                  <select
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-[#F2F2F7] focus:bg-white text-[#1D1D1F] rounded-xl border border-transparent focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-xs font-medium outline-none transition-all pr-8 cursor-pointer"
                  >
                    {cards
                      .filter((c) => c.type === "credit")
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          💳 {c.name} (Crédito)
                        </option>
                      ))}
                    {accounts
                      .filter((acc) => !cards.some((c) => c.type === "credit" && c.name === acc))
                      .map((acc) => (
                        <option key={acc} value={acc}>
                          🏛️ {formatAccountLabel(acc)}
                        </option>
                      ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#86868B]">
                  Categoria
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-[#F2F2F7] focus:bg-white text-[#1D1D1F] rounded-xl border border-transparent focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-xs font-medium outline-none transition-all pr-8 cursor-pointer"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {cards.find((card) => card.name === account || card.id === account)?.type !== "credit" && <AutoConfirmToggle checked={autoConfirm} onChange={setAutoConfirm} isIncome={item.type === "income"} />}

            {/* Dia de Vencimento / Cobrança e Tipo de Duração */}
            <div className="space-y-3 p-4 rounded-2xl bg-[#F8F8FA] border border-black/[0.04]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#1D1D1F]">
                    Regra de Repetição & Cobrança
                  </h4>
                  <p className="text-[11px] text-[#86868B]">
                    Defina o dia da cobrança e se a compra é contínua ou parcelada
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-medium text-[#86868B]">
                    Dia do Mês:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-14 px-2 py-1 bg-white text-[#1D1D1F] rounded-lg border border-black/[0.08] text-xs font-semibold font-mono tabular-nums text-center outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Segmented Control de Duração */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDurationMode("continuous")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    durationMode === "continuous"
                      ? "bg-white border-violet-500/50 shadow-xs ring-1 ring-violet-500/20"
                      : "bg-[#F2F2F7] border-transparent hover:bg-white/60 text-[#86868B]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs text-[#1D1D1F]">
                    <Repeat size={13} className="text-violet-600" />
                    <span>Recorrente Contínua</span>
                  </div>
                  <p className="text-[10px] text-[#86868B] mt-1">
                    Sem limite de parcelas (ex: Netflix, Spotify, iCloud)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDurationMode("installments")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    durationMode === "installments"
                      ? "bg-white border-violet-500/50 shadow-xs ring-1 ring-violet-500/20"
                      : "bg-[#F2F2F7] border-transparent hover:bg-white/60 text-[#86868B]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs text-[#1D1D1F]">
                    <CalendarClock size={13} className="text-violet-600" />
                    <span>Compra Parcelada</span>
                  </div>
                  <p className="text-[10px] text-[#86868B] mt-1">
                    Número fixo de parcelas mensais
                  </p>
                </button>
              </div>

              {/* Campo de quantidade de parcelas se for parcelado */}
              {durationMode === "installments" && (
                <div className="pt-2 flex items-center justify-between bg-white p-3 rounded-xl border border-black/[0.04]">
                  <span className="text-xs text-[#1D1D1F] font-medium">
                    Quantidade total de parcelas:
                  </span>
                  <div className="flex items-center gap-2">
                    {[2, 3, 6, 10, 12].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setInstallmentsInput(String(num))}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                          installmentsInput === String(num)
                            ? "bg-violet-600 text-white"
                            : "bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F]"
                        }`}
                      >
                        {num}x
                      </button>
                    ))}
                    <input
                      type="number"
                      min={2}
                      max={360}
                      value={installmentsInput}
                      onChange={(e) => setInstallmentsInput(e.target.value)}
                      className="w-14 px-2 py-1 bg-[#F2F2F7] text-[#1D1D1F] rounded-lg border border-transparent focus:border-violet-500 text-xs font-semibold font-mono tabular-nums text-center outline-none"
                      title="Outro número de parcelas"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Escopo da Alteração (quando aplicável) */}
            {currentPeriodKey && (
              <div className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100 space-y-2.5">
                <div className="flex items-center gap-2 text-violet-900 font-semibold text-xs">
                  <CalendarClock size={14} className="text-violet-700" />
                  <span>Escopo da Atualização</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      scope === "all"
                        ? "bg-white border-violet-400 shadow-2xs"
                        : "bg-white/60 border-transparent hover:bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === "all"}
                      onChange={() => setScope("all")}
                      className="mt-0.5 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="text-xs">
                      <strong className="text-[#1D1D1F] block">
                        Esta fatura e meses à frente ({currentMonthName || "deste mês"} em diante)
                      </strong>
                      <span className="text-[11px] text-[#86868B] leading-tight block mt-0.5">
                        Atualiza para este mês e todos os meses seguintes, preservando meses anteriores.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      scope === "single"
                        ? "bg-white border-violet-400 shadow-2xs"
                        : "bg-white/60 border-transparent hover:bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === "single"}
                      onChange={() => setScope("single")}
                      className="mt-0.5 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="text-xs">
                      <strong className="text-[#1D1D1F] block">
                        Apenas nesta fatura ({currentMonthName || "deste mês"})
                      </strong>
                      <span className="text-[11px] text-[#86868B] leading-tight block mt-0.5">
                        Aplica alteração pontual sem modificar as outras faturas.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              {onDelete && (
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Excluir Programação</span>
                </button>
              )}

              <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/2 sm:w-auto px-4 py-2.5 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-1/2 sm:w-auto px-5 py-2.5 bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{isSaving ? "Salvando..." : "Salvar Alterações"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Confirmação para Excluir Programação */}
      <AppleConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Excluir Compra Programada"
        description={
          scope === "single"
            ? `Deseja remover a ocorrência desta compra na fatura de ${currentMonthName || "deste mês"}? As outras faturas continuarão programadas.`
            : `Deseja cancelar todas as faturas futuras de "${title || item.title}"? Esta ação removerá a programação do cartão.`
        }
        confirmLabel={scope === "single" ? "Remover desta Fatura" : "Excluir Programação"}
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />
    </Portal>
  );
}
