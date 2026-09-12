"use client";

import React, { useState, useRef, useCallback } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  Wifi,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  QrCode,
  CreditCard,
} from "lucide-react";
import Link from "next/link";

interface PassItem {
  id: string;
  brandSymbol: string;
  brandName: string;
  headerLabel: string;
  headerValue: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryFields: { label: string; value: string }[];
  gradient: string;
  border: string;
  accent: string;
  barcodeNum: string;
}

const DEFAULT_SHOWCASE_PASSES: PassItem[] = [
  {
    id: "square-black",
    brandSymbol: "■",
    brandName: "SQUARE",
    headerLabel: "POINTS",
    headerValue: "2,468",
    primaryLabel: "BLACK PASS",
    primaryValue: "R$ 50.000",
    secondaryFields: [
      { label: "MEMBER", value: "CARLOS ALMEIDA" },
      { label: "STATUS", value: "VIP TITANIUM" },
      { label: "EXPIRE", value: "12/29" },
    ],
    gradient: "from-[#1C1C1E] via-[#141416] to-[#0A0A0C]",
    border: "border-white/20",
    accent: "text-white",
    barcodeNum: "9284 0192 4812",
  },
  {
    id: "star-ruby",
    brandSymbol: "★",
    brandName: "STAR",
    headerLabel: "TIME",
    headerValue: "19:50",
    primaryLabel: "REWARDS PASS",
    primaryValue: "5% CASHBACK",
    secondaryFields: [
      { label: "CARD", value: "SANTANDER UNIQUE" },
      { label: "DUE DAY", value: "DIA 22" },
      { label: "INVOICE", value: "R$ 1.054" },
    ],
    gradient: "from-[#260C0C] via-[#1A0707] to-[#0D0303]",
    border: "border-rose-500/25",
    accent: "text-rose-300",
    barcodeNum: "1094 5820 1934",
  },
  {
    id: "triangle-gold",
    brandSymbol: "▲",
    brandName: "TRIANGLE",
    headerLabel: "EXPIRE",
    headerValue: "31 DEC",
    primaryLabel: "ULTRAVIOLETA",
    primaryValue: "R$ 8.500",
    secondaryFields: [
      { label: "NETWORK", value: "MASTERCARD BLACK" },
      { label: "CLOSING", value: "DIA 08" },
      { label: "POINTS", value: "2.5x POR $" },
    ],
    gradient: "from-[#1F0A2E] via-[#150620] to-[#0C0212]",
    border: "border-purple-500/25",
    accent: "text-purple-300",
    barcodeNum: "7401 2940 5819",
  },
  {
    id: "square-sky",
    brandSymbol: "●",
    brandName: "GLOBAL SKY",
    headerLabel: "GATE",
    headerValue: "F4",
    primaryLabel: "BOARDING PASS",
    primaryValue: "HKG → TPE",
    secondaryFields: [
      { label: "FLIGHT", value: "SQ1234" },
      { label: "BOARD", value: "07:50" },
      { label: "SEAT", value: "12C • CLASS A" },
    ],
    gradient: "from-[#0A192F] via-[#081224] to-[#040914]",
    border: "border-blue-500/25",
    accent: "text-blue-300",
    barcodeNum: "4920 1849 2048",
  },
];

export function Wallet3DShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 8, y: -6 });
  const [isHovered, setIsHovered] = useState(false);
  const [selectedPassId, setSelectedPassId] = useState<string>("square-black");
  const [isFannedOut, setIsFannedOut] = useState<boolean>(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    const maxAngle = 14;
    const rotX = -((mouseY / (rect.height / 2)) * maxAngle) + 6;
    const rotY = (mouseX / (rect.width / 2)) * maxAngle - 4;

    setRotation({ x: rotX, y: rotY });
  }, []);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotation({ x: 8, y: -6 });
  };

  const activePass =
    DEFAULT_SHOWCASE_PASSES.find((p) => p.id === selectedPassId) || DEFAULT_SHOWCASE_PASSES[0];

  return (
    <div className="w-full flex flex-col items-center space-y-6">
      
      {/* Controles de Modo do Wallet Pass Kit */}
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-xl px-4 py-2 rounded-full border border-black/[0.06] shadow-xs text-xs">
        <span className="text-[#86868B] font-medium flex items-center gap-1.5">
          <Layers size={14} className="text-[#1D1D1F]" />
          <span>Visualização de Passes:</span>
        </span>
        <button
          type="button"
          onClick={() => setIsFannedOut(false)}
          className={`px-3 py-1 rounded-full font-semibold transition-all ${
            !isFannedOut
              ? "bg-[#1D1D1F] text-white shadow-xs"
              : "text-[#86868B] hover:text-[#1D1D1F]"
          }`}
        >
          No Bolso do Wallet
        </button>
        <button
          type="button"
          onClick={() => setIsFannedOut(true)}
          className={`px-3 py-1 rounded-full font-semibold transition-all ${
            isFannedOut
              ? "bg-[#1D1D1F] text-white shadow-xs"
              : "text-[#86868B] hover:text-[#1D1D1F]"
          }`}
        >
          Expandir Passes
        </button>
      </div>

      {/* Palco Espacial 3D com Wallet Pass Kit */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-full max-w-2xl h-[440px] md:h-[480px] flex items-center justify-center relative select-none [perspective:1400px] cursor-grab active:cursor-grabbing"
      >
        {/* Glow dinâmico de iluminação */}
        <div
          className="absolute w-80 h-80 rounded-full blur-3xl opacity-35 transition-all duration-700 pointer-events-none"
          style={{
            background:
              selectedPassId === "triangle-gold"
                ? "radial-gradient(circle, rgba(147,51,234,0.4) 0%, transparent 70%)"
                : selectedPassId === "star-ruby"
                ? "radial-gradient(circle, rgba(244,63,94,0.4) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)",
          }}
        />

        {/* OBJETO 3D: A CARTEIRA COM NOTCH PASS KIT */}
        <div
          style={{
            transform: `perspective(1400px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) translateZ(0px)`,
            transformStyle: "preserve-3d",
            transition: isHovered
              ? "transform 0.1s ease-out"
              : "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
          className="relative w-[340px] md:w-[380px] h-[260px] flex items-end justify-center"
        >
          
          {/* Bolso Traseiro (Couro Matte de Alta Resolução) */}
          <div
            style={{
              transform: "translateZ(-45px)",
              transformStyle: "preserve-3d",
            }}
            className="absolute inset-0 bg-gradient-to-b from-[#2A2A2E] via-[#1E1E22] to-[#121215] rounded-[34px] border border-white/15 shadow-[0_30px_60px_rgba(0,0,0,0.35)]"
          >
            {/* Costura artesanal superior */}
            <div className="absolute top-3 inset-x-6 h-[1px] border-t border-dashed border-white/20" />
          </div>

          {/* PILHA DE PASSES DENTRO DO WALLET (Pass Kit Anatomy) */}
          <div
            style={{
              transformStyle: "preserve-3d",
            }}
            className="relative w-full h-full flex flex-col items-center justify-end z-10"
          >
            {DEFAULT_SHOWCASE_PASSES.map((pass, idx) => {
              const isSelected = pass.id === selectedPassId;

              // Posições no bolso com estilo Pass Kit
              const stackedOffsetY = isSelected ? -145 : -idx * 30 - 25;
              const fannedOffsetY = isSelected ? -165 : -idx * 48 - 20;
              const offsetY = isFannedOut ? fannedOffsetY : stackedOffsetY;
              const rotZ = isFannedOut ? (idx - 1.5) * 5 : isSelected ? -2 : (idx - 1) * 1.5;
              const zIndex = isSelected ? 50 : 20 - idx;
              const translateZ = isSelected ? 40 : -idx * 8;

              return (
                <div
                  key={pass.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPassId(pass.id);
                  }}
                  style={{
                    transform: `translateY(${offsetY}px) translateZ(${translateZ}px) rotateZ(${rotZ}deg) scale(${
                      isSelected ? 1.04 : 1
                    })`,
                    transformStyle: "preserve-3d",
                    zIndex,
                    transition:
                      "transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28), box-shadow 0.3s ease",
                  }}
                  className={`absolute w-[310px] md:w-[340px] h-[210px] rounded-[22px] text-white bg-gradient-to-br ${pass.gradient} border ${pass.border} shadow-[0_15px_35px_rgba(0,0,0,0.25)] cursor-pointer transition-all hover:brightness-110 flex flex-col justify-between p-4 overflow-hidden`}
                >
                  {/* Notch Semicircular Superior (Thumb Scoop do Pass Kit) */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-4 bg-[#18181B] rounded-b-full border-b border-x border-white/20 pointer-events-none opacity-90 shadow-inner" />

                  {/* Header do Pass (Logotipo à esquerda, Métrica à direita) */}
                  <div className="relative z-10 flex justify-between items-start pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs opacity-90 font-bold">{pass.brandSymbol}</span>
                      <span className="text-xs font-semibold tracking-wider uppercase font-mono text-white/90">
                        {pass.brandName}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-widest font-semibold text-white/60 block leading-none">
                        {pass.headerLabel}
                      </span>
                      <span className="text-xs font-semibold text-white font-mono mt-0.5 block">
                        {pass.headerValue}
                      </span>
                    </div>
                  </div>

                  {/* Campo Primário */}
                  <div className="relative z-10 my-auto py-1">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block font-medium">
                      {pass.primaryLabel}
                    </span>
                    <div className="text-xl font-semibold tracking-tight text-white mt-0.5">
                      {pass.primaryValue}
                    </div>
                  </div>

                  {/* Campos Secundários em Grid de 3 colunas (Padrão Pass Kit) */}
                  <div className="relative z-10 grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-white/15">
                    {pass.secondaryFields.map((f) => (
                      <div key={f.label}>
                        <span className="text-[8px] uppercase tracking-widest text-white/50 block font-medium">
                          {f.label}
                        </span>
                        <span className="text-[10px] font-semibold text-white tracking-wide block truncate">
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Barcode Strip sutil na base */}
                  <div className="relative z-10 pt-1.5 flex items-center justify-between text-white/40">
                    <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest">
                      <QrCode size={11} className="opacity-75" />
                      <span>{pass.barcodeNum}</span>
                    </div>
                    <Wifi size={12} className="rotate-90 opacity-60" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bolso Frontal com Entalhe Thumb Scoop (Estilo Ícone do Wallet) */}
          <div
            style={{
              transform: "translateZ(35px)",
              transformStyle: "preserve-3d",
            }}
            className="absolute -bottom-2 inset-x-0 h-[155px] bg-gradient-to-b from-[#26262B] via-[#1A1A1E] to-[#0E0E10] rounded-b-[34px] rounded-t-[18px] border-t-2 border-x border-b border-white/15 shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex flex-col justify-between p-5 z-40 pointer-events-none"
          >
            {/* O famoso Entalhe Thumb Scoop no topo do bolso frontal */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-20 h-6 bg-[#18181B] rounded-b-full border-b border-x border-white/20 shadow-inner flex items-center justify-center">
              <div className="w-8 h-1 bg-white/20 rounded-full" />
            </div>

            <div className="flex items-center justify-between text-white/60 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold text-[11px]">
                  W
                </div>
                <span className="text-xs font-semibold text-white/90 tracking-tight">
                  Wallet Intelligence
                </span>
              </div>

              <span className="text-[9px] font-mono tracking-wider uppercase bg-white/10 px-2 py-0.5 rounded-full border border-white/10 text-white/80">
                Pass Kit Standard
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Cartão de Inspeção do Pass Ativo */}
      <div className="w-full max-w-md bg-white rounded-[22px] p-4 border border-black/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.04)] flex items-center justify-between gap-4 animate-in fade-in">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activePass.gradient} text-white flex items-center justify-center shadow-xs shrink-0`}
          >
            <span className="font-bold text-sm">{activePass.brandSymbol}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-semibold text-[#1D1D1F]">
                {activePass.brandName} • {activePass.primaryLabel}
              </h4>
            </div>
            <p className="text-xs text-[#86868B]">
              {activePass.primaryValue} • {activePass.headerLabel}: {activePass.headerValue}
            </p>
          </div>
        </div>

        <Link
          href="/profile"
          className="bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 shadow-xs shrink-0 active:scale-95"
        >
          <span>Configurar</span>
          <ArrowUpRight size={14} />
        </Link>
      </div>

    </div>
  );
}
