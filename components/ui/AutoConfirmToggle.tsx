"use client";

export function AutoConfirmToggle({ checked, onChange, isIncome = false }: {
  checked: boolean; onChange: (checked: boolean) => void; isIncome?: boolean;
}) {
  return <label className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-[#F8F8FA] p-3 text-xs cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#1D1D1F]" />
    <span><span className="block font-semibold text-[#1D1D1F]">Confirmar {isIncome ? "recebimento" : "pagamento"} automaticamente</span><span className="mt-1 block leading-relaxed text-[#86868B]">{checked ? `Na data prevista, o app registrará ${isIncome ? "a entrada" : "a saída"} no saldo sem pedir confirmação.` : `Você confirma quando ${isIncome ? "o dinheiro realmente entrar" : "realmente pagar"}. Até lá, o item continua pendente, inclusive após o vencimento.`}</span></span>
  </label>;
}
