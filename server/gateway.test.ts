import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_GATEWAY_PORT } from './config.ts';
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
