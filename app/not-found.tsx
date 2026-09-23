import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col justify-between items-center px-4 py-12 font-sans selection:bg-[#1D1D1F] selection:text-white">
      {/* Top Brand Indicator */}
      <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <Image
          src="/logo2.png"
          alt="Wallet"
          width={36}
          height={36}
          className="rounded-xl object-contain shadow-xs shrink-0"
          priority
        />
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-base tracking-tight text-[#1D1D1F]">
            Wallet
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-black/5 text-[#86868B]">
            Intelligence
          </span>
        </div>
      </Link>

      {/* Cartão de Erro 404 Estilo Pass Kit */}
      <div className="w-full max-w-md bg-white rounded-[28px] shadow-[0_12px_36px_rgba(0,0,0,0.06)] border border-black/[0.04] p-8 text-center space-y-6 my-auto animate-in fade-in zoom-in-95 duration-300">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-3" />

        <div className="w-16 h-16 rounded-2xl bg-[#F2F2F7] border border-black/5 flex items-center justify-center mx-auto text-[#1D1D1F] font-mono text-2xl font-bold">
          404
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">
            Página Não Encontrada
          </h1>
          <p className="text-xs text-[#86868B] leading-relaxed max-w-xs mx-auto">
            O endereço digitado não existe, foi movido ou você não possui permissão para acessá-lo.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/dashboard"
            className="w-full py-3.5 px-4 rounded-2xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99]"
          >
            <Home size={15} />
            <span>Ir para o Dashboard</span>
          </Link>

          <Link
            href="/"
            className="w-full py-3.5 px-4 rounded-2xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <ArrowLeft size={15} />
            <span>Voltar à Apresentação</span>
          </Link>
        </div>
      </div>

      <p className="text-[11px] text-[#86868B]/70">
        Wallet Intelligence • Segurança e Isolamento de Dados
      </p>
    </div>
  );
}
