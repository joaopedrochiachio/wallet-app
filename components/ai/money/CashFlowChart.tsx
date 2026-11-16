"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CashPoint } from "@/lib/services/moneyViews";

const brl = (n: number, cents = true) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function weekdayOf(year: number, monthIndex: number, day: number) {
  return WEEKDAYS[new Date(year, monthIndex, day).getDay()];
}

interface Geometry {
  x: (day: number) => number;
  y: (value: number) => number;
  invertDay: (px: number) => number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function stepPath(series: CashPoint[], g: Geometry) {
  if (!series.length) return "";
  let d = `M${g.x(series[0].day)},${g.y(series[0].balance)}`;
  for (let i = 1; i < series.length; i++) d += ` H${g.x(series[i].day)} V${g.y(series[i].balance)}`;
  return d;
}

/**
 * Saldo previsto da conta, dia a dia, até o fim do mês (gráfico em degraus:
 * o saldo muda no dia em que o dinheiro entra ou a conta vence).
 * Toque, arraste ou use as setas para ver qualquer dia.
 */
export function CashFlowChart({
  series,
  target,
  year,
  monthIndex,
  selectedDay,
  onSelectDay,
  highlight,
  height = 200,
}: {
  series: CashPoint[];
  target: number;
  year: number;
  monthIndex: number;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  /** Destaca só entradas ou só saídas nos marcadores. */
  highlight?: "in" | "out" | null;
  height?: number;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(560);
  const uid = useId().replace(/:/g, "");
  const dragging = useRef(false);

  const g: Geometry | null = useMemo(() => {
    if (!series.length) return null;
    const left = 4;
    const right = width - 64; // espaço para os rótulos à direita (estilo Bolsa do iPhone)
    const top = 14;
    const bottom = height - 24;
    const d0 = series[0].day;
    const d1 = Math.max(series[series.length - 1].day, d0 + 1);
    const values = [...series.map((p) => p.balance), target, 0];
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (hi - lo < 1) hi = lo + 1;
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
    return {
      left,
      right,
      top,
      bottom,
      x: (day: number) => left + ((day - d0) / (d1 - d0)) * (right - left),
      y: (v: number) => top + ((hi - v) / (hi - lo)) * (bottom - top),
      invertDay: (px: number) => Math.round(d0 + ((px - left) / (right - left)) * (d1 - d0)),
    };
  }, [series, target, width, height]);

  if (!g) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const minPoint = series.reduce((m, p) => (p.balance < m.balance ? p : m), first);
  const hasNegative = minPoint.balance < 0;
  const selected = series.find((p) => p.day === selectedDay) ?? null;
  const line = stepPath(series, g);
  const area = `${line} V${g.bottom} H${g.x(first.day)} Z`;
  const zeroY = g.y(0);

  const clampDay = (day: number) => Math.min(last.day, Math.max(first.day, day));
  const pick = (clientX: number, el: Element) => {
    const rect = el.getBoundingClientRect();
    onSelectDay(clampDay(g.invertDay(((clientX - rect.left) / rect.width) * width)));
  };

  // Marcas do eixo x: hoje, a cada ~semana e o último dia
  const ticks = Array.from(new Set([first.day, ...series.filter((p) => (p.day - first.day) % 7 === 0).map((p) => p.day), last.day]));

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="group"
      aria-label="Saldo previsto da conta, dia a dia. Use as setas para mudar o dia."
      onKeyDown={(e) => {
        const current = selectedDay ?? first.day;
        if (e.key === "ArrowRight") onSelectDay(clampDay(current + 1));
        else if (e.key === "ArrowLeft") onSelectDay(clampDay(current - 1));
        else if (e.key === "Home") onSelectDay(first.day);
        else if (e.key === "End") onSelectDay(last.day);
        else return;
        e.preventDefault();
      }}
      className="relative select-none rounded-[14px] outline-none focus-visible:shadow-[var(--mac-focus-ring)]"
      style={{ height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block touch-pan-y"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          pick(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (dragging.current || e.pointerType === "mouse") pick(e.clientX, e.currentTarget);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        aria-hidden
      >
        <defs>
          <linearGradient id={`fill-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--ai-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--ai-accent)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`above-${uid}`}>
            <rect x="0" y="0" width={width} height={Math.max(0, zeroY)} />
          </clipPath>
          <clipPath id={`below-${uid}`}>
            <rect x="0" y={zeroY} width={width} height={Math.max(0, height - zeroY)} />
          </clipPath>
        </defs>

        {/* Linhas de referência */}
        {hasNegative && <line x1={g.left} x2={g.right} y1={zeroY} y2={zeroY} stroke="var(--ai-text-3)" strokeOpacity="0.5" strokeWidth="1" />}
        <line x1={g.left} x2={g.right} y1={g.y(target)} y2={g.y(target)} stroke="var(--ai-text-2)" strokeOpacity="0.55" strokeDasharray="3 4" strokeWidth="1" />

        {/* Área e linha (vermelho quando a conta fica negativa) */}
        <path d={area} fill={`url(#fill-${uid})`} clipPath={`url(#above-${uid})`} />
        {hasNegative && <path d={area} fill="var(--ai-bad)" fillOpacity="0.12" clipPath={`url(#below-${uid})`} />}
        <path d={line} fill="none" stroke="var(--ai-accent)" strokeWidth="2.25" strokeLinejoin="round" clipPath={`url(#above-${uid})`} />
        {hasNegative && <path d={line} fill="none" stroke="var(--ai-bad)" strokeWidth="2.25" strokeLinejoin="round" clipPath={`url(#below-${uid})`} />}

        {/* Dias com entrada ou conta */}
        {series
          .filter((p) => p.events.length)
          .map((p) => {
            const income = p.events.some((e) => e.direction === "in");
            const out = p.events.some((e) => e.direction === "out");
            const dim = highlight === "in" ? !income : highlight === "out" ? !out : false;
            return (
              <circle
                key={p.day}
                cx={g.x(p.day)}
                cy={g.y(p.balance)}
                r={p.day === selectedDay ? 0 : 3.5}
                fill={income && !out ? "var(--ai-good)" : "var(--ai-card)"}
                stroke={income && !out ? "var(--ai-card)" : "var(--ai-text-2)"}
                strokeWidth="1.5"
                opacity={dim ? 0.2 : 1}
              />
            );
          })}

        {/* Rótulos à direita */}
        <text x={g.right + 8} y={g.y(last.balance) + 4} className="fill-[var(--ai-text)] font-mono text-[11px] font-semibold tabular-nums">
          {brl(last.balance, false)}
        </text>
        {Math.abs(g.y(target) - g.y(last.balance)) > 14 && (
          <text x={g.right + 8} y={g.y(target) + 4} className="fill-[var(--ai-text-3)] font-mono text-[10px] tabular-nums">
            meta
          </text>
        )}
        {hasNegative && Math.abs(zeroY - g.y(last.balance)) > 14 && Math.abs(zeroY - g.y(target)) > 12 && (
          <text x={g.right + 8} y={zeroY + 4} className="fill-[var(--ai-text-3)] font-mono text-[10px]">
            R$ 0
          </text>
        )}

        {/* Eixo dos dias */}
        {ticks.map((d) => (
          <text key={d} x={g.x(d)} y={height - 6} textAnchor={d === first.day ? "start" : d === last.day ? "end" : "middle"} className="fill-[var(--ai-text-3)] text-[10px] tabular-nums">
            {d === first.day ? "hoje" : d}
          </text>
        ))}

        {/* Dia selecionado */}
        {selected && (
          <g>
            <line x1={g.x(selected.day)} x2={g.x(selected.day)} y1={g.top - 6} y2={g.bottom} stroke="var(--ai-text)" strokeOpacity="0.25" strokeWidth="1" />
            <circle cx={g.x(selected.day)} cy={g.y(selected.balance)} r="5.5" fill={selected.balance < 0 ? "var(--ai-bad)" : "var(--ai-accent)"} stroke="var(--ai-card)" strokeWidth="2.5" />
          </g>
        )}
      </svg>

      {/* Etiqueta do dia selecionado */}
      {selected && (
        <div
          className="pointer-events-none absolute -top-1 rounded-[8px] bg-[var(--ai-text)] px-2 py-1 text-[11px] font-semibold leading-tight text-[var(--ai-card)] shadow-sm"
          style={{ left: Math.min(Math.max(g.x(selected.day) - 52, 0), width - 108), width: 104, textAlign: "center" }}
          aria-hidden
        >
          <span className="block font-normal opacity-70">
            {selected.day === first.day ? "hoje" : `${weekdayOf(year, monthIndex, selected.day)}, ${selected.day}`}
          </span>
          <span className="font-mono tabular-nums">{brl(selected.balance)}</span>
        </div>
      )}
    </div>
  );
}

/** Versão mínima (sem eixo nem interação) para o painel do Cofi. */
export function CashSparkline({ series, width = 120, height = 36 }: { series: CashPoint[]; width?: number; height?: number }) {
  const uid = useId().replace(/:/g, "");
  if (series.length < 2) return null;
  const values = series.map((p) => p.balance);
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 1);
  const x = (i: number) => (i / (series.length - 1)) * width;
  const y = (v: number) => 2 + ((hi - v) / (hi - lo || 1)) * (height - 4);
  let d = `M0,${y(series[0].balance)}`;
  for (let i = 1; i < series.length; i++) d += ` H${x(i)} V${y(series[i].balance)}`;
  const negative = values.some((v) => v < 0);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden className="block">
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} V${height} H0 Z`} fill={`url(#spark-${uid})`} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
      {negative && <line x1="0" x2={width} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
