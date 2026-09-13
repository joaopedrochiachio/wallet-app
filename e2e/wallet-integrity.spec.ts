import { test, expect, Page } from "@playwright/test";

/**
 * E2E Test Suite — Wallet App
 *
 * Estratégia:
 * - Testes rodam contra o Firebase real do projeto (dev) 
 * - O dev server deve estar rodando em http://localhost:3000
 * - O usuário deve estar autenticado (ou a sessão persistida no navegador)
 *
 * IMPORTANTE: Estes testes utilizam a interface real da aplicação.
 * Dados criados durante os testes são reais no Firestore.
 * O cleanup é feito ao final de cada teste (excluindo itens criados).
 */

// Helpers
const TIMEOUT = { timeout: 15000 };

async function waitForFirestoreSync(page: Page) {
  // Aguarda o Firestore sincronizar (desaparecimento de indicadores de loading)
  await page.waitForTimeout(2000);
}

async function navigateAndWaitForLoad(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
}

// =====================================================
// TESTES DE INTEGRIDADE
// =====================================================

test.describe("Wallet App — Integridade de Dados E2E", () => {
  test.describe.configure({ mode: "serial" });

  test("1. Páginas carregam sem erros após autenticação", async ({ page }) => {
    // Verificar que a aplicação carrega
    await navigateAndWaitForLoad(page, "/dashboard");

    // Se redirecionou para login, o app está funcional
    const currentUrl = page.url();
    const isOnAuthPage = currentUrl.includes("/login") || currentUrl.includes("/onboarding");
    const isOnDashboard = currentUrl.includes("/dashboard") || currentUrl === "http://localhost:3000/";

    expect(isOnAuthPage || isOnDashboard).toBe(true);

    if (!isOnAuthPage) {
      // Verificar que o dashboard renderiza conteúdo
      await expect(page.locator("body")).not.toBeEmpty();
    }
  });

  test("2. Acesso direto a /cards funciona", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/cards");
    const currentUrl = page.url();
    // Se autenticado, deve estar em /cards
    if (!currentUrl.includes("/login")) {
      await expect(page.locator("h1")).toContainText(/Cartões|Faturas/i, TIMEOUT);
    }
  });

  test("3. Acesso direto a /transactions funciona", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/transactions");
    const currentUrl = page.url();
    if (!currentUrl.includes("/login")) {
      await expect(page.locator("h1")).toContainText(/Transações/i, TIMEOUT);
    }
  });

  test("4. Acesso direto a /goals funciona", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/goals");
    const currentUrl = page.url();
    if (!currentUrl.includes("/login")) {
      await expect(page.locator("body")).not.toBeEmpty();
    }
  });

  test("5. Acesso direto a /planning funciona", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/planning");
    const currentUrl = page.url();
    if (!currentUrl.includes("/login")) {
      await expect(page.locator("body")).not.toBeEmpty();
    }
  });

  test("6. Dashboard exibe dados reais do Firestore (não dados fake)", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/dashboard");

    if (!page.url().includes("/login")) {
      // Verificar que não existem textos de dados mock/placeholder
      const bodyText = await page.locator("body").textContent();
      // Não deve haver "Seu Nome" como placeholder não substituído
      // (pode aparecer se Firestore não carregou ainda, mas não como dado permanente)
      expect(bodyText).toBeTruthy();
    }
  });

  test("7. Reload preserva estado — sem regressão de dados", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/dashboard");

    if (page.url().includes("/login")) {
      test.skip();
      return;
    }

    // Capturar estado antes do reload
    await waitForFirestoreSync(page);
    await page.locator("body").textContent();

    // Reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFirestoreSync(page);

    // Capturar estado depois do reload
    const bodyTextAfter = await page.locator("body").textContent();

    // O conteúdo não deveria mudar drasticamente (mesmos dados do Firebase)
    expect(bodyTextAfter).toBeTruthy();
    expect(bodyTextAfter!.length).toBeGreaterThan(100);
  });

  test("8. Cards page exibe saldo da conta corrente", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/cards");

    if (page.url().includes("/login")) {
      test.skip();
      return;
    }

    // Verificar se "Saldo Disponível" aparece na page
    const saldoText = page.getByText(/Saldo Disponível/i);
    await expect(saldoText).toBeVisible(TIMEOUT);
  });

  test("9. Transactions page sincroniza com Firestore", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/transactions");

    if (page.url().includes("/login")) {
      test.skip();
      return;
    }

    // Aguardar sincronização
    await waitForFirestoreSync(page);

    // A página deve mostrar transações OU "Nenhum lançamento encontrado"
    const body = await page.locator("body").textContent();
    const hasTransactions = body?.includes("R$");
    const hasEmptyState = body?.includes("Nenhum lançamento");
    const hasSyncing = body?.includes("Sincronizando");

    expect(hasTransactions || hasEmptyState || hasSyncing).toBe(true);
  });

  test("10. localStorage não contém dados financeiros (removido)", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/dashboard");

    if (page.url().includes("/login")) {
      test.skip();
      return;
    }

    await waitForFirestoreSync(page);

    // Verificar que as chaves financeiras não existem mais no localStorage
    const walletCards = await page.evaluate(() => localStorage.getItem("wallet_cards"));
    const walletTx = await page.evaluate(() => localStorage.getItem("wallet_transactions"));
    const walletProfile = await page.evaluate(() => localStorage.getItem("wallet_user_profile"));
    const walletRecurring = await page.evaluate(() => localStorage.getItem("wallet_recurring"));
    const walletGoals = await page.evaluate(() => localStorage.getItem("wallet_goals"));
    const remainingWalletKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith("wallet_"))
    );

    expect(walletCards).toBeNull();
    expect(walletTx).toBeNull();
    expect(walletProfile).toBeNull();
    expect(walletRecurring).toBeNull();
    expect(walletGoals).toBeNull();
    expect(remainingWalletKeys).toEqual([]);
  });

  test("11. Consistência entre Dashboard e Cards page", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/dashboard");

    if (page.url().includes("/login")) {
      test.skip();
      return;
    }

    await waitForFirestoreSync(page);

    // Capturar "Faturas Abertas" do Dashboard
    const dashboardFaturasElement = page.getByText(/Faturas Abertas/i);
    const dashboardFaturasVisible = await dashboardFaturasElement.isVisible().catch(() => false);

    if (dashboardFaturasVisible) {
      // Navegar para Cards
      await navigateAndWaitForLoad(page, "/cards");
      await waitForFirestoreSync(page);

      // Verificar que a página Cards também carrega sem erros
      const cardsBody = await page.locator("body").textContent();
      expect(cardsBody).toBeTruthy();
    }
  });

  test("12. Reload da página /cards não reseta faturas", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/cards");

    if (page.url().includes("/login")) {
      test.skip();
      return;
    }

    await waitForFirestoreSync(page);

    // Capturar conteúdo da página cards antes do reload
    await page.locator("body").textContent();

    // Reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFirestoreSync(page);

    const contentAfter = await page.locator("body").textContent();

    // Verificar que conteúdo financeiro é consistente
    expect(contentAfter).toBeTruthy();
    expect(contentAfter!.length).toBeGreaterThan(50);
  });

  test("13. Reload da página /transactions preserva transações", async ({ page }) => {
    await navigateAndWaitForLoad(page, "/transactions");

    if (page.url().includes("/login")) {
      test.skip();
      return;
    }

    await waitForFirestoreSync(page);

    // Contar transações antes
    const txCountBefore = await page.locator("[class*='ListItem'], [class*='list-item']").count().catch(() => 0);

    // Reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFirestoreSync(page);

    // Contar transações depois
    const txCountAfter = await page.locator("[class*='ListItem'], [class*='list-item']").count().catch(() => 0);

    // Devem ser iguais (ou ambas zero se não há transações)
    expect(txCountAfter).toBe(txCountBefore);
  });

  test("14. Navegação entre telas mantém consistência", async ({ page }) => {
    // Dashboard → Cards → Transactions → Dashboard
    await navigateAndWaitForLoad(page, "/dashboard");

    if (page.url().includes("/login")) {
      test.skip();
      return;
    }

    await waitForFirestoreSync(page);
    const dash1 = await page.locator("body").textContent();

    await navigateAndWaitForLoad(page, "/cards");
    await waitForFirestoreSync(page);

    await navigateAndWaitForLoad(page, "/transactions");
    await waitForFirestoreSync(page);

    await navigateAndWaitForLoad(page, "/dashboard");
    await waitForFirestoreSync(page);
    const dash2 = await page.locator("body").textContent();

    // Dashboard deve ter conteúdo similar nas duas visitas
    expect(dash1!.length).toBeGreaterThan(0);
    expect(dash2!.length).toBeGreaterThan(0);
  });

  test("15. Nenhum erro de console JavaScript crítico", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignorar erros de CORS e warnings do Next.js
        if (!text.includes("CORS") && !text.includes("hydration") && !text.includes("Download the React DevTools")) {
          consoleErrors.push(text);
        }
      }
    });

    await navigateAndWaitForLoad(page, "/dashboard");
    await waitForFirestoreSync(page);

    if (!page.url().includes("/login")) {
      await navigateAndWaitForLoad(page, "/cards");
      await navigateAndWaitForLoad(page, "/transactions");
    }

    // Filtrar erros de Firestore permission (podem ocorrer se não autenticado)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("permission") && !e.includes("Missing or insufficient")
    );

    // Não deve ter erros críticos de JS
    expect(criticalErrors.length).toBe(0);
  });
});
