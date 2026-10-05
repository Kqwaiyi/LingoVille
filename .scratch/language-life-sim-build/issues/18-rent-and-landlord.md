# 18 — Rent, the Newcomer Discount and the landlord

**What to build:** Rent is about 2 Shifts a week at full price, minus the Newcomer Discount, and first falls due at the end of day 7. The Player pays the landlord at home (#16), or asks for more time (#17). Unpaid rent becomes debt with a Mood penalty, never eviction. The landlord catches the Character in the hallway when rent is due and unpaid, and announces each Newcomer Discount step-down in conversation, never as a number.

**Blocked by:** 14 — Language Proficiency from Recap evidence, and NPCs adapt to the step, 16 — Fainting, hospital debt and NPC-initiated conversations

**Spec:** [spec.md](../spec.md): Economy; Town and places (NPCs who start conversations); Decisions made before ticketing (13)

**Status:** done

- [x] Rent falls due weekly from the end of day 7. The Newcomer Discount follows the highest step reached (50/40/25/10/0/0%) and only steps down, never back up (Vitest).
- [x] Paying rent (#16, `accept_rent(amount)`) clears rent and rent debt.
- [x] Unpaid rent becomes debt with a Mood penalty. Debt is repaid only at the counter, never from Shift pay (Vitest).
- [x] The landlord is available 8:00–20:00.
- [x] An extension (#17, `grant_extension(days)`) removes the Mood penalty for the extended days (Vitest).
- [x] The landlord approaches in the hallway when the Character leaves home and rent is due and unpaid, or a Newcomer Discount step-down is pending.
- [x] Step-downs are spoken by the landlord, never shown as numbers.
