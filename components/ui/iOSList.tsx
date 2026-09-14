import React from "react";

export interface ListItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  amount?: string;
  isIncome?: boolean;
  isLast?: boolean;
  onClick?: () => void;
  rightElement?: React.ReactNode;
  badge?: string;
  badgeTone?: "neutral" | "account" | "credit";
}

export function ListItem({
  icon,
  title,
  subtitle,
  amount,
  isIncome = false,
  isLast = false,
  onClick,
  rightElement,
  badge,
  badgeTone = "neutral",
}: ListItemProps) {
  const badgeToneClass = {
    neutral: "bg-black/[0.03] text-[#86868B]",
    account: "bg-emerald-50/70 text-emerald-700/90",
    credit: "bg-indigo-50/70 text-indigo-700/90",
  }[badgeTone];

  return (
    <div
      onClick={onClick}
      className={`relative group ${
        onClick ? "cursor-pointer select-none" : ""
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3.5 hover:bg-black/[0.015] active:bg-black/[0.03] transition-colors">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {icon && (
            <div className="w-9 h-9 rounded-full bg-black/[0.03] text-[#1D1D1F]/85 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-medium text-[#1D1D1F] tracking-tight truncate">
                {title}
              </h3>
              {badge && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${badgeToneClass}`}>
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-[#86868B] truncate mt-0.5 font-normal">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          {amount && (
            <div
              className={`text-[15px] font-semibold tracking-tight tabular-nums ${
                isIncome ? "text-emerald-600" : "text-[#1D1D1F]"
              }`}
            >
              {amount}
            </div>
          )}
          {rightElement}
        </div>
      </div>

      {!isLast && (
        <div
          className={`border-b border-black/[0.03] ${
            icon ? "ml-16.5" : "ml-4"
          }`}
        />
      )}
    </div>
  );
}

export interface ListGroupProps {
  children: React.ReactNode;
  title?: string;
  footer?: string;
  className?: string;
}

export function ListGroup({
  children,
  title,
  footer,
  className = "",
}: ListGroupProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {title && (
        <h2 className="px-1 text-xs uppercase tracking-wider font-semibold text-[#86868B]">
          {title}
        </h2>
      )}
      <div className="bg-white rounded-[22px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-black/[0.04] overflow-hidden">
        {children}
      </div>
      {footer && (
        <p className="px-1 text-xs text-[#86868B] pt-0.5">
          {footer}
        </p>
      )}
    </div>
  );
}
