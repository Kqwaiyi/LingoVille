# 03 — Talk to the barista (mock NPC, typed)

**What to build:** Near the barista, "Press E to talk — barista" appears. Pressing E opens the conversation column on the right, and the barista speaks first. The Player types in the always-present field (T focuses it, Enter sends) and gets replies from a scripted mock NPC in the chat column. Time runs at ¼ speed while talking. Esc or walking away ends the conversation at no cost.

**Blocked by:** 02 — Walk to the café and watch the clock

**Spec:** [spec.md](../spec.md): Goal Interactions (flow); NPC prompt assembly; Voice pipeline (mock mode); UI and HUD (conversation)

**Status:** ready-for-agent

- [ ] `buildNpcSession(interaction, culturePack, proficiencyStep, npc, context)` is pure and returns the system instruction, tools and voice. The instruction is built from the spec's ordered blocks: persona; "You and this person" (the stranger default for now); language rules; step adaptation; facts; goal; situation. Vitest snapshots it for each of the four languages at one step.
- [ ] A `VoiceSession` interface exists with a mock implementation: a scripted fake NPC that accepts `sendText`. The UI depends only on the interface.
- [ ] Chat column layout: the header (NPC role, place, time; the Chat tab; Leave (Esc)), NPC lines as left bubbles, player lines as right bubbles headed "Heard as", and an input bar with the typed field. The dock shrinks and centres on the area left of the column, and the 3D scene stays visible.
- [ ] The clock scale is ¼ during any conversation.
- [ ] Leaving with Esc or by walking out of range ends the session without changing any state.
- [ ] While the typed field has focus, Space types a space.
