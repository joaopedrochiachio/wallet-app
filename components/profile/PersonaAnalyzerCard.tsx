"use client";

import React from "react";
import { FinancialPersonaId, AIToneId } from "@/types";
import { PERSONA_METADATA } from "./WalletIdTitaniumCard";
import { Check } from "lucide-react";

interface PersonaTrait {
  label: string;
  value: number;
}

const PERSONA_TRAITS: Record<FinancialPersonaId, PersonaTrait[]> = {
  optimizer: [
    { label: "Eficiência no Uso de Crédito", value: 96 },
    { label: "Otimização de Custos e Benefícios", value: 92 },
    { label: "Previsibilidade de Fluxo de Caixa", value: 78 },
    { label: "Disciplina de Teto Orçamentário", value: 85 },
  ],
  guardian: [
    { label: "Reserva de Liquidez e Blindagem", value: 98 },
    { label: "Previsibilidade Contábil", value: 95 },
    { label: "Aversão a Riscos e Juros", value: 94 },
    { label: "Alavancagem no Cartão", value: 45 },
  ],
  scaler: [
    { label: "Expansão Patrimonial e Aportes", value: 96 },
    { label: "Visão Estratégica de Longo Prazo", value: 92 },
    { label: "Alavancagem Inteligente de Caixa", value: 88 },
    { label: "Tolerância a Volatilidade", value: 80 },
  ],
  minimalist: [
    { label: "Taxa de Poupança Real", value: 97 },
    { label: "Frugalidade e Despesas Essenciais", value: 95 },
    { label: "Independência Financeira (FIRE)", value: 91 },
    { label: "Simplicidade de Instrumentos", value: 94 },
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

  const firstName = userName ? userName.split(" ")[0] : "João";

  const getAdvisorSpeechSample = () => {
    const formattedIncome = formatCurrency(monthlyIncome);
    const formattedBalance = formatCurrency(mainBalance);

    if (aiTone === "analytical") {
      switch (currentPersonaId) {
        case "optimizer":
          return `Análise para ${firstName}: com renda base de R$ ${formattedIncome} e saldo livre de R$ ${formattedBalance}, o índice de eficiência da carteira é de 96%. Recomendamos liquidar parcelas antecipadas no fechamento para manter o custo financeiro zerado.`;
        case "guardian":
          return `Auditoria contábil para ${firstName}: seu saldo atual de R$ ${formattedBalance} cobre compromissos imediatos. Para blindar a reserva de emergência equivalente a 3 meses (R$ ${formatCurrency(monthlyIncome * 3)}), limite despesas fixas a no máximo 60% da renda.`;
        case "scaler":
          return `Cálculo de alavancagem para ${firstName}: com renda de R$ ${formattedIncome}, seu potencial de aporte mensal projetado é de R$ ${formatCurrency(monthlyIncome * 0.25)}. Direcione excedentes pós-fatura para ativos de crescimento.`;
        case "minimalist":
          return `Métricas de frugalidade para ${firstName}: mantendo as despesas essenciais em até R$ ${formatCurrency(monthlyIncome * 0.50)}, sua taxa de poupança atinge 50%, acelerando sua independência financeira.`;
      }
    } else if (aiTone === "direct") {
      switch (currentPersonaId) {
        case "optimizer":
          return `Direto ao ponto, ${firstName}: você tem R$ ${formattedBalance} em conta. Corte imediatamente compras supérfluas no crédito parcelado esta semana e proteja sua margem para fechar o mês no positivo.`;
        case "guardian":
          return `Atenção, ${firstName}: sua prioridade é segurança. Não assuma novos parcelamentos até acumular uma reserva intocável no débito. Foco total em previsibilidade.`;
        case "scaler":
          return `Foco no objetivo, ${firstName}: não deixe dinheiro parado gerando retorno zero. Organize as faturas e transfira o excedente líquido para aportes estratégicos.`;
        case "minimalist":
          return `Simplifique agora, ${firstName}: elimine assinaturas automáticas não essenciais. Cada real poupado da renda de R$ ${formattedIncome} compra sua liberdade futura.`;
      }
    } else {
      switch (currentPersonaId) {
        case "optimizer":
          return `Excelente posicionamento, ${firstName}. Identificamos boas oportunidades de otimizar sua fatura mantendo seus benefícios ativos. Podemos planejar a próxima quinzena juntos com tranquilidade.`;
        case "guardian":
          return `${firstName}, estamos no caminho certo para consolidar sua estabilidade. Com R$ ${formattedBalance} disponíveis, vamos proteger seu fluxo sem abrir mão do seu bem-estar.`;
        case "scaler":
          return `Visão de futuro em dia, ${firstName}. Sua renda de R$ ${formattedIncome} dá espaço para darmos o próximo passo em direção às suas metas de crescimento e independência.`;
        case "minimalist":
          return `Ótima sintonia, ${firstName}. Viver com clareza financeira é o caminho mais sólido para uma vida descomplicada. Vamos manter a consistência nas próximas semanas.`;
      }
    }
  };

  return (
    <div className="bg-white rounded-[24px] p-6 sm:p-7 border border-black/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.03)] space-y-6 font-sans">
      {/* Header Estilo Claude / Apple Settings */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-black/[0.05]">
        <div>
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#86868B] font-semibold block">
            MODELO COGNITIVO · ADVISOR IA
          </span>
          <h3 className="text-base sm:text-lg font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
            Diretriz Estratégica do Arquétipo
          </h3>
          <p className="text-xs text-[#86868B] mt-0.5">
            Define a lente contábil utilizada pela IA para avaliar seu fluxo de caixa e formular recomendações
          </p>
        </div>

        <div className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2F2F7] border border-black/[0.04] text-[11px] font-mono font-medium text-[#1D1D1F]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Ativo: {currentPersona.title}</span>
        </div>
      </div>

      {/* 4 Cards Arquiteturais de Seleção (Estilo Fintech / Linear) */}
      <div className="space-y-2.5">
        <label className="text-[11px] font-mono uppercase tracking-wider text-[#86868B] font-semibold block">
          Selecione o Arquétipo da Carteira
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(PERSONA_METADATA) as FinancialPersonaId[]).map((personaId) => {
            const persona = PERSONA_METADATA[personaId];
            const isSelected = currentPersonaId === personaId;

            return (
              <div
                key={persona.id}
                onClick={() => onSelectPersona(persona.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between gap-3 ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-sm"
                    : "bg-white border-black/[0.08] hover:border-black/20 hover:bg-[#F9F9FB] text-[#1D1D1F]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight">
                      {persona.title}
                    </h4>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider block mt-0.5 ${
                        isSelected ? "text-white/60" : "text-[#86868B]"
                      }`}
                    >
                      {persona.categoryTag}
                    </span>
                  </div>

                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                      isSelected
                        ? "border-white bg-white"
                        : "border-[#C7C7CC] bg-white"
                    }`}
                  >
                    {isSelected && <Check size={10} className="text-[#1D1D1F] stroke-[3]" />}
                  </div>
                </div>

                <p
                  className={`text-xs leading-relaxed ${
                    isSelected ? "text-white/80" : "text-[#636366]"
                  }`}
                >
                  {persona.tagline}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dimensões do Modelo (Barras de Telemetria Contábil) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-mono uppercase tracking-wider text-[#86868B] font-semibold">
            Calibração Contábil do Modelo
          </label>
          <span className="text-[10px] font-mono text-[#86868B]">Valores Ponderados</span>
        </div>

        <div className="bg-[#F9F9FB] rounded-2xl p-4 sm:p-5 border border-black/[0.05] space-y-3.5">
          {traits.map((trait, index) => (
            <div key={index} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-[#1D1D1F] text-xs">{trait.label}</span>
                <span className="font-mono font-medium text-[#1D1D1F] text-xs tabular-nums">
                  {trait.value}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1D1D1F] transition-all duration-500 ease-out"
                  style={{ width: `${trait.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Briefing Executivo do Advisor (Claude / OpenAI Memo) */}
      <div className="space-y-2 pt-2 border-t border-black/[0.05]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#86868B] font-semibold">
            Demonstração de Postura do Advisor
          </span>
          <span className="text-[10px] font-mono text-[#86868B] uppercase">
            {aiTone === "analytical"
              ? "Analítico Suíço"
              : aiTone === "direct"
              ? "Mentor Direto"
              : "Parceiro Estratégico"}
          </span>
        </div>

        <div className="rounded-2xl bg-[#F9F9FB] p-4 sm:p-5 border border-black/[0.06]">
          <p className="text-xs text-[#1D1D1F]/90 leading-relaxed font-normal">
            &ldquo;{getAdvisorSpeechSample()}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
