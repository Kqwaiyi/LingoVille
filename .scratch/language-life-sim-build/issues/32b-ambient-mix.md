# 32b — Ambient sound and the conversation mix

**What to build:** The town has ambient sound with a few local touches per pack. During conversations the music ducks, and while the mic is open it mutes, so NPC speech stays clear and the game doesn't leak into the transcript.

**Blocked by:** 32a — Audio buses, music and UI sounds

**Spec:** [spec.md](../spec.md): Art and audio (Ambient, Mix)

**Status:** ready-for-agent

- [ ] Ambient: shared beds plus per-pack one-shots from the Culture Pack's ids, never with intelligible speech.
- [ ] Mix: during a conversation, music at about 20% and ambient at about 40%, with TTS and hear-it-said at full volume.
- [ ] While the mic is open, music is muted and ambient is at about 10%.
