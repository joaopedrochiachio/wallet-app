import { expect, test } from "@playwright/test";

test("rotas internas sem sessão voltam para a apresentação", async ({ page }) => {
  await page.goto("/planning", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", {
      name: "Uma nova dimensão para a sua vida financeira.",
    }),
  ).toBeVisible();
});

test("a apresentação direciona visitantes para o login", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const accessWallet = page.getByRole("link", { name: "Acessar Carteira" });
  await expect(accessWallet).toHaveAttribute("href", "/login");
  await accessWallet.click();

  await expect(page).toHaveURL("/login");
  await expect(
    page.getByRole("heading", { name: "Acessar Carteira" }),
  ).toBeVisible();
});
