"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import type { CardItem } from "@/types";
import { AddCardSheet } from "@/components/ui/AddCardSheet";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { useNotify } from "@/components/ui/macos/Notifications";
import { CardsDashboard } from "@/components/cards/CardsDashboard";
import { CardInvoicesBoard } from "@/components/cards/CardInvoicesBoard";
import { CommitmentsList } from "@/components/cards/CommitmentsList";
import { CardDot, Money, Sheet, formatBRL, parseCurrencyInput } from "@/components/cards/cardUi";
import { monthName, monthNameLower, shiftPeriodKey, type InvoiceStatus } from "@/lib/utils/creditCardEngine";

type Tab = "overview" | "invoices" | "plans";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Visão geral" },
  { id: "invoices", label: "Faturas" },
  { id: "plans", label: "Parcelas e assinaturas" },
];

export default function CardsPage() {
  const { cards, cardStatements, accountOptions, addCard, mainBalance } = useWallet();
  const creditCards = useMemo(() => cards.filter((card) => card.type === "credit"), [cards]);

  const [tab, setTab] = useState<Tab>("overview");
  const [focusIds, setFocusIds] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [purchaseAccount, setPurchaseAccount] = useState<string | null>(null);
  const [managingCard, setManagingCard] = useState<CardItem | null>(null);

  const statements = useMemo(
    () => creditCards.map((card) => cardStatements[card.id]).filter(Boolean),
    [creditCards, cardStatements]
  );

  // Fatura padrão: a primeira que ainda precisa ser paga; senão, a que está aberta.
  const defaultKey = useMemo(() => {
    const unpaid = statements
      .flatMap((s) => s.invoices.filter((invoice) => invoice.outstanding > 0.005 && invoice.key <= s.currentCycleKey))
      .map((invoice) => invoice.key)
      .sort()[0];
    if (unpaid) return unpaid;
    return statements.map((s) => s.currentCycleKey).sort()[0] || null;
  }, [statements]);
  const activeKey = selectedKey || defaultKey;

  const toggleFocus = (cardId: string) =>
    setFocusIds((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));

  const openInvoice = (periodKey: string, cardId?: string) => {
    setSelectedKey(periodKey);
    if (cardId) setFocusIds([cardId]);
    setTab("invoices");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const focusedCards = focusIds.length > 0 ? creditCards.filter((card) => focusIds.includes(card.id)) : creditCards;

  return (
    <div className="min-h-full space-y-5 bg-[#F2F2F7] p-4 font-sans text-[#1D1D1F] animate-in fade-in duration-500 sm:p-6 md:p-10">
      <header className="mx-auto flex max-w-6xl flex-col justify-between gap-4 pt-2 sm:flex-row sm:items-end md:pt-0">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">Crédito</span>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-[#1D1D1F]">Cartões</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-black/[0.04] bg-white px-3.5 py-2 text-xs text-[#86868B]">
            Conta <Money value={mainBalance} className="font-semibold text-[#1D1D1F]" />
          </span>
          {creditCards.length > 0 && (
            <button
              type="button"
              onClick={() => setPurchaseAccount(focusedCards[0]?.name || creditCards[0].name)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] transition-all hover:bg-black/5 active:scale-[0.98]"
            >
              <Plus size={15} /> Nova compra
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsAddCardOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#1D1D1F] px-4 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98]"
          >
            <Plus size={15} /> Novo cartão
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5">
        {creditCards.length === 0 ? (
          <div className="space-y-3 rounded-[24px] border border-black/[0.04] bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-[#1D1D1F]">Nenhum cartão de crédito ainda</h2>
            <p className="mx-auto max-w-sm text-xs text-[#86868B]">
              Adicione um cartão com o dia de fechamento e de vencimento para acompanhar faturas, limite e parcelas.
            </p>
            <button
              type="button"
              onClick={() => setIsAddCardOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#1D1D1F] px-5 py-2.5 text-xs font-semibold text-white"
            >
              <Plus size={15} /> Adicionar cartão
            </button>
          </div>
        ) : (
          <>
            <nav className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)]" aria-label="Seções de cartões">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={`flex-1 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    tab === item.id ? "bg-[#1D1D1F] text-white shadow-xs" : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {creditCards.length > 1 && tab !== "overview" && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                <FocusChip active={focusIds.length === 0} onClick={() => setFocusIds([])} label="Todos" />
                {creditCards.map((card) => (
                  <FocusChip key={card.id} active={focusIds.includes(card.id)} onClick={() => toggleFocus(card.id)} label={card.name} card={card} />
                ))}
              </div>
            )}

            {tab === "overview" && (
              <CardsDashboard
                creditCards={creditCards}
                statements={cardStatements}
                focusId={focusIds.length === 1 ? focusIds[0] : null}
                onFocusChange={(id) => setFocusIds(id ? [id] : [])}
                onOpenInvoice={(key, cardId) => openInvoice(key, cardId)}
                onOpenPlans={() => setTab("plans")}
                onManageCard={setManagingCard}
              />
            )}

            {tab === "invoices" && activeKey && (
              <div className="space-y-4">
                <InvoiceMonthStrip
                  activeKey={activeKey}
                  defaultKey={defaultKey}
                  cards={focusedCards}
                  statements={cardStatements}
                  onSelect={setSelectedKey}
                />
                <CardInvoicesBoard
                  periodKey={activeKey}
                  cardIds={focusIds}
                  onAddPurchase={(name) => setPurchaseAccount(name)}
                />
              </div>
            )}

            {tab === "plans" && (
              <CommitmentsList cards={focusedCards} statements={cardStatements} onOpenInvoice={openInvoice} />
            )}
          </>
        )}
      </div>

      <AddCardSheet isOpen={isAddCardOpen} onClose={() => setIsAddCardOpen(false)} onAddCard={addCard} />
      <AddTransactionSheet
        isOpen={Boolean(purchaseAccount)}
        onClose={() => setPurchaseAccount(null)}
        accounts={accountOptions}
        initialAccount={purchaseAccount || undefined}
        initialType="despesa"
        initialInvoiceKey={tab === "invoices" && activeKey ? activeKey : undefined}
      />
      <ManageCardSheet card={managingCard} onClose={() => setManagingCard(null)} />
    </div>
  );
}

function FocusChip({ active, onClick, label, card }: { active: boolean; onClick: () => void; label: string; card?: CardItem }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-[#1D1D1F] text-white" : "border border-black/[0.06] bg-white text-[#1D1D1F] hover:bg-[#F8F8FA]"
      }`}
    >
      {card && <CardDot card={card} size={8} />}
      {label}
    </button>
  );
}

const STATUS_DOT: Partial<Record<InvoiceStatus, string>> = {
  overdue: "bg-rose-500",
  closed: "bg-amber-500",
  open: "bg-indigo-500",
  paid: "bg-emerald-500",
};

function InvoiceMonthStrip({
  activeKey,
  defaultKey,
  cards,
  statements,
  onSelect,
}: {
  activeKey: string;
  defaultKey: string | null;
  cards: CardItem[];
  statements: ReturnType<typeof useWallet>["cardStatements"];
  onSelect: (key: string) => void;
}) {
  const base = defaultKey || activeKey;
  const keys = Array.from({ length: 12 }, (_, index) => shiftPeriodKey(base, index - 3));
  if (!keys.includes(activeKey)) keys.push(activeKey);
  keys.sort();
  const index = keys.indexOf(activeKey);

  const summary = (key: string) => {
    let total = 0;
    let outstanding = 0;
    const statuses: InvoiceStatus[] = [];
    let referenceMonth: number | null = null;
    for (const card of cards) {
      const invoice = statements[card.id]?.getInvoice(key);
      if (!invoice) continue;
      total += invoice.total;
      outstanding += invoice.outstanding;
      if (invoice.status !== "empty") statuses.push(invoice.status);
      referenceMonth ??= invoice.referenceMonth;
    }
    const priority: InvoiceStatus[] = ["overdue", "closed", "open", "future", "paid", "settled"];
    const status = priority.find((candidate) => statuses.includes(candidate)) || "empty";
    return { total, outstanding, status, referenceMonth };
  };

  const active = summary(activeKey);

  return (
    <section className="space-y-3 rounded-[12px] bg-[var(--fb-card)] p-4 shadow-[var(--fb-shadow)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => index > 0 && onSelect(keys[index - 1])}
          disabled={index <= 0}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F2F2F7] text-[#1D1D1F] disabled:opacity-30"
          aria-label="Fatura anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-sm font-semibold text-[#1D1D1F]">
            Fatura de {monthName(Number(activeKey.split("-")[1]) - 1)} {activeKey.split("-")[0]}
          </p>
          <p className="text-xs text-[#86868B]">
            {active.referenceMonth !== null ? `Referente aos gastos de ${monthNameLower(active.referenceMonth)}` : ""}
            {active.total > 0 && <> · <Money value={active.total} className="text-[#1D1D1F]" /></>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => index < keys.length - 1 && onSelect(keys[index + 1])}
          disabled={index >= keys.length - 1}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F2F2F7] text-[#1D1D1F] disabled:opacity-30"
          aria-label="Próxima fatura"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-0.5">
        {keys.map((key) => {
          const info = summary(key);
          const selected = key === activeKey;
          const month = Number(key.split("-")[1]) - 1;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-pressed={selected}
              className={`flex min-w-[78px] shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-2xl px-2.5 py-2 transition-all ${
                selected ? "bg-[#1D1D1F] text-white" : "bg-[#F8F8FA] text-[#1D1D1F] hover:bg-[#F2F2F7]"
              }`}
            >
              <span className="flex items-center gap-1 text-xs font-semibold">
                {STATUS_DOT[info.status] && <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[info.status]}`} />}
                {monthName(month).slice(0, 3)}
                {key === defaultKey && !selected && <span className="text-[9px] font-bold uppercase text-indigo-600">agora</span>}
              </span>
              <span className={`text-[10px] ${selected ? "text-white/60" : "text-[#86868B]"}`}>
                {info.referenceMonth !== null ? `gastos ${monthNameLower(info.referenceMonth).slice(0, 3)}` : ""}
              </span>
              <span className="font-mono text-[11px] font-semibold tabular-nums">
                {info.total > 0 ? formatBRL(info.total) : "—"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#86868B]">
        <Legend dot="bg-rose-500" label="vencida" />
        <Legend dot="bg-amber-500" label="fechada, a pagar" />
        <Legend dot="bg-indigo-500" label="aberta" />
        <Legend dot="bg-emerald-500" label="paga" />
      </p>
    </section>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
    </span>
  );
}

function ManageCardSheet({ card, onClose }: { card: CardItem | null; onClose: () => void }) {
  if (!card) return null;
  return <ManageCardSheetInner key={card.id} card={card} onClose={onClose} />;
}

function ManageCardSheetInner({ card, onClose }: { card: CardItem; onClose: () => void }) {
  const { updateCardLimit, updateCardBillingCycle, deleteCard, cards } = useWallet();
  const notify = useNotify();
  const [limit, setLimit] = useState(formatBRL(card.limit || 0));
  const [closingDay, setClosingDay] = useState(String(card.closingDay || 1));
  const [dueDay, setDueDay] = useState(String(card.dueDay || 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    const parsedLimit = parseCurrencyInput(limit);
    const closing = Number(closingDay);
    const due = Number(dueDay);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError("Informe um limite válido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (Math.abs(parsedLimit - (card.limit || 0)) >= 0.005) updateCardLimit(card.id, parsedLimit);
      if (closing !== card.closingDay || due !== card.dueDay) await updateCardBillingCycle(card.id, closing, due);
      notify.success(`${card.name} atualizado.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet
        isOpen
        onClose={onClose}
        title={`Ajustes do ${card.name}`}
        subtitle="Limite e datas da fatura"
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={cards.length <= 1}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-rose-600 disabled:opacity-40"
            >
              <Trash2 size={15} /> Excluir cartão
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D1D1F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" />} Salvar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">Limite total</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-black/[0.08] bg-[#F8F8FA] px-4 py-3 focus-within:border-[#0071E3]">
              <span className="font-semibold text-[#86868B]">R$</span>
              <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" className="w-full bg-transparent font-mono text-lg font-semibold tabular-nums text-[#1D1D1F] outline-none" />
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <DayField label="Fecha no dia" value={closingDay} onChange={setClosingDay} />
            <DayField label="Vence no dia" value={dueDay} onChange={setDueDay} />
          </div>
          <p className="rounded-2xl bg-[#F8F8FA] px-4 py-3 text-xs leading-relaxed text-[#86868B]">
            Compras até o dia {closingDay || "?"} entram na fatura que vence no dia {dueDay || "?"}
            {Number(dueDay) <= Number(closingDay) ? " do mês seguinte" : " do mesmo mês"}. Mudar as datas redistribui as compras e parcelas nas faturas.
          </p>
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
        </div>
      </Sheet>
      <AppleConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteCard(card.id);
          setConfirmDelete(false);
          onClose();
        }}
        title="Excluir cartão"
        description={`Remover o ${card.name}? As compras lançadas nele continuam no seu extrato.`}
        confirmLabel="Excluir cartão"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />
    </>
  );
}

function DayField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">{label}</span>
      <input
        type="number"
        min={1}
        max={31}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-2xl border border-black/[0.08] bg-[#F8F8FA] px-4 py-3 font-mono text-lg font-semibold tabular-nums text-[#1D1D1F] outline-none focus:border-[#0071E3]"
      />
    </label>
  );
}
