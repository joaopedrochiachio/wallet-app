"use client";

import React, { useState, useRef, useEffect } from "react";
import { useWallet } from "@/context/WalletContext";
import { AgentAvatar } from "./AgentAvatar";
import { QuickCaptureModal } from "./QuickCaptureModal";
import { PurchaseSimulatorModal } from "./PurchaseSimulatorModal";
import {
  Sparkles,
  Plus,
  Calculator,
  MessageSquare,
  X,
  Compass,
  Zap,
} from "lucide-react";
import Link from "next/link";

export function FloatingCompanionDock() {
  const { userProfile } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* ATALHO FLUTUANTE WALLET TOUCH */}
      <div
        ref={menuRef}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-8 right-3.5 sm:right-6 z-40 flex flex-col items-end select-none"
      >
        {/* Menu de Ações Rápidas (Abre para Cima) */}
        {isOpen && (
          <div className="mb-3 w-56 rounded-2xl bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.16)] p-2 space-y-1 animate-in zoom-in-95 fade-in duration-150 origin-bottom-right">
            <div className="px-3 py-1.5 border-b border-black/5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                Ações Rápidas
              </span>
              <span className="text-[10px] font-medium text-amber-600">Wallet Touch</span>
            </div>

            {/* Ação 1: Captura Rápida */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsQuickCaptureOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2F2F7] text-[#1D1D1F] text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Plus size={14} />
              </div>
              <div className="flex flex-col">
                <span>Captura Rápida</span>
                <span className="text-[10px] text-[#86868B] font-normal">Lançar em 3 segundos</span>
              </div>
            </button>

            {/* Ação 2: Devo Comprar? */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsSimulatorOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2F2F7] text-[#1D1D1F] text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Calculator size={14} />
              </div>
              <div className="flex flex-col">
                <span>Devo Comprar?</span>
                <span className="text-[10px] text-[#86868B] font-normal">Simulador de compra</span>
              </div>
            </button>

            {/* Ação 3: Chat com Assistente */}
            <Link
              href="/ai"
              onClick={() => setIsOpen(false)}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#F2F2F7] text-[#1D1D1F] text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Sparkles size={14} />
              </div>
              <div className="flex flex-col">
                <span>Conversar com IA</span>
                <span className="text-[10px] text-[#86868B] font-normal">Wallet+ Consultor</span>
              </div>
            </Link>
          </div>
        )}

        {/* Botão Principal Flutuante */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-13 h-13 rounded-2xl flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-all duration-200 cursor-pointer active:scale-95 border ${
            isOpen
              ? "bg-[#1D1D1F] text-white border-white/20 rotate-90"
              : "bg-white/90 hover:bg-white text-[#1D1D1F] border-black/10 hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] hover:scale-105"
          }`}
          title="Atalho Rápido do Companheiro"
        >
          {isOpen ? (
            <X size={20} />
          ) : (
            <AgentAvatar
              persona={userProfile.persona || "guardian"}
              state="idle"
              size="sm"
              showBadge={false}
            />
          )}
        </button>
      </div>

      {/* Modais */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
      />
      <PurchaseSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />
    </>
  );
}
