"use client";

import { useState } from "react";
import { Building2, CreditCard, Pencil, Save, X } from "lucide-react";
import type { CardItem, TransactionItem } from "@/context/WalletContext";
import type { TransactionUpdateInput } from "@/lib/services/transactionsService";
import { formatAccountLabel, matchesLedgerCard } from "@/lib/utils/ledger";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./AddTransactionSheet";
import { AppleConfirmModal } from "./AppleConfirmModal";

interface TransactionDetailsSheetProps {
  transaction: TransactionItem;
  accounts: string[];
  cards: CardItem[];
  initialEditing?: boolean;
  onClose: () => void;
  onSave: (id: string, updates: TransactionUpdateInput) => Promise<void>;
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
}: TransactionDetailsSheetProps) {
  const [title, setTitle] = useState(transaction.title);
  const [amountInput, setAmountInput] = useState(
    transaction.amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
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
  const availableAccounts = type === "receita" && checkingAccounts.length > 0
    ? checkingAccounts
    : accounts;
  const selectedAccount = cards.find((card) =>
    card.id === account || card.name === account ||
    (account === transaction.account && matchesLedgerCard(card, account, transaction.cardId))
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
    setAmountInput(transaction.amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));
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

    const amount = parseFloat(amountInput.replace(/\./g, "").replace(",", "."));
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0 || !dateInput) {
      setError("Preencha descrição, valor e data corretamente.");
      return;
    }

    const occurredAt = new Date(`${dateInput}T12:00:00`);
    const selectedCard = cards.find((card) => card.name === account || card.id === account);

    setPendingUpdates({
      title: title.trim(),
      amount,
      type,
      category,
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
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar as alterações.");
      setIsSaveConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="fixed inset-0 bg-black/45 animate-apple-backdrop"
        onClick={onClose}
        aria-label="Fechar detalhes"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-[#F2F2F7] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] animate-apple-sheet sm:rounded-[32px]">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[#D1D1D6] sm:hidden" />

        <div className="flex items-start justify-between border-b border-black/[0.05] px-6 py-4">
          <div>
            <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
              isCredit ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"
            }`}>
              {isCredit ? "Cartão de crédito" : formatAccountLabel(account)}
            </span>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#1D1D1F]">
              Detalhes da transação
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E5E5EA] text-[#1D1D1F] hover:bg-[#D1D1D6]"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {!canEdit && (
            <div className="rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Pagamentos de fatura possuem lançamentos vinculados e não podem ser editados. Exclua o pagamento e registre-o novamente se precisar corrigir.
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#E5E5EA]/80 p-1">
            <button
              type="button"
              disabled={!fieldsAreEditable}
              onClick={() => handleTypeChange("despesa")}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                type === "despesa" ? "bg-white text-[#1D1D1F] shadow-xs" : "text-[#86868B]"
              } disabled:opacity-60`}
            >
              Saiu
            </button>
            <button
              type="button"
              disabled={!fieldsAreEditable}
              onClick={() => handleTypeChange("receita")}
              className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                type === "receita" ? "bg-white text-emerald-700 shadow-xs" : "text-[#86868B]"
              } disabled:opacity-60`}
            >
              Entrou
            </button>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Descrição</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!fieldsAreEditable}
              className="w-full rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-sm font-medium text-[#1D1D1F] outline-none focus:ring-4 focus:ring-blue-500/10 disabled:text-[#86868B]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Valor</span>
              <div className="flex items-center rounded-xl border border-black/[0.06] bg-white px-3">
                <span className="text-xs font-semibold text-[#86868B]">R$</span>
                <input
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  disabled={!fieldsAreEditable}
                  inputMode="decimal"
                  className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm font-semibold text-[#1D1D1F] outline-none disabled:text-[#86868B]"
                />
              </div>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Data</span>
              <input
                type="date"
                value={dateInput}
                onChange={(event) => setDateInput(event.target.value)}
                disabled={!fieldsAreEditable}
                className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-3 text-sm font-medium text-[#1D1D1F] outline-none disabled:text-[#86868B]"
              />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Conta ou cartão</span>
            <div className="flex flex-wrap gap-2">
              {availableAccounts.map((option) => {
                const optionCard = cards.find((card) => card.name === option);
                const optionIsCredit = optionCard?.type === "credit";
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={!fieldsAreEditable}
                    onClick={() => setAccount(option)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      account === option
                        ? optionIsCredit
                          ? "bg-indigo-600 text-white"
                          : "bg-emerald-600 text-white"
                        : "bg-white text-[#86868B]"
                    } disabled:opacity-60`}
                  >
                    {optionIsCredit ? <CreditCard size={13} /> : <Building2 size={13} />}
                    {formatAccountLabel(option)}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">Categoria</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={!fieldsAreEditable}
              className="w-full rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-sm text-[#1D1D1F] outline-none disabled:text-[#86868B]"
            >
              {!categories.includes(category) && <option value={category}>{category}</option>}
              {categories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {canEdit && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1D1D1F] py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-[0.99]"
            >
              <Pencil size={15} />
              Editar transação
            </button>
          )}

          {canEdit && isEditing && (
            <div className="grid grid-cols-[auto_1fr] gap-2.5">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-2xl bg-[#E5E5EA] px-5 py-3.5 text-sm font-semibold text-[#1D1D1F] transition-all hover:bg-[#D1D1D6] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1D1D1F] py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black disabled:opacity-60"
              >
                <Save size={15} />
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
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
