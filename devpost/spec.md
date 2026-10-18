---
doc: spec
status: approved
---

# Insomniacs — Technical Spec

A 3D town in the browser where every errand is a spoken conversation in the Target Language. This blueprint covers everything in `prd.md > What We're Building`, built on the stack you already use.

## How This Works, In Plain Language
- **The town** is a 3D scene in the browser. You walk your Character with WASD, the camera follows, and E starts a conversation with whoever is nearby.
- **The game rules** are plain TypeScript with no screen or network code: the clock, money, Patience, Shifts, Well-being and Mood, Illness, rent and the hidden Language Proficiency. Each rule takes the game in and gives the changed game back, so it can be checked on its own.
- **The store** sits between the rules and the screens. It runs the clock, opens and closes conversations, and saves the game in the browser.
- **The voice** is one interface, `VoiceSession`. The real one streams your microphone to Gemini's live voice model and plays the NPC's reply. A scripted one stands in for it in mock mode.
- **The gateway** is a small Node program beside the page. It keeps the Gemini key off the page, hands out a one-use pass for each conversation, and writes hints, translations, spoken examples and the Recap.
- **Mock mode** (`GEMINI_MOCK=1`) swaps Gemini for scripted answers, so the whole game runs, and can be checked, with no key and no cost.

Why this shape: the key never reaches the browser, the rules can be checked without a screen, and mock mode makes every check free and repeatable. Anything bigger, such as a server that holds the game, accounts or a hosted database, would add work without proving the kernel.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Title Screen.** `npm run dev` starts Vite and the gateway together. The page loads the town behind the Title Screen, which looks for saves in the browser's IndexedDB.
2. **Setup.** New game walks through Native Language, Target Language, About you, Appearance and the mic check. The Target Language picks the Culture Pack that dresses the town: signs, menus, food, money and props. The answers become a new game in an empty save slot.
3. **The First Morning.** The game opens at home, with a banner in the Native Language pointing to the tap and then the café. The café order that ends it can't fail.
4. **Talking.** Pressing E near the barista asks the gateway for a pass (`POST /api/token`) and builds the barista's instructions from the café's conversation, the hidden Proficiency and the time of day. The live session opens, and the barista greets first.
5. **Speaking.** Holding Space streams the mic. The barista's reply plays aloud and appears in the chat column, and `POST /api/annotate` adds its translation, plus readings for Japanese and Chinese. The Player's own turn shows as "Heard as: …".
6. **Not understood, then Help.** When the barista can't make sense of a turn, it calls `not_understood`. The rules lower its Patience, which shows only on its face. The Help tab asks `POST /api/hint` for model sentences, and 🔊 plays them through `POST /api/tts`.
7. **Served.** Once the barista has read the order back, it calls `serve_order`. The rules check the item, the price and the wallet, take the money, and the closing card shows.
8. **The Recap.** The transcript and Help log go to `POST /api/recap`. The Recap (up to three corrections, plus new words) replaces the chat, is kept in the Journal, and its evidence moves the hidden Proficiency.
9. **A Job.** Asking the barista for work ends in `hire_applicant`. A Shift then brings 5–8 customers, each a short voice session with a hidden order. The Player fills each order in the Shift panel, and the pay depends on how many were right.
10. **Day to day.** The clock runs Hunger and Thirst down, brings Illness now and then, and makes rent due each week. The gym, the clinic and the landlord are more conversations on the same loop: `register_member`, `register_patient`, `diagnose`, `dispense` and `accept_rent`.
11. **Coming back.** The game autosaves, and a reload or a later visit offers Continue on the Title Screen.

## Stack
You asked to build on your current implementation, so the stack stays the one you already use, cut to what the PRD needs.
- **TypeScript (strict), React and Vite:** [typescriptlang.org](https://www.typescriptlang.org/docs/), [react.dev](https://react.dev/), [vite.dev](https://vite.dev/guide/)
- **React Three Fiber, drei, Rapier and postprocessing:** the town, walking and collisions, and the camera's look. three.js stays pinned at r186, and postprocessing at 6.39.5, whose three range takes it. [r3f.docs.pmnd.rs](https://r3f.docs.pmnd.rs/), [drei.docs.pmnd.rs](https://drei.docs.pmnd.rs/), [react-three-rapier](https://github.com/pmndrs/react-three-rapier), [react-postprocessing](https://github.com/pmndrs/react-postprocessing), [threejs.org](https://threejs.org/docs/)
- **Zustand:** the store. [zustand.docs.pmnd.rs](https://zustand.docs.pmnd.rs/)
- **Zod:** schemas for content, saves, and every gateway request and answer. [zod.dev](https://zod.dev/)
- **idb-keyval over IndexedDB:** saves, the Journal and device settings. [idb-keyval](https://github.com/jakearchibald/idb-keyval)
- **i18next and react-i18next:** the UI in four Native Languages. [i18next.com](https://www.i18next.com/), [react.i18next.com](https://react.i18next.com/)
- **kuromoji, pinyin-pro and wanakana:** readings for Japanese and Chinese. [kuromoji.js](https://github.com/takuyaa/kuromoji.js), [pinyin-pro](https://github.com/zh-lx/pinyin-pro), [wanakana.com](https://wanakana.com/)
- **Web Audio:** music and sound, synthesised in the browser. [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- **Node ≥ 22.12 with tsx:** runs the gateway, and **concurrently** starts it beside Vite. [nodejs.org](https://nodejs.org/docs/latest-v22.x/api/), [tsx.is](https://tsx.is/)

The links weren't checked in this session; check them early in the build.

## Where It Runs and How Someone Tries It
- **Runtime:** a desktop browser plus the local gateway on Node ≥ 22.12. A microphone is optional, since typing works too.
- **Setup:**
  1. Run `npm install`.
  2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`, or set `GEMINI_MOCK=1` to play without a key.
- **Start:** `npm run dev`, then open http://localhost:5173. Vite proxies `/api` to the gateway on port 8787.
- **Demo recording:** record locally with a real key. Show a café order with one try the barista doesn't understand, a Help hint, the order being served and its Recap, then a barista Shift.
- **Submission:** a short demo video and a public GitHub repository. There's no deployment.

## Look and Feel
Carried forward from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.
- **Palette:** cozy pastel. Every colour the town draws comes from one shared palette, so the four Culture Packs look like one game.
- **The town:** low-poly buildings, lamps, trees and furniture modelled in Blender and packed into one file (`public/town/town.glb`), with Kenney's CC0 kits for the rest.
- **Characters:** everyone is Clawd, told apart by a hat, glasses and neckwear in a colour. An NPC's Patience shows on their face.
- **Light:** follows the game clock. Lit windows show which places are open, and the lamps glow from dusk.
- **Interface:** system-UI type, a dock at the bottom, and the chat column on the right. The Recap and the Journal are drawn as lined journal pages. Copy is short and friendly, in the Native Language.
- **Sound:** soft, synthesised music and ambience, one soundtrack for every pack.

## Components

### Gemini Gateway
`server/`. A small Node HTTP server that Vite proxies `/api` to, and the only code that holds the Gemini key. It mints Live tokens, answers the prompted routes by building each prompt with the Prompt Builders, and checks every request and every answer from Gemini with Zod. In mock mode every route answers with canned data, with no network and no key. Model ids and voices live only in `server/config.ts`.
PRD ref: `prd.md > Speaking to NPCs`, `prd.md > Help`, `prd.md > Recap and Journal`, `prd.md > States and Boundaries` (voice service unavailable).

### Voice Session
`src/voice/`. The `VoiceSession` interface: connect, push-to-talk, send a typed line, answer a tool call, and events for transcripts and tool calls. The live version opens Gemini Live with the token, streams the mic at 16 kHz through an audio worklet and plays the 24 kHz reply. The mock version is a scripted NPC behind the same interface. Hear-it-said clips are cached in IndexedDB.
PRD ref: `prd.md > Speaking to NPCs`, `prd.md > States and Boundaries` (no microphone).

### Prompt Builders
`src/ai/`. Pure functions with no network: an NPC's instructions (their role, the Target Language only, read the order back before acting, `not_understood` only for a turn they can't make sense of at all), a Shift customer's, and the request bodies and answer schemas for hints, annotations and the Recap. The Japanese and Chinese readings that need no network live here too.
PRD ref: `prd.md > Speaking to NPCs`, `prd.md > Help`, `prd.md > Recap and Journal`, `prd.md > Barista Job and Shifts`.

### Game Rules
`src/sim/`. Pure TypeScript with no React, three.js or network code: the game in, the changed game out, with all randomness from a seed kept in the save. Patience and how a conversation ends; money; the hidden Proficiency; Jobs and Shifts; Well-being, Mood and Fainting; Illness and the clinic; the gym; rent and debt; the First Morning. Every game number lives in `src/sim/tuning.ts`.
PRD ref: `prd.md > Speaking to NPCs`, `prd.md > Barista Job and Shifts`, `prd.md > Well-being, Mood and Fainting`, `prd.md > Gym`, `prd.md > Illness and the Clinic`, `prd.md > Rent and Debt`.

### Content and Culture Packs
`src/content/`. Data with Zod schemas: each place's conversations (goal, facts, completion tool and effect), items with prices as ratios of one Shift's pay, NPC personas, Shift templates, illnesses, and appearance tables. The four Culture Packs (Japan, China, the UK and Germany) localise signs, menus, food, money and props.
PRD ref: `prd.md > Four Languages`. Each place's conversations serve that place's own heading.

### Store and Saves
`src/store/`. A Zustand store that connects the rules to the screens: the clock, conversations, Help, the Recap and Shifts. Screens read it through selectors and change it through actions. Saves go to IndexedDB slots, with a start-of-day backup, migrations, and export and import. The Journal has its own database, and device settings are kept per browser.
PRD ref: `prd.md > Recap and Journal`, `prd.md > States and Boundaries` (coming back).

### Town
`src/world/`. The React Three Fiber scene: the town's layout, the Character on Rapier, NPCs standing at their places, signs painted from the Culture Pack, day-and-night lighting and the sky, and graphics that suit the computer's graphics card.
PRD ref: `prd.md > Screens and Layout` (Town), `prd.md > Look and Feel`.

### Screens and HUD
`src/ui/`. React over the 3D canvas: the Title Screen, Setup, the dock, the chat column with Chat and Help tabs, the closing card, the Recap, the Journal, the Shift panel, the First Morning banner, Settings, the pause menu and the credits.
PRD ref: `prd.md > Screens and Layout`, `prd.md > Setup and First Morning`, `prd.md > Help`, `prd.md > Recap and Journal`.

### UI Strings
`src/i18n/`. Typed i18next resources: English is the source, and Japanese, Chinese and German must have exactly its keys, which the typecheck enforces.
PRD ref: `prd.md > Four Languages`.

### Sound
`src/audio/`. Music, ambience and UI sounds synthesised with Web Audio. The store decides what plays when, and lowers the music in conversations.
PRD ref: `prd.md > Look and Feel`.

## Data Model
- **The game:** the Character (name, languages, Culture Pack, look), the clock and day, money, Health, Hunger, Thirst and Mood, the hidden Proficiency, Jobs and Life Skills, the gym membership, Illness, rent and debts, the inventory and the personal phrasebook. It lives in the store, and only the Game Rules change it. It's saved to its slot in IndexedDB every two minutes and at key moments (an outcome, a new day, the tab hiding). Coming back: Continue loads it, and a save that can't be read falls back to this morning's backup.
- **A conversation:** the transcript, the Help log and Patience. It's kept in memory only and never saved partway, so leaving or reloading mid-conversation changes nothing.
- **The Journal:** every Recap, append-only, in its own IndexedDB database per slot, in the language it was written in. It survives reloads, and export and import carry it with the save.
- **Device settings:** the UI language, typing or speaking, push-to-talk or open mic, volumes, reading aids, and the tooltips already seen. They're kept per browser in IndexedDB, outside saves.
- **Hear-it-said clips:** cached by text and voice in IndexedDB. They're never saved or exported.
- **Content:** authored data in the code, read-only.

## File Structure

```
lingoville/
├── src/
│   ├── main.tsx        # entry: mounts the game
│   ├── sim/            # pure game rules; every number in tuning.ts
│   ├── content/        # conversations, items, NPCs, the four Culture Packs
│   ├── ai/             # prompt builders and their schemas
│   ├── voice/          # VoiceSession, live and mock sessions, audio worklets
│   ├── store/          # Zustand store, saves, Journal, device settings
│   ├── world/          # the 3D town
│   ├── ui/             # screens, HUD and the chat column
│   ├── i18n/           # UI strings in four languages
│   └── audio/          # synthesised music and sound
├── server/             # gateway: main.ts, gateway.ts, config.ts
├── public/
│   ├── town/           # town.glb and the surface textures
│   └── characters/     # clawd.glb
├── devpost/            # Devpost learning workspace
├── CREDITS.md          # art credits, also shown in the game
├── .env.example        # GEMINI_API_KEY, GEMINI_MOCK, GATEWAY_PORT
├── vite.config.ts      # proxies /api to the gateway
└── package.json        # scripts: dev, build, typecheck
```

## External Services and Dependencies
**Google Gemini API.** One key, in `.env`, read only by the gateway and sent as the `x-goog-api-key` header.

| Gateway route | Gemini call and model | Request → answer |
|---|---|---|
| `POST /api/token` | `POST v1beta/auth_tokens` (`uses: 1`, an expiry and a one-minute start window), for `gemini-3.8-live` | `{ voice }` → `{ token, model, voiceName, url }` |
| `POST /api/annotate` | `POST v1beta/models/gemini-3.5-flash-lite:generateContent`, structured output | `{ targetLanguage, nativeLanguage, line }` → `{ translation, segments? }` |
| `POST /api/hint` | `generateContent` on `gemini-3.5-flash-lite`, structured output | `{ culturePackId, step, nativeLanguage, interactionId or jobId, transcript }` → `{ hints: [{ text, translation }] }` |
| `POST /api/tts` | `generateContent` on `gemini-3.8-flash-lite-tts`, audio out | `{ text, targetLanguage, voice? }` → `{ audio, sampleRate: 24000 }` (base64 PCM) |
| `POST /api/recap` | `generateContent` on `gemini-3.8-flash`, structured output | `{ kind, culturePackId, step, nativeLanguage, conversation }` → `{ outcome, corrections, newWords, cefrEstimate }` |
| `GET /api/health` | none | → `{ ok, mock, keyConfigured }` |

- **Live session:** the browser opens `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=<token>`, one per conversation, with transcription both ways. The tools are the conversation's completion (such as `serve_order(item, size)`) and `not_understood(reason)`.
- **Docs:**
  - Live API: [ai.google.dev/gemini-api/docs/live](https://ai.google.dev/gemini-api/docs/live)
  - Ephemeral tokens: [ai.google.dev/gemini-api/docs/ephemeral-tokens](https://ai.google.dev/gemini-api/docs/ephemeral-tokens)
  - Structured output: [ai.google.dev/gemini-api/docs/structured-output](https://ai.google.dev/gemini-api/docs/structured-output)
  - Speech generation: [ai.google.dev/gemini-api/docs/speech-generation](https://ai.google.dev/gemini-api/docs/speech-generation)
  - Pricing: [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **Cost:** about $0.012 per conversation minute, measured in an earlier voice prototype.
- **Not checked in this session:** rate limits and current prices.

There's no other service: no hosted database, no accounts, no hosting.

## Important Failure Modes
- **The gateway can't mint a token** → "Voice service unavailable: check the local server."
- **The live connection drops** → one retry, picking up where it was. If that fails too: "The barista had to step away. Nothing was lost." A Shift customer lost this way is replaced and doesn't count.
- **No microphone, or permission refused** → the typed field takes over.
- **The Recap is slow or fails** → a loading state appears the moment the conversation ends. If it fails, the Journal still keeps the conversation.
- **A save can't be read** → the game loads this morning's backup and says so.

## What Was Simplified and Why
- **The game runs locally on the developer's own Gemini key** instead of with hosted accounts. The scope rules out accounts, and a local game records fine for the demo. Hosting would need sign-in and a server-side key.
- **Saves stay in the browser (IndexedDB)** instead of a server database. It's single-player with nothing to sync, and export and import cover moving a save. A server would add a service, an account and a failure point.
- **One town layout serves all four Culture Packs** instead of four towns. Only the signs, menus, food, money and props change. Four layouts would mean four times the art and layout work.
- **Proficiency stays hidden and moves in steps (A1–C2)** instead of showing a score, as the scope asks.
- **Sound is synthesised** instead of recorded, so there's nothing to source or license.

## Decisions and Open Issues
**Decided here:**
- **Build on your current stack** (your choice): TypeScript, React, React Three Fiber, Zustand and Vite. Tradeoff: a 3D library and physics are heavier than a flat screen, but the scope asks for a free-roaming town.
- **A local Node gateway for every Gemini call** (recommended, accepted): it keeps the key off the page and lets mock mode stand in for all of Gemini. Tradeoff: two processes to start, which `npm run dev` hides.
- **Mock mode as how each build step is checked** (recommended, accepted): every slice can be played through in the browser for free, the same way each time. Tradeoff: the scripted NPC only knows the lines it's written for, so how the real model behaves still needs a run with a key.
- **All four languages, both ways round, with reading aids for Japanese and Chinese** (your choice, from `2-scope`).
- **Saves in IndexedDB with start-of-day backups**: an implementation detail that follows from having no accounts.

**Learner uncertainty:** none was named in this conversation. The riskiest unknown is technical: whether the live model calls `not_understood` and `serve_order` reliably enough to drive the game. It's checked in slice 1, with a real key, before anything is built on it.

**Changed during the build** (recorded in the checklist's Revisions):
- **The cashier and server Jobs too.** Once the barista's Shift loop worked, the supermarket till and the restaurant's order pad were one Shift template each, so they joined the barista.

**Still open:**
- Everyone is Clawd, the Claude Code mascot. Using it in a public repo and demo video may need permission (from `prd.md > Open Questions`). This can wait until `6-ship`.
- To check early in the build: the doc links above, Gemini's rate limits and current prices.
