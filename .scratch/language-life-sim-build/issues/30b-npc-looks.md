# 30b — NPC looks and Patience faces

**What to build:** Named NPCs and Shift Customers use the shared rig. Named NPCs keep their build and role signifier in every pack, with local looks. Shift Customers are randomised with pack weights. NPC faces now show Patience.

**Blocked by:** 30a — Character rig and Appearance Presets, 23a — Named NPC personas and NPC Memory records, 19b — A Shift of single-drink customers

**Spec:** [spec.md](../spec.md): Art and audio (Characters); Named NPCs

**Status:** done

- [x] Named NPC looks come from the persona × pack table. The content check fails if any persona lacks an appearance in any pack.
- [x] Shift Customer looks come from the seeded RNG with pack weights (Vitest).
- [x] NPC facial expressions show Patience, replacing the placeholder from ticket 04.

## Comments

- **Persona × pack table.** Each pack's `appearances.npcs` now gives every Named NPC a whole Appearance Preset: the build they have in every pack, with local hair, hair colour and skin tone suited to their age and setting. The cross-reference check still fails a missing look or a changed build, and the schema fails a look missing a part. `townNpcLook(npcId, packId)` (content) reads it.
- **Pack weights.** `appearances.customers` weighs the body, a hair style for each build (so no feminine-build beards unless a pack asks), hair colour and skin tone. The schema fails a part left with nothing to draw. `customerLookWeights(packId)` hands the sim the hair styles keyed by body, since the sim can't import content's `BODY_PRESETS`.
- **Shift Customer looks.** `nextShiftCustomer(state, templates, looks, till?)` draws a look for everyone at the counter (the whole table at the restaurant) from the save's RNG after the voice, so earlier draws are unchanged. They live on `ShiftCustomer.appearances`. Save v18 gives a customer at the counter in an older save looks drawn from their voice seed with the pack's weights.
- **Passers-by.** They are anonymous too, so they get a look drawn once from the pack's weights with a fixed seed (`lookFromSeed`), the same every day. The glossary's Appearance Preset now names them.
- **Role signifier.** The free outfit atlas is dark brown, so tinting it doesn't read. Staff wear a bib apron in their role's colour instead (`APRONS` in `Town.tsx`), bound to the spine and pelvis bones. It goes by role, so it's the same in every pack. The landlord, park regulars and passers-by wear everyday clothes. **Not done:** the landlord's cardigan and the park regular's dog from the art direction ([16](../../language-life-sim/issues/16-art-and-audio-direction.md)). They need art the free packs don't have, and no ticket owns them yet.
- **Patience faces.** `CharacterFigure` takes an `expression`. Relaxed is the art's face. Puzzled lifts one brow, lowers the other and tilts the head. Strained knits both brows, inner ends up, and drops the chin. The brows are moved per figure (the art interleaves its vertex data, so each figure gets its own position attribute), and the head turn goes on top of the clip each frame (taken off again first, so a clip without a head track can't pile it up). The conversation column's emoji is gone: its header shows a close-up portrait of the NPC's own figure (`NpcPortrait`, a small canvas of its own), with the same accessible label as before. NPCs in town show it too, and turn to face the Character within 6 m.
- **Art guardrail.** `CHARACTER_BONES` (Head, pelvis, spine_03) joins the names `tooling/characterArt.test.ts` holds the art to.
- No prompt changes, so no eval needed.

