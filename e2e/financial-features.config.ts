import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "financial-features.spec.ts", workers: 1, timeout: 30000,
  outputDir: "../node_modules/.cache/wallet-financial-features/results", reporter: "list",
  use: { ...devices["Desktop Chrome"] },
});
