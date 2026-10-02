# Technical architecture

Type: grilling
Status: resolved
Blocked by: 03, 04, 06
Map: [Language-learning life sim](../map.md)

## Question

What is the system architecture? Decide: the 3D framework and app framework; whether a small local backend holds the Gemini key or the browser calls Gemini directly; the voice pipeline end to end; how NPC prompts are assembled from interaction definitions, Language Proficiency and Target Language; how game state is modelled and saved to browser storage; how UI localization is done for the four Native Languages; and the project/repo layout an AI coding agent will work in.

The [Voice conversation prototype](06-voice-conversation-prototype.md) ticket fixes the following (prototype on branch `prototype/voice-conversation`):
- The voice pipeline is one `gemini-3.8-live` session per conversation, which the playtest kept. The browser connects to the v1beta `BidiGenerateContentConstrained` endpoint with a one-use ephemeral token from a local Node server (`POST /v1beta/auth_tokens`).
- Push-to-talk uses `realtimeInput.activityStart`/`activityEnd` with automatic activity detection turned off. Open mic uses the default automatic detection. Transcription is on in both directions.
- The game ends a Goal Interaction after the completion function succeeds and the NPC finishes speaking.
- Hear-it-said (Recap and Help) uses Gemini TTS through the local server, not browser `speechSynthesis`.
- The Recap is a `generateContent` call with `responseSchema` (`gemini-3.8-flash`, about 6 s), started as soon as the conversation ends.

The [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md) ticket fixes the following:
- The NPC prompt takes the current CEFR Proficiency Step (vocabulary, sentence length, pace, choices up front, one simpler rephrase at A1–A2). Starting Patience comes from the step.
- The Recap `responseSchema` must also return an estimated CEFR level for the player's speech in that conversation, which feeds a weighted moving average.
- The state includes the hidden Proficiency score, the highest step reached, and XP for five Life Skills.

The [Onboarding and Native Language selection](09-onboarding-and-native-language.md) ticket fixes the following:
- The default Native Language comes from `navigator.languages` (first `ja`/`zh`/`en`/`de` base tag, falling back to English). It can be changed at runtime in Settings, so UI localization must allow switching languages live.
- The mic permission is requested on a setup screen with a level meter. If it is denied, the save uses the Typed Fallback, and Settings can retry the permission.
- The game needs a "Voice service unavailable" screen for when the local server can't get a token.

The [Town and content scope](07-town-and-content-scope.md) ticket fixes the following:
- One 3D town layout plus four **Culture Pack** data sets (menus/goods, currency, customs, signs, opening-hour overrides), chosen by Target Language.
- Prices are authored as ratios of one Shift's pay. Each pack converts them with its anchor (¥6,000 / 240元 / €60 / £60) and rounds to local price points.
- The interaction catalogue is 25 player-led Goal Interactions plus 7 Shift customer templates, each authored as data with a typed completion function.

## Answer

Resolved on 2026-10-03 by grilling with the human.

**Stack.** Vite + React + TypeScript (strict) as a single-page app with no router. The scene is React Three Fiber + drei + @react-three/rapier on Three.js r186 (as the [Web 3D stack](04-web-3d-stack.md) research recommends). Menus and overlays are React DOM on top of the canvas. State is in Zustand. One `npm run dev` starts Vite and the local server, and Vite proxies `/api` to it.

**Gemini gateway (`server/`).** A small Node app (Hono or bare `http`) on one port that reads the key from `.env` and holds no game state. Endpoints:
- `POST /api/token` mints a one-use ephemeral token and returns the Live model ID with it.
- `POST /api/recap` calls `generateContent` with `responseSchema`, including the estimated CEFR level.
- `POST /api/tts` provides hear-it-said through Gemini TTS.
- `POST /api/annotate` returns the `{base, reading}` segments for one NPC line (flash-lite + `responseSchema`).

Model IDs, voices per language and endpoint versions live only in `server/config.ts`. The browser opens only the Live WebSocket directly, using the token.

**Mock mode.** With `GEMINI_MOCK=1`, the gateway returns canned Recaps, TTS and annotations, and `VoiceSession` uses a scripted fake NPC. The fake NPC accepts typed input and fires the completion function on keywords. This is for offline development and Playwright.

**Voice client.** One `VoiceSession` class (connect, push-to-talk start/end, open mic, `sendText` for the Typed Fallback, events for transcripts, tool calls and mic level). It is ported from the prototype's `index.html`: an AudioWorklet downsamples the mic to 16 kHz PCM, and 24 kHz PCM plays through a scheduled AudioBufferSource queue. 3D and UI code never touch the socket. Hear-it-said clips are cached in IndexedDB by a hash of `(text, voice)`.

**Connection failure.** On a socket drop or token expiry mid-conversation, `VoiceSession` retries once with a fresh token, seeding the transcript so far as context. If that fails, the conversation ends as a *network abandonment*, which costs nothing: no Patience or Mood loss, no Recap, and an "NPC had to step away" toast. **During a Shift, that customer doesn't count and is replaced**, so pay never suffers from a network fault. This differs from player-chosen abandonment, which still counts as failed per [Anatomy of an interaction](02-anatomy-of-an-interaction.md). The "Voice service unavailable" screen appears only when no token can be minted at all.

**Reading aids vs. the Live API.** Live has no structured output, so NPC lines arrive as plain output transcripts. A bubble shows immediately with readings from the client library (`pinyin-pro` for zh, lazily loaded `kuroshiro` for ja). In parallel, the finished line goes to `/api/annotate`, and the Gemini readings replace the library ones when they pass validation (about 1 s later). Otherwise the library output stays. The Recap and Journal store the annotated version. English and German skip all of this. This refines the [Reading aids](05-reading-aids.md) decision.

**Game state and simulation.** A pure TypeScript `sim` module holds the state types, `tick(state, dtGameMinutes)` and event functions (`applyInteractionOutcome`, `payRent`, …). It never imports React or Three. Zustand holds the one sim state object and calls those functions, and the world and UI read it through selectors. Positions of NPCs and the Character live in the R3F/Rapier world, except the Character's current place, which is saved. ECS was ruled out as overkill.

**Clock.** Game time advances in `useFrame` as real delta × time scale. The scale is 1 normally (1 real min = 1 game hour), ¼ in conversation and 0 when paused. Real delta is capped at 250 ms, and the game pauses when the tab is hidden.

**Saves.** IndexedDB (via `idb-keyval`). One versioned save object `{schemaVersion, …}` is validated with Zod on load and upgraded by an ordered list of migrations. TTS audio is cached in a separate store. *What* the save contains and the save/load UX belong to [Save model](13-save-model.md).

**Content as data.** Goal Interactions, Shift customer templates, Culture Packs, Illnesses, Comfort Purchases and places/hours are TypeScript modules that satisfy Zod schemas (`defineInteraction({...})`). Each interaction's completion-function tool declaration and its argument validator come from the same schema. A Vitest check validates all content and cross-references it, so that every Culture Pack provides every item a Goal Interaction refers to. Item glosses for tap-to-translate are authored in each pack for the three Native Languages other than the pack's own.

**NPC prompt assembly.** `buildNpcSession(interaction, culturePack, proficiencyStep, npc, context)` returns `{systemInstruction, tools, voice}`. The system instruction is an **English meta-prompt** that tells the NPC to speak only the Target Language. It is built from small pure block functions, in order:
1. role and persona
2. the language rules (Target Language only, `not_understood` rules, clarifying re-asks are free)
3. step adaptation from the Proficiency table
4. the facts from the Culture Pack (menu, prices)
5. the goal and the read-back-then-call-completion rule
6. the situation (time of day)

The Character's money is never in the prompt, because the game checks affordability. Snapshot tests pin the output for each language × step.

**UI localization.** react-i18next with typed TS resource files per Native Language. Settings calls `changeLanguage()` to switch live. This covers UI strings only: NPC speech is generated, and item names and glosses live in the Culture Packs.

**Repo layout.** One npm package:

```
src/
  sim/      pure TS: state types, tick, economy, proficiency, life skills
  content/  Zod schemas + data: interactions/, shift-templates/, culture-packs/{ja,zh,en,de}/, illnesses, comforts, places
  ai/       prompt builders (NPC session, Recap, annotate) and schemas, all pure
  voice/    VoiceSession, audio worklets, TTS cache
  world/    R3F scene: town, character controller, NPCs, day–night, interaction triggers
  ui/       React DOM: HUD, conversation panel, Help, Recap, Journal, setup, settings
  i18n/     UI strings per Native Language
  store/    Zustand store wiring sim ↔ world/UI; save/load and migrations
server/     Gemini gateway
```

`sim`, `content` and `ai` must not import from `world`, `ui` or `voice`, enforced with ESLint `import/no-restricted-paths`. Each folder gets a short `AGENTS.md` stating its rule and how to test it.

**Testing.** Vitest covers `sim`, content validation, `ai` prompt snapshots and save migrations. Playwright smoke tests run in mock mode: setup → First Morning → café order → Recap. There are no automated 3D visual tests. The quality of real model output belongs to [AI quality evaluation](14-ai-quality-evaluation.md).
