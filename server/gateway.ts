import http from 'node:http';
import { DEFAULT_GATEWAY_PORT } from './config.ts';

export type GatewayEnv = {
  mock: boolean;
  apiKey: string | undefined;
  port: number;
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

export function createGateway(env: GatewayEnv): http.Server {
  return http.createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://gateway');

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, mock: env.mock, keyConfigured: env.apiKey !== undefined });
    }

    return sendJson(res, 404, { error: 'not_found' });
  });
}
