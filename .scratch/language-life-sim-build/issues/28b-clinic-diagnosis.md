# 28b — Clinic check-in and diagnosis

**What to build:** At the clinic, the Player checks in at reception (#12) and waits until the doctor calls their name. Then they describe their symptoms (#13). The diagnosis is right only if the Player got the symptoms across.

**Blocked by:** 28a — Falling ill, 16b — NPC-initiated conversations: the nurse

**Spec:** [spec.md](../spec.md): Illness; Goal Interactions (#12, #13); Town and places (NPCs who start conversations)

**Status:** ready-for-agent

- [ ] Interactions #12 (`register_patient(reason)`) and #13 (`diagnose(illness)`) are defined and work in all four packs.
- [ ] After check-in, the doctor calls the Character's name in the waiting room, which starts the conversation.
- [ ] The doctor's facts include the symptoms of each Illness. The diagnosis records a prescription.
- [ ] The clinic is closed on Sundays.
