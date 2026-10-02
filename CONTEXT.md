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
A practical capability of the Character (e.g. Cooking, Fitness) that improves with use.
_Avoid_: Skill (unqualified)

**Language Proficiency**:
The player's measured ability in the Target Language, which NPCs adapt to.
_Avoid_: Language skill, level

**Job**:
Paid recurring work the Character performs, made of repeated NPC interactions in the Target Language.

**Shift**:
One stretch of work at a Job, made of several customer interactions. Its pay depends on how many of those interactions succeed.
_Avoid_: Workday, session

**Newcomer Discount**:
A reduction on the Character's rent that shrinks as Language Proficiency rises.
_Avoid_: Subsidy, allowance

**Fainting**:
What happens when Well-being runs out: the Character wakes in hospital, losing time and owing a bill.
_Avoid_: Death, game over

**Illness**:
A random, temporary condition that drains the Character's Health until a doctor treats it, which means the player has to describe the symptoms in the Target Language.
_Avoid_: Sickness, disease, status effect

**NPC**:
A non-player character in the town that the player interacts with by speaking the Target Language.
_Avoid_: Bot, agent

**Speaking**:
The player addressing an NPC by voice, through the microphone, in the Target Language.
_Avoid_: Chatting

**Typed Fallback**:
Typing a reply instead of Speaking, for when the microphone can't be used.

**Help**:
Beginner support during a conversation: hints, the phrasebook, and hearing a phrase said aloud.
