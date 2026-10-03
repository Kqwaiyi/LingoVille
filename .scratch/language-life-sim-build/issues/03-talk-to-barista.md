# 03 — Talk to the barista (mock NPC, typed)

**What to build:** Near the barista, "Press E to talk — barista" appears. Pressing E opens the conversation column on the right, and the barista speaks first. The Player types in the always-present field (T focuses it, Enter sends) and gets replies from a scripted mock NPC in the chat column. Time runs at ¼ speed while talking. Esc or walking away ends the conversation at no cost.

**Blocked by:** 02 — Walk to the café and watch the clock

**Spec:** [spec.md](../spec.md): Goal Interactions (flow); NPC prompt assembly; Voice pipeline (mock mode); UI and HUD (conversation)

**Status:** done

- [x] `buildNpcSession(interaction, culturePack, proficiencyStep, npc, context)` is pure and returns the system instruction, tools and voice. The instruction is built from the spec's ordered blocks: persona; "You and this person" (the stranger default for now); language rules; step adaptation; facts; goal; situation. Vitest snapshots it for each of the four languages at one step.
- [x] A `VoiceSession` interface exists with a mock implementation: a scripted fake NPC that accepts `sendText`. The UI depends only on the interface.
- [x] Chat column layout: the header (NPC role, place, time; the Chat tab; Leave (Esc)), NPC lines as left bubbles, player lines as right bubbles headed "Heard as", and an input bar with the typed field. The dock shrinks and centres on the area left of the column, and the 3D scene stays visible.
- [x] The clock scale is ¼ during any conversation.
- [x] Leaving with Esc or by walking out of range ends the session without changing any state.
- [x] While the typed field has focus, Space types a space.

## Comments

**2026-10-03 (implemented):** `buildNpcSession` is in `src/ai/npcSession.ts`, with snapshots for ja/zh/en/de at A1. The blocks have upper-case headings (WHO YOU ARE … THE SITUATION), and a test checks their order. The tools are only `not_understood(reason)` for now; ticket 04 adds the completion function and its read-back rule. `voice` is a `{targetLanguage, npcId}` request rather than a voice name, because voices live only in the gateway config. The gateway resolves it in ticket 05. The content is plain TypeScript stubs until Zod lands in tickets 04 and 11: café hours (`places.ts`), the barista persona (`npcs.ts`), Goal Interaction #1 with no completion yet (`interactions.ts`), and a small per-pack slice (`culturePacks.ts`: language name, country, café name and facts, persona names).

`VoiceSession` (`connect`, `sendText`, `close`, plus `onOutputTranscript` and `onTurnComplete` events) and the scripted `openMockVoiceSession` are in `src/voice`. The store owns the conversation. `createGameStore(initial, { openVoiceSession })` injects the session factory, and the mock is the default. The real session takes over in ticket 05. Chat lines are never in sim state, so leaving (Esc, Leave or walking out of `MOVEMENT.talkRangeMetres`) changes nothing in the game. `selectTimeScale` gives ¼ while talking and 0 while the tab is hidden. A `typing` flag in the store stops WASD from walking the Character and E from acting while the typed field has focus. T focuses the field without typing a "t". Enter during IME composition doesn't send.

The world has a greybox barista behind the café counter. `?spawn=cafe` (dev builds only) starts the Character at the café door, so the Playwright smoke doesn't have to walk across town. The Playwright timeout is now 60 s, because parallel software-WebGL boots were hitting 30 s.

**2026-10-03 (review follow-ups, left for later tickets):**
- `createGameStore` always uses the mock session for now. Ticket 05 must pick the real `VoiceSession` unless the gateway reports mock mode.
- The persona block, the facts and the column header assume the café (`pack.cafe`). Ticket 13 should key them by the NPC's `placeId` once there's more than one staffed place.
- UI strings are English until i18n (ticket 12). The new content is plain TypeScript until Zod (tickets 04 and 11).
- `src/ai` changed, but `npm run eval` doesn't exist yet (ticket 35), so no eval was run.
