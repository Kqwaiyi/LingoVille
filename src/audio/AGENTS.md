# audio

The game's music, ambient sound and UI sounds, synthesised live with Web Audio: there are no sound files.

**Rules**
- What plays when is the store's business: `selectSoundscape` (music, ambient bed, one-shots, each bus's level) and `uiSoundsBetween` (the UI sounds a change to the store makes), in `src/store/soundscape.ts`. This module only plays what they say. Put any new rule about what plays when there, not here. The only sounds the UI starts itself are clicks on controls and the Journal's page turn between entries (`playUiSound`), which the store never sees.
- The mix numbers (ducking in conversations and under the open mic) are game numbers: `AUDIO_MIX` in `tuning.ts`. How each sound is made (notes, filters, envelopes, bus trims) lives here, as the lighting presets live in `world`.
- The NPC's voice and hear-it-said are the voice module's: this module only sets their volume (`setVoiceVolume`).
- The music stays culture-neutral: one soundtrack for every Culture Pack. A pack's local touches are its ambient one-shots (`ambient` in its Culture Pack, ids from `AMBIENT_SOUND_IDS`), each made in `ONE_SHOTS`. None may be intelligible speech.
- Nothing plays until the Player's first key or pointer press, as browsers require.
- `sim`, `content` and `ai` may not import this module.

**Testing**: no tests of the sound itself. The rules are tested in the store (`src/store/soundscape.test.ts`), and the Playwright smoke fails on any page error the audio throws. Listen to a change in `npm run dev`.

`npx vitest run src/store/soundscape.test.ts` · `npm run test:e2e`
