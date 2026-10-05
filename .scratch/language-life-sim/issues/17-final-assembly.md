# Final assembly

Type: task
Status: resolved
Blocked by: 14, 15, 16
Map: [Language-learning life sim](../map.md)

## Question

Combine the resolved tickets into the destination: a **game design doc** and a **technical spec** in `.scratch/language-life-sim/`, detailed enough to slice straight into build tickets. Each decision is stated once, in the right document, linking back to the ticket it came from. Use the vocabulary from `GLOSSARY.md`. Also list any contradictions between tickets, along with the questions still unanswered: those go back onto the map as tickets rather than being decided during assembly.

## Answer

Resolved on 2026-10-03 by `/to-spec`: **[spec.md](../../language-life-sim-build/spec.md)** (`Status: ready-for-agent`).

**One document, not two.** The human accepted a single spec instead of a separate game design doc and technical spec. The design side is the spec's Problem Statement, Solution and 188 User Stories. The technical side is its Implementation Decisions (by subsystem, with each decision linked to its source ticket) and Testing Decisions. It is detailed enough to slice into build tickets with `/to-tickets`.

**Test seams** (confirmed with the human): the pure `sim` public API is the primary seam. Supporting seams are `content` validation, the `ai` builders and annotate validator, and the `store` load path. Above them is a Playwright smoke test in mock mode, and real model quality is checked by `npm run eval`.

**Contradictions between tickets** are listed in the spec's Further Notes under "Superseded decisions" (9 cases, where the later ticket wins), along with 4 small decisions made during assembly.

**Unanswered questions** (13) did *not* go back onto the map, which would have reopened a map whose destination had been reached. **Deviation from this ticket's instruction:** instead, the human answered all 13 on 2026-10-03, before the build tickets were cut. Tuning numbers became defaults in one tuning module, to adjust in playtesting. The answers are written into the spec's Further Notes under "Decisions made before ticketing", so no build ticket waits on a decision.

**Location:** the spec and its build tickets live in their own folder, `.scratch/language-life-sim-build/` (35 tickets, numbered 01–35 in `issues/` there). This map folder holds only the decision tickets (01–17), all now closed.
