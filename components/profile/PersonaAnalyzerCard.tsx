"use client";

import React from "react";
import { FinancialPersonaId, AIToneId } from "@/types";
import { PERSONA_METADATA } from "./WalletIdTitaniumCard";
import { Sparkles, Bot, Check, Zap } from "lucide-react";

interface PersonaTrait {
  label: string;
  value: number;
  color: string;
}

const PERSONA_TRAITS: Record<FinancialPersonaId, PersonaTrait[]> = {
  optimizer: [
    { label: "Eficiência no Crédito & Benefícios", value: 96, color: "from-amber-400 to-emerald-400" },
    { label: "Otimização de Custos e Tarifas", value: 92, color: "from-emerald-400 to-teal-400" },
    { label: "Previsibilidade de Fluxo", value: 78, color: "from-blue-400 to-indigo-400" },
    { label: "Disciplina de Teto Prudencial", value: 85, color: "from-purple-400 to-pink-400" },
  ],
  guardian: [
    { label: "Reserva de Emergência & Blindagem", value: 98, color: "from-blue-500 to-cyan-400" },
    { label: "Previsibilidade Contábil", value: 95, color: "from-cyan-400 to-emerald-400" },
    { label: "Aversão a Riscos & Juros", value: 94, color: "from-emerald-400 to-amber-400" },
    { label: "Alavancagem Controlada", value: 45, color: "from-purple-400 to-indigo-400" },
  ],
  scaler: [
    { label: "Expansão Patrimonial & Aportes", value: 96, color: "from-purple-500 to-pink-500" },
    { label: "Visão Estratégica de Longo Prazo", value: 92, color: "from-pink-500 to-amber-400" },
    { label: "Uso Inteligente de Alavancagem", value: 88, color: "from-amber-400 to-emerald-400" },
    { label: "Tolerância a Volatilidade", value: 82, color: "from-blue-500 to-purple-500" },
  ],
  minimalist: [
    { label: "Alta Taxa de Poupança Real", value: 97, color: "from-teal-400 to-emerald-500" },
    { label: "Frugalidade & Redução de Excessos", value: 95, color: "from-emerald-400 to-cyan-500" },
    { label: "Independência Financeira (FIRE)", value: 90, color: "from-blue-400 to-indigo-500" },
    { label: "Simplicidade de Instrumentos", value: 94, color: "from-purple-400 to-pink-400" },
  ],
};

interface PersonaAnalyzerCardProps {
  currentPersonaId: FinancialPersonaId;
  aiTone: AIToneId;
  userName: string;
  monthlyIncome: number;
  mainBalance: number;
  onSelectPersona: (id: FinancialPersonaId) => void;
  formatCurrency: (val: number) => string;
}

export function PersonaAnalyzerCard({
  currentPersonaId,
  aiTone,
  userName,
  monthlyIncome,
  mainBalance,
  onSelectPersona,
  formatCurrency,
}: PersonaAnalyzerCardProps) {
  const currentPersona = PERSONA_METADATA[currentPersonaId] || PERSONA_METADATA.optimizer;
  const traits = PERSONA_TRAITS[currentPersonaId] || PERSONA_TRAITS.optimizer;

  // Primeiro nome para a fala do Advisor
  const firstName = userName ? userName.split(" ")[0] : "João";

  // Simulação dinâmica e contextualizada da fala do Advisor com base no tom e persona
  const getAdvisorSpeechSample = () => {
    const formattedIncome = formatCurrency(monthlyIncome);
    const formattedBalance = formatCurrency(mainBalance);

    if (aiTone === "analytical") {
      switch (currentPersonaId) {
        case "optimizer":
          return `Análise para ${firstName}: com renda base de R$ ${formattedIncome} e saldo livre de R$ ${formattedBalance}, o seu índice de eficiência é de 96%. Recomendo concentrar compras discricionárias no cartão de maior pontuação e liquidar parcelas antecipadas para manter o custo financeiro zerado.`;
        case "guardian":
          return `Auditoria contábil para ${firstName}: seu saldo atual de R$ ${formattedBalance} cobre compromissos imediatos. Para blindar a reserva de emergência equivalente a 3 meses (R$ ${formatCurrency(monthlyIncome * 3)}), limite despesas fixas a no máximo 60% da renda líquida.`;
        case "scaler":
          return `Cálculo de alavancagem: com renda de R$ ${formattedIncome}, seu potencial de aporte mensal projetado é de R$ ${formatCurrency(monthlyIncome * 0.25)}. Recomendo direcionar a sobra após liquidação de faturas para ativos de crescimento.`;
        case "minimalist":
          return `Métricas de frugalidade: mantendo as despesas essenciais em até R$ ${formatCurrency(monthlyIncome * 0.50)}, sua taxa de poupança atinge 50%, reduzindo o tempo para independência financeira em 4,2 anos.`;
      }
    } else if (aiTone === "direct") {
      switch (currentPersonaId) {
        case "optimizer":
          return `Direto ao ponto, ${firstName}: você tem R$ ${formattedBalance} em conta. Corte imediatamente compras supérfluas no crédito parcelado esta semana e proteja sua margem para fechar o mês no positivo.`;
        case "guardian":
          return `Atenção, ${firstName}: sua prioridade é segurança. Não assuma novos parcelamentos até acumular pelo menos uma reserva intocável no débito. Foco total em previsibilidade.`;
        case "scaler":
          return `Foco no objetivo, ${firstName}: pare de deixar dinheiro parado gerando retorno zero. Organize as faturas dos cartões e transfira todo excedente para seus aportes estratégicos.`;
        case "minimalist":
          return `Simplifique agora, ${firstName}: elimine assinaturas automáticas não essenciais. Cada real poupado do seu salário de R$ ${formattedIncome} compra sua liberdade futura.`;
      }
    } else {
      // collaborative / Parceiro Estratégico
      switch (currentPersonaId) {
        case "optimizer":
          return `Excelente posicionamento, ${firstName}. Identificamos boas oportunidades de otimizar sua fatura mantendo seus benefícios ativos. Podemos planejar a próxima quinzena juntos com tranquilidade.`;
        case "guardian":
          return `${firstName}, estamos no caminho certo para consolidar sua tranquilidade financeira. Com R$ ${formattedBalance} disponíveis, vamos proteger seu fluxo sem abrir mão do seu bem-estar.`;
        case "scaler":
          return `Visão de futuro em dia, ${firstName}. Sua renda de R$ ${formattedIncome} dá espaço para darmos o próximo passo em direção às suas metas de crescimento e independência.`;
        case "minimalist":
          return `Ótima sintonia, ${firstName}. Viver com leveza e clareza financeira é o caminho mais sólido para uma vida descomplicada. Vamos manter a consistência nas próximas semanas.`;
      }
    }
  };

  return (
    <div className="bg-white rounded-[26px] p-6 sm:p-7 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6 font-sans">
      {/* Topo com Título e Aura Apple Intelligence */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-xs flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center text-lg">
              <span>{currentPersona.emoji}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-[#1D1D1F]">
                Analisador Cognitivo de IA
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
                <Sparkles size={10} className="text-purple-500" />
                Apple Intelligence
              </span>
            </div>
            <p className="text-xs text-[#86868B]">
              Selecione o arquétipo que dita o raciocínio financeiro do Advisor
            </p>
          </div>
        </div>

        {/* Status de Alinhamento */}
        <div className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2F2F7] text-xs font-semibold text-[#1D1D1F]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Ativo: {currentPersona.title}</span>
        </div>
      </div>

      {/* Seletor Rápido de 4 Arquétipos com Emojis */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[#86868B] uppercase tracking-wider block px-1">
          Alternar Arquétipo com 1 Toque
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(Object.keys(PERSONA_METADATA) as FinancialPersonaId[]).map((personaId) => {
            const persona = PERSONA_METADATA[personaId];
            const isSelected = currentPersonaId === personaId;

            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => onSelectPersona(persona.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 active:scale-[0.98] ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-sm ring-2 ring-black/5"
                    : "bg-[#F2F2F7]/60 hover:bg-[#F2F2F7] text-[#1D1D1F] border-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{persona.emoji}</span>
                  {isSelected ? (
                    <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                      <Check size={10} className="text-[#1D1D1F] stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-black/10" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-xs leading-snug">{persona.title}</div>
                  <div
                    className={`text-[10px] mt-0.5 leading-snug line-clamp-1 ${
                      isSelected ? "text-white/70" : "text-[#86868B]"
                    }`}
                  >
                    {persona.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Radar de Traços Cognitivos / Imagem do Analisador */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <label className="text-xs font-semibold text-[#86868B] uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={13} className="text-amber-500" />
            <span>Dimensões Estratégicas do Perfil</span>
          </label>
          <span className="text-[11px] font-medium text-[#86868B]">Calibrado pela IA</span>
        </div>

        <div className="bg-[#F2F2F7]/50 rounded-2xl p-4 border border-black/[0.04] space-y-3.5">
          {traits.map((trait, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-[#1D1D1F] text-[11px]">{trait.label}</span>
                <span className="font-mono font-semibold text-[#1D1D1F] text-[11px] tabular-nums">
                  {trait.value}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#E5E5EA] rounded-full overflow-hidden p-[1px]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${trait.color} transition-all duration-700 ease-out`}
                  style={{ width: `${trait.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Balão Interativo: "Como o Advisor fala com você" (Simulação ao Vivo) */}
      <div className="space-y-2 pt-1 border-t border-black/[0.05]">
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F]">
            <Bot size={14} className="text-purple-600" />
            <span>Como o Advisor conversa com você</span>
          </div>
          <span className="text-[10px] text-[#86868B] font-mono uppercase tracking-wider">
            Live Preview
          </span>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-br from-[#F8F8FA] to-[#F2F2F7] p-4 border border-black/[0.06] shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 text-xs shadow-xs mt-0.5">
              <Sparkles size={14} className="text-amber-400" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#1D1D1F]">Wallet Advisor CFO</span>
                <span className="text-[10px] text-purple-700 bg-purple-100/70 font-semibold px-2 py-0.5 rounded-full">
                  {aiTone === "analytical"
                    ? "Tom Analítico Suíço"
                    : aiTone === "direct"
                    ? "Tom Mentor Direto"
                    : "Tom Parceiro Estratégico"}
                </span>
              </div>
              <p className="text-xs text-[#1D1D1F]/85 leading-relaxed font-normal italic">
                &ldquo;{getAdvisorSpeechSample()}&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
