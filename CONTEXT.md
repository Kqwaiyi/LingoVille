# Insomniacs

A single-player, low-poly 3D life-simulation web game where the player learns a language by living daily life in a town whose NPCs only respond to speech in that language.

## Language

**Player**:
The real person playing the game.
_Avoid_: User, learner (when referring to in-game things)

**Character**:
The player's in-game avatar, whose Well-being, Mood and Skills the player must maintain.
_Avoid_: Avatar, sim, player (when meaning the in-game body)

**Target Language**:
The language the player has chosen to learn and must speak to NPCs.
_Avoid_: Chosen language, learning language

**Well-being**:
The Character's physical state, made up of Health, Hunger and Thirst.
_Avoid_: Stats, vitals, needs

**Mood**:
The Character's emotional state, tracked separately from Well-being.

**Native Language**:
The player's own language, in which the game's UI is shown.
_Avoid_: UI language, mother tongue

**Life Skill**:
A practical capability of the Character that improves with use and is shown to the player as a level: Cooking, Fitness, and one per Job (Barista, Cashier, Server).
_Avoid_: Skill (unqualified)

**Language Proficiency**:
The player's measured ability in the Target Language, which NPCs adapt to. It is never shown to the player and can drift down as well as up.
_Avoid_: Language skill, level

**Proficiency Step**:
One of the six CEFR levels (A1–C2) that Language Proficiency falls into. NPC behaviour, Patience, the Newcomer Discount and Shift stakes all change at step boundaries.
_Avoid_: Level, rank, tier

**Job**:
Paid recurring work the Character performs, made of repeated NPC interactions in the Target Language. The Character gets each Job once, by asking the staff for work in the Target Language.

**Shift**:
One stretch of work at a Job, made of several customer interactions. Its pay depends on how many of those interactions succeed.
_Avoid_: Workday, session

**Newcomer Discount**:
A reduction on the Character's rent that shrinks as Language Proficiency rises.
_Avoid_: Subsidy, allowance

**First Morning**:
The guided start of a new game: the Character's first morning in the town, with prompts in the Native Language leading to the first café order.
_Avoid_: Tutorial level, intro

**Fainting**:
What happens when Well-being runs out: the Character wakes in hospital, losing time and owing a bill.
_Avoid_: Death, game over

**Illness**:
A random, temporary condition that drains the Character's Health until a doctor treats it, which means the player has to describe the symptoms in the Target Language.
_Avoid_: Sickness, disease, status effect

**NPC**:
A non-player character in the town that the player interacts with by speaking the Target Language.
_Avoid_: Bot, agent

**Named NPC**:
An NPC who is a specific person with a name and a fixed persona: every counter's staff, the park regulars and the landlord. The same person appears in every Culture Pack, with a local name and local dressing.
_Avoid_: Character (reserved for the player's avatar), villager

**Shift Customer**:
An anonymous NPC generated for one Shift interaction, with no name or memory.
_Avoid_: Customer (unqualified)

**Familiarity**:
How well a Named NPC knows the Character, in hidden tiers (stranger, acquaintance, friend). It is never shown as a number.
_Avoid_: Friendship, relationship, affinity

**NPC Memory**:
The small set of facts a Named NPC keeps about the Character between conversations.
_Avoid_: History, context

**Speaking**:
The player addressing an NPC by voice, through the microphone, in the Target Language.
_Avoid_: Chatting

**Typed Fallback**:
Typing a reply instead of Speaking, for when the microphone can't be used.

**Help**:
Support available in any conversation: hints, the phrasebook, hearing a phrase said aloud, and translating an NPC's line. It is free and the same at every Proficiency Step, but a turn that relied on it counts for less as evidence of Language Proficiency.

**Goal Interaction**:
A conversation with an NPC that has exactly one goal (e.g. order a drink, explain symptoms), judged as succeeded or failed by what the NPC understood.
_Avoid_: Quest, task, mission

**Small Talk**:
A goal-free conversation with an NPC that cannot fail and lifts Mood with each exchange that is understood.
_Avoid_: Chit-chat, free talk

**Patience**:
How many more turns an NPC will tolerate not understanding the player before ending a Goal Interaction as failed. Only a turn the NPC cannot make sense of at all costs Patience; a clarifying re-ask costs nothing.

**Recap**:
The skippable summary shown after a conversation: the outcome, up to three corrections, and new words.
_Avoid_: Report, feedback screen

**Journal**:
The player's saved collection of past Recaps.
_Avoid_: Log, history

**Save**:
One Character's whole life in one Target Language, kept only in this browser. A player can keep up to four.
_Avoid_: Profile, game, file, run

**Culture Pack**:
The local dressing of the one shared town for a Target Language: its food and goods, currency, customs, signs and opening hours.
_Avoid_: Skin, theme, locale

**Comfort Purchase**:
A consumable bought mainly to lift Mood rather than to meet a Well-being need (e.g. cake, a book, a bathhouse visit).
_Avoid_: Treat, luxury item

**Appearance Preset**:
One look on the shared character body (build and face, hair, skin tone, clothing), drawn from a single pool that the Character, Named NPCs and Shift Customers all use. The player picks the Character's once, at setup.
_Avoid_: Skin, avatar, outfit
