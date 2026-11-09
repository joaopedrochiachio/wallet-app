import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "ai-chat.spec.ts",
  outputDir: "../node_modules/.cache/wallet-ai-chat-test/results",
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: { ...devices["Desktop Chrome"] },
});
