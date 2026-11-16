/**
 * Raciocínio visível do Cofi no chat.
 *
 * Em vez de uma resposta solta, o modelo devolve (JSON estruturado):
 *   1. o que entendeu da pergunta (já ligando com o histórico da conversa);
 *   2. as etapas do raciocínio, cada uma apoiada em fatos do app;
 *   3. a resposta final;
 *   4. os padrões do catálogo que têm a ver com a pergunta;
 *   5. uma pergunta de retorno para continuar a conversa sobre um padrão.
 *
 * Antes de mostrar, o servidor CONFERE: todo número precisa vir dos dados do app
 * (ou de uma conta mostrada no texto, e a conta precisa estar certa). Se algo
 * não bate, o modelo recebe os problemas e refaz uma vez. É isso que impede o
 * raciocínio de "se perder no meio".
 */
import { callOpenAIResponses, type OpenAICallParams, type OpenAIChatMessage, type OpenAIResponseResult } from "./openaiService.ts";
import { extractAmounts } from "./aiBriefingService.ts";
import type { BriefingFact, FactKind } from "./aiBriefingModel.ts";
import type { CofiPattern, PatternMemoryInput } from "./cofiPatterns.ts";

/* ------------------------------------------------------------------ */
/* Contrato                                                            */
/* ------------------------------------------------------------------ */

export const CHAT_REASONING_JSON_SCHEMA = {
  name: "CofiReasonedAnswer",
  strict: true,
  schema: {
    type: "object",
    properties: {
      understanding: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
            factIds: { type: "array", items: { type: "string" } },
          },
          required: ["title", "detail", "factIds"],
          additionalProperties: false,
        },
      },
      answer: { type: "string" },
      patterns: {
        type: "array",
        items: {
          type: "object",
          properties: { key: { type: "string" }, observation: { type: "string" } },
          required: ["key", "observation"],
          additionalProperties: false,
        },
      },
      followUp: {
        type: "object",
        properties: { question: { type: "string" }, patternKey: { type: "string" } },
        required: ["question", "patternKey"],
        additionalProperties: false,
      },
    },
    required: ["understanding", "steps", "answer", "patterns", "followUp"],
    additionalProperties: false,
  },
} as const;

export const REASONING_INSTRUCTIONS = `

=== COMO PENSAR E RESPONDER (FORMATO OBRIGATÓRIO: JSON) ===
Você mostra seu raciocínio para a pessoa acompanhar. Responda SOMENTE com o JSON pedido:
- "understanding": 1 frase com o que você entendeu da pergunta. Em continuações, diga o que veio do histórico (ex.: "Você continua falando da compra de R$ 700, agora para fevereiro.").
- "steps": de 2 a 5 etapas, na ordem em que você pensou. Cada etapa:
  • "title": o que você fez, com verbo (ex.: "Conferi o saldo até o dia 20", "Somei as faturas que vencem antes").
  • "detail": 1 ou 2 frases com os números usados. Se fizer conta, escreva a conta inteira em uma linha (ex.: "R$ 1.200,00 − R$ 450,00 = R$ 750,00"). A conta precisa estar certa: ela é conferida.
  • "factIds": ids da ficha de fatos usados na etapa (pode ser vazio se a etapa usar só o histórico ou outros dados do contexto).
  As etapas precisam levar à resposta sem pular nada: a última etapa conclui o que a resposta diz.
- "answer": a resposta para a pessoa, em markdown, seguindo as regras de estrutura e linguagem acima. Ela precisa bater com as etapas (mesmos valores e mesma conclusão).
- "patterns": padrões da lista PADRÕES IDENTIFICADOS PELO APP que têm relação com a pergunta (use a chave exata), com uma observação curta. Lista vazia se nenhum tiver relação. Nunca crie chave nova.
- "followUp": uma pergunta curta para continuar a conversa.
  • Se um padrão com status "novo" ou "acompanhar" tem a ver com a pergunta (ou com a resposta), pergunte sobre ELE e coloque a chave em "patternKey" (ex.: "Notei 8 compras de iFood este mês. Quer que eu acompanhe esse gasto com você?").
  • Nunca pergunte sobre padrão com status "esperado" ou "ignorado".
  • Sem padrão relevante: uma pergunta útil sobre o próximo passo, com "patternKey" vazio. Se não houver nada útil a perguntar, deixe as duas strings vazias.
REGRA DOS NÚMEROS: todo valor em understanding, steps, answer, patterns e followUp precisa estar nos dados acima ou sair de uma conta mostrada. Não arredonde de um jeito que mude o valor.`;

/* ------------------------------------------------------------------ */
/* Tipos de saída                                                      */
/* ------------------------------------------------------------------ */

export interface ReasoningFactRef {
  id: string;
  label: string;
  value: number;
  kind: FactKind;
}

export interface ReasoningStep {
  title: string;
  detail: string;
  facts: ReasoningFactRef[];
}

export interface ReasoningVerification {
  ok: boolean;
  numbersChecked: number;
  calculationsChecked: number;
  /** Problemas que sobraram após a revisão (mostrados para a pessoa). */
  problems: string[];
}

export interface ReasonedAnswer {
  understanding: string;
  steps: ReasoningStep[];
  answer: string;
  patterns: Array<{ key: string; title: string; observation: string }>;
  followUp: { question: string; patternKey: string; patternTitle: string } | null;
}

export interface ValidationResult {
  output: ReasonedAnswer | null;
  /** Problemas que pedem refazer (números sem origem, contas erradas, JSON inválido). */
  blocking: string[];
  /** Ajustes feitos sem refazer (ids inválidos removidos etc.). */
  notes: string[];
  numbersChecked: number;
  calculationsChecked: number;
}

/* ------------------------------------------------------------------ */
/* Números: de onde podem vir                                          */
/* ------------------------------------------------------------------ */

/** Extrai números de textos em pt-BR ("1.234,56") e do formato toFixed ("1234.56"). */
export function extractAllNumberForms(text: string): number[] {
  const out = extractAmounts(text);
  const re = /\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseFloat(m[0]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Conjunto de valores permitidos: tudo que o app entregou ao modelo. */
export function collectAllowedNumbers(sources: string[], facts: BriefingFact[] = []): number[] {
  const set = new Set<number>();
  for (const s of sources) for (const n of extractAllNumberForms(s || "")) set.add(Math.abs(Math.round(n * 100) / 100));
  for (const f of facts) set.add(Math.abs(Math.round(f.value * 100) / 100));
  return [...set];
}

export function isAllowedNumber(n: number, allowed: number[]): boolean {
  const m = Math.abs(n);
  if (Number.isInteger(m) && m <= 31) return true; // dias, parcelas, quantidades
  if (Number.isInteger(m) && m >= 2020 && m <= 2040) return true; // anos
  if (m === 100) return true; // "100%"
  return allowed.some((v) => Math.abs(m - v) <= Math.max(0.01, v * 0.005) || Math.abs(m - Math.round(v)) < 0.01);
}

/* ------------------------------------------------------------------ */
/* Contas escritas no texto                                            */
/* ------------------------------------------------------------------ */

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?`;
const TERM = String.raw`(?:R\$\s*)?(?:${NUM})%?`;
const OP = String.raw`(?:\s*[+\-−–×*÷/]\s*|\s+x\s+)`;
const CALC_RE = new RegExp(String.raw`(${TERM}(?:${OP}${TERM})+)\s*=\s*(-?\s*${TERM})`, "g");

function parsePtNumber(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

/** Avalia "a + b − c × d" com precedência normal. Devolve null se não entender. */
export function evaluateExpression(expr: string): number | null {
  const norm = expr.replace(/[−–]/g, "-").replace(/×/g, "*").replace(/\s+x\s+/g, " * ").replace(/÷/g, "/");
  const tokenRe = new RegExp(String.raw`(?:R\$\s*)?(${NUM})(%?)|([-+*/])`, "g");
  const nums: number[] = [];
  const ops: string[] = [];
  let expectNumber = true;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(norm)) !== null) {
    if (m[1] !== undefined) {
      if (!expectNumber) return null;
      let v = parsePtNumber(m[1]);
      if (m[2]) v = v / 100;
      nums.push(v);
      expectNumber = false;
    } else {
      if (expectNumber) return null;
      ops.push(m[3]);
      expectNumber = true;
    }
  }
  if (expectNumber || nums.length < 2 || ops.length !== nums.length - 1) return null;
  // Primeiro × e ÷, depois + e −
  const n2 = [nums[0]];
  const o2: string[] = [];
  ops.forEach((op, i) => {
    const next = nums[i + 1];
    if (op === "*") n2[n2.length - 1] *= next;
    else if (op === "/") {
      if (next === 0) n2[n2.length - 1] = NaN;
      else n2[n2.length - 1] /= next;
    } else {
      o2.push(op);
      n2.push(next);
    }
  });
  let total = n2[0];
  o2.forEach((op, i) => {
    total = op === "+" ? total + n2[i + 1] : total - n2[i + 1];
  });
  return Number.isFinite(total) ? total : null;
}

export interface CalculationCheck {
  expression: string;
  stated: number;
  expected: number;
  ok: boolean;
}

/** Encontra contas "a − b = c" no texto e confere cada uma. */
export function verifyCalculations(text: string): CalculationCheck[] {
  const out: CalculationCheck[] = [];
  CALC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CALC_RE.exec(text)) !== null) {
    const expected = evaluateExpression(m[1]);
    const rhsRaw = m[2].replace(/\s+/g, "");
    const negative = rhsRaw.startsWith("-");
    const numMatch = rhsRaw.match(new RegExp(NUM));
    if (expected === null || !numMatch) continue;
    let stated = parsePtNumber(numMatch[0]) * (negative ? -1 : 1);
    if (rhsRaw.endsWith("%")) stated = stated / 100;
    const ok = Math.abs(expected - stated) <= Math.max(0.05, Math.abs(stated) * 0.005);
    out.push({ expression: m[0].trim(), stated, expected, ok });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Conferência                                                         */
/* ------------------------------------------------------------------ */

const brlText = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Remove o que parece número mas não é valor: ids de fatos, datas, horas. */
function stripNonValues(text: string): string {
  return text
    .replace(/\b[a-z_]+_\d+\b/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}[:h]\d{2}\b/g, " ")
    .replace(/\b\d{1,2}ª|\b\d{1,2}º/g, " ");
}

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function validateReasonedAnswer(
  raw: unknown,
  ctx: { facts: BriefingFact[]; allowed: number[]; catalog: CofiPattern[]; memory: PatternMemoryInput[] }
): ValidationResult {
  const notes: string[] = [];
  const blocking: string[] = [];
  if (!raw || typeof raw !== "object") return { output: null, blocking: ["A resposta não veio no formato combinado (JSON)."], notes, numbersChecked: 0, calculationsChecked: 0 };
  const r = raw as Record<string, unknown>;

  const answer = str(r.answer);
  if (!answer) return { output: null, blocking: ['O campo "answer" veio vazio.'], notes, numbersChecked: 0, calculationsChecked: 0 };

  const factById = new Map(ctx.facts.map((f) => [f.id, f]));
  const steps: ReasoningStep[] = (Array.isArray(r.steps) ? r.steps : []).slice(0, 6).flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const st = s as Record<string, unknown>;
    const title = str(st.title, 160);
    const detail = str(st.detail, 600);
    if (!title && !detail) return [];
    const ids = Array.isArray(st.factIds) ? st.factIds.filter((x): x is string => typeof x === "string") : [];
    const facts = ids.flatMap((id) => {
      const f = factById.get(id);
      if (!f) {
        notes.push(`Etapa "${title}": o fato "${id}" não existe e foi removido.`);
        return [];
      }
      return [{ id: f.id, label: f.label, value: f.value, kind: f.kind }];
    });
    return [{ title, detail, facts }];
  });
  if (steps.length === 0) blocking.push('Faltaram as etapas do raciocínio ("steps").');

  const catalogByKey = new Map(ctx.catalog.map((p) => [p.key, p]));
  const statusByKey = new Map(ctx.memory.map((m) => [m.key, m.status]));
  const patterns = (Array.isArray(r.patterns) ? r.patterns : []).slice(0, 5).flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const key = str((p as Record<string, unknown>).key, 80);
    const item = catalogByKey.get(key);
    if (!item) {
      if (key) notes.push(`Padrão "${key}" não está no catálogo e foi removido.`);
      return [];
    }
    if (statusByKey.get(key) === "ignorado") return [];
    return [{ key, title: item.title, observation: str((p as Record<string, unknown>).observation, 300) }];
  });

  let followUp: ReasonedAnswer["followUp"] = null;
  if (r.followUp && typeof r.followUp === "object") {
    const fu = r.followUp as Record<string, unknown>;
    const question = str(fu.question, 300);
    let patternKey = str(fu.patternKey, 80);
    if (patternKey && !catalogByKey.has(patternKey)) {
      notes.push(`Pergunta de retorno citava o padrão inexistente "${patternKey}".`);
      patternKey = "";
    }
    const status = patternKey ? statusByKey.get(patternKey) : undefined;
    // Regra do app, não da IA: nunca voltar a perguntar o que a pessoa descartou.
    if (status === "esperado" || status === "ignorado") {
      notes.push(`Pergunta sobre "${patternKey}" removida: a pessoa já disse que é ${status}.`);
    } else if (question) {
      followUp = { question, patternKey, patternTitle: patternKey ? catalogByKey.get(patternKey)!.title : "" };
    }
  }

  const understanding = str(r.understanding, 400);

  // Conferência dos números e das contas em tudo que a pessoa vai ler
  const texts = [understanding, ...steps.map((s) => `${s.title}. ${s.detail}`), answer, ...patterns.map((p) => p.observation), followUp?.question ?? ""];
  const calcs = texts.flatMap(verifyCalculations);
  const allowed = [...ctx.allowed];
  for (const c of calcs) {
    if (c.ok) allowed.push(Math.abs(Math.round(c.stated * 100) / 100));
    else blocking.push(`Conta errada: "${c.expression}". O resultado certo é ${Math.abs(c.expected) < 1 && c.expression.includes("%") ? `${(c.expected * 100).toFixed(1)}%` : brlText(c.expected)}.`);
  }
  let numbersChecked = 0;
  const ungrounded = new Set<string>();
  for (const t of texts) {
    for (const n of extractAmounts(stripNonValues(t))) {
      numbersChecked++;
      if (!isAllowedNumber(n, allowed)) ungrounded.add(n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
    }
  }
  for (const n of ungrounded) blocking.push(`O valor ${n} não aparece nos dados do app nem sai de uma conta mostrada.`);

  return {
    output: { understanding, steps, answer, patterns, followUp },
    blocking,
    notes,
    numbersChecked,
    calculationsChecked: calcs.length,
  };
}

/* ------------------------------------------------------------------ */
/* Execução com etapas visíveis                                        */
/* ------------------------------------------------------------------ */

export type PipelineStepId = "contexto" | "linha_do_tempo" | "padroes" | "pensando" | "conferindo";
export interface PipelineStep {
  id: PipelineStepId;
  title: string;
  status: "running" | "done" | "warning";
  detail?: string;
}

export class ReasoningFailedError extends Error {
  code = "REASONING_UNUSABLE";
  status = 502;
  constructor(message: string) {
    super(message);
    this.name = "ReasoningFailedError";
  }
}

export interface ReasonedChatResult {
  output: ReasonedAnswer;
  verification: ReasoningVerification;
  attempts: number;
  modelUsed: string;
  responses: OpenAIResponseResult[];
}

/**
 * Chama o modelo, confere e, se algo não bate, refaz uma vez com os problemas
 * apontados. Se a segunda versão ainda tiver um valor sem origem, a resposta
 * sai mesmo assim, com o aviso visível (não trava a conversa).
 */
export async function runReasonedChat(params: {
  systemPrompt: string;
  messages: OpenAIChatMessage[];
  facts: BriefingFact[];
  catalog: CofiPattern[];
  memory: PatternMemoryInput[];
  /** Textos de onde números podem vir (contexto, perguntas da pessoa, simulação). */
  allowedSources: string[];
  onStep?: (step: PipelineStep) => void;
  call?: (p: OpenAICallParams) => Promise<OpenAIResponseResult>;
  /** Não tenta a revisão se já passou desse tempo (limite da função na Vercel). */
  retryBudgetMs?: number;
}): Promise<ReasonedChatResult> {
  const call = params.call ?? callOpenAIResponses;
  const started = Date.now();
  const allowed = collectAllowedNumbers([params.systemPrompt, ...params.allowedSources], params.facts);
  const systemPrompt = params.systemPrompt + REASONING_INSTRUCTIONS;
  const responses: OpenAIResponseResult[] = [];
  let messages = params.messages;
  let last: ValidationResult | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    params.onStep?.({
      id: "pensando",
      title: attempt === 1 ? "Montando o raciocínio" : "Refazendo o raciocínio",
      status: "running",
      detail: attempt === 1 ? "Lendo sua pergunta e o que já conversamos" : "Corrigindo o que não bateu na conferência",
    });
    const res = await call({
      systemPrompt,
      messages,
      reasoningEffort: "none",
      maxOutputTokens: 2400,
      jsonSchema: CHAT_REASONING_JSON_SCHEMA as unknown as OpenAICallParams["jsonSchema"],
      timeoutMs: 25000,
    });
    responses.push(res);
    let raw: unknown = null;
    try {
      raw = JSON.parse(res.text);
    } catch {
      raw = null;
    }
    const result = validateReasonedAnswer(raw, { facts: params.facts, allowed, catalog: params.catalog, memory: params.memory });
    // Uma versão utilizável nunca é trocada por uma pior
    if (result.output || !last?.output) last = result;
    params.onStep?.({
      id: "pensando",
      title: attempt === 1 ? "Montando o raciocínio" : "Refazendo o raciocínio",
      status: "done",
      detail: result.output ? `${result.output.steps.length} etapas` : "Resposta fora do formato",
    });

    params.onStep?.({ id: "conferindo", title: "Conferindo valores e contas", status: "running" });
    const canRetry = attempt === 1 && Date.now() - started < (params.retryBudgetMs ?? 28000);
    if (result.output && result.blocking.length === 0) {
      params.onStep?.({
        id: "conferindo",
        title: "Conferindo valores e contas",
        status: "done",
        detail: checkedLabel(result),
      });
      break;
    }
    if (!canRetry) {
      params.onStep?.({ id: "conferindo", title: "Conferindo valores e contas", status: "warning", detail: `${result.blocking.length} ponto(s) não conferem` });
      break;
    }
    params.onStep?.({
      id: "conferindo",
      title: "Conferindo valores e contas",
      status: "warning",
      detail: `${result.blocking.length} ponto(s) não bateram; vou refazer`,
    });
    messages = [
      ...params.messages,
      { role: "assistant", content: res.text.slice(0, 6000) },
      {
        role: "user",
        content: `[Conferência automática do app, não é a pessoa falando] Sua resposta anterior foi recusada:\n${result.blocking.map((b) => `- ${b}`).join("\n")}\nRefaça o JSON inteiro respondendo à mesma pergunta. Use só valores dos dados e confira cada conta.`,
      },
    ];
  }

  if (!last?.output) throw new ReasoningFailedError("O Cofi se perdeu ao montar a resposta. Tente perguntar de novo.");
  return {
    output: last.output,
    verification: {
      ok: last.blocking.length === 0,
      numbersChecked: last.numbersChecked,
      calculationsChecked: last.calculationsChecked,
      problems: last.blocking.slice(0, 5),
    },
    attempts: responses.length,
    modelUsed: responses[responses.length - 1]?.modelUsed ?? "",
    responses,
  };
}

function checkedLabel(r: ValidationResult): string {
  const parts = [`${r.numbersChecked} ${r.numbersChecked === 1 ? "valor conferido" : "valores conferidos"}`];
  if (r.calculationsChecked) parts.push(`${r.calculationsChecked} ${r.calculationsChecked === 1 ? "conta certa" : "contas certas"}`);
  return parts.join(" · ");
}
