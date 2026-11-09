import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Renderiza a página real com dados sintéticos, sem autenticação, Firestore ou chamadas à IA.
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
    "agent.ts": `export const generateDeterministicAuditDossier = () => ({}); export const generateDeterministicAnalystChatReply = () => "Resposta local de teste";`,
    "chats.ts": `
      const messages = Array.from({length:14},(_,i)=>({id:"message-"+i,role:i%2?"assistant":"user",content:i%2?"### Contas pendentes\\nSua fatura já está paga. Restam **R$ 50,00** na conta de água.\\n\\n"+"descricaomuitolongasempontodequebra".repeat(10):"Confira meu saldo e os pagamentos do mês.",timestamp:"12:00"}));
      export const loadChatSessions = async () => [{id:"fixture",title:"Conversa de teste com um título bastante longo",messages,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];
      export const createChatSession = (title="Nova Consulta") => ({id:crypto.randomUUID(),title,messages:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      export const saveChatSessions = async () => {};
      export const deleteChatSession = async () => {};
      export const loadChatHistory = async () => [];
      export const saveChatHistory = async () => {};
      export const clearChatHistory = async () => {};
      export const loadPersistentDiagnosis = async () => null;
      export const savePersistentDiagnosis = async () => {};
      export const loadInitialDiagnosisSync = () => null;
      export const loadDismissedPatterns = () => [];
      export const dismissPattern = () => [];
    `,
    "entry.tsx": `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import AIAnalystPage from ${JSON.stringify(path.join(root, "app/ai/page.tsx").replaceAll("\\", "/"))};
      window.fetch = async () => new Response(JSON.stringify({success:true,message:"A fatura está quitada. Restam R$ 50,00 a pagar.",modelUsed:"teste"}), {headers:{"Content-Type":"application/json"}});
      createRoot(document.getElementById("root")!).render(<AIAnalystPage />);
    `,
  };
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(path.join(fixtureDir, name), content)));
  const webpack = require("next/dist/compiled/webpack/webpack").webpack;
  const aliases: Record<string, string> = {};
  for (const [source, target] of Object.entries({
    "context/WalletContext": "wallet.ts", "context/AuthContext": "auth.ts", "lib/firebase": "firebase.ts",
    "lib/services/aiChatService": "chats.ts", "lib/services/agentManagerService": "agent.ts",
  })) aliases[`@/${source}$`] = path.join(fixtureDir, target);
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

async function openChat(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  page.on("pageerror", (error) => console.error(error.message));
  await page.route("https://wallet-chat.test/**", (route) => route.fulfill({ contentType: "text/html", body: '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><main style="height:100dvh;overflow:auto"><div id="root"></div></main></body></html>' }));
  await page.goto("https://wallet-chat.test/");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle });
  await page.getByRole("button", { name: "Chat IA", exact: true }).click({ timeout: 5000 });
  await expect(page.getByRole("dialog", { name: "Chat com a IA Wallet+" })).toBeVisible();
  await expect(page.getByTestId("ai-chat-feed").getByText("Confira meu saldo e os pagamentos do mês.").first()).toBeAttached();
}

for (const width of [320, 375, 390, 430, 1280]) {
  test(`chat mantém mensagens e envio dentro da tela em ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openChat(page, width, 844);
    const dialog = page.getByRole("dialog");
    const input = page.getByRole("textbox", { name: "Mensagem para Wallet+ IA", exact: true });
    await input.fill("Uma mensagem longa ".repeat(35));
    await expect(page.getByRole("button", { name: "Enviar mensagem", exact: true })).toBeEnabled();
    const metrics = await dialog.evaluate((element) => {
      const composer = element.querySelector('[data-testid="ai-chat-composer"]')!;
      const rect = composer.getBoundingClientRect();
      return { width: element.clientWidth, scrollWidth: element.scrollWidth, bottom: rect.bottom, right: rect.right, left: rect.left, viewportHeight: window.innerHeight };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width + 1);
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(width);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    const scrollButton = dialog.getByRole("button", { name: "Ir para o final", exact: true });
    if (await scrollButton.isVisible()) {
      const buttonBounds = await scrollButton.boundingBox();
      const composerBounds = await page.getByTestId("ai-chat-composer").boundingBox();
      expect(buttonBounds!.y + buttonBounds!.height).toBeLessThanOrEqual(composerBounds!.y);
    }
    if (width === 390) await page.screenshot({ path: path.join(fixtureDir, "chat-mobile.png") });
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await expect(dialog.getByText("A fatura está quitada. Restam")).toBeVisible();
    await page.getByRole("button", { name: "Ver conversas anteriores", exact: true }).click();
    await expect(dialog.getByPlaceholder("Buscar nas conversas...")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("chat acompanha o teclado e restaura a página ao fechar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://wallet-chat.test/**", (route) => route.fulfill({ contentType: "text/html", body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="height:100dvh;overflow:auto"><div id="root"></div></main></body></html>' }));
  await page.goto("https://wallet-chat.test/");
  await page.evaluate(() => Object.defineProperty(window, "visualViewport", { configurable: true, value: Object.assign(new EventTarget(), { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 }) }));
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle });
  await page.getByRole("button", { name: "Chat IA", exact: true }).click();
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 350, offsetTop: 40 });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(40);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(390);
  const composer = await page.getByTestId("ai-chat-composer").boundingBox();
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(390);
  await page.screenshot({ path: path.join(fixtureDir, "chat-keyboard.png") });
  await page.getByRole("button", { name: "Fechar Chat", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator("main").evaluate((element) => element.style.overflow)).toBe("auto");
});
