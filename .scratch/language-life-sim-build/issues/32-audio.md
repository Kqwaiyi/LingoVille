# 32 — Audio: music, UI sounds, ambient and the conversation mix

**What to build:** The town has calm, culture-neutral music that changes with the time of day and indoors, gentle UI sounds, and ambient sound with a few local touches per pack. Each kind of sound has its own volume bus, read from device settings. During conversations the music ducks, and while the mic is open it mutes, so NPC speech stays clear and the game doesn't leak into the transcript.

**Blocked by:** 13b — Greybox town of 11 places and tram travel

**Spec:** [spec.md](../spec.md): Art and audio (Music, UI sounds, Ambient, Mix)

**Status:** done

- [x] Volume buses for Master, Music, Ambient, Voice and UI, read from device settings.
- [x] Music: 4 outdoor loops (one per lighting preset), a home loop, a counters loop and a title theme, all culture-neutral.
- [x] UI sounds: click, money in and out, a success chime, a gentle failure tone, a Journal page-turn, and a subtle Patience-low cue. "Saved ✓" is silent.
- [x] Ambient: shared beds plus per-pack one-shots from the Culture Pack's ids, never with intelligible speech.
- [x] Mix: during a conversation, music at about 20% and ambient at about 40%, with TTS and hear-it-said at full volume.
- [x] While the mic is open, music is muted and ambient is at about 10%.

## Comments

- **Sourcing: synthesised, not sourced.** Every sound is made live with Web Audio in the new `audio` module (`src/audio/`): there are no audio files, so nothing to credit (`CREDITS.md` says so). The spec's order is CC0 first, then CC-BY, then AI-generated music, so this is a fourth option nobody signed off. It's easy to swap: everything that plays goes through `ONE_SHOTS`, `UI_SOUNDS`, `playLoop` and `playBed`. **Needs a listen in `npm run dev`**, especially the zh pack's `street-vendor-call` (a wordless sung vowel, closest to a voice).
- **What plays when is the store's** (`src/store/soundscape.ts`, tested in `soundscape.test.ts`):
  - `selectSoundscape` returns the music track, the ambient bed, the pack's one-shots and each bus's level.
  - **Music.** Title and setup play the title theme. Out in the open, the loop is the lighting preset the light is nearer (`blend < 0.5 ? from : to`), with a 4 s crossfade, so it changes halfway between keyframes. Indoors, home plays the home loop and every other building the counters loop.
  - **Outdoors.** The street, the park or a tram stop (`OPEN_AIR_PLACES`). The store had no notion of the street (the place id stays the last place entered), so the world now calls `setOnStreet` each frame from `placeAt`. It's never saved.
  - **Ambient beds.** `street`, `park`, `night` (once the lamps are on) and `indoors`. The pack's one-shots play outdoors only, about every 15–45 s, panned and at a distance.
  - **Levels.** Master × each bus, times `AUDIO_MIX` (`tuning.ts`): `conversation` {music 0.2, ambient 0.4}, `micOpen` {music 0, ambient 0.1}. Voice and UI are never ducked.
  - **Mic open** (`selectMicOpen`): push-to-talk held; or open mic while the Player can take a turn in the chat (not in Help, nor once the outcome is decided); or the setup mic check, which mutes the title theme so the check hears only the Player.
- **Ambient ids are checked.** `AMBIENT_SOUND_IDS` in `content` lists them, and the pack schema takes only those (at least one), so a pack can't name a sound the audio module doesn't make.
- **UI sounds.** `uiSoundsBetween(before, after)` gives:
  - money in or out, from the change in money;
  - `success` or `failure` as the closing card shows (Small Talk chimes), or as a Shift Customer is served (`served` chimes, the rest get the failure tone);
  - `patienceLow` once, as the NPC's face first goes strained;
  - `pageTurn` as the Recap shows or the Journal opens.

  Loading a save or starting a game makes no sound, and neither does saving. The UI itself plays only clicks on controls (one capture listener) and the Journal's page turn between entries (`playUiSound`).
- **Voice volume.** The voice module routes the NPC's voice and hear-it-said through a Master × Voice gain (`setVoiceVolume`), set by the audio module and never ducked. "At full volume" is read as the Voice slider's full level, not a literal 1.0 over the Player's setting.
- **Browser.** Nothing plays until the first key or pointer press (autoplay rules). The context is suspended while the tab is hidden, as the game is paused then anyway. A throwaway Playwright probe checked that no context exists before the first press, and that the title theme and then the home loop with its indoor bed start after it.
