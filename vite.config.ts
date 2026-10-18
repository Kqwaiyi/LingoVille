import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { readGatewayEnv } from './server/gateway.ts';

export default defineConfig(({ mode }) => {
  // Only the port variables are read here; the Gemini key never enters this config.
  const env = loadEnv(mode, process.cwd(), ['GATEWAY_', 'WEB_']);
  const gatewayPort = readGatewayEnv(env).port;

  return {
    plugins: [react()],
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${gatewayPort}` },
      // Transformed as the server starts, rather than on the first page's requests, so the first load is as quick as the rest.
      warmup: { clientFiles: ['./src/main.tsx'] },
    },
  };
});
