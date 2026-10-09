"use client";

import { useState } from "react";
import { useWallet, TransactionItem } from "@/context/WalletContext";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  ShieldCheck,
  Check,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { AddCardSheet } from "@/components/ui/AddCardSheet";
import { AddTransactionSheet } from "@/components/ui/AddTransactionSheet";
import { AppleConfirmModal } from "@/components/ui/AppleConfirmModal";
import { MiniCard } from "@/components/wallet";
import { getPlanningMonths, getPeriodKey, MONTH_NAMES_PT } from "@/lib/utils/dateUtils";
import {
  getInvoiceDueDate,
  getLedgerEntryDate,
  matchesLedgerCard,
  getCardInvoiceRecurringDetails,
  getCardOpenInvoiceDetails,
} from "@/lib/utils/ledger";

export default function CardsPage() {
  const {
    cards,
    transactions,
    recurringItems,
    deleteTransaction,
    updateCardLimit,
    payInvoice,
    mainBalance,
    addCard,
    deleteCard,
    getMonthlyProjection,
    accountOptions,
  } = useWallet();
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [newLimitInput, setNewLimitInput] = useState("");
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  const [isPayingInvoice, setIsPayingInvoice] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [selectedCardForTx, setSelectedCardForTx] = useState<string>("NuBank");
  const [txToDelete, setTxToDelete] = useState<TransactionItem | null>(null);
  const [confirmPayModal, setConfirmPayModal] = useState<{
    isOpen: boolean;
    cardId: string;
    cardName: string;
    amount: number;
  } | null>(null);
  const [confirmDeleteCardModal, setConfirmDeleteCardModal] = useState<{
    isOpen: boolean;
    cardId: string;
    cardName: string;
  } | null>(null);

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

  const handleExecutePayInvoice = async () => {
    if (!confirmPayModal) return;
    const { cardId, cardName, amount } = confirmPayModal;
    if (mainBalance < amount) {
      setPaymentErrorMessage("Saldo na Conta Principal insuficiente para quitar esta fatura!");
      setConfirmPayModal(null);
      setTimeout(() => setPaymentErrorMessage(null), 5000);
      return;
    }
    setIsPayingInvoice(true);
    try {
      await payInvoice(cardId);
      setConfirmPayModal(null);
      setPaymentSuccessMessage(`Fatura do ${cardName} paga com sucesso!`);
      setTimeout(() => setPaymentSuccessMessage(null), 4000);
    } catch (error) {
      setPaymentErrorMessage(error instanceof Error ? error.message : "Não foi possível pagar a fatura.");
      setTimeout(() => setPaymentErrorMessage(null), 5000);
    } finally {
      setIsPayingInvoice(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F2F2F7] p-4 sm:p-6 md:p-10 text-[#1D1D1F] font-sans space-y-6 animate-in fade-in duration-500">
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
            <span className="text-xs font-semibold text-[#1D1D1F] font-mono tabular-nums">
              R$ {formatCurrency(mainBalance)}
            </span>
          </div>

          <button
            onClick={() => {
              setSelectedCardForTx(creditCards[0]?.name || "NuBank");
              setIsAddTransactionOpen(true);
            }}
            className="bg-white hover:bg-black/5 active:scale-[0.98] text-[#1D1D1F] border border-black/[0.08] text-xs font-semibold px-3.5 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus strokeWidth={2} size={15} />
            <span>Nova Compra</span>
          </button>

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

        {paymentErrorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{paymentErrorMessage}</span>
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

        {/* Lista Detalhada de Cartões de Crédito (Estilo Faturas dos Cartões) */}
        {(() => {
          const totalInvoicesSum = creditCards.reduce((acc, c) => acc + (c.invoiceAmount || 0), 0);
          const nextMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
          const globalDueMonthName = MONTH_NAMES_PT[nextMonthDate.getMonth()];

          return (
            <section className="bg-[#F8F8FA] rounded-[24px] p-5 sm:p-6 border border-black/[0.04] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-black/[0.04]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CreditCard size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                      Faturas dos Cartões
                    </span>
                    <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight mt-0.5">
                      {creditCards.length} {creditCards.length === 1 ? "cartão com fatura a pagar em" : "cartões com faturas a pagar em"} {globalDueMonthName}
                    </h2>
                  </div>
                </div>

                <div className="flex sm:flex-col sm:items-end justify-between items-center shrink-0">
                  <div className="text-right">
                    <span className="text-[11px] text-[#86868B] mr-1.5 font-medium">
                      Valor Somado:
                    </span>
                    <span className="text-lg sm:text-xl font-semibold text-[#1D1D1F] tracking-tight font-mono tabular-nums">
                      R$ {formatCurrency(totalInvoicesSum)}
                    </span>
                  </div>
                </div>
              </div>

              {creditCards.length === 0 ? (
                <div className="bg-white rounded-[20px] p-8 border border-black/[0.04] text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center mx-auto">
                    <CreditCard size={24} strokeWidth={1.5} />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base font-semibold text-[#1D1D1F]">
                      Nenhum cartão de crédito cadastrado
                    </h3>
                    <p className="text-xs text-[#86868B]">
                      Adicione um cartão para controlar faturas, limites e datas de fechamento/vencimento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddCardOpen(true)}
                    className="bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Plus size={15} />
                    <span>Adicionar Primeiro Cartão</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {creditCards.map((card) => {
                    const details = getCardOpenInvoiceDetails(card, transactions, recurringItems);
                    const invoice = card.invoiceAmount || details.totalInvoice;
                    const availableLimit = Math.max(0, card.limit - card.spent);
                    const percentUsed = Math.min(100, Math.round((card.spent / card.limit) * 100));
                    const isEditing = editingCardId === card.id;

                    return (
                      <div
                        key={card.id}
                        className="bg-white rounded-[20px] p-5 sm:p-6 border border-black/[0.05] shadow-2xs hover:shadow-xs transition-shadow space-y-4"
                      >
                        {/* Topo do Cartão: MiniCard, Identificação e Fatura */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <MiniCard
                              cardName={card.name}
                              brand={card.brand}
                              colorScheme={card.colorScheme}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-[#1D1D1F]">
                                  {card.name}
                                </h3>
                                {details.isPaid ? (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ✓ Paga na conta
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-[#86868B] px-2 py-0.5 rounded-full bg-[#F2F2F7]">
                                    A pagar dia {details.dueDay} ({details.dueMonthName})
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#86868B] mt-0.5">
                                Vencimento dia {details.dueDay} de {details.dueMonthName} · Fechamento dia {details.closingDay}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#86868B] block">
                                Fatura {card.name}
                              </span>
                              <span className="text-base sm:text-lg font-semibold text-[#1D1D1F] tracking-tight font-mono tabular-nums">
                                R$ {formatCurrency(invoice)}
                              </span>
                              {card.limit > 0 && (
                                <span className="text-[10px] text-[#86868B] block mt-0.5">
                                  Limite: <span className="font-mono tabular-nums">R$ {formatCurrency(card.limit)}</span> · Disp:{" "}
                                  <strong className="text-emerald-700 font-semibold font-mono tabular-nums">
                                    R$ {formatCurrency(availableLimit)}
                                  </strong>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {!details.isPaid && invoice > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmPayModal({
                                      isOpen: true,
                                      cardId: card.id,
                                      cardName: card.name,
                                      amount: invoice,
                                    })
                                  }
                                  className="text-xs font-semibold bg-[#1D1D1F] hover:bg-black text-white px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                                  title={`Pagar fatura do ${card.name} na Conta Principal`}
                                >
                                  Pagar Fatura
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCardForTx(card.name);
                                  setIsAddTransactionOpen(true);
                                }}
                                className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] px-2.5 py-1.5 rounded-full hover:bg-blue-50/50 transition-colors cursor-pointer shrink-0"
                                title={`Adicionar compra no ${card.name}`}
                              >
                                + Compra
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteCardModal({
                                    isOpen: true,
                                    cardId: card.id,
                                    cardName: card.name,
                                  })
                                }
                                className="w-7 h-7 rounded-full text-[#86868B] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                title="Excluir Cartão"
                              >
                                <Trash2 size={13} strokeWidth={1.5} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Barra de Progresso de Limite e Ajuste */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#86868B]">
                              Utilizado: <strong className="text-[#1D1D1F] font-mono tabular-nums">R$ {formatCurrency(card.spent)}</strong>
                            </span>
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5 bg-[#F2F2F7] px-2 py-0.5 rounded-lg">
                                  <span className="text-[#86868B] text-[11px]">R$</span>
                                  <input
                                    type="number"
                                    value={newLimitInput}
                                    onChange={(e) => setNewLimitInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveLimit(card.id)}
                                    className="w-16 bg-transparent text-[#1D1D1F] font-semibold outline-none text-xs font-mono tabular-nums"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveLimit(card.id)}
                                    className="text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                  >
                                    <Check size={13} />
                                  </button>
                                  <button
                                    onClick={() => setEditingCardId(null)}
                                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartEditLimit(card.id, card.limit)}
                                  className="text-[#86868B] hover:text-[#1D1D1F] font-medium flex items-center gap-1 cursor-pointer text-[11px]"
                                >
                                  <SlidersHorizontal size={11} />
                                  <span>Ajustar Limite</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="w-full h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                percentUsed > 85 ? "bg-rose-500" : "bg-[#1D1D1F]"
                              }`}
                              style={{ width: `${percentUsed}%` }}
                            />
                          </div>
                        </div>

                        {/* Composição da Fatura */}
                        <div className="bg-[#FBFBFD] rounded-xl p-3 border border-black/[0.03] space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#86868B] border-b border-black/[0.03] pb-1.5">
                            <span>Composição da fatura</span>
                            <div className="flex items-center gap-3">
                              {details.hasInstallments && (
                                <span>Compras: <strong className="text-[#1D1D1F] font-mono tabular-nums">R$ {formatCurrency(details.installmentsAmount)}</strong></span>
                              )}
                              {details.hasRecurring && (
                                <span>Contas Programadas: <strong className="text-[#1D1D1F] font-mono tabular-nums">R$ {formatCurrency(details.recurringAmount)}</strong></span>
                              )}
                            </div>
                          </div>

                          {/* Assinaturas / Contas recorrentes */}
                          {details.recurringItems && details.recurringItems.length > 0 && (
                            <div className="space-y-1.5 pt-0.5">
                              {details.recurringItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-black/[0.04] text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-6 h-6 rounded-lg bg-[#F2F2F7] flex items-center justify-center text-[#1D1D1F] shrink-0">
                                      <CreditCard size={12} strokeWidth={1.75} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-medium text-[#1D1D1F] truncate">{item.title}</p>
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 shrink-0">
                                          Programada
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-[#86868B] truncate">{item.category || "Conta Programada"}</p>
                                    </div>
                                  </div>
                                  <span className="font-semibold text-[#1D1D1F] font-mono tabular-nums shrink-0">
                                    R$ {formatCurrency(item.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Compras faturadas */}
                          {details.cardTransactions && details.cardTransactions.length > 0 ? (
                            <div className="space-y-1.5 pt-0.5">
                              {details.cardTransactions.map((tx) => (
                                <div
                                  key={tx.id}
                                  className="group flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-black/[0.04] text-xs hover:border-black/[0.08] transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-6 h-6 rounded-lg bg-[#F2F2F7] flex items-center justify-center text-[#1D1D1F] shrink-0">
                                      <CreditCard size={12} strokeWidth={1.75} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-[#1D1D1F] truncate">{tx.title}</p>
                                      <p className="text-[10px] text-[#86868B] truncate">
                                        {tx.category || "Despesa"} {tx.installmentsCount && tx.installmentsCount > 1 ? `· ${tx.installmentsCount}x` : ""}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-semibold text-[#1D1D1F] font-mono tabular-nums">
                                      R$ {formatCurrency(tx.amount)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setTxToDelete(tx as TransactionItem)}
                                      className="text-[#86868B] hover:text-rose-600 transition-colors opacity-70 group-hover:opacity-100 p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                                      title="Excluir lançamento"
                                    >
                                      <Trash2 size={12} strokeWidth={1.5} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : !details.hasRecurring ? (
                            <p className="text-xs text-[#86868B] py-1 text-center">
                              Fatura zerada para {details.dueMonthName}. Nenhuma compra faturada ou assinatura vinculada a este cartão.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}

        {/* Projeção Real de Parcelas e Assinaturas Futuras */}
        {(() => {
          const futureProjections = getPlanningMonths(3).slice(1).map((month, index) => {
            const projection = getMonthlyProjection(index + 1);
            return {
              ...month,
              openInvoice: projection.cardInstallments,
              plannedCharges: projection.recurringCreditTotal,
              total: projection.cardInstallments + projection.recurringCreditTotal,
            };
          });
          const hasFutureCharges = futureProjections.some((month) => month.total > 0);

          return (
            <section className="bg-white rounded-[20px] p-6 border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-semibold text-[#1D1D1F]">Projeção de Faturas Futuras</h2>
                  <p className="text-xs text-[#86868B]">Assinaturas e parcelas programadas nos cartões</p>
                </div>
                <span className="text-xs font-medium text-[#86868B] bg-[#F2F2F7] px-2.5 py-1 rounded-full">
                  Próximos Meses
                </span>
              </div>

              {hasFutureCharges ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {futureProjections.map((month) => (
                    <div key={`${month.year}-${month.monthIndex}`} className="p-4 rounded-xl bg-[#F2F2F7]/60 space-y-1">
                      <span className="text-[11px] uppercase font-semibold text-[#86868B] tracking-wider">
                        {month.short} {month.year}
                      </span>
                      <div className="text-lg font-semibold text-[#1D1D1F] font-mono tabular-nums">
                        R$ {formatCurrency(month.total)}
                      </div>
                      <p className="text-xs text-[#86868B] font-mono tabular-nums">
                        R$ {formatCurrency(month.openInvoice)} em aberto + R${" "}
                        {formatCurrency(month.plannedCharges)} planejados
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-[#F2F2F7]/40 text-center space-y-1.5 border border-dashed border-gray-200">
                  <p className="text-xs font-medium text-[#1D1D1F]">
                    Nenhuma parcela ou assinatura futura programada no crédito.
                  </p>
                  <p className="text-xs text-[#86868B] max-w-sm mx-auto">
                    Ao cadastrar assinaturas ou compras parceladas na página de Planejamento, a previsão de faturas futuras será exibida aqui automaticamente.
                  </p>
                </div>
              )}
            </section>
          );
        })()}
      </div>

      {/* Modal Bottom Sheet de Criação de Novo Cartão */}
      <AddCardSheet
        isOpen={isAddCardOpen}
        onClose={() => setIsAddCardOpen(false)}
        onAddCard={addCard}
      />

      {/* Modal de Confirmação para Pagamento de Fatura */}
      <AppleConfirmModal
        isOpen={!!confirmPayModal?.isOpen}
        onClose={() => setConfirmPayModal(null)}
        onConfirm={handleExecutePayInvoice}
        isLoading={isPayingInvoice}
        title="Confirmar Pagamento de Fatura"
        description={`Deseja debitar R$ ${formatCurrency(confirmPayModal?.amount || 0)} do seu saldo disponível (R$ ${formatCurrency(mainBalance)}) para quitar a fatura do cartão ${confirmPayModal?.cardName}?`}
        confirmLabel="Pagar com W Pay"
        cancelLabel="Cancelar"
        variant="primary"
        iconType="payment"
      />

      {/* Modal de Confirmação para Excluir Cartão */}
      <AppleConfirmModal
        isOpen={!!confirmDeleteCardModal?.isOpen}
        onClose={() => setConfirmDeleteCardModal(null)}
        onConfirm={() => {
          if (confirmDeleteCardModal) {
            deleteCard(confirmDeleteCardModal.cardId);
            setConfirmDeleteCardModal(null);
          }
        }}
        title="Excluir Cartão"
        description={`Tem certeza que deseja remover o cartão ${confirmDeleteCardModal?.cardName}? Esta ação removerá os limites e faturas associadas a ele.`}
        confirmLabel="Excluir Cartão"
        cancelLabel="Cancelar"
        variant="danger"
        iconType="trash"
      />

      {/* Modal de Confirmação para Excluir Compra da Fatura */}
      {txToDelete && (
        <AppleConfirmModal
          isOpen={Boolean(txToDelete)}
          onClose={() => setTxToDelete(null)}
          onConfirm={async () => {
            if (txToDelete) {
              await deleteTransaction(txToDelete.id);
              setTxToDelete(null);
            }
          }}
          title="Excluir Lançamento"
          description={`Deseja excluir a compra "${txToDelete.title}" de R$ ${formatCurrency(txToDelete.amount)}?`}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          iconType="trash"
        />
      )}

      {/* Modal Unificado de Lançamento de Transação / Compra */}
      <AddTransactionSheet
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
        accounts={accountOptions}
        initialAccount={selectedCardForTx}
        initialType="despesa"
      />
    </div>
  );
}
