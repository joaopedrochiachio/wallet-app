import { expect, test } from "@playwright/test";

test("a pilha abre e permite arrastar um cartão para a frente", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  const stack = page.getByTestId("wallet-card-stack");
  await expect(stack).toBeVisible();
  await page.waitForTimeout(750);

  await page.getByRole("button", { name: "Ver todos os cartões" }).click();
  await expect(stack).toHaveAttribute("data-expanded", "true");
  await page.waitForTimeout(550);

  const cards = stack.locator("[data-card-id]");
  await expect(cards).toHaveCount(3);

  const secondCard = cards.nth(1);
  await secondCard.scrollIntoViewIfNeeded();
  const secondCardId = await secondCard.getAttribute("data-card-id");
  const box = await secondCard.boundingBox();

  expect(secondCardId).toBeTruthy();
  expect(box).not.toBeNull();
  if (!box) return;

  // Start in the exposed header and pull the card one slot toward the front.
  const startX = box.x + box.width / 2;
  const startY = box.y + 24;
  const hitCardId = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest("[data-card-id]")?.getAttribute("data-card-id"),
    { x: startX, y: startY },
  );
  expect(hitCardId).toBe(secondCardId);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await expect(secondCard).toHaveClass(/transition-none/);
  await page.mouse.move(box.x + box.width / 2, box.y + 124, { steps: 8 });
  await page.mouse.up();

  await expect(stack.locator(`[data-card-id="${secondCardId}"]`)).toHaveAttribute(
    "data-card-index",
    "0",
  );
});

test("o mesmo gesto funciona por toque em uma tela de iPhone", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  try {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const stack = page.getByTestId("wallet-card-stack");
    await expect(stack).toBeVisible();
    await page.waitForTimeout(750);

    await page.getByRole("button", { name: "Ver todos os cartões" }).tap();
    await expect(stack).toHaveAttribute("data-expanded", "true");
    await page.waitForTimeout(550);

    const cards = stack.locator("[data-card-id]");
    const secondCard = cards.nth(1);
    await secondCard.scrollIntoViewIfNeeded();

    const cardId = await secondCard.getAttribute("data-card-id");
    const box = await secondCard.boundingBox();
    expect(cardId).toBeTruthy();
    expect(box).not.toBeNull();
    if (!box) return;

    const client = await context.newCDPSession(page);
    const x = box.x + box.width / 2;
    const startY = box.y + 24;

    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: startY }],
    });
    for (let step = 1; step <= 8; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: startY + step * 13 }],
      });
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expect(stack.locator(`[data-card-id="${cardId}"]`)).toHaveAttribute(
      "data-card-index",
      "0",
    );
  } finally {
    await context.close();
  }
});
