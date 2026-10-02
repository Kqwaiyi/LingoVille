# Help economics

Type: grilling
Status: open
Blocked by: 08
Map: [Language-learning life sim](../map.md)

## Question

Does using Help cost anything? The Help side panel (contextual hints, phrasebook entries for the place, hear-it-said) and tap-to-translate are defined in [Anatomy of an interaction](02-anatomy-of-an-interaction.md), and Patience is frozen while Help is open. Decide: whether Help use reduces the Language Proficiency gain from that interaction, costs money or Mood, or is free; whether how generous Help is tightens as Proficiency rises (left open by [Core loop and economy](01-core-loop-and-economy.md)); and whether the Recap or Journal shows how much Help was used.

The [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md) ticket fixes the following:
- Proficiency is a hidden score in six CEFR steps, moved partway toward the level the Recap evaluation estimates after each conversation. Any Help discount on Proficiency would act on how much that evidence counts.
- NPCs get less forgiving through Patience only (4/4/3/3/2/2 from A1 to C2). Whether Help gets less generous at higher steps is this ticket's to decide.
- Job skills help with Shift mechanics only, never with understanding, so Shift results stay clean Proficiency evidence.

The [Technical architecture](10-technical-architecture.md) ticket fixes the following:
- Hear-it-said uses Gemini TTS through the local gateway and is cached in IndexedDB by `(text, voice)`, so repeat plays cost no API calls.
