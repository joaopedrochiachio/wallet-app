import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { buildAppFixture } from "./helpers/appFixture";

/**
 * Auditoria de responsividade de TODAS as telas no AppShell real, em larguras
 * de iPhone, com dados de estresse. Falha se houver rolagem horizontal, conteúdo
 * cortado fora da tela, campo que dispara zoom no iOS ou erro de execução.
 */

const ROUTES = ["/", "/login", "/onboarding", "/dashboard", "/transactions", "/planning", "/cards", "/goals", "/profile", "/ai"];
const WIDTHS = [320, 375, 390, 430];
const REPORT = process.env.RESPONSIVE_REPORT === "1";

let fixture: Awaited<ReturnType<typeof buildAppFixture>>;

test.beforeAll(async () => {
  test.setTimeout(120000);
  fixture = await buildAppFixture();
});


/** Informativo de estresse: textos longos e 3 pontos de cada lado. */
const LONG = "Isso significa que sua folga do mês diminui bastante se nada mudar nas próximas semanas, então vale agir agora.";
const BRIEFING = {
  success: true,
  generatedAt: new Date().toISOString(),
  modelUsed: "fixture",
  facts: [
    { id: "saldo_projetado", label: "Saldo previsto no fim do mês", value: -123456.78, kind: "brl" },
    { id: "falta_meta", label: "Quanto falta para alcançar a meta", value: 128456.78, kind: "brl" },
    { id: "limite_uso_pct", label: "Uso do limite dos cartões", value: 93.4, kind: "percent" },
    { id: "folego_meses", label: "Meses que o saldo atual cobre sem nova renda", value: 1.5, kind: "months" },
  ],
  briefing: {
    headline: "Seu mês fecha no vermelho se as faturas vencerem como previsto",
    summary: `${LONG} ${LONG}`,
    mood: "critico",
    highlightFactIds: ["saldo_projetado", "falta_meta", "limite_uso_pct", "folego_meses"],
    negatives: [0, 1, 2].map((i) => ({ title: `Ponto de atenção número ${i + 1} com título comprido`, explanation: LONG, evidenceFactIds: ["saldo_projetado", "limite_uso_pct"], action: "Separe R$ 1.234,56 até o dia 10 para a fatura.", severity: (["alta", "media", "baixa"] as const)[i] })),
    positives: [0, 1, 2].map((i) => ({ title: `Ponto a favor número ${i + 1}`, explanation: LONG, evidenceFactIds: ["folego_meses"], action: "Mantenha o ritmo de registros nesta semana." })),
    nextStep: { title: "Priorize a fatura do cartão principal", detail: LONG },
    lesson: { term: "Saldo projetado", explanation: LONG },
    suggestedQuestions: ["Qual conta eu pago primeiro neste mês?", "Quanto preciso cortar por dia?", "Posso parcelar a fatura?"],
  },
};

async function open(page: Page, route: string, width: number, theme: "light" | "dark" = "light") {
  await page.setViewportSize({ width, height: 844 });
  await page.route("https://wallet.test/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div></body></html>',
    })
  );
  await page.route("**/api/**", (r) =>
    r.fulfill({ contentType: "application/json", body: r.request().url().includes("/api/ai/briefing") ? JSON.stringify(BRIEFING) : '{"success":false}' })
  );
  if (theme === "dark") {
    await page.addInitScript(() => {
      localStorage.setItem("wallet_theme", "dark");
      document.addEventListener("DOMContentLoaded", () => document.documentElement.classList.add("theme-dark"));
    });
  }
  await page.goto(`https://wallet.test${route}`);
  await page.addStyleTag({ content: fixture.css });
  await page.addScriptTag({ content: fixture.bundle });
  await page.waitForTimeout(700);
}

/** Mede problemas de layout no estado atual da página. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const describe = (el: Element) => {
      const h = el as HTMLElement;
      const label = (h.getAttribute("aria-label") || h.innerText || "").trim().replace(/\s+/g, " ").slice(0, 50);
      const cls = (typeof h.className === "string" ? h.className : "").split(" ").slice(0, 4).join(".");
      return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${label ? ` "${label}"` : ""}`;
    };
    // Elemento está dentro de um contêiner que recorta/rola na horizontal (carrossel intencional)?
    const isClipped = (el: Element) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (["auto", "scroll", "hidden", "clip"].includes(s.overflowX)) {
          const r = p.getBoundingClientRect();
          if (r.left >= -1 && r.right <= vw + 1) return true;
        }
        p = p.parentElement;
      }
      return false;
    };
    const offscreen: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.position === "fixed" && r.right <= 0) continue;
      if ((r.right > vw + 1 || r.left < -1) && !isClipped(el)) {
        // Reporta só o elemento mais externo que vaza
        const parentLeaks = (() => {
          const pr = el.parentElement?.getBoundingClientRect();
          return pr && (pr.right > vw + 1 || pr.left < -1) && !isClipped(el.parentElement!);
        })();
        if (!parentLeaks) offscreen.push(`${describe(el)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
      }
    }
    const zoomInputs = Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select"))
      .filter((el) => (el as HTMLElement).offsetParent && parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${describe(el)} ${getComputedStyle(el).fontSize}`);
    const smallTargets = Array.from(document.querySelectorAll("button, a[href], [role=button], [role=radio], [role=switch], [role=combobox]"))
      .filter((el) => !el.closest("[data-touch-exempt]"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        // Área de toque efetiva: o próprio elemento ou a área invisível (::after) de .touch-target
        let hitW = r.width, hitH = r.height;
        for (const pseudo of ["::before", "::after"]) {
          const ps = getComputedStyle(el, pseudo);
          if (ps.content === "none" || ps.position !== "absolute") continue;
          hitW = Math.max(hitW, parseFloat(ps.width) || 0);
          hitH = Math.max(hitH, parseFloat(ps.height) || 0);
        }
        return { el, r, hitW, hitH };
      })
      .filter(({ el, r, hitW, hitH }) => r.width > 0 && r.height > 0 && (hitH < 32 || hitW < 32) && getComputedStyle(el).visibility !== "hidden")
      .map(({ el, hitW, hitH }) => `${describe(el)} ${Math.round(hitW)}x${Math.round(hitH)}`);
    // Rótulos cortados em controles do kit (segmentos e botões)
    const truncatedLabels = Array.from(document.querySelectorAll(".mac-segment > span:last-child, .mac-button, .mac-toolbar-button"))
      .filter((el) => (el as HTMLElement).offsetParent && el.scrollWidth > el.clientWidth + 1)
      .map((el) => describe(el));
    return {
      truncatedLabels,
      horizontalOverflow: document.documentElement.scrollWidth - vw,
      offscreen: offscreen.slice(0, 15),
      zoomInputs: zoomInputs.slice(0, 10),
      smallTargets: smallTargets.slice(0, 25),
      smallTargetCount: smallTargets.length,
    };
  });
}

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`${route} sem quebra de layout em ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await open(page, route, width);
      const result = await measure(page);
      if (REPORT) {
        fs.appendFileSync(path.join(fixture.directory, "responsive-report.jsonl"), JSON.stringify({ key: `${route} @${width}`, ...result, errors }) + "\n");
        await page.screenshot({ path: path.join(fixture.directory, `shot${route.replace(/\//g, "_") || "_root"}-${width}.png`), fullPage: true });
      }
      await context.close();
      expect(errors, "erros de execução").toEqual([]);
      expect(result.horizontalOverflow, "rolagem horizontal").toBeLessThanOrEqual(0);
      expect(result.offscreen, "conteúdo fora da tela").toEqual([]);
      expect(result.zoomInputs, "campos que dão zoom no iOS").toEqual([]);
      expect(result.smallTargets, "alvos de toque menores que 32px").toEqual([]);
      expect(result.truncatedLabels, "rótulos cortados em controles").toEqual([]);
    });
  }
}

/** Fluxos que abrem algo por cima da tela (sheets, modais, menus, chat). */
const FLOWS: Array<{ name: string; route: string; steps: (page: Page) => Promise<void> }> = [
  { name: "nova transação", route: "/transactions", steps: (p) => p.getByRole("button", { name: /Nova Transação/ }).first().click() },
  { name: "importar extrato", route: "/transactions", steps: (p) => p.getByRole("button", { name: /Importar Extrato/ }).first().click() },
  { name: "detalhes da transação", route: "/transactions", steps: (p) => p.getByText("Supermercado Pão de Açúcar").first().click() },
  { name: "novo cartão", route: "/cards", steps: (p) => p.getByRole("button", { name: "Novo cartão", exact: true }).click() },
  { name: "nova compra", route: "/cards", steps: (p) => p.getByRole("button", { name: "Nova compra", exact: true }).click() },
  { name: "nova meta", route: "/goals", steps: (p) => p.getByRole("button", { name: /Nova Meta/ }).first().click() },
  {
    name: "adicionar planejamento", route: "/planning",
    steps: async (p) => {
      await p.getByRole("button", { name: "Adicionar", exact: true }).first().click();
      await p.getByRole("menuitem", { name: /Recebimento futuro/ }).click();
    },
  },
  { name: "gasto rápido", route: "/dashboard", steps: async (p) => {
      await p.getByRole("button", { name: "Atalho Rápido do Companheiro" }).click();
      await p.getByRole("button", { name: /Captura Rápida/ }).first().click();
    } },
  { name: "calendário de gastos da IA", route: "/ai", steps: (p) => p.getByRole("button", { name: /Calendário de gastos/ }).click() },
  { name: "chat com simulador", route: "/ai", steps: (p) => p.getByRole("button", { name: "Simular", exact: true }).click() },
  { name: "painel do Cofi", route: "/dashboard", steps: (p) => p.getByRole("button", { name: /Abrir painel do Cofi/ }).click() },
  {
    name: "histórico do chat da IA", route: "/ai",
    steps: async (p) => {
      // No celular a conversa fica na barra de baixo: abre em tela cheia primeiro
      const open = p.getByRole("button", { name: "Abrir conversa em tela cheia" });
      if (await open.isVisible()) await open.click();
      await p.getByRole("button", { name: "Histórico de conversas" }).click();
    },
  },
  { name: "editar meta na IA", route: "/ai", steps: (p) => p.getByRole("button", { name: /Editar meta/ }).click() },
  {
    name: "tema escuro pelo perfil", route: "/profile",
    steps: async (p) => {
      await p.getByRole("button", { name: /Conta & Parâmetros/ }).click();
      await p.getByRole("radio", { name: "Escuro" }).click();
      await expect(p.locator("html")).toHaveClass(/theme-dark/);
      expect(await p.evaluate(() => localStorage.getItem("wallet_theme"))).toBe("dark");
    },
  },
];

for (const flow of FLOWS) {
  for (const width of [320, 390]) {
    test(`${flow.name} (${flow.route}) sem quebra de layout em ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await open(page, flow.route, width);
      await flow.steps(page);
      await page.waitForTimeout(500);
      const result = await measure(page);
      if (REPORT) {
        fs.appendFileSync(path.join(fixture.directory, "responsive-report.jsonl"), JSON.stringify({ key: `[${flow.name}] @${width}`, ...result, errors }) + "\n");
        await page.screenshot({ path: path.join(fixture.directory, `flow_${flow.name.replace(/\W+/g, "-")}-${width}.png`) });
      }
      await context.close();
      expect(errors, "erros de execução").toEqual([]);
      expect(result.horizontalOverflow, "rolagem horizontal").toBeLessThanOrEqual(0);
      expect(result.offscreen, "conteúdo fora da tela").toEqual([]);
      expect(result.zoomInputs, "campos que dão zoom no iOS").toEqual([]);
      expect(result.smallTargets, "alvos de toque menores que 32px").toEqual([]);
      expect(result.truncatedLabels, "rótulos cortados em controles").toEqual([]);
    });
  }
}

/**
 * Texto com contraste baixo contra o fundo real (compondo fundos translúcidos).
 * Limite 3:1 (mínimo WCAG para texto grande / componentes). Ignora áreas com
 * imagem/gradiente de fundo, onde o fundo efetivo não é calculável.
 */
async function lowContrastText(page: Page) {
  return page.evaluate(() => {
    type RGBA = [number, number, number, number];
    // O navegador converte qualquer cor (oklch, oklab, color-mix...) em RGBA ao pintar num canvas.
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const cache = new Map<string, RGBA>();
    const parse = (c: string): RGBA => {
      if (cache.has(c)) return cache.get(c)!;
      const m = c.match(/^rgba?\(([^)]+)\)$/);
      let out: RGBA;
      if (m) {
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        out = [p[0], p[1], p[2], p[3] ?? 1];
      } else {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        out = [d[0], d[1], d[2], d[3] / 255];
      }
      cache.set(c, out);
      return out;
    };
    const over = (top: RGBA, bottom: RGBA): RGBA => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a) as RGBA;
    };
    const lum = ([r, g, b]: RGBA) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bgSource = "";
    const background = (el: Element): RGBA | null => {
      const layers: RGBA[] = [];
      bgSource = "";
      for (let n: Element | null = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.backgroundImage !== "none") return null;
        const c = parse(s.backgroundColor);
        if (c[3] > 0) {
          layers.push(c);
          if (!bgSource) bgSource = (typeof (n as HTMLElement).className === "string" ? (n as HTMLElement).className : "").split(/\s+/).filter((k) => /bg-|mac-/.test(k)).slice(0, 3).join(" ");
        }
        if (c[3] >= 1) break;
      }
      let acc: RGBA = parse(getComputedStyle(document.body).backgroundColor);
      if (acc[3] < 1) acc = [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
      return acc;
    };
    const out: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim().length > 1);
      if (!hasText || el.closest("svg,[aria-hidden=true],[disabled],[aria-disabled=true],[data-touch-exempt]")) continue;
      const rect = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (!rect.width || !rect.height || s.visibility === "hidden" || Number(s.opacity) < 0.5) continue;
      const bg = background(el);
      if (!bg) continue;
      const fg = over(parse(s.color), bg);
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      if (ratio < 3) {
        const cls = (typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "").split(/\s+/).filter((c) => /^(text|bg)-|mac-/.test(c)).slice(0, 4).join(" ");
        out.push(`${el.tagName.toLowerCase()}[${cls}] "${(el as HTMLElement).innerText.trim().slice(0, 30)}" ${ratio.toFixed(2)}:1 (rgb(${fg.slice(0, 3).map(Math.round).join(",")}) sobre rgb(${bg.slice(0, 3).map(Math.round).join(",")}) de [${bgSource}])`);
      }
    }
    return out;
  });
}

for (const route of ROUTES) {
  test(`${route} no tema escuro: sem quebra e com texto legível`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, route, 390, "dark");
    expect(await page.evaluate(() => document.documentElement.classList.contains("theme-dark"))).toBe(true);
    const result = await measure(page);
    const contrast = await lowContrastText(page);
    if (REPORT) {
      fs.appendFileSync(path.join(fixture.directory, "responsive-report.jsonl"), JSON.stringify({ key: `${route} @dark`, contrast, ...result, errors }) + "\n");
      await page.screenshot({ path: path.join(fixture.directory, `dark${route.replace(/\//g, "_") || "_root"}.png`), fullPage: true });
    }
    await context.close();
    expect(errors, "erros de execução").toEqual([]);
    expect(result.horizontalOverflow, "rolagem horizontal").toBeLessThanOrEqual(0);
    expect(contrast, "texto com contraste baixo no tema escuro").toEqual([]);
  });
}

test("barra lateral do desktop some no celular e aparece no desktop", async ({ browser }) => {
  for (const [width, visible] of [[390, false], [1280, true]] as const) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await open(page, "/dashboard", width);
    const sidebar = page.getByRole("complementary", { name: "Navegação principal" });
    if (visible) await expect(sidebar).toBeVisible();
    else await expect(sidebar).toBeHidden();
    await context.close();
  }
});

test("painel do Cofi: blocos lado a lado e atalhos da Central de Controle (claro e escuro)", async ({ browser }) => {
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, "/dashboard", 1280, theme);
    await page.getByRole("button", { name: /Abrir painel do Cofi/ }).click();
    await page.waitForTimeout(450); // fim da animação de abertura
    const shortcuts = page.getByRole("navigation", { name: "Atalhos do Cofi" });
    const capture = shortcuts.getByRole("button", { name: "Capturar gasto" });
    const calendar = shortcuts.getByRole("link", { name: "Calendário" });
    const [a, b] = [await capture.boundingBox(), await calendar.boundingBox()];
    expect(Math.abs(b!.y - a!.y), "atalhos na mesma linha").toBeLessThan(2);
    expect(b!.x, "atalhos lado a lado").toBeGreaterThan(a!.x + a!.width);
    await expect(page.getByRole("region", { name: "Próximos 7 dias" })).toBeVisible();
    if (REPORT) await page.screenshot({ path: path.join(fixture.directory, `painel-desktop-${theme}.png`) });
    await context.close();
    expect(errors).toEqual([]);
  }
});
