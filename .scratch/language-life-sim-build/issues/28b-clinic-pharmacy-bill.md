# 28b — Clinic, pharmacy and the hospital bill

**What to build:** At the clinic, the Player checks in at reception (#12) and waits until the doctor calls their name. Then they describe their symptoms (#13); the diagnosis is right only if the Player got the symptoms across. At the pharmacy, the Player gets medicine (#14). The right medicine cures at once, but the wrong one doesn't cure at all. Flu is different: the fever reducer stops the Health drain at once, and the flu clears only after the next sleep. At reception, the Player settles hospital debt in full, or arranges to pay it in instalments (#15). Instalments come out automatically on rent day, and a missed instalment stays as debt.

**Blocked by:** 28a — Falling ill, 15 — Sleep, Mood sources and the Mood modifier, 16 — Fainting, hospital debt and NPC-initiated conversations, 18 — Rent, the Newcomer Discount and the landlord

**Spec:** [spec.md](../spec.md): Illness; Goal Interactions (#12, #13, #14, #15); Economy (debt); Town and places (NPCs who start conversations); Decisions made before ticketing (7, 13)

**Status:** done

- [x] Interactions #12 (`register_patient(reason)`), #13 (`diagnose(illness)`), #14 (`dispense(medicine)`) and #15 (`set_payment_plan(weeks)`, where 0 means pay now) are defined and work in all four packs.
- [x] After check-in, the doctor calls the Character's name in the waiting room, which starts the conversation.
- [x] The doctor's facts include the symptoms of each Illness. The diagnosis records a prescription.
- [x] The clinic is closed on Sundays.
- [x] `dispense` cures only if the medicine matches the Illness (Vitest).
- [x] The fever reducer stops flu's Health drain at once, but the flu clears only after the next sleep (Vitest).
- [x] Hospital debt can be paid in full at reception, or set as a plan. Plan instalments are taken automatically on rent day, and a missed instalment stays as debt (Vitest).
- [x] A doctor's visit plus medicine costs clearly less than Fainting (Vitest on content prices).

## Comments

- **Check-in (#12):** `checkIn` (`register_patient(reason)`, I), E at the receptionist. `reason` is flavour only. It records `clinic.checkedInAt`; checking in again starts the wait again.
- **The doctor's call:** a new approach, `doctorCallsName`. Once the Character has waited `CLINIC.waitForDoctorGameMinutes` (15) at the clinic, `approachDue` sends the doctor, who opens `seeTheDoctor` with a "you call the patient's name" scene. `approachMade` clears the check-in. Leaving the clinic (`enterPlace` elsewhere) gives up the place in the queue, and a call still pending for a Character who has left is dropped. The store sets `doctorCall` and the world moves the Character in front of the doctor (`BEFORE_THE_DOCTOR`), so moving doesn't end the conversation.
- **Diagnosis (#13):** `seeTheDoctor` (`diagnose(illness)`, I). The doctor's `symptoms` facts list each Illness by its symptoms and medicine, and say the doctor doesn't know which one the patient has: only what they describe. `diagnose` records `clinic.prescription` (the diagnosed Illness's medicine, whatever the Character really has) and charges the visit, `ECONOMY.consultationFeeInShifts` (0.4: ¥2,400, 96元, £24, €24), or adds it to hospital debt when the Character can't pay, like Fainting.
- **Pharmacy (#14):** `getMedicine` (`dispense(medicine)`, B), E at the pharmacist only while a prescription is held (otherwise E chats). The four medicines are items now (`ECONOMY.medicineInShifts`, 0.15: ¥900, 36元, £9, €9), named in every pack. Only the prescribed medicine is dispensed (`invalid_arguments` otherwise), and only if it can be paid for. The right one cures at once; the fever reducer instead sets the flu `treated`, which stops its Health drain (`illnessHealthPerMinute`), and `sleep` clears a treated flu before the night's roll. The wrong one cures nothing. The prescription is used up either way.
- **Hospital bill (#15):** `settleHospitalBill` (`set_payment_plan(weeks)`, A), F at the receptionist while hospital debt is owed ("Press F to settle your hospital bill"). 0 pays it all now (`cannot_afford` if short); 1–`ECONOMY.maxPaymentPlanWeeks` (4) sets a plan of equal instalments, replacing any plan, first due on the current rent day. `takeInstalments` runs at each day's end with rent: a due instalment is taken if the Character has it all, otherwise it is missed and stays as debt, and the plan carries on a week later until the debt is paid. Reception's `hospitalBill` facts give the amount owed, what each number of weeks comes to, and when instalments are taken.
- **Price check:** a visit plus any medicine is at most half the Fainting bill in every pack (0.55 vs 1.5 Shifts).
- **Sunday:** the clinic's default hours already close it on Sundays; `store/clinic.test.ts` checks the Character can't get in or check in.
- **Save:** schema 16. The migration gives an existing Illness `treated: false` and adds an empty `clinic`.
- **Mock:** reception reads back and checks in on a yes, the doctor names the Illness most of the described symptoms fit and diagnoses on a yes, the pharmacist reads back the prescription with its price as it greets, and reception reads back all-now or N weeks for the bill. All four packs are in `mockVoiceSession.test.ts`; `e2e/clinic.spec.ts` is the ja smoke (check in, the doctor calls, diagnosis).
- **Decisions from the review (judgement calls):**
  - A Character checked in before closing is still called by the doctor after it: the visit is under way, and decision 8 lets that finish.
  - The doctor's visit fee goes to hospital debt when the Character can't pay it (like Fainting), rather than `cannot_afford`: a sick Character is never turned away. The doctor's facts say so.
  - Fainting gives up a place in the doctor's queue, and `approachStillDue` (sim) drops a pending call for a Character who has left or fainted.
  - Left as they were: the shared "debt of a kind" lookups in rent, restaurant and clinic, and the effect-kind pattern spreading each new effect across about ten sites (noted in 27 too).
- **Not done:** prompts changed (four new clinic sessions, the doctor's scene, new facts), so this needs a passing `npm run eval` before merging. It hasn't been run.
