import { defineConfig, devices } from '@playwright/test';

// The smoke run gets its own ports so it never reuses a real-mode dev server.
const WEB_PORT = '5180';
const GATEWAY_PORT = '8790';

// Headless Chromium draws WebGL in software by default, which makes every frame of the 3D scene,
// and so every Playwright action, slow. These flags put it on the GPU; without one it falls back
// to software as before. D3D11 is the ANGLE backend that finds the discrete GPU on Windows.
const GPU_ARGS = ['--enable-gpu', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])];

export default defineConfig({
  testDir: './e2e',
  // Every test boots the 3D scene, so 2 run at a time. Not 4: on the dev's laptop (RTX 3060, 16 threads), 4 workers
  // roughly doubled each test's duration and surfaced flakes. Before raising it, check the suite passes
  // `--workers=N --repeat-each=3`.
  workers: 2,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Off: recording a trace cost every test a second or two, even the ones that passed. Re-run a failing
    // test with `--trace=on` for one; e2e/test.ts still names any crash in the page. No retries, so a
    // flake stays visible.
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // A fake mic, already allowed, that beeps about once a second, so the mic check can hear it.
        permissions: ['microphone'],
        launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...GPU_ARGS] },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    // The fake NPC answers in 50ms instead of a real NPC's 600: still later, never within the same call, but fast.
    env: { GEMINI_MOCK: '1', GEMINI_MOCK_REPLY_MS: '50', WEB_PORT, GATEWAY_PORT },
  },
});
