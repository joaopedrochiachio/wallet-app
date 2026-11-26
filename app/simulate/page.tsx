"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2, X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useCalendarDay } from "@/lib/hooks/useCalendarDay";
import { collectRunwayEvents } from "@/lib/services/cashRunway";
import { MOVE_LABEL, simulateScenario, type ScenarioMove } from "@/lib/services/scenarioSimulator";
import { AreaChart, DateBlock, Legend, MeterBar, Panel, brl } from "@/components/charts/finance";
import { CardDot, parseCurrencyInput } from "@/components/cards/cardUi";
import { MacSegmentedControl } from "@/components/ui/macos/SegmentedControl";

type MoveKind = ScenarioMove["kind"];

const KIND_HINT: Record<MoveKind, string> = {
  save: "Sai da conta na data, para uma meta ou reserva.",
  debit: "Sai da conta na data.",
  income: "Entra na conta na data.",
  card: "Ocupa o limite agora e sai da conta no vencimento da fatura.",
};

const shortDate = (date: Date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
};
const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromInputDate = (value: string) => new Date(`${value}T12:00:00`);

const inputClass =
  "w-full rounded-[10px] border border-[var(--fb-line-2)] bg-[var(--fb-card)] px-3 py-2.5 text-sm text-[var(--fb-text)] outline-none focus:border-[var(--fb-accent)]";

export default function SimulatePage() {
  const { cards, recurringItems, transactions, goals, cardStatements } = useWallet();
  const todayTime = useCalendarDay().getTime();
  const today = useMemo(() => new Date(todayTime), [todayTime]);
  const creditCards = cards.filter((card) => card.type === "credit");
  const startBalance = cards.filter((card) => card.type === "checking").reduce((sum, card) => sum + (card.balance || 0), 0);

  const [moves, setMoves] = useState<ScenarioMove[]>([]);
  const [kind, setKind] = useState<MoveKind>("save");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toInputDate(today));
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState("1");
  const [label, setLabel] = useState("");

  const baseEvents = useMemo(
    () => collectRunwayEvents({ cards, recurringItems, transactions, goals, today, monthsAhead: 1 }),
    [cards, recurringItems, transactions, goals, today]
  );
  const result = useMemo(() => simulateScenario({
    startBalance,
    baseEvents,
    moves,
    cards,
    statements: cardStatements,
    today,
    horizonEnd: new Date(today.getFullYear(), today.getMonth() + 2, 1),
  }), [startBalance, baseEvents, moves, cards, cardStatements, today]);

  const parsedAmount = parseCurrencyInput(amount);
  const selectedCardId = cardId || creditCards[0]?.id || "";
  const canAdd = parsedAmount > 0 && Boolean(date) && fromInputDate(date) >= today && (kind !== "card" || Boolean(selectedCardId));

  const addMove = () => {
    if (!canAdd) return;
    const id = crypto.randomUUID();
    const base = { id, amount: Math.round(parsedAmount * 100) / 100, date: fromInputDate(date), label: label.trim() || undefined };
    setMoves((previous) => [
      ...previous,
      kind === "card"
        ? { ...base, kind, cardId: selectedCardId, installments: Math.max(1, Math.min(48, Number(installments) || 1)) }
        : { ...base, kind },
    ]);
    setAmount("");
    setLabel("");
  };

  const hasMoves = moves.length > 0;
  const sim = result.simulated;
  const refused = result.cardImpacts.find((impact) => impact.exceedsLimit);
  const chartPoints = result.daily.map((point, index) => ({
    x: index,
    label: shortDate(point.date),
    value: point.simulated,
    compare: hasMoves ? point.base : null,
  }));

  return (
    <div className="min-h-full space-y-5 bg-[#F2F2F7] p-4 font-sans text-[#1D1D1F] animate-in fade-in duration-500 sm:p-6 md:p-10">
      <header className="mx-auto flex max-w-6xl flex-col justify-between gap-4 pt-2 sm:flex-row sm:items-end md:pt-0">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">Planejamento</span>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-[#1D1D1F]">Simular</h1>
        </div>
        <span className="self-start rounded-full border border-black/[0.04] bg-white px-3.5 py-2 text-xs text-[#86868B] sm:self-auto">
          Saldo em conta hoje <strong className="font-semibold text-[#1D1D1F] [font-variant-numeric:tabular-nums]">{brl(startBalance)}</strong>
        </span>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Movimentos hipotéticos */}
        <div className="min-w-0 space-y-5">
          <Panel title="E se…">
            <div className="space-y-4">
              <MacSegmentedControl<MoveKind>
                ariaLabel="Tipo de movimento"
                fullWidth
                value={kind}
                onChange={setKind}
                options={(Object.keys(MOVE_LABEL) as MoveKind[])
                  .filter((key) => key !== "card" || creditCards.length > 0)
                  .map((key) => ({ value: key, label: key === "debit" ? "Débito/Pix" : key === "card" ? "Cartão" : key === "save" ? "Guardar" : "Receber" }))}
              />
              <p className="text-xs text-[var(--fb-text-3)]">{KIND_HINT[kind]}</p>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs text-[var(--fb-text-3)]">
                  Valor
                  <input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} font-mono tabular-nums`} />
                </label>
                <label className="space-y-1 text-xs text-[var(--fb-text-3)]">
                  {kind === "card" ? "Data da compra" : "Data"}
                  <input type="date" min={toInputDate(today)} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                </label>
              </div>

              {kind === "card" && (
                <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
                  <label className="space-y-1 text-xs text-[var(--fb-text-3)]">
                    Cartão
                    <select value={selectedCardId} onChange={(e) => setCardId(e.target.value)} className={`${inputClass} min-w-0 cursor-pointer truncate`}>
                      {creditCards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.name} · {brl(cardStatements[card.id]?.availableLimit ?? card.limit)} livres
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-[var(--fb-text-3)]">
                    Parcelas
                    <input inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value.replace(/\D/g, "").slice(0, 2))} className={`${inputClass} font-mono tabular-nums`} />
                  </label>
                </div>
              )}

              <label className="block space-y-1 text-xs text-[var(--fb-text-3)]">
                Nome (opcional)
                <input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder={MOVE_LABEL[kind]} className={inputClass} />
              </label>

              <button
                type="button"
                onClick={addMove}
                disabled={!canAdd}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#1D1D1F] px-4 py-2.5 text-xs font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={15} /> Adicionar à simulação
              </button>
            </div>
          </Panel>

          {hasMoves && (
            <Panel
              title="Na simulação"
              action={
                <button type="button" onClick={() => setMoves([])} className="touch-target cursor-pointer pb-1.5 text-xs font-medium text-[var(--fb-text-3)] hover:text-[var(--fb-text)]">
                  Limpar
                </button>
              }
            >
              <ul className="divide-y divide-[var(--fb-line)]">
                {moves.map((move) => {
                  const card = move.kind === "card" ? cards.find((candidate) => candidate.id === move.cardId) : undefined;
                  const sign = move.kind === "income" ? "+" : "−";
                  return (
                    <li key={move.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <DateBlock date={move.date} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--fb-text)]">{move.label || MOVE_LABEL[move.kind]}</span>
                        {/* Subtítulo só quando acrescenta algo: o cartão, ou o tipo quando o nome é personalizado. */}
                        {(card || move.label) && (
                          <span className="flex items-center gap-1.5 text-xs text-[var(--fb-text-3)]">
                            {card && <CardDot card={card} size={8} />}
                            {card ? `${card.name}${move.kind === "card" && move.installments > 1 ? ` · ${move.installments}x` : ""}` : MOVE_LABEL[move.kind]}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-semibold text-[var(--fb-text)] [font-variant-numeric:tabular-nums]">{sign} {brl(move.amount)}</span>
                      <button
                        type="button"
                        onClick={() => setMoves((previous) => previous.filter((item) => item.id !== move.id))}
                        aria-label={`Remover ${move.label || MOVE_LABEL[move.kind]}`}
                        className="touch-pad cursor-pointer rounded-lg p-1.5 text-[var(--fb-text-4)] hover:text-[var(--fb-up)]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>

        {/* Resultado */}
        <div className="min-w-0 space-y-5">
          {hasMoves && <ImpactStrip result={result} />}
          <Panel title="Saldo dia a dia" action={hasMoves ? <Legend items={[{ label: "Simulado", color: "var(--fb-accent)" }, { label: "Sem mudanças", color: "var(--fb-text-5)", pattern: "dash" }]} /> : undefined}>
            <div className="space-y-4">
              <Verdict result={result} hasMoves={hasMoves} refusedCard={refused?.card.name} refusedFree={refused?.availableBefore} />
              <AreaChart points={chartPoints} height={220} valueLabel={hasMoves ? "Simulado" : "Saldo"} compareLabel="Sem mudanças" markerX={0} />
            </div>
          </Panel>

          <Panel title="Por recebimento">
            <ol className="divide-y divide-[var(--fb-line)]">
              {sim.segments.map((segment, index) => {
                const lastDay = new Date(segment.endDate.getFullYear(), segment.endDate.getMonth(), segment.endDate.getDate() - 1);
                const basePoint = result.daily.find((point) => point.date.getTime() === lastDay.getTime());
                const delta = basePoint ? Math.round((segment.closingBalance - basePoint.base) * 100) / 100 : 0;
                const ok = !segment.firstUncovered;
                return (
                  <li key={segment.startDate.getTime()} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <DateBlock date={segment.startDate} tone={ok ? "neutral" : "danger"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--fb-text)]">
                        {index === 0 ? "A partir de hoje" : segment.incomes.map((income) => income.title).join(" + ")}
                      </span>
                      <span className="block text-xs text-[var(--fb-text-3)]">
                        até {shortDate(lastDay)} · {segment.bills.length} {segment.bills.length === 1 ? "saída" : "saídas"}
                        {!ok && segment.firstUncovered && <> · <span className="text-[var(--fb-up)]">não cobre {segment.firstUncovered.event.title}</span></>}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold [font-variant-numeric:tabular-nums]" style={{ color: segment.closingBalance < 0 ? "var(--fb-up)" : "var(--fb-text)" }}>
                        {brl(segment.closingBalance)}
                      </span>
                      {hasMoves && Math.abs(delta) >= 0.005 && (
                        <span className="block text-xs [font-variant-numeric:tabular-nums]" style={{ color: delta < 0 ? "var(--fb-up)" : "var(--fb-down)" }}>
                          {delta > 0 ? "+" : "−"} {brl(Math.abs(delta))}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>

          {result.cardImpacts.length > 0 && (
            <Panel title="No cartão">
              <ul className="space-y-4">
                {result.cardImpacts.map((impact) => {
                  const move = moves.find((item) => item.id === impact.moveId);
                  return (
                    <li key={impact.moveId} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--fb-text)]">
                          <CardDot card={impact.card} />
                          <span className="truncate">{move?.label || impact.card.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-[var(--fb-text-3)]">
                          limite livre{" "}
                          <span className="font-semibold [font-variant-numeric:tabular-nums]" style={{ color: impact.exceedsLimit ? "var(--fb-up)" : "var(--fb-text)" }}>
                            {brl(impact.availableAfter)}
                          </span>
                        </span>
                      </div>
                      <MeterBar value={impact.card.limit - Math.max(0, impact.availableAfter)} max={impact.card.limit || 1} />
                      <div className="flex flex-wrap gap-1.5">
                        {impact.installments.map((installment) => (
                          <span key={installment.invoiceKey} className="rounded-full bg-[var(--fb-card-2)] px-2.5 py-1 text-[11px] text-[var(--fb-text-2)]">
                            fatura de {monthLabel(installment.invoiceKey)} · vence {shortDate(installment.dueDate)} ·{" "}
                            <span className="font-semibold [font-variant-numeric:tabular-nums]">{brl(installment.amount)}</span>
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Verdict({
  result,
  hasMoves,
  refusedCard,
  refusedFree,
}: {
  result: ReturnType<typeof simulateScenario>;
  hasMoves: boolean;
  refusedCard?: string;
  refusedFree?: number;
}) {
  const sim = result.simulated;
  if (refusedCard !== undefined) {
    return (
      <p className="flex items-start gap-2 text-sm text-[var(--fb-up)]">
        <X size={16} className="mt-0.5 shrink-0" />
        <span>O {refusedCard} recusaria a compra: só tem {brl(Math.max(0, refusedFree ?? 0))} de limite livre.</span>
      </p>
    );
  }
  if (sim.firstUncovered) {
    return (
      <p className="flex items-start gap-2 text-sm text-[var(--fb-up)]">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          Não cabe. Em <strong>{shortDate(sim.firstUncovered.event.date)}</strong> faltam{" "}
          <strong className="[font-variant-numeric:tabular-nums]">{brl(-sim.firstUncovered.balanceAfter)}</strong> para {sim.firstUncovered.event.title}.
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 text-sm text-[var(--fb-text)]">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--fb-down)]" />
      {hasMoves ? (
        // Os números do impacto ficam na faixa de cima; aqui só o veredito.
        <span>Cabe. Nenhuma conta fica sem saldo no período.</span>
      ) : (
        <span>
          Tudo pago até o fim do mês que vem. Menor saldo{" "}
          <strong className="[font-variant-numeric:tabular-nums]">{brl(sim.lowestBalance)}</strong> em {shortDate(sim.lowestDate)}.
        </span>
      )}
    </p>
  );
}

/** Antes → depois dos números que a simulação mexe. */
function ImpactStrip({ result }: { result: ReturnType<typeof simulateScenario> }) {
  const last = result.daily[result.daily.length - 1];
  const freeBefore = result.cardImpacts.reduce((sum, impact) => sum + impact.availableBefore, 0);
  const freeAfter = result.cardImpacts.reduce((sum, impact) => sum + impact.availableAfter, 0);
  const daysNegative = result.daily.filter((point) => point.simulated < 0).length;
  const tiles = [
    {
      label: `Menor saldo · ${shortDate(result.simulated.lowestDate)}`,
      value: result.simulated.lowestBalance,
      delta: result.simulated.lowestBalance - result.base.lowestBalance,
    },
    last && {
      label: `Sobra em ${shortDate(last.date)}`,
      value: last.simulated,
      delta: last.simulated - last.base,
    },
    result.cardImpacts.length > 0 && {
      label: result.cardImpacts.length === 1 ? `Limite livre · ${result.cardImpacts[0].card.name}` : "Limite livre nos cartões",
      value: freeAfter,
      delta: freeAfter - freeBefore,
    },
  ].filter(Boolean) as { label: string; value: number; delta: number }[];

  return (
    <section aria-label="Impacto da simulação" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="min-w-0 rounded-[12px] bg-[var(--fb-card)] px-4 py-3.5 shadow-[var(--fb-shadow)]">
          <span className="block truncate text-xs text-[var(--fb-text-3)]">{tile.label}</span>
          <span
            className="block text-xl font-extrabold leading-8 [font-variant-numeric:tabular-nums]"
            style={{ color: tile.value < 0 ? "var(--fb-up)" : "var(--fb-text)" }}
          >
            {brl(tile.value)}
          </span>
          <span className="block text-xs [font-variant-numeric:tabular-nums]" style={{ color: tile.delta < -0.005 ? "var(--fb-up)" : tile.delta > 0.005 ? "var(--fb-down)" : "var(--fb-text-4)" }}>
            {Math.abs(tile.delta) < 0.005 ? "sem mudança" : `${tile.delta > 0 ? "+" : "−"} ${brl(Math.abs(tile.delta))} vs hoje`}
          </span>
        </div>
      ))}
      {daysNegative > 0 && (
        <p className="text-xs text-[var(--fb-up)] sm:col-span-3">
          {daysNegative} {daysNegative === 1 ? "dia" : "dias"} com saldo negativo na simulação.
        </p>
      )}
    </section>
  );
}
