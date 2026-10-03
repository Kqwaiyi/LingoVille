import http from 'node:http';
import {
  DEFAULT_GATEWAY_PORT,
  ENDPOINT_VERSIONS,
  GEMINI_API_BASE,
  GEMINI_LIVE_WS_BASE,
  LIVE_ENDPOINT,
  MODELS,
  VOICES,
  type TargetLanguage,
} from './config.ts';

export type GatewayEnv = {
  mock: boolean;
  apiKey: string | undefined;
  port: number;
};

/** What the gateway reaches outside itself, so tests can stand in for Gemini. */
export type GatewayDeps = {
  fetch: typeof globalThis.fetch;
  now: () => number;
};

export function readGatewayEnv(env: Record<string, string | undefined>): GatewayEnv {
  return {
    mock: env.GEMINI_MOCK === '1',
    apiKey: env.GEMINI_API_KEY || undefined,
    port: parsePort(env.GATEWAY_PORT),
  };
}

function parsePort(value: string | undefined): number {
  if (!value) return DEFAULT_GATEWAY_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`GATEWAY_PORT must be a port number (1–65535), got "${value}"`);
  }
  return port;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Requests are small JSON; anything bigger isn't from the game.
const MAX_BODY_BYTES = 64 * 1024;

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY_BYTES) return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// The token is for one session that must start within a minute.
const NEW_SESSION_WITHIN_MS = 60_000;
// Long enough for any conversation; the retry after a drop mints a fresh token.
const TOKEN_LIFETIME_MS = 30 * 60_000;

const MOCK_TOKEN = 'mock-ephemeral-token';

function requestedLanguage(body: unknown): TargetLanguage | undefined {
  const language = (body as { voice?: { targetLanguage?: unknown } } | undefined)?.voice?.targetLanguage;
  return typeof language === 'string' && Object.hasOwn(VOICES, language) ? (language as TargetLanguage) : undefined;
}

/** POST /api/token: a one-use ephemeral token for one Live session, with everything the browser needs to open it. */
async function mintToken(env: GatewayEnv, deps: GatewayDeps, req: http.IncomingMessage, res: http.ServerResponse) {
  const language = requestedLanguage(await readJson(req));
  if (!language) return sendJson(res, 400, { error: 'bad_request' });

  const session = {
    model: MODELS.live,
    voiceName: VOICES[language],
    url: `${GEMINI_LIVE_WS_BASE}${ENDPOINT_VERSIONS.live}.${LIVE_ENDPOINT}`,
  };
  if (env.mock) return sendJson(res, 200, { mock: true, token: MOCK_TOKEN, ...session });
  if (!env.apiKey) return sendJson(res, 503, { error: 'no_api_key' });

  const now = deps.now();
  try {
    const upstream = await deps.fetch(`${GEMINI_API_BASE}/${ENDPOINT_VERSIONS.authTokens}/auth_tokens`, {
      method: 'POST',
      headers: { 'x-goog-api-key': env.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + TOKEN_LIFETIME_MS).toISOString(),
        newSessionExpireTime: new Date(now + NEW_SESSION_WITHIN_MS).toISOString(),
      }),
    });
    const body = (await upstream.json()) as { name?: unknown };
    if (!upstream.ok || typeof body.name !== 'string') throw new Error(`auth_tokens ${upstream.status}: ${JSON.stringify(body)}`);
    return sendJson(res, 200, { mock: false, token: body.name, ...session });
  } catch (error) {
    // Gemini's answer stays in the gateway log; the browser only learns that voice is unavailable.
    console.warn('[gateway] could not mint a Live token:', error instanceof Error ? error.message : error);
    return sendJson(res, 502, { error: 'token_unavailable' });
  }
}

const REAL_DEPS: GatewayDeps = { fetch: (...args) => globalThis.fetch(...args), now: () => Date.now() };

export function createGateway(env: GatewayEnv, deps: GatewayDeps = REAL_DEPS): http.Server {
  return http.createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://gateway');

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, mock: env.mock, keyConfigured: env.apiKey !== undefined });
    }
    if (req.method === 'POST' && pathname === '/api/token') {
      mintToken(env, deps, req, res).catch((error) => {
        console.error('[gateway] /api/token failed:', error);
        if (!res.headersSent) sendJson(res, 500, { error: 'internal' });
      });
      return;
    }

    return sendJson(res, 404, { error: 'not_found' });
  });
}
