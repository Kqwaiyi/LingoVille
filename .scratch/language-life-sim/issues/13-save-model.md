# Save model

Type: grilling
Status: open
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
- anything the [NPC identity and memory](11-npc-identity-and-memory.md) and [Help economics](12-help-economics.md) tickets add
