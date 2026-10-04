import { defineConfig, devices } from '@playwright/test';

// The smoke run gets its own ports so it never reuses a real-mode dev server.
const WEB_PORT = '5180';
const GATEWAY_PORT = '8790';

export default defineConfig({
  testDir: './e2e',
  // Every test boots the 3D scene with software WebGL. In parallel that swamps a laptop and tests
  // time out, so they run one at a time. Pass `--workers=N` to try more on a bigger machine.
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // A fake mic, already allowed, that beeps about once a second, so the mic check can hear it.
        permissions: ['microphone'],
        launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { GEMINI_MOCK: '1', WEB_PORT, GATEWAY_PORT },
  },
});
