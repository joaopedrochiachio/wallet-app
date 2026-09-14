import { expect, test } from "@playwright/test";

test("planejamento mantém resumo visível enquanto os filtros mudam", async ({ page }) => {
  await page.goto("/planning", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(750);
  test.skip(new URL(page.url()).pathname === "/", "Requer uma sessão autenticada.");

  const macroSummary = page.getByTestId("monthly-macro-summary");
  const movementOverview = page.getByTestId("monthly-movement-overview");

  await expect(macroSummary).toBeVisible();
  await expect(macroSummary).toContainText("Composição dos compromissos");
  await expect(movementOverview).toBeVisible();
  await expect(movementOverview).toContainText("Resumo do recorte");

  const creditFilter = movementOverview.getByRole("button", { name: /Crédito/ });
  await creditFilter.click();
  await expect(creditFilter).toHaveAttribute("aria-pressed", "true");
  await expect(movementOverview).toContainText("Foi para faturas");

  await movementOverview
    .getByRole("combobox", { name: "Filtrar entradas e saídas" })
    .selectOption("despesa");
  await movementOverview.getByPlaceholder("Buscar lançamento...").fill("spotify");

  await expect(
    movementOverview.getByRole("button", { name: "Limpar filtros" }).first(),
  ).toBeVisible();
});

test("filtros e visão macro continuam acessíveis no layout móvel", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  try {
    await page.goto("/planning", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(750);
    test.skip(new URL(page.url()).pathname === "/", "Requer uma sessão autenticada.");

    const movementOverview = page.getByTestId("monthly-movement-overview");
    await expect(page.getByTestId("monthly-macro-summary")).toBeVisible();
    await expect(movementOverview).toBeVisible();

    const balanceFilter = movementOverview.getByRole("button", {
      name: /Pix \/ saldo/,
    });
    await balanceFilter.tap();
    await expect(balanceFilter).toHaveAttribute("aria-pressed", "true");
    await expect(movementOverview).toContainText("Resumo do recorte");
  } finally {
    await context.close();
  }
});
