"use client";

import React from "react";
import { BoardingPassData } from "@/types/wallet";
import { Plane } from "lucide-react";

interface BoardingPassProps {
  data: BoardingPassData;
  className?: string;
  onClick?: () => void;
  isExpanded?: boolean;
}

export function BoardingPass({
  data,
  className = "",
  onClick,
  isExpanded = true,
}: BoardingPassProps) {
  return (
    <div
      onClick={onClick}
      className={`relative w-full max-w-[390px] rounded-[24px] overflow-hidden shadow-xl border border-white/15 text-white font-sans select-none transition-all duration-300 ${
        onClick ? "cursor-pointer hover:shadow-2xl active:scale-[0.99]" : ""
      } ${className}`}
      style={{
        background: "linear-gradient(145deg, #0A192F 0%, #060D1A 100%)",
      }}
    >
      {/* Background theme gradient if supplied */}
      {data.themeColor && (
        <div className={`absolute inset-0 bg-gradient-to-br ${data.themeColor} -z-10`} />
      )}

      {/* Specular highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

      {/* HEADER: Airline & Flight No */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Plane size={14} className="rotate-45" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            {data.airline}
          </span>
        </div>

        <span className="text-[11px] font-mono font-semibold text-blue-300 bg-blue-500/20 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
          {data.flightNumber}
        </span>
      </div>

      {/* ROUTE BLOCK: Origin ✈ Destination */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        {/* Origin */}
        <div className="space-y-0.5">
          <span className="text-3xl sm:text-4xl font-black tracking-tight text-white block">
            {data.originCode}
          </span>
          <span className="text-[11px] font-medium text-white/60 block">
            {data.originCity}
          </span>
        </div>

        {/* Plane & Route vector graphic */}
        <div className="flex flex-col items-center justify-center px-3">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <div className="w-12 sm:w-16 border-b border-dashed border-white/40" />
            <Plane size={15} className="text-blue-400 shrink-0 rotate-90" />
          </div>
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/50 mt-1">
            DIRETO
          </span>
        </div>

        {/* Destination */}
        <div className="space-y-0.5 text-right">
          <span className="text-3xl sm:text-4xl font-black tracking-tight text-white block">
            {data.destinationCode}
          </span>
          <span className="text-[11px] font-medium text-white/60 block">
            {data.destinationCity}
          </span>
        </div>
      </div>

      {/* FLIGHT DETAILS (Grid 3 cols) */}
      <div className="px-5 py-3 grid grid-cols-3 gap-2 border-t border-white/10 bg-black/20">
        <div className="space-y-0.5">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50 block">
            EMBARQUE
          </span>
          <span className="text-sm font-bold text-white block">
            {data.boardingTime}
          </span>
        </div>

        <div className="space-y-0.5 text-center">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50 block">
            PORTÃO
          </span>
          <span className="text-sm font-bold text-blue-300 block">
            {data.gate}
          </span>
        </div>

        <div className="space-y-0.5 text-right">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50 block">
            ASSENTO
          </span>
          <span className="text-sm font-bold text-white block">
            {data.seat}
          </span>
        </div>
      </div>

      {/* PASSENGER & CLASS */}
      {isExpanded && (
        <div className="px-5 py-2.5 grid grid-cols-2 gap-2 border-t border-white/5 bg-black/30">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50 block">
              PASSAGEIRO
            </span>
            <span className="text-xs font-semibold text-white block uppercase truncate">
              {data.passengerName}
            </span>
          </div>

          <div className="space-y-0.5 text-right">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50 block">
              CLASSE / DATA
            </span>
            <span className="text-xs font-semibold text-white/90 block truncate">
              {data.classType} • {data.flightDate}
            </span>
          </div>
        </div>
      )}

      {/* PERFORATED NOTCHES */}
      {isExpanded && (
        <div className="relative py-2 flex items-center justify-between overflow-hidden">
          <div className="w-5 h-5 rounded-full bg-[#F2F2F7] -ml-2.5 shadow-inner border-r border-black/10" />
          <div className="flex-1 border-b-2 border-dashed border-white/20 mx-2" />
          <div className="w-5 h-5 rounded-full bg-[#F2F2F7] -mr-2.5 shadow-inner border-l border-black/10" />
        </div>
      )}

      {/* BARCODE SECTION */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 flex flex-col items-center justify-center gap-2">
          <div className="w-full max-w-[260px] bg-white rounded-xl p-3 flex flex-col items-center justify-center shadow-xs">
            <div className="w-full flex justify-between items-center h-10 px-1 overflow-hidden opacity-95">
              {Array.from({ length: 44 }).map((_, i) => (
                <div
                  key={i}
                  className="h-full bg-[#0A192F]"
                  style={{
                    width: i % 4 === 0 ? "3.5px" : i % 3 === 0 ? "2px" : "1px",
                    marginRight: i % 5 === 0 ? "2px" : "1px",
                  }}
                />
              ))}
            </div>
          </div>

          <span className="font-mono text-[10px] tracking-widest text-white/60">
            {data.barcodeNumber || "LA 8180 04A 24OCT"}
          </span>
        </div>
      )}
    </div>
  );
}
