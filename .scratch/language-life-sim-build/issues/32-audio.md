# 32 — Audio

**What to build:** The town has calm music that changes with the time of day and indoors, ambient sound with a few local touches, and gentle UI sounds. During conversations the music ducks, and while the mic is open it mutes, so NPC speech stays clear and the game doesn't leak into the transcript.

**Blocked by:** 05 — Speak to NPCs with a real voice, 13 — The whole town: 11 places, hours and trams

**Spec:** [spec.md](../spec.md): Art and audio (Music, Ambient, Mix, UI sounds)

**Status:** ready-for-agent

- [ ] Music: 4 outdoor loops (one per lighting preset), a home loop, a counters loop and a title theme, all culture-neutral.
- [ ] Ambient: shared beds plus per-pack one-shots, never with intelligible speech.
- [ ] Mix: during a conversation, music at about 20% and ambient at about 40%, with TTS and hear-it-said at full volume. While the mic is open, music is muted and ambient is at about 10%.
- [ ] UI sounds: click, money in and out, a success chime, a gentle failure tone, a Journal page-turn, and a subtle Patience-low cue. "Saved ✓" is silent.
- [ ] Volume buses for Master, Music, Ambient, Voice and UI, read from device settings.
