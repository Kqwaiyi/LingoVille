# 30b — NPC looks and Patience faces

**What to build:** Named NPCs and Shift Customers use the shared rig. Named NPCs keep their build and role signifier in every pack, with local looks. Shift Customers are randomised with pack weights. NPC faces now show Patience.

**Blocked by:** 30a — Character rig and Appearance Presets, 23a — Named NPC personas and NPC Memory records, 19b — A Shift of single-drink customers

**Spec:** [spec.md](../spec.md): Art and audio (Characters); Named NPCs

**Status:** ready-for-agent

- [ ] Named NPC looks come from the persona × pack table. The content check fails if any persona lacks an appearance in any pack.
- [ ] Shift Customer looks come from the seeded RNG with pack weights (Vitest).
- [ ] NPC facial expressions show Patience, replacing the placeholder from ticket 04.
