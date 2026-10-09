# server

The local Gemini gateway: a small Node app that Vite proxies `/api` to. It holds no game state.

**Rules**
- The Gemini key is read only from the gitignored `.env` (see `.env.example`) and never sent to the browser. Browser code may not import this folder (lint enforces it).
- Model IDs, voices and endpoint versions live only in `config.ts`.
- `GEMINI_MOCK=1` must make every endpoint answer with canned data, with no network and no key.
- In mock mode the `/api/token` response also carries `replyDelayMs`, how long the scripted fake NPC waits before each answer, from `GEMINI_MOCK_REPLY_MS` (600 when unset; anything but a whole number of 0 or more stops the gateway at startup). Real-mode tokens never carry it.
- Endpoints validate requests and Gemini's answers with Zod before returning anything. Prompted endpoints (`/api/recap`, `/api/hint`, `/api/annotate`) take the request schema, body builder and answer schema from `ai`. Gemini's own answers stay in the gateway log.

**Testing**: Vitest against `createGateway` on an ephemeral port, passing a fake `fetch` to stand in for Gemini. Never call real Gemini from a test. Changes to `config.ts` need a passing `npm run eval` before merging. Ask the user to run it; never run it unless they explicitly ask.

`npx vitest run server`
