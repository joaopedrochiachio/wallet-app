"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  AlertCircle,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { AddCardSheet } from "@/components/ui/AddCardSheet";

export default function CardsPage() {
  const { cards, updateCardLimit, payInvoice, mainBalance, addCard, deleteCard } = useWallet();
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [newLimitInput, setNewLimitInput] = useState("");
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const creditCards = cards.filter((c) => c.type === "credit");

  const handleStartEditLimit = (cardId: string, currentLimit: number) => {
    setEditingCardId(cardId);
    setNewLimitInput(currentLimit.toString());
  };

  const handleSaveLimit = (cardId: string) => {
    const num = parseFloat(newLimitInput.replace(/\./g, "").replace(",", "."));
    if (!isNaN(num) && num > 0) {
      updateCardLimit(cardId, num);
    }
    setEditingCardId(null);
  };

  const handlePayInvoice = (cardId: string, cardName: string, amount: number) => {
    if (mainBalance < amount) {
      alert("Saldo na Conta Principal insuficiente para quitar esta fatura!");
      return;
    }
    payInvoice(cardId);
    setPaymentSuccessMessage(`Fatura do ${cardName} paga com sucesso!`);
    setTimeout(() => setPaymentSuccessMessage(null), 4000);
  };

  return (
    <div className="min-h-full bg-[#F2F2F7] p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto pt-2 md:pt-0">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Motor de Cartões de Crédito
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Cartões & Faturas
          </h1>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-black/[0.04] shadow-xs">
            <span className="text-xs text-[#86868B]">Saldo Disponível:</span>
            <span className="text-xs font-semibold text-[#1D1D1F]">
              R$ {formatCurrency(mainBalance)}
            </span>
          </div>

          <button
            onClick={() => setIsAddCardOpen(true)}
            className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus strokeWidth={2} size={15} />
            <span>Novo Cartão</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {paymentSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{paymentSuccessMessage}</span>
          </div>
        )}

        {/* Informação sobre a Regra de Negócio (agent.md Seção 5.3) */}
        <div className="bg-white rounded-[20px] p-5 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
            <ShieldCheck strokeWidth={1.5} size={18} />
          </div>
          <div className="text-xs space-y-1">
            <h3 className="font-semibold text-[#1D1D1F]">Controle Inteligente de Crédito</h3>
            <p className="text-[#86868B] leading-relaxed">
              Compras no cartão de crédito impactam a fatura em aberto e consomem o limite do cartão. O seu Saldo Principal só é debitado quando você efetua o pagamento da fatura.
            </p>
          </div>
        </div>

        {/* Lista de Cartões de Crédito */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#86868B] px-1">
            Faturas em Aberto
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creditCards.map((card) => {
              const invoice = card.invoiceAmount || 0;
              const availableLimit = Math.max(0, card.limit - card.spent);
              const percentUsed = Math.min(100, Math.round((card.spent / card.limit) * 100));
              const isEditing = editingCardId === card.id;

              return (
                <div
                  key={card.id}
                  className="bg-white rounded-[24px] p-6 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between space-y-5"
                >
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.colorScheme.gradient} text-white flex items-center justify-center shadow-xs`}
                      >
                        <CreditCard strokeWidth={1.5} size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#1D1D1F]">{card.name}</h3>
                        <p className="text-xs text-[#86868B]">{card.brand}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F2F2F7] text-[#86868B]">
                        Fecha dia {card.closingDay}
                      </span>
                      {cards.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Deseja remover o cartão ${card.name}?`)) {
                              deleteCard(card.id);
                            }
                          }}
                          className="w-7 h-7 rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Excluir Cartão"
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Informação de Fatura Atual */}
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wider text-[#86868B] font-medium">
                      Fatura Atual (Vence dia {card.dueDay})
                    </span>
                    <div className="text-3xl font-light text-[#1D1D1F] tracking-tight">
                      R$ {formatCurrency(invoice)}
                    </div>
                  </div>

                  {/* Barra de Progresso de Limite */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#86868B]">
                        Utilizado:{" "}
                        <strong className="text-[#1D1D1F]">R$ {formatCurrency(card.spent)}</strong>
                      </span>
                      <span className="text-[#86868B]">
                        Disponível:{" "}
                        <strong className="text-[#1D1D1F]">R$ {formatCurrency(availableLimit)}</strong>
                      </span>
                    </div>

                    <div className="w-full h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percentUsed > 85 ? "bg-rose-500" : "bg-[#1D1D1F]"
                        }`}
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>

                    {/* Limite Total e Ajuste */}
                    <div className="flex justify-between items-center text-xs pt-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 bg-[#F2F2F7] px-2.5 py-1 rounded-lg">
                          <span className="text-[#86868B]">Limite R$</span>
                          <input
                            type="number"
                            value={newLimitInput}
                            onChange={(e) => setNewLimitInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveLimit(card.id)}
                            className="w-20 bg-transparent text-[#1D1D1F] font-semibold outline-none text-xs"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveLimit(card.id)}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingCardId(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#86868B]">
                          Limite total:{" "}
                          <strong className="text-[#1D1D1F]">R$ {formatCurrency(card.limit)}</strong>
                        </span>
                      )}

                      {!isEditing && (
                        <button
                          onClick={() => handleStartEditLimit(card.id, card.limit)}
                          className="text-[#86868B] hover:text-[#1D1D1F] font-medium flex items-center gap-1"
                        >
                          <SlidersHorizontal size={12} />
                          <span>Ajustar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ação de Pagamento */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[#86868B]">
                      {invoice > 0 ? "Fatura aberta para pagamento" : "Fatura zerada"}
                    </span>
                    <button
                      onClick={() => handlePayInvoice(card.id, card.name, invoice)}
                      disabled={invoice === 0}
                      className={`text-xs font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
                        invoice > 0
                          ? "bg-[#1D1D1F] hover:bg-black text-white shadow-xs active:scale-[0.98]"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <CheckCircle2 strokeWidth={1.5} size={14} />
                      <span>Pagar Fatura</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Projeção de Compras Parceladas */}
        <section className="bg-white rounded-[20px] p-6 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F]">Projeção de Parcelas Futuras</h2>
              <p className="text-xs text-[#86868B]">Impacto nos meses subsequentes</p>
            </div>
            <span className="text-xs font-medium text-[#86868B] bg-[#F2F2F7] px-2.5 py-1 rounded-full">
              Outubro & Novembro
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-[#F2F2F7]/60 space-y-1">
              <span className="text-[11px] uppercase font-semibold text-[#86868B] tracking-wider">
                Outubro 2026
              </span>
              <div className="text-lg font-semibold text-[#1D1D1F]">R$ 485,00</div>
              <p className="text-xs text-[#86868B]">2 parcelas programadas</p>
            </div>

            <div className="p-4 rounded-xl bg-[#F2F2F7]/60 space-y-1">
              <span className="text-[11px] uppercase font-semibold text-[#86868B] tracking-wider">
                Novembro 2026
              </span>
              <div className="text-lg font-semibold text-[#1D1D1F]">R$ 210,00</div>
              <p className="text-xs text-[#86868B]">1 parcela programada</p>
            </div>
          </div>
        </section>
      </div>

      {/* Modal Bottom Sheet de Criação de Novo Cartão */}
      <AddCardSheet
        isOpen={isAddCardOpen}
        onClose={() => setIsAddCardOpen(false)}
        onAddCard={addCard}
      />
    </div>
  );
}
