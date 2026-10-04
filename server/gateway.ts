import http from 'node:http';
import { z } from 'zod';
import {
  AnnotateRequestSchema,
  AnnotationSchema,
  buildAnnotateRequest,
  buildHintRequest,
  buildRecapRequest,
  HintRequestSchema,
  HintsSchema,
  RecapRequestSchema,
  recapSchemaFor,
  type Annotation,
  type GenerateContentBody,
  type Hints,
  type Recap,
} from '../src/ai/index.ts';
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

type Route = (env: GatewayEnv, deps: GatewayDeps, req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;

/** Calls `generateContent` on a model. Throws with Gemini's answer, for the gateway log, when it fails. */
async function generateContent(apiKey: string, deps: GatewayDeps, model: string, body: unknown) {
  const upstream = await deps.fetch(`${GEMINI_API_BASE}/${ENDPOINT_VERSIONS.generateContent}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const answer = (await upstream.json()) as {
    candidates?: { content?: { parts?: { text?: string; inlineData?: { data?: string } }[] } }[];
  };
  if (!upstream.ok) throw new Error(`${model} ${upstream.status}: ${JSON.stringify(answer)}`);
  const parts = answer.candidates?.[0]?.content?.parts ?? [];
  return { parts, answer };
}

const MOCK_RECAP: Recap = {
  outcome: 'You ordered a hot latte and paid. Nicely done!',
  corrections: [
    { said: 'ホットラテ ください', natural: 'ホットラテをください', why: 'Add を after the thing you are asking for.' },
    { said: 'はい', natural: 'はい、お願いします', why: 'お願いします makes a yes to an offer sound polite.' },
  ],
  newWords: [
    { base: 'いらっしゃいませ', reading: 'いらっしゃいませ', gloss: 'welcome (said by shop staff)' },
    { base: 'よろしいですか', reading: 'よろしいですか', gloss: 'is that all right? (polite)' },
  ],
  cefrEstimate: 'A1',
  lastTopic: 'a hot latte',
};

/**
 * Answers a prompted endpoint: validates the request, builds the body with the
 * builder from `ai`, and checks the model's JSON answer against its schema.
 * Gemini's own answer stays in the gateway log.
 */
async function promptedEndpoint<Request, Answer>(
  { env, deps, req, res }: { env: GatewayEnv; deps: GatewayDeps; req: http.IncomingMessage; res: http.ServerResponse },
  endpoint: {
    name: string;
    model: string;
    request: z.ZodType<Request>;
    build: (request: Request) => GenerateContentBody;
    answer: (request: Request) => z.ZodType<Answer>;
    mock: (request: Request) => Answer;
  },
) {
  const request = endpoint.request.safeParse(await readJson(req));
  if (!request.success) return sendJson(res, 400, { error: 'bad_request' });
  if (env.mock) return sendJson(res, 200, endpoint.mock(request.data));
  if (!env.apiKey) return sendJson(res, 503, { error: 'no_api_key' });

  try {
    const { parts, answer } = await generateContent(env.apiKey, deps, endpoint.model, endpoint.build(request.data));
    const text = parts.map((part) => part.text ?? '').join('');
    const checked = endpoint.answer(request.data).safeParse(JSON.parse(text || 'null'));
    if (!checked.success) throw new Error(`${endpoint.model} answered something that does not match its schema: ${JSON.stringify(answer)}`);
    return sendJson(res, 200, checked.data);
  } catch (error) {
    console.warn(`[gateway] /api/${endpoint.name} failed:`, error instanceof Error ? error.message : error);
    return sendJson(res, 502, { error: `${endpoint.name}_unavailable` });
  }
}

/** POST /api/recap: a Recap of a conversation, built from the transcript, the Help log, the interaction, the step and the Native Language. */
const recap: Route = (env, deps, req, res) =>
  promptedEndpoint(
    { env, deps, req, res },
    {
      name: 'recap',
      model: MODELS.recap,
      request: RecapRequestSchema,
      build: buildRecapRequest,
      answer: (request) => recapSchemaFor(request.kind),
      mock: () => MOCK_RECAP,
    },
  );

// Canned hints in mock mode: full sentences the scripted fake barista understands.
const MOCK_HINTS: Record<TargetLanguage, Hints['hints']> = {
  ja: [
    { text: 'ホットラテをください。', translation: 'A hot latte, please.' },
    { text: 'メニューをください。', translation: 'The menu, please.' },
    { text: 'もう一度お願いします。', translation: 'Once more, please.' },
  ],
  zh: [
    { text: '请给我一杯热拿铁。', translation: 'A hot latte, please.' },
    { text: '请给我看一下菜单。', translation: 'The menu, please.' },
  ],
  en: [
    { text: 'Could I have a latte, please?', translation: 'Could I have a latte, please?' },
    { text: 'Could I see the menu, please?', translation: 'Could I see the menu, please?' },
  ],
  de: [
    { text: 'Einen Latte, bitte.', translation: 'A latte, please.' },
    { text: 'Kann ich bitte die Karte sehen?', translation: 'Can I see the menu, please?' },
  ],
};

/** POST /api/hint: 2–3 hint sentences with translations, for the moment the Player opened Help. */
const hint: Route = (env, deps, req, res) =>
  promptedEndpoint(
    { env, deps, req, res },
    {
      name: 'hint',
      model: MODELS.hint,
      request: HintRequestSchema,
      build: buildHintRequest,
      answer: () => HintsSchema,
      mock: (request): Hints => ({ hints: MOCK_HINTS[request.culturePackId] }),
    },
  );

/** POST /api/annotate: an NPC line's Native Language translation, as soon as the line is finished. */
const annotate: Route = (env, deps, req, res) =>
  promptedEndpoint(
    { env, deps, req, res },
    {
      name: 'annotate',
      model: MODELS.annotate,
      request: AnnotateRequestSchema,
      build: buildAnnotateRequest,
      answer: () => AnnotationSchema,
      mock: (request): Annotation => ({ translation: `Mock translation: ${request.line}` }),
    },
  );

// Gemini TTS answers with 16-bit mono PCM at this rate.
const TTS_SAMPLE_RATE = 24_000;

/** A short, soft beep: the canned hear-it-said clip in mock mode. */
function mockClip() {
  const samples = new Int16Array(TTS_SAMPLE_RATE / 4);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / TTS_SAMPLE_RATE) * 0x0800);
  return Buffer.from(samples.buffer).toString('base64');
}

// Hear-it-said is for a phrase or a sentence, never a speech.
const TtsRequestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  targetLanguage: z.enum(Object.keys(VOICES) as [TargetLanguage, ...TargetLanguage[]]),
});

// The part of Gemini's TTS answer the gateway uses.
const TtsAnswerSchema = z.object({ inlineData: z.object({ data: z.string().min(1) }) });

/** POST /api/tts: hear-it-said, a phrase said aloud in the voice for its language, as base64 PCM. */
async function tts(env: GatewayEnv, deps: GatewayDeps, req: http.IncomingMessage, res: http.ServerResponse) {
  const request = TtsRequestSchema.safeParse(await readJson(req));
  if (!request.success) return sendJson(res, 400, { error: 'bad_request' });
  const { text, targetLanguage } = request.data;
  if (env.mock) return sendJson(res, 200, { audio: mockClip(), sampleRate: TTS_SAMPLE_RATE });
  if (!env.apiKey) return sendJson(res, 503, { error: 'no_api_key' });

  try {
    const { parts, answer } = await generateContent(env.apiKey, deps, MODELS.tts, {
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[targetLanguage] } } },
      },
    });
    const audio = parts.map((part) => TtsAnswerSchema.safeParse(part)).find((part) => part.success);
    if (!audio?.success) throw new Error(`${MODELS.tts} gave no audio: ${JSON.stringify(answer)}`);
    return sendJson(res, 200, { audio: audio.data.inlineData.data, sampleRate: TTS_SAMPLE_RATE });
  } catch (error) {
    console.warn('[gateway] could not say a phrase:', error instanceof Error ? error.message : error);
    return sendJson(res, 502, { error: 'tts_unavailable' });
  }
}

const REAL_DEPS: GatewayDeps = { fetch: (...args) => globalThis.fetch(...args), now: () => Date.now() };

const ROUTES: Record<string, Route> = {
  '/api/token': mintToken,
  '/api/recap': recap,
  '/api/hint': hint,
  '/api/annotate': annotate,
  '/api/tts': tts,
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
