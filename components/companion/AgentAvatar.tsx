"use client";

import React from "react";
import { WalletCharacter, CharacterState, normalizeCharacterId } from "./WalletCharacters";

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
  // Converte o estado para o padrão emocional do WalletCharacter
  const mappedState: CharacterState = {
    idle: "ocioso",
    thinking: "pensando",
    celebrating: "sucesso",
    warning: "alerta",
    alert: "alerta",
    sleeping: "dormindo",
  }[state] as CharacterState || "ocioso";

  const charId = normalizeCharacterId(persona);

  return (
    <div onClick={onClick} className={`inline-block ${onClick ? "cursor-pointer" : ""}`}>
      <WalletCharacter
        id={charId}
        state={mappedState}
        size={size}
        showBadge={showBadge}
        className={className}
      />
    </div>
  );
}
