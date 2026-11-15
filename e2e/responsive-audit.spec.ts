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


async function open(page: Page, route: string, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.route("https://wallet.test/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div></body></html>',
    })
  );
  await page.route("**/api/**", (r) => r.fulfill({ contentType: "application/json", body: '{"success":false}' }));
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
  { name: "novo cartão", route: "/cards", steps: (p) => p.getByRole("button", { name: "Novo Cartão", exact: true }).click() },
  { name: "nova compra", route: "/cards", steps: (p) => p.getByRole("button", { name: "Nova Compra", exact: true }).click() },
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
  { name: "chat de IA", route: "/ai", steps: (p) => p.getByRole("button", { name: "Chat IA", exact: true }).click() },
  {
    name: "chat com conversas e simulador", route: "/ai",
    steps: async (p) => {
      await p.getByRole("button", { name: "Chat IA", exact: true }).click();
      await p.getByRole("button", { name: "Simular", exact: true }).click();
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
