export interface CardVisualTheme {
  background: string;
  border: string;
  accent: string;
  isLight: boolean;
  textColor: string;
  mutedColor: string;
  chipColor: "gold" | "silver";
  glowColor: string;
  badge: string;
}

export function getCardVisualTheme(card: {
  title?: string;
  name?: string;
  brand?: string;
  background?: string;
  isGlass?: boolean;
}): CardVisualTheme {
  const name = (card.title || card.name || "").toLowerCase();

  // Nubank / Ultravioleta
  if (name.includes("nubank") || name.includes("nu") || name.includes("ultra")) {
    return {
      background: "linear-gradient(135deg, #2D0C4A 0%, #180528 55%, #0C0214 100%)",
      border: "border-purple-500/35",
      accent: "#A855F7",
      isLight: false,
      textColor: "text-white",
      mutedColor: "text-purple-200/80",
      chipColor: "silver",
      glowColor: "rgba(168, 85, 247, 0.3)",
      badge: "Nubank",
    };
  }

  // Santander (Rich ruby / deep burgundy)
  if (name.includes("santander") || name.includes("ruby") || name.includes("vermelho")) {
    return {
      background: "linear-gradient(135deg, #4A0808 0%, #2A0404 55%, #130101 100%)",
      border: "border-rose-500/35",
      accent: "#EF4444",
      isLight: false,
      textColor: "text-white",
      mutedColor: "text-rose-200/80",
      chipColor: "gold",
      glowColor: "rgba(239, 68, 68, 0.3)",
      badge: "Santander",
    };
  }

  // Inter / Gold / Black Win
  if (name.includes("inter") || name.includes("gold") || name.includes("black")) {
    return {
      background: "linear-gradient(135deg, #222226 0%, #141416 55%, #080809 100%)",
      border: "border-amber-500/35",
      accent: "#F59E0B",
      isLight: false,
      textColor: "text-white",
      mutedColor: "text-amber-200/80",
      chipColor: "gold",
      glowColor: "rgba(245, 158, 11, 0.3)",
      badge: "Inter Black",
    };
  }

  // Itaú / Navy Blue
  if (name.includes("itau") || name.includes("itaú") || name.includes("azul")) {
    return {
      background: "linear-gradient(135deg, #0A192F 0%, #061020 55%, #02070E 100%)",
      border: "border-blue-500/35",
      accent: "#3B82F6",
      isLight: false,
      textColor: "text-white",
      mutedColor: "text-blue-200/80",
      chipColor: "gold",
      glowColor: "rgba(59, 130, 246, 0.3)",
      badge: "Itaú",
    };
  }

  // Apple Card Titanium (Clean brushed titanium with dark readable text)
  if (name.includes("apple") || name.includes("titanium") || name.includes("prata")) {
    return {
      background: "linear-gradient(135deg, #F5F5F7 0%, #E5E5EA 50%, #D1D1D6 100%)",
      border: "border-black/15",
      accent: "#1D1D1F",
      isLight: true,
      textColor: "text-[#1D1D1F]",
      mutedColor: "text-[#86868B]",
      chipColor: "silver",
      glowColor: "rgba(0, 0, 0, 0.08)",
      badge: "Titanium",
    };
  }

  // Conta Principal / Obsidian Deep Glass
  return {
    background: "linear-gradient(135deg, #242429 0%, #151518 55%, #0A0A0C 100%)",
    border: "border-white/25",
    accent: "#FFFFFF",
    isLight: false,
    textColor: "text-white",
    mutedColor: "text-white/70",
    chipColor: "silver",
    glowColor: "rgba(255, 255, 255, 0.2)",
    badge: "Principal",
  };
}
