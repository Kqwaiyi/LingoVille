import { existsSync } from 'node:fs';
import { createGateway, readGatewayEnv } from './gateway.ts';

// The key lives only in the gitignored .env at the repo root. Variables already
// set in the shell (e.g. GEMINI_MOCK=1 from Playwright) take precedence.
if (existsSync('.env')) process.loadEnvFile('.env');

const env = readGatewayEnv(process.env);

if (!env.mock && !env.apiKey) {
  console.warn('[gateway] No GEMINI_API_KEY in .env. Copy .env.example to .env, or run with GEMINI_MOCK=1.');
}

createGateway(env).listen(env.port, '127.0.0.1', () => {
  console.log(`[gateway] listening on http://127.0.0.1:${env.port} (${env.mock ? 'mock' : 'real'} mode)`);
});
