"use client";

import { useState } from "react";
import { useCalendarDay } from "@/lib/hooks/useCalendarDay";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { EXPENSE_CATEGORIES } from "@/components/ui/AddTransactionSheet";
import { getCategoryBudgetProgress } from "@/lib/utils/categoryBudgets";
import { validateCurrency } from "@/lib/utils/security";
import type { CategoryBudget } from "@/types";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CategoryBudgets() {
  const { userProfile, transactions, saveCategoryBudgets } = useWallet();
  const budgets = userProfile.categoryBudgets || [];
  const [monthOffset, setMonthOffset] = useState(0);
  const now = useCalendarDay();
  const month = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const progress = getCategoryBudgetProgress(budgets, transactions, month.getFullYear(), month.getMonth());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [alertPercent, setAlertPercent] = useState("80");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categories = Array.from(new Set([...EXPENSE_CATEGORIES, ...transactions.filter((tx) => tx.type === "despesa").map((tx) => tx.category), ...budgets.map((budget) => budget.category)]));
  const alerts = progress.filter((budget) => budget.status !== "normal");

  const openForm = (budget?: CategoryBudget) => {
    setEditingId(budget?.id || null);
    setCategory(budget?.category || categories.find((name) => !budgets.some((item) => item.category === name)) || categories[0]);
    setAmount(budget ? budget.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
    setAlertPercent(String(budget?.alertPercent ?? 80));
    setError(null);
    setIsFormOpen(true);
  };

  return (
    <section id="category-budgets" data-testid="category-budgets" className="min-w-0 space-y-4 rounded-[26px] border border-black/[0.05] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#1D1D1F]"><Wallet size={18} /> Orçamento por categoria</h2>
          <p className="mt-1 text-xs text-[#86868B]">Defina seus limites mensais e acompanhe quanto ainda pode gastar.</p>
        </div>
        <button type="button" onClick={() => openForm()} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-full bg-[#1D1D1F] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"><Plus size={14} /> Definir limite</button>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <button type="button" aria-label="Ver orçamento do mês anterior" onClick={() => setMonthOffset((offset) => offset - 1)} className="rounded-full bg-[#F2F2F7] p-2 cursor-pointer"><ChevronLeft size={16} /></button>
        <span className="font-semibold capitalize">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
        <button type="button" aria-label="Ver orçamento do próximo mês" disabled={monthOffset >= 0} onClick={() => setMonthOffset((offset) => offset + 1)} className="rounded-full bg-[#F2F2F7] p-2 disabled:opacity-30 cursor-pointer"><ChevronRight size={16} /></button>
      </div>

      {isFormOpen && (
        <form className="space-y-3 rounded-2xl border border-black/[0.06] bg-[#F8F8FA] p-3 sm:p-4" onSubmit={async (event) => {
          event.preventDefault();
          if (isSaving) return;
          const currency = validateCurrency(amount, { min: 0.01, max: 100_000_000 });
          if (!currency.isValid) { setError(currency.error || "Informe um limite válido."); return; }
          const budget = { id: editingId || crypto.randomUUID(), category, amount: currency.value, alertPercent: Number(alertPercent) };
          setIsSaving(true); setError(null);
          try {
            await saveCategoryBudgets([...budgets.filter((item) => item.id !== editingId), budget]);
            setIsFormOpen(false);
          } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar. Tente novamente."); }
          finally { setIsSaving(false); }
        }}>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
            <label className="min-w-0 space-y-1 text-xs font-medium text-[#6E6E73]">Categoria
              <select aria-label="Categoria do orçamento" value={category} onChange={(event) => setCategory(event.target.value)} disabled={isSaving} className="block w-full min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#1D1D1F]">
                {categories.map((name) => <option key={name} value={name} disabled={budgets.some((budget) => budget.category === name && budget.id !== editingId)}>{name}</option>)}
              </select>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-[#6E6E73]">Limite mensal (R$)
              <input aria-label="Limite mensal em reais" inputMode="decimal" value={amount} required disabled={isSaving} onChange={(event) => setAmount(event.target.value)} placeholder="Ex: 500,00" className="block w-full min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#1D1D1F]" />
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-[#6E6E73]">Alertar em (%)
              <input aria-label="Percentual para alertar" type="number" min={1} max={100} step={1} required disabled={isSaving} value={alertPercent} onChange={(event) => setAlertPercent(event.target.value)} className="block w-full min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#1D1D1F]" />
            </label>
          </div>
          <p className="text-[11px] text-[#86868B]">O limite se renova todo mês. Alterar um limite atualiza a configuração usada na comparação dos meses.</p>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={isSaving} className="rounded-full bg-[#1D1D1F] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer">{isSaving ? "Salvando..." : "Salvar limite"}</button>
            <button type="button" disabled={isSaving} onClick={() => { setIsFormOpen(false); setError(null); }} className="px-2 py-2 text-xs text-[#86868B] cursor-pointer">Cancelar</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      {alerts.length > 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{alerts.map((budget) => `${budget.category}: ${budget.percent}% do limite${budget.remaining < 0 ? `, excedeu ${money(-budget.remaining)}` : `, restam ${money(budget.remaining)}`}`).join(" · ")}</p>}
      {progress.length === 0 ? <p className="rounded-2xl bg-[#F8F8FA] p-4 text-sm text-[#86868B]">Comece com uma categoria, como alimentação ou transporte. Você verá os gastos, o limite e o valor que ainda resta.</p> : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {progress.map((budget) => <article key={budget.id} className="min-w-0 space-y-3 rounded-2xl border border-black/[0.06] p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><h3 className="break-words text-sm font-semibold">{budget.category}</h3><p className={`mt-1 text-xs font-medium ${budget.status === "exceeded" ? "text-rose-600" : budget.status === "warning" ? "text-amber-700" : "text-emerald-700"}`}>{budget.status === "exceeded" ? "Limite atingido" : budget.status === "warning" ? "Perto do limite" : "Dentro do limite"}</p></div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => openForm(budget)} disabled={isSaving} aria-label={`Editar limite de ${budget.category}`} className="rounded-full p-2 text-[#86868B] hover:bg-[#F2F2F7] cursor-pointer"><Pencil size={14} /></button>
                <button type="button" disabled={isSaving} aria-label={`Remover limite de ${budget.category}`} className="rounded-full p-2 text-[#86868B] hover:bg-rose-50 cursor-pointer" onClick={async () => {
                  setIsSaving(true); setError(null);
                  try { await saveCategoryBudgets(budgets.filter((item) => item.id !== budget.id)); }
                  catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível remover o limite."); }
                  finally { setIsSaving(false); }
                }}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#F2F2F7]" role="progressbar" aria-label={`Uso do orçamento de ${budget.category}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, budget.percent)} aria-valuetext={`${money(budget.spent)} de ${money(budget.amount)}`}>
              <div className={`h-full rounded-full ${budget.status === "exceeded" ? "bg-rose-500" : budget.status === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, budget.percent)}%` }} />
            </div>
            <div className="flex flex-wrap justify-between gap-1 text-xs text-[#86868B]"><span>Gastos: <strong className="text-[#1D1D1F]">{money(budget.spent)}</strong></span><span>Limite: {money(budget.amount)}</span></div>
            <p className="text-xs font-semibold">{budget.remaining >= 0 ? `Ainda pode gastar ${money(budget.remaining)}` : `${money(-budget.remaining)} acima do limite`}</p>
          </article>)}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-[#86868B]">Consideramos os gastos registrados no mês, descontando estornos da mesma categoria. Parcelas entram no mês de cada cobrança; pagar a fatura ou transferir para uma meta não conta como um novo gasto.</p>
    </section>
  );
}
