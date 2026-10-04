import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readGatewayEnv } from './server/gateway.ts';

// Where the browser fetches kuromoji's dictionary from: KUROMOJI_DICT_PATH in `src/store/libraryReadings.ts`.
// Not imported from there, so this config doesn't typecheck the browser's kuromoji declarations.
const KUROMOJI_DICT_PATH = '/kuromoji-dict/';

/**
 * Serves kuromoji's dictionary (the ja library readings) from node_modules in dev,
 * and copies it into the build. The files are gzipped, and the game unzips them
 * itself (see `src/store/libraryReadings.ts`), so they go out as plain bytes with no Content-Encoding.
 */
function kuromojiDictionary(): Plugin {
  const dir = join(dirname(createRequire(import.meta.url).resolve('kuromoji/package.json')), 'dict');
  const files = readdirSync(dir).filter((name) => name.endsWith('.dat.gz'));
  return {
    name: 'kuromoji-dictionary',
    configureServer(server) {
      server.middlewares.use(KUROMOJI_DICT_PATH, (req, res, next) => {
        const name = (req.url ?? '').replace(/^\//, '').split('?')[0]!;
        if (!files.includes(name)) return next();
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'max-age=86400');
        res.end(readFileSync(join(dir, name)));
      });
    },
    generateBundle() {
      for (const name of files) {
        this.emitFile({ type: 'asset', fileName: `${KUROMOJI_DICT_PATH.slice(1)}${name}`, source: readFileSync(join(dir, name)) });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Only the port variables are read here; the Gemini key never enters this config.
  const env = loadEnv(mode, process.cwd(), ['GATEWAY_', 'WEB_']);
  const gatewayPort = readGatewayEnv(env).port;

  return {
    plugins: [react(), kuromojiDictionary()],
    // kuromoji joins its dictionary paths with Node's `path`.
    resolve: { alias: { path: 'path-browserify' } },
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${gatewayPort}` },
    },
  };
});
