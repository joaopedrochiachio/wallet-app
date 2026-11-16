"use client";

import React, { useId } from "react";

/**
 * Cofi — assistente original do Wallet+.
 * Um cofrinho arredondado com fenda de moeda, olhos expressivos e bochechas.
 * Cada estado muda olhos, boca e um detalhe (moeda, pontinhos, "!", "z").
 * Animações em CSS (.cofi-*) respeitam prefers-reduced-motion.
 */
export type CofiState = "ocioso" | "pensando" | "escrevendo" | "alerta" | "sucesso" | "erro" | "dormindo";

interface CofiProps {
  state?: CofiState;
  size?: number;
  className?: string;
  /** Texto para leitores de tela; sem ele o personagem é decorativo. */
  label?: string;
}

export function Cofi({ state = "ocioso", size = 48, className = "", label }: CofiProps) {
  const uid = useId().replace(/:/g, "");
  const body = `cofi-body-${uid}`;
  const shine = `cofi-shine-${uid}`;

  const eyes = (() => {
    switch (state) {
      case "sucesso":
        return (
          <g stroke="#10301C" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M36 50 q6 -7 12 0" />
            <path d="M60 50 q6 -7 12 0" />
          </g>
        );
      case "dormindo":
        return (
          <g stroke="#10301C" strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M36 50 q6 5 12 0" />
            <path d="M60 50 q6 5 12 0" />
          </g>
        );
      case "erro":
        return (
          <g stroke="#10301C" strokeWidth="4" strokeLinecap="round">
            <path d="M37 49 h10" />
            <path d="M61 49 h10" />
          </g>
        );
      default: {
        const look = state === "pensando" ? { x: 3, y: -4 } : state === "escrevendo" ? { x: 0, y: 3 } : { x: 0, y: 0 };
        const r = state === "alerta" ? 6.5 : 5.5;
        return (
          <g className={state === "ocioso" ? "cofi-blink" : undefined}>
            <circle cx={42 + look.x} cy={49 + look.y} r={r} fill="#10301C" />
            <circle cx={66 + look.x} cy={49 + look.y} r={r} fill="#10301C" />
            <circle cx={44 + look.x} cy={47 + look.y} r={1.8} fill="#fff" />
            <circle cx={68 + look.x} cy={47 + look.y} r={1.8} fill="#fff" />
          </g>
        );
      }
    }
  })();

  const mouth = (() => {
    switch (state) {
      case "sucesso":
        return <path d="M46 62 q8 9 16 0" fill="#10301C" />;
      case "alerta":
        return <ellipse cx="54" cy="64" rx="4" ry="4.5" fill="#10301C" />;
      case "erro":
        return <path d="M45 66 q4.5 -4 9 0 t9 0" stroke="#10301C" strokeWidth="3" strokeLinecap="round" fill="none" />;
      case "dormindo":
        return <ellipse cx="54" cy="64" rx="3" ry="2" fill="#10301C" />;
      case "escrevendo":
        return <path d="M48 63 h12" stroke="#10301C" strokeWidth="3.5" strokeLinecap="round" className="cofi-talk" />;
      default:
        return <path d="M47 62 q7 6 14 0" stroke="#10301C" strokeWidth="3.5" strokeLinecap="round" fill="none" />;
    }
  })();

  return (
    <span
      className={`cofi relative inline-flex shrink-0 ${className}`}
      data-state={state}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 108 108" width={size} height={size} className="cofi-figure overflow-visible">
        <defs>
          <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--cofi-top, #5BE584)" />
            <stop offset="1" stopColor="var(--cofi-bottom, #22B357)" />
          </linearGradient>
          <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Moeda que cai na fenda quando dá certo */}
        {state === "sucesso" && (
          <g className="cofi-coin">
            <circle cx="54" cy="6" r="8" fill="#FFD233" stroke="#E0A800" strokeWidth="2" />
            <path d="M54 2 v8" stroke="#E0A800" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {/* Pezinhos */}
        <rect x="30" y="86" width="12" height="12" rx="5" fill="var(--cofi-bottom, #22B357)" />
        <rect x="66" y="86" width="12" height="12" rx="5" fill="var(--cofi-bottom, #22B357)" />

        {/* Corpo */}
        <g className="cofi-bob">
          <rect x="10" y="20" width="88" height="72" rx="30" fill={`url(#${body})`} />
          <path d="M22 36 q6 -12 22 -13" stroke={`url(#${shine})`} strokeWidth="7" strokeLinecap="round" fill="none" />
          {/* Fenda da moeda */}
          <rect x="42" y="25" width="24" height="5" rx="2.5" fill="#10301C" opacity="0.55" />
          {/* Focinho lateral */}
          <rect x="94" y="46" width="9" height="16" rx="4.5" fill="var(--cofi-bottom, #22B357)" />
          {/* Bochechas */}
          <ellipse cx="31" cy="60" rx="6" ry="4" fill="#FF8FA3" opacity="0.55" />
          <ellipse cx="77" cy="60" rx="6" ry="4" fill="#FF8FA3" opacity="0.55" />
          {state === "alerta" && (
            <g stroke="#10301C" strokeWidth="3" strokeLinecap="round">
              <path d="M35 38 l12 3" />
              <path d="M73 38 l-12 3" />
            </g>
          )}
          {eyes}
          {mouth}
        </g>

        {/* Detalhes por estado */}
        {state === "pensando" && (
          <g fill="var(--cofi-accent, #0A84FF)">
            <circle className="cofi-dot" cx="86" cy="14" r="3.5" style={{ animationDelay: "0ms" }} />
            <circle className="cofi-dot" cx="96" cy="8" r="3" style={{ animationDelay: "180ms" }} />
            <circle className="cofi-dot" cx="104" cy="2" r="2.5" style={{ animationDelay: "360ms" }} />
          </g>
        )}
        {state === "alerta" && (
          <g className="cofi-pop">
            <circle cx="96" cy="14" r="11" fill="#FF9F0A" />
            <path d="M96 8 v7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
            <circle cx="96" cy="20" r="1.9" fill="#fff" />
          </g>
        )}
        {state === "dormindo" && (
          <text x="88" y="16" fontSize="16" fontWeight="700" fill="var(--cofi-accent, #0A84FF)" className="cofi-z">
            z
          </text>
        )}
      </svg>
    </span>
  );
}
