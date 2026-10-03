# server

The local Gemini gateway: a small Node app that Vite proxies `/api` to. It holds no game state.

**Rules**
- The Gemini key is read only from the gitignored `.env` (see `.env.example`) and never sent to the browser. Browser code may not import this folder (lint enforces it).
- Model IDs, voices and endpoint versions live only in `config.ts`.
- `GEMINI_MOCK=1` must make every endpoint answer with canned data, with no network and no key.

**Testing**: Vitest against `createGateway` on an ephemeral port. Never call real Gemini from a test. Changes to `config.ts` need an `npm run eval` before merging.

`npx vitest run server`
