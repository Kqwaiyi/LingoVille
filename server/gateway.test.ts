import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_GATEWAY_PORT,
  ENDPOINT_VERSIONS,
  GEMINI_API_BASE,
  GEMINI_LIVE_WS_BASE,
  LIVE_ENDPOINT,
  MODELS,
  VOICES,
} from './config.ts';
import { createGateway, readGatewayEnv } from './gateway.ts';

describe('readGatewayEnv', () => {
  it('switches to mock mode when GEMINI_MOCK=1', () => {
    expect(readGatewayEnv({ GEMINI_MOCK: '1' }).mock).toBe(true);
  });

  it('stays in real mode when GEMINI_MOCK is unset or 0', () => {
    expect(readGatewayEnv({}).mock).toBe(false);
    expect(readGatewayEnv({ GEMINI_MOCK: '0' }).mock).toBe(false);
  });

  it('uses the configured default port unless GATEWAY_PORT is set', () => {
    expect(readGatewayEnv({}).port).toBe(DEFAULT_GATEWAY_PORT);
    expect(readGatewayEnv({ GATEWAY_PORT: '9001' }).port).toBe(9001);
  });

  it('rejects a GATEWAY_PORT that is not a port number', () => {
    expect(() => readGatewayEnv({ GATEWAY_PORT: 'abc' })).toThrow(/GATEWAY_PORT/);
    expect(() => readGatewayEnv({ GATEWAY_PORT: '70000' })).toThrow(/GATEWAY_PORT/);
  });

  it('treats an empty GATEWAY_PORT as unset', () => {
    expect(readGatewayEnv({ GATEWAY_PORT: '' }).port).toBe(DEFAULT_GATEWAY_PORT);
  });

  it('treats an empty key as no key', () => {
    expect(readGatewayEnv({ GEMINI_API_KEY: '' }).apiKey).toBeUndefined();
    expect(readGatewayEnv({ GEMINI_API_KEY: 'k' }).apiKey).toBe('k');
  });
});

describe('gateway health check', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  async function start(env: Record<string, string>) {
    const server = createGateway(readGatewayEnv(env));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    close = () => new Promise((resolve) => server.close(() => resolve()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it('reports the mode and whether a key is configured, never the key itself', async () => {
    const base = await start({ GEMINI_API_KEY: 'secret-key-value' });
    const res = await fetch(`${base}/api/health`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ ok: true, mock: false, keyConfigured: true });
    expect(text).not.toContain('secret-key-value');
  });

  it('reports mock mode', async () => {
    const base = await start({ GEMINI_MOCK: '1' });
    const body = await (await fetch(`${base}/api/health`)).json();

    expect(body).toEqual({ ok: true, mock: true, keyConfigured: false });
  });

  it('answers unknown routes with 404 JSON', async () => {
    const base = await start({ GEMINI_MOCK: '1' });
    const res = await fetch(`${base}/api/nope`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('POST /api/token', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  const NOW = Date.parse('2026-10-03T07:00:00Z');

  /** A stand-in for Gemini's auth_tokens endpoint, recording what the gateway asked it. */
  function fakeGemini(answer: () => Response) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return answer();
    }) as typeof globalThis.fetch;
    return { calls, fetch };
  }

  async function start(env: Record<string, string>, gemini = fakeGemini(() => Response.json({ name: 'auth_tokens/abc' }))) {
    const server = createGateway(readGatewayEnv(env), { fetch: gemini.fetch, now: () => NOW });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    close = () => new Promise((resolve) => server.close(() => resolve()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const askForToken = (base: string, body: unknown = { voice: { targetLanguage: 'de', npcId: 'barista' } }) =>
    fetch(`${base}/api/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('mints a one-use ephemeral token and returns it with the Live model, voice and endpoint', async () => {
    const gemini = fakeGemini(() => Response.json({ name: 'auth_tokens/abc' }));
    const base = await start({ GEMINI_API_KEY: 'secret-key-value' }, gemini);

    const res = await askForToken(base);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toEqual({
      mock: false,
      token: 'auth_tokens/abc',
      model: MODELS.live,
      voiceName: VOICES.de,
      url: `${GEMINI_LIVE_WS_BASE}${ENDPOINT_VERSIONS.live}.${LIVE_ENDPOINT}`,
    });
    expect(text).not.toContain('secret-key-value');

    expect(gemini.calls).toHaveLength(1);
    const { url, init } = gemini.calls[0]!;
    expect(url).toBe(`${GEMINI_API_BASE}/${ENDPOINT_VERSIONS.authTokens}/auth_tokens`);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe('secret-key-value');
    const sent = JSON.parse(String(init.body));
    expect(sent.uses).toBe(1);
    // The session must start within a minute, and the token is dead soon after.
    expect(Date.parse(sent.newSessionExpireTime)).toBeGreaterThan(NOW);
    expect(Date.parse(sent.expireTime)).toBeGreaterThan(Date.parse(sent.newSessionExpireTime));
  });

  it('answers with a canned token and no network in mock mode', async () => {
    const gemini = fakeGemini(() => {
      throw new Error('no network in mock mode');
    });
    const base = await start({ GEMINI_MOCK: '1' }, gemini);

    const res = await askForToken(base, { voice: { targetLanguage: 'ja', npcId: 'barista' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mock: true, model: MODELS.live, voiceName: VOICES.ja, token: expect.any(String) });
    expect(gemini.calls).toEqual([]);
  });

  it('reports the voice service unavailable when there is no key', async () => {
    const gemini = fakeGemini(() => Response.json({ name: 'auth_tokens/abc' }));
    const base = await start({}, gemini);

    const res = await askForToken(base);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'no_api_key' });
    expect(gemini.calls).toEqual([]);
  });

  it('reports the voice service unavailable when Gemini refuses the token, without leaking its answer', async () => {
    const base = await start(
      { GEMINI_API_KEY: 'k' },
      fakeGemini(() => Response.json({ error: { message: 'API key not valid' } }, { status: 400 })),
    );

    const res = await askForToken(base);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'token_unavailable' });
  });

  it('reports the voice service unavailable when Gemini cannot be reached', async () => {
    const base = await start(
      { GEMINI_API_KEY: 'k' },
      fakeGemini(() => {
        throw new TypeError('fetch failed');
      }),
    );

    const res = await askForToken(base);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'token_unavailable' });
  });

  it('rejects a request for a language it has no voice for', async () => {
    const base = await start({ GEMINI_MOCK: '1' });

    expect((await askForToken(base, { voice: { targetLanguage: 'fr', npcId: 'barista' } })).status).toBe(400);
    expect((await askForToken(base, 'not json')).status).toBe(400);
  });
});
