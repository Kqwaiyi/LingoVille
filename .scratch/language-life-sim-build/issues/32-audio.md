# 32 — Audio: music, UI sounds, ambient and the conversation mix

**What to build:** The town has calm, culture-neutral music that changes with the time of day and indoors, gentle UI sounds, and ambient sound with a few local touches per pack. Each kind of sound has its own volume bus, read from device settings. During conversations the music ducks, and while the mic is open it mutes, so NPC speech stays clear and the game doesn't leak into the transcript.

**Blocked by:** 13b — Greybox town of 11 places and tram travel

**Spec:** [spec.md](../spec.md): Art and audio (Music, UI sounds, Ambient, Mix)

**Status:** ready-for-agent

- [ ] Volume buses for Master, Music, Ambient, Voice and UI, read from device settings.
- [ ] Music: 4 outdoor loops (one per lighting preset), a home loop, a counters loop and a title theme, all culture-neutral.
- [ ] UI sounds: click, money in and out, a success chime, a gentle failure tone, a Journal page-turn, and a subtle Patience-low cue. "Saved ✓" is silent.
- [ ] Ambient: shared beds plus per-pack one-shots from the Culture Pack's ids, never with intelligible speech.
- [ ] Mix: during a conversation, music at about 20% and ambient at about 40%, with TTS and hear-it-said at full volume.
- [ ] While the mic is open, music is muted and ambient is at about 10%.
