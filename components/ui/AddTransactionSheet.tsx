"use client";

import React, { useState } from "react";
import { X, Plus, Check, Repeat } from "lucide-react";

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
    date: string;
    isRecurring?: boolean;
  }) => void;
}

const DEFAULT_CATEGORIES = [
  "Alimentação & Delivery",
  "Transporte",
  "Educação",
  "Tecnologia",
  "Lazer & Esportes",
  "Saúde & Fitness",
  "Assinaturas",
  "Moradia",
];

const DEFAULT_ACCOUNTS = ["Débito/Pix", "Nubank", "Santander"];

export function AddTransactionSheet({
  isOpen,
  onClose,
  accounts = DEFAULT_ACCOUNTS,
  onAdd,
}: AddTransactionSheetProps) {
  const [type, setType] = useState<"despesa" | "receita">("despesa");
  const [amountInput, setAmountInput] = useState("");
  const [title, setTitle] = useState("");
  const [categoriesList, setCategoriesList] = useState<string[]>(DEFAULT_CATEGORIES);
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [account, setAccount] = useState(accounts[0] || "Débito/Pix");
  const [isRecurring, setIsRecurring] = useState(false);

  // Estado para inserção inline de nova categoria
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  if (!isOpen) return null;

  const handleSaveNewCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (trimmed) {
      if (!categoriesList.includes(trimmed)) {
        setCategoriesList((prev) => [...prev, trimmed]);
      }
      setCategory(trimmed);
    }
    setNewCategoryInput("");
    setIsAddingCategory(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(
      amountInput.replace(/\./g, "").replace(",", ".")
    );

    if (isNaN(cleanAmount) || cleanAmount <= 0) return;

    onAdd?.({
      title: title.trim() || (type === "despesa" ? "Novo Gasto" : "Nova Receita"),
      amount: cleanAmount,
      type,
      category,
      account,
      date: "Hoje, agora",
      isRecurring,
    });

    // Reset e fechar
    setAmountInput("");
    setTitle("");
    setIsRecurring(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop de Fundo Escuro com Desfoque */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Modal Bottom Sheet estilo iOS */}
      <div className="relative w-full max-w-lg bg-white rounded-t-[32px] p-6 space-y-5 shadow-2xl z-50 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
        {/* Pílula superior para indicação de drag */}
        <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto -mt-2 mb-2" />

        {/* Header do Sheet */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1D1D1F]">Novo Lançamento</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors"
          >
            <X strokeWidth={1.5} size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Segmented Control iOS (Despesa / Receita) */}
          <div className="bg-[#E5E5EA]/70 p-1 rounded-full flex gap-1 border border-black/5">
            <button
              type="button"
              onClick={() => setType("despesa")}
              className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all ${
                type === "despesa"
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setType("receita")}
              className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all ${
                type === "receita"
                  ? "bg-white text-green-600 shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Receita
            </button>
          </div>

          {/* 1. Centralização Perfeita do Valor */}
          <div className="text-center py-2 space-y-1">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#86868B]">
              VALOR DO LANÇAMENTO
            </span>
            <div className="flex justify-center items-baseline gap-2">
              <span className="text-gray-400 font-medium text-2xl select-none">
                R$
              </span>
              <input
                type="text"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0,00"
                className="text-5xl md:text-6xl font-light text-[#1D1D1F] text-center w-full max-w-[240px] outline-none bg-transparent border-none appearance-none placeholder:text-gray-300"
                autoFocus
              />
            </div>
          </div>

          {/* Descrição Curta */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#86868B] uppercase tracking-wider px-1">
              Descrição
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Supermercado, Aluguel, Job..."
              className="w-full bg-[#F2F2F7] rounded-xl px-4 py-3 text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none border border-transparent focus:border-black/10 transition-all"
            />
          </div>

          {/* 2. Refatoração das Categorias (Pills em Flex-Wrap com Inline Input) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#86868B] uppercase tracking-wider px-1">
              Categoria
            </label>

            <div className="flex flex-wrap gap-2">
              {categoriesList.map((cat) => {
                const isActive = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors select-none ${
                      isActive
                        ? "bg-[#1D1D1F] text-white shadow-xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}

              {/* 3. Criação Rápida de Nova Categoria (Inline Input) */}
              {isAddingCategory ? (
                <div className="rounded-full px-3 py-1.5 border border-[#1D1D1F] bg-white flex items-center gap-1 shadow-xs">
                  <input
                    autoFocus
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveNewCategory();
                      } else if (e.key === "Escape") {
                        setIsAddingCategory(false);
                        setNewCategoryInput("");
                      }
                    }}
                    onBlur={handleSaveNewCategory}
                    placeholder="Nova tag..."
                    className="text-sm font-medium text-[#1D1D1F] outline-none bg-transparent w-24"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSaveNewCategory();
                    }}
                    className="text-[#1D1D1F] hover:text-black"
                  >
                    <Check strokeWidth={2} size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="rounded-full px-4 py-2 text-sm font-medium border border-dashed border-gray-400 text-gray-500 bg-transparent hover:bg-gray-50 flex items-center gap-1 transition-colors cursor-pointer select-none"
                >
                  <Plus strokeWidth={1.5} size={14} />
                  <span>Nova</span>
                </button>
              )}
            </div>
          </div>

          {/* Seleção de Conta / Cartão */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#86868B] uppercase tracking-wider px-1">
              Conta / Cartão
            </label>
            <div className="flex flex-wrap gap-2">
              {accounts.map((acc) => (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setAccount(acc)}
                  className={`flex-1 min-w-[90px] py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                    account === acc
                      ? "bg-[#1D1D1F] text-white border-transparent shadow-xs"
                      : "bg-[#F2F2F7] text-[#1D1D1F] border-transparent hover:bg-gray-200/80"
                  }`}
                >
                  {acc}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle de Recorrência (Repetir todo mês) */}
          <div className="bg-[#F2F2F7] p-3.5 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white text-[#1D1D1F] flex items-center justify-center shadow-2xs">
                <Repeat strokeWidth={1.5} size={15} />
              </div>
              <div>
                <span className="text-xs font-semibold text-[#1D1D1F] block">
                  Repetir todo mês
                </span>
                <span className="text-[11px] text-[#86868B] block">
                  Adiciona ao planejamento mensal automático
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                isRecurring ? "bg-[#1D1D1F]" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  isRecurring ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* 4. Botão de Ação Inferior com pb-safe */}
          <div className="pt-2 mb-2 pb-safe">
            <button
              type="submit"
              className="w-full bg-[#1D1D1F] hover:bg-black active:scale-[0.99] text-white font-semibold text-sm py-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Plus strokeWidth={2} size={18} />
              <span>Adicionar Lançamento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
