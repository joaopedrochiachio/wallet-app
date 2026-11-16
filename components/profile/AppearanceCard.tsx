"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { MacSegmentedControl } from "@/components/ui/macos/SegmentedControl";
import { useAppTheme, type AppTheme } from "@/lib/theme";

/** Escolha de tema do app inteiro: tudo claro ou tudo escuro. */
export function AppearanceCard() {
  const [theme, setTheme] = useAppTheme();
  return (
    <section aria-labelledby="appearance-title" className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-black/[0.04] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="min-w-0">
        <h3 id="appearance-title" className="text-base font-semibold tracking-tight text-[#1D1D1F]">
          Aparência
        </h3>
        <p className="text-xs text-[#86868B]">Deixe o app todo claro ou todo escuro. Vale para este aparelho.</p>
      </div>
      <MacSegmentedControl<AppTheme>
        ariaLabel="Tema do app"
        value={theme}
        onChange={setTheme}
        options={[
          { value: "light", label: "Claro", icon: <Sun size={13} /> },
          { value: "dark", label: "Escuro", icon: <Moon size={13} /> },
        ]}
      />
    </section>
  );
}
