# NPC identity and memory

Type: grilling
Status: open
Map: [Language-learning life sim](../map.md)

## Question

Do NPCs have persistent identities? Pin down: whether each NPC is a named individual with a fixed personality and schedule, or an interchangeable role (barista, customer); whether NPCs remember past conversations with the Character (e.g. "the usual?"), and if so what is remembered and how it reaches the NPC's prompt; whether relationships or friendship with the Character exist and what they change (Patience, Small Talk Mood gain, discounts, Help); and how this fits with Small Talk's per-NPC daily Mood cap from [Anatomy of an interaction](02-anatomy-of-an-interaction.md).

The [Town and content scope](07-town-and-content-scope.md) ticket fixes the following:
- Each counter has one staff role, with no shift changes; plus 3–4 park regulars (Small Talk, who wave you over at most once a day) and a pool of Shift customers. This ticket decides whether they are named individuals.
- Gifts (flowers or a wrapped gift from the bookshop) exist as a stub item. This ticket decides what giving one to an NPC does.

The [Technical architecture](10-technical-architecture.md) ticket fixes the following:
- NPC prompts come from `buildNpcSession(interaction, culturePack, proficiencyStep, npc, context)`, an English meta-prompt made of ordered blocks (persona, language rules, step adaptation, facts, goal, situation). Any memory of the Character would be another block or part of `context`, and anything remembered must go in the save ([Save model](13-save-model.md)).
