import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "responsive-audit.spec.ts",
  outputDir: "../node_modules/.cache/wallet-responsive/results",
  workers: 2,
  timeout: 45000,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], timezoneId: "America/Sao_Paulo" },
});
