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

interface DragState {
  cardId: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

const COLLAPSED_GAP = 34;
const EXPANDED_GAP = 82;
const DRAG_THRESHOLD = 7;

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function CardStack({ cards, onSelectCard, className = "" }: CardStackProps) {
  // Index 0 is the card at the front, as in the iPhone Wallet stack.
  const [cardOrder, setCardOrder] = useState<string[]>(() => cards.map((card) => card.id));
  const [isExpanded, setIsExpanded] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  if (!cards.length) return null;

  // Keep locally reordered cards while safely adding/removing cards received through props.
  const currentCardIds = cards.map((card) => card.id);
  const effectiveOrder = [
    ...cardOrder.filter((id) => currentCardIds.includes(id)),
    ...currentCardIds.filter((id) => !cardOrder.includes(id)),
  ];
  const orderedCards = effectiveOrder
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is WalletCardData => Boolean(card));

  const selectCard = (cardId: string, collapse = true) => {
    const nextOrder = [cardId, ...effectiveOrder.filter((id) => id !== cardId)];
    setCardOrder(nextOrder);
    if (collapse) setIsExpanded(false);
    onSelectCard?.(cardId);
  };

  const reorderCard = (cardId: string, targetIndex: number) => {
    const sourceIndex = effectiveOrder.indexOf(cardId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;

    const nextOrder = moveItem(effectiveOrder, sourceIndex, targetIndex);
    setCardOrder(nextOrder);
    onSelectCard?.(nextOrder[0]);
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    cardId: string,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      cardId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: 0,
      y: 0,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    setDrag((current) => {
      if (!current || current.pointerId !== event.pointerId) return current;

      return {
        ...current,
        x: event.clientX - current.startX,
        y: event.clientY - current.startY,
      };
    });
  };

  const finishPointerGesture = (
    event: React.PointerEvent<HTMLDivElement>,
    cardId: string,
  ) => {
    if (!drag || drag.pointerId !== event.pointerId || drag.cardId !== cardId) return;

    const sourceIndex = effectiveOrder.indexOf(cardId);
    // Read the release coordinates directly. Pointer-move state can still be
    // one animation frame behind when the user releases a fast swipe.
    const finalX = event.clientX - drag.startX;
    const finalY = event.clientY - drag.startY;
    const distance = Math.hypot(finalX, finalY);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (distance < DRAG_THRESHOLD) {
      if (sourceIndex === 0) {
        setIsExpanded((current) => !current);
      } else {
        selectCard(cardId);
      }
      setDrag(null);
      return;
    }

    if (!isExpanded) {
      // A short pull on the closed stack opens it on both touch and mouse.
      setIsExpanded(true);
      setDrag(null);
      return;
    }

    // Visual order runs from bottom/front (index 0) to top/back. Moving a
    // card down therefore moves it toward index 0, matching the iPhone Wallet.
    const indexDelta = Math.round(-finalY / EXPANDED_GAP);
    const targetIndex = Math.max(
      0,
      Math.min(orderedCards.length - 1, sourceIndex + indexDelta),
    );

    reorderCard(cardId, targetIndex);
    setDrag(null);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    cardId: string,
    index: number,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (index === 0) setIsExpanded((current) => !current);
      else selectCard(cardId);
      return;
    }

    if (!isExpanded) return;

    if (event.key === "ArrowDown" && index > 0) {
      event.preventDefault();
      reorderCard(cardId, index - 1);
    }

    if (event.key === "ArrowUp" && index < orderedCards.length - 1) {
      event.preventDefault();
      reorderCard(cardId, index + 1);
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectCard(cardId, false);
    }
  };

  const cardHeight = "clamp(190px, 58vw, 246px)";
  const stackGap = isExpanded ? EXPANDED_GAP : COLLAPSED_GAP;
  const stackHeight = `calc(${cardHeight} + ${stackGap * (orderedCards.length - 1)}px)`;

  return (
    <div
      className={`relative w-full max-w-[420px] mx-auto font-sans select-none ${className}`}
      style={{ perspective: "1400px" }}
      data-expanded={isExpanded}
      data-testid="wallet-card-stack"
    >
      <div
        className="pointer-events-none relative w-full transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ height: stackHeight, transformStyle: "preserve-3d" }}
        aria-label="Pilha de cartões da carteira"
      >
        {orderedCards.map((card, index) => {
          const reverseIndex = orderedCards.length - 1 - index;
          const isDragging = drag?.cardId === card.id;
          const dragX = isDragging ? drag.x : 0;
          const dragY = isDragging ? drag.y : 0;
          const translateY = reverseIndex * stackGap + dragY;
          // Keep every card in front of the container's hit-test plane. Negative
          // Z values look correct but make rear cards impossible to click in Chromium.
          const depth = orderedCards.length - index;
          const translateZ = isDragging ? 96 : isExpanded ? depth * 4 : depth * 16;
          const scale = isDragging ? 1.018 : isExpanded ? 1 : 1 - index * 0.018;
          const rotateX = isDragging ? 0 : isExpanded ? 0 : 4;
          const rotateZ = isDragging
            ? Math.max(-5, Math.min(5, dragX * 0.025))
            : isExpanded
              ? 0
              : index === 0
                ? 0
                : index % 2 === 0
                  ? -0.7
                  : 0.7;

          return (
            <div
              key={card.id}
              role="button"
              tabIndex={0}
              aria-label={`${card.title}. ${
                index === 0
                  ? isExpanded
                    ? "Cartão principal. Toque para fechar a pilha."
                    : "Cartão principal. Toque para abrir a pilha."
                  : "Toque para tornar este o cartão principal."
              }`}
              aria-pressed={index === 0}
              aria-roledescription="cartão reordenável"
              onPointerDown={(event) => handlePointerDown(event, card.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => finishPointerGesture(event, card.id)}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(event) => handleKeyDown(event, card.id, index)}
              className={`pointer-events-auto absolute top-0 left-1/2 w-full max-w-[390px] px-2 outline-none cursor-grab focus-visible:ring-4 focus-visible:ring-blue-500/30 focus-visible:rounded-[30px] active:cursor-grabbing ${
                isDragging
                  ? "transition-none"
                  : "transition-[transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              }`}
              style={{
                transform: `translate3d(calc(-50% + ${dragX}px), ${translateY}px, ${translateZ}px) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
                zIndex: isDragging ? 100 : 50 - index,
                transformStyle: "preserve-3d",
                touchAction: "none",
                filter: isDragging ? "brightness(1.04)" : "none",
                willChange: isDragging ? "transform" : "auto",
              }}
              data-card-id={card.id}
              data-card-index={index}
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

      <div className="mt-4 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="min-h-9 rounded-full bg-[#F2F2F7] px-4 text-[11px] font-semibold text-[#1D1D1F] transition-colors hover:bg-[#E5E5EA] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Fechar carteira" : "Ver todos os cartões"}
        </button>

        <div className="flex items-center justify-center gap-2" aria-label="Selecionar cartão">
          {orderedCards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              onClick={() => selectCard(card.id)}
              className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 ${
                index === 0
                  ? "w-8 bg-[#1D1D1F]"
                  : "w-2 bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Selecionar ${card.title}`}
              aria-current={index === 0 ? "true" : undefined}
              title={card.title}
            />
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {isExpanded
          ? "Carteira aberta. Arraste os cartões para mudar a ordem."
          : `Carteira fechada. ${orderedCards[0]?.title} é o cartão principal.`}
      </p>
    </div>
  );
}
