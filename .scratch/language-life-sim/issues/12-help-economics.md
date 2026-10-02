# Help economics

Type: grilling
Status: resolved
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

## Answer

**Help is free and works the same for everyone. Its only cost is that a helped turn tells the game less about the player's Proficiency.**

**No visible cost.** Help (hints, the phrasebook, hear-it-said) and tap-to-translate never cost money or Mood. Small Talk Mood gains are not reduced by Help either. The economy already has its money sinks (rent, food, bills), and charging for Help would hit A1 players and Typed Fallback players hardest.

**Proficiency evidence is discounted turn by turn.** Each conversation records a **Help log**: which hints and phrasebook entries were shown, and which NPC lines were translated (in order, relative to the turns). The Recap evaluation receives this log with the transcript:
- A player turn that closely repeats a hint or phrase shown just before it counts for **little** as speaking evidence.
- An NPC line that was tap-translated counts for **nothing** as listening evidence.
- Turns with no Help count in full.
- Help only ever **reduces weight**. It never lowers the level estimate. This works the same way as the existing weighting for very short conversations in [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md).

**Shifts.** Help stays available. If the player tap-translates a Shift Customer's order and then serves it correctly, that customer pays the normal amount **minus half the dock for a failed customer** at the current Shift stakes step. The customer also gives **no** listening evidence. So translating always beats failing, but understanding by ear pays more. Hints and phrasebook entries for the player's *own* lines stay free in Shifts, because there the test is understanding the customer.

**Same at every Proficiency Step.** Help does not get less generous as Proficiency rises. Hints are always full model sentences with their Native Language translation, and the phrasebook, hear-it-said and tap-to-translate are always available. NPCs get stricter through Patience only, and the evidence discount stops Help from inflating the score. This closes the question that [Core loop and economy](01-core-loop-and-economy.md) and [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md) left open.

**Shown to the player: positive only.** A Recap and its Journal entry get a **"No Help needed"** mark when no Help was used in that conversation, and nothing at all when Help was used. There are no counts and no scores.

**Downstream.**
- [Save model](13-save-model.md): each Journal entry stores its Help log (it's needed as evidence and for the mark).
- [AI quality evaluation](14-ai-quality-evaluation.md): what's measured should include whether the Recap evaluation applies the Help-log discount correctly (it must not credit repeated hint text, and must not lower the estimate because Help was used).
- HUD & conversation UI (fog): where the "No Help needed" mark goes.
