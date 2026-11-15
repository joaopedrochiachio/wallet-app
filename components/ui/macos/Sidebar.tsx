"use client";

import React from "react";
import Link from "next/link";

/**
 * Sidebar — macOS 27 (Figma: página "Sidebars")
 *
 * Fundo translúcido com blur, itens de 32px com ícone azul (#0078f0) numa
 * coluna de 24px, seleção cinza com raio 8px que avança 4px nas laterais,
 * cabeçalhos de seção em 13px bold secundário e "detail" (contagem) à direita.
 */

export function MacSidebar({
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <aside className={`mac-sidebar ${className}`} {...rest}>
      {children}
    </aside>
  );
}

export function MacSidebarItems({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mac-sidebar-items ${className}`}>{children}</div>;
}

export function MacSidebarSection({ children }: { children: React.ReactNode }) {
  return <div className="mac-sidebar-section">{children}</div>;
}

type SidebarItemBase = {
  icon?: React.ReactNode;
  label: React.ReactNode;
  /** Texto secundário à direita (ex.: contagem). */
  detail?: React.ReactNode;
  /** Ação extra no final da linha (ex.: excluir), aparece no hover. */
  accessory?: React.ReactNode;
  selected?: boolean;
  className?: string;
  title?: string;
};

export function MacSidebarItem({
  icon,
  label,
  detail,
  accessory,
  selected = false,
  className = "",
  title,
  href,
  onClick,
}: SidebarItemBase & { href?: string; onClick?: () => void }) {
  const content = (
    <>
      {icon && <span className="mac-sidebar-icon" aria-hidden>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail !== undefined && <span className="mac-sidebar-detail">{detail}</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        title={title}
        aria-current={selected ? "page" : undefined}
        className={`mac-sidebar-item ${className}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`group/sidebar relative ${className}`}>
      <button
        type="button"
        title={title}
        aria-current={selected ? "true" : undefined}
        onClick={onClick}
        className="mac-sidebar-item"
      >
        {content}
      </button>
      {accessory && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/sidebar:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
          {accessory}
        </span>
      )}
    </div>
  );
}
