"use client";

import React, { useState } from "react";
import {
  Check,
  Repeat,
  CreditCard,
  Building2,
  Sparkles,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { WPayLogo, WPayButton } from "@/components/ui/WPayLogo";
import { get5thBusinessDay, MONTH_NAMES_PT } from "@/lib/utils/dateUtils";
import { formatAccountLabel } from "@/lib/utils/ledger";
import { RecurrenceType } from "@/types";

export interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: string[];
  onAdd?: (transaction: {
    title: string;
    amount: number;
    type: "despesa" | "receita";
    category: string;
    account: string;
    cardId?: string | null;
    date: string;
    occurredAt?: Date | string | null;
    isRecurring?: boolean;
    recurrenceType?: RecurrenceType;
    recurrenceDay?: number;
    installmentsCount?: number;
  }) => void | Promise<void>;
}

export const EXPENSE_CATEGORIES = [
  "Alimentação & Delivery",
  "Supermercado",
  "Transporte & Combustível",
  "Moradia & Contas",
  "Assinaturas & Lazer",
  "Saúde & Farmácia",
  "Compras & Roupas",
  "Educação",
  "Outros",
];

export const INCOME_CATEGORIES = [
  "Salário / Pró-labore",
  "Freelance & Projetos",
  "Rendimentos & Dividendos",
  "Venda & Desapego",
  "Reembolso & Cashback",
  "Bônus & 13º",
  "Outros",
];

const DEFAULT_ACCOUNTS = ["Débito/Pix"];

export function AddTransactionSheet({
  isOpen,
  onClose,
  accounts = DEFAULT_ACCOUNTS,
  onAdd,
}: AddTransactionSheetProps) {
  const { cards } = useWallet();
  const [type, setType] = useState<"despesa" | "receita">("despesa");
  const [amountInput, setAmountInput] = useState("");
  const [title, setTitle] = useState("");

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [account, setAccount] = useState(accounts[0] || "Débito/Pix");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("business_day_5");
  const [recurrenceDay, setRecurrenceDay] = useState(10);
  const [isCustomDayOpen, setIsCustomDayOpen] = useState(false);
  const [customDayInput, setCustomDayInput] = useState("10");
  const [durationMode, setDurationMode] = useState<"continuous" | "limited">("continuous");
  const [installmentsInput, setInstallmentsInput] = useState("3");

  const [loading, setLoading] = useState(false);

  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();
  const current5thBusinessDay = get5thBusinessDay(currentYear, currentMonthIndex);
  const currentMonthName = MONTH_NAMES_PT[currentMonthIndex];

  const categoriesList = type === "despesa" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const checkingAccounts = cards.filter((card) => card.type === "checking").map((card) => card.name);
  const availableAccounts = type === "receita" && checkingAccounts.length > 0
    ? checkingAccounts
    : accounts;
  const effectiveAccount = availableAccounts.includes(account)
    ? account
    : availableAccounts[0] || "Débito/Pix";

  const handleTypeChange = (nextType: "despesa" | "receita") => {
    setType(nextType);
    setCategory(nextType === "despesa" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
    if (nextType === "receita") {
      setAccount(checkingAccounts[0] || accounts[0] || "Débito/Pix");
      setRecurrenceType("business_day_5");
    }
  };

  if (!isOpen) return null;

  const handleClearAmount = () => {
    setAmountInput("");
  };

  const parsedAmount = parseFloat(amountInput.replace(/\./g, "").replace(",", ".")) || 0;
  const installmentsCount = Math.min(
    60,
    Math.max(2, parseInt(installmentsInput, 10) || 2),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) return;

    setLoading(true);

    try {
      const txDescription =
        title.trim() || (type === "despesa" ? "Novo Gasto" : "Nova Receita");
      const formattedDate = `${now.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })}, ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

      const effectiveDueDay =
        recurrenceType === "business_day_5"
          ? current5thBusinessDay
          : recurrenceDay;

      if (!onAdd) throw new Error("Fluxo de lançamento indisponível.");
      await onAdd({
        title: txDescription,
        amount: parsedAmount,
        type,
        category,
        account: effectiveAccount,
        cardId: cards.find((card) => card.name === effectiveAccount)?.id || null,
        date: formattedDate,
        occurredAt: now,
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : undefined,
        recurrenceDay: isRecurring ? effectiveDueDay : undefined,
        installmentsCount:
          isRecurring && durationMode === "limited" ? installmentsCount : undefined,
      });

      // Reset e fechar
      setAmountInput("");
      setTitle("");
      setIsRecurring(false);
      setDurationMode("continuous");
      setInstallmentsInput("3");
      onClose();
    } catch (err: unknown) {
      console.error("Erro ao salvar transação:", err);
      alert(err instanceof Error ? err.message : "Erro ao gravar a transação. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop Limpo (Sem borrão de tela) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/45 animate-apple-backdrop"
      />


      {/* Folha de Pagamento Oficial Apple Pay (Estilo Sheet iOS em 60fps GPU) */}
      <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-b-[32px] sm:mb-6 shadow-[0_-8px_40px_rgba(0,0,0,0.18)] z-50 animate-apple-sheet max-h-[94vh] overflow-y-auto font-sans">
        {/* Pílula Apple superior */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* HEADER OFICIAL APPLE PAY: [W] Pay à esquerda, Cancel à direita */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-[#E5E5EA]">
          <div className="flex items-center gap-2">
            <WPayLogo size="lg" />
            <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider ml-1 bg-gray-100 px-2 py-0.5 rounded-md">
              {type === "receita" ? "Recebimento" : "Pagamento"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#0071E3] hover:text-[#0077ED] font-normal text-base cursor-pointer active:opacity-60 transition-opacity"
          >
            Cancelar
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* TABELA AGRUPADA ESTILO APPLE HIG */}
          <div className="divide-y divide-[#E5E5EA] border-b border-[#E5E5EA] bg-white">
            {/* ROW 1: TIPO (RECEBIMENTO OU PAGAMENTO) */}
            <div className="flex items-center px-6 py-3.5">
              <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                OPERAÇÃO
              </span>
              <div className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange("despesa")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    type === "despesa"
                      ? "bg-[#1D1D1F] text-white shadow-2xs"
                      : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Pagamento (Saída)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange("receita")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    type === "receita"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Recebimento (Entrada)
                </button>
              </div>
            </div>

            {/* ROW 2: VALOR */}
            <div className="flex items-center px-6 py-4">
              <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                VALOR
              </span>
              <div className="flex-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-[#1D1D1F]">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full text-2xl sm:text-3xl font-bold text-[#1D1D1F] placeholder:text-gray-300 outline-none bg-transparent"
                />
              </div>
              {amountInput && (
                <button
                  type="button"
                  onClick={handleClearAmount}
                  className="text-xs text-[#86868B] hover:text-[#1D1D1F] px-2 py-1 bg-gray-100 rounded-md cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>


            {/* ROW 3: CONTA / CARTÃO DE DESTINO OU DÉBITO */}
            <div className="flex flex-col sm:flex-row sm:items-center px-6 py-3.5 gap-2 sm:gap-0">
              <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                {type === "receita" ? "DESTINO" : "CONTA / CARTÃO"}
              </span>
              <div className="flex-1 flex flex-wrap gap-2">
                {availableAccounts.map((acc) => {
                  const isSelected = effectiveAccount === acc;
                  const isCheckingAccount = acc === "Débito/Pix" ||
                    cards.some((card) => card.type === "checking" && card.name === acc);
                  return (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => setAccount(acc)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#1D1D1F] text-white border-transparent shadow-2xs"
                          : "bg-[#F2F2F7] text-[#1D1D1F] border-transparent hover:bg-gray-200"
                      }`}
                    >
                      {isCheckingAccount ? <Building2 size={13} /> : <CreditCard size={13} />}
                      <span>{formatAccountLabel(acc)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ROW 4: IDENTIFICAÇÃO / DESCRIÇÃO */}
            <div className="flex items-center px-6 py-3.5">
              <span className="w-24 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                DESCRIÇÃO
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "receita"
                    ? "Ex: Salário Mensal, Freelance, Dividendos..."
                    : "Ex: Aluguel, Supermercado, Internet..."
                }
                className="flex-1 text-sm font-medium text-[#1D1D1F] placeholder:text-[#86868B] outline-none bg-transparent"
              />
            </div>

            {/* ROW 5: CATEGORIA */}
            <div className="flex flex-col px-6 py-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  CATEGORIA
                </span>
                <span className="text-xs text-[#86868B] font-medium">{category}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {categoriesList.map((cat) => {
                  const isActive = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                        isActive
                          ? type === "receita"
                            ? "bg-emerald-600 text-white"
                            : "bg-[#1D1D1F] text-white"
                          : "bg-[#F2F2F7] text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ROW 6: RECORRÊNCIA INTELIGENTE & 5º DIA ÚTIL */}
            <div className="px-6 py-4 space-y-3 bg-[#FAFAFC]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat size={15} className="text-[#1D1D1F]" />
                  <div>
                    <span className="text-xs font-semibold text-[#1D1D1F] block">
                      Repetir Todo Mês
                    </span>
                    <span className="text-[11px] text-[#86868B] block">
                      Adiciona automaticamente ao planejamento futuro
                    </span>
                  </div>
                </div>

                {/* Switch iOS nativo */}
                <button
                  type="button"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    isRecurring ? (type === "receita" ? "bg-emerald-600" : "bg-[#1D1D1F]") : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white transition-transform shadow-xs ${
                      isRecurring ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* OPÇÕES DE RECORRÊNCIA QUANDO ATIVO */}
              {isRecurring && (
                <div className="pt-2 border-t border-gray-200/60 space-y-2.5 animate-in fade-in duration-200">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    SELECIONE O DIA DE RECORRÊNCIA
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Opção 5º Dia Útil Dinâmico */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceType("business_day_5");
                        setIsCustomDayOpen(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceType === "business_day_5"
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-700 font-bold">⚡ 5º Dia Útil</span>
                        {recurrenceType === "business_day_5" && <Check size={14} className="text-emerald-700" />}
                      </div>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">
                        Cálculo automático
                      </span>
                    </button>

                    {/* Dia 5 Fixo */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceType("fixed_day");
                        setRecurrenceDay(5);
                        setIsCustomDayOpen(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceType === "fixed_day" && recurrenceDay === 5 && !isCustomDayOpen
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 5</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>

                    {/* Dia 10 Fixo */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceType("fixed_day");
                        setRecurrenceDay(10);
                        setIsCustomDayOpen(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        recurrenceType === "fixed_day" && recurrenceDay === 10 && !isCustomDayOpen
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Todo Dia 10</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">Fixo todo mês</span>
                    </button>

                    {/* Dia 20 ou Outro */}
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceType("fixed_day");
                        setIsCustomDayOpen(true);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                        isCustomDayOpen
                          ? "bg-white border-[#1D1D1F] shadow-xs text-[#1D1D1F]"
                          : "bg-[#F2F2F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>Outro Dia...</span>
                      <span className="text-[10px] text-[#86868B] block mt-0.5">
                        {isCustomDayOpen ? `Dia ${customDayInput}` : "Personalizado"}
                      </span>
                    </button>
                  </div>

                  {/* Input quando selecionar outro dia */}
                  {isCustomDayOpen && (
                    <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                      <span className="text-xs text-[#86868B]">Dia do mês (1 a 31):</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={customDayInput}
                        onChange={(e) => {
                          setCustomDayInput(e.target.value);
                          const d = parseInt(e.target.value);
                          if (!isNaN(d) && d >= 1 && d <= 31) {
                            setRecurrenceDay(d);
                          }
                        }}
                        className="w-16 bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-bold text-[#1D1D1F] outline-none"
                      />
                    </div>
                  )}

                  {/* Banner de Feedback em Tempo Real */}
                  <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-xl p-2.5 flex items-start gap-2">
                    <Sparkles size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                      {recurrenceType === "business_day_5" ? (
                        <>
                          Configurado para o <strong>5º dia útil</strong>. Em{" "}
                          <strong>{currentMonthName}</strong>, cai exatamente no{" "}
                          <strong>Dia {current5thBusinessDay}</strong>. O sistema recalcula todo mês
                          automaticamente pulando fins de semana e feriados!
                        </>
                      ) : (
                        <>
                          Configurado para repetir no <strong>Dia {recurrenceDay}</strong> de todo mês.
                        </>
                      )}
                    </p>
                  </div>

                  <div className="space-y-2.5 border-t border-gray-200/60 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                        Duração
                      </span>
                      <span className="text-[11px] font-medium text-[#1D1D1F]">
                        {durationMode === "continuous"
                          ? "Sem prazo para terminar"
                          : `${installmentsCount} parcelas mensais`}
                      </span>
                    </div>

                    <div className="flex gap-1 rounded-xl bg-[#EDEDF2] p-1">
                      <button
                        type="button"
                        onClick={() => setDurationMode("continuous")}
                        className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition-all ${
                          durationMode === "continuous"
                            ? "bg-white text-[#1D1D1F] shadow-xs"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        Contínua
                      </button>
                      <button
                        type="button"
                        onClick={() => setDurationMode("limited")}
                        className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition-all ${
                          durationMode === "limited"
                            ? "bg-white text-[#1D1D1F] shadow-xs"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        Por X meses
                      </button>
                    </div>

                    {durationMode === "limited" && (
                      <div className="space-y-2 animate-in fade-in duration-150">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[2, 3, 6, 12].map((count) => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => setInstallmentsInput(String(count))}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                installmentsCount === count && installmentsInput === String(count)
                                  ? "bg-[#1D1D1F] text-white"
                                  : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                              }`}
                            >
                              {count}x
                            </button>
                          ))}
                          <label className="ml-auto flex items-center gap-2 text-[11px] text-[#86868B]">
                            Outro
                            <input
                              type="number"
                              min="2"
                              max="60"
                              inputMode="numeric"
                              value={installmentsInput}
                              onChange={(event) => setInstallmentsInput(event.target.value)}
                              onBlur={() => setInstallmentsInput(String(installmentsCount))}
                              className="w-16 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-center text-xs font-semibold text-[#1D1D1F] outline-none focus:border-[#1D1D1F]"
                              aria-label="Número de parcelas ou meses"
                            />
                          </label>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#86868B]">
                          Este lançamento será repetido por <strong>{installmentsCount} meses</strong> e
                          depois será encerrado automaticamente.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO DE RESUMO FINANCEIRO (Subtotal / Destino / Total Apple Pay) */}
          <div className="px-6 py-4 space-y-1.5 border-b border-[#E5E5EA] bg-[#FDFDFD]">
            <div className="flex justify-between items-center text-xs text-[#86868B]">
              <span className="uppercase tracking-wider font-semibold">SUBTOTAL</span>
              <span className="font-mono text-[#1D1D1F]">
                R$ {parsedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-[#86868B]">
              <span className="uppercase tracking-wider font-semibold">
                {type === "receita" ? "CRÉDITO EM CONTA" : "MÉTODO DE COBRANÇA"}
              </span>
              <span className="font-medium text-[#1D1D1F]">{formatAccountLabel(account)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-semibold pt-1 text-[#1D1D1F]">
              <span className="uppercase tracking-wider text-xs">
                {type === "receita" ? "TOTAL A RECEBER" : "TOTAL A PAGAR"}
              </span>
              <span className="text-xl font-bold tracking-tight">
                R$ {parsedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* SEÇÃO DE CONFIRMAÇÃO COM BIOMETRIA / BOTÃO W PAY */}
          <div className="px-6 py-5 flex flex-col items-center gap-3">
            {/* Ícone Apple Face ID / Smart Animate */}
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-[#0071E3] flex items-center justify-center text-[#0071E3] transition-transform active:scale-95">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 3H5a2 2 0 0 0-2 2v2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <path d="M3 17v2a2 2 0 0 0 2 2h2" />
                  <line x1="9" y1="10" x2="9.01" y2="10" />
                  <line x1="15" y1="10" x2="15.01" y2="10" />
                  <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
                </svg>
              </div>
              <span className="text-[11px] text-[#86868B] font-medium tracking-tight">
                Confirme com W Pay
              </span>
            </div>

            {/* BOTÃO OFICIAL APPLE PAY ESTILIZADO COM O [W] */}
            <WPayButton
              type="submit"
              isLoading={loading}
              disabled={parsedAmount <= 0}
              label={type === "receita" ? "Receber com" : "Pagar com"}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
