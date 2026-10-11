import { describe, expect, it } from 'vitest';
import { jobAt, TOWN_NPC_IDS, TOWN_NPCS } from '../src/content/index.ts';
import { PLACE_IDS, type PlaceId } from '../src/sim/index.ts';
import {
  BATHHOUSE_GYM,
  BEFORE_THE_DOCTOR,
  FURNITURE,
  HOME_BED,
  HOME_STOVE,
  HOME_TAP,
  NPC_SPOTS,
  placeAt,
  SHELF_SPOTS,
  SOLIDS,
  SPAWN_POINTS,
  WARD_BED,
  WORKPLACES,
  type Vec3,
} from '../src/world/town.ts';

// Holds the town's layout to what the game needs of it: everyone stands in their own place, every spawn point and
// everything the Character uses is in the place it belongs to, and no furniture stands where the Character or anyone
// else has to stand.

/** How far from a spot furniture must keep: the Character's capsule's radius. */
const CLEARANCE = 0.35;

type Spot = { name: string; at: Vec3; placeId: PlaceId; standing?: boolean };
type Box = { position: Vec3; size: Vec3 };

/** Every spot the game needs in a place: where people stand, where the Character starts and goes, and what they use. */
function spots(): Spot[] {
  return [
    ...TOWN_NPC_IDS.map((npcId): Spot => ({ name: npcId, at: NPC_SPOTS[npcId], placeId: TOWN_NPCS[npcId].placeId, standing: true })),
    ...PLACE_IDS.map((placeId): Spot => ({ name: `the ${placeId}'s spawn point`, at: SPAWN_POINTS[placeId], placeId, standing: true })),
    ...Object.entries(WORKPLACES).flatMap(([jobId, { usedFrom, behindTheCounter, customerSpot }]): Spot[] => {
      const placeId = PLACE_IDS.find((place) => jobAt(place) === jobId)!;
      return [
        { name: `the ${jobId}'s staff door`, at: usedFrom, placeId, standing: true },
        { name: `behind the ${jobId}'s counter`, at: behindTheCounter, placeId, standing: true },
        { name: `the ${jobId}'s customer`, at: customerSpot, placeId },
      ];
    }),
    { name: 'the tap', at: HOME_TAP, placeId: 'home' },
    { name: 'the stove', at: HOME_STOVE, placeId: 'home' },
    { name: 'the bed', at: HOME_BED, placeId: 'home' },
    { name: 'the gym', at: BATHHOUSE_GYM, placeId: 'bathhouse' },
    { name: 'the ward bed', at: WARD_BED, placeId: 'clinic' },
    { name: 'before the doctor', at: BEFORE_THE_DOCTOR, placeId: 'clinic', standing: true },
    ...Object.entries(SHELF_SPOTS).map(([itemId, at]): Spot => ({ name: `the ${itemId} shelf`, at, placeId: 'supermarket' })),
  ];
}

/** Every spot out of its place, and every spot someone stands on with furniture in the way, one line each. */
function layoutProblems(all: Spot[], solids: Box[]): string[] {
  const blocked = ({ at: [x, , z] }: Spot) =>
    solids.some(({ position: [bx, , bz], size: [w, , d] }) => Math.abs(x - bx) < w / 2 + CLEARANCE && Math.abs(z - bz) < d / 2 + CLEARANCE);
  return all.flatMap((spot) => [
    ...(placeAt(spot.at[0], spot.at[2]) === spot.placeId ? [] : [`${spot.name} is not in the ${spot.placeId}.`]),
    ...(spot.standing && blocked(spot) ? [`${spot.name} is blocked by furniture.`] : []),
  ]);
}

describe('the town layout', () => {
  it('puts everyone and everything in their place, with nothing in the way of where anyone stands', () => {
    expect(layoutProblems(spots(), [...FURNITURE, ...SOLIDS])).toEqual([]);
  });

  it('catches someone out of their place, and furniture where someone stands', () => {
    const misplaced: Spot[] = [
      { name: 'barista', at: NPC_SPOTS.barista, placeId: 'restaurant', standing: true },
      { name: 'cashier', at: NPC_SPOTS.cashier, placeId: 'supermarket', standing: true },
    ];
    const inTheWay: Box = { position: NPC_SPOTS.cashier, size: [1, 1, 1] };
    expect(layoutProblems(misplaced, [inTheWay])).toEqual(['barista is not in the restaurant.', 'cashier is blocked by furniture.']);
  });
});
