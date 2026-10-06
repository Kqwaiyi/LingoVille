# 23a — Named NPC personas and NPC Memory records

**What to build:** The town has about 15 Named NPCs: counter staff, 3–4 park regulars and the landlord. Each has a fixed persona localised for every pack, and their name shows in the conversation header. The save keeps one NPC Memory record per Named NPC.

**Blocked by:** 13b — Greybox town of 11 places and tram travel

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory

**Status:** done

- [x] Persona content schema: name, age, temperament, quirks and one favourite gift, localised per pack. The content check fails if any persona lacks a localisation in any pack. `namedNpcSchema` (`src/content/npcs.ts`) types the shared persona (role, place, age, temperament, quirks). Each pack's `personas` gives every one of the 15 a local `name` and `favouriteGift`, and `appearances.npcs` an Appearance Preset. `culturePackProblems` reports a missing localisation, field or appearance.
- [x] Park regulars stand in the park as Named NPCs. `park-regular-1`–`3` are in `NAMED_NPC_IDS`. Every town NPC but the passers-by at the tram stop is now named: the five counters' staff, the receptionist, doctor and pharmacist, the shopkeeper, the bathhouse attendant, the town-office clerk, the park regulars and the landlord.
- [x] Each Named NPC has an NPC Memory record in the save, with the fields from the spec's table. With no record, the NPC treats the Character as a stranger. The record and its save schema already existed (`people` in `GameState`). `memoryOf(state, npcId)` reads it, or a stranger's when there is none.
- [x] `timesMet` goes up after each finished conversation with that NPC (Vitest). `applyInteractionOutcome` counts a success, a failure or an abandon, and creates the record on first meeting (`src/sim/npcMemory.test.ts`).
- [x] The role and persona prompt block uses the localised persona (snapshot). `WHO YOU ARE` adds the pack's favourite gift ("Don't bring it up yourself").

## Comments

- **Conversation header:** a Named NPC's local name, with the role in small text beside it (e2e: `conversation.spec.ts` checks 佐藤 and Barista). Shift Customers are unchanged. The Journal still names the NPC only once `knowsName` is set, as before.
- **Leaving counts as meeting:** walking off or pressing Esc is an abandon, so it adds to `timesMet`. The store tests that leaving "costs nothing" now ignore `people`. Small Talk (#23b) will need its own call, because it has no Goal Interaction outcome.
- **Not done:** the new NPCs (park regulars, bookshop, bathhouse, town office, clinic front desk) have no conversations yet. `WORKPLACES` in `npcSession.ts` is keyed by place, so `buildNpcSession` throws for the park, bookshop, bathhouse and town office. The receptionist, doctor and pharmacist would get the nurse's ward description instead. The tickets that give them conversations need a per-NPC workplace. Park regulars would also read as "the regular" in the prompt.
- **Prompt changed: needs a passing `npm run eval` before merging.** Every Named NPC session now has a favourite-gift line in `WHO YOU ARE`.
