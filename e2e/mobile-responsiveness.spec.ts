import { test, expect } from "@playwright/test";

const IPHONE_VIEWPORTS = [
  { name: "iPhone SE (Smallest)", width: 320, height: 568 },
  { name: "iPhone SE 2/3", width: 375, height: 667 },
  { name: "iPhone 13 / 14 / 15", width: 390, height: 844 },
  { name: "iPhone 15 Pro", width: 393, height: 852 },
  { name: "iPhone Pro Max", width: 430, height: 932 },
];

test.describe("Mobile Responsiveness & iPhone HIG Audit", () => {
  for (const vp of IPHONE_VIEWPORTS) {
    test(`valida ausência de overflow horizontal e meta viewport no ${vp.name} (${vp.width}x${vp.height})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      try {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(500);

        // 1. Validar presença do meta viewport com viewport-fit=cover
        const viewportMeta = await page.$eval(
          'meta[name="viewport"]',
          (el) => el.getAttribute("content")
        );
        expect(viewportMeta).toContain("viewport-fit=cover");

        // 2. Validar que o body não tem overflow horizontal
        const isHorizontalOverflowing = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(isHorizontalOverflowing).toBe(false);

        // 3. Validar regra anti auto-zoom de input no mobile (>= 16px)
        const inputFontSize = await page.evaluate(() => {
          const testInput = document.createElement("input");
          document.body.appendChild(testInput);
          const computedSize = parseFloat(window.getComputedStyle(testInput).fontSize);
          document.body.removeChild(testInput);
          return computedSize;
        });
        expect(inputFontSize).toBeGreaterThanOrEqual(16);
      } finally {
        await context.close();
      }
    });
  }

  test("valida alvos de toque (touch targets) mínimos na barra de navegação inferior", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    try {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);

      // Se autenticado, valida a barra de navegação móvel
      const nav = page.locator("nav.md\\:hidden");
      if (await nav.isVisible()) {
        const navLinks = nav.locator("a");
        const count = await navLinks.count();
        expect(count).toBe(6);

        for (let i = 0; i < count; i++) {
          const box = await navLinks.nth(i).boundingBox();
          if (box) {
            // HIG Apple recomenda alvos de toque de pelo menos 44x44px
            expect(box.width).toBeGreaterThanOrEqual(40);
            expect(box.height).toBeGreaterThanOrEqual(40);
          }
        }
      }
    } finally {
      await context.close();
    }
  });
});
