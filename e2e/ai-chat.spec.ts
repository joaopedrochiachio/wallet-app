import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Renderiza a tela real da IA (informativo + chat + calendário) com dados sintéticos,
// sem autenticação, Firestore ou chamadas reais à IA (o fetch é simulado por URL).
const require = createRequire(path.join(process.cwd(), "package.json"));
const root = process.cwd();
const fixtureDir = path.join(root, "node_modules/.cache/wallet-ai-chat-test");
let bundle: string;
let css: string;

test.beforeAll(async () => {
  test.setTimeout(60000);
  await mkdir(fixtureDir, { recursive: true });
  const files = {
    "loader.cjs": `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText; };`,
    "wallet.ts": `
      const colorScheme = {gradient:"",border:"",accent:"#111",badgeText:"",chipGradient:""};
      const cards = [{id:"checking",name:"Conta teste",brand:"wallet",type:"checking",balance:2000,limit:0,spent:0,colorScheme}];
      const userProfile = {name:"Pessoa Teste",email:"",persona:"optimizer",monthlyIncomeBase:3000,riskTolerance:"moderate",aiTone:"direct",maxCommitmentAlertPercent:60,targetMonthEndBalance:700};
      function getMonthlyProjection(index) { const date = new Date(2026,10+index,1); return {monthName:date.toLocaleDateString("pt-BR",{month:"long"}),year:date.getFullYear(),openingBalance:2000,actualClosingBalance:2000,projectedIncome:3000,plannedIncomesTotal:3000,recurringDebitTotal:0,recurringCreditTotal:0,cardInstallments:0,totalCommitted:0,pendingCommitted:0,totalInvoicesPending:0,totalInvoicesScheduled:0,totalInvoicesPaid:0,projectedFreeBalance:5000,monthNetSurplus:3000,cardInvoices:[]}; }
      const wallet = {userProfile,cards,transactions:[],recurringItems:[],goals:[],mainBalance:2000,monthIncome:3000,monthExpense:0,getMonthlyProjection,isDataLoaded:true,realizeRecurringItemNow:async()=>{},unrealizeRecurringItem:async()=>{}};
      export function useWallet() { return wallet; }
    `,
    "auth.ts": `export const useAuth = () => ({user:null,loading:false});`,
    "firebase.ts": `export const auth = {currentUser:null}; export const db = {};`,
    "chats.ts": `
      const messages = Array.from({length:14},(_,i)=>({id:"message-"+i,role:i%2?"assistant":"user",content:i%2?"### Contas pendentes\\nSua fatura já está paga. Restam **R$ 50,00** na conta de água.\\n\\n"+"descricaomuitolongasempontodequebra".repeat(10):"Confira meu saldo e os pagamentos do mês.",timestamp:"12:00"}));
      export const loadChatSessions = async () => [{id:"fixture",title:"Conversa de teste com um título bastante longo",messages,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];
      export const createChatSession = (title="Nova conversa") => ({id:crypto.randomUUID(),title,messages:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      export const saveChatSessions = async () => {};
      export const loadCachedBriefing = () => null;
      export const saveCachedBriefing = () => {};
    `,
    "next-link.tsx": `import React from "react"; export default function Link({children,href,...props}) { return <a href={href} {...props}>{children}</a>; }`,
    "entry.tsx": `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import AIPage from ${JSON.stringify(path.join(root, "app/ai/page.tsx").replaceAll("\\", "/"))};
      const facts = [
        {id:"saldo_projetado",label:"Saldo previsto no fim do mês",value:5000,kind:"brl"},
        {id:"meta_mes",label:"Meta de saldo para fechar o mês",value:700,kind:"brl"},
        {id:"margem_segura",label:"Quanto ainda dá para gastar sem furar a meta",value:4300,kind:"brl"},
        {id:"limite_uso_pct",label:"Uso do limite dos cartões",value:92,kind:"percent"},
      ];
      const briefing = {
        headline:"Seu mês fecha no azul com folga",
        summary:"O saldo previsto é R$ 5.000,00, acima da meta. Isso deixa espaço para gastar com calma.",
        mood:"positivo",
        highlightFactIds:["saldo_projetado","margem_segura","limite_uso_pct"],
        positives:[{title:"Meta garantida com folga",explanation:"Você ainda pode gastar R$ 4.300,00 sem furar a meta, então o mês está seguro.",evidenceFactIds:["margem_segura"],action:"Guarde parte da folga hoje."}],
        negatives:[{title:"Cartão quase no limite",explanation:"Você usa 92% do limite, ou seja, sobra pouca folga para imprevistos.",evidenceFactIds:["limite_uso_pct"],action:"Evite novas compras no cartão nesta semana.",severity:"media"}],
        nextStep:{title:"Separe a reserva hoje",detail:"Transfira parte da folga para a reserva."},
        lesson:{term:"Margem de segurança",explanation:"É o quanto você pode gastar sem passar da meta. Ela protege o fim do mês de surpresas."},
        suggestedQuestions:["Quanto posso gastar por dia?","Devo pagar o cartão antes?","Onde eu economizo?"],
      };
      window.__requests = [];
      window.fetch = async (url, init) => {
        window.__requests.push({url:String(url), body: init && init.body ? JSON.parse(init.body) : null});
        const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json"}});
        if (String(url).includes("/api/ai/briefing")) return json({success:true,briefing,facts,generatedAt:new Date().toISOString(),modelUsed:"teste"});
        return json({success:true,message:"A fatura está quitada. Restam R$ 50,00 a pagar.",modelUsed:"teste"});
      };
      createRoot(document.getElementById("root")!).render(<AIPage />);
    `,
  };
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(path.join(fixtureDir, name), content)));
  const webpack = require("next/dist/compiled/webpack/webpack").webpack;
  const aliases: Record<string, string> = {};
  for (const [source, target] of Object.entries({
    "context/WalletContext": "wallet.ts", "context/AuthContext": "auth.ts", "lib/firebase": "firebase.ts",
    "lib/services/aiChatService": "chats.ts",
  })) aliases[`@/${source}$`] = path.join(fixtureDir, target);
  aliases["next/link$"] = path.join(fixtureDir, "next-link.tsx");
  aliases["@"] = root;
  await new Promise<void>((resolve, reject) => {
    const compiler = webpack({
      mode: "development", devtool: false, entry: path.join(fixtureDir, "entry.tsx"),
      output: { path: fixtureDir, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: aliases },
      module: { rules: [{ test: /\.tsx?$/, use: path.join(fixtureDir, "loader.cjs") }] },
    });
    compiler.run((error: Error | null, stats: { hasErrors(): boolean; toString(options: unknown): string }) => {
      compiler.close(() => {});
      if (error || stats?.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
      else resolve();
    });
  });
  bundle = await readFile(path.join(fixtureDir, "bundle.js"), "utf8");
  const postcss = require("postcss");
  const tailwind = require("@tailwindcss/postcss");
  css = ":root { --font-sf-pro: system-ui; --font-sf-mono: monospace; }\n" + (await postcss([tailwind()]).process(await readFile(path.join(root, "app/globals.css"), "utf8"), { from: path.join(root, "app/globals.css") })).css;
});

const PAGE_HTML = '<!DOCTYPE html><html><head><meta name="theme-color" content="#F2F2F7"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><main style="height:100dvh;overflow:auto"><div id="root"></div></main></body></html>';

type RecordedRequest = { url: string; body: Record<string, unknown> };

async function openAIPage(page: Page, width: number, height = 844) {
  await page.setViewportSize({ width, height });
  await page.route("https://wallet-chat.test/**", (route) => route.fulfill({ contentType: "text/html", body: PAGE_HTML }));
  await page.goto("https://wallet-chat.test/");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle });
  await expect(page.getByRole("heading", { name: "Informativo do Cofi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seu mês fecha no azul com folga" })).toBeVisible();
}

/** Faz as próximas N chamadas a uma rota de IA falharem com a resposta dada. */
async function failNext(page: Page, route: string, status: number, body: Record<string, unknown>) {
  await page.evaluate(({ route, status, body }) => {
    const original = window.fetch;
    let failures = 1;
    window.fetch = async (url, init) => {
      if (String(url).includes(route) && failures-- > 0) {
        return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      }
      return original(url, init);
    };
  }, { route, status, body });
}

for (const width of [320, 375, 390, 430, 1280]) {
  test(`informativo e chat cabem na tela em ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openAIPage(page, width);
    if (width === 390) await page.screenshot({ path: path.join(fixtureDir, "ai-mobile-top.png") });
    if (width === 1280) await page.screenshot({ path: path.join(fixtureDir, "ai-desktop-top.png") });

    // Informativo gerado pela IA: números de destaque, pontos a favor/contra e conceito
    await expect(page.getByText("R$ 4.300,00").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "A seu favor" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pede atenção" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Margem de segurança" })).toBeVisible();

    // Chat no corpo da tela, com a conversa salva
    const feed = page.getByTestId("ai-chat-feed");
    await expect(feed.getByText("Confira meu saldo e os pagamentos do mês.").first()).toBeAttached();
    await page.getByRole("textbox", { name: "Mensagem para o Cofi", exact: true }).fill("Uma mensagem longa ".repeat(35));
    const metrics = await page.evaluate(() => {
      const composer = document.querySelector('[data-testid="ai-chat-composer"]')!.getBoundingClientRect();
      return { scrollWidth: document.documentElement.scrollWidth, left: composer.left, right: composer.right };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(width);
    if (width === 390) await page.screenshot({ path: path.join(fixtureDir, "ai-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await expect(feed.getByText("A fatura está quitada. Restam").last()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("a pergunta de um ponto de atenção vai para o chat com os dados financeiros", async ({ page }) => {
  await openAIPage(page, 1280);
  await page.getByRole("button", { name: "Perguntar ao Cofi" }).first().click();
  await expect(page.getByTestId("ai-chat-feed").getByText(/Me explique melhor este ponto/).last()).toBeVisible();
  const chatRequest = await page.evaluate(() =>
    (window as unknown as { __requests: RecordedRequest[] }).__requests.find((r) => r.url.includes("/api/ai/chat"))
  );
  expect(chatRequest?.body.userMessage).toMatch(/Me explique melhor este ponto/);
  expect(chatRequest?.body.targetEndMonthBalance).toBe(700);
  expect(Array.isArray(chatRequest?.body.monthlyProjections)).toBe(true);
});

test("quando a IA falha no informativo, a tela mostra o motivo e não inventa conteúdo", async ({ page }) => {
  await openAIPage(page, 390);
  await failNext(page, "/api/ai/briefing", 502, {
    success: false,
    code: "BRIEFING_UNGROUNDED",
    error: "A IA gerou um informativo com valores que não batem com seus dados. Tente novamente.",
  });
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  const alert = page.getByRole("alert").filter({ hasText: "O Cofi não conseguiu gerar o informativo" });
  await expect(alert).toContainText("valores que não batem");
  await expect(alert).toContainText("último informativo gerado");
  await alert.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "O Cofi não conseguiu" })).toHaveCount(0);
});

test("quando a IA falha no chat, mostra o motivo e reenvia sem duplicar a pergunta", async ({ page }) => {
  await openAIPage(page, 1280);
  await failNext(page, "/api/ai/chat", 503, { success: false, code: "INSUFFICIENT_QUOTA", error: "A IA está temporariamente sem créditos. Tente novamente mais tarde." });
  const feed = page.getByTestId("ai-chat-feed");
  await page.getByRole("textbox", { name: "Mensagem para o Cofi", exact: true }).fill("Pergunta de teste única");
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  const alert = feed.getByRole("alert");
  await expect(alert).toContainText("A IA não respondeu");
  await expect(alert).toContainText("sem créditos");
  await alert.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(feed.getByText("A fatura está quitada. Restam").last()).toBeVisible();
  await expect(feed.getByRole("alert")).toHaveCount(0);
  await expect(feed.getByText("Pergunta de teste única", { exact: true })).toHaveCount(1);
});

test("tema escuro deixa a tela inteira escura e fica salvo", async ({ page }) => {
  await openAIPage(page, 390);
  await page.getByRole("button", { name: "Usar tema escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/theme-dark/);
  expect(await page.evaluate(() => localStorage.getItem("wallet_theme"))).toBe("dark");
  const colors = await page.evaluate(() => {
    const h = document.querySelector("#ai-headline")!;
    return { text: getComputedStyle(h).color, card: getComputedStyle(h.closest("section")!).backgroundColor, meta: document.querySelector('meta[name="theme-color"]')!.getAttribute("content") };
  });
  expect(colors).toEqual({ text: "rgb(245, 245, 247)", card: "rgb(28, 28, 30)", meta: "#000000" });
  await page.screenshot({ path: path.join(fixtureDir, "ai-dark.png"), fullPage: true });
  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await expect(page.locator("html")).not.toHaveClass(/theme-dark/);
});

test("calendário de gastos fica recolhido e abre com um toque", async ({ page }) => {
  await openAIPage(page, 390);
  const toggle = page.getByRole("button", { name: /Calendário de gastos/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#ai-calendar")).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#ai-calendar")).toBeVisible();
});
