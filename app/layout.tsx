import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { THEME_BOOT_SCRIPT } from "@/lib/themeBoot";

export const metadata: Metadata = {
  title: "Wallet Intelligence",
  description:
    "Wallet Intelligence — Gestão Financeira Pessoal com Padrão Apple Wallet",
  applicationName: "Wallet",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wallet",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#F2F2F7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema escolhido (claro/escuro) antes da primeira pintura */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen w-full bg-[var(--app-bg)] text-[var(--app-text)] font-sans antialiased selection:bg-[#1D1D1F] selection:text-white">
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
