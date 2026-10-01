import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { PwaRegister } from "@/components/pwa/PwaRegister";

const sfPro = localFont({
  src: [
    {
      path: "../public/fonts/SFWindows.27.0.1789118100/SF Pro/SF-Pro-Display-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/SFWindows.27.0.1789118100/SF Pro/SF-Pro-Display-Semibold.otf",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-sf-pro",
  display: "swap",
});

const sfMono = localFont({
  src: [
    {
      path: "../public/fonts/SFWindows.27.0.1789118100/SF Mono/SF-Mono-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/SFWindows.27.0.1789118100/SF Mono/SF-Mono-Semibold.otf",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-sf-mono",
  display: "swap",
});

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
    <html lang="pt-BR" className={`${sfPro.variable} ${sfMono.variable}`}>
      <body className="min-h-screen w-full bg-[#F2F2F7] text-[#1D1D1F] font-sans antialiased selection:bg-[#1D1D1F] selection:text-white">
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
