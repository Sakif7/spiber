import { defineConfig, devices } from "@playwright/test";

const PORT = 3940;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Runs the production server (no dev-server lock conflict). Requires a prior
  // `next build`; CI builds before running e2e.
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      JWT_SECRET: "e2e-access-secret",
      JWT_REFRESH_SECRET: "e2e-refresh-secret",
      APP_URL: BASE_URL,
    },
  },
});
