"use client";

import { MacSwitch } from "./macos/Switch";

/** Confirmação automática no padrão macOS 27: Switch do kit dentro de um Group Box. */
export function AutoConfirmToggle({ checked, onChange, isIncome = false }: {
  checked: boolean; onChange: (checked: boolean) => void; isIncome?: boolean;
}) {
  return (
    <div className="mac-group-box p-3">
      <MacSwitch
        checked={checked}
        onChange={onChange}
        label={`Confirmar ${isIncome ? "recebimento" : "pagamento"} automaticamente`}
        description={
          checked
            ? `Na data prevista, o app registrará ${isIncome ? "a entrada" : "a saída"} no saldo sem pedir confirmação.`
            : `Você confirma quando ${isIncome ? "o dinheiro realmente entrar" : "realmente pagar"}. Até lá, o item continua pendente, inclusive após o vencimento.`
        }
      />
    </div>
  );
}
