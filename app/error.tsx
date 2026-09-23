"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Registra o erro de forma segura sem vazar detalhes para o usuário final
    console.error("[APPLICATION_RUNTIME_ERROR]", {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col justify-center items-center px-4 py-12 font-sans selection:bg-[#1D1D1F] selection:text-white">
      <div className="w-full max-w-md bg-white rounded-[28px] shadow-[0_12px_36px_rgba(0,0,0,0.06)] border border-black/[0.04] p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-3" />

        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto text-amber-600">
          <AlertCircle size={28} strokeWidth={1.5} />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">
            Algo Inesperado Aconteceu
          </h1>
          <p className="text-xs text-[#86868B] leading-relaxed max-w-xs mx-auto">
            Por segurança, ocultamos detalhes técnicos desta ocorrência. Seus dados continuam totalmente seguros e protegidos.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>Tentar Novamente</span>
          </button>

          <Link
            href="/dashboard"
            className="w-full py-3.5 px-4 rounded-2xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <Home size={15} />
            <span>Ir para o Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
