import { GROCERIES_SOLD, TRAM_LINE, type CulturePack, type PropId } from '../content/index.ts';
import { PLACE_IDS, type PlaceId } from '../sim/index.ts';
import { buildingOf, frontOf, PLATFORM, TRAM_STOPS, type Building, type Vec3 } from './town.ts';

// Where each Culture Pack's props stand. The layout keeps the same spots in every pack, each for one kind of prop;
// a pack only says which props it sets out at each place (`props` in its content), and each takes the next free spot of
// its kind there, in the order the pack lists them.

/** The kinds of spot a prop stands in. Groceries stand on the supermarket's shelves, where `Groceries` sets them. */
export const SPOT_KINDS = ['door', 'counter', 'table', 'floor', 'lawn', 'platform', 'shelf'] as const;
export type SpotKind = (typeof SPOT_KINDS)[number];

/** Where a prop stands, and which way its front faces (radians about y; 0 faces +z). */
export type Spot = { at: Vec3; rotation?: number };
/** A place's spots, by kind. */
type PlaceSpots = Partial<Record<SpotKind, readonly Spot[]>>;

const FACING_NORTH = Math.PI;

/** At the foot of a building's front door, outside, facing the street: what hangs over the door is up in the prop. */
function doorSpot(building: Building): Spot {
  const { x, z, facing, rotation } = frontOf(building);
  return { at: [x, 0, z + facing * 0.05], rotation };
}

/** Each place's spots, by kind. Counter spots are on the counter top, either side of whoever stands behind it. */
const SPOTS: Record<PlaceId, PlaceSpots> = {
  // The stove top, and beside the bed against the back wall.
  home: { counter: [{ at: [-7.6, 1.03, -2.85] }], floor: [{ at: [-11.2, 0, -2.85] }] },
  cafe: { counter: [{ at: [10.6, 1.1, -3] }, { at: [13.6, 1.1, -3] }] },
  // The till, and inside the door, east of the aisles.
  supermarket: { counter: [{ at: [23.4, 1.1, 0.4] }], floor: [{ at: [32.4, 0, 1.8] }] },
  'convenience-store': { counter: [{ at: [-0.4, 1.1, -2.2] }, { at: [1.4, 1.1, -2.2] }] },
  // A dish on each table, the server's included.
  restaurant: { table: [{ at: [39.5, 0.8, -3] }, { at: [44.5, 0.8, -3] }, { at: [39.5, 0.8, -0.3] }] },
  // Reception's counter and the pharmacy's, facing the door; and the waiting room, west of the bench.
  clinic: {
    counter: [
      { at: [-30.8, 1.1, 13.5], rotation: FACING_NORTH },
      { at: [-20.2, 1.1, 13.5], rotation: FACING_NORTH },
    ],
    floor: [{ at: [-28.3, 0, 17.6], rotation: FACING_NORTH }],
  },
  // Open lawn, clear of the trees, the benches and the way in.
  park: { lawn: [{ at: [2, 0.01, 17] }, { at: [-4.5, 0.01, 20.6], rotation: 0.5 }] },
  // The west end of each platform, clear of the shelter's posts and of where the tram sets the Character down.
  'tram-stop': { platform: TRAM_LINE.map((stopId): Spot => ({ at: [TRAM_STOPS[stopId].centre[0] - 3.65, PLATFORM.height, TRAM_STOPS[stopId].centre[1] + 0.3] })) },
  bookshop: { counter: [{ at: [-30.9, 1.1, -2] }, { at: [-29.1, 1.1, -2] }] },
  // The front desk, facing the door; and the corner east of the door.
  bathhouse: {
    counter: [
      { at: [25.1, 1.1, 13.5], rotation: FACING_NORTH },
      { at: [22.9, 1.1, 13.5], rotation: FACING_NORTH },
    ],
    floor: [{ at: [28, 0, 12.4], rotation: FACING_NORTH }],
  },
  'town-office': { counter: [{ at: [-45.8, 1.1, -2.5] }, { at: [-42.2, 1.1, -2.5] }] },
};

/** Every place's spots, each building's door included. */
export const PROP_SPOTS: Record<PlaceId, PlaceSpots> = Object.fromEntries(
  PLACE_IDS.map((placeId) => {
    const building = buildingOf(placeId);
    return [placeId, building ? { door: [doorSpot(building)], ...SPOTS[placeId] } : SPOTS[placeId]];
  }),
) as Record<PlaceId, PlaceSpots>;

/** The kind of spot each prop is made for. */
export const SPOT_FOR_PROP: Record<PropId, SpotKind> = {
  'cash-tray': 'counter',
  'qr-stand': 'counter',
  'card-reader': 'counter',
  'coin-dish': 'counter',
  noren: 'door',
  'red-lantern': 'door',
  bunting: 'door',
  'flower-box': 'door',
  'lucky-cat': 'counter',
  'tea-set': 'counter',
  'cake-stand': 'counter',
  'bread-basket': 'counter',
  onigiri: 'counter',
  'tea-eggs': 'counter',
  'sausage-rolls': 'counter',
  bockwurst: 'counter',
  'medicine-boxes': 'counter',
  'book-stack': 'counter',
  paperwork: 'counter',
  'towel-stack': 'counter',
  nabe: 'counter',
  steamer: 'counter',
  'fry-up': 'counter',
  'sausage-pan': 'counter',
  teishoku: 'table',
  'dim-sum': 'table',
  'fish-and-chips': 'table',
  sauerkraut: 'table',
  'mikan-crate': 'floor',
  'rice-sacks': 'floor',
  'flower-buckets': 'floor',
  'drinks-crates': 'floor',
  bonsai: 'floor',
  'water-dispenser': 'floor',
  'magazine-table': 'floor',
  'coat-stand': 'floor',
  'wash-buckets': 'floor',
  'foot-basins': 'floor',
  'sauna-bucket': 'floor',
  andon: 'floor',
  'lucky-bamboo': 'floor',
  radio: 'floor',
  teddy: 'floor',
  'hanami-mat': 'lawn',
  'stone-lantern': 'lawn',
  'xiangqi-table': 'lawn',
  'picnic-blanket': 'lawn',
  'beer-bench': 'lawn',
  'vending-machine': 'platform',
  'sorting-bins': 'platform',
  'post-box': 'platform',
  'litfass-column': 'platform',
  cabbages: 'shelf',
  'bok-choy': 'shelf',
  carrots: 'shelf',
  potatoes: 'shelf',
  eggs: 'shelf',
  udon: 'shelf',
  'dried-noodles': 'shelf',
  spaghetti: 'shelf',
  spaetzle: 'shelf',
};

/** A prop set out in its spot. */
export type Placed = { propId: PropId; spot: Spot };

/**
 * Sets a place's props out in its spots: each in the next free spot of its kind. A prop with no spot left for it is
 * left out, and named in `problems`.
 */
export function setOut(placeId: PlaceId, propIds: readonly PropId[]): { placed: Placed[]; problems: string[] } {
  const used: Partial<Record<SpotKind, number>> = {};
  const placed: Placed[] = [];
  const problems: string[] = [];
  for (const propId of propIds) {
    const kind = SPOT_FOR_PROP[propId];
    const spots = PROP_SPOTS[placeId][kind] ?? [];
    const next = used[kind] ?? 0;
    const spot = spots[next];
    if (!spot) {
      problems.push(spots.length === 0 ? `the ${placeId} has no ${kind} spot for ${propId}.` : `the ${placeId} has no ${kind} spot left for ${propId}.`);
      continue;
    }
    used[kind] = next + 1;
    placed.push({ propId, spot });
  }
  return { placed, problems };
}

/** Everything in a pack's set dressing that doesn't fit the shared layout, one line each, or nothing. */
export function setDressingProblems(pack: Pick<CulturePack, 'props' | 'shelves'>): string[] {
  return [
    ...PLACE_IDS.flatMap((placeId) => setOut(placeId, pack.props[placeId] ?? []).problems),
    ...GROCERIES_SOLD.flatMap((itemId) => {
      const propId = pack.shelves[itemId];
      const kind = SPOT_FOR_PROP[propId];
      return kind === 'shelf' ? [] : [`${itemId} sit on the shelf as ${propId}, which is a ${kind} prop.`];
    }),
  ];
}
