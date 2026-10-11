# 02: Shift Customers and Passers-by speak in a voice that suits their build

**What to build:** A Shift Customer or Passer-by speaks in an NPC Voice that suits the build of their Appearance Preset. The voice comes from the feminine or masculine pool in `../spec.md`, neither of which includes a Named NPC's voice, so they never sound like the staff. At a restaurant table, the voice suits the first diner, who is the one who speaks. A Passer-by keeps the same voice every day, as their look stays the same.

This change goes end to end and has to land in one piece:
- The anonymous variant of the voice request gains the NPC's `build`.
- The Shift Customer session builder sends the build of the customer's first appearance.
- The Passer-by session builder takes the Passer-by's build alongside the seed it already gets, and the store passes the build from the Passer-by's look in the Culture Pack.
- The gateway picks `pool[build][seed % pool.length]`.
- The two pools replace the old four-voice Shift Customer list.

Work test-first at the spec's two seams: the gateway's `/api/token` (mock mode), and the pure session builders in `ai`.

**Blocked by:** 01 (Each Named NPC speaks in their own voice that suits their build). The pools are the voices left over after the Named NPC table, and both tickets edit the gateway's voice config.

**Status:** done

- [x] A token request with a build and a seed answers with a voice from that build's pool. The pick wraps by seed.
- [x] No pool voice is any Named NPC's voice.
- [x] A token request for an anonymous NPC with a missing or unknown build, or a seed that isn't a whole number of 0 or more, gets a 400.
- [x] A Shift Customer session's voice request carries the customer's build. At a table, it carries the first diner's build.
- [x] A Passer-by session's voice request carries the build it was given, and the store gives it the build of that Passer-by's look.
- [x] Named NPC sessions still ask for a voice by NPC id, unchanged.
- [x] `npm run typecheck`, `npm run lint`, `npm test` and `npm run test:e2e` pass. Don't run `npm run eval`: the user waived it for this feature.
