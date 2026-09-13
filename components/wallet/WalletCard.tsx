"use client";

import React from "react";
import { WalletCardData, WalletCardVariant, BoardingPassData, LoyaltyPassData } from "@/types/wallet";
import { BankCard } from "./BankCard";
import { GlassCard } from "./GlassCard";
import { BoardingPass } from "./BoardingPass";
import { LoyaltyPass } from "./LoyaltyPass";
import { WalletPass } from "./WalletPass";

export interface WalletCardProps {
  card: WalletCardData;
  variant?: WalletCardVariant;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export function WalletCard({
  card,
  variant = card.variant || "bank",
  className = "",
  onClick,
  interactive = true,
}: WalletCardProps) {
  // If explicitly glass or marked isGlass
  if (variant === "glass" || card.isGlass) {
    return (
      <GlassCard
        card={card}
        className={className}
        onClick={onClick}
        interactive={interactive}
      />
    );
  }

  // If Bank Card
  if (variant === "bank") {
    return (
      <BankCard
        card={card}
        className={className}
        onClick={onClick}
        interactive={interactive}
      />
    );
  }

  // If pass / loyalty / boarding pass
  if (variant === "loyalty") {
    const loyaltyData: LoyaltyPassData = {
      id: card.id,
      type: "loyalty",
      programName: card.title,
      category: card.subtitle || "Fidelidade",
      pointsBalance: card.balance ? `${card.balance.toLocaleString()} pts` : "50.000 pts",
      tier: "Black Tier",
      memberId: card.cardNumber || "WP-8842",
      holderName: card.holderName || "SEU NOME",
      validThru: card.expirationDate || "12/2028",
      barcodeNumber: card.cardNumber,
      themeColor: card.background,
    };
    return (
      <LoyaltyPass
        data={loyaltyData}
        className={className}
        onClick={onClick}
      />
    );
  }

  if (variant === "boarding-pass") {
    const boardingData: BoardingPassData = {
      id: card.id,
      type: "boarding-pass",
      airline: card.title || "AIRLINES",
      originCode: "GRU",
      originCity: "São Paulo",
      destinationCode: "JFK",
      destinationCity: "Nova York",
      flightNumber: "LA8180",
      gate: "32B",
      seat: "04A",
      passengerName: card.holderName || "SEU NOME",
      classType: "Executiva",
      boardingTime: "21:15",
      flightDate: "24 OUT 2026",
      barcodeNumber: card.cardNumber,
      themeColor: card.background,
    };
    return (
      <BoardingPass
        data={boardingData}
        className={className}
        onClick={onClick}
      />
    );
  }

  // Fallback / Generic Pass
  return (
    <WalletPass
      headerLabel={card.title}
      headerValue={card.brand}
      primaryLabel="SALDO / LIMITE"
      primaryValue={`R$ ${(card.balance || card.limit || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
      secondaryFields={[
        { label: "TITULAR", value: card.holderName || "SEU NOME" },
        { label: "NÚMERO", value: card.cardNumber || "•••• 4892" },
        { label: "VALIDADE", value: card.expirationDate || "12/29" },
      ]}
      barcodeNumber={card.cardNumber}
      themeColor={card.background}
      className={className}
      onClick={onClick}
    />
  );
}
