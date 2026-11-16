#!/usr/bin/env node
/**
 * Avaliação de inteligência da IA do Wallet+ contra o modelo REAL.
 *
 *   npm run eval:ai                 # todos os cenários (informativo + chat)
 *   npm run eval:ai -- --only=cartao-no-limite
 *   npm run eval:ai -- --runs=3     # repete para medir estabilidade
 *   npm run eval:ai -- --dry        # só mostra a ficha de fatos, sem chamar a IA
 *   npm run eval:ai -- --min-level=4   # sai com erro se ficar abaixo do nível 4
 *
 * Usa OPENAI_API_KEY do ambiente ou do .env.local. Cada rodada completa custa
 * centavos de dólar. O histórico fica em evals/ai/history.jsonl para acompanhar
 * a evolução do nível.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const { SCENARIOS } = await import("./scenarios.ts");
const { gradeBriefing, gradeChatAnswer, summarize, LEVEL_NAMES } = await import("./graders.ts");
const { generateAIBriefing, buildBriefingFacts, formatFactValue, BriefingGenerationError } = await import("../../lib/services/aiBriefingService.ts");
const { synthesizeFinancialTelemetry, createSafeFinancialContext, buildFinancialAnalystSystemPrompt } = await import("../../lib/services/financialContextService.ts");
const { orchestrateAnalystChat } = await import("../../lib/services/agentManagerService.ts");

const incomeKnown = (input) => (input.userProfile?.monthlyIncomeBase || 0) > 0 || input.monthIncome > 0;
const scenarios = SCENARIOS.filter((s) => !args.only || String(args.only).split(",").includes(s.id));
const runs = Number(args.runs || 1);
const withChat = !args["no-chat"];

if (args.dry) {
  for (const s of scenarios) {
    const ctx = createSafeFinancialContext(synthesizeFinancialTelemetry(s.input));
    console.log(`\n■ ${s.id} — ${s.title}`);
    for (const f of buildBriefingFacts(ctx, new Date(), { incomeKnown: incomeKnown(s.input) })) console.log(`   ${f.id.padEnd(22)} ${formatFactValue(f)}`);
  }
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
  console.error("Defina OPENAI_API_KEY (ou coloque no .env.local) para rodar a avaliação.");
  process.exit(2);
}

const allChecks = [];
const report = [];
let costUsd = 0;
let model = "";

for (let run = 1; run <= runs; run++) {
  for (const s of scenarios) {
    const ctx = createSafeFinancialContext(synthesizeFinancialTelemetry(s.input));
    const facts = buildBriefingFacts(ctx, new Date(), { incomeKnown: incomeKnown(s.input) });
    let result = null;
    let error;
    const started = Date.now();
    try {
      result = await generateAIBriefing({ context: ctx, firstName: "Pessoa", incomeKnown: incomeKnown(s.input) });
      model = result.modelUsed;
      costUsd += result.openAIResponses.reduce((acc, r) => acc + (r.estimatedCostUsd || 0), 0);
    } catch (err) {
      error = err instanceof BriefingGenerationError ? `${err.message} ${JSON.stringify(err.issues)}` : String(err?.message || err);
    }
    const checks = gradeBriefing({ scenario: s, facts, rawOutput: result?.rawOutput ?? null, briefing: result?.briefing ?? null, attempts: result?.attempts ?? 0, error, firstAttemptIssues: result?.firstAttemptIssues });

    const chats = [];
    if (withChat) {
      for (const probe of s.chat) {
        let answer = null;
        let chatError;
        try {
          const res = await orchestrateAnalystChat({
            context: ctx,
            systemPrompt: buildFinancialAnalystSystemPrompt(ctx),
            conversationMessages: [{ role: "user", content: probe.question }],
            userMessage: probe.question,
            incomeKnown: incomeKnown(s.input),
          });
          answer = res.text;
          costUsd += res.openAIResponse?.estimatedCostUsd || 0;
        } catch (err) {
          chatError = String(err?.message || err);
        }
        const chatChecks = gradeChatAnswer({ probe, answer, facts, error: chatError });
        checks.push(...chatChecks);
        chats.push({ question: probe.question, answer });
      }
    }

    allChecks.push(...checks);
    const sum = summarize(checks);
    report.push({ run, scenario: s.id, ms: Date.now() - started, summary: sum, checks, briefing: result?.briefing ?? null, chats });
    const failed = checks.filter((c) => !c.pass);
    console.log(`\n■ ${s.id}${runs > 1 ? ` (rodada ${run})` : ""} — nível ${sum.reached}/5 · ${sum.passed}/${sum.total} checagens`);
    if (result?.briefing) console.log(`   “${result.briefing.headline}” [${result.briefing.mood}]`);
    for (const c of failed) console.log(`   ✗ N${c.level} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
}

const total = summarize(allChecks);
console.log("\n══════════ RESULTADO ══════════");
for (const l of [1, 2, 3, 4, 5]) {
  const pct = Math.round(total.scores[l] * 100);
  const bar = "█".repeat(Math.round(pct / 5)).padEnd(20, "░");
  console.log(`N${l} ${LEVEL_NAMES[l].padEnd(16)} ${bar} ${String(pct).padStart(3)}%`);
}
console.log(`Nível alcançado: ${total.reached}/5 · ${total.passed}/${total.total} checagens · modelo ${model || "?"} · custo ~US$ ${costUsd.toFixed(4)}`);

const historyFile = path.join(root, "evals/ai/history.jsonl");
const resultsDir = path.join(root, "node_modules/.cache/wallet-ai-evals");
fs.mkdirSync(resultsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(path.join(resultsDir, `${stamp}.json`), JSON.stringify(report, null, 2));

const previous = fs.existsSync(historyFile) ? fs.readFileSync(historyFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((h) => !args.only === !h.only).pop() : null;
if (previous) {
  const deltas = [1, 2, 3, 4, 5].map((l) => {
    const d = Math.round((total.scores[l] - (previous.scores[l] ?? 0)) * 100);
    return `N${l} ${d >= 0 ? "+" : ""}${d}`;
  });
  console.log(`Comparado à rodada anterior (${previous.date.slice(0, 16)}, nível ${previous.reached}): ${deltas.join(" · ")}`);
}
if (!args["no-history"]) {
  fs.appendFileSync(historyFile, JSON.stringify({ date: new Date().toISOString(), model, only: args.only || null, runs, reached: total.reached, scores: total.scores, passed: total.passed, total: total.total, costUsd: Number(costUsd.toFixed(4)), note: args.note || null }) + "\n");
}
console.log(`Detalhes: ${path.relative(root, path.join(resultsDir, `${stamp}.json`))}`);

if (args["min-level"] && total.reached < Number(args["min-level"])) process.exit(1);
