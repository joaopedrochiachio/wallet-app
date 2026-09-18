import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Wallet Intelligence",
  description:
    "Wallet Intelligence — Gestão Financeira Pessoal com Padrão Apple Wallet",
  icons: {
    icon: "/logo2.png",
    apple: "/logo2.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wallet",
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
    <html lang="pt-BR">
      <body className="min-h-screen w-full bg-[#F2F2F7] text-[#1D1D1F] antialiased selection:bg-[#1D1D1F] selection:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
