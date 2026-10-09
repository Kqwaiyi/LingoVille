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
  // Every test boots the 3D scene, which can swamp a laptop without a GPU, so they run one at a
  // time. Pass `--workers=N` to try more.
  workers: 1,
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
    env: { GEMINI_MOCK: '1', WEB_PORT, GATEWAY_PORT },
  },
});
