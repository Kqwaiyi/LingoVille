# 16b — NPC-initiated conversations: the nurse

**What to build:** Some NPCs start conversations themselves. The first is the nurse, who greets the Character in the Target Language on waking from Fainting. The same mechanism will later serve the landlord, the doctor and park regulars.

**Blocked by:** 16a — Fainting and hospital debt

**Spec:** [spec.md](../spec.md): Town and places (NPCs who start conversations)

**Status:** ready-for-agent

- [ ] A general way for an NPC to open a conversation with the Character when a condition is met, without the Player pressing E.
- [ ] The nurse starts talking when the Character wakes from Fainting.
- [ ] The conversation behaves like any other: the NPC speaks first, and Leave, the Recap and Help all work.
