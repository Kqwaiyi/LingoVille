# 06 — Recap, hear-it-said and the Journal

**What to build:** After a conversation, See Recap shows a lined Journal page in the chat column: the outcome; up to three corrections (what the Player said, a more natural version with 🔊, and one line on why, in the Native Language); and new words with 🔊. A loading state covers the roughly 6 s of generation, which started when the conversation ended. Skipping shows "Recap saved to your Journal". J opens a full-screen Journal listing every entry, newest first.

**Blocked by:** 04 — Order a drink and pay

**Spec:** [spec.md](../spec.md): Recap and Journal; Voice pipeline (TTS)

**Status:** done

- [x] `POST /api/recap` (`generateContent` + `responseSchema`, with the flash-class model from the config) takes:
  - the transcript, with player lines marked as possibly misheard;
  - the Help log (empty for now);
  - the interaction, the step and the Native Language.
- [x] It returns an outcome line, `corrections[]` (≤ 3), `newWords[]`, `cefrEstimate` and an optional `lastTopic`. Mock mode returns a canned Recap.
- [x] The Recap request builder is pure and snapshot-tested. Its prompt treats a likely mishearing as a pronunciation point, and it supports a lighter variant for Small Talk and a combined variant for a whole Shift.
- [x] Order of events: apply the outcome → autosave hook → closing card → Recap.
- [x] `POST /api/tts` returns hear-it-said audio via Gemini TTS. Clips are cached in IndexedDB by a hash of (text, voice), in a store separate from saves.
- [x] The Journal is an append-only IndexedDB store keyed by slot, separate from the save. Each entry has its own `schemaVersion` and Zod schema, and holds rendered text and the Native Language it was written in.
- [x] J opens the Journal full-screen, with the entry list on the left (newest first) and the selected entry on the right. Esc closes it.
