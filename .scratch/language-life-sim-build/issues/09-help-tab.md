# 09 — Help tab

**What to build:** In any conversation, H (or the Help tab) opens Help. Time and Patience stop, and the tab says "The conversation waits while Help is open". It shows hints for this moment (full model sentences with a translation and 🔊), the place's phrasebook and the Player's personal phrasebook. Under every NPC line are Translate, which is instant, and 🔊 Replay. "+ Phrasebook" on a Recap's new words saves them. A Recap where no Help was used gets a "No Help needed" sticker.

**Blocked by:** 06 — Recap, hear-it-said and the Journal, 07 — Autosave and Continue

**Spec:** [spec.md](../spec.md): Help; Recap and Journal; Decisions made before ticketing (1–3)

**Status:** ready-for-agent

- [ ] `POST /api/hint` returns 2–3 hint sentences with Native Language translations, built from the goal, the facts, the step and the transcript so far. Its request builder is pure and snapshot-tested, and mock mode returns canned hints.
- [ ] `POST /api/annotate` returns a Native Language `translation` for every NPC line, in all four Target Languages. It fires as each line finishes, so Translate is instant. Readings are added in ticket 10.
- [ ] Opening Help sets the clock scale to 0 and freezes Patience.
- [ ] Place phrasebooks are authored content per place and pack. At least the café is authored for one pack here, and the content check validates them.
- [ ] The personal phrasebook is stored in the save. "+ Phrasebook" adds to it, and it appears in the Help tab and in a Phrasebook view in the Journal.
- [ ] Each conversation records a Help log (the hints and phrasebook entries shown and the NPC lines translated, ordered relative to the turns) and sends it to `/api/recap`.
- [ ] Evidence weighting in `sim`, with Vitest:
  - a turn that closely repeats a hint shown just before it counts for little;
  - a translated NPC line counts for nothing as listening evidence;
  - Help never lowers the estimate.
- [ ] The "No Help needed" sticker appears only when the Help log is empty. Otherwise nothing is shown.
- [ ] Help costs no money and no Mood, and works the same at every step.
