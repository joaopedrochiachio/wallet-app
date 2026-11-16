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
import type { SafeFinancialContext } from "./financialContextService.ts";
import { callOpenAIResponses, type OpenAICallParams, type OpenAIResponseResult } from "./openaiService.ts";

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

function daysLeftInMonth(now: Date): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, last - now.getDate() + 1);
}

/** Ficha de fatos: tudo que a IA pode citar. Fatos sem dado real ficam de fora. */
export function buildBriefingFacts(context: SafeFinancialContext, now: Date = new Date(), options: { incomeKnown?: boolean } = {}): BriefingFact[] {
  const incomeKnown = options.incomeKnown ?? true;
  const facts: BriefingFact[] = [];
  const add = (id: string, label: string, value: unknown, kind: FactKind, note?: string) => {
    if (!finite(value)) return;
    facts.push({ id, label, value: kind === "percent" ? Math.round(value * 10) / 10 : round2(value), kind, note });
  };

  const { cashflow, credit, commitments, target, profile, liquidityAnalysis } = context;
  const current = context.monthlyProjections?.[0];
  const next = liquidityAnalysis?.nextMonth;
  const nextProjection = context.monthlyProjections?.[1];
  const daysLeft = daysLeftInMonth(now);

  add("saldo_conta", "Saldo hoje na conta", cashflow.checkingBalance, "brl");
  add("entradas_mes", "Entradas recebidas no mês", cashflow.monthIncomeRealized, "brl");
  add("saidas_mes", "Saídas pagas no mês (conta)", cashflow.monthExpenseRealized, "brl");
  add("sobra_mes", "Sobra do mês até agora (entradas − saídas)", cashflow.netCashflow, "brl");
  if (cashflow.monthIncomeRealized > 0) add("taxa_poupanca", "Parte da renda que sobrou no mês", cashflow.savingsRatePercent, "percent");
  if (incomeKnown && profile.monthlyIncomeBase > 0) add("renda_base", "Renda mensal informada", profile.monthlyIncomeBase, "brl");

  add("saldo_projetado", "Saldo previsto no fim do mês", target.projectedEndMonthBalance, "brl", "já desconta contas e faturas que ainda vão vencer neste mês");
  add("meta_mes", "Meta de saldo para fechar o mês", target.targetEndMonthBalance, "brl");
  if (target.targetStatus === "on_track") {
    add("margem_segura", "Quanto ainda dá para gastar sem furar a meta", target.safeSpendingMargin, "brl");
    add("margem_diaria", "Gasto livre por dia até o fim do mês", target.safeSpendingMargin / daysLeft, "brl");
    add("margem_semanal", "Gasto livre por semana até o fim do mês", (target.safeSpendingMargin / daysLeft) * 7, "brl");
  } else {
    add("falta_meta", "Quanto falta para alcançar a meta", target.missingAmount, "brl");
    add("corte_diario", "Corte por dia necessário para alcançar a meta", target.missingAmount / daysLeft, "brl");
    add("corte_semanal", "Corte por semana necessário para alcançar a meta", (target.missingAmount / daysLeft) * 7, "brl");
  }
  add("dias_restantes", "Dias até o fim do mês", daysLeft, "days");

  add("contas_pendentes", "Contas e faturas que ainda vencem no mês", current?.pendingCommitted ?? liquidityAnalysis?.currentMonth.pendingBills, "brl");
  if (current?.totalInvoicesPending !== undefined) add("faturas_pendentes", "Faturas de cartão ainda a pagar no mês", current.totalInvoicesPending, "brl");

  if (credit.totalLimit > 0) {
    add("limite_total", "Limite total dos cartões", credit.totalLimit, "brl");
    add("limite_usado", "Limite já comprometido", credit.totalSpent, "brl", "inclui parcelas que vencem em meses futuros");
    add("limite_disponivel", "Limite disponível", credit.availableCredit, "brl");
    add("limite_uso_pct", "Uso do limite dos cartões", credit.creditUtilizationPercent, "percent", "acima de 30% já pesa; acima de 80% deixa pouca folga para imprevistos");
  }

  if (commitments.recurringCount > 0) {
    add("fixos_mes", "Contas fixas do mês ainda a pagar", commitments.recurringMonthlyTotal, "brl");
    add("fixos_qtd", "Quantidade de contas fixas a pagar", commitments.recurringCount, "count");
  }
  if (incomeKnown && profile.monthlyIncomeBase > 0) {
    add("compromisso_pct", "Parte da renda já comprometida no mês", commitments.commitmentRatioPercent, "percent");
    add("compromisso_teto_pct", "Teto de comprometimento escolhido pela pessoa", profile.maxCommitmentAlertPercent, "percent");
    const excess = ((commitments.commitmentRatioPercent - profile.maxCommitmentAlertPercent) / 100) * profile.monthlyIncomeBase;
    if (excess > 0) add("excesso_compromisso", "Quanto as contas comprometidas passam do teto escolhido, por mês", excess, "brl", "é quanto precisaria sair dos custos fixos para voltar ao teto");
  }

  if (nextProjection || next) {
    const name = nextProjection?.monthName ?? next!.monthName;
    add("proximo_mes_saldo", `Saldo previsto em ${name}`, nextProjection?.projectedFreeBalance ?? next!.projectedFreeBalance, "brl", "considera só o que já está agendado; gastos do dia a dia vêm a mais");
    const installments = nextProjection?.cardInstallments ?? next?.cardInstallments ?? 0;
    if (installments > 0) add("proximo_mes_parcelas", `Parcelas de cartão que caem em ${name}`, installments, "brl");
  }
  if (context.historicalVariableBaseline > 0) add("gasto_variavel_medio", "Gasto variável médio por mês", context.historicalVariableBaseline, "brl");

  const monthlyBurn = commitments.recurringMonthlyTotal + context.historicalVariableBaseline;
  // Só calcula o fôlego com renda conhecida e custo mensal relevante (evita "19 meses" com 1 lançamento).
  if (incomeKnown && monthlyBurn >= profile.monthlyIncomeBase * 0.2 && cashflow.checkingBalance > 0) {
    add("folego_meses", "Meses que o saldo atual cobre sem nova renda", cashflow.checkingBalance / monthlyBurn, "months", "reserva de emergência saudável cobre de 3 a 6 meses");
  }

  context.categories.slice(0, 3).forEach((c, i) => {
    add(`categoria_${i + 1}`, `Gasto em ${c.category}`, c.total, "brl", `${c.count} lançamentos`);
    add(`categoria_${i + 1}_pct`, `Peso de ${c.category} nos gastos`, c.percentage, "percent");
  });
  (context.lifestyleHabits || []).filter((h) => h.count >= 2).slice(0, 2).forEach((h, i) => {
    add(`habito_${i + 1}`, `Hábito: ${h.habitName}`, h.total, "brl", `${h.count} compras, ex.: ${h.examples.slice(0, 2).join(", ")}`);
    add(`habito_${i + 1}_qtd`, `Compras do hábito ${h.habitName}`, h.count, "count");
    add(`habito_${i + 1}_metade`, `Economia se cortar metade do hábito ${h.habitName}`, h.total / 2, "brl");
  });
  context.goals.slice(0, 3).forEach((g, i) => {
    add(`meta_${i + 1}_progresso`, `Progresso da ${g.alias}`, g.progressPercent, "percent", g.deadline ? `prazo ${g.deadline}` : undefined);
    add(`meta_${i + 1}_falta`, `Quanto falta para a ${g.alias}`, g.gap, "brl");
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
        description: "De 0 a 3 pontos que pedem atenção, do mais grave para o menos grave.",
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
}

/**
 * Sinais calculados em TypeScript a partir da ficha: dizem à IA O QUE é grave.
 * A IA continua escrevendo tudo, mas não precisa adivinhar a gravidade.
 */
export function buildBriefingSignals(facts: BriefingFact[], context: SafeFinancialContext): BriefingSignal[] {
  const v = (id: string) => facts.find((f) => f.id === id)?.value;
  const has = (id: string) => facts.some((f) => f.id === id);
  const out: BriefingSignal[] = [];
  const projected = v("saldo_projetado");
  const target = v("meta_mes") ?? 0;

  if (projected !== undefined && projected < 0) out.push({ level: "critico", text: "O mês fecha NEGATIVO se nada mudar.", factIds: ["saldo_projetado", "falta_meta"] });
  else if (has("falta_meta") && target > 0 && (v("falta_meta") ?? 0) >= target * 0.5) out.push({ level: "critico", text: "O mês fecha muito abaixo da meta.", factIds: ["falta_meta", "saldo_projetado"] });
  else if (has("falta_meta")) out.push({ level: "atencao", text: "A meta do mês está em risco.", factIds: ["falta_meta", "corte_diario"] });

  const pending = v("contas_pendentes") ?? 0;
  const balance = v("saldo_conta") ?? 0;
  if (pending > 0 && pending > balance) out.push({ level: "critico", text: "Contas e faturas pendentes são maiores que o saldo de hoje.", factIds: ["contas_pendentes", "saldo_conta"] });

  const usage = v("limite_uso_pct");
  if (usage !== undefined && usage >= 80) out.push({ level: "atencao", text: "Uso do limite do cartão muito alto: sobra pouca folga para imprevistos.", factIds: ["limite_uso_pct", "limite_disponivel"] });
  const nextInstallments = v("proximo_mes_parcelas");
  const income = v("renda_base") ?? 0;
  if (nextInstallments !== undefined && income > 0 && nextInstallments >= income * 0.25) {
    out.push({ level: "atencao", text: "As parcelas de cartão do próximo mês pesam na renda (mais de um quarto).", factIds: ["proximo_mes_parcelas", "proximo_mes_saldo"] });
  }

  const commitment = v("compromisso_pct");
  const ceiling = v("compromisso_teto_pct");
  if (commitment !== undefined && ceiling !== undefined && commitment > ceiling) {
    out.push({ level: "atencao", text: "A renda comprometida com contas fixas passou do teto escolhido pela pessoa.", factIds: ["compromisso_pct", "compromisso_teto_pct", "fixos_mes"] });
  }
  if (has("habito_1")) out.push({ level: "atencao", text: "Há um hábito de consumo que se repete no mês; vale mostrar o total e o número de compras.", factIds: ["habito_1", "habito_1_qtd"] });

  const entries = context.categories.reduce((n, c) => n + c.count, 0);
  if (!has("renda_base") || entries < 3) {
    out.push({ level: "poucos_dados", text: "POUCOS DADOS: há poucos lançamentos ou a renda não foi informada. Não tire conclusões fortes; oriente a registrar renda, contas e gastos no app.", factIds: [] });
  }

  // Pontos a favor existem mesmo com riscos de atenção (só não num mês crítico)
  if (!out.some((s) => s.level === "critico")) {
    if (has("margem_segura")) out.push({ level: "positivo", text: "A meta do mês está garantida com folga.", factIds: ["margem_segura", "margem_diaria"] });
    if ((v("taxa_poupanca") ?? 0) >= 20) out.push({ level: "positivo", text: "A pessoa está guardando uma boa parte da renda.", factIds: ["taxa_poupanca", "sobra_mes"] });
  }
  return out.map((s) => ({ ...s, factIds: s.factIds.filter(has) }));
}

/** Humor que os sinais indicam (a IA recebe como referência obrigatória). */
export function moodFromSignals(signals: BriefingSignal[]): BriefingMood {
  if (signals.some((s) => s.level === "critico")) return "critico";
  if (signals.some((s) => s.level === "atencao")) return "atencao";
  if (signals.some((s) => s.level === "poucos_dados")) return "neutro";
  return "positivo";
}

export function formatSignals(signals: BriefingSignal[]): string {
  if (!signals.length) return "- Nenhum sinal de risco calculado.";
  const label: Record<SignalLevel, string> = { critico: "CRÍTICO", atencao: "ATENÇÃO", positivo: "A FAVOR", poucos_dados: "DADOS" };
  return signals.map((s) => `- [${label[s.level]}] ${s.text}${s.factIds.length ? ` (fatos: ${s.factIds.join(", ")})` : ""}`).join("\n");
}

/** Bloco que o chat recebe: mesma ficha e mesmos sinais do informativo, para não inventar contas. */
export function buildChatFactBlock(context: SafeFinancialContext, options: { incomeKnown?: boolean; now?: Date } = {}): string {
  // A ficha é um reforço: com contexto incompleto, o chat segue sem ela em vez de quebrar.
  if (!context?.target || !context.cashflow || !context.credit || !context.commitments || !context.profile) return "";
  let facts: BriefingFact[];
  try {
    facts = buildBriefingFacts(context, options.now, { incomeKnown: options.incomeKnown });
  } catch {
    return "";
  }
  return `

=== FICHA DE FATOS CALCULADOS PELO APP (USE ESTES VALORES) ===
Quando a pergunta envolver um destes números (ex.: quanto gastar por dia, quanto falta, quanto vence), cite o valor da ficha exatamente como está, em vez de recalcular.
${buildBriefingFactSheet(facts)}

=== SINAIS DE RISCO CALCULADOS ===
${formatSignals(buildBriefingSignals(facts, context))}
`;
}

export function buildBriefingPrompt(params: { facts: BriefingFact[]; context: SafeFinancialContext; firstName?: string }): { systemPrompt: string; prompt: string } {
  const { facts, context } = params;
  const signals = buildBriefingSignals(facts, context);
  const toneGuide = {
    analytical: "Tom analítico: números em destaque e raciocínio em passos.",
    direct: "Tom direto: conclusão primeiro, sem rodeios.",
    collaborative: "Tom acolhedor: reconheça o esforço e explique com calma.",
  }[context.profile.aiTone] ?? "Tom direto e acolhedor.";

  const systemPrompt = `Você é ${ASSISTANT_NAME}, o assistente financeiro do app Wallet+. Você escreve o informativo do dia: curto, direto e didático, como o resumo de um banco digital que explica a vida financeira para quem não é especialista.

COMO ESCREVER
- Português do Brasil, frases curtas (até 20 palavras), sem jargão. Se usar um termo técnico, explique na mesma frase.
- Cada ponto responde três coisas:
  • title: o que está acontecendo, em até 8 palavras.
  • explanation: o EFEITO na vida da pessoa, não a repetição do número. Cite o número e diga o que ele significa, usando "isso significa que", "ou seja" ou "na prática". Ex.: "Você usa 93% do limite. Na prática, uma emergência no cartão pode não passar."
  • action: começa com verbo no imperativo e diz quanto, quando ou onde. Ex.: "Segure R$ 40 por dia até o dia 30".
- "nextStep": a ação mais importante de todas. O title começa com verbo e o title ou o detail traz um valor da ficha ou um prazo (hoje, esta semana, até o dia X).
- ${toneGuide}

REGRA DE OURO DOS NÚMEROS
- Use SOMENTE valores da ficha de fatos abaixo, escritos como aparecem (ex.: R$ 1.234,56 ou 45%). Não faça contas novas, não arredonde de outro jeito e não invente valores.
- Liste em evidenceFactIds os ids dos fatos que sustentam cada ponto. Todo ponto precisa de pelo menos um fato.
- Se um assunto não tem fato na ficha, não fale dele.

COMO JULGAR (os SINAIS calculados pelo app são a verdade sobre a gravidade)
- "mood": use exatamente o HUMOR INDICADO PELOS SINAIS (critico se há [CRÍTICO]; atencao se há [ATENÇÃO]; neutro se só há [DADOS]; positivo nos demais casos).
- Cada sinal [CRÍTICO] ou [ATENÇÃO] vira um ponto em "negatives", usando os fatos indicados. Ordem: críticos primeiro (severity "alta"), depois atenção (severity "media"); "baixa" só para detalhes menores.
- Um mês saudável no caixa ainda pode ter riscos (cartão no limite, parcelas pesadas no mês seguinte): siga os sinais, não só o saldo de hoje.
- Contas já pagas são histórico: não trate como dívida. Gasto no cartão pesa no mês da fatura, não no mês da compra.
- Não invente pontos negativos sem sinal. Se há sinal [DADOS], diga que faltam informações e oriente a registrar renda e gastos no app, sem palavras de alarme (estourar, crise, perigo, vermelho).
- Toda "action" de um ponto de atenção traz um valor DA FICHA (ex.: corte_diario, corte_semanal, margem_diaria, margem_semanal, habito_1_metade, excesso_compromisso, limite_disponivel) ou um prazo explícito (hoje, esta semana, até o dia X). "Reduza gastos" sozinho não serve. NUNCA crie um valor que não está na ficha: se não houver valor adequado, use um prazo.
- Exemplos de "nextStep.title" bons: "Segure R$ 79,88 por dia até o fim do mês", "Registre seus gastos desta semana até domingo", "Pague a fatura de dezembro antes de novas compras".
- "positives": o que está realmente a favor (sinais [A FAVOR] ou fatos bons da ficha). Pode ficar vazio num mês ruim.
- "lesson": um conceito financeiro ligado à situação da pessoa (ex.: margem de segurança, fatura vs. limite, reserva de emergência), explicado em 2 frases simples com o número dela quando houver.
- "suggestedQuestions": 3 perguntas que a pessoa faria sobre os próprios números. TODAS as 3 contêm "eu", "meu", "minha", "meus" ou "minhas" (ex.: "Quanto eu posso gastar por dia?", "Qual das minhas contas vence primeiro?").`;

  const prompt = `${params.firstName ? `Nome da pessoa: ${params.firstName}.\n` : ""}Foco declarado: ${context.profile.primaryFocus || "não informado"}.

FICHA DE FATOS (id | descrição: valor)
${buildBriefingFactSheet(facts)}

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
    list.slice(0, 3).forEach((item, i) => {
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
  context: SafeFinancialContext;
  firstName?: string;
  now?: Date;
  /** false quando a renda não foi informada (o contexto usa um valor padrão). */
  incomeKnown?: boolean;
  callModel?: (p: OpenAICallParams) => Promise<OpenAIResponseResult>;
}): Promise<BriefingGenerationResult> {
  const call = params.callModel ?? callOpenAIResponses;
  const facts = buildBriefingFacts(params.context, params.now, { incomeKnown: params.incomeKnown });
  const { systemPrompt, prompt } = buildBriefingPrompt({ facts, context: params.context, firstName: params.firstName });
  const responses: OpenAIResponseResult[] = [];
  let feedback = "";
  let last: ReturnType<typeof validateBriefing> | null = null;
  let rawOutput: unknown = null;
  let firstAttemptIssues: BriefingValidationIssue[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await call({
      systemPrompt,
      prompt: feedback ? `${prompt}\n\nA versão anterior foi recusada pela conferência:\n${feedback}\nCorrija usando apenas valores da ficha.` : prompt,
      reasoningEffort: "low",
      maxOutputTokens: 2200,
      jsonSchema: AI_BRIEFING_JSON_SCHEMA as unknown as OpenAICallParams["jsonSchema"],
      timeoutMs: 30000,
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
