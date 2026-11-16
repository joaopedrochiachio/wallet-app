/**
 * Informativo financeiro gerado pela IA (tela da IA).
 *
 * Fluxo:
 * 1. `buildBriefingFacts` calcula em TypeScript uma ficha de fatos numerados
 *    (saldo, meta, faturas, uso do limite...). É a única fonte de números.
 * 2. A IA escreve o informativo (manchete, pontos a favor/contra, ação, conceito)
 *    citando os fatos pelo id. Ela escolhe o que importa e explica; não calcula.
 * 3. `validateBriefing` confere o JSON: ids existentes e nenhum número fora da
 *    ficha. Se a IA inventar valores, pedimos de novo com o erro apontado; se
 *    insistir, a rota falha de forma explícita (sem texto pronto no lugar).
 */
import type { FinancialAnalytics } from "./financialAnalyticsService.ts";
import { callOpenAIResponses, OPENAI_MODELS, type OpenAICallParams, type OpenAIResponseResult } from "./openaiService.ts";

export const ASSISTANT_NAME = "Cofi";

import {
  formatFactValue,
  type AIBriefing,
  type BriefingFact,
  type BriefingMood,
  type BriefingPoint,
  type BriefingSeverity,
  type FactKind,
} from "./aiBriefingModel.ts";

export { formatFactValue };
export type { AIBriefing, BriefingFact, BriefingMood, BriefingPoint, BriefingSeverity, FactKind };

export interface BriefingValidationIssue {
  path: string;
  problem: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Ficha de fatos: tudo que a IA pode citar, cada um com o PERÍODO no rótulo
 * (hoje, mês até hoje, até o fim do mês, média dos meses anteriores, próximo mês).
 */
export function buildBriefingFacts(a: FinancialAnalytics): BriefingFact[] {
  const facts: BriefingFact[] = [];
  const add = (id: string, label: string, value: unknown, kind: FactKind, note?: string) => {
    if (!finite(value)) return;
    facts.push({ id, label, value: kind === "percent" ? Math.round(value * 10) / 10 : kind === "day" || kind === "count" ? Math.round(value) : round2(value), kind, note });
  };
  const m = a.monthName;

  // Caixa (mesmos números da tela de Planejamento)
  add("saldo_hoje", "Saldo na conta hoje", a.cash.balanceToday, "brl");
  add("recebido_mes", `Já recebido em ${m}`, a.cash.receivedToDate, "brl");
  add("pago_mes", `Já pago em ${m} (saiu da conta)`, a.cash.paidToDate, "brl");
  add("a_receber", `Ainda a receber até o fim de ${m}`, a.cash.toReceive, "brl", "entradas previstas que ainda não caíram");
  add("a_pagar", `Ainda a pagar até o fim de ${m}`, a.cash.toPay, "brl", "contas e faturas que ainda vão sair da conta");
  if (a.cash.invoicesToPay > 0) add("faturas_a_pagar", `Faturas de cartão a pagar em ${m}`, a.cash.invoicesToPay, "brl");
  add("saldo_fim_mes", `Saldo previsto no fim de ${m}`, a.cash.projectedClose, "brl", "saldo de hoje + a receber − a pagar (igual à tela de Planejamento)");
  add("meta_mes", "Meta de saldo para fechar o mês", a.target.value, "brl");
  if (a.target.gap >= 0) {
    add("folga_meta", "Folga acima da meta no fim do mês", a.target.gap, "brl");
    add("gasto_livre_dia", "Quanto dá para gastar por dia sem furar a meta", a.target.dailyRoom, "brl");
    add("gasto_livre_semana", "Quanto dá para gastar por semana sem furar a meta", a.target.dailyRoom * 7, "brl");
  } else {
    add("falta_meta", "Quanto falta para alcançar a meta", -a.target.gap, "brl");
    add("corte_dia", "Corte por dia necessário para alcançar a meta", a.target.dailyCut, "brl");
    add("corte_semana", "Corte por semana necessário para alcançar a meta", a.target.dailyCut * 7, "brl");
  }
  add("dias_restantes", `Dias até o fim de ${m} (contando hoje)`, a.daysLeft, "days");

  // Linha do tempo do caixa
  if (a.timeline.negativeFromDay !== null) {
    add("menor_saldo", `Menor saldo previsto na conta em ${m}`, a.timeline.lowestBalance, "brl", "o pior momento do mês, antes das próximas entradas");
    add("dia_menor_saldo", "Dia do menor saldo previsto", a.timeline.lowestDay, "day");
    add("dia_fica_negativo", "Dia em que a conta fica negativa", a.timeline.negativeFromDay, "day");
    if (a.timeline.recoveryIncome) {
      add("entrada_que_cobre", `Entrada que cobre o buraco: ${a.timeline.recoveryIncome.title}`, a.timeline.recoveryIncome.amount, "brl");
      add("dia_entrada_que_cobre", `Dia da entrada "${a.timeline.recoveryIncome.title}"`, a.timeline.recoveryIncome.day, "day");
    }
  }
  const until = a.timeline.untilNextIncome;
  if (until) {
    add("livre_ate_entrada", `Dinheiro livre até a próxima entrada (${until.title}, dia ${until.day})`, until.available, "brl", "saldo de hoje menos as contas que vencem antes dessa entrada");
    add("livre_dia_ate_entrada", `Quanto dá para gastar por dia até o dia ${until.day}`, until.dailyAvailable, "brl");
    add("dias_ate_entrada", `Dias até a próxima entrada (${until.title})`, until.daysUntil, "days");
  }
  const nextIncome = a.timeline.events.find((e) => e.direction === "in");
  if (nextIncome) {
    add("proxima_entrada", `Próxima entrada prevista: ${nextIncome.title}`, nextIncome.amount, "brl");
    add("dia_proxima_entrada", `Dia da próxima entrada (${nextIncome.title})`, nextIncome.day, "day");
  }
  const nextBill = a.timeline.events.find((e) => e.direction === "out");
  if (nextBill) {
    add("proxima_conta", `Próxima conta a pagar: ${nextBill.title}`, nextBill.amount, "brl");
    add("dia_proxima_conta", `Dia da próxima conta (${nextBill.title})`, nextBill.day, "day");
  }

  // Gastos do mês até hoje x mesmo período dos meses anteriores
  const s = a.spending;
  add("gasto_mes", `Gastos de ${m} até hoje (conta + cartão, com contas fixas)`, s.monthToDate, "brl", `${s.transactionsThisMonth} lançamentos`);
  if (s.fixedToDate > 0) add("contas_fixas_pagas", `Contas fixas já pagas em ${m}`, s.fixedToDate, "brl");
  add("gasto_dia_a_dia", `Gastos do dia a dia em ${m} até hoje (sem contas fixas)`, s.variableToDate, "brl");
  if (s.monthToDateCredit > 0) add("gasto_mes_cartao", `Gastos de ${m} no cartão (pesam na próxima fatura)`, s.monthToDateCredit, "brl");
  if (s.samePeriodAverage !== null) {
    add("gasto_media_periodo", `Média dos gastos do dia a dia do dia 1 ao dia ${a.day} nos ${s.previousMonthsWithData} meses anteriores`, s.samePeriodAverage, "brl");
    add("ritmo_gastos_pct", "Ritmo dos gastos do dia a dia em relação à média (100% = igual)", s.pacePercent, "percent");
  }
  if (s.fullMonthAverage !== null) add("gasto_medio_mes", "Gasto médio do dia a dia por mês inteiro nos meses anteriores", s.fullMonthAverage, "brl");
  s.categories.slice(0, 3).forEach((c, i) => {
    add(`categoria_${i + 1}`, `${c.category} em ${m} até hoje (dia a dia)`, c.monthToDate, "brl", `${c.count} lançamentos`);
    if (c.samePeriodAverage !== null) add(`categoria_${i + 1}_media`, `${c.category}: média do mesmo período nos meses anteriores`, c.samePeriodAverage, "brl");
  });
  if (s.biggestIncrease) {
    add("maior_alta", `Maior alta do mês: ${s.biggestIncrease.category} em ${m} até hoje`, s.biggestIncrease.monthToDate, "brl");
    add("maior_alta_media", `${s.biggestIncrease.category}: média do mesmo período antes`, s.biggestIncrease.samePeriodAverage, "brl");
    add("maior_alta_pct", `Aumento de ${s.biggestIncrease.category} sobre a média`, s.biggestIncrease.changePercent, "percent");
    add("maior_alta_metade_extra", `Metade do excesso em ${s.biggestIncrease.category}`, (s.biggestIncrease.monthToDate - (s.biggestIncrease.samePeriodAverage ?? 0)) / 2, "brl");
  }
  s.habits.forEach((h, i) => {
    add(`habito_${i + 1}`, `Hábito em ${m} até hoje: ${h.name}`, h.total, "brl");
    add(`habito_${i + 1}_qtd`, `Compras de ${h.name} em ${m} até hoje`, h.count, "count");
    if (h.previousAverage !== null) add(`habito_${i + 1}_media`, `${h.name}: média do mesmo período antes`, h.previousAverage, "brl");
  });
  s.largestPurchases.slice(0, 2).forEach((p, i) => {
    add(`compra_${i + 1}`, `Maior compra ${i + 1} de ${m}: ${p.title}${p.credit ? " (cartão)" : ""}`, p.amount, "brl");
  });

  // Cartão, próximo mês e metas
  if (a.credit) {
    add("limite_total", "Limite total dos cartões", a.credit.limit, "brl");
    add("limite_usado", "Limite já usado nos cartões (inclui parcelas futuras)", a.credit.used, "brl");
    add("limite_uso_pct", "Uso do limite dos cartões (inclui parcelas futuras)", a.credit.usagePercent, "percent", "acima de 80% deixa pouca folga para imprevistos");
    add("limite_disponivel", "Limite disponível nos cartões", a.credit.available, "brl");
  }
  if (a.nextMonth) {
    const n = a.nextMonthName;
    add("proximo_mes_entradas", `Entradas previstas em ${n}`, a.nextMonth.income, "brl");
    add("proximo_mes_compromissos", `Compromissos já agendados em ${n}`, a.nextMonth.committed, "brl", "inclui parcelas de cartão e contas fixas");
    if (a.nextMonth.installments > 0) add("proximo_mes_parcelas", `Parcelas de cartão que caem em ${n}`, a.nextMonth.installments, "brl");
    add("proximo_mes_saldo", `Saldo previsto no fim de ${n}`, a.nextMonth.projectedFree, "brl", "só com o que já está agendado; gastos do dia a dia vêm a mais");
  }
  a.goals.forEach((g, i) => {
    add(`objetivo_${i + 1}_progresso`, `Progresso do objetivo "${g.title}"`, g.progressPercent, "percent");
    add(`objetivo_${i + 1}_falta`, `Quanto falta para o objetivo "${g.title}"`, g.gap, "brl");
  });
  return facts;
}

/** Números que um texto pode citar: valores da ficha (com arredondamentos comuns) e números pequenos de contagem/dia. */
export function isGroundedNumber(n: number, facts: BriefingFact[]): boolean {
  if (Number.isInteger(n) && n >= 0 && n <= 31) return true; // dias, quantidades, "3 passos"
  if (Number.isInteger(n) && n >= 2020 && n <= 2040) return true; // anos
  return facts.some((f) => {
    const v = Math.abs(f.value);
    const m = Math.abs(n);
    return Math.abs(m - v) <= Math.max(1, v * 0.005) || Math.abs(m - Math.round(v)) < 0.01;
  });
}

/**
 * Extrai valores de um texto em pt-BR ("R$ 1.234,56", "45%", "2026", "-778").
 * Diferente do extrator antigo, não quebra números longos sem separador (2026 → 202 + 6).
 */
export function extractAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseFloat(m[0].replace(/\./g, "").replace(",", "."));
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

export function findUngroundedNumbers(text: string, facts: BriefingFact[]): number[] {
  // Ignora referências a ids de fatos (ex.: categoria_1) e datas no formato dd/mm
  const cleaned = text.replace(/\b[a-z_]+_\d+\b/gi, " ").replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ");
  return extractAmounts(cleaned).filter((n) => !isGroundedNumber(n, facts));
}

export const AI_BRIEFING_JSON_SCHEMA = {
  name: "wallet_ai_briefing",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["headline", "summary", "mood", "highlightFactIds", "positives", "negatives", "nextStep", "lesson", "suggestedQuestions"],
    properties: {
      headline: { type: "string", description: "Manchete de até 80 caracteres com a conclusão principal do mês." },
      summary: { type: "string", description: "2 ou 3 frases curtas, em linguagem simples, dizendo como a pessoa está e por quê." },
      mood: { type: "string", enum: ["positivo", "neutro", "atencao", "critico"] },
      highlightFactIds: { type: "array", items: { type: "string" }, description: "3 ou 4 ids de fatos mais importantes para mostrar em destaque." },
      positives: {
        type: "array",
        description: "De 0 a 3 pontos que estão a favor da pessoa.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "explanation", "evidenceFactIds", "action"],
          properties: {
            title: { type: "string" },
            explanation: { type: "string" },
            evidenceFactIds: { type: "array", items: { type: "string" } },
            action: { type: "string" },
          },
        },
      },
      negatives: {
        type: "array",
        description: "De 0 a 4 pontos que pedem atenção, do mais grave para o menos grave.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "explanation", "evidenceFactIds", "action", "severity"],
          properties: {
            title: { type: "string" },
            explanation: { type: "string" },
            evidenceFactIds: { type: "array", items: { type: "string" } },
            action: { type: "string" },
            severity: { type: "string", enum: ["alta", "media", "baixa"] },
          },
        },
      },
      nextStep: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail"],
        properties: { title: { type: "string" }, detail: { type: "string" } },
      },
      lesson: {
        type: "object",
        additionalProperties: false,
        required: ["term", "explanation"],
        properties: { term: { type: "string" }, explanation: { type: "string" } },
      },
      suggestedQuestions: { type: "array", items: { type: "string" }, description: "3 perguntas curtas que a pessoa pode fazer no chat sobre a própria situação." },
    },
  },
} as const;

export function buildBriefingFactSheet(facts: BriefingFact[]): string {
  return facts
    .map((f) => `- ${f.id} | ${f.label}: ${formatFactValue(f)}${f.note ? ` (${f.note})` : ""}`)
    .join("\n");
}

export type SignalLevel = "critico" | "atencao" | "positivo" | "poucos_dados";
export interface BriefingSignal {
  level: SignalLevel;
  text: string;
  factIds: string[];
  /** Como transformar o sinal em ação concreta, com os fatos que trazem o valor. */
  actionHint?: string;
}

/**
 * Sinais calculados em TypeScript: dizem à IA O QUE é grave, já considerando o
 * dinheiro que ainda vai entrar. A IA continua escrevendo tudo.
 */
export function buildBriefingSignals(facts: BriefingFact[], a: FinancialAnalytics): BriefingSignal[] {
  const has = (id: string) => facts.some((f) => f.id === id);
  const out: BriefingSignal[] = [];
  const close = a.cash.projectedClose;

  if (close < 0) {
    out.push({ level: "critico", text: "Mesmo com as entradas previstas, o mês fecha no negativo.", factIds: ["saldo_fim_mes", "a_receber", "a_pagar", "corte_dia"], actionHint: "cortar corte_dia por dia (ou corte_semana por semana) até o fim do mês" });
  } else if (a.timeline.negativeFromDay !== null) {
    const rescue = a.timeline.recoveryIncome ? ` até a entrada "${a.timeline.recoveryIncome.title}"` : "";
    out.push({
      level: "atencao",
      text: `O mês fecha positivo, mas a conta fica negativa por alguns dias${rescue}: contas vencem antes do dinheiro entrar. Isso é um problema de data, não de falta de renda.`,
      factIds: ["menor_saldo", "dia_fica_negativo", "entrada_que_cobre", "dia_entrada_que_cobre"],
      actionHint: "adiar a conta do dia_fica_negativo para depois do dia_entrada_que_cobre, ou separar o valor de menor_saldo até lá",
    });
  }
  const until = a.timeline.untilNextIncome;
  if (until && a.timeline.negativeFromDay === null && until.daysUntil >= 2 && until.dailyAvailable < Math.max(1, a.target.dailyRoom) * 0.5) {
    out.push({
      level: "atencao",
      text: `Até a próxima entrada (dia ${until.day}) o dinheiro livre é curto, bem abaixo do limite diário do resto do mês.`,
      factIds: ["livre_ate_entrada", "livre_dia_ate_entrada", "dias_ate_entrada", "dia_proxima_entrada"],
      actionHint: "gastar no máximo livre_dia_ate_entrada por dia até o dia_proxima_entrada; depois vale o gasto_livre_dia",
    });
  }
  if (close >= 0 && a.target.gap < 0) {
    out.push({ level: a.target.value > 0 && -a.target.gap >= a.target.value * 0.5 ? "critico" : "atencao", text: "O mês fecha positivo, mas abaixo da meta escolhida.", factIds: ["falta_meta", "corte_dia", "saldo_fim_mes"], actionHint: "segurar corte_dia por dia até o fim do mês" });
  }
  if ((a.spending.pacePercent ?? 0) >= 120) {
    out.push({ level: "atencao", text: "Os gastos do dia a dia estão mais rápidos que o normal para esta altura do mês.", factIds: ["gasto_dia_a_dia", "gasto_media_periodo", "ritmo_gastos_pct"], actionHint: a.target.gap >= 0 ? "limitar os gastos a gasto_livre_semana por semana até o fim do mês" : "cortar corte_semana por semana até o fim do mês" });
  }
  if (a.spending.biggestIncrease) {
    out.push({ level: "atencao", text: `${a.spending.biggestIncrease.category} subiu bem acima da média deste período.`, factIds: ["maior_alta", "maior_alta_media", "maior_alta_pct", "maior_alta_metade_extra"], actionHint: "cortar maior_alta_metade_extra nessa categoria até o fim do mês" });
  }
  a.spending.habits.forEach((h, i) => {
    const above = h.previousAverage !== null && h.total > h.previousAverage * 1.2;
    out.push({ level: "atencao", text: `Hábito repetido neste mês: ${h.name}${above ? ", acima da média dos meses anteriores" : ""}.`, factIds: [`habito_${i + 1}`, `habito_${i + 1}_qtd`, `habito_${i + 1}_media`], actionHint: h.previousAverage !== null ? `voltar para perto de habito_${i + 1}_media nesse hábito até o fim do mês` : "definir um teto para esse hábito nesta semana" });
  });
  if (a.credit && a.credit.usagePercent >= 80) {
    out.push({ level: "atencao", text: "Uso do limite do cartão muito alto: sobra pouca folga para imprevistos.", factIds: ["limite_uso_pct", "limite_disponivel", "limite_usado"], actionHint: "evitar parcelar qualquer compra nova até a próxima fatura; o que sobra de limite é limite_disponivel" });
  }
  if (a.nextMonth && a.nextMonth.projectedFree < 0) {
    out.push({ level: "atencao", text: `O próximo mês (${a.nextMonthName}) já começa apertado com o que está agendado.`, factIds: ["proximo_mes_saldo", "proximo_mes_compromissos", "proximo_mes_parcelas"], actionHint: "guardar parte da folga deste mês para cobrir o próximo" });
  } else if (a.nextMonth && a.nextMonth.income > 0 && a.nextMonth.installments >= a.nextMonth.income * 0.25) {
    out.push({ level: "atencao", text: `As parcelas de cartão de ${a.nextMonthName} pesam mais de um quarto das entradas.`, factIds: ["proximo_mes_parcelas", "proximo_mes_entradas", "proximo_mes_saldo", "gasto_mes_cartao"], actionHint: "evitar novas compras parceladas este mês e separar proximo_mes_parcelas assim que a próxima entrada cair" });
  }
  if (!a.incomeKnown || (a.spending.transactionsThisMonth < 2 && a.cash.receivedToDate === 0)) {
    out.push({ level: "poucos_dados", text: "Poucos dados neste mês: oriente a registrar renda, contas e gastos; não tire conclusões fortes.", factIds: ["gasto_mes", "saldo_hoje"], actionHint: "registrar a renda e as contas fixas no app até o fim desta semana" });
  }

  if (close >= 0 && a.target.gap >= 0 && a.target.value > 0 && a.incomeKnown) out.push({ level: "positivo", text: "O mês fecha acima da meta, já contando o que vai entrar e sair.", factIds: ["saldo_fim_mes", "folga_meta", "gasto_livre_dia"], actionHint: a.timeline.untilNextIncome && a.timeline.untilNextIncome.dailyAvailable < a.target.dailyRoom ? "até o dia_proxima_entrada gastar no máximo livre_dia_ate_entrada por dia; depois dele, manter em até gasto_livre_dia por dia" : "manter os gastos em até gasto_livre_dia por dia, ou guardar a folga_meta" });
  if (a.cash.toReceive > 0 && a.cash.toReceive >= a.cash.toPay) out.push({ level: "positivo", text: "As entradas que ainda vão cair cobrem as contas que faltam pagar.", factIds: ["a_receber", "a_pagar"], actionHint: "pagar cada conta no dia em que a entrada cair (ver a linha do tempo)" });
  if (a.spending.pacePercent !== null && a.spending.pacePercent <= 90) out.push({ level: "positivo", text: "Os gastos do dia a dia estão abaixo da média para esta altura do mês.", factIds: ["gasto_dia_a_dia", "gasto_media_periodo", "ritmo_gastos_pct"], actionHint: "manter o ritmo até o fim do mês e guardar a diferença" });
  return out.map((sig) => ({ ...sig, factIds: sig.factIds.filter(has) }));
}

/** Humor que os sinais indicam (a IA recebe como referência obrigatória). */
export function moodFromSignals(signals: BriefingSignal[]): BriefingMood {
  if (signals.some((s) => s.level === "critico")) return "critico";
  if (signals.some((s) => s.level === "atencao")) return "atencao";
  if (signals.some((s) => s.level === "poucos_dados")) return "neutro";
  return "positivo";
}

export function formatSignals(signals: BriefingSignal[]): string {
  if (!signals.length) return "- Nenhum sinal calculado.";
  const label: Record<SignalLevel, string> = { critico: "CRÍTICO", atencao: "ATENÇÃO", positivo: "A FAVOR", poucos_dados: "DADOS" };
  return signals
    .map((sig) => {
      const facts = sig.factIds.length ? ` (fatos: ${sig.factIds.join(", ")})` : "";
      const hint = sig.actionHint ? `\n    ação sugerida: ${sig.actionHint}` : "";
      return `- [${label[sig.level]}] ${sig.text}${facts}${hint}`;
    })
    .join("\n");
}

/** Linha do tempo do caixa em texto, para a IA explicar datas. */
export function formatTimeline(a: FinancialAnalytics): string {
  if (!a.timeline.events.length) return "- Nenhuma entrada ou conta prevista até o fim do mês.";
  let running = a.cash.balanceToday;
  return a.timeline.events
    .map((e) => {
      running = round2(running + (e.direction === "in" ? e.amount : -e.amount));
      return `- dia ${e.day}: ${e.direction === "in" ? "entra" : "sai"} ${e.title} → saldo fica ${formatFactValue({ value: running, kind: "brl" })}`;
    })
    .join("\n");
}

const PERIOD_RULES = `REGRAS DE PERÍODO (não misture):
- "hoje" = saldo atual. "até hoje" = o que já aconteceu no mês. "até o fim do mês" = previsão que inclui o que ainda vai entrar e sair.
- Nunca compare o que falta pagar só com o saldo de hoje: some o que ainda vai entrar (a_receber). Use saldo_fim_mes para dizer se o mês fecha bem.
- Se a conta fica negativa por alguns dias e depois recupera, explique que é um problema de data (conta vence antes do salário), cite os dias e sugira antecipar a entrada, adiar a conta ou segurar gastos até o dia da entrada.
- Gastos por categoria e hábitos são do mês atual até hoje; compare com a média do mesmo período dos meses anteriores (quando houver). Não use totais de outros meses como se fossem deste mês.
- Compras no cartão deste mês pesam na fatura do mês seguinte.
- Limite diário tem dois momentos: até a próxima entrada vale livre_dia_ate_entrada (o dinheiro que existe de fato); depois dela vale gasto_livre_dia. Nunca recomende gastar gasto_livre_dia antes da entrada se livre_dia_ate_entrada for menor.`;

/** Bloco que o chat recebe: mesma ficha, sinais e linha do tempo do informativo. */
export function buildChatFactBlock(a: FinancialAnalytics | null | undefined): string {
  if (!a) return "";
  let facts: BriefingFact[];
  try {
    facts = buildBriefingFacts(a);
  } catch {
    return "";
  }
  return `

=== ANÁLISE DO MÊS CALCULADA PELO APP (FONTE PRINCIPAL; PREVALECE SOBRE OS BLOCOS ACIMA) ===
Data de referência: ${a.referenceDate} (dia ${a.day} de ${a.daysInMonth}).
Quando a pergunta envolver um destes números, cite o valor da ficha exatamente como está, em vez de recalcular.
${PERIOD_RULES}

FICHA DE FATOS
${buildBriefingFactSheet(facts)}

LINHA DO TEMPO DO CAIXA ATÉ O FIM DO MÊS (a partir do saldo de hoje)
${formatTimeline(a)}

SINAIS
${formatSignals(buildBriefingSignals(facts, a))}
`;
}

export interface BriefingProfile {
  aiTone?: string;
  primaryFocus?: string;
}

export function buildBriefingPrompt(params: { facts: BriefingFact[]; analytics: FinancialAnalytics; profile?: BriefingProfile; firstName?: string }): { systemPrompt: string; prompt: string } {
  const { facts, analytics } = params;
  const signals = buildBriefingSignals(facts, analytics);
  const toneGuide =
    ({
      analytical: "Tom analítico: números em destaque e raciocínio em passos.",
      direct: "Tom direto: conclusão primeiro, sem rodeios.",
      collaborative: "Tom acolhedor: reconheça o esforço e explique com calma.",
    } as Record<string, string>)[params.profile?.aiTone ?? ""] ?? "Tom direto e acolhedor.";

  const systemPrompt = `Você é ${ASSISTANT_NAME}, o analista financeiro do app Wallet+. Você escreve o informativo do dia: curto, direto e didático, como o resumo de um banco digital que explica a vida financeira para quem não é especialista. Seu valor está em ANALISAR: separar o que já aconteceu do que vai acontecer, comparar com a média da própria pessoa e apontar datas.

COMO ESCREVER
- Português do Brasil, frases curtas (até 20 palavras), sem jargão. Se usar um termo técnico, explique na mesma frase.
- Cada ponto responde três coisas:
  • title: o que está acontecendo, em até 8 palavras.
  • explanation: o EFEITO na vida da pessoa, não a repetição do número. Cite o número e, na mesma frase ou na seguinte, diga o que ele significa começando com "Isso significa que", "Ou seja" ou "Na prática".
  • action: começa com verbo no imperativo e traz um valor DA FICHA ou um prazo (hoje, esta semana, até o dia X). NUNCA crie um valor que não está na ficha.
- "nextStep": a ação mais importante de todas, tirada do sinal mais grave. O title começa com verbo e traz um valor da ficha ou um prazo (ex.: "Registre sua renda até sexta-feira", "Segure R$ 42,17 por dia até o dia 20").
- ${toneGuide}

REGRA DE OURO DOS NÚMEROS
- Use SOMENTE valores da ficha de fatos, escritos como aparecem (ex.: R$ 1.234,56, 45% ou dia 20). Não faça contas novas.
- Liste em evidenceFactIds os ids dos fatos que sustentam cada ponto. Todo ponto precisa de pelo menos um fato.
- "highlightFactIds": 3 ou 4 números que contam a história do mês. Prefira saldo_fim_mes, a_receber, a_pagar e o fato do principal risco ou destaque.

${PERIOD_RULES}

COMO JULGAR (os SINAIS calculados pelo app são a verdade sobre a gravidade)
- "mood": use exatamente o HUMOR INDICADO PELOS SINAIS.
- Cada sinal [CRÍTICO] ou [ATENÇÃO] vira um ponto em "negatives", usando os fatos indicados. Críticos com severity "alta"; atenção com "media" (ou "alta" se a conta fica negativa); hábitos sem alta sobre a média com "baixa".
- Cada sinal [A FAVOR] vira um ponto em "positives". Não invente pontos negativos sem sinal.
- A "action" de cada ponto segue a "ação sugerida" do sinal, trocando os ids pelos valores da ficha (ex.: "Segure R$ 42,17 por dia até o dia 30"). Toda action traz um valor da ficha ou um prazo.
- Se há sinal [DADOS], ele vira um ponto em "negatives" com severity "baixa", sem palavras de alarme, com a ação de registrar renda e contas com prazo.
- Nunca escreva palavras inteiras em maiúsculas.
- "lesson": um conceito ligado à situação (ex.: fluxo de caixa por data, saldo previsto, fatura vs. limite, ritmo de gastos). "term" é o nome do conceito (até 4 palavras); "explanation" tem 2 ou 3 frases simples, de 20 a 50 palavras no total, e usa um número da ficha.
- "suggestedQuestions": 3 perguntas sobre os próprios números. TODAS contêm "eu", "meu", "minha", "meus" ou "minhas" (ex.: "Quanto eu posso gastar por dia?", "Qual das minhas contas vence primeiro?").`;

  const prompt = `${params.firstName ? `Nome da pessoa: ${params.firstName}.\n` : ""}Foco declarado: ${params.profile?.primaryFocus || "não informado"}.
Hoje é dia ${analytics.day} de ${analytics.monthName} (${analytics.daysLeft} dias até o fim do mês, contando hoje).

FICHA DE FATOS (id | descrição: valor)
${buildBriefingFactSheet(facts)}

LINHA DO TEMPO DO CAIXA ATÉ O FIM DO MÊS (a partir do saldo de hoje)
${formatTimeline(analytics)}

SINAIS CALCULADOS PELO APP
${formatSignals(signals)}

HUMOR INDICADO PELOS SINAIS: ${moodFromSignals(signals)}

Escreva o informativo em JSON seguindo o schema.`;

  return { systemPrompt, prompt };
}

const asString = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Normaliza o JSON da IA e aponta problemas. Pontos com número inventado ou sem
 * evidência são descartados (e listados em issues); manchete/resumo inválidos
 * tornam o informativo inutilizável.
 */
export function validateBriefing(raw: unknown, facts: BriefingFact[]): { briefing: AIBriefing | null; issues: BriefingValidationIssue[]; fatal: boolean } {
  const issues: BriefingValidationIssue[] = [];
  const ids = new Set(facts.map((f) => f.id));
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const checkText = (path: string, text: string) => {
    const bad = findUngroundedNumbers(text, facts);
    if (bad.length) issues.push({ path, problem: `números fora da ficha: ${bad.join(", ")}` });
    return bad.length === 0;
  };

  const headline = asString(obj.headline, 120);
  const summary = asString(obj.summary, 600);
  let fatal = false;
  if (!headline) { issues.push({ path: "headline", problem: "vazia" }); fatal = true; }
  if (!summary) { issues.push({ path: "summary", problem: "vazio" }); fatal = true; }
  if (headline && !checkText("headline", headline)) fatal = true;
  if (summary && !checkText("summary", summary)) fatal = true;

  const moods: BriefingMood[] = ["positivo", "neutro", "atencao", "critico"];
  const mood = moods.includes(obj.mood as BriefingMood) ? (obj.mood as BriefingMood) : "neutro";
  if (!moods.includes(obj.mood as BriefingMood)) issues.push({ path: "mood", problem: "inválido" });

  const readPoints = (key: "positives" | "negatives"): BriefingPoint[] => {
    const list = Array.isArray(obj[key]) ? (obj[key] as unknown[]) : [];
    const out: BriefingPoint[] = [];
    list.slice(0, key === "negatives" ? 4 : 3).forEach((item, i) => {
      const p = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const path = `${key}[${i}]`;
      const point: BriefingPoint = {
        title: asString(p.title, 90),
        explanation: asString(p.explanation, 400),
        action: asString(p.action, 240),
        evidenceFactIds: (Array.isArray(p.evidenceFactIds) ? p.evidenceFactIds : []).map(String).filter((id) => ids.has(id)),
      };
      if (key === "negatives") point.severity = (["alta", "media", "baixa"] as const).includes(p.severity as BriefingSeverity) ? (p.severity as BriefingSeverity) : "media";
      const unknownIds = (Array.isArray(p.evidenceFactIds) ? p.evidenceFactIds : []).map(String).filter((id) => !ids.has(id));
      if (unknownIds.length) issues.push({ path, problem: `fatos inexistentes: ${unknownIds.join(", ")}` });
      if (!point.title || !point.explanation || !point.action) { issues.push({ path, problem: "campos vazios" }); return; }
      if (point.evidenceFactIds.length === 0) { issues.push({ path, problem: "sem fato de evidência" }); return; }
      const ok = [checkText(`${path}.title`, point.title), checkText(`${path}.explanation`, point.explanation), checkText(`${path}.action`, point.action)].every(Boolean);
      if (ok) out.push(point);
    });
    return out;
  };

  const positives = readPoints("positives");
  const negatives = readPoints("negatives");

  const highlightFactIds = (Array.isArray(obj.highlightFactIds) ? obj.highlightFactIds : []).map(String).filter((id) => ids.has(id)).slice(0, 4);
  if (highlightFactIds.length === 0) issues.push({ path: "highlightFactIds", problem: "nenhum id válido" });

  const ns = (obj.nextStep && typeof obj.nextStep === "object" ? obj.nextStep : {}) as Record<string, unknown>;
  const nextStep = { title: asString(ns.title, 90), detail: asString(ns.detail, 320) };
  if (!nextStep.title || !checkText("nextStep", `${nextStep.title} ${nextStep.detail}`)) {
    if (!nextStep.title) issues.push({ path: "nextStep", problem: "vazio" });
    nextStep.title = "";
    nextStep.detail = "";
  }

  const ls = (obj.lesson && typeof obj.lesson === "object" ? obj.lesson : {}) as Record<string, unknown>;
  const lesson = { term: asString(ls.term, 60), explanation: asString(ls.explanation, 420) };
  if (!lesson.term || !checkText("lesson", lesson.explanation)) {
    if (!lesson.term) issues.push({ path: "lesson", problem: "vazio" });
    lesson.term = "";
    lesson.explanation = "";
  }

  const suggestedQuestions = (Array.isArray(obj.suggestedQuestions) ? obj.suggestedQuestions : [])
    .map((q) => asString(q, 140))
    .filter((q) => q && findUngroundedNumbers(q, facts).length === 0)
    .slice(0, 3);

  if (fatal) return { briefing: null, issues, fatal };
  return {
    briefing: { headline, summary, mood, highlightFactIds, positives, negatives, nextStep, lesson, suggestedQuestions },
    issues,
    fatal: false,
  };
}

export class BriefingGenerationError extends Error {
  code = "BRIEFING_UNGROUNDED";
  status = 502;
  readonly issues: BriefingValidationIssue[];
  constructor(message: string, issues: BriefingValidationIssue[]) {
    super(message);
    this.name = "BriefingGenerationError";
    this.issues = issues;
  }
}

export interface BriefingGenerationResult {
  briefing: AIBriefing;
  facts: BriefingFact[];
  issues: BriefingValidationIssue[];
  attempts: number;
  modelUsed: string;
  openAIResponses: OpenAIResponseResult[];
  /** JSON cru da última tentativa (usado pela avaliação de inteligência). */
  rawOutput: unknown;
  /** Problemas da 1ª tentativa (vazio quando acertou de primeira). */
  firstAttemptIssues: BriefingValidationIssue[];
}

/**
 * Gera o informativo. Até 2 tentativas: se a primeira citar números fora da
 * ficha ou vier inutilizável, a segunda recebe os problemas apontados.
 */
export async function generateAIBriefing(params: {
  analytics: FinancialAnalytics;
  profile?: BriefingProfile;
  firstName?: string;
  callModel?: (p: OpenAICallParams) => Promise<OpenAIResponseResult>;
}): Promise<BriefingGenerationResult> {
  const call = params.callModel ?? callOpenAIResponses;
  const facts = buildBriefingFacts(params.analytics);
  const { systemPrompt, prompt } = buildBriefingPrompt({ facts, analytics: params.analytics, profile: params.profile, firstName: params.firstName });
  const responses: OpenAIResponseResult[] = [];
  let feedback = "";
  let last: ReturnType<typeof validateBriefing> | null = null;
  let rawOutput: unknown = null;
  let firstAttemptIssues: BriefingValidationIssue[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await call({
      systemPrompt,
      prompt: feedback ? `${prompt}\n\nA versão anterior foi recusada pela conferência:\n${feedback}\nCorrija usando apenas valores da ficha.` : prompt,
      // Trilho de análise: modelo forte (o chat usa o modelo rápido)
      model: OPENAI_MODELS.OPTIONAL,
      reasoningEffort: "low",
      maxOutputTokens: 4000,
      jsonSchema: AI_BRIEFING_JSON_SCHEMA as unknown as OpenAICallParams["jsonSchema"],
      timeoutMs: 40000,
    });
    responses.push(res);
    try {
      rawOutput = JSON.parse(res.text);
    } catch {
      rawOutput = null;
    }
    last = validateBriefing(rawOutput, facts);
    if (attempt === 1) firstAttemptIssues = last.briefing ? last.issues : [...last.issues, { path: "json", problem: "inutilizável" }];
    const dropped = last.issues.filter((i) => /números fora da ficha|sem fato/.test(i.problem));
    if (last.briefing && dropped.length === 0) break;
    feedback = (last.issues.length ? last.issues : [{ path: "json", problem: "resposta inválida" }])
      .map((i) => `- ${i.path}: ${i.problem}`)
      .join("\n");
    if (last.briefing && attempt === 2) break;
  }

  if (!last?.briefing) {
    throw new BriefingGenerationError("A IA gerou um informativo com valores que não batem com seus dados. Tente novamente.", last?.issues ?? []);
  }

  return {
    briefing: last.briefing,
    facts,
    issues: last.issues,
    attempts: responses.length,
    modelUsed: responses[responses.length - 1]?.modelUsed ?? "",
    openAIResponses: responses,
    rawOutput,
    firstAttemptIssues,
  };
}
