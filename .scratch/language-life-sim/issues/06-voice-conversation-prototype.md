# Voice conversation prototype

Type: prototype
Status: open
Blocked by: 03, 02
Map: [Language-learning life sim](../map.md)

## Question

Does a voice conversation with a Gemini-driven NPC *feel* right? Build a throwaway, non-3D page: one café barista NPC, goal "order a drink", in one Target Language, using the approach the Gemini research recommends. React to: latency, turn-taking, whether intent judgement is fair to a beginner, TTS quality, and whether the "goal achieved" signal comes back reliably. Outcome: keep, adjust, or replace the voice approach.

The [Anatomy of an interaction](02-anatomy-of-an-interaction.md) ticket adds things to check:
- Push-to-talk with Space via manual `activityStart`/`activityEnd` (open mic as a toggle), including interrupting the NPC.
- The NPC reads the order back before it calls the completion function (`serve_order(items[])`).
- `not_understood()` fires reliably on turns it can't make sense of, and not on turns it understood.
- Loanwords from the Native Language are understood, but full Native-Language sentences are not.
- A post-conversation `generateContent` call produces the Recap: outcome, up to 3 corrections, new words.
