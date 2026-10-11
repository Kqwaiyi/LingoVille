/**
 * The town's scenery for `scripts/build-town.ts`: what makes the streets, the park, the backdrop and the rooms more
 * than walls and counters. Most of it comes from the Kenney kits the town already uses (the train kit's tram, the fantasy town's fountain and stalls, the nature
 * kit's trees and rocks, the furniture kit's rooms). What no kit has is modelled in Blender: the `town-art` kit,
 * `art/town/glb/`, exported from `art/town/town.blend` by `art/town/pieces.py` (see `art/town/README.md`).
 *
 * Each piece stands on the ground, centred on its footprint, its front facing +z, at life size.
 */
import type { SceneryPiece } from '../src/world/townArt.ts';
import type { Part } from './build-town.ts';

type Extra = Omit<Part, 'kit' | 'model'>;

/** Kenney's furniture and nature kits are modelled small (as `build-town.ts` brings them to life size). */
const FURNITURE = 2.3;
const NATURE = 2.6;

const art = (model: string, extra: Extra = {}): Part => ({ kit: 'town-art', model, ...extra });
const furniture = (model: string, extra: Extra = {}): Part => ({ kit: 'furniture-kit', model, scale: FURNITURE, ...extra });
const nature = (model: string, extra: Extra = {}): Part => ({ kit: 'nature-kit', model, scale: NATURE, ...extra });
const fantasy = (model: string, extra: Extra = {}): Part => ({ kit: 'fantasy-town-kit', model, ...extra });

/** The nature kit's aqua leaves and grass, made leaf green; its bark, wood (as the town's own trees are). */
const NATURE_COLOURS = { mint: 'leaf', teal: 'leaf', grass: 'leaf', peach: 'wood', terracotta: 'wood' } as const;
export const SCENERY_PARTS: Record<SceneryPiece, Part[]> = {
  // Modelled in Blender.
  awning: [art('awning')],
  pennants: [art('pennants')],
  'window-box': [art('window-box')],
  bicycle: [art('bicycle')],
  parasol: [art('parasol')],
  'street-clock': [art('street-clock')],
  hill: [art('hill')],
  mountain: [art('mountain')],
  bath: [art('bath')],
  planter: [art('planter')],
  'catenary-pole': [art('catenary-pole')],
  boat: [art('boat')],
  gazebo: [art('gazebo')],

  // Houses for the backdrop, and what's on the town's roofs.
  cottage: [art('cottage', { glass: true })],
  townhouse: [art('townhouse', { glass: true })],
  chimney: [fantasy('chimney', { scale: 1.8, repaint: { plum: 'brick', lavender: 'brick', denim: 'charcoal' } })],
  'ac-unit': [{ kit: 'modular-buildings', model: 'detail-ac-a', scale: 2.5 }],

  // The street.
  tram: [{ kit: 'train-kit', model: 'train-tram-classic', turns: 1, scale: 2, repaint: { mustard: 'butter' } }],
  fountain: [fantasy('fountain-round', { scale: 2.6 }), fantasy('fountain-center', { scale: 2.6 })],
  'market-stall': [fantasy('stall-red', { scale: 2.2 })],
  cart: [fantasy('cart', { scale: 2 })],
  bin: [furniture('trashcan', { repaint: { stone: 'pine', slate: 'pine', white: 'pine' } })],
  hedge: [fantasy('hedge-large', { scale: 2, turns: 1, repaint: { lavender: 'stone', slate: 'stone', teal: 'leaf' } })],
  fence: [nature('fence_simple', { repaint: NATURE_COLOURS })],
  'wall-lamp': [furniture('lampWall')],

  // Trees, rocks and plants.
  'tree-pine': [nature('tree_pineRoundC', { repaint: NATURE_COLOURS })],
  'tree-fat': [nature('tree_fat', { scale: NATURE * 1.2, repaint: NATURE_COLOURS })],
  'tree-cone': [nature('tree_cone', { repaint: NATURE_COLOURS })],
  'tree-small': [nature('tree_small', { repaint: NATURE_COLOURS })],
  'bush-large': [nature('plant_bushLarge', { repaint: NATURE_COLOURS })],
  rock: [nature('rock_largeA', { repaint: { terracotta: 'stone', grass: 'leaf' } })],
  'grass-tuft': [nature('grass_large', { repaint: NATURE_COLOURS })],
  lily: [nature('lily_large', { repaint: NATURE_COLOURS })],
  'pot-plant': [nature('pot_large'), nature('plant_bushSmall', { at: [0, 0.5, 0], repaint: NATURE_COLOURS })],

  // The rooms.
  chair: [furniture('chairCushion')],
  stool: [furniture('stoolBar')],
  'table-round': [furniture('tableRound')],
  'table-plain': [furniture('table')],
  sofa: [furniture('loungeSofa')],
  armchair: [furniture('loungeChair')],
  'coffee-table': [furniture('tableCoffee')],
  'floor-lamp': [furniture('lampRoundFloor')],
  'table-lamp': [furniture('lampSquareTable')],
  tv: [furniture('cabinetTelevision'), furniture('televisionModern', { at: [0, 0.6, 0] })],
  desk: [furniture('desk')],
  computer: [furniture('computerScreen'), furniture('computerKeyboard', { at: [0, 0, 0.25] })],
  'coat-rack': [furniture('coatRackStanding')],
  'fridge-tall': [furniture('kitchenFridgeLarge')],
  'wall-cabinet': [furniture('kitchenCabinetUpperDouble')],
  'coffee-machine': [furniture('kitchenCoffeeMachine')],
  'ceiling-lamp': [furniture('lampSquareCeiling')],
  'rug-round': [furniture('rugRound')],
  books: [furniture('books')],
  'plant-small': [furniture('plantSmall2')],
  'side-table': [furniture('sideTableDrawers')],
  boxes: [furniture('cardboardBoxClosed')],
  shower: [furniture('shower')],
  washer: [furniture('washer')],
  mirror: [furniture('bathroomMirror')],
  basin: [furniture('bathroomSink')],
  'bookcase-low': [furniture('bookcaseOpenLow')],
};
