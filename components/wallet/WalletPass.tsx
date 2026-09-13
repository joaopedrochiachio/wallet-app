"use client";

import React from "react";
import { QrCode } from "lucide-react";

export interface WalletPassField {
  label: string;
  value: string;
  align?: "left" | "center" | "right";
}

export interface WalletPassProps {
  id?: string;
  headerLabel: string;
  headerValue?: string;
  headerIcon?: React.ReactNode;
  primaryLabel: string;
  primaryValue: string;
  secondaryFields?: WalletPassField[];
  auxiliaryFields?: WalletPassField[];
  barcodeNumber?: string;
  themeColor?: string; // Gradient or background class
  onClick?: () => void;
  className?: string;
  isExpanded?: boolean;
}

export function WalletPass({
  headerLabel,
  headerValue,
  headerIcon,
  primaryLabel,
  primaryValue,
  secondaryFields = [],
  auxiliaryFields = [],
  barcodeNumber,
  themeColor = "from-[#1C1C1E] via-[#151518] to-[#0D0D10]",
  onClick,
  className = "",
  isExpanded = true,
}: WalletPassProps) {
  return (
    <div
      onClick={onClick}
      className={`relative w-full max-w-[390px] rounded-[24px] overflow-hidden shadow-xl border border-white/15 text-white font-sans select-none transition-all duration-300 ${
        onClick ? "cursor-pointer hover:shadow-2xl" : ""
      } ${className}`}
      style={{
        background: "linear-gradient(145deg, #1C1C1E 0%, #121214 100%)",
      }}
    >
      {/* Background theme gradient if provided */}
      {themeColor && (
        <div className={`absolute inset-0 bg-gradient-to-br ${themeColor} -z-10`} />
      )}

      {/* Specular subtle light gleam */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

      {/* 1. HEADER BAND */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {headerIcon && <div className="text-white/90">{headerIcon}</div>}
          <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
            {headerLabel}
          </span>
        </div>

        {headerValue && (
          <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider bg-white/10 px-2.5 py-0.5 rounded-full">
            {headerValue}
          </span>
        )}
      </div>

      {/* 2. PRIMARY FIELD (Prominent Apple typography) */}
      <div className="px-5 pt-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60 block mb-0.5">
          {primaryLabel}
        </span>
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {primaryValue}
        </div>
      </div>

      {/* 3. SECONDARY FIELDS (Grid 2-3 cols) */}
      {secondaryFields.length > 0 && (
        <div className="px-5 py-3 grid grid-cols-3 gap-2 border-t border-white/5">
          {secondaryFields.map((field, idx) => (
            <div
              key={idx}
              className={`space-y-0.5 ${
                field.align === "right"
                  ? "text-right"
                  : field.align === "center"
                  ? "text-center"
                  : "text-left"
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50 block truncate">
                {field.label}
              </span>
              <span className="text-xs font-semibold text-white tracking-tight block truncate">
                {field.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 4. AUXILIARY FIELDS (If expanded) */}
      {isExpanded && auxiliaryFields.length > 0 && (
        <div className="px-5 py-2.5 grid grid-cols-2 gap-2 border-t border-white/5 bg-black/15">
          {auxiliaryFields.map((field, idx) => (
            <div
              key={idx}
              className={`space-y-0.5 ${
                field.align === "right" ? "text-right" : "text-left"
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50 block">
                {field.label}
              </span>
              <span className="text-xs font-semibold text-white/90 tracking-tight block">
                {field.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 5. PERFORATED NOTCHES & DIVIDER */}
      {isExpanded && (
        <div className="relative py-2 flex items-center justify-between overflow-hidden">
          {/* Left Notch */}
          <div className="w-5 h-5 rounded-full bg-[#F2F2F7] -ml-2.5 shadow-inner border-r border-black/10" />
          {/* Dashed line */}
          <div className="flex-1 border-b-2 border-dashed border-white/20 mx-2" />
          {/* Right Notch */}
          <div className="w-5 h-5 rounded-full bg-[#F2F2F7] -mr-2.5 shadow-inner border-l border-black/10" />
        </div>
      )}

      {/* 6. BARCODE / CODE SECTION (Apple Pass style) */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 flex flex-col items-center justify-center gap-2">
          {/* Clean simulated PDF417 / Apple Pass Barcode pattern */}
          <div className="w-full max-w-[260px] bg-white rounded-xl p-3 flex flex-col items-center justify-center shadow-xs">
            <div className="w-full flex justify-between items-center h-10 px-1 overflow-hidden opacity-90">
              {/* Repeated SVG Barcode lines */}
              {Array.from({ length: 42 }).map((_, i) => (
                <div
                  key={i}
                  className="h-full bg-[#1D1D1F]"
                  style={{
                    width: i % 3 === 0 ? "3px" : i % 5 === 0 ? "4px" : "1.5px",
                    marginRight: i % 4 === 0 ? "2px" : "1px",
                  }}
                />
              ))}
            </div>
          </div>

          {barcodeNumber && (
            <span className="font-mono text-[10px] tracking-widest text-white/60">
              {barcodeNumber}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
