import http from 'node:http';
import { z } from 'zod';
import { NAMED_NPC_IDS } from '../src/content/index.ts';
import { LANGUAGE_CODES } from '../src/sim/index.ts';
import {
  DEFAULT_GATEWAY_PORT,
  ENDPOINT_VERSIONS,
  GEMINI_API_BASE,
  GEMINI_LIVE_WS_BASE,
  LIVE_ENDPOINT,
  MODELS,
  NAMED_NPC_VOICES,
  type VoiceName,
} from './config.ts';

export type GatewayEnv = {
  mock: boolean;
  apiKey: string | undefined;
  port: number;
  /** How long the scripted fake NPC waits before each answer, in mock mode. */
  mockReplyDelayMs: number;
};

/** What the gateway reaches outside itself, so something else can stand in for Gemini. */
export type GatewayDeps = {
  fetch: typeof globalThis.fetch;
  now: () => number;
};

export function readGatewayEnv(env: Record<string, string | undefined>): GatewayEnv {
  return {
    mock: env.GEMINI_MOCK === '1',
    apiKey: env.GEMINI_API_KEY || undefined,
    port: parsePort(env.GATEWAY_PORT),
    mockReplyDelayMs: parseMockReplyDelayMs(env.GEMINI_MOCK_REPLY_MS),
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

/** Roughly how long the real NPC takes to start answering, so mock-mode play feels the same. */
const DEFAULT_MOCK_REPLY_DELAY_MS = 600;

// Checked in real mode too, so a typo in .env is caught whichever mode it's in.
function parseMockReplyDelayMs(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_MOCK_REPLY_DELAY_MS;
  if (!/^\d+$/.test(value)) {
    throw new Error(`GEMINI_MOCK_REPLY_MS must be a whole number of milliseconds (0 or more), got "${value}"`);
  }
  return Number(value);
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

// Whose voice: a Named NPC's, by their id.
const VoiceRequestSchema = z.object({ targetLanguage: z.enum(LANGUAGE_CODES), npcId: z.enum(NAMED_NPC_IDS) });

const TokenRequestSchema = z.object({ voice: VoiceRequestSchema });

/** The prebuilt voice an NPC speaks in: a Named NPC's own. */
function requestedVoice(voice: z.infer<typeof VoiceRequestSchema>): VoiceName {
  return NAMED_NPC_VOICES[voice.npcId];
}

/** Where and how a Live session with this prebuilt voice opens. */
export const liveSessionTarget = (voiceName: VoiceName) => ({
  model: MODELS.live,
  voiceName,
  url: `${GEMINI_LIVE_WS_BASE}${ENDPOINT_VERSIONS.live}.${LIVE_ENDPOINT}`,
});

/** Mints a one-use ephemeral token for one Live session. Throws with Gemini's answer when it can't. */
export async function mintLiveToken(apiKey: string, deps: GatewayDeps): Promise<string> {
  const now = deps.now();
  const upstream = await deps.fetch(`${GEMINI_API_BASE}/${ENDPOINT_VERSIONS.authTokens}/auth_tokens`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + TOKEN_LIFETIME_MS).toISOString(),
      newSessionExpireTime: new Date(now + NEW_SESSION_WITHIN_MS).toISOString(),
    }),
  });
  const body = (await upstream.json()) as { name?: unknown };
  if (!upstream.ok || typeof body.name !== 'string') throw new Error(`auth_tokens ${upstream.status}: ${JSON.stringify(body)}`);
  return body.name;
}

/** POST /api/token: a one-use ephemeral token for one Live session, with everything the browser needs to open it. */
async function mintToken(env: GatewayEnv, deps: GatewayDeps, req: http.IncomingMessage, res: http.ServerResponse) {
  const request = TokenRequestSchema.safeParse(await readJson(req));
  if (!request.success) return sendJson(res, 400, { error: 'bad_request' });
  const voiceName = requestedVoice(request.data.voice);

  const session = liveSessionTarget(voiceName);
  if (env.mock) return sendJson(res, 200, { mock: true, token: MOCK_TOKEN, ...session, replyDelayMs: env.mockReplyDelayMs });
  if (!env.apiKey) return sendJson(res, 503, { error: 'no_api_key' });

  try {
    return sendJson(res, 200, { mock: false, token: await mintLiveToken(env.apiKey, deps), ...session });
  } catch (error) {
    // Gemini's answer stays in the gateway log; the browser only learns that voice is unavailable.
    console.warn('[gateway] could not mint a Live token:', error instanceof Error ? error.message : error);
    return sendJson(res, 502, { error: 'token_unavailable' });
  }
}

type Route = (env: GatewayEnv, deps: GatewayDeps, req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;

const REAL_DEPS: GatewayDeps = { fetch: (...args) => globalThis.fetch(...args), now: () => Date.now() };

const ROUTES: Record<string, Route> = {
  '/api/token': mintToken,
};

export function createGateway(env: GatewayEnv, deps: GatewayDeps = REAL_DEPS): http.Server {
  return http.createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://gateway');

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, mock: env.mock, keyConfigured: env.apiKey !== undefined });
    }
    const route = req.method === 'POST' ? ROUTES[pathname] : undefined;
    if (route) {
      route(env, deps, req, res).catch((error) => {
        console.error(`[gateway] ${pathname} failed:`, error);
        if (!res.headersSent) sendJson(res, 500, { error: 'internal' });
      });
      return;
    }

    return sendJson(res, 404, { error: 'not_found' });
  });
}
