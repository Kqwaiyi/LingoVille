# Save model

Type: grilling
Status: resolved
Blocked by: 11, 12
Map: [Language-learning life sim](../map.md)

## Question

What exactly persists between sessions, and how do saving and loading look to the player? Decide the fields of the save object and the save/load UX: one slot or several, autosave timing (e.g. on sleep, after each conversation, on tab hide), whether there is a manual save, how a new game or reset works, export/import of a save file, and what happens when a save fails validation or migration.

The [Technical architecture](10-technical-architecture.md) ticket fixes the mechanism: IndexedDB through `idb-keyval`, one versioned save object validated with Zod on load and upgraded by ordered migrations. NPC and Character positions live in the 3D world, except the Character's current place.

Things the save must cover, gathered from earlier tickets:
- debts (rent, hospital bills, payment plans) and any current Illness
- the Newcomer Discount step, the hidden Proficiency score and the highest step reached (for the ratchet)
- Life Skill XP and the daily Cooking and gym limits
- the inventory (groceries with expiry dates, Comfort Purchases, gifts), gym membership and address registration
- the chosen Culture Pack, the Jobs the Character has been hired for, First Morning progress and tooltips already seen
- the input setting (mic or Typed Fallback), with Native Language possibly kept outside the save
- the Journal of Recaps, with their annotated reading aids
- the Character's name, and one NPC Memory record per Named NPC (familiarity points and daily cap, `timesMet`, `knowsName`, `usualOrder`, `lastTopic`, `favouriteKnown`, `lastGiftDay`, `registerOffered`), keyed by stable NPC id, from [NPC identity and memory](11-npc-identity-and-memory.md)
- anything the [Help economics](12-help-economics.md) ticket adds

From [Help economics](12-help-economics.md): each Journal entry stores its conversation's **Help log** (hints and phrases shown, NPC lines translated) and whether it earned the "No Help needed" mark.

## Answer

**Four free slots. Saving is automatic and the player never sees it, nothing is ever deleted without the player asking, and a save refers to content by id rather than copying it.**

**Slots.** There are **4 slots**, and any slot can hold any Target Language (two slots may share one). One slot holds one **Save**: one Character's life in one Target Language. The title screen shows **Continue**, which loads the most recently played slot, and a slot list. Each slot card shows the Character's name, the Target Language, the in-game day, money and when it was last played.

**Autosave only. There is no manual save.** The game writes the save:
- after every conversation's outcome is applied, before the Recap shows
- at sleep / the start of a new day
- when the Character goes through a door between places
- on `visibilitychange`→hidden and on `pagehide`
- as a safety net every ~2 real minutes

A small "Saved ✓" mark briefly appears in a corner of the HUD.

**Interrupted play.**
- A conversation is **never saved in progress**. If the tab closes mid-conversation, the next load returns to the last save before it began, with no outcome and no penalty, the same as a network drop. Quitting just before a failure is an accepted dodge, because it gains nothing a retry wouldn't.
- A **Shift saves after every customer**. Reloading mid-Shift ends the Shift with pay for the customers already served, with no penalty.
- On load, the Character appears at the entrance spawn of the saved place, or in bed if they were at home.
- The **RNG state is saved**. Illness rolls and the Shift customer mix come out the same after a reload when the player does the same things, so reloading can't be used to dodge an Illness.

**Device settings are kept apart from saves.** One record per browser, outside every save, holds the Native Language, volumes, push-to-talk vs open mic, the mic / Typed Fallback input mode, whether reading aids are shown, tooltips on/off and **which tooltips have already been seen**. A second slot therefore doesn't teach the controls again. **First Morning progress stays per save.**

**Save contents.** One small object (a few KB):
- **Meta**: `schemaVersion`, `slotId`, created / last-played timestamps, RNG state
- **Identity**: Character name, Target Language, Culture Pack id
- **Clock & place**: day number, minute of day, current place id
- **Character state**: Well-being (Health, Hunger, Thirst), Mood, money, current Illness (id + onset day)
- **Obligations**: rent day and amount owed, debts (rent, hospital bills), payment plans
- **Progression**: hidden Proficiency score, highest Proficiency Step reached (for the ratchet), Newcomer Discount step, Life Skill XP for each of the 5 skills, daily Cooking and gym counters
- **Possessions & status**: inventory (item id, quantity, expiry day), gym membership expiry, address registered, Jobs hired for, Shift in progress (customers served, pay so far)
- **Onboarding**: First Morning progress
- **People**: one NPC Memory record per Named NPC, keyed by stable NPC id (fields as in [NPC identity and memory](11-npc-identity-and-memory.md)), plus the shared daily Familiarity cap

**Content by id, never copied.** The save stores item, interaction, NPC and Culture Pack ids only, so content edits reach old saves. A migration must remap or drop any id that has been renamed or removed. On load, an unknown id fails the check loudly; it is never dropped silently.

**The Journal is its own store.** It is an append-only IndexedDB store keyed by `slotId`. Each entry has its own `schemaVersion`, Zod check and migrations, so an autosave never rewrites the Journal's history. There is no cap on its size. Each entry keeps its **rendered** text rather than ids, because it records what was actually said. Each entry holds the Recap, the annotated lines (with reading aids), the Help log, the "No Help needed" mark and the Native Language it was written in.

**Failure handling. Nothing is deleted or overwritten automatically.**
- A **pre-migration backup** of a slot is written before any migration runs.
- Each slot keeps one **start-of-day backup**, rotated at each sleep.
- If the main save fails the check or a migration, the game tries the start-of-day backup and tells the player: "Loaded this morning's save".
- If both fail, the slot card shows "This save couldn't be loaded" with **Export raw file** and **Delete** buttons.

**Export / import.**
- **Export** is on each slot card's menu and in Settings. It writes one JSON file per slot (`insomniacs-<name>-<lang>-day<N>.json`) holding the save, its Journal entries and its backups' metadata. It leaves out the TTS cache and device settings.
- **Import** goes into an **empty slot only**; if all 4 are full, the player deletes one first. The file goes through the same Zod check and migration path as a load, and a bad file is rejected with a plain message.

**New game, delete, no reset.**
- **New game** means picking an empty slot and running the setup screens. Native Language is pre-filled from device settings, and the mic check is skipped if this browser has already passed it.
- **Delete** asks the player to type the Character's name, then removes the save, its backups and its Journal.
- There is no separate reset: starting over means deleting and then starting a new game.
- With all 4 slots full, "New game" is greyed out with "Delete a save to start a new one".

**Eviction protection.** The game calls `navigator.storage.persist()` the first time it writes a save. If the browser refuses, a one-time tooltip under Settings explains that the browser may clear saves when space runs low and suggests exporting a backup.

**Downstream.**
- HUD & conversation UI (fog): the "Saved ✓" mark, the title screen with Continue and the slot list, slot cards and their menu, the "couldn't be loaded" card, and the persist-refused tooltip.
- Final assembly (fog): the save schema above becomes the `sim` state type plus the Journal entry type in the tech spec.
