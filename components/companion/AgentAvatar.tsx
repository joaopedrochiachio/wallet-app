"use client";

import React from "react";
import { Sparkles, Shield, Compass, Zap, Flame, HeartHandshake } from "lucide-react";

export type AgentAvatarState = "idle" | "thinking" | "celebrating" | "warning" | "alert" | "sleeping";

interface AgentAvatarProps {
  state?: AgentAvatarState;
  persona?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showBadge?: boolean;
  className?: string;
  onClick?: () => void;
}

export function AgentAvatar({
  state = "idle",
  persona = "guardian",
  size = "md",
  showBadge = true,
  className = "",
  onClick,
}: AgentAvatarProps) {
  // Configuração visual de cada persona (estilo Wallet Companion)
  const personaConfig: Record<
    string,
    {
      name: string;
      color: string;
      haloGradient: string;
      icon: React.ReactNode;
      accentBg: string;
      emoji: string;
    }
  > = {
    guardian: {
      name: "Sol",
      color: "#F59E0B", // Âmbar Dourado
      haloGradient: "from-amber-400 via-orange-500 to-yellow-300",
      icon: <Shield size={size === "sm" ? 10 : 13} className="text-amber-300" />,
      accentBg: "bg-amber-500/20 border-amber-400/40",
      emoji: "🌟",
    },
    optimizer: {
      name: "Rubi",
      color: "#EF4444", // Rubi Carmesim
      haloGradient: "from-rose-500 via-red-600 to-pink-400",
      icon: <Flame size={size === "sm" ? 10 : 13} className="text-rose-300" />,
      accentBg: "bg-rose-500/20 border-rose-400/40",
      emoji: "💎",
    },
    builder: {
      name: "Nanquim",
      color: "#3B82F6", // Azul Safira
      haloGradient: "from-blue-500 via-indigo-600 to-cyan-400",
      icon: <Compass size={size === "sm" ? 10 : 13} className="text-blue-300" />,
      accentBg: "bg-blue-500/20 border-blue-400/40",
      emoji: "📜",
    },
    scaler: {
      name: "Atlas",
      color: "#10B981", // Esmeralda / Expansão
      haloGradient: "from-emerald-400 via-teal-500 to-green-300",
      icon: <Zap size={size === "sm" ? 10 : 13} className="text-emerald-300" />,
      accentBg: "bg-emerald-500/20 border-emerald-400/40",
      emoji: "⚡",
    },
    minimalist: {
      name: "Zen",
      color: "#8B5CF6", // Roxo Lavanda
      haloGradient: "from-purple-400 via-violet-500 to-indigo-300",
      icon: <HeartHandshake size={size === "sm" ? 10 : 13} className="text-purple-300" />,
      accentBg: "bg-purple-500/20 border-purple-400/40",
      emoji: "✨",
    },
  };

  const currentPersona = personaConfig[persona] || personaConfig.guardian;

  // Dimensões do Avatar
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-base",
    lg: "w-14 h-14 text-xl",
    xl: "w-20 h-20 text-3xl",
  }[size];

  // Efeito de pulso e animação baseado no estado
  const stateAnimation = {
    idle: "animate-pulse duration-3000",
    thinking: "animate-spin duration-4000",
    celebrating: "animate-bounce duration-1000",
    warning: "animate-pulse duration-1000 ring-2 ring-amber-400",
    alert: "animate-ping duration-1000 ring-2 ring-rose-500",
    sleeping: "opacity-75 scale-95",
  }[state];

  // Indicador de status (bolinha colorida)
  const statusColor = {
    idle: "bg-emerald-500 shadow-[0_0_8px_#10B981]",
    thinking: "bg-cyan-400 shadow-[0_0_8px_#06B6D4] animate-pulse",
    celebrating: "bg-amber-400 shadow-[0_0_10px_#F59E0B]",
    warning: "bg-amber-500 shadow-[0_0_8px_#F59E0B]",
    alert: "bg-rose-500 shadow-[0_0_10px_#EF4444] animate-ping",
    sleeping: "bg-gray-400",
  }[state];

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 select-none group ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      title={`${currentPersona.name} • Estado: ${state}`}
    >
      {/* Halo de Brilho Dinâmico */}
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-tr ${currentPersona.haloGradient} opacity-35 blur-md -z-10 group-hover:opacity-70 transition-opacity ${
          state === "celebrating" ? "scale-125 opacity-60" : ""
        }`}
      />

      {/* Corpo do Avatar Orb */}
      <div
        className={`relative ${sizeClasses} rounded-2xl bg-gradient-to-br from-[#1E1E24] via-[#141416] to-[#0A0A0C] border border-white/20 shadow-lg flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105 active:scale-95`}
      >
        {/* Reflexo de Vidro Apple Wallet Glass */}
        <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        {/* Emojicon / Rosto do Personagem */}
        <span
          className={`transform transition-transform ${
            state === "thinking" ? "scale-90 opacity-90" : ""
          } ${state === "celebrating" ? "scale-110" : ""}`}
        >
          {state === "sleeping" ? "😴" : state === "alert" ? "🚨" : currentPersona.emoji}
        </span>

        {/* Micro-anel de thinking */}
        {state === "thinking" && (
          <div className="absolute inset-0 border-2 border-cyan-400/40 border-t-cyan-300 rounded-2xl animate-spin" />
        )}
      </div>

      {/* Badge de Cargo ou Status */}
      {showBadge && (
        <span
          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#141416] flex items-center justify-center ${statusColor}`}
        />
      )}
    </div>
  );
}
