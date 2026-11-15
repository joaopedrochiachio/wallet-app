"use client";

import React, { useId } from "react";

/**
 * Switch — macOS 27 (Figma: página "Toggles")
 * Trilho 54×24 (azul quando ligado) com botão branco 32×20.
 */

export interface MacSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  size?: "small" | "regular";
  className?: string;
}

export function MacSwitch({
  checked,
  onChange,
  label,
  description,
  ariaLabel,
  disabled = false,
  size = "regular",
  className = "",
}: MacSwitchProps) {
  const labelId = useId();
  const descriptionId = useId();

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      data-size={size === "small" ? "small" : undefined}
      onClick={() => onChange(!checked)}
      className="mac-switch"
    />
  );

  if (!label) return <span className={className}>{control}</span>;

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <span
          id={labelId}
          className="block text-[13px] font-medium leading-4 text-mac-label"
          onClick={() => !disabled && onChange(!checked)}
        >
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="mt-1 block text-[11px] leading-[14px] text-mac-label-2">
            {description}
          </span>
        )}
      </div>
      {control}
    </div>
  );
}
