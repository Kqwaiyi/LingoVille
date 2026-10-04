# 18b — Extensions, hallway reminders and step-downs

**What to build:** The Player can ask the landlord for more time (#17). The landlord catches the Character in the hallway when rent is due and unpaid, and announces each Newcomer Discount step-down in conversation, never as a number.

**Blocked by:** 18a — Rent, the Newcomer Discount and paying the landlord, 16b — NPC-initiated conversations: the nurse

**Spec:** [spec.md](../spec.md): Economy; Town and places (NPCs who start conversations)

**Status:** ready-for-agent

- [ ] An extension (#17, `grant_extension(days)`) removes the Mood penalty for the extended days (Vitest).
- [ ] The landlord approaches in the hallway when the Character leaves home and rent is due and unpaid, or a Newcomer Discount step-down is pending.
- [ ] Step-downs are spoken by the landlord, never shown as numbers.
