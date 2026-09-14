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
    neutral: "bg-[#F2F2F7] text-[#86868B]",
    account: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10",
    credit: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10",
  }[badgeTone];

  return (
    <div
      onClick={onClick}
      className={`relative group ${
        onClick ? "cursor-pointer select-none" : ""
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3.5 hover:bg-[#F2F2F7]/50 active:bg-[#E5E5EA]/50 transition-colors">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-[#F2F2F7] text-[#1D1D1F] flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#1D1D1F] truncate">
                {title}
              </h3>
              {badge && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${badgeToneClass}`}>
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-[#86868B] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          {amount && (
            <div
              className={`text-sm font-semibold tracking-tight ${
                isIncome ? "text-green-600" : "text-[#1D1D1F]"
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
          className={`border-b border-gray-100 ${
            icon ? "ml-16" : "ml-4"
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
      <div className="bg-white rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/[0.04] overflow-hidden">
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
