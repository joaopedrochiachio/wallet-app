"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  CreditCard,
  Loader2,
  MoreHorizontal,
  Plus,
  Repeat,
  RotateCcw,
  ShoppingBag,
  Undo2,
  Wallet,
} from "lucide-react";
import { useWallet, type TransactionItem } from "@/context/WalletContext";
import type { CardItem, RecurringItem } from "@/types";
import {
  chargeKindLabel,
  describeInvoiceStatus,
  formatShortDate,
  invoiceReference,
  invoiceTitle,
  monthName,
  type CardCharge,
  type CardChargeKind,
  type CardInvoice,
  type CardStatement,
} from "@/lib/utils/creditCardEngine";
import { MiniCard } from "@/components/wallet";
import { EditRecurringSheet } from "@/components/ui/EditRecurringSheet";
import { TransactionDetailsSheet } from "@/components/ui/TransactionDetailsSheet";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { useNotify } from "@/components/ui/macos/Notifications";
import { ChargeSheet } from "./ChargeSheet";
import { InvoiceStatusPill, Money, Sheet, formatBRL, parseCurrencyInput } from "./cardUi";

export interface CardInvoicesBoardProps {
  /** Mês de vencimento das faturas exibidas (YYYY-MM). */
  periodKey: string;
  /** Restringe a cartões específicos. */
  cardIds?: string[] | null;
  /** Abre a composição da fatura já expandida. */
  defaultExpanded?: boolean;
  onAddPurchase?: (cardName: string) => void;
}

type KindFilter = "all" | CardChargeKind;

export function CardInvoicesBoard({ periodKey, cardIds, defaultExpanded = false, onAddPurchase }: CardInvoicesBoardProps) {
  const {
    cards,
    cardStatements,
    recurringItems,
    transactions,
    accountOptions,
    payInvoice,
    unpayInvoice,
    moveCardCharge,
    removeCardCharge,
    startRecurringAtInvoice,
    updateRecurringItem,
    updateRecurringItemOccurrence,
    updateTransaction,
  } = useWallet();
  const notify = useNotify();

  const creditCards = useMemo(() => cards.filter((card) => card.type === "credit"), [cards]);
  const visibleCards = cardIds && cardIds.length > 0
    ? creditCards.filter((card) => cardIds.includes(card.id))
    : creditCards;
  const checkingAccount = cards.find((card) => card.type === "checking");

  const [selected, setSelected] = useState<{ charge: CardCharge; cardId: string; invoiceKey: string } | null>(null);
  const [editingItem, setEditingItem] = useState<{ item: RecurringItem; charge: CardCharge } | null>(null);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [payTarget, setPayTarget] = useState<{ card: CardItem; invoice: CardInvoice } | null>(null);
  const [undoTarget, setUndoTarget] = useState<{ card: CardItem; invoice: CardInvoice } | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const selectedCard = selected ? creditCards.find((card) => card.id === selected.cardId) || null : null;
  const selectedStatement = selected ? cardStatements[selected.cardId] : undefined;
  const selectedInvoice = selected && selectedStatement ? selectedStatement.getInvoice(selected.invoiceKey) : null;
  const selectedPlan = selected?.charge.recurringItemId
    ? selectedStatement?.plans.find((plan) => plan.recurringItemId === selected.charge.recurringItemId) || null
    : null;

  const handleEdit = (charge: CardCharge) => {
    const item = charge.recurringItemId ? recurringItems.find((candidate) => candidate.id === charge.recurringItemId) : undefined;
    setSelected(null);
    if (item) {
      setEditingItem({ item, charge });
      return;
    }
    const tx = transactions.find((candidate) => candidate.id === charge.transactionId);
    if (tx) setEditingTx(tx);
  };

  if (creditCards.length === 0) {
    return (
      <div className="rounded-[22px] border border-black/[0.04] bg-white p-7 text-center">
        <CreditCard size={22} className="mx-auto text-[#86868B]" strokeWidth={1.6} />
        <p className="mt-2 text-sm font-medium text-[#1D1D1F]">Nenhum cartão de crédito cadastrado</p>
        <p className="mt-1 text-xs text-[#86868B]">Cadastre um cartão em Cartões para acompanhar as faturas aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleCards.map((card) => {
        const statement = cardStatements[card.id];
        if (!statement) return null;
        return (
          <InvoicePanel
            key={`${card.id}-${periodKey}`}
            card={card}
            statement={statement}
            invoice={statement.getInvoice(periodKey)}
            defaultExpanded={defaultExpanded || visibleCards.length === 1}
            onSelectCharge={(charge, invoiceKey) => setSelected({ charge, cardId: card.id, invoiceKey })}
            onPay={(invoice) => setPayTarget({ card, invoice })}
            onUndoPay={(invoice) => setUndoTarget({ card, invoice })}
            onAddPurchase={onAddPurchase}
          />
        );
      })}

      <ChargeSheet
        charge={selected?.charge ?? null}
        card={selectedCard}
        invoice={selectedInvoice}
        plan={selectedPlan}
        creditCards={creditCards}
        onClose={() => setSelected(null)}
        onEdit={handleEdit}
        onMove={async (charge, destinationId, scope) => {
          await moveCardCharge(charge, destinationId, scope);
          const destination = creditCards.find((card) => card.id === destinationId);
          notify.success(
            scope === "forward" && charge.recurringItemId
              ? `${charge.title} agora cobra no ${destination?.name} a partir desta fatura. As anteriores não mudaram.`
              : `${charge.title} foi para o ${destination?.name}.`
          );
        }}
        onStartAt={async (charge, invoiceKey) => {
          if (!charge.recurringItemId) return;
          await startRecurringAtInvoice(charge.recurringItemId, invoiceKey);
          notify.success(`${charge.title} agora começa na fatura de ${monthName(Number(invoiceKey.split("-")[1]) - 1)}. As faturas anteriores foram limpas.`);
        }}
        onRemove={async (charge, scope) => {
          await removeCardCharge(charge, scope);
          notify.success(
            scope === "forward"
              ? `${charge.title} encerrada a partir desta fatura. O histórico foi mantido.`
              : scope === "everything"
                ? `${charge.title} removida de todas as faturas.`
                : `${charge.title} removida desta fatura.`
          );
        }}
      />

      <EditRecurringSheet
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem?.item ?? null}
        currentPeriodKey={editingItem?.charge.chargePeriodKey}
        currentMonthName={editingItem ? invoiceMonthLabel(editingItem.charge.invoiceKey) : undefined}
        accounts={accountOptions}
        cards={cards}
        onSave={async (id, updates, scope, period) => {
          const targetPeriod = period || editingItem?.charge.chargePeriodKey;
          if (!targetPeriod) return;
          if (scope === "single") await updateRecurringItemOccurrence(id, targetPeriod, updates);
          else await updateRecurringItem(id, updates, targetPeriod);
          setEditingItem(null);
          notify.success("Compra atualizada.");
        }}
      />

      {editingTx && (
        <TransactionDetailsSheet
          transaction={editingTx}
          accounts={accountOptions}
          cards={cards}
          initialEditing
          onClose={() => setEditingTx(null)}
          onSave={async (id, updates) => {
            await updateTransaction(id, updates);
            setEditingTx(null);
            notify.success("Compra atualizada.");
          }}
          onDelete={async (tx) => {
            setEditingTx(null);
            await removeCardCharge(
              {
                id: tx.id, cardId: tx.cardId || "", kind: "purchase", status: "posted", title: tx.title,
                category: tx.category, amount: tx.amount, chargeDate: new Date(), invoiceKey: periodKey,
                chargePeriodKey: tx.periodKey || periodKey, recurringItemId: tx.recurringItemId || null, transactionId: tx.id,
              },
              "single"
            );
            notify.success("Compra excluída.");
          }}
        />
      )}

      <PayInvoiceSheet
        target={payTarget}
        checkingAccount={checkingAccount}
        onClose={() => setPayTarget(null)}
        onConfirm={async (amount) => {
          if (!payTarget) return;
          await payInvoice(payTarget.card.id, amount, payTarget.invoice.key);
          const freed = Math.min(amount, payTarget.invoice.outstanding);
          notify.success(
            amount + 0.005 < payTarget.invoice.outstanding
              ? `Pagamento parcial registrado. R$ ${formatBRL(freed)} de limite liberado.`
              : `${invoiceTitle(payTarget.invoice)} do ${payTarget.card.name} paga. Limite liberado.`
          );
          setPayTarget(null);
        }}
      />

      <AppleConfirmModal
        isOpen={Boolean(undoTarget)}
        onClose={() => setUndoTarget(null)}
        isLoading={isUndoing}
        onConfirm={async () => {
          if (!undoTarget) return;
          setIsUndoing(true);
          try {
            await unpayInvoice(undoTarget.card.id, undoTarget.invoice.key);
            notify.success("Pagamento desfeito. O valor voltou para a conta.");
          } catch (error) {
            notify.error(error instanceof Error ? error.message : "Não foi possível desfazer o pagamento.");
          } finally {
            setIsUndoing(false);
            setUndoTarget(null);
          }
        }}
        title="Desfazer pagamento"
        description={undoTarget
          ? `Remove o pagamento de R$ ${formatBRL(undoTarget.invoice.paid)} da ${invoiceTitle(undoTarget.invoice).toLowerCase()} do ${undoTarget.card.name}. O valor volta para a conta e o limite volta a ficar ocupado.`
          : ""}
        confirmLabel="Desfazer"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />
    </div>
  );
}

function invoiceMonthLabel(invoiceKey: string): string {
  const month = Number(invoiceKey.split("-")[1]) - 1;
  return `fatura de ${monthName(month)}`;
}

/* ------------------------------------------------------------------ */

const KIND_ORDER: CardChargeKind[] = ["installment", "subscription", "purchase", "refund"];
const KIND_LABEL: Record<CardChargeKind, string> = {
  installment: "Parcelas",
  subscription: "Assinaturas",
  purchase: "À vista",
  refund: "Estornos",
};

function InvoicePanel({
  card,
  statement,
  invoice,
  defaultExpanded,
  onSelectCharge,
  onPay,
  onUndoPay,
  onAddPurchase,
}: {
  card: CardItem;
  statement: CardStatement;
  invoice: CardInvoice;
  defaultExpanded: boolean;
  onSelectCharge: (charge: CardCharge, invoiceKey: string) => void;
  onPay: (invoice: CardInvoice) => void;
  onUndoPay: (invoice: CardInvoice) => void;
  onAddPurchase?: (cardName: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [filter, setFilter] = useState<KindFilter>("all");

  const kindsPresent = KIND_ORDER.filter((kind) => invoice.charges.some((charge) => charge.kind === kind));
  const visibleCharges = filter === "all" ? invoice.charges : invoice.charges.filter((charge) => charge.kind === filter);
  const canPay = invoice.outstanding > 0.005 && invoice.status !== "settled";
  const paidShare = invoice.total > 0 ? Math.min(100, (Math.min(invoice.paid + invoice.creditApplied, invoice.total) / invoice.total) * 100) : 0;
  const isPartial = invoice.paid > 0 && invoice.outstanding > 0.005;
  const headline = invoice.status === "paid" || invoice.status === "settled" ? invoice.total : invoice.outstanding || invoice.total;

  return (
    <article className="overflow-hidden rounded-[12px] bg-[var(--fb-card)] shadow-[var(--fb-shadow)]">
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <MiniCard cardName={card.name} brand={card.brand} colorScheme={card.colorScheme} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="truncate text-sm font-semibold text-[#1D1D1F]">{card.name}</h3>
              <InvoiceStatusPill status={invoice.status} />
            </div>
            <p className="mt-0.5 text-[13px] font-medium text-[#1D1D1F]">
              {invoiceTitle(invoice)}
              <span className="font-normal text-[#86868B]"> · {invoiceReference(invoice)}</span>
            </p>
            <p className="mt-0.5 text-xs text-[#86868B]">{describeInvoiceStatus(invoice, statement.today)}</p>
          </div>
          <div className="shrink-0 text-right">
            <Money
              value={headline}
              className={`block text-lg font-semibold tracking-tight ${
                invoice.status === "paid" ? "text-emerald-600" : invoice.status === "overdue" ? "text-rose-600" : invoice.status === "empty" || invoice.status === "settled" ? "text-[#86868B]" : "text-[#1D1D1F]"
              }`}
            />
            <span className="text-[11px] text-[#86868B]">
              {invoice.status === "paid" ? "pago" : invoice.status === "settled" ? "encerrada" : isPartial ? "falta pagar" : invoice.status === "future" ? "previsto" : "a pagar"}
            </span>
          </div>
        </div>

        {(isPartial || invoice.creditApplied > 0) && (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F2F2F7]">
              <div className="h-full rounded-full bg-[var(--fb-accent)] transition-all duration-500" style={{ width: `${paidShare}%` }} />
            </div>
            <p className="text-[11px] text-[#86868B]">
              Fatura de <Money value={invoice.total} className="text-[#1D1D1F]" />
              {invoice.paid > 0 && <> · pago <Money value={invoice.paid} className="text-emerald-700" /></>}
              {invoice.creditApplied > 0 && <> · crédito anterior <Money value={invoice.creditApplied} className="text-emerald-700" /></>}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {canPay && (
            <button
              type="button"
              onClick={() => onPay(invoice)}
              className="touch-target inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-[var(--fb-accent)] px-3.5 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95"
            >
              <Wallet size={13} /> {isPartial ? "Pagar o restante" : "Paguei a fatura"}
            </button>
          )}
          {invoice.paid > 0 && (
            <button
              type="button"
              onClick={() => onUndoPay(invoice)}
              className="touch-target inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#F2F2F7] px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <RotateCcw size={12} /> Desfazer pagamento
            </button>
          )}
          {onAddPurchase && (
            <button
              type="button"
              onClick={() => onAddPurchase(card.name)}
              className="touch-target inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-[var(--fb-accent)] transition-colors hover:bg-[var(--fb-accent-bg)]"
            >
              <Plus size={13} /> Compra
            </button>
          )}
          {invoice.charges.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="touch-target ml-auto inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-[#86868B] transition-colors hover:text-[#1D1D1F]"
            >
              {invoice.charges.length} {invoice.charges.length === 1 ? "lançamento" : "lançamentos"}
              <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {expanded && invoice.charges.length > 0 && (
        <div className="border-t border-black/[0.05] bg-[#FBFBFD] animate-in fade-in duration-300">
          {kindsPresent.length > 1 && (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pt-3 sm:px-5">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Tudo" count={invoice.charges.length} />
              {kindsPresent.map((kind) => (
                <FilterChip
                  key={kind}
                  active={filter === kind}
                  onClick={() => setFilter(kind)}
                  label={KIND_LABEL[kind]}
                  count={invoice.charges.filter((charge) => charge.kind === kind).length}
                />
              ))}
            </div>
          )}
          <ul className="divide-y divide-black/[0.04] px-2 py-2 sm:px-3">
            {visibleCharges.map((charge) => (
              <li key={charge.id}>
                <ChargeRow charge={charge} onClick={() => onSelectCharge(charge, invoice.key)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {invoice.charges.length === 0 && (
        <p className="border-t border-black/[0.05] px-5 py-3 text-xs text-[#86868B]">
          Nenhuma compra nesta fatura. Compras feitas entre {formatShortDate(invoice.cycleStart)} e {formatShortDate(invoice.closingDate)} entram aqui.
        </p>
      )}
    </article>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-[#1D1D1F] text-white" : "bg-white text-[#1D1D1F] border border-black/[0.06] hover:bg-[#F2F2F7]"
      }`}
    >
      {label} <span className={active ? "text-white/60" : "text-[#86868B]"}>{count}</span>
    </button>
  );
}

const KIND_ICON: Record<CardChargeKind, React.ElementType> = {
  installment: CalendarClock,
  subscription: Repeat,
  purchase: ShoppingBag,
  refund: Undo2,
};

function ChargeRow({ charge, onClick }: { charge: CardCharge; onClick: () => void }) {
  const Icon = KIND_ICON[charge.kind];
  const progress = charge.kind === "installment" && charge.installmentsCount
    ? ((charge.installmentIndex || 0) / charge.installmentsCount) * 100
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        charge.kind === "installment" ? "bg-indigo-50 text-indigo-700"
          : charge.kind === "subscription" ? "bg-violet-50 text-violet-700"
            : charge.kind === "refund" ? "bg-emerald-50 text-emerald-700"
              : "bg-[#F2F2F7] text-[#1D1D1F]"
      }`}>
        <Icon size={15} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[#1D1D1F]">{charge.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#86868B]">
          <span>{chargeKindLabel(charge)}</span>
          <span aria-hidden>·</span>
          <span>{formatShortDate(charge.chargeDate)}</span>
          {charge.status === "scheduled" && (
            <span className="rounded-full bg-[#F2F2F7] px-1.5 py-px text-[10px] font-medium">previsto</span>
          )}
        </span>
        {progress !== null && (
          <span className="mt-1.5 block h-1 w-24 overflow-hidden rounded-full bg-[#F2F2F7]">
            <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${progress}%` }} />
          </span>
        )}
      </span>
      <Money
        value={charge.amount}
        sign={charge.kind === "refund" ? "−" : undefined}
        className={`shrink-0 text-[13px] font-semibold ${charge.kind === "refund" ? "text-emerald-600" : "text-[#1D1D1F]"}`}
      />
      <MoreHorizontal size={16} className="shrink-0 text-[#86868B] opacity-60 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

/* ------------------------------------------------------------------ */

function PayInvoiceSheet({
  target,
  checkingAccount,
  onClose,
  onConfirm,
}: {
  target: { card: CardItem; invoice: CardInvoice } | null;
  checkingAccount?: CardItem;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  if (!target) return null;
  return (
    <PayInvoiceSheetInner
      key={`${target.card.id}-${target.invoice.key}`}
      target={target}
      checkingAccount={checkingAccount}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function PayInvoiceSheetInner({
  target,
  checkingAccount,
  onClose,
  onConfirm,
}: {
  target: { card: CardItem; invoice: CardInvoice };
  checkingAccount?: CardItem;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const { card, invoice } = target;
  const [input, setInput] = useState(formatBRL(invoice.outstanding));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = parseCurrencyInput(input);
  const valid = Number.isFinite(amount) && amount >= 0.01;
  const isPartial = valid && amount + 0.005 < invoice.outstanding;
  const isOver = valid && amount > invoice.outstanding + 0.005;

  const submit = async () => {
    if (!valid) {
      setError("Informe um valor válido.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(Math.round(amount * 100) / 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar o pagamento.");
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen
      onClose={onClose}
      title={`Pagar ${invoiceTitle(invoice).toLowerCase()}`}
      subtitle={`${card.name} · ${invoiceReference(invoice)}`}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={busy || !valid || !checkingAccount}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1D1D1F] py-3 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {isPartial ? "Registrar pagamento parcial" : "Confirmar pagamento"}
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">Quanto você pagou</span>
          <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-black/[0.08] bg-[#F8F8FA] px-4 py-3 focus-within:border-[var(--fb-accent)]">
            <span className="text-lg font-semibold text-[#86868B]">R$</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              inputMode="decimal"
              autoFocus
              className="w-full bg-transparent font-mono text-2xl font-semibold tabular-nums text-[#1D1D1F] outline-none"
              aria-label="Valor pago"
            />
          </div>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setInput(formatBRL(invoice.outstanding))}
            className="touch-target cursor-pointer rounded-full bg-[#F2F2F7] px-3 py-1.5 text-xs font-medium text-[#1D1D1F]"
          >
            Total · R$ {formatBRL(invoice.outstanding)}
          </button>
          <button
            type="button"
            onClick={() => setInput(formatBRL(Math.round(invoice.outstanding * 50) / 100))}
            className="touch-target cursor-pointer rounded-full bg-[#F2F2F7] px-3 py-1.5 text-xs font-medium text-[#1D1D1F]"
          >
            Metade
          </button>
        </div>

        <div className="rounded-2xl bg-[#F8F8FA] px-4 py-3 text-xs leading-relaxed text-[#86868B]">
          {isPartial ? (
            <>Libera <strong className="text-emerald-700">R$ {formatBRL(amount)}</strong> de limite agora. Os <strong className="text-[#1D1D1F]">R$ {formatBRL(invoice.outstanding - amount)}</strong> restantes continuam nesta fatura.</>
          ) : isOver ? (
            <>Os <strong className="text-[#1D1D1F]">R$ {formatBRL(amount - invoice.outstanding)}</strong> a mais viram crédito para as próximas faturas (antecipação de parcelas) e liberam limite.</>
          ) : (
            <>Quita a fatura e devolve <strong className="text-emerald-700">R$ {formatBRL(invoice.outstanding)}</strong> ao limite do {card.name}.</>
          )}
          <br />
          Sai da conta <strong className="text-[#1D1D1F]">{checkingAccount?.name || "principal"}</strong>
          {checkingAccount && <> (saldo R$ {formatBRL(checkingAccount.balance || 0)})</>}. O pagamento ao banco é feito por você.
        </div>
        {!checkingAccount && <p className="text-xs text-rose-600">Cadastre uma conta corrente para registrar o pagamento.</p>}
        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      </div>
    </Sheet>
  );
}
