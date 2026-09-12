"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  CreditCard,
  Building2,
  TrendingUp,
  ShieldCheck,
  X,
  Check,
} from "lucide-react";

export default function PlanningPage() {
  const {
    recurringItems,
    addRecurringItem,
    toggleRecurringItem,
    deleteRecurringItem,
    getMonthlyProjection,
    cards,
  } = useWallet();

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0); // 0=Set, 1=Out, 2=Nov, 3=Dez
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);

  // Form para nova conta recorrente
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newAccount, setNewAccount] = useState("Débito/Pix");
  const [newDueDay, setNewDueDay] = useState("10");
  const [newCategory, setNewCategory] = useState("Moradia");

  const projection = getMonthlyProjection(selectedMonthIndex);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const months = ["Setembro (Atual)", "Outubro", "Novembro", "Dezembro"];

  // Separar contas recorrentes por canal: Débito vs Crédito
  const debitRecurring = recurringItems.filter((r) => r.account === "Débito/Pix");
  const creditRecurring = recurringItems.filter((r) => r.account !== "Débito/Pix");

  const freePercentage = Math.max(
    0,
    Math.round((projection.projectedFreeBalance / projection.projectedIncome) * 100)
  );

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(newAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(cleanAmount) || cleanAmount <= 0 || !newTitle.trim()) return;

    addRecurringItem({
      title: newTitle.trim(),
      amount: cleanAmount,
      account: newAccount,
      category: newCategory,
      dueDay: parseInt(newDueDay) || 10,
      active: true,
    });

    setNewTitle("");
    setNewAmount("");
    setIsAddingModalOpen(false);
  };

  return (
    <div className="min-h-full bg-[#F2F2F7] p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500 relative">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Visão Futura & Previsibilidade
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Planejamento Mensal
          </h1>
        </div>

        <button
          onClick={() => setIsAddingModalOpen(true)}
          className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
        >
          <Plus strokeWidth={2} size={15} />
          <span>Nova Conta Recorrente</span>
        </button>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Seletor de Mês (Segmented Control iOS) */}
        <div className="bg-[#E5E5EA]/70 p-1 rounded-full flex items-center gap-1 overflow-x-auto border border-black/5 scrollbar-none">
          {months.map((m, idx) => (
            <button
              key={m}
              onClick={() => setSelectedMonthIndex(idx)}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-full text-xs font-semibold transition-all select-none text-center ${
                selectedMonthIndex === idx
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* 3 Cartões Chave (Visão Clara e Direta) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Renda Prevista */}
          <div className="bg-white rounded-[20px] p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#86868B]">
              Renda Prevista
            </span>
            <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
              R$ {formatCurrency(projection.projectedIncome)}
            </div>
            <p className="text-xs text-[#86868B]">Salário & Entradas Fixas</p>
          </div>

          {/* 2. Total Comprometido */}
          <div className="bg-white rounded-[20px] p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#86868B]">
              Total Comprometido
            </span>
            <div className="text-2xl font-semibold text-rose-600 tracking-tight">
              - R$ {formatCurrency(projection.totalCommitted)}
            </div>
            <p className="text-xs text-[#86868B]">
              Fixas no Débito + Faturas de Cartão
            </p>
          </div>

          {/* 3. Saldo Livre Projetado */}
          <div className="bg-white rounded-[20px] p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#86868B]">
                Saldo Livre Projetado
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                {freePercentage}% livre
              </span>
            </div>
            <div className="text-2xl font-semibold text-emerald-600 tracking-tight">
              R$ {formatCurrency(projection.projectedFreeBalance)}
            </div>
            <p className="text-xs text-[#86868B]">Disponível para metas ou lazer</p>
          </div>
        </div>

        {/* Detalhe do Comprometimento do Mês Selecionado */}
        {projection.cardInstallments > 0 && (
          <div className="bg-white rounded-[20px] p-4 border border-black/[0.04] shadow-xs flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#86868B]">
              <CreditCard size={16} className="text-[#1D1D1F]" />
              <span>
                Este mês inclui{" "}
                <strong className="text-[#1D1D1F]">
                  R$ {formatCurrency(projection.cardInstallments)}
                </strong>{" "}
                em parcelas programadas de compras anteriores.
              </span>
            </div>
          </div>
        )}

        {/* Bloco 1: Contas no Débito / Conta Corrente */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-[#1D1D1F]" />
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                No Débito / Conta Principal (Saem direto do saldo)
              </h2>
            </div>
            <span className="text-xs font-medium text-[#86868B]">
              Total: R$ {formatCurrency(projection.recurringDebitTotal)}
            </span>
          </div>

          <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            {debitRecurring.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#86868B]">
                Nenhuma conta fixa cadastrada no débito.
              </div>
            ) : (
              debitRecurring.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-4 hover:bg-[#F2F2F7]/50 transition-colors ${
                    idx !== debitRecurring.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleRecurringItem(item.id)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        item.active
                          ? "bg-[#1D1D1F] border-[#1D1D1F] text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {item.active && <Check size={12} strokeWidth={3} />}
                    </button>
                    <div>
                      <h3
                        className={`text-sm font-semibold transition-all ${
                          item.active ? "text-[#1D1D1F]" : "text-gray-400 line-through"
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#86868B]">
                        Vence todo dia {item.dueDay} • {item.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-semibold tracking-tight ${
                        item.active ? "text-[#1D1D1F]" : "text-gray-400"
                      }`}
                    >
                      R$ {formatCurrency(item.amount)}
                    </span>
                    <button
                      onClick={() => deleteRecurringItem(item.id)}
                      className="text-gray-300 hover:text-rose-500 transition-colors p-1"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Bloco 2: Assinaturas no Cartão de Crédito */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-[#1D1D1F]" />
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
                No Cartão de Crédito (Entram nas faturas futuras)
              </h2>
            </div>
            <span className="text-xs font-medium text-[#86868B]">
              Total: R$ {formatCurrency(projection.recurringCreditTotal)}
            </span>
          </div>

          <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
            {creditRecurring.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#86868B]">
                Nenhuma assinatura cadastrada no cartão.
              </div>
            ) : (
              creditRecurring.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-4 hover:bg-[#F2F2F7]/50 transition-colors ${
                    idx !== creditRecurring.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleRecurringItem(item.id)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        item.active
                          ? "bg-[#1D1D1F] border-[#1D1D1F] text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {item.active && <Check size={12} strokeWidth={3} />}
                    </button>
                    <div>
                      <h3
                        className={`text-sm font-semibold transition-all ${
                          item.active ? "text-[#1D1D1F]" : "text-gray-400 line-through"
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#86868B]">
                        Cobrado dia {item.dueDay} • Cartão {item.account}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-semibold tracking-tight ${
                        item.active ? "text-[#1D1D1F]" : "text-gray-400"
                      }`}
                    >
                      R$ {formatCurrency(item.amount)}
                    </span>
                    <button
                      onClick={() => deleteRecurringItem(item.id)}
                      className="text-gray-300 hover:text-rose-500 transition-colors p-1"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Modal de Nova Conta Recorrente */}
      {isAddingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsAddingModalOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          />

          <div className="relative w-full max-w-md bg-white rounded-[28px] p-6 space-y-5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                Nova Conta Recorrente
              </h3>
              <button
                onClick={() => setIsAddingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRecurring} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                  Nome da Conta / Assinatura
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Aluguel, Netflix, Internet..."
                  className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                    Valor Mensal (R$)
                  </label>
                  <input
                    type="text"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                    Dia do Mês
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newDueDay}
                    onChange={(e) => setNewDueDay(e.target.value)}
                    placeholder="Dia (1 a 31)"
                    className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                  Onde é cobrado?
                </label>
                <div className="flex gap-2">
                  {["Débito/Pix", "Nubank", "Santander"].map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => setNewAccount(acc)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        newAccount === acc
                          ? "bg-[#1D1D1F] text-white shadow-xs"
                          : "bg-[#F2F2F7] text-[#1D1D1F] hover:bg-gray-200"
                      }`}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm py-3.5 rounded-xl transition-all"
                >
                  Salvar Conta Recorrente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
