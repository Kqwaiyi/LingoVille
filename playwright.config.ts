import { defineConfig, devices } from '@playwright/test';

// The smoke run gets its own ports so it never reuses a real-mode dev server.
const WEB_PORT = '5180';
const GATEWAY_PORT = '8790';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { GEMINI_MOCK: '1', WEB_PORT, GATEWAY_PORT },
  },
});
