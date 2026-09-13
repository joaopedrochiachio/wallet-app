"use client";

import React, { useState } from "react";
import { AnyPassData, BoardingPassData, LoyaltyPassData, TicketPassData } from "@/types/wallet";
import { BoardingPass } from "./BoardingPass";
import { LoyaltyPass } from "./LoyaltyPass";
import { WalletPass } from "./WalletPass";
import { Ticket, ChevronDown, ChevronUp, Layers } from "lucide-react";

interface PassStackProps {
  passes: AnyPassData[];
  className?: string;
}

export function PassStack({ passes, className = "" }: PassStackProps) {
  // activeExpandedId: if null, shows stacked peek mode; if string, expands that pass
  const [activePassId, setActivePassId] = useState<string | null>(null);
  const [isStackCollapsed, setIsStackCollapsed] = useState<boolean>(true);

  if (!passes || passes.length === 0) return null;

  const handleTogglePass = (id: string) => {
    if (activePassId === id) {
      setActivePassId(null);
    } else {
      setActivePassId(id);
      setIsStackCollapsed(false);
    }
  };

  const renderPass = (pass: AnyPassData, isExpanded: boolean) => {
    switch (pass.type) {
      case "boarding-pass":
        return (
          <BoardingPass
            data={pass as BoardingPassData}
            isExpanded={isExpanded}
            onClick={() => handleTogglePass(pass.id)}
          />
        );
      case "loyalty":
        return (
          <LoyaltyPass
            data={pass as LoyaltyPassData}
            isExpanded={isExpanded}
            onClick={() => handleTogglePass(pass.id)}
          />
        );
      case "ticket": {
        const ticket = pass as TicketPassData;
        return (
          <WalletPass
            headerLabel={ticket.eventName}
            headerValue={ticket.section}
            headerIcon={<Ticket size={15} />}
            primaryLabel="EVENT PASS"
            primaryValue={ticket.eventTime}
            secondaryFields={[
              { label: "LOCAL", value: ticket.venue },
              { label: "DATA", value: ticket.eventDate },
              { label: "ASSENTO", value: `Fila ${ticket.row || "A"} • Nº ${ticket.seat || "12"}` },
            ]}
            barcodeNumber={ticket.barcodeNumber}
            themeColor={ticket.themeColor}
            isExpanded={isExpanded}
            onClick={() => handleTogglePass(pass.id)}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className={`w-full max-w-[420px] mx-auto space-y-3 font-sans ${className}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-[#1D1D1F]" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
            Passes & Bilhetes
          </h3>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E5E5EA] text-[#1D1D1F]">
            {passes.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activePassId) {
              setActivePassId(null);
              setIsStackCollapsed(true);
            } else {
              setIsStackCollapsed(!isStackCollapsed);
            }
          }}
          className="text-xs text-[#0071E3] hover:text-[#0077ED] font-semibold flex items-center gap-0.5 cursor-pointer"
        >
          <span>{activePassId ? "Recolher" : isStackCollapsed ? "Expandir Tudo" : "Empilhar"}</span>
          {isStackCollapsed && !activePassId ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronUp size={14} />
          )}
        </button>
      </div>

      {/* STACK CONTAINER */}
      {isStackCollapsed && !activePassId ? (
        /* Modo Apple Wallet: Passes sobrepostos exibindo cabeçalhos */
        <div className="relative pt-2 pb-16 flex flex-col items-center">
          {passes.map((pass, index) => {
            // Negative margin to create Apple Wallet overlapping stack
            const offsetMarginTop = index === 0 ? "mt-0" : "-mt-32 sm:-mt-36";

            return (
              <div
                key={pass.id}
                className={`w-full flex justify-center transition-all duration-300 transform hover:-translate-y-2 cursor-pointer ${offsetMarginTop}`}
                style={{
                  zIndex: 10 + index,
                }}
              >
                {renderPass(pass, false)}
              </div>
            );
          })}
        </div>
      ) : (
        /* Modo Expandido: Passes abertos verticalmente */
        <div className="space-y-4 pt-1 animate-in fade-in duration-300">
          {passes.map((pass) => {
            const isSingleActive = activePassId === pass.id;
            // If one is selected, highlight it and show details
            if (activePassId && !isSingleActive) {
              return (
                <div
                  key={pass.id}
                  onClick={() => handleTogglePass(pass.id)}
                  className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {renderPass(pass, false)}
                </div>
              );
            }

            return (
              <div key={pass.id} className="transition-all duration-300">
                {renderPass(pass, true)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
