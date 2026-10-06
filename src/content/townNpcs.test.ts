import { describe, expect, it } from 'vitest';
import { PLACE_IDS, type PlaceId } from '../sim/index.ts';
import { NAMED_NPCS, stopsBetween, TOWN_NPC_IDS, TOWN_NPCS, TRAM_LINE, type RoleId } from './index.ts';

/** The NPCs column of the spec's places table. */
const STAFF_BY_PLACE: Record<PlaceId, RoleId[]> = {
  home: ['landlord'],
  cafe: ['barista'],
  supermarket: ['cashier'],
  'convenience-store': ['clerk'],
  restaurant: ['server'],
  clinic: ['doctor', 'nurse', 'pharmacist', 'receptionist'],
  park: ['regular', 'regular', 'regular'],
  'tram-stop': ['passer-by', 'passer-by', 'passer-by'],
  bookshop: ['shopkeeper'],
  bathhouse: ['attendant'],
  'town-office': ['clerk'],
};

describe('town NPCs', () => {
  it.each(PLACE_IDS)('puts the staff from the places table at the %s', (placeId) => {
    const roles = Object.values(TOWN_NPCS)
      .filter((npc) => npc.placeId === placeId)
      .map((npc) => npc.role)
      .sort();
    expect(roles).toEqual(STAFF_BY_PLACE[placeId]);
  });

  it('keeps every Named NPC at the place and in the role their persona has', () => {
    for (const npc of Object.values(NAMED_NPCS)) {
      expect(TOWN_NPCS[npc.id]).toMatchObject({ placeId: npc.placeId, role: npc.role });
    }
  });

  it('makes everyone but the people waiting for the tram a Named NPC: the staff, the park regulars and the landlord', () => {
    const named = TOWN_NPC_IDS.filter((npcId) => npcId in NAMED_NPCS);
    expect(named).toEqual(TOWN_NPC_IDS.filter((npcId) => TOWN_NPCS[npcId].role !== 'passer-by'));
    expect(named).toEqual(expect.arrayContaining(['park-regular-1', 'park-regular-2', 'park-regular-3']));
  });

  it("works the landlord's hours at home, not the home's", () => {
    expect(TOWN_NPCS.landlord.hoursId).toBe('landlord');
  });
});

describe('the tram line', () => {
  it('has 2–3 stops', () => {
    expect(TRAM_LINE.length).toBeGreaterThanOrEqual(2);
    expect(TRAM_LINE.length).toBeLessThanOrEqual(3);
  });

  it('counts the stops between two stops along the line, either way', () => {
    const [first, , last] = TRAM_LINE;
    expect(stopsBetween(first!, last!)).toBe(2);
    expect(stopsBetween(last!, first!)).toBe(2);
    expect(stopsBetween(first!, first!)).toBe(0);
  });
});
