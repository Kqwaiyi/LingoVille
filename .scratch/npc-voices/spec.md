# Spec: NPC Voices that suit each NPC

Status: ready-for-agent

Every NPC in a Culture Pack speaks in the same voice, and anonymous NPCs get a voice unrelated to how they look. This spec gives each NPC an NPC Voice that suits the build of their Appearance Preset. Terms follow `GLOSSARY.md`.

## Problem Statement

When the Player talks to the town's Named NPCs, every one of them sounds the same. That voice is picked per Target Language, so in the English pack the landlord, the nurse and the barista all speak with one male voice, and in the Japanese pack all of them, the barista and shopkeeper included, speak with one female voice. The town sounds like one person playing everyone, and a voice often doesn't fit the body it comes from.

Shift Customers and Passers-by are drawn from four voices by a seed that has nothing to do with their look. A feminine-build customer can speak in a male voice, and a masculine-build Passer-by in a female one.

## Solution

Every NPC speaks in an NPC Voice that suits the build of their Appearance Preset.

- Each Named NPC has their own voice, chosen to suit their build and roughly their age and temperament. The voice is the same in every Culture Pack, and no two Named NPCs share one.
- Each Shift Customer and Passer-by gets a voice suited to their build, from a pool of voices that no Named NPC uses, so they never sound like the staff. At a restaurant table, the voice suits the first diner, who is the one who speaks.
- Hear-it-said keeps its single voice per Target Language.

## User Stories

1. As a Player, I want each Named NPC to sound different from the others, so that the town feels like it's full of distinct people.
2. As a Player, I want a Named NPC's voice to suit their body, so that what I hear matches what I see.
3. As a Player, I want the landlord to sound like an older person, so that the voice fits a 63-year-old persona.
4. As a Player, I want the convenience-store clerk to sound young, so that the voice fits a 21-year-old student.
5. As a Player, I want the barista to sound upbeat, so that the voice fits a warm, chatty persona.
6. As a Player, I want a Named NPC to keep the same voice every time I talk to them, so that I recognise them by ear.
7. As a Player who switches Culture Pack in a new game, I want each Named NPC to keep their voice, so that the same person sounds the same in any pack.
8. As a Player, I want the doctor and the nurse to sound different, so that I can tell who's talking at the clinic without looking.
9. As a Player, I want each park regular to sound different from the other two, so that Small Talk with each feels personal.
10. As a Player working a Shift, I want a customer's voice to suit their body, so that a feminine-build customer doesn't speak in a male voice and vice versa.
11. As a Player working a Shift, I want customers to sound different from the staff, so that I never mistake a customer for a Named NPC.
12. As a Player serving a restaurant table, I want the voice to suit the diner who speaks to me, so that the speaker matches what I see.
13. As a Player asking a Passer-by which tram to take, I want their voice to suit their body, so that the stranger at the stop sounds believable.
14. As a Player, I want Passers-by to sound different from Named NPCs, so that a stranger never sounds like someone I know.
15. As a Player, I want a Passer-by to keep the same voice every day, so that they stay consistent with their look, which is also the same every day.
16. As a Player using hear-it-said, I want phrases read in the same voice as before, so that the tutor voice stays familiar and clips I've already heard play instantly.
17. As a developer, I want a test to fail if a Named NPC's look changes build without their voice changing, so that voice and body can't drift apart.
18. As a developer, I want to swap a Named NPC's voice with a one-line change in the gateway config, so that voices can be tuned by ear after playtesting.
19. As a developer, I want browser code to keep never naming a voice, so that voices stay a gateway concern, as `server/AGENTS.md` and `src/voice/AGENTS.md` require.
20. As a developer, I want the gateway to reject a voice request for an anonymous NPC with a missing or unknown build, so that a bad request fails loudly instead of picking a voice that doesn't fit.

## Implementation Decisions

- **Gender is the build.** There is no new gender field. An NPC's voice must suit the `build` (masculine or feminine) of their Appearance Preset. A Named NPC already has the same build in every Culture Pack.
- **The voices live only in the gateway config**, as the server rules require. Each prebuilt voice the game uses is tagged masculine or feminine there.
- **Named NPC voices** are a table from Named NPC to voice, in the gateway config:

  | Named NPC | Build | Voice |
  |---|---|---|
  | landlord | feminine | Kore |
  | convenience-clerk | feminine | Leda |
  | receptionist | feminine | Despina |
  | doctor | feminine | Sulafat |
  | nurse | feminine | Vindemiatrix |
  | park-regular-1 | feminine | Gacrux |
  | park-regular-2 | feminine | Achernar |
  | attendant | feminine | Callirrhoe |
  | office-clerk | feminine | Erinome |
  | barista | masculine | Puck |
  | cashier | masculine | Sadachbia |
  | server | masculine | Algieba |
  | pharmacist | masculine | Iapetus |
  | park-regular-3 | masculine | Achird |
  | shopkeeper | masculine | Algenib |

  These are first picks based on Gemini's voice descriptions, to be adjusted by ear later.
- **Anonymous voices** (Shift Customers and Passers-by) are two pools in the gateway config, one per build, with no voice from the Named NPC table:
  - Feminine: Zephyr, Aoede, Autonoe, Laomedeia, Pulcherrima
  - Masculine: Charon, Fenrir, Orus, Enceladus, Umbriel, Rasalgethi, Alnilam, Schedar, Zubenelgenubi, Sadaltager

  These replace the current four-voice Shift Customer list.
- **The token request contract changes:**
  - Named NPC: still `{ targetLanguage, npcId }`. The gateway now answers with that NPC's voice instead of the Target Language's voice. An unknown `npcId` is a 400.
  - Anonymous NPC: `{ targetLanguage, shiftCustomerVoice: seed, build }`. The gateway answers with `pool[build][seed % pool.length]`. A missing or unknown `build`, or a seed that isn't a whole number of 0 or more, is a 400.
  - An unknown `targetLanguage` is still a 400.
- **The `VoiceRequest` type in `ai`** gains `build` on its anonymous variant.
- **Shift Customer sessions** send the build of the customer's first appearance. For a table, that's the first diner.
- **Passer-by sessions** take the Passer-by's build from their look in the Culture Pack, alongside the seed they already get. The store passes it through when it opens the conversation.
- **Hear-it-said** keeps the per-Target-Language voice table, and its cache key doesn't change. That table is now used only by hear-it-said.
- **Mock mode** returns the same voice names as real mode, since the voice is chosen before the mock/real split.
- **No save change.** The voice is worked out each time a session opens and is never saved.

## Testing Decisions

- Good tests check behaviour the caller can see: which voice the gateway answers with for a request, and what voice request a session builder produces. They don't check which config constant holds the table.
- **Seam 1: the gateway's `/api/token`**, through `createGateway` in mock mode on an ephemeral port. Prior art: the existing test that gives a Shift Customer one of the Shift Customer voices by seed, in the gateway tests. Cases:
  - Each Named NPC gets a voice, and the 15 voices are all different.
  - A Named NPC gets the same voice in every Target Language.
  - For every Culture Pack and every Named NPC, the voice's tag matches the build of that NPC's look in that pack. The test reads looks from `content` and the voice tags from the gateway config.
  - An anonymous request gets a voice from its build's pool. The pick wraps by seed, and no pool voice is a Named NPC's voice.
  - An anonymous request with a missing or unknown build, or a bad seed, gets a 400.
  - An unknown `npcId` gets a 400.
- **Seam 2: the session builders in `ai`**, which are pure. Prior art: the Shift Customer and NPC session builder tests. Cases:
  - A Shift Customer session's voice request carries the customer's build.
  - At a table, the voice request carries the first diner's build.
  - A Passer-by session's voice request carries the build it was given.
  - Named NPC sessions are unchanged and still ask by `npcId`.
- No new seam, and no changes to the Live session, the mock `VoiceSession` or the Playwright smoke tests. The existing smoke tests must still pass.

## Out of Scope

- Choosing voices by age or temperament automatically. The table is hand-picked.
- Giving hear-it-said an NPC's voice, or changing its voice at all.
- Different voices per Culture Pack for the same Named NPC.
- A gender field on personas separate from build.
- Changing any Named NPC's look or build.
- Tuning the picks by ear. That happens later, as one-line config changes.

## Further Notes

- The gateway config changes, which `server/AGENTS.md` normally gates on `npm run eval`. The user has waived it for this feature: the change touches only voice names, which no eval checks. Do not run it.
- The glossary already has an **NPC Voice** entry for these rules.
