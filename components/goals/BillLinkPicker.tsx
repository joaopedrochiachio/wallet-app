"use client";

import { CalendarClock } from "lucide-react";
import type { GoalBillLink } from "@/types";
import type { LinkableBill, LinkableBillOccurrence } from "@/lib/utils/goalBills";

const selectClass =
  "w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none focus:ring-2 focus:ring-black/10 transition-all cursor-pointer";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface BillLinkPickerProps {
  bills: LinkableBill[];
  value: GoalBillLink | null;
  /** Recebe a ocorrência escolhida para a tela preencher valor alvo e prazo. */
  onChange: (link: GoalBillLink | null, occurrence: LinkableBillOccurrence | null, bill: LinkableBill | null) => void;
  /** Valor já guardado, para mostrar quanto ainda falta. */
  saved: number;
}

/**
 * Liga a meta a uma conta futura do planejamento (ex.: IPVA de janeiro).
 * O valor guardado na meta abate dessa conta no planejamento.
 */
export function BillLinkPicker({ bills, value, onChange, saved }: BillLinkPickerProps) {
  const selectedBill = value ? bills.find((bill) => bill.item.id === value.recurringItemId) ?? null : null;
  const selectedOccurrence = selectedBill?.occurrences.find((occ) => occ.periodKey === value?.periodKey) ?? null;
  // Vínculo antigo cuja ocorrência já passou ou foi paga: mantém visível para poder trocar.
  const staleLink = value && !selectedOccurrence;

  const pickBill = (itemId: string) => {
    const bill = bills.find((candidate) => candidate.item.id === itemId);
    if (!bill) return onChange(null, null, null);
    const occurrence = bill.occurrences[0];
    onChange({ recurringItemId: bill.item.id, periodKey: occurrence.periodKey }, occurrence, bill);
  };

  const pickOccurrence = (periodKey: string) => {
    if (!selectedBill) return;
    const occurrence = selectedBill.occurrences.find((occ) => occ.periodKey === periodKey);
    if (occurrence) onChange({ recurringItemId: selectedBill.item.id, periodKey }, occurrence, selectedBill);
  };

  const remaining = selectedOccurrence ? Math.max(0, selectedOccurrence.amount - Math.max(0, saved)) : 0;

  return (
    <div className="space-y-2 rounded-2xl border border-black/[0.06] bg-[#F2F2F7]/60 p-3.5">
      <div className="space-y-0.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1D1D1F]">
          <CalendarClock size={14} className="text-[var(--fb-accent)]" />
          Guardar para uma conta futura
        </span>
        <p className="text-[10px] text-[#86868B]">
          Opcional. O que estiver guardado na meta é descontado dessa conta no planejamento.
        </p>
      </div>

      {bills.length === 0 && !value ? (
        <p className="text-[11px] text-[#86868B]">
          Nenhuma conta futura no débito/Pix. Cadastre a conta no Planejamento para vinculá-la.
        </p>
      ) : (
        <>
          <select
            aria-label="Conta futura"
            value={selectedBill ? selectedBill.item.id : ""}
            onChange={(e) => pickBill(e.target.value)}
            className={selectClass}
          >
            <option value="">Nenhuma conta</option>
            {bills.map((bill) => (
              <option key={bill.item.id} value={bill.item.id}>
                {bill.item.title} · {money(bill.occurrences[0].amount)}
              </option>
            ))}
          </select>

          {selectedBill && selectedBill.occurrences.length > 1 && (
            <select
              aria-label="Mês da conta"
              value={selectedOccurrence?.periodKey ?? ""}
              onChange={(e) => pickOccurrence(e.target.value)}
              className={selectClass}
            >
              {selectedBill.occurrences.map((occ) => (
                <option key={occ.periodKey} value={occ.periodKey}>
                  {occ.periodLabel} · {money(occ.amount)}
                </option>
              ))}
            </select>
          )}

          {selectedOccurrence && (
            <p className="text-[11px] text-[#1D1D1F]">
              Conta de {selectedOccurrence.periodLabel}: <strong className="font-mono tabular-nums">{money(selectedOccurrence.amount)}</strong>
              {" · "}
              {remaining > 0 ? (
                <>faltam <strong className="font-mono tabular-nums">{money(remaining)}</strong></>
              ) : (
                <span className="text-emerald-700">totalmente coberta</span>
              )}
            </p>
          )}

          {staleLink && (
            <p className="text-[11px] text-amber-800">
              A conta vinculada já foi paga ou não está mais no planejamento. Escolha outra ou{" "}
              <button type="button" onClick={() => onChange(null, null, null)} className="font-semibold underline cursor-pointer">
                remova o vínculo
              </button>.
            </p>
          )}
        </>
      )}
    </div>
  );
}
