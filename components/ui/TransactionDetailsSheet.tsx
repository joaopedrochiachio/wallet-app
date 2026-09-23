"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  CreditCard,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { CardItem, TransactionItem } from "@/context/WalletContext";
import type { TransactionUpdateInput } from "@/lib/services/transactionsService";
import { formatAccountLabel, matchesLedgerCard } from "@/lib/utils/ledger";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./AddTransactionSheet";
import { AppleConfirmModal } from "./AppleConfirmModal";
import { sanitizeTextInput, validateCurrency } from "@/lib/utils/security";

interface TransactionDetailsSheetProps {
  transaction: TransactionItem;
  accounts: string[];
  cards: CardItem[];
  initialEditing?: boolean;
  onClose: () => void;
  onSave: (id: string, updates: TransactionUpdateInput) => Promise<void>;
  onDelete?: (transaction: TransactionItem) => void;
}

function toDateInput(transaction: TransactionItem): string {
  const rawDate = transaction.occurredAt || transaction.createdAt;
  const date = rawDate ? new Date(rawDate) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TransactionDetailsSheet({
  transaction,
  accounts,
  cards,
  initialEditing = false,
  onClose,
  onSave,
  onDelete,
}: TransactionDetailsSheetProps) {
  const [title, setTitle] = useState(transaction.title);
  const [amountInput, setAmountInput] = useState(
    transaction.amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
  const [type, setType] = useState<TransactionItem["type"]>(transaction.type);
  const [category, setCategory] = useState(transaction.category);
  const [account, setAccount] = useState(transaction.account);
  const [dateInput, setDateInput] = useState(toDateInput(transaction));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<TransactionUpdateInput | null>(null);

  const canEdit = transaction.kind === "regular" || !transaction.kind;
  const fieldsAreEditable = canEdit && isEditing;
  const categories = type === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const checkingAccounts = cards
    .filter((card) => card.type === "checking")
    .map((card) => card.name);
  const availableAccounts =
    type === "receita" && checkingAccounts.length > 0
      ? checkingAccounts
      : accounts;
  const selectedAccount = cards.find(
    (card) =>
      card.id === account ||
      card.name === account ||
      (account === transaction.account &&
        matchesLedgerCard(card, account, transaction.cardId))
  );
  const isCredit = selectedAccount?.type === "credit";

  const handleTypeChange = (nextType: TransactionItem["type"]) => {
    setType(nextType);
    setCategory(nextType === "receita" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    if (nextType === "receita" && !checkingAccounts.includes(account)) {
      setAccount(checkingAccounts[0] || accounts[0] || "Débito/Pix");
    }
  };

  const resetForm = () => {
    setTitle(transaction.title);
    setAmountInput(
      transaction.amount.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setType(transaction.type);
    setCategory(transaction.category);
    setAccount(transaction.account);
    setDateInput(toDateInput(transaction));
    setError(null);
    setPendingUpdates(null);
    setIsSaveConfirmOpen(false);
    setIsEditing(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!fieldsAreEditable) return;

    const currencyCheck = validateCurrency(amountInput, { min: 0.01, max: 50_000_000 });
    const sanitizedTitle = sanitizeTextInput(title, 100);
    const sanitizedCategory = sanitizeTextInput(category, 60);

    if (!sanitizedTitle || !currencyCheck.isValid || !dateInput) {
      setError(currencyCheck.error || "Preencha descrição, valor e data corretamente.");
      return;
    }

    const occurredAt = new Date(`${dateInput}T12:00:00`);
    if (Number.isNaN(occurredAt.getTime())) {
      setError("Data inválida informada.");
      return;
    }

    const selectedCard = cards.find(
      (card) => card.name === account || card.id === account
    );

    setPendingUpdates({
      title: sanitizedTitle,
      amount: currencyCheck.value,
      type,
      category: sanitizedCategory,
      account,
      cardId: selectedCard?.id || null,
      date: occurredAt.toLocaleDateString("pt-BR"),
      occurredAt,
    });
    setError(null);
    setIsSaveConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!pendingUpdates) return;

    setSaving(true);
    setError(null);
    try {
      await onSave(transaction.id, pendingUpdates);
      setIsSaveConfirmOpen(false);
      onClose();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar as alterações."
      );
      setIsSaveConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
        {/* Backdrop com Blur Suave */}
        <button
          type="button"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-apple-backdrop"
          onClick={onClose}
          aria-label="Fechar detalhes"
        />

        {/* Sheet / Modal Estilo macOS/iOS */}
        <div className="relative z-10 max-h-[90dvh] sm:max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-apple-sheet sm:animate-apple-modal border border-black/[0.04] pb-safe touch-scroll">
          {/* Pílula no Mobile */}
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[#D1D1D6] sm:hidden" />

          {/* Cabeçalho do Modal */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-black/[0.04]">
            <div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                  isCredit
                    ? "bg-indigo-50/80 text-indigo-700"
                    : "bg-emerald-50/80 text-emerald-700"
                }`}
              >
                {isCredit ? "Cartão de crédito" : formatAccountLabel(account)}
              </span>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[#1D1D1F]">
                Detalhes da transação
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#E5E5EA] transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            {!canEdit && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/70 px-4 py-3 text-xs text-amber-800">
                Pagamentos de fatura possuem lançamentos vinculados e não podem ser editados diretamente.
              </div>
            )}

            {/* 1. Tipo da Movimentação (Segmented Control Suave) */}
            <div className="p-1 rounded-full bg-[#E5E5EA]/60 border border-black/[0.04] grid grid-cols-2 gap-0.5">
              <button
                type="button"
                disabled={!fieldsAreEditable}
                onClick={() => handleTypeChange("despesa")}
                className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                  type === "despesa"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                Saiu
              </button>
              <button
                type="button"
                disabled={!fieldsAreEditable}
                onClick={() => handleTypeChange("receita")}
                className={`rounded-full py-1.5 text-xs transition-all select-none cursor-pointer ${
                  type === "receita"
                    ? "bg-white text-emerald-700 font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-[#86868B] hover:text-[#1D1D1F] font-medium"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                Entrou
              </button>
            </div>

            {/* 2. Campo Descrição */}
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                Descrição
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!fieldsAreEditable}
                className="w-full rounded-xl border border-black/[0.05] bg-[#F2F2F7]/60 px-3.5 py-2.5 text-sm font-medium text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] focus:bg-white focus:border-black/20 focus:ring-2 focus:ring-black/5 disabled:text-[#86868B] disabled:cursor-not-allowed"
                placeholder="Ex: Carregador · Casas Bahia"
              />
            </label>

            {/* 3. Valor e Data (Grid Confortável) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Valor
                </span>
                <div className="flex items-center rounded-xl border border-black/[0.05] bg-[#F2F2F7]/60 px-3.5 transition-all focus-within:bg-white focus-within:border-black/20 focus-within:ring-2 focus-within:ring-black/5">
                  <span className="text-xs font-semibold text-[#86868B]">R$</span>
                  <input
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                    disabled={!fieldsAreEditable}
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm font-semibold text-[#1D1D1F] outline-none disabled:text-[#86868B] disabled:cursor-not-allowed"
                  />
                </div>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Data
                </span>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(event) => setDateInput(event.target.value)}
                  disabled={!fieldsAreEditable}
                  className="w-full rounded-xl border border-black/[0.05] bg-[#F2F2F7]/60 px-3.5 py-2.5 text-xs font-medium text-[#1D1D1F] outline-none transition-all focus:bg-white focus:border-black/20 focus:ring-2 focus:ring-black/5 disabled:text-[#86868B] disabled:cursor-not-allowed"
                />
              </label>
            </div>

            {/* 4. Conta ou Cartão (Superfícies Compactas Elegantes) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                Conta ou cartão
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableAccounts.map((option) => {
                  const optionCard = cards.find(
                    (card) => card.name === option || card.id === option
                  );
                  const optionIsCredit = optionCard?.type === "credit";
                  const isSelected = account === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={!fieldsAreEditable}
                      onClick={() => setAccount(option)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all select-none cursor-pointer ${
                        isSelected
                          ? "bg-white border-black/15 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5"
                          : "bg-[#F2F2F7]/50 border-black/[0.04] text-[#86868B] hover:bg-[#E5E5EA]/50 hover:text-[#1D1D1F]"
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? optionIsCredit
                                ? "bg-indigo-50 text-indigo-700"
                                : "bg-emerald-50 text-emerald-700"
                              : "bg-black/[0.04] text-[#86868B]"
                          }`}
                        >
                          {optionIsCredit ? (
                            <CreditCard size={13} strokeWidth={1.75} />
                          ) : (
                            <Building2 size={13} strokeWidth={1.75} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span
                            className={`block text-xs font-semibold truncate ${
                              isSelected ? "text-[#1D1D1F]" : "text-[#86868B]"
                            }`}
                          >
                            {formatAccountLabel(option)}
                          </span>
                          <span className="block text-[10px] text-[#86868B] truncate">
                            {optionIsCredit ? "Crédito" : "Conta / Pix"}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-[#1D1D1F] shrink-0 mr-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Categoria (Dropdown Discreto com Chevron) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                Categoria
              </span>
              <div className="relative">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  disabled={!fieldsAreEditable}
                  className="w-full appearance-none rounded-xl border border-black/[0.05] bg-[#F2F2F7]/60 pl-3.5 pr-8 py-2.5 text-xs font-medium text-[#1D1D1F] outline-none transition-all focus:bg-white focus:border-black/20 focus:ring-2 focus:ring-black/5 disabled:text-[#86868B] disabled:cursor-not-allowed cursor-pointer"
                >
                  {!categories.includes(category) && (
                    <option value={category}>{category}</option>
                  )}
                  {categories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B]"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            {/* 6. Rodapé do Modal (Equilibrado e Refinado) */}
            {canEdit && !isEditing && (
              <div className="flex items-center justify-between pt-3 pb-safe border-t border-black/[0.04]">
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(transaction)}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer py-1.5 px-1"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                    <span>Excluir</span>
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1D1D1F] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-black active:scale-[0.98] cursor-pointer"
                >
                  <Pencil size={13} strokeWidth={2} />
                  <span>Editar transação</span>
                </button>
              </div>
            )}

            {canEdit && isEditing && (
              <div className="flex items-center justify-between pt-3 pb-safe border-t border-black/[0.04]">
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(transaction)}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer py-1.5 px-1"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                    <span>Excluir</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    className="rounded-full px-4 py-2 text-xs font-semibold text-[#86868B] hover:text-[#1D1D1F] transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1D1D1F] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-black active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    <Save size={13} strokeWidth={2} />
                    <span>{saving ? "Salvando..." : "Salvar alterações"}</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      <AppleConfirmModal
        isOpen={isSaveConfirmOpen}
        onClose={() => {
          if (!saving) setIsSaveConfirmOpen(false);
        }}
        onConfirm={handleConfirmSave}
        title="Salvar alterações?"
        description={`Confirma as alterações em "${title.trim()}"? O saldo e a fatura podem ser recalculados.`}
        confirmLabel="Confirmar e salvar"
        cancelLabel="Revisar"
        variant="primary"
        iconType="alert"
        isLoading={saving}
      />
    </>
  );
}
