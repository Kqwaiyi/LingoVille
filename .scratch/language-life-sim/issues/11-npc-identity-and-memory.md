# NPC identity and memory

Type: grilling
Status: resolved
Map: [Language-learning life sim](../map.md)

## Question

Do NPCs have persistent identities? Pin down: whether each NPC is a named individual with a fixed personality and schedule, or an interchangeable role (barista, customer); whether NPCs remember past conversations with the Character (e.g. "the usual?"), and if so what is remembered and how it reaches the NPC's prompt; whether relationships or friendship with the Character exist and what they change (Patience, Small Talk Mood gain, discounts, Help); and how this fits with Small Talk's per-NPC daily Mood cap from [Anatomy of an interaction](02-anatomy-of-an-interaction.md).

The [Town and content scope](07-town-and-content-scope.md) ticket fixes the following:
- Each counter has one staff role, with no shift changes; plus 3–4 park regulars (Small Talk, who wave you over at most once a day) and a pool of Shift customers. This ticket decides whether they are named individuals.
- Gifts (flowers or a wrapped gift from the bookshop) exist as a stub item. This ticket decides what giving one to an NPC does.

The [Technical architecture](10-technical-architecture.md) ticket fixes the following:
- NPC prompts come from `buildNpcSession(interaction, culturePack, proficiencyStep, npc, context)`, an English meta-prompt made of ordered blocks (persona, language rules, step adaptation, facts, goal, situation). Any memory of the Character would be another block or part of `context`, and anything remembered must go in the save ([Save model](13-save-model.md)).

## Answer

Resolved by grilling on 2026-10-03. Terms are defined in `CONTEXT.md`: Named NPC, Shift Customer, Familiarity, NPC Memory.

**Who is named.** Every counter's staff, the 3–4 park regulars and the landlord are **Named NPCs**: about 15 people, each with one authored persona (name, age, temperament, a few quirks, one favourite gift). A Culture Pack localises the same person with a local name and local dressing. Personas live in `content` as Zod-typed data keyed by a stable NPC id. **Shift Customers** stay anonymous, with a random look and voice per customer and no memory. A recurring customer cast is not part of launch.

**Familiarity.** A hidden points total for each Named NPC, read as three tiers: **stranger → acquaintance → friend**. It is never shown as a number.
- *Sources:* Small Talk exchanges the NPC understands count most, a gift gives a one-off bump, and a successful Goal Interaction with that NPC counts a little.
- *Cap:* Familiarity gain shares the per-NPC, per-in-game-day cap with the Mood from Small Talk (see [Anatomy of an interaction](02-anatomy-of-an-interaction.md)), so one long day can't max anyone out. Tune it so friend takes about 1–2 in-game weeks of regular visits.
- *No decay.* Familiarity never drops, so a player who puts the game down doesn't come back to a lost friendship.

**What tiers change.**

| Effect | Stranger | Acquaintance | Friend |
|---|---|---|---|
| Greets by name (if `knowsName`), "the usual?", follows up on last topic | name only once learned | ✓ | ✓ |
| Small Talk Mood gain | base | higher | higher still |
| Patience with this NPC | step value | step value | step value **+1** |
| Register | polite | polite | offers to switch to casual, once |
| "On the house" | — | — | rare, at most once a week, flavour |

No discounts: prices are authored as Shift ratios ([Town and content scope](07-town-and-content-scope.md)), and Familiarity must not leak into the economy. Familiarity never unlocks Help; that stays with [Help economics](12-help-economics.md).

**Register switch.** When an NPC first reaches friend, it offers once to switch register (e.g. "Wollen wir uns duzen?", or moving from keigo to タメ口; Chinese gets warmer forms of address, and English just gets more casual). From then on it speaks casually, still adapted to the Proficiency Step. The Recap notes the switch as a new usage. This is the cultural milestone that justifies Familiarity in a language game.

**Small Talk with any Named NPC.** This overrides "the park has Small Talk only" from Town and content scope. Pressing E on a Named NPC who isn't busy (no queue, not mid-order) opens a goal-free Small Talk conversation, with the usual ¼-speed clock. If the player states a goal partway through, the game doesn't switch it into a Goal Interaction; the NPC just points them to the counter. Park regulars still wave the player over at most once a day.

**Character name.** Setup gains one "your name" field on the self-assessment screen (an amendment to [Onboarding and Native Language selection](09-onboarding-and-native-language.md)). This is the only Character customisation decided here. An NPC learns the name only when the player says it: the NPC model calls `learn_name(name)`, which the sim checks against the setup name before setting `knowsName`. The hiring Goal Interaction checks the name the same way. NPCs that haven't learned the name never use it.

**Gifts.** A "give" action can be used in any conversation with a Named NPC while a gift item is in the inventory. The NPC reacts in the Target Language. Familiarity gets a bump and the Character gets a little Mood. At most one gift per NPC per week counts (`lastGiftDay`). The NPC's authored **favourite** gives a bigger bump. The player finds it out by asking in Small Talk, and when the NPC names it, it calls `reveal_favourite()`, which sets `favouriteKnown`.

**NPC Memory**, one typed record per Named NPC in the save, keyed by stable NPC id:

| Field | Written by |
|---|---|
| `familiarity` (points; tier derived) and the daily cap counter | sim |
| `timesMet` | sim |
| `knowsName` | `learn_name` function, checked by the sim |
| `usualOrder` | sim: the same Goal Interaction ending with the same completion arguments 3 times in a row |
| `lastTopic` (about 20 words at most, English) | a new optional field in the Recap `responseSchema`, written only after Small Talk or a chat-heavy conversation; it is overwritten, never added to |
| `favouriteKnown` | `reveal_favourite` function |
| `lastGiftDay` | sim |
| `registerOffered` | sim, once the friend-tier offer has been made |

Nothing else is free-form. With no record, the NPC treats the Character as a stranger.

**"The usual?"** Once `usualOrder` exists, an acquaintance or friend offers it. If the player says yes, that counts as a normal success, and the Recap's level evidence is small because the player said so little. The player can always order something else.

**Prompt.** `buildNpcSession` gets a new **"You and this person"** block between *persona* and *language rules*. It is English text generated as a pure function of the NPC Memory record: the tier and how to address the Character (name if known, register), the usual if any, the last topic and whether to bring it up, and whether the favourite has been told already. It is snapshot-tested like the other blocks. A stranger gets a short default block. `learn_name` and `reveal_favourite` join the session's tools for Named NPCs.

**Knock-on effects.**
- [Onboarding and Native Language selection](09-onboarding-and-native-language.md): add a name field to the self-assessment screen.
- [Save model](13-save-model.md): the save includes the Character name and one NPC Memory record per Named NPC.
- [Town and content scope](07-town-and-content-scope.md): Small Talk is no longer only in the park, and gifts are no longer a stub.
- Recap `responseSchema` ([Technical architecture](10-technical-architecture.md)): add the optional `lastTopic` field.
