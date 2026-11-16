/**
 * Notas da avaliação de inteligência, em 5 níveis cumulativos:
 *  N1 Integridade  — JSON válido, só fatos existentes, nenhum número inventado.
 *  N2 Leitura      — entendeu a situação (humor certo, citou os fatos-chave, sem leitura errada).
 *  N3 Prioridade   — colocou o risco certo em primeiro, com a gravidade certa; chat com o veredito certo.
 *  N4 Didática     — frases curtas, explica o porquê, ensina um conceito.
 *  N5 Ação         — cada alerta vira uma ação concreta (verbo + valor/prazo) e as perguntas sugeridas são da pessoa.
 * O nível alcançado é o maior N em que todos os níveis até ele têm nota ≥ 90%.
 */
import {
  type AIBriefing,
  type BriefingFact,
  validateBriefing,
  findUngroundedNumbers,
  extractAmounts,
} from "../../lib/services/aiBriefingService.ts";
import type { ChatProbe, EvalScenario } from "./scenarios.ts";

export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVEL_NAMES: Record<Level, string> = {
  1: "Integridade",
  2: "Leitura correta",
  3: "Prioridade",
  4: "Didática",
  5: "Ação concreta",
};

export interface Check {
  level: Level;
  name: string;
  pass: boolean;
  detail?: string;
}

const words = (t: string) => t.split(/\s+/).filter(Boolean);
const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => words(s).length > 0);
// \b não funciona com letras acentuadas em JS ("você"); usa limites de letra Unicode.
const CONSEQUENCE = /(?<!\p{L})(isso|significa|porque|pois|ou seja|na prática|assim|então|com isso|por isso|para você|vai|pode|deixa|sobra|falta|precisa|evita|garante|ajuda|corre o risco)(?!\p{L})/iu;
const CONCRETE = /(R\$|\d|%|(?<!\p{L})(dia|dias|mês|hoje|amanhã|agora|imediatamente|domingo|segunda|terça|quarta|quinta|sexta|sábado)(?!\p{L})|semana|até o|próxim|fatura|vencimento)/iu;
const NON_VERBS = new Set(["a", "o", "as", "os", "uma", "um", "esta", "essa", "este", "esse", "se", "sua", "seu", "nesta", "neste", "para", "com", "sem", "de", "da", "do", "na", "no", "e", "que", "mas", "voce", "você", "isso", "ate", "até", "hoje"]);

/** Heurística de imperativo em português: "Separe", "Segure", "Pague", "Mantenha", "Faça", "Dê"... */
export function startsWithImperative(text: string): boolean {
  const rawFirst = (text.trim().split(/[\s,:]+/)[0] || "").replace(/^\*+|\*+$/g, "").toLowerCase();
  if (["dê", "vá", "faça", "pôr", "põe"].includes(rawFirst)) return true;
  const first = rawFirst.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!first || NON_VERBS.has(first) || first.length < 2) return false;
  if (["va", "faca", "ponha", "traga", "diga", "tenha", "veja", "siga", "leia", "peca", "abra"].includes(first)) return true;
  return /(e|a|ie|ue|em)$/.test(first) && !/(cao|mente|dade|agem)$/.test(first);
}

function allText(b: AIBriefing): string {
  return [
    b.headline,
    b.summary,
    ...b.positives.flatMap((p) => [p.title, p.explanation, p.action]),
    ...b.negatives.flatMap((p) => [p.title, p.explanation, p.action]),
    b.nextStep.title,
    b.nextStep.detail,
    b.lesson.explanation,
  ].join(" \n ");
}

export function gradeBriefing(params: {
  scenario: EvalScenario;
  facts: BriefingFact[];
  rawOutput: unknown;
  briefing: AIBriefing | null;
  attempts: number;
  error?: string;
  firstAttemptIssues?: Array<{ path: string; problem: string }>;
}): Check[] {
  const { scenario, facts, rawOutput } = params;
  const checks: Check[] = [];
  const exp = scenario.expect;

  // ---------- N1 Integridade ----------
  const firstTry = validateBriefing(rawOutput, facts);
  checks.push({ level: 1, name: "informativo gerado", pass: Boolean(params.briefing), detail: params.error });
  const generated = rawOutput !== null && typeof rawOutput === "object";
  const invented = firstTry.issues.filter((i) => /números fora da ficha/.test(i.problem));
  checks.push({ level: 1, name: "nenhum número inventado", pass: generated && invented.length === 0, detail: invented.map((i) => `${i.path}: ${i.problem}`).join("; ") });
  const badIds = firstTry.issues.filter((i) => /fatos inexistentes|sem fato/.test(i.problem));
  checks.push({ level: 1, name: "só cita fatos existentes", pass: generated && badIds.length === 0, detail: badIds.map((i) => `${i.path}: ${i.problem}`).join("; ") });
  checks.push({ level: 1, name: "certo de primeira", pass: params.attempts === 1, detail: (params.firstAttemptIssues ?? []).map((i) => `${i.path}: ${i.problem}`).join("; ") });

  const b = params.briefing;
  if (!b) {
    for (const level of [2, 3, 4, 5] as Level[]) checks.push({ level, name: "informativo ausente", pass: false });
    return checks;
  }
  const cited = new Set([...b.positives, ...b.negatives].flatMap((p) => p.evidenceFactIds));
  const text = allText(b);

  // ---------- N2 Leitura correta ----------
  checks.push({ level: 2, name: `humor ${exp.moods.join("/")}`, pass: exp.moods.includes(b.mood), detail: `veio ${b.mood}` });
  for (const group of exp.mustCiteGroups ?? []) {
    checks.push({ level: 2, name: `cita ${group.join(" | ")}`, pass: group.some((id) => cited.has(id)), detail: `citou ${[...cited].join(", ")}` });
  }
  if (exp.positiveAny) {
    const ok = b.positives.some((p) => p.evidenceFactIds.some((id) => exp.positiveAny!.includes(id)));
    checks.push({ level: 2, name: "reconhece o que vai bem", pass: ok, detail: b.positives.map((p) => p.title).join(" / ") });
  }
  for (const f of exp.forbidden ?? []) {
    const hit = text.match(f.pattern);
    checks.push({ level: 2, name: `sem leitura errada (${f.reason})`, pass: !hit, detail: hit?.[0] });
  }

  // ---------- N3 Prioridade ----------
  const top = b.negatives[0];
  if (exp.topRiskAny) {
    checks.push({ level: 3, name: "risco certo em primeiro", pass: Boolean(top && top.evidenceFactIds.some((id) => exp.topRiskAny!.includes(id))), detail: top ? `${top.title} [${top.evidenceFactIds.join(",")}]` : "sem pontos de atenção" });
  }
  if (exp.topRiskSeverity) {
    checks.push({ level: 3, name: `gravidade ${exp.topRiskSeverity.join("/")}`, pass: Boolean(top && exp.topRiskSeverity.includes(top.severity ?? "media")), detail: top?.severity });
  }
  if (exp.noHighSeverity) {
    const high = b.negatives.filter((n) => n.severity === "alta");
    checks.push({ level: 3, name: "sem alarme exagerado", pass: high.length === 0, detail: high.map((h) => h.title).join(" / ") });
  }
  const order = { alta: 0, media: 1, baixa: 2 } as const;
  const sorted = b.negatives.every((n, i) => i === 0 || order[n.severity ?? "media"] >= order[b.negatives[i - 1].severity ?? "media"]);
  checks.push({ level: 3, name: "alertas do mais grave ao mais leve", pass: sorted });

  // ---------- N4 Didática ----------
  const explanations = [...b.positives, ...b.negatives].map((p) => p.explanation);
  const prose = [b.summary, ...explanations, b.lesson.explanation].join(" ");
  const sents = sentences(prose);
  const avg = sents.length ? sents.reduce((s, x) => s + words(x).length, 0) / sents.length : 0;
  checks.push({ level: 4, name: "frases curtas (média ≤ 22 palavras)", pass: avg > 0 && avg <= 22, detail: `média ${avg.toFixed(1)}` });
  const longOnes = sents.filter((s) => words(s).length > 32);
  checks.push({ level: 4, name: "nenhuma frase acima de 32 palavras", pass: longOnes.length === 0, detail: longOnes[0]?.slice(0, 90) });
  const unexplained = explanations.filter((e) => words(e).length < 8 || !CONSEQUENCE.test(e));
  checks.push({ level: 4, name: "cada ponto explica o efeito para a pessoa", pass: explanations.length > 0 && unexplained.length === 0, detail: unexplained[0] });
  checks.push({ level: 4, name: "ensina um conceito ligado ao caso", pass: Boolean(b.lesson.term) && words(b.lesson.explanation).length >= 15, detail: b.lesson.term });
  checks.push({ level: 4, name: "manchete curta (≤ 80 caracteres)", pass: b.headline.length > 0 && b.headline.length <= 80, detail: `${b.headline.length} caracteres` });
  const shouting = (text.match(/\b[A-ZÀ-Ú]{5,}\b/g) || []).filter((w) => !["PARCELAS"].includes(w));
  checks.push({ level: 4, name: "sem caixa alta gritando", pass: shouting.length === 0, detail: shouting.slice(0, 3).join(", ") });

  // ---------- N5 Ação concreta ----------
  const actions = [...b.negatives, ...b.positives].map((p) => p.action);
  const notImperative = actions.filter((a) => !startsWithImperative(a));
  checks.push({ level: 5, name: "ações começam com verbo", pass: actions.length > 0 && notImperative.length === 0, detail: notImperative[0] });
  const vague = b.negatives.map((p) => p.action).filter((a) => !CONCRETE.test(a));
  checks.push({ level: 5, name: "alertas com ação concreta (valor ou prazo)", pass: vague.length === 0, detail: vague[0] });
  checks.push({ level: 5, name: "próximo passo concreto", pass: Boolean(b.nextStep.title) && CONCRETE.test(`${b.nextStep.title} ${b.nextStep.detail}`), detail: b.nextStep.title });
  const firstPerson = b.suggestedQuestions.filter((q) => /\b(eu|meu|minha|meus|minhas|posso|consigo|devo|tenho|estou|gasto|preciso)\b/i.test(q));
  checks.push({ level: 5, name: "3 perguntas sugeridas na voz da pessoa", pass: b.suggestedQuestions.length === 3 && firstPerson.length === 3, detail: b.suggestedQuestions.join(" | ") });

  return checks;
}

/** Valor de um fato aparece na resposta (com tolerância de arredondamento)? */
function mentionsFact(text: string, fact: BriefingFact): boolean {
  const v = Math.abs(fact.value);
  return extractAmounts(text).some((n) => Math.abs(n - v) <= Math.max(1, v * 0.01));
}

export function gradeChatAnswer(params: { probe: ChatProbe; answer: string | null; facts: BriefingFact[]; error?: string }): Check[] {
  const { probe, answer, facts } = params;
  const label = `chat "${probe.question.slice(0, 40)}…"`;
  if (!answer) return [{ level: 1, name: `${label} respondeu`, pass: false, detail: params.error }];
  const checks: Check[] = [];
  const questionNumbers = extractAmounts(probe.question);
  const invented = findUngroundedNumbers(answer, facts).filter((n) => !questionNumbers.some((q) => Math.abs(q - n) < 1));
  // No chat a IA pode fazer contas simples; tolera até 2 números derivados.
  checks.push({ level: 1, name: `${label} sem números soltos`, pass: invented.length <= 2, detail: invented.length ? `não estão nos fatos: ${invented.slice(0, 6).join(", ")}` : undefined });
  if (probe.mustMentionAnyFact) {
    const factsToCheck = facts.filter((f) => probe.mustMentionAnyFact!.includes(f.id));
    checks.push({ level: 2, name: `${label} usa o número certo`, pass: factsToCheck.some((f) => mentionsFact(answer, f)), detail: factsToCheck.map((f) => `${f.id}=${f.value}`).join(", ") });
  }
  if (probe.verdict) {
    checks.push({ level: 3, name: `${label} ${probe.verdictLabel ?? "veredito"}`, pass: probe.verdict.test(answer), detail: answer.slice(0, 120) });
  }
  if (probe.forbidden) checks.push({ level: 2, name: `${label} sem afirmação proibida`, pass: !probe.forbidden.test(answer) });
  const sents = sentences(answer.replace(/[*#>`_-]/g, " "));
  const avg = sents.length ? sents.reduce((s, x) => s + words(x).length, 0) / sents.length : 0;
  checks.push({ level: 4, name: `${label} frases curtas`, pass: avg <= 24, detail: `média ${avg.toFixed(1)}` });
  checks.push({ level: 4, name: `${label} explica o porquê`, pass: /(?<!\p{L})(porque|pois|isso significa|ou seja|na prática|isso quer dizer|por isso|já que|por quê)(?!\p{L})/iu.test(answer) });
  checks.push({ level: 4, name: `${label} resposta enxuta (≤ 220 palavras)`, pass: words(answer).length <= 220, detail: `${words(answer).length} palavras` });
  checks.push({ level: 5, name: `${label} termina com ação`, pass: /(\n|^)\s*(\*\*)?(o que fazer|próximo passo|faça|sugestão|ação)/i.test(answer) || startsWithImperative(sentences(answer.replace(/[*#>`_-]/g, " ")).slice(-1)[0] || ""), detail: answer.slice(-100) });
  return checks;
}

export function summarize(checks: Check[]) {
  const levels = [1, 2, 3, 4, 5] as Level[];
  const scores = Object.fromEntries(
    levels.map((l) => {
      const list = checks.filter((c) => c.level === l);
      return [l, list.length ? list.filter((c) => c.pass).length / list.length : 1];
    })
  ) as Record<Level, number>;
  let reached = 0;
  for (const l of levels) {
    if (scores[l] >= 0.9) reached = l;
    else break;
  }
  return { scores, reached, total: checks.length, passed: checks.filter((c) => c.pass).length };
}
