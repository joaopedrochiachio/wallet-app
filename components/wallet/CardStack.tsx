"use client";

import React, { useState } from "react";
import { WalletCardData } from "@/types/wallet";
import { BankCard } from "./BankCard";
import { GlassCard } from "./GlassCard";

interface CardStackProps {
  cards: WalletCardData[];
  onSelectCard?: (cardId: string) => void;
  className?: string;
}

export function CardStack({ cards, onSelectCard, className = "" }: CardStackProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);

  if (!cards || cards.length === 0) return null;

  const handleCardClick = (index: number, cardId: string) => {
    setSelectedIndex(index);
    if (onSelectCard) {
      onSelectCard(cardId);
    }
  };

  return (
    <div
      className={`relative w-full max-w-[420px] mx-auto py-4 font-sans select-none ${className}`}
      style={{ perspective: "1200px" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredCardIndex(null);
      }}
    >
      {/* 3D Stack Container */}
      <div
        className="relative w-full flex justify-center"
        style={{
          height: "260px",
          transformStyle: "preserve-3d",
        }}
      >
        {cards.slice(0, 3).map((card, index) => {
          // Calculate relative position from selected
          const isSelected = index === selectedIndex;
          const isCardHovered = hoveredCardIndex === index;

          // Fan-out calculations
          let translateY = 0;
          let translateZ = 0;
          let scale = 1;
          let rotateX = 0;
          let rotateZ = 0;
          let zIndex = 10;
          let opacity = 1;

          if (index === 0) {
            // Front Card
            translateY = isHovered ? -16 : 0;
            translateZ = isSelected ? 40 : 0;
            rotateX = isHovered ? 4 : 0;
            scale = 1;
            zIndex = isSelected ? 30 : 20;
          } else if (index === 1) {
            // Middle Card
            translateY = isHovered ? 52 : 28;
            translateZ = isSelected ? 40 : -25;
            rotateX = isHovered ? 6 : 2;
            scale = isHovered ? 0.98 : 0.95;
            zIndex = isSelected ? 30 : 15;
            opacity = 0.95;
          } else if (index === 2) {
            // Back Card
            translateY = isHovered ? 120 : 54;
            translateZ = isSelected ? 40 : -50;
            rotateX = isHovered ? 8 : 4;
            scale = isHovered ? 0.96 : 0.91;
            zIndex = isSelected ? 30 : 10;
            opacity = 0.9;
          }

          // If this specific card is hovered by cursor in desktop
          if (isCardHovered) {
            translateY -= 12;
            translateZ += 30;
            scale += 0.02;
            rotateX = 0;
          }

          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(index, card.id)}
              onMouseEnter={() => setHoveredCardIndex(index)}
              onMouseLeave={() => setHoveredCardIndex(null)}
              className="absolute top-0 w-full max-w-[390px] px-2 transition-all duration-300 ease-out cursor-pointer"
              style={{
                transform: `translate3d(0, ${translateY}px, ${translateZ}px) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
                zIndex: isCardHovered ? 40 : zIndex,
                opacity,
                transformStyle: "preserve-3d",
              }}
            >
              {card.isGlass || card.variant === "glass" ? (
                <GlassCard card={card} interactive={false} />
              ) : (
                <BankCard card={card} interactive={false} />
              )}
            </div>
          );
        })}
      </div>

      {/* Selector Pills / Indicators */}
      <div className="flex items-center justify-center gap-2 mt-8">
        {cards.slice(0, 3).map((card, i) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(i, card.id)}
            className={`transition-all duration-300 cursor-pointer ${
              selectedIndex === i
                ? "w-8 h-2 bg-[#1D1D1F] rounded-full"
                : "w-2 h-2 bg-gray-300 hover:bg-gray-400 rounded-full"
            }`}
            aria-label={`Selecionar ${card.title}`}
          />
        ))}
      </div>
    </div>
  );
}
