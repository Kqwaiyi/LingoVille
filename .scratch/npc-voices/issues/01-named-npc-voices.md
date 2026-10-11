# 01: Each Named NPC speaks in their own voice that suits their build

**What to build:** When the Player talks to any Named NPC, in any Culture Pack, they hear that person's own NPC Voice, from the table in `../spec.md`. The voice is the same in every Culture Pack, suits the build of the NPC's Appearance Preset, and is shared with no other Named NPC. Today every Named NPC in a pack shares the Target Language's voice.

The gateway config tags each voice it uses as masculine or feminine and holds the table from Named NPC to voice. The token endpoint answers a Named NPC's voice request with that NPC's voice. Hear-it-said keeps its per-Target-Language voice, and Shift Customers and Passers-by keep their current behaviour (ticket 02 changes that).

Work test-first at seam 1 of the spec: the gateway's `/api/token`, through `createGateway` in mock mode.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A token request for each of the 15 Named NPCs answers with their voice from the spec's table, and no two are the same.
- [x] A Named NPC gets the same voice whatever the Target Language.
- [x] For every Culture Pack and every Named NPC, the voice's tag matches the build of that NPC's look in that pack. The test reads looks from `content`, so a change to a look's build without a voice change fails it.
- [x] A token request with an unknown Named NPC id gets a 400. An unknown Target Language still gets a 400.
- [x] Hear-it-said still says phrases in the Target Language's voice, and its cache key is unchanged.
- [x] The existing Shift Customer voice test still passes.
- [x] `npm run typecheck`, `npm run lint` and `npm test` pass. Don't run `npm run eval`: the user waived it for this feature.
