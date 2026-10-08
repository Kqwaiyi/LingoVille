import { describe, expect, it } from 'vitest';
import { PLACE_IDS, type PlaceId } from '../sim/index.ts';
import { BODY_PRESETS, CULTURE_PACKS, customerLookWeights, isPasserBy, localNpcPlaceName, localPlaceName, NAMED_NPCS, PASSER_BY_STOPS, STOP_PLACES, stopsBetween, TOWN_NPC_IDS, TOWN_NPCS, TRAM_LINE, townNpcLook, type RoleId } from './index.ts';

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

  it('names the place of every Named NPC locally in every pack, for the chat header and the Journal', () => {
    for (const packId of Object.keys(CULTURE_PACKS) as (keyof typeof CULTURE_PACKS)[]) {
      for (const npc of Object.values(NAMED_NPCS)) expect(localPlaceName(npc.placeId, packId)).not.toBe('');
    }
    expect(localPlaceName('park', 'ja')).toBe('桜ヶ丘公園');
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

describe('passers-by and the tram line', () => {
  it('has one passer-by waiting at each stop, and no one else is a passer-by', () => {
    expect(Object.values(PASSER_BY_STOPS).sort()).toEqual([...TRAM_LINE].sort());
    expect(TOWN_NPC_IDS.filter(isPasserBy)).toEqual(TOWN_NPC_IDS.filter((npcId) => TOWN_NPCS[npcId].role === 'passer-by'));
  });

  it('names one stop to get off at for every place but the tram stop itself', () => {
    const served = TRAM_LINE.flatMap((stopId) => STOP_PLACES[stopId]);
    expect(served.sort()).toEqual(PLACE_IDS.filter((placeId) => placeId !== 'tram-stop').sort());
  });

  it('finds a passer-by at their stop, by its local name, and anyone else at their place', () => {
    expect(localNpcPlaceName('passer-by-3', 'de')).toBe(CULTURE_PACKS.de.tramStops['east-stop'].name);
    expect(localNpcPlaceName('office-clerk', 'ja')).toBe(localPlaceName('town-office', 'ja'));
  });

  it('dresses a Named NPC in their look from the persona × pack table', () => {
    expect(townNpcLook('barista', 'de')).toEqual({ body: 'body-1', hairStyle: 'long', hairColour: 'blonde', skinTone: 'tone-1' });
    expect(townNpcLook('barista', 'ja')).toEqual({ body: 'body-2', hairStyle: 'short', hairColour: 'dark-brown', skinTone: 'tone-2' });
  });

  it('gives each passer-by a look of their own in each pack, from the pack’s weights', () => {
    const { customers } = CULTURE_PACKS.ja.appearances;
    const looks = TOWN_NPC_IDS.filter(isPasserBy).map((npcId) => townNpcLook(npcId, 'ja'));
    expect(new Set(looks.map((look) => JSON.stringify(look))).size).toBe(looks.length);
    for (const look of looks) {
      expect(customers.body[look.body]).toBeDefined();
      expect(customers.hairStyle[BODY_PRESETS[look.body].build][look.hairStyle]).toBeDefined();
      expect(customers.hairColour[look.hairColour]).toBeDefined();
      expect(customers.skinTone[look.skinTone]).toBeDefined();
    }
    expect(townNpcLook('passer-by-1', 'ja')).toEqual(townNpcLook('passer-by-1', 'ja'));
  });

  it('weighs a pack’s hair styles for each body by its build', () => {
    const weights = customerLookWeights('en');
    expect(weights.hairStyle['body-2']).toEqual(CULTURE_PACKS.en.appearances.customers.hairStyle.masculine);
    expect(weights.hairStyle['body-4']).toEqual(CULTURE_PACKS.en.appearances.customers.hairStyle.feminine);
    expect(weights.skinTone).toEqual(CULTURE_PACKS.en.appearances.customers.skinTone);
  });
});
