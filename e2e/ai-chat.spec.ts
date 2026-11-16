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
      const cards = [{id:"checking",name:"Conta teste",brand:"wallet",type:"checking",balance:2000,limit:0,spent:0,colorScheme},{id:"credit",name:"Cartão teste",brand:"visa",type:"credit",balance:0,limit:1000,spent:950,closingDay:5,dueDay:12,colorScheme}];
      const userProfile = {name:"Pessoa Teste",email:"",persona:"optimizer",monthlyIncomeBase:3000,riskTolerance:"moderate",aiTone:"direct",maxCommitmentAlertPercent:60,targetMonthEndBalance:700};
      function getMonthlyProjection(index) { const date = new Date(2026,10+index,1); return {monthName:date.toLocaleDateString("pt-BR",{month:"long"}),year:date.getFullYear(),openingBalance:2000,actualClosingBalance:2000,projectedIncome:3000,plannedIncomesTotal:3000,recurringDebitTotal:0,recurringCreditTotal:0,cardInstallments:0,totalCommitted:1200,pendingCommitted:1200,totalInvoicesPending:0,totalInvoicesScheduled:0,totalInvoicesPaid:0,projectedFreeBalance:3800,monthNetSurplus:3000,cardInvoices:[]}; }
      const today = new Date().getDate();
      const recurringItems = [
        {id:"aluguel",title:"Aluguel",amount:1200,type:"expense",account:"Conta teste",cardId:"checking",category:"Moradia",dueDay:Math.min(27, today + 2),active:true,startMonth:0,startYear:2026},
        {id:"salario",title:"Salário",amount:3000,type:"income",account:"Conta teste",cardId:"checking",category:"Salário",dueDay:Math.min(28, today + 5),active:true,startMonth:0,startYear:2026},
      ];
      const wallet = {userProfile,cards,transactions:[],recurringItems,goals:[],mainBalance:2000,monthIncome:3000,monthExpense:0,getMonthlyProjection,isDataLoaded:true,realizeRecurringItemNow:async()=>{},unrealizeRecurringItem:async()=>{}};
      export function useWallet() { return wallet; }
    `,
    "auth.ts": `export const useAuth = () => ({user:null,loading:false});`,
    "firebase.ts": `export const auth = {currentUser:null}; export const db = {};`,
    "chats.ts": `
      const messages = Array.from({length:14},(_,i)=>({id:"message-"+i,role:i%2?"assistant":"user",content:i%2?"### Contas pendentes\\nSua fatura já está paga. Restam **R$ 50,00** na conta de água.\\n\\n"+"descricaomuitolongasempontodequebra".repeat(10):"Confira meu saldo e os pagamentos do mês.",timestamp:"12:00"}));
      export const loadChatSessions = async () => [{id:"fixture",title:"Conversa de teste com um título bastante longo",messages,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];
      export const createChatSession = (title="Nova conversa") => ({id:crypto.randomUUID(),title,messages:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      export const saveChatSessions = async () => {};
      // A análise salva vem pronta: a tela não pode gerar outra sozinha.
      export const loadCachedBriefing = () => window.__cachedBriefing ?? null;
      export const loadRemoteBriefing = async () => window.__cachedBriefing ?? null;
      export const saveCachedBriefing = () => {};
      export const saveBriefing = async () => {};
      export const loadPatternMemory = async () => ({});
      export const savePatternMemory = async (m) => { window.__patternMemory = m; };
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
      window.__cachedBriefing = {briefing,facts,generatedAt:new Date(Date.now()-2*3600*1000).toISOString(),modelUsed:"teste",signature:"assinatura-antiga"};
      window.__requests = [];
      window.fetch = async (url, init) => {
        window.__requests.push({url:String(url), body: init && init.body ? JSON.parse(init.body) : null});
        const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json"}});
        if (String(url).includes("/api/ai/briefing")) return json({success:true,briefing,facts,generatedAt:new Date().toISOString(),modelUsed:"teste"});
        // Igual à rota real: etapas em fluxo (NDJSON) e o resultado no fim
        const result = {type:"result",success:true,message:"A fatura está quitada. Restam R$ 50,00 a pagar.",modelUsed:"teste",
          reasoning:{understanding:"Você quer saber o que falta pagar.",steps:[{title:"Conferi as faturas",detail:"A fatura do cartão já foi paga.",facts:[{id:"saldo_projetado",label:"Saldo previsto no fim do mês",value:5000,kind:"brl"}]},{title:"Somei as contas que faltam",detail:"Sobra só a conta de água, R$ 50,00.",facts:[]}],
            pipeline:[{id:"contexto",title:"Lendo seus números",status:"done",detail:"Saldo hoje R$ 2.000,00"},{id:"padroes",title:"Procurando padrões",status:"done",detail:"1 padrão encontrado"},{id:"pensando",title:"Montando o raciocínio",status:"done",detail:"2 etapas"},{id:"conferindo",title:"Conferindo valores e contas",status:"done",detail:"3 valores conferidos"}],
            verification:{ok:true,numbersChecked:3,calculationsChecked:0,problems:[]},attempts:1},
          patterns:[{key:"limite_cartao",title:"Limite do cartão quase todo usado",observation:"95% do limite usado."}],
          followUp:{question:"Seu cartão está com 95% do limite usado. Quer que eu acompanhe isso com você?",patternKey:"limite_cartao",patternTitle:"Limite do cartão quase todo usado"}};
        const events = [
          {type:"step",step:{id:"contexto",title:"Lendo seus números",status:"done",detail:"Saldo hoje R$ 2.000,00"}},
          {type:"step",step:{id:"padroes",title:"Procurando padrões",status:"done",detail:"1 padrão encontrado"}},
          {type:"step",step:{id:"pensando",title:"Montando o raciocínio",status:"running"}},
          result,
        ];
        const delay = window.__chatDelayMs ?? 0;
        const stream = new ReadableStream({ async start(c) { for (const e of events) { if (e.type === "result" && delay) await new Promise(r => setTimeout(r, delay)); c.enqueue(new TextEncoder().encode(JSON.stringify(e) + String.fromCharCode(10))); } c.close(); } });
        return new Response(stream, {status:200, headers:{"Content-Type":"application/x-ndjson"}});
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
  await expect(page.getByRole("heading", { name: "Wallet+ IA" })).toBeVisible();
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
    // Dinheiro de verdade: fechamento, a conta do fechamento e o gráfico dia a dia
    await expect(page.getByRole("heading", { name: /^Fecha .+ com$/ })).toBeVisible();
    await expect(page.getByRole("group", { name: "De onde vem o fechamento" })).toBeVisible();
    await expect(page.getByRole("group", { name: /Saldo previsto da conta/ })).toBeVisible();
    // Auditoria: parecer da IA + achados, sem repetir (cada um com um número só)
    await expect(page.getByRole("heading", { name: "A seu favor" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "Pede atenção" })).toBeAttached();
    await expect(page.getByText("Margem de segurança")).toBeVisible();
    await expect(page.getByRole("button", { name: /Cartão quase no limite/ })).toHaveAttribute("aria-expanded", "true");

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
  await page.getByRole("button", { name: "Gerar nova análise", exact: true }).first().click();
  const alert = page.getByRole("alert").filter({ hasText: "O Cofi não conseguiu gerar a análise" });
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

test("a análise não roda sozinha e mostra data e hora da última", async ({ page }) => {
  await openAIPage(page, 390);
  const label = page.getByTestId("last-analysis");
  await expect(label).toContainText(/Última análise: (hoje|ontem), \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
  await expect(label).toContainText("há 2 h");
  await expect(label).toContainText("Seus números mudaram");
  await page.waitForTimeout(500);
  const briefingCalls = await page.evaluate(() =>
    (window as unknown as { __requests: RecordedRequest[] }).__requests.filter((r) => r.url.includes("/api/ai/briefing")).length
  );
  expect(briefingCalls).toBe(0);
  await label.getByRole("button", { name: "Gerar nova análise" }).click();
  await expect(label).toContainText("agora mesmo");
  const after = await page.evaluate(() =>
    (window as unknown as { __requests: RecordedRequest[] }).__requests.filter((r) => r.url.includes("/api/ai/briefing")).length
  );
  expect(after).toBe(1);
});

test("no celular a conversa abre em tela cheia e a resposta aparece a partir da pergunta", async ({ page }) => {
  await openAIPage(page, 390, 844);
  const section = page.locator('section[aria-labelledby="cofi-chat-title"]');
  await page.getByRole("textbox", { name: "Mensagem para o Cofi", exact: true }).fill("Quanto posso gastar hoje?");
  await expect(section).toHaveAttribute("data-fullscreen", "true");
  const box = await section.boundingBox();
  expect(box!.y).toBeLessThanOrEqual(1);
  expect(box!.height).toBeGreaterThan(800);
  const composer = await page.getByTestId("ai-chat-composer").boundingBox();
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(844 + 1);
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  const feed = page.getByTestId("ai-chat-feed");
  await expect(feed.getByText("A fatura está quitada. Restam").last()).toBeVisible();
  await page.waitForTimeout(600);
  const question = feed.getByText("Quanto posso gastar hoje?", { exact: true });
  const [q, f] = await Promise.all([question.boundingBox(), feed.boundingBox()]);
  expect(q!.y).toBeGreaterThanOrEqual(f!.y - 1);
  expect(q!.y).toBeLessThan(f!.y + f!.height);
  await page.screenshot({ path: path.join(fixtureDir, "ai-mobile-chat-fullscreen.png") });
  await page.getByRole("button", { name: "Fechar conversa" }).click();
  await expect(section).not.toHaveAttribute("data-fullscreen", "true");
});

test("o Cofi mostra o raciocínio ao vivo, a linha de raciocínio conferida e pergunta sobre o padrão", async ({ page }) => {
  await openAIPage(page, 1280);
  // O achado da auditoria vem do parecer, ligado ao padrão calculado pelo app
  const finding = page.getByRole("button", { name: /Cartão quase no limite/ });
  await expect(finding).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Valores conferidos com seus dados").first()).toBeVisible();

  await page.evaluate(() => ((window as unknown as { __chatDelayMs: number }).__chatDelayMs = 1200));
  await page.getByRole("button", { name: "Perguntar ao Cofi" }).first().click();
  const live = page.getByTestId("ai-live-reasoning");
  await expect(live).toContainText("Procurando padrões");
  await expect(live).toContainText("Montando o raciocínio");

  const feed = page.getByTestId("ai-chat-feed");
  await expect(feed.getByText("A fatura está quitada. Restam").last()).toBeVisible();
  const panel = feed.getByTestId("ai-reasoning").last();
  await expect(panel).toContainText("Raciocinou em 2 etapas");
  await expect(panel).toContainText("Conferido");
  await expect(panel).toContainText("O que entendi");
  await expect(panel).toContainText("Somei as contas que faltam");
  await expect(panel).toContainText("3 valores batidos");
  await expect(feed.getByText("Limite do cartão quase todo usado").first()).toBeVisible();

  // Resposta rápida ao padrão vira memória (acompanhar) e continua a conversa
  const followUp = feed.getByTestId("ai-follow-up");
  await expect(followUp).toContainText("Quer que eu acompanhe");
  await page.evaluate(() => ((window as unknown as { __chatDelayMs: number }).__chatDelayMs = 0));
  await followUp.getByRole("button", { name: "Quero reduzir isso" }).click();
  await expect(feed.getByText(/Quero reduzir isso: "Limite do cartão quase todo usado"/)).toBeVisible();
  const memory = await page.evaluate(() => (window as unknown as { __patternMemory: Record<string, { status: string; baseline?: { value: number } }> }).__patternMemory);
  expect(memory.limite_cartao.status).toBe("acompanhar");
  expect(memory.limite_cartao.baseline?.value).toBe(95);
  const second = await page.evaluate(() =>
    (window as unknown as { __requests: RecordedRequest[] }).__requests.filter((r) => r.url.includes("/api/ai/chat")).at(-1)!.body
  );
  expect(second.patternMemory).toEqual([expect.objectContaining({ key: "limite_cartao", status: "acompanhar", baselineValue: 95 })]);
  // A auditoria mostra que o padrão está sendo acompanhado
  await expect(page.getByRole("button", { name: /Cartão quase no limite/ })).toContainText("Acompanhando");
  await page.screenshot({ path: path.join(fixtureDir, "ai-reasoning.png"), fullPage: false });
});

test("histórico de conversas fica numa gaveta lateral, com busca e nova conversa", async ({ page }) => {
  await openAIPage(page, 1280);
  await page.getByRole("button", { name: "Histórico de conversas" }).click();
  const drawer = page.getByRole("dialog", { name: "Histórico de conversas" });
  await expect(drawer).toContainText("Hoje");
  await expect(drawer).toContainText("Conversa de teste com um título bastante longo");
  await drawer.getByRole("textbox", { name: "Buscar conversas" }).fill("nada disso existe");
  await expect(drawer).toContainText("Nada encontrado");
  await drawer.getByRole("textbox", { name: "Buscar conversas" }).fill("");
  await drawer.getByRole("button", { name: "Nova conversa" }).click();
  await expect(page.getByTestId("ai-chat-feed")).toContainText("Como posso ajudar?");
  await page.getByRole("button", { name: "Histórico de conversas" }).click();
  await drawer.getByRole("button", { name: /^Conversa de teste com um título bastante longo \d+ mensagens/ }).click();
  await expect(page.getByTestId("ai-chat-feed").getByText("Confira meu saldo e os pagamentos do mês.").first()).toBeVisible();
});

test("o gráfico do saldo responde ao teclado e a conta do fechamento abre cada parcela", async ({ page }) => {
  await openAIPage(page, 1280);
  const chart = page.getByRole("group", { name: /Saldo previsto da conta/ });
  await chart.focus();
  await page.keyboard.press("Home");
  const money = page.getByRole("region", { name: /^Fecha .+ com$/ });
  await expect(money).toContainText("Hoje");
  await page.keyboard.press("End");
  await expect(money).not.toContainText("Nada entra nem vence neste dia.Hoje");
  await money.getByRole("button", { name: /^Sai/ }).click();
  await expect(money.getByRole("button", { name: /^Sai/ })).toHaveAttribute("aria-pressed", "true");
  if (new Date().getDate() <= 25) {
    await expect(money).toContainText("Aluguel");
    await money.getByRole("button", { name: /Aluguel/ }).click();
    await expect(money.getByRole("button", { name: /^Hoje/ })).toHaveAttribute("aria-pressed", "true");
  }
  // Capturas da tela inteira (a rolagem é do <main>, então a janela cresce)
  await page.setViewportSize({ width: 1280, height: 2000 });
  await page.screenshot({ path: path.join(fixtureDir, "ai-desktop-full.png") });
  await page.setViewportSize({ width: 390, height: 2300 });
  await page.screenshot({ path: path.join(fixtureDir, "ai-mobile-full.png") });
});

test("'É esperado' não chama a IA e o Cofi para de insistir", async ({ page }) => {
  await openAIPage(page, 390);
  const feed = page.getByTestId("ai-chat-feed");
  await page.getByRole("textbox", { name: "Mensagem para o Cofi", exact: true }).fill("Como está meu cartão?");
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  const followUp = feed.getByTestId("ai-follow-up");
  await expect(followUp).toBeVisible();
  const before = await page.evaluate(() => (window as unknown as { __requests: RecordedRequest[] }).__requests.filter((r) => r.url.includes("/api/ai/chat")).length);
  await followUp.getByRole("button", { name: "É esperado" }).click();
  await expect(followUp).toContainText("não vou insistir");
  const after = await page.evaluate(() => (window as unknown as { __requests: RecordedRequest[] }).__requests.filter((r) => r.url.includes("/api/ai/chat")).length);
  expect(after).toBe(before);
  await page.screenshot({ path: path.join(fixtureDir, "ai-mobile-reasoning.png") });
});
