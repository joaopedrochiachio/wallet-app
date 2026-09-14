"use client";

import React, { useState } from "react";
import { X, Wifi, Sparkles, Check } from "lucide-react";
import { NewCardInput } from "@/context/WalletContext";

export interface AddCardSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: NewCardInput) => void;
}

interface ColorPreset {
  id: string;
  name: string;
  gradient: string;
  border: string;
  accent: string;
  chipGradient: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "obsidian",
    name: "Obsidian Black",
    gradient: "from-[#1C1C1E] via-[#141416] to-[#0A0A0C]",
    border: "border-white/15",
    accent: "text-white",
    chipGradient: "from-amber-200 to-amber-500",
  },
  {
    id: "sapphire",
    name: "Sapphire Blue",
    gradient: "from-[#0A192F] via-[#081224] to-[#040914]",
    border: "border-blue-500/25",
    accent: "text-blue-300",
    chipGradient: "from-blue-200 to-amber-300",
  },
  {
    id: "ultraviolet",
    name: "Ultravioleta",
    gradient: "from-[#1F0A2E] via-[#150620] to-[#0C0212]",
    border: "border-purple-500/25",
    accent: "text-purple-300",
    chipGradient: "from-purple-200 to-amber-400",
  },
  {
    id: "emerald",
    name: "Emerald Forest",
    gradient: "from-[#062419] via-[#041911] to-[#020D09]",
    border: "border-emerald-500/25",
    accent: "text-emerald-300",
    chipGradient: "from-emerald-200 to-amber-300",
  },
  {
    id: "ruby",
    name: "Ruby Burgundy",
    gradient: "from-[#260C0C] via-[#1A0707] to-[#0D0303]",
    border: "border-rose-500/25",
    accent: "text-rose-300",
    chipGradient: "from-amber-300 to-yellow-500",
  },
  {
    id: "champagne",
    name: "Champagne Gold",
    gradient: "from-[#2B2314] via-[#1F190D] to-[#120E06]",
    border: "border-amber-500/30",
    accent: "text-amber-300",
    chipGradient: "from-amber-200 to-yellow-500",
  },
  {
    id: "carbon",
    name: "Carbon Graphite",
    gradient: "from-[#2B170B] via-[#1E0F06] to-[#100703]",
    border: "border-orange-500/25",
    accent: "text-orange-300",
    chipGradient: "from-amber-200 to-orange-400",
  },
];

const BRAND_SUGGESTIONS = [
  "Mastercard Black",
  "Visa Infinite",
  "Elo Nanquim",
  "Visa Platinum",
  "Mastercard Platinum",
];

export function AddCardSheet({ isOpen, onClose, onAddCard }: AddCardSheetProps) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState(BRAND_SUGGESTIONS[0]);
  const [limitInput, setLimitInput] = useState("");
  const [closingDay, setClosingDay] = useState("10");
  const [dueDay, setDueDay] = useState("17");
  const [selectedPreset, setSelectedPreset] = useState<ColorPreset>(COLOR_PRESETS[0]);

  if (!isOpen) return null;

  const parsedLimit = parseFloat(limitInput.replace(/\./g, "").replace(",", ".")) || 0;

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || "Meu Cartão";
    const finalLimit = parsedLimit > 0 ? parsedLimit : 5000;
    const finalClosing = parseInt(closingDay) || 10;
    const finalDue = parseInt(dueDay) || 17;

    onAddCard({
      name: finalName,
      brand: brand.trim() || "Crédito",
      type: "credit",
      limit: finalLimit,
      balance: 0,
      closingDay: finalClosing,
      dueDay: finalDue,
      colorScheme: {
        gradient: selectedPreset.gradient,
        border: selectedPreset.border,
        accent: selectedPreset.accent,
        badgeText: finalName,
        chipGradient: selectedPreset.chipGradient,
      },
    });

    // Resetar campos
    setName("");
    setLimitInput("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop Limpo */}
      <div
        className="fixed inset-0 bg-black/45 animate-apple-backdrop"
        onClick={onClose}
      />


      {/* Modal / Bottom Sheet em 60fps */}
      <div className="relative w-full max-w-lg bg-[#F2F2F7] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.25)] border border-white/60 overflow-hidden z-10 flex flex-col max-h-[90vh] animate-apple-sheet sm:animate-apple-modal">
        
        {/* Handle bar iOS */}
        <div className="w-12 h-1.5 bg-[#D1D1D6] rounded-full mx-auto mt-3.5 mb-1 shrink-0" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-black/[0.04]">
          <div>
            <h2 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
              Novo Cartão de Crédito
            </h2>
            <p className="text-xs text-[#86868B]">
              Personalize a aparência, limite e vencimento
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#E5E5EA] text-[#1D1D1F] flex items-center justify-center hover:bg-[#D1D1D6] transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="overflow-y-auto px-6 py-4 space-y-5">
          
          {/* Live Card Preview Apple HIG */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#86868B]">
              Pré-visualização em Tempo Real
            </span>
            <div
              className={`w-full rounded-[22px] p-5 text-white bg-gradient-to-br ${selectedPreset.gradient} border ${selectedPreset.border} shadow-[0_15px_30px_rgba(0,0,0,0.15)] relative overflow-hidden transition-all duration-300`}
            >
              {/* Luz sutil no fundo */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex flex-col justify-between h-36">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] tracking-wider uppercase opacity-75 font-medium">
                      {brand || "Mastercard Black"}
                    </span>
                    <h3 className="text-lg font-semibold tracking-tight text-white mt-0.5">
                      {name.trim() || "Nome do Cartão"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi size={18} strokeWidth={1.5} className="opacity-80 rotate-90" />
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 font-semibold">
                      Crédito
                    </span>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div className="flex items-center gap-3">
                    {/* Chip EMV */}
                    <div
                      className={`w-10 h-7 rounded-md bg-gradient-to-br ${selectedPreset.chipGradient} border border-amber-300/40 shadow-xs flex flex-col justify-between p-1`}
                    >
                      <div className="w-full h-0.5 bg-black/20 rounded" />
                      <div className="w-full h-0.5 bg-black/20 rounded" />
                    </div>
                    <div className="text-[11px] text-white/80 font-mono tracking-widest">
                      •••• 8829
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase text-white/60 block">
                      Limite
                    </span>
                    <span className="text-base font-semibold text-white tracking-tight">
                      R$ {formatCurrency(parsedLimit > 0 ? parsedLimit : 5000)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Nome do Cartão */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#86868B]">
                Nome do Cartão
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Inter Black, XP Infinite, C6 Carbon..."
                className="w-full bg-white rounded-xl px-4 py-3 text-sm text-[#1D1D1F] placeholder-[#86868B] border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 transition-all"
              />
            </div>

            {/* Bandeira / Categoria */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#86868B]">
                Bandeira ou Categoria
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {BRAND_SUGGESTIONS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrand(b)}
                    className={`px-3 py-1 rounded-full text-xs transition-all ${
                      brand === b
                        ? "bg-[#1D1D1F] text-white font-medium shadow-2xs"
                        : "bg-white text-[#86868B] border border-black/[0.04] hover:text-[#1D1D1F]"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ou digite outra bandeira..."
                className="w-full bg-white rounded-xl px-4 py-2.5 text-xs text-[#1D1D1F] placeholder-[#86868B] border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20"
              />
            </div>

            {/* Limite Total */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#86868B]">
                Limite Total do Cartão (R$)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#86868B]">
                  R$
                </span>
                <input
                  type="text"
                  required
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="5.000,00"
                  className="w-full bg-white rounded-xl pl-11 pr-4 py-3 text-sm font-semibold text-[#1D1D1F] placeholder-[#86868B] border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20 transition-all"
                />
              </div>
            </div>

            {/* Fechamento e Vencimento */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#86868B]">
                    Dia do Fechamento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1D1D1F] border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#86868B]">
                    Dia do Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1D1D1F] border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/20"
                  />
                </div>
            </div>

            {/* Paleta Metálica Apple HIG */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-[#86868B]">
                  Estilo Visual & Textura Metálica
                </label>
                <span className="text-[11px] text-[#1D1D1F] font-medium">
                  {selectedPreset.name}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {COLOR_PRESETS.map((preset) => {
                  const isSelected = selectedPreset.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPreset(preset)}
                      className={`h-10 rounded-xl bg-gradient-to-br ${preset.gradient} border flex items-center justify-center transition-all ${
                        isSelected
                          ? "ring-2 ring-[#1D1D1F] ring-offset-2 scale-105 shadow-md border-white/40"
                          : "border-black/10 hover:scale-102"
                      }`}
                      title={preset.name}
                    >
                      {isSelected && <Check size={14} className="text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botão Salvar */}
            <div className="pt-3 pb-2">
              <button
                type="submit"
                className="w-full bg-[#1D1D1F] text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-black active:scale-[0.99] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} />
                <span>Salvar Cartão</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
