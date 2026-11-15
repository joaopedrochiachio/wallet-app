import React from "react";

/**
 * Listas no padrão macOS 27 (Figma: "Lists and Tables").
 * Linhas com fundo arredondado recuado (raio 8px) no hover/seleção, sem
 * separadores, e títulos de grupo em 11px semibold secundário. No celular o
 * texto cresce para manter a área de toque confortável.
 */

export interface ListItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  amount?: string;
  isIncome?: boolean;
  /** Mantido por compatibilidade; listas macOS não usam separadores. */
  isLast?: boolean;
  onClick?: () => void;
  rightElement?: React.ReactNode;
  badge?: string;
  badgeTone?: "neutral" | "account" | "credit";
  selected?: boolean;
  /** Linha zebrada (Alternating Row Color). */
  alternate?: boolean;
}

export function ListItem({
  icon,
  title,
  subtitle,
  amount,
  isIncome = false,
  onClick,
  rightElement,
  badge,
  badgeTone = "neutral",
  selected = false,
  alternate = false,
}: ListItemProps) {
  const badgeToneClass = {
    neutral: "bg-mac-fill-3 text-mac-label-2",
    account: "bg-mac-green/12 text-[#248a3d]",
    credit: "bg-mac-indigo/12 text-mac-indigo",
  }[badgeTone];

  const interactive = !!onClick;

  return (
    <div
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      data-interactive={interactive}
      data-selected={selected}
      data-alternate={alternate}
      className="mac-row select-none outline-none"
    >
      <div className="flex items-center justify-between px-4 md:px-3.5 py-2.5 md:py-1.5">
        <div className="flex items-center gap-3 md:gap-2.5 min-w-0 flex-1">
          {icon && (
            <div
              className={`w-9 h-9 md:w-7 md:h-7 rounded-full flex items-center justify-center shrink-0 ${
                selected ? "bg-white/20 text-white" : "bg-mac-fill-3 text-mac-label"
              }`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3
                className={`text-[15px] md:text-[13px] font-medium tracking-tight truncate ${
                  selected ? "text-white" : "text-mac-label"
                }`}
              >
                {title}
              </h3>
              {badge && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${badgeToneClass}`}>
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p
                className={`text-xs md:text-[11px] truncate mt-0.5 font-normal ${
                  selected ? "text-white/80" : "text-mac-label-2"
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          {amount && (
            <div
              className={`text-[15px] md:text-[13px] font-semibold tracking-tight font-mono tabular-nums ${
                selected ? "text-white" : isIncome ? "text-[#248a3d]" : "text-mac-label"
              }`}
            >
              {amount}
            </div>
          )}
          {rightElement}
        </div>
      </div>
    </div>
  );
}

export interface ListGroupProps {
  children: React.ReactNode;
  title?: string;
  footer?: string;
  className?: string;
}

export function ListGroup({ children, title, footer, className = "" }: ListGroupProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {title && <h2 className="mac-group-title px-3">{title}</h2>}
      <div className="bg-mac-window rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/[0.04] overflow-hidden py-1.5">
        {children}
      </div>
      {footer && <p className="px-3 text-[11px] text-mac-label-2 pt-0.5">{footer}</p>}
    </div>
  );
}
