"use client";

import { useRef, useState } from "react";
import { useCalendarDay } from "@/lib/hooks/useCalendarDay";
import { Check, Clock3, Loader2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { getPendingDueOccurrences, isSameOrBeforeCalendarDay } from "@/lib/utils/timeProgression";
import { getEffectiveRecurringItemForPeriod } from "@/lib/utils/dateUtils";
import { formatAccountLabel } from "@/lib/utils/ledger";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PendingConfirmations() {
  const { recurringItems, cards, transactions, realizeRecurringItemNow } = useWallet();
  const [processing, setProcessing] = useState<string | null>(null);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const today = useCalendarDay();
  const pending = getPendingDueOccurrences(recurringItems, cards, transactions, today).filter((occurrence) => !occurrence.isCredit);
  if (pending.length === 0 && !feedback && !error) return null;
  const visible = showAll ? pending : pending.slice(0, 5);

  return (
    <section data-testid="pending-confirmations" className="space-y-3 rounded-[26px] border border-amber-200/70 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Clock3 size={18} className="text-amber-600" /> A confirmar</h2>
      <p className="text-xs leading-relaxed text-[#86868B]">Vencer não significa que o dinheiro entrou ou saiu. Confirme aqui somente o que já recebeu ou pagou.</p>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      {feedback && <p role="status" className="text-xs text-emerald-700">{feedback}</p>}
      <div className="divide-y divide-black/[0.05]">
        {visible.map((occurrence) => {
          const isIncome = occurrence.type === "in";
          const isOverdue = !isSameOrBeforeCalendarDay(today, occurrence.dueDate);
          return <div key={occurrence.occurrenceId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{occurrence.description}</p><p className={`mt-1 text-xs ${isOverdue ? "text-rose-600" : "text-amber-700"}`}>{isOverdue ? isIncome ? "Recebimento atrasado" : "Vencido" : "Previsto para hoje"} · {occurrence.dueDate.toLocaleDateString("pt-BR")} · {money(occurrence.amount)}</p><p className="mt-1 break-words text-xs text-[#86868B]">{isIncome ? "Receber em" : "Debitar de"}: {formatAccountLabel(cards.find((card) => card.id === occurrence.cardId)?.name || occurrence.paymentMethod)}</p></div>
            <button type="button" disabled={processing !== null} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1D1D1F] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer" onClick={async () => {
              if (busy.current) return;
              const item = recurringItems.find((candidate) => candidate.id === occurrence.recurringItemId);
              if (!item) return;
              busy.current = true; setProcessing(occurrence.occurrenceId); setError(null); setFeedback(null);
              try {
                await realizeRecurringItemNow(getEffectiveRecurringItemForPeriod(item, occurrence.periodKey), occurrence.dueDate.getFullYear(), occurrence.dueDate.getMonth(), occurrence.amount);
                setFeedback(`${occurrence.description}: ${isIncome ? "recebimento" : "pagamento"} confirmado.`);
              } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível confirmar. Tente novamente."); }
              finally { busy.current = false; setProcessing(null); }
            }}>{processing === occurrence.occurrenceId ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {isIncome ? "Recebi" : "Paguei"}</button>
          </div>;
        })}
      </div>
      {pending.length > 5 && <button type="button" onClick={() => setShowAll((value) => !value)} className="text-xs font-semibold text-[#0071E3] cursor-pointer">{showAll ? "Mostrar menos" : `Ver todos os ${pending.length} itens`}</button>}
    </section>
  );
}
