"use client";

import { useState } from "react";
import { WalletCardData } from "@/types/wallet";
import { BankCard } from "./BankCard";
import { GlassCard } from "./GlassCard";

interface CardStackProps {
  cards: WalletCardData[];
  onSelectCard?: (cardId: string) => void;
  className?: string;
}

export function CardStack({ cards, onSelectCard, className = "" }: CardStackProps) {
  // Ordered card IDs: index 0 is always the active front card
  const [cardOrder, setCardOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [isStackHovered, setIsStackHovered] = useState<boolean>(false);

  if (!cards || cards.length === 0) return null;

  // Build ordered list of cards
  const currentCardIds = cards.map((card) => card.id);
  const effectiveOrder = [
    ...cardOrder.filter((id) => currentCardIds.includes(id)),
    ...currentCardIds.filter((id) => !cardOrder.includes(id)),
  ];
  const orderedCards = effectiveOrder
    .map((id) => cards.find((c) => c.id === id))
    .filter(Boolean) as WalletCardData[];

  const handleSelectCard = (selectedId: string) => {
    // Bring clicked card to the front (index 0)
    setCardOrder((prev) => {
      const rest = prev.filter((id) => id !== selectedId);
      return [selectedId, ...rest];
    });

    if (onSelectCard) {
      onSelectCard(selectedId);
    }
  };

  const stackCards = orderedCards.slice(0, 3);

  return (
    <div
      className={`relative w-full max-w-[420px] mx-auto py-2 font-sans select-none ${className}`}
      style={{ perspective: "1200px" }}
      onMouseEnter={() => setIsStackHovered(true)}
      onMouseLeave={() => {
        setIsStackHovered(false);
        setHoveredCardId(null);
      }}
    >
      {/* 3D Stack Container */}
      <div
        className="relative w-full flex justify-center transition-all duration-400"
        style={{
          height: isStackHovered ? "360px" : "320px",
          transformStyle: "preserve-3d",
        }}
      >
        {stackCards.map((card, index) => {
          const isFront = index === 0;
          const isHovered = hoveredCardId === card.id;

          // Apple Wallet Natural Top-Peek Stacking:
          // Back cards sit higher (translateY is smaller), so their top brand header is visible above the cards in front.
          // Front card sits lowest (translateY is largest) with highest z-index.
          let translateY = 0;
          let translateZ = 0;
          let scale = 1;
          const rotateX = isStackHovered ? 4 : 6;
          let zIndex = 30 - index * 10;
          let opacity = 1;

          if (index === 0) {
            // Front Card: fully visible at the bottom of the stack
            translateY = isStackHovered ? 140 : 100;
            translateZ = isHovered ? 30 : 0;
            scale = 1;
            zIndex = 30;
          } else if (index === 1) {
            // Middle Card: peeking out from above Card 0
            translateY = isStackHovered ? 70 : 50;
            translateZ = isHovered ? 35 : -20;
            scale = isStackHovered ? 0.98 : 0.96;
            zIndex = isHovered ? 35 : 20;
            opacity = 0.98;
          } else if (index === 2) {
            // Back Card: peeking out from the very top of the stack
            translateY = isStackHovered ? 0 : 0;
            translateZ = isHovered ? 35 : -40;
            scale = isStackHovered ? 0.96 : 0.92;
            zIndex = isHovered ? 35 : 10;
            opacity = 0.95;
          }

          // Elevation when specifically hovered
          if (isHovered && !isFront) {
            translateY -= 12;
            scale += 0.02;
          }

          return (
            <div
              key={card.id}
              onClick={() => handleSelectCard(card.id)}
              onMouseEnter={() => setHoveredCardId(card.id)}
              onMouseLeave={() => setHoveredCardId(null)}
              className="absolute top-0 w-full max-w-[390px] px-2 cursor-pointer transition-all duration-400 ease-out"
              style={{
                transform: `translate3d(0, ${translateY}px, ${translateZ}px) rotateX(${rotateX}deg) scale(${scale})`,
                zIndex,
                opacity,
                transformStyle: "preserve-3d",
              }}
              title={isFront ? card.title : `Toque para selecionar ${card.title}`}
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
      <div className="flex items-center justify-center gap-2 mt-2">
        {stackCards.map((card, i) => (
          <button
            key={card.id}
            onClick={() => handleSelectCard(card.id)}
            className={`transition-all duration-300 cursor-pointer ${
              i === 0
                ? "w-8 h-2 bg-[#1D1D1F] rounded-full"
                : "w-2 h-2 bg-gray-300 hover:bg-gray-400 rounded-full"
            }`}
            aria-label={`Selecionar ${card.title}`}
            title={card.title}
          />
        ))}
      </div>
    </div>
  );
}
