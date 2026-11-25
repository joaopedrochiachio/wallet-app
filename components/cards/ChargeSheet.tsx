"use client";

import React, { useState } from "react";
import {
  ArrowLeftRight,
  CalendarClock,
  CalendarRange,
  Check,
  ChevronRight,
  Loader2,
  Pencil,
  Repeat,
  ShoppingBag,
  Trash2,
  Undo2,
} from "lucide-react";
import type { CardItem } from "@/types";
import { getInvoiceDueDate } from "@/lib/utils/ledger";
import {
  chargeDateForInvoice,
  getInvoiceCycle,
  monthName,
  monthNameLower,
  shiftPeriodKey,
  chargeKindLabel,
  formatShortDate,
  invoiceReference,
  invoiceTitle,
  type CardCharge,
  type CardInvoice,
  type InstallmentPlanSummary,
} from "@/lib/utils/creditCardEngine";
import { CardDot, Money, Sheet } from "./cardUi";

type View = "details" | "move" | "delete" | "start";
type MoveScope = "forward" | "single";
type RemoveScope = "single" | "forward" | "everything";

export interface ChargeSheetProps {
  charge: CardCharge | null;
  card: CardItem | null;
  invoice: CardInvoice | null;
  /** Resumo do parcelamento (total, parcelas restantes), quando a cobrança é uma parcela. */
  plan?: InstallmentPlanSummary | null;
  creditCards: CardItem[];
  onClose: () => void;
  onEdit: (charge: CardCharge) => void;
  onMove: (charge: CardCharge, destinationCardId: string, scope: MoveScope) => Promise<void>;
  onRemove: (charge: CardCharge, scope: RemoveScope) => Promise<void>;
  /** Faz a série começar só na fatura escolhida (remove as cobranças anteriores a ela). */
  onStartAt?: (charge: CardCharge, invoiceKey: string) => Promise<void>;
}

export function ChargeSheet(props: ChargeSheetProps) {
  if (!props.charge || !props.card || !props.invoice) return null;
  return <ChargeSheetInner {...props} key={props.charge.id} charge={props.charge} card={props.card} invoice={props.invoice} />;
}

function ChargeSheetInner({
  charge,
  card,
  invoice,
  plan,
  creditCards,
  onClose,
  onEdit,
  onMove,
  onRemove,
  onStartAt,
}: ChargeSheetProps & { charge: CardCharge; card: CardItem; invoice: CardInvoice }) {
  const [startKey, setStartKey] = useState<string | null>(null);
  const [view, setView] = useState<View>("details");
  const [destinationId, setDestinationId] = useState<string>(
    creditCards.find((candidate) => candidate.id !== card.id)?.id || ""
  );
  const [moveScope, setMoveScope] = useState<MoveScope>("forward");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSeries = Boolean(charge.recurringItemId);
  const isInstallment = charge.kind === "installment";
  const isSubscription = charge.kind === "subscription";
  const destination = creditCards.find((candidate) => candidate.id === destinationId);
  const otherCards = creditCards.filter((candidate) => candidate.id !== card.id);
  const thisInvoice = invoiceTitle(invoice);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const Icon = isInstallment ? CalendarClock : isSubscription ? Repeat : charge.kind === "refund" ? Undo2 : ShoppingBag;

  const titles: Record<View, string> = {
    details: charge.title,
    move: "Mover para outro cartão",
    delete: "Excluir",
    start: "Mudar a fatura de início",
  };
  const chargeDay = charge.item?.dueDay || charge.chargeDate.getDate();
  const currentDue = getInvoiceDueDate(card, new Date());
  const currentKey = `${currentDue.getFullYear()}-${String(currentDue.getMonth() + 1).padStart(2, "0")}`;
  const startOptions = Array.from({ length: 6 }, (_, index) => {
    const key = shiftPeriodKey(currentKey, index);
    return { key, cycle: getInvoiceCycle(card, key), chargeDate: chargeDateForInvoice(card, key, chargeDay) };
  });
  const chosenStart = startOptions.find((option) => option.key === startKey) || null;

  return (
    <Sheet
      isOpen
      onClose={onClose}
      title={titles[view]}
      subtitle={
        view === "details" ? (
          <span className="inline-flex items-center gap-1.5">
            <CardDot card={card} size={8} /> {card.name} · {chargeKindLabel(charge)}
          </span>
        ) : (
          <span>{charge.title}</span>
        )
      }
      footer={
        view === "details" ? null : (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => { setView("details"); setError(null); }}
              disabled={busy}
              className="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-[var(--fb-accent)] disabled:opacity-50"
            >
              Voltar
            </button>
            {view === "start" && (
              <button
                type="button"
                disabled={busy || !chosenStart || !onStartAt}
                onClick={() => chosenStart && onStartAt && run(() => onStartAt(charge, chosenStart.key))}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D1D1F] px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CalendarRange size={15} />}
                {chosenStart ? `Começar em ${monthName(chosenStart.cycle.month)}` : "Escolha a fatura"}
              </button>
            )}
            {view === "move" && (
              <button
                type="button"
                disabled={busy || !destination}
                onClick={() => destination && run(() => onMove(charge, destination.id, isSeries ? moveScope : "single"))}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1D1D1F] px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowLeftRight size={15} />}
                Mover para {destination?.name || "…"}
              </button>
            )}
          </div>
        )
      }
    >
      {view === "details" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F2F2F7] text-[#1D1D1F]">
              <Icon size={20} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <Money
                value={charge.amount}
                sign={charge.kind === "refund" ? "−" : undefined}
                className={`block text-2xl font-semibold tracking-tight ${charge.kind === "refund" ? "text-emerald-600" : "text-[#1D1D1F]"}`}
              />
              <span className="text-xs text-[#86868B]">
                {charge.status === "scheduled" ? "Cobrança prevista" : "Lançada no cartão"} · {charge.category}
              </span>
            </div>
          </div>

          <dl className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-[#F8F8FA] text-sm">
            <Row label={charge.kind === "refund" ? "Estornado em" : isSeries ? "Cobrança em" : "Comprado em"} value={formatShortDate(charge.chargeDate)} />
            <Row
              label="Entra na"
              value={
                <span className="text-right">
                  {invoiceTitle(invoice, true)}
                  <span className="block text-[11px] text-[#86868B]">{invoiceReference(invoice)}</span>
                </span>
              }
            />
            {isInstallment && plan && (
              <>
                <Row label="Compra total" value={<Money value={plan.totalAmount} />} />
                <Row
                  label="Parcelas"
                  value={`${charge.installmentIndex} de ${charge.installmentsCount}${plan.remainingCount > 0 ? ` · faltam ${plan.remainingCount}` : ""}`}
                />
                {plan.remainingAmount > 0 && <Row label="Ainda vai cobrar" value={<Money value={plan.remainingAmount} />} />}
              </>
            )}
            {isInstallment && !plan && (
              <Row label="Parcela" value={`${charge.installmentIndex} de ${charge.installmentsCount}`} />
            )}
            {isSubscription && (
              <Row label="Repete" value={`Todo mês, dia ${charge.chargeDate.getDate()}`} />
            )}
          </dl>

          {isInstallment && (
            <p className="rounded-2xl bg-indigo-50 px-3.5 py-2.5 text-xs leading-relaxed text-indigo-800">
              A compra parcelada ocupa o limite inteiro. Cada fatura paga devolve o valor pago ao seu limite.
            </p>
          )}

          <div className="space-y-2">
            {charge.kind !== "refund" && (
              <ActionRow icon={<Pencil size={16} />} label="Editar" hint="Valor, nome, categoria e dia" onClick={() => onEdit(charge)} />
            )}
            {isSeries && onStartAt && (
              <ActionRow
                icon={<CalendarRange size={16} />}
                label="Mudar a fatura de início"
                hint={isInstallment ? "Em qual fatura entra a 1ª parcela" : "Em qual fatura entra a 1ª cobrança"}
                onClick={() => setView("start")}
              />
            )}
            {charge.kind !== "refund" && otherCards.length > 0 && (
              <ActionRow
                icon={<ArrowLeftRight size={16} />}
                label="Mover para outro cartão"
                hint={isSeries ? "Escolha a partir de qual fatura" : "A compra passa para a fatura do outro cartão"}
                onClick={() => setView("move")}
              />
            )}
            <ActionRow
              icon={<Trash2 size={16} />}
              label="Excluir"
              hint={isSeries ? "Só esta, desta em diante ou tudo" : "Remove esta compra da fatura"}
              destructive
              onClick={() => setView("delete")}
            />
          </div>
        </div>
      )}

      {view === "move" && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#86868B]">Para qual cartão</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {otherCards.map((candidate) => {
                const selected = candidate.id === destinationId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setDestinationId(candidate.id)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left text-sm transition-all ${
                      selected ? "border-[#1D1D1F] bg-white shadow-xs" : "border-black/[0.06] bg-[#F8F8FA] hover:bg-[#F2F2F7]"
                    }`}
                  >
                    <CardDot card={candidate} size={12} />
                    <span className="flex-1 truncate font-medium text-[#1D1D1F]">{candidate.name}</span>
                    {selected && <Check size={15} className="text-[#1D1D1F]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {isSeries && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#86868B]">A partir de quando</p>
              <div className="space-y-2">
                <ScopeOption
                  selected={moveScope === "forward"}
                  onClick={() => setMoveScope("forward")}
                  title={`Desta fatura em diante`}
                  description={`${thisInvoice} e as seguintes vão para ${destination?.name || "o outro cartão"}. As faturas anteriores continuam no ${card.name}.`}
                />
                <ScopeOption
                  selected={moveScope === "single"}
                  onClick={() => setMoveScope("single")}
                  title={`Só na ${thisInvoice.toLowerCase()}`}
                  description={`Apenas esta cobrança muda. As próximas continuam no ${card.name}.`}
                />
              </div>
            </div>
          )}
          {!isSeries && (
            <p className="rounded-2xl bg-[#F8F8FA] px-3.5 py-3 text-xs leading-relaxed text-[#86868B]">
              A compra sai da fatura do {card.name} e entra na fatura do {destination?.name || "outro cartão"} conforme o fechamento dele.
            </p>
          )}
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
        </div>
      )}

      {view === "start" && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[#86868B]">
            {isInstallment
              ? "A 1ª parcela passa a cair na fatura escolhida e as outras seguem mês a mês."
              : `A cobrança de todo dia ${chargeDay} passa a começar na fatura escolhida.`}{" "}
            Cobranças que já entraram em faturas anteriores a ela são removidas.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {startOptions.map((option) => {
              const selected = option.key === startKey;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStartKey(option.key)}
                  aria-pressed={selected}
                  className={`cursor-pointer rounded-2xl border px-3 py-2.5 text-left transition-all ${
                    selected ? "border-[#1D1D1F] bg-white shadow-xs" : "border-black/[0.06] bg-[#F8F8FA] hover:bg-[#F2F2F7]"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[#1D1D1F]">{monthName(option.cycle.month)}</span>
                  <span className="block text-[11px] text-[#86868B]">gastos de {monthNameLower(option.cycle.referenceMonth)}</span>
                  <span className="block text-[11px] text-[#86868B]">cobra {formatShortDate(option.chargeDate)}</span>
                </button>
              );
            })}
          </div>
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
        </div>
      )}

      {view === "delete" && (
        <div className="space-y-2.5">
          {!isSeries ? (
            <DeleteOption
              busy={busy}
              title="Excluir esta compra"
              description={`Sai da ${thisInvoice.toLowerCase()} e libera R$ ${charge.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} do limite.`}
              onClick={() => run(() => onRemove(charge, "single"))}
            />
          ) : (
            <>
              <DeleteOption
                busy={busy}
                title={`Só na ${thisInvoice.toLowerCase()}`}
                description={isInstallment
                  ? `Remove só a parcela ${charge.installmentIndex}. As outras parcelas continuam.`
                  : "Remove só esta cobrança. Os outros meses continuam."}
                onClick={() => run(() => onRemove(charge, "single"))}
              />
              <DeleteOption
                busy={busy}
                title={isSubscription ? "Cancelar desta fatura em diante" : "Desta fatura em diante"}
                description={`Para de cobrar a partir da ${thisInvoice.toLowerCase()}. As faturas anteriores ficam exatamente como estão.`}
                onClick={() => run(() => onRemove(charge, "forward"))}
                recommended
              />
              <DeleteOption
                busy={busy}
                title="Apagar a compra inteira"
                description="Remove de todas as faturas, inclusive das passadas. Use só se a compra foi lançada por engano."
                onClick={() => run(() => onRemove(charge, "everything"))}
                danger
              />
            </>
          )}
          {error && <p role="alert" className="pt-1 text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-[#86868B]">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-[#1D1D1F]">{value}</dd>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-[#F8F8FA] px-3.5 py-3 text-left transition-colors hover:bg-[#F2F2F7] active:scale-[0.995]"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white ${destructive ? "text-rose-600" : "text-[#1D1D1F]"}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-medium ${destructive ? "text-rose-600" : "text-[#1D1D1F]"}`}>{label}</span>
        <span className="block truncate text-xs text-[#86868B]">{hint}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-[#86868B]" />
    </button>
  );
}

function ScopeOption({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
        selected ? "border-[#1D1D1F] bg-white shadow-xs" : "border-black/[0.06] bg-[#F8F8FA] hover:bg-[#F2F2F7]"
      }`}
    >
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-[#1D1D1F] bg-[#1D1D1F]" : "border-gray-300 bg-white"}`}>
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span>
        <span className="block text-sm font-medium text-[#1D1D1F]">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[#86868B]">{description}</span>
      </span>
    </button>
  );
}

function DeleteOption({
  title,
  description,
  onClick,
  busy,
  danger,
  recommended,
}: {
  title: string;
  description: string;
  onClick: () => void;
  busy: boolean;
  danger?: boolean;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors disabled:opacity-50 ${
        danger ? "border-rose-200 bg-rose-50 hover:bg-rose-100" : "border-black/[0.06] bg-[#F8F8FA] hover:bg-[#F2F2F7]"
      }`}
    >
      <Trash2 size={16} className={`mt-0.5 shrink-0 ${danger ? "text-rose-600" : "text-[#86868B]"}`} />
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-2 text-sm font-medium ${danger ? "text-rose-700" : "text-[#1D1D1F]"}`}>
          {title}
          {recommended && (
            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700">
              Mantém o histórico
            </span>
          )}
        </span>
        <span className={`mt-0.5 block text-xs leading-relaxed ${danger ? "text-rose-700" : "text-[#86868B]"}`}>{description}</span>
      </span>
      {busy && <Loader2 size={15} className="mt-0.5 animate-spin text-[#86868B]" />}
    </button>
  );
}
