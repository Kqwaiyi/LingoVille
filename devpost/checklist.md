---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Order a coffee out loud at the café**
  Becomes usable: A running game where you walk the town to the café, press E, and order a drink out loud in Japanese, or type it. The barista reads the order back, serves it and takes the money. Turns they can't make sense of wear out their Patience, shown only on their face, until they give up at no charge.
  Why now: This is the unique kernel, speaking to be understood, and the riskiest part: Gemini Live, one-use tokens and the audio worklets. Bootstrapping (Vite, the gateway and its mock mode, the town) lives inside it, so every later slice lands on a running game.
  PRD ref: `prd.md > The Core Journey` (steps 4 and 6), `prd.md > Features and Behavior > Speaking to NPCs`
  Spec ref: `spec.md > The Core Journey Through the System` (steps 4, 5 and 7), `spec.md > Components > Gemini Gateway`, `spec.md > Components > Voice Session`, `spec.md > Components > Town`, `spec.md > Components > Game Rules`, `spec.md > Important Failure Modes`
  Build: Scaffold Vite, React and strict TypeScript per the spec's file structure. Add the gateway with `/api/token`, `/api/health` and mock mode; `VoiceSession` with the live session and the scripted barista; the town from `town.glb` with walking, day and night and the tram; the four Culture Packs' content; the café's order interactions with Patience, read-back and `serve_order`; the conversation column, and a dock with the clock and money. A new game starts straight in town, learning Japanese with an English UI.
  Verify (mechanical): `npm run typecheck` and `npm run build` pass. With `GEMINI_MOCK=1`, `npm run dev` serves the page with no console errors and `/api/health` answers `mock: true`. In the browser, walk to the barista, type an order, and see the read-back, then the closing card, with the price taken from the money in the dock. A second order of gibberish changes the barista's face as their Patience runs down, and ends at no charge.
  Learner check: Run `npm run dev`, walk into the café with WASD, press E and order a coffee out loud (or press T and type it). Does the barista understand you, read it back and serve it?
  Commit: `Order a coffee out loud at the café`

- [x] **2. Get unstuck with Help, then learn from the Recap**
  Becomes usable: In a conversation, the Help tab gives model sentences to say or hear for this moment, every NPC line can be translated and replayed, and Japanese and Chinese lines carry their readings. Each conversation ends with a Recap of up to three corrections and new words, kept in the Journal (J).
  Why now: Help is how a stuck learner recovers, the second moment in the scope's "What Working Looks Like", and the Recap is where they learn from each conversation. Both build on the conversation from slice 1 and need the gateway's prompted routes.
  PRD ref: `prd.md > The Core Journey` (steps 5 and 7), `prd.md > Features and Behavior > Help`, `prd.md > Features and Behavior > Recap and Journal`
  Spec ref: `spec.md > The Core Journey Through the System` (steps 5, 6 and 8), `spec.md > External Services and Dependencies`, `spec.md > Components > Prompt Builders`, `spec.md > Components > Store and Saves`, `spec.md > Data Model`
  Build: Add `/api/hint`, `/api/annotate`, `/api/tts` and `/api/recap` with their prompt builders and Zod schemas; the Help tab, the place phrasebook and hear-it-said; Translate and Replay on NPC lines; reading aids with kuromoji, pinyin-pro and wanakana; the Recap card and the Journal in IndexedDB; Recap evidence moving the hidden Language Proficiency; the personal phrasebook; sign tooltips.
  Verify (mechanical): `npm run typecheck` and `npm run build` pass. In mock mode, in the browser: H mid-order shows hints and the café phrasebook; Translate shows a barista line in English, and Replay plays it again; furigana sit over the kanji; after the order, See Recap shows a lined page, and J opens the Journal with that entry.
  Learner check: Order something, open Help when you're stuck and say a hint aloud, then read the Recap at the end. Is the correction one you'd want?
  Commit: `Get unstuck with Help, then learn from the Recap`

- [x] **3. Start a new life in any of four languages**
  Becomes usable: The game opens on a Title Screen over the live town. New game goes through Setup: Native Language, Target Language (any of the four towns), name and level, a look for your Clawd, and the mic check. The game autosaves, so Continue picks up where you left off, and Settings change the UI language, the input and the reading aids.
  Why now: With the conversation loop proven, the game needs a way in and a way back. Setup is also where the language pair and the starting level come from, which every later slice relies on.
  PRD ref: `prd.md > The Core Journey` (steps 1 and 2), `prd.md > Screens and Layout`, `prd.md > Features and Behavior > Four Languages`, `prd.md > States and Boundaries` (no microphone, coming back)
  Spec ref: `spec.md > The Core Journey Through the System` (steps 1, 2 and 11), `spec.md > Components > Screens and HUD`, `spec.md > Components > Store and Saves`, `spec.md > Components > UI Strings`, `spec.md > Data Model`
  Build: Add the Title Screen and Setup; Appearance Presets; the mic check and the Typed Fallback; saves with slots, start-of-day backups, migrations, export, import and delete; device settings and the Settings panel; the pause menu; credits from `CREDITS.md`; UI strings in Japanese, Chinese and German.
  Verify (mechanical): `npm run typecheck` and `npm run build` pass. In mock mode, in the browser: Setup leads into the town; a reload and Continue land in the same game with the same money; a game learning German shows the German town; switching the UI language in Settings changes every label at once; a save exports, deletes and imports back.
  Learner check: Start a new game learning a different language, play for a minute, reload and Continue. Is everything where you left it?
  Commit: `Start a new life in any of four languages`

- [x] **4. Get a Job and work a Shift**
  Becomes usable: Ask the barista for work in the Target Language and get hired. At the staff door, work a Shift of 5 to 8 customers who order out loud with hidden orders, fill each from the drinks menu, and get paid by how many were right, with one Recap for the Shift.
  Why now: The Shift is the third moment in the scope's "What Working Looks Like", and it's how the Character earns money, which slice 5 gives them things to spend on.
  PRD ref: `prd.md > The Core Journey` (step 8), `prd.md > Features and Behavior > Barista Job and Shifts`
  Spec ref: `spec.md > The Core Journey Through the System` (step 9), `spec.md > Components > Game Rules`, `spec.md > Components > Prompt Builders`, `spec.md > Components > Screens and HUD`
  Build: Add `hire_applicant` and the staff door; `shift.ts` with Shift Customers drawn from templates, each a short voice session (`shiftCustomerSession.ts`); the Shift panel with the drinks menu, the tray and its modifiers; pay by orders filled right; the Shift Recap; the Barista Life Skill and its aids; the dock's Skills.
  Verify (mechanical): `npm run typecheck` and `npm run build` pass. In mock mode, in the browser: the barista hires the Character, E at the staff door starts a Shift, every customer can be served from the Shift panel, and the pay shows at the end. A customer whose connection drops is replaced and doesn't count.
  Learner check: Ask the barista for a job, then work a Shift. Does the pay feel fair for how you did?
  Commit: `Get a Job and work a Shift`

- [x] **5. Live day to day: needs, the gym, the clinic and rent**
  Becomes usable: Hunger and Thirst run down over the day, and Health falls when either is empty, ending in Fainting and a hospital bill. The gym, Illness and the clinic, and weekly rent with the landlord all work by talking, and Mood rises and falls with how the day goes. A new game starts with the First Morning, which guides the Player to the café; one-time tooltips explain each system, and the town has music and sound.
  Why now: These are what make every day take more conversations, the scope's reason to come back. They spend the money Shifts earn, so they follow slice 4, and the First Morning walks a new player through them, so it comes once they exist.
  PRD ref: `prd.md > The Core Journey` (steps 3 and 9), `prd.md > Features and Behavior > Setup and First Morning` (the First Morning), `prd.md > Features and Behavior > Well-being, Mood and Fainting`, `prd.md > Features and Behavior > Gym`, `prd.md > Features and Behavior > Illness and the Clinic`, `prd.md > Features and Behavior > Rent and Debt`
  Spec ref: `spec.md > The Core Journey Through the System` (steps 3 and 10), `spec.md > Components > Game Rules`, `spec.md > Components > Sound`, `spec.md > Important Failure Modes`
  Build: Add Well-being and Mood to the clock's tick and the dock; Fainting, the ward and the hospital bill; Illness, the clinic and the pharmacy; the gym; rent, the landlord, the Newcomer Discount and debt; NPCs who come up to the Character; the First Morning and its closing card; one-time tooltips; synthesised music, ambient sound and UI sounds with volume settings.
  Verify (mechanical): `npm run typecheck` and `npm run build` pass. In mock mode, in the browser: the First Morning leads from the tap to the café; Hunger and Thirst run down and the tap refills Thirst; a game started about to faint (`?faint`) wakes in the ward to the nurse; joining the gym, checking in at the clinic and paying the rent each work by talking; music starts after the first key press.
  Learner check: Play a few in-game days: eat, work a Shift, pay the rent, and see the doctor if you fall ill. Does each day feel like it needs a few more conversations?
  Commit: `Live day to day: needs, the gym, the clinic and rent`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 1, ordering at the café by voice and by typing
- [x] Final kick-the-tires exploration and feedback completed

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship

No changes needed: the learner played the core journey from the Title Screen to a Shift and a rent day and confirmed the proof of concept is ready.

## Code Tour and App Map

- [x] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [x] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Brief recap of the mock-mode check every slice used: one scripted barista (`src/voice/mockVoiceSession.ts`) behind the `VoiceSession` interface, so each slice's order and closing card could be checked without a key.
Route and stops: Reference route, not toured live: `src/ui/InteractionPrompt.tsx` (`talk('E')`) → `src/store/gameStore.ts` (`startConversation`) → `src/ai/npcSession.ts` (`buildNpcSession`) → `src/sim/interactionOutcome.ts` (`applyInteractionOutcome`) → `src/ui/ConversationColumn.tsx` (`ClosingCardPanel`).
Edit outcome: Declined.
Reflection: Offered and declined.
Activity mode: Brief recap.

## Revisions

- Added the cashier and server Jobs alongside the barista's — once the barista's Shift loop worked, the supermarket till and the restaurant's order pad were one Shift template each, so the learner chose to bring them back from the cut list. `scope.md`, `prd.md` and `spec.md` updated.
- Added the supermarket and cooking, the convenience store, the bookshop, the restaurant as a guest, the bathhouse's baths, the town office, directions at the tram stops, and Small Talk with gifts and Familiarity — each was one more interaction on the same conversation loop, and they give the money from Shifts somewhere to go. The learner chose to bring gifts and Familiarity back from the cut list. `scope.md`, `prd.md` and `spec.md` updated.
