import { defineConfig, devices } from "@playwright/test";

const WITH_DATA_PORT = 4310;
const NO_DATA_PORT = 4311;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testMatch: "site.spec.ts",
      use: {
        baseURL: `http://127.0.0.1:${WITH_DATA_PORT}`,
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "mobile",
      testMatch: "site.spec.ts",
      use: {
        baseURL: `http://127.0.0.1:${WITH_DATA_PORT}`,
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: "no-data",
      testMatch: "no-data.spec.ts",
      use: { baseURL: `http://127.0.0.1:${NO_DATA_PORT}` },
    },
  ],
  webServer: [
    {
      command: `node e2e/serve.ts .e2e/with-data ${WITH_DATA_PORT}`,
      url: `http://127.0.0.1:${WITH_DATA_PORT}/patch-notice/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node e2e/serve.ts .e2e/no-data ${NO_DATA_PORT}`,
      url: `http://127.0.0.1:${NO_DATA_PORT}/patch-notice/`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
