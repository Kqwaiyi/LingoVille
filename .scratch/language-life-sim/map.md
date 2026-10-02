# Map: Language-learning life sim

Labels: wayfinder:map
Status: open

## Destination

A **game design doc + technical spec** for a single-player, low-poly 3D, desktop-browser life sim in which the player keeps a Character alive and happy by Speaking the Target Language to NPCs — detailed enough to slice straight into build tickets. Not the build itself.

## Notes

**Domain & glossary.** Use the terms in `CONTEXT.md` (Character, Well-being, Mood, Life Skill, Language Proficiency, Target Language, Native Language, Job, Fainting, Speaking, Typed Fallback, Help). Grilling tickets: call the Skill tool for `grilling` and `domain-modeling`; update `CONTEXT.md` as terms resolve. Research tickets: `research` skill, findings in `.scratch/language-life-sim/research/`. Prototype tickets: `prototype` skill.

**Who & constraints.** Solo dev building with AI agents; understands web-dev workflow and reviews agent output. Hackathon, ~2 months, but time is explicitly not a constraint on design ambition. Runs **locally only** — never publicly deployed — using the dev's own **Google Gemini** API key.

**Settled while charting (the starting frame — not tickets):**
- Presentation: **low-poly 3D**, free-roaming town, Bloxburg-like. **Single-player. Desktop browser only.**
- Conversation: **Speaking (voice) is primary**, with Help (hints, phrasebook, hear-it-said) and a Typed Fallback. NPCs reply with **TTS + text bubble**; reading aids (e.g. pinyin) for languages that need them. Tap-to-translate.
- Languages: **Japanese, Chinese, English, German** — each can be Native or Target; Target ≠ Native. UI localized to Native Language, defaulted from the player's region.
- Learners: all levels. Player picks a starting level; Language Proficiency then adjusts silently and NPCs adapt to it.
- Conversations: **goal-driven interactions are the backbone** (order coffee, pay a bill), succeed when **intent is understood**; free small talk allowed and lifts Mood. Corrections shown in a **post-conversation recap**, never mid-conversation.
- Systems: Life Skills and Language Proficiency are **separate** systems. **Jobs: yes.** Well-being out → **Fainting** (hospital, lost time, bill). Mood is one meter: up from successful talk/socializing/comfort, down from failures/unmet needs/overwork; low Mood cuts pay and Skill gain.
- Time: compressed day cycle (~24 real min/day) with opening hours.
- Home: **fixed, no customization**.
- Town: about a dozen places — home, café, supermarket, restaurant, hospital, park, transit — with 2–3 Jobs.
- Saves: browser storage, no accounts.

## Decisions so far

<!-- one line per closed ticket -->

- [Gemini voice capabilities for Japanese, Chinese, English, German](issues/03-gemini-voice-capabilities.md) — `gemini-3.8-live` does speech-in → reasoning → speech-out in one session for all four languages, with transcripts both ways and function calling (for "goal achieved"). It has no structured output and no pronunciation score, so a post-conversation `generateContent` call handles the recap. Recommended: a small local Node server that creates short-lived tokens. About $0.012 per conversation minute; latency to be measured in the prototype.
- [Reading aids for Chinese and Japanese](issues/05-reading-aids.md) — Hybrid: Gemini returns `{base, reading}` segments with each line (structured output). For Chinese, fall back to `pinyin-pro` when a reply fails validation; for Japanese, `wanakana` makes romaji and `kuroshiro` loads only on demand (its dictionary is ~18 MB). Text bubbles are DOM `<ruby>` elements placed over the 3D scene (e.g. CSS2DRenderer), and players can hide reading aids.
- [Web 3D stack for a low-poly life sim](issues/04-web-3d-stack.md) — React Three Fiber + drei on Three.js r186, with @react-three/rapier and Rapier's kinematic character controller; Babylon.js is the fallback. Performance doesn't decide it at this town size. Pin agents to the Three.js version, because r186 changed the shadow APIs. Assets: Kenney and Quaternius (CC0); one Quaternius character rig + animation library for the Character and all NPCs.
- [Core loop and economy](issues/01-core-loop-and-economy.md) — An open-ended sandbox with no win state or promotions. Money comes only from Jobs, with Shift pay set by interaction success, Mood and Life Skills. Costs are food and drink, weekly rent, comfort purchases, doctor and medicine, and hospital bills; transit is free. Random Illness has to be explained to a doctor. Rent starts with a Newcomer Discount that fades as Language Proficiency rises, and unpaid rent and hospital bills become debt rather than eviction. Pacing and budget ratios are in the ticket.
- [Anatomy of an interaction](issues/02-anatomy-of-an-interaction.md) — The player presses E and the NPC greets first; talking is hold-Space push-to-talk (open mic optional). Each Goal Interaction is data with one goal and typed facts, and the outcome follows what the NPC understood, which it reads back before calling the completion function. A hidden Patience count, lowered by `not_understood()`, decides failure; slowness never costs. Shift customers reverse the roles: the player fills a hidden order, checked exactly against data. The clock runs at ¼ speed during conversations, and a Shift is 5–8 customers. Small Talk can't fail and its Mood gain is capped per NPC per day. Every Recap is skippable, gives up to 3 corrections, and is saved to the Journal.

## Not yet specified

- **HUD & conversation UI** — how meters, clock, money, subtitles, reading aids and the mic state are laid out on screen.
- **Art & audio direction** — low-poly style reference, Character customization (if any), asset sourcing, music/SFX. Asset sources and the shared character rig are settled by the 3D-stack research; style, Character customization and audio are still open.
- **AI quality evaluation** — how we'll check that NPCs stay in-language, at-level, and judge intent fairly across all four languages, and that reading aids (pinyin/furigana) are accurate — both libraries misread common words in testing, before trusting it.
- **Save model** — what exactly persists between sessions, and save/load UX. It now needs to include debts (rent, hospital bills), any current Illness, the Newcomer Discount step, and the Journal of Recaps.
- **Final assembly** — stitching resolved tickets into the GDD + tech spec documents; a ticket once most of the frontier has cleared.

## Out of scope

- Multiplayer / other real players in the town.
- House building, decorating, or furniture purchase.
- Accounts, cloud saves, public hosting/deployment, monetization, per-player API keys.
- Mobile / touch devices.
- Languages beyond Japanese, Chinese, English, German.
- The build itself (this map ends at the spec).
