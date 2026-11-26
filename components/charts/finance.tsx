"use client";

/**
 * Kit de painéis e gráficos financeiros (linguagem visual do Finebank):
 * título da seção fora do cartão, cartão branco com sombra suave, número
 * grande em destaque, um único acento verde-azulado e cinza para comparação.
 * Tokens em app/globals.css (--fb-*), com tema claro e escuro.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";

export const brl = (value: number, cents = true) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

/** R$ 1,2 mil · R$ 850 — para eixos e rótulos curtos. */
export function brlShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(value)}`;
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Topo "redondo" para o eixo: 4 divisões legíveis. */
function niceScale(max: number, steps = 4) {
  if (max <= 0) return { top: 1, ticks: [0] };
  const raw = max / steps;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? raw;
  const top = step * steps;
  return { top, ticks: Array.from({ length: steps + 1 }, (_, index) => step * index) };
}

/* ------------------------------------------------------------------ */
/* Estrutura                                                            */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
  id,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col gap-2 ${className}`} aria-labelledby={id}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 px-0.5">
          {title && (
            <h2 id={id} className="text-[19px] font-normal leading-8 text-[var(--fb-text-3)] sm:text-[22px]">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div
        className={`flex-1 rounded-[12px] bg-[var(--fb-card)] px-5 py-5 shadow-[var(--fb-shadow)] sm:px-6 ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}

export function PanelLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-target inline-flex cursor-pointer items-center gap-1.5 pb-1.5 text-xs font-medium text-[var(--fb-text-3)] transition-colors hover:text-[var(--fb-text)]"
    >
      {children} <ChevronRight size={14} />
    </button>
  );
}

export function Legend({ items }: { items: { label: string; color: string; pattern?: "dash" }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2 text-xs font-medium text-[var(--fb-text-2)]">
          {item.pattern === "dash" ? (
            <svg width="16" height="8" aria-hidden><line x1="0" x2="16" y1="4" y2="4" stroke={item.color} strokeWidth="2" strokeDasharray="3 3" /></svg>
          ) : (
            <span className="h-2 w-4 rounded-[2px]" style={{ backgroundColor: item.color }} aria-hidden />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Variação contra o período anterior: seta vermelha = gastou mais, verde = menos. */
export function Delta({ value, inverse = false, className = "" }: { value: number | null; inverse?: boolean; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className={`text-xs text-[var(--fb-text-4)] ${className}`}>novo</span>;
  const rounded = Math.round(value);
  if (rounded === 0) return <span className={`text-xs font-medium text-[var(--fb-text-4)] ${className}`}>= 0%</span>;
  const up = rounded > 0;
  const bad = inverse ? !up : up;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium [font-variant-numeric:tabular-nums] ${className}`} style={{ color: bad ? "var(--fb-up)" : "var(--fb-down)" }}>
      {Math.abs(rounded)}%
      {up ? <ArrowUp size={13} strokeWidth={2.5} /> : <ArrowDown size={13} strokeWidth={2.5} />}
    </span>
  );
}

/** Bloco de data do kit: mês pequeno em cima, dia grande embaixo. */
export function DateBlock({ date, tone = "neutral" }: { date: Date; tone?: "neutral" | "danger" | "accent" }) {
  const month = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const toneStyle =
    tone === "danger"
      ? { backgroundColor: "color-mix(in srgb, var(--fb-up) 14%, transparent)", color: "var(--fb-up)" }
      : tone === "accent"
        ? { backgroundColor: "var(--fb-accent-bg)", color: "var(--fb-accent)" }
        : { backgroundColor: "var(--fb-card-2)" };
  return (
    <span className="flex w-12 shrink-0 flex-col items-center justify-center rounded-[8px] px-2 py-1.5 text-center" style={toneStyle}>
      <span className="text-xs font-medium capitalize leading-4 text-[var(--fb-text-3)]" style={tone !== "neutral" ? { color: "inherit" } : undefined}>{month}</span>
      <span className="text-[22px] font-extrabold leading-7 text-[var(--fb-text)] [font-variant-numeric:tabular-nums]" style={tone !== "neutral" ? { color: "inherit" } : undefined}>{date.getDate()}</span>
    </span>
  );
}

export function AmountPill({ value }: { value: number }) {
  return (
    <span className="shrink-0 rounded-[8px] border border-[var(--fb-line-2)] bg-[var(--fb-card)] px-3 py-1.5 text-sm font-bold [font-variant-numeric:tabular-nums] text-[var(--fb-text-2)]">
      {brl(value)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Medidor (meta x realizado)                                            */
/* ------------------------------------------------------------------ */

export function Gauge({
  value,
  max,
  centerLabel,
  minLabel,
  maxLabel,
  caption,
  size = 160,
  danger = 0.85,
}: {
  value: number;
  max: number;
  centerLabel: React.ReactNode;
  minLabel?: string;
  maxLabel?: string;
  caption?: string;
  size?: number;
  /** A partir dessa fração o arco fica laranja/vermelho. */
  danger?: number;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const stroke = Math.round(size * 0.1);
  const radius = size / 2 - stroke / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from);
    const a1 = Math.PI * (1 - to);
    const x0 = cx + radius * Math.cos(a0);
    const y0 = cy - radius * Math.sin(a0);
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy - radius * Math.sin(a1);
    return `M${x0},${y0} A${radius},${radius} 0 0 1 ${x1},${y1}`;
  };
  const angle = Math.PI * (1 - ratio);
  const needle = radius - stroke * 1.3;
  const color = ratio >= 1 ? "var(--fb-up)" : ratio >= danger ? "var(--fb-warn)" : "var(--fb-accent)";

  return (
    <figure className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size / 2 + stroke / 2 + 6} viewBox={`0 0 ${size} ${size / 2 + stroke / 2 + 6}`} role="img" aria-label={`${Math.round(ratio * 100)}% usado`}>
        <path d={arc(0, 1)} fill="none" stroke="var(--fb-compare)" strokeWidth={stroke} strokeLinecap="round" />
        {ratio > 0.005 && (
          <path d={arc(0, ratio)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" className="transition-all duration-700" />
        )}
        <line
          x1={cx}
          y1={cy}
          x2={cx + needle * Math.cos(angle)}
          y2={cy - needle * Math.sin(angle)}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
        <circle cx={cx} cy={cy} r={5} fill={color} />
      </svg>
      <div className="flex w-full items-baseline justify-between gap-2" style={{ maxWidth: size + 12 }}>
        <span className="text-xs font-medium text-[var(--fb-text-5)]">{minLabel}</span>
        <span className="text-base font-semibold [font-variant-numeric:tabular-nums] text-[var(--fb-text)]">{centerLabel}</span>
        <span className="text-xs font-medium text-[var(--fb-text-5)]">{maxLabel}</span>
      </div>
      {caption && <figcaption className="text-xs font-medium text-[var(--fb-text)]">{caption}</figcaption>}
    </figure>
  );
}

/** Barra fina de progresso do kit, com % ao lado (ex.: limite usado). */
export function MeterBar({ value, max, danger = 0.85 }: { value: number; max: number; danger?: number }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const color = ratio >= 1 ? "var(--fb-up)" : ratio >= danger ? "var(--fb-warn)" : "var(--fb-accent)";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--fb-compare)]" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${ratio * 100}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold [font-variant-numeric:tabular-nums]" style={{ color }}>
        {Math.round(ratio * 100)}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras (com série de comparação opcional)                            */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  compare?: number;
  /** past = cinza, current = acento forte, future = acento claro. */
  state?: "past" | "current" | "future";
  tooltip?: React.ReactNode;
}

export function BarChart({
  data,
  height = 200,
  selectedKey,
  onSelect,
  compareLabel,
  valueLabel,
}: {
  data: BarDatum[];
  height?: number;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  compareLabel?: string;
  valueLabel?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const hasCompare = data.some((d) => d.compare !== undefined);
  const { top, ticks } = useMemo(
    () => niceScale(Math.max(0, ...data.map((d) => Math.max(d.value, d.compare ?? 0)))),
    [data]
  );
  const active = data.find((d) => d.key === hover) || data.find((d) => d.key === selectedKey) || null;
  const plotHeight = height - 28;

  const fillFor = (d: BarDatum) =>
    d.state === "past" ? "var(--fb-compare)" : d.state === "future" ? "var(--fb-accent-2)" : "var(--fb-accent)";

  return (
    <div className="relative">
      <div className="relative flex gap-3" style={{ height }}>
        {/* Eixo y */}
        <div className="relative w-12 shrink-0" style={{ height: plotHeight }} aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[11px] [font-variant-numeric:tabular-nums] text-[var(--fb-text-4)] sm:text-xs"
              style={{ top: plotHeight - (tick / top) * plotHeight }}
            >
              {brlShort(tick).replace("R$ ", "")}
            </span>
          ))}
        </div>
        {/* Grade + barras */}
        <div className="relative min-w-0 flex-1" onMouseLeave={() => setHover(null)}>
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 border-t border-[var(--fb-line)]"
              style={{ top: plotHeight - (tick / top) * plotHeight }}
              aria-hidden
            />
          ))}
          <div className="relative flex h-full items-end justify-between gap-1">
            {data.map((d) => {
              const isActive = active?.key === d.key;
              const dim = active && !isActive;
              return (
                <button
                  key={d.key}
                  type="button"
                  onMouseEnter={() => setHover(d.key)}
                  onFocus={() => setHover(d.key)}
                  onBlur={() => setHover(null)}
                  onClick={() => onSelect?.(d.key)}
                  aria-pressed={selectedKey === d.key}
                  aria-label={`${d.label}${d.sublabel ? ` (${d.sublabel})` : ""}: ${brl(d.value)}`}
                  className="group flex h-full min-w-[32px] flex-1 cursor-pointer flex-col items-center justify-end gap-2 outline-none"
                >
                  <span className="flex items-end gap-1.5" style={{ height: plotHeight }}>
                    {hasCompare && (
                      <span
                        className="w-2.5 rounded-t-[4px] transition-all duration-500 sm:w-4"
                        style={{
                          height: `${((d.compare ?? 0) / top) * 100}%`,
                          backgroundColor: "var(--fb-compare)",
                          opacity: dim ? 0.45 : 1,
                        }}
                      />
                    )}
                    <span
                      className="w-2.5 rounded-t-[4px] transition-all duration-500 sm:w-4"
                      style={{
                        height: `${Math.max(d.value > 0 ? 1.5 : 0, (d.value / top) * 100)}%`,
                        backgroundColor: fillFor(d),
                        opacity: dim ? 0.45 : 1,
                        outline: selectedKey === d.key ? "2px solid var(--fb-accent)" : undefined,
                        outlineOffset: 2,
                      }}
                    />
                  </span>
                  <span className={`text-xs ${d.state === "current" || isActive ? "font-semibold text-[var(--fb-text)]" : "text-[var(--fb-text-4)]"}`}>
                    {d.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Etiqueta do item ativo */}
      <div className="mt-3 flex min-h-[40px] flex-wrap items-center justify-between gap-2 rounded-[8px] bg-[var(--fb-card-2)] px-3 py-2 text-xs text-[var(--fb-text-2)]" aria-live="polite">
        {active ? (
          active.tooltip ?? (
            <>
              <span className="font-medium text-[var(--fb-text)]">
                {active.label}
                {active.sublabel && <span className="font-normal text-[var(--fb-text-3)]"> · {active.sublabel}</span>}
              </span>
              <span className="flex gap-3 [font-variant-numeric:tabular-nums]">
                {valueLabel && <span>{valueLabel}</span>}
                <strong className="text-[var(--fb-text)]">{brl(active.value)}</strong>
                {hasCompare && active.compare !== undefined && (
                  <span className="text-[var(--fb-text-3)]">{compareLabel} {brl(active.compare)}</span>
                )}
              </span>
            </>
          )
        ) : (
          <span className="text-[var(--fb-text-3)]">Passe o mouse ou toque numa barra para ver o valor.</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Área com curva suave (+ linha tracejada de comparação)               */
/* ------------------------------------------------------------------ */

export interface AreaPoint {
  x: number;
  label: string;
  value: number;
  compare?: number | null;
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return points.length ? `M${points[0].x},${points[0].y}` : "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const t = 0.18;
    d += ` C${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
  }
  return d;
}

export function AreaChart({
  points,
  height = 200,
  ticksEvery,
  valueLabel = "Este mês",
  compareLabel = "Mês passado",
  markerX,
}: {
  points: AreaPoint[];
  height?: number;
  ticksEvery?: number;
  valueLabel?: string;
  compareLabel?: string;
  /** Marca vertical (ex.: hoje). */
  markerX?: number;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(560);
  const uid = useId().replace(/:/g, "");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const axis = 52;
    const left = axis;
    const right = width - 6;
    const top = 8;
    const bottom = height - 26;
    const maxValue = Math.max(0, ...points.map((p) => Math.max(p.value, p.compare ?? 0)));
    const minValue = Math.min(0, ...points.map((p) => Math.min(p.value, p.compare ?? 0)));
    const upper = niceScale(maxValue);
    // Saldo negativo: o eixo desce abaixo de zero com o mesmo passo de cima.
    const lower = minValue < 0 ? niceScale(-minValue) : null;
    const floor = lower ? -lower.top : 0;
    const scale = {
      top: upper.top,
      ticks: [...(lower ? lower.ticks.filter((tick) => tick > 0).map((tick) => -tick).reverse() : []), ...upper.ticks],
    };
    const x0 = points[0].x;
    const x1 = Math.max(points[points.length - 1].x, x0 + 1);
    return {
      left, right, top, bottom, scale, hasNegative: minValue < 0,
      x: (value: number) => left + ((value - x0) / (x1 - x0)) * (right - left),
      y: (value: number) => bottom - ((value - floor) / (scale.top - floor)) * (bottom - top),
    };
  }, [points, width, height]);

  if (!geometry) return null;
  const g = geometry;
  const main = points.map((p) => ({ x: g.x(p.x), y: g.y(p.value) }));
  const comparePoints = points.filter((p) => p.compare !== undefined && p.compare !== null).map((p) => ({ x: g.x(p.x), y: g.y(p.compare as number) }));
  const mainPath = smoothPath(main);
  const baseline = g.y(0);
  const area = `${mainPath} L${main[main.length - 1].x},${baseline} L${main[0].x},${baseline} Z`;
  const step = ticksEvery ?? Math.max(1, Math.ceil(points.length / 6));
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  const pick = (clientX: number, el: Element) => {
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < main.length; i++) if (Math.abs(main[i].x - px) < Math.abs(main[best].x - px)) best = i;
    setHoverIndex(best);
  };

  return (
    <div ref={wrapRef} className="relative select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block touch-pan-y"
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`${valueLabel}: ${brl(points[points.length - 1].value)}`}
      >
        <defs>
          <linearGradient id={`fb-area-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--fb-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--fb-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {g.scale.ticks.map((tick) => (
          <g key={tick}>
            <line x1={g.left} x2={g.right} y1={g.y(tick)} y2={g.y(tick)} stroke="var(--fb-line)" />
            <text x={g.left - 10} y={g.y(tick) + 4} textAnchor="end" className="fill-[var(--fb-text-4)] text-[11px] [font-variant-numeric:tabular-nums]">
              {brlShort(tick).replace("R$ ", "")}
            </text>
          </g>
        ))}
        {points.map((p, index) =>
          index % step === 0 || index === points.length - 1 ? (
            <g key={p.x}>
              <line x1={g.x(p.x)} x2={g.x(p.x)} y1={g.top} y2={g.bottom} stroke="var(--fb-line)" />
              <text x={g.x(p.x)} y={height - 6} textAnchor="middle" className="fill-[var(--fb-text-4)] text-[11px]">
                {p.label}
              </text>
            </g>
          ) : null
        )}
        {g.hasNegative && (
          <line x1={g.left} x2={g.right} y1={baseline} y2={baseline} stroke="var(--fb-up)" strokeWidth={1} strokeDasharray="3 3" />
        )}
        {markerX !== undefined && (
          <line x1={g.x(markerX)} x2={g.x(markerX)} y1={g.top} y2={g.bottom} stroke="var(--fb-text-3)" strokeDasharray="2 3" />
        )}
        {comparePoints.length > 1 && (
          <path d={smoothPath(comparePoints)} fill="none" stroke="var(--fb-text-5)" strokeWidth={2} strokeDasharray="5 5" />
        )}
        <path d={area} fill={`url(#fb-area-${uid})`} />
        <path d={mainPath} fill="none" stroke="var(--fb-accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {hovered && hoverIndex !== null && (
          <g>
            <line x1={main[hoverIndex].x} x2={main[hoverIndex].x} y1={g.top} y2={g.bottom} stroke="var(--fb-text)" strokeOpacity={0.2} />
            <circle cx={main[hoverIndex].x} cy={main[hoverIndex].y} r={5} fill="var(--fb-accent)" stroke="var(--fb-card)" strokeWidth={2.5} />
          </g>
        )}
      </svg>
      {hovered && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-[8px] bg-[var(--fb-text)] px-2.5 py-1.5 text-[11px] leading-tight text-[var(--fb-card)] shadow-sm"
          style={{ left: Math.min(Math.max(main[hoverIndex].x - 70, 0), width - 140), width: 140 }}
        >
          <span className="block opacity-70">{hovered.label}</span>
          <span className="block font-semibold [font-variant-numeric:tabular-nums]">{valueLabel}: {brl(hovered.value)}</span>
          {hovered.compare !== undefined && hovered.compare !== null && (
            <span className="block [font-variant-numeric:tabular-nums] opacity-80">{compareLabel}: {brl(hovered.compare)}</span>
          )}
        </div>
      )}
    </div>
  );
}
