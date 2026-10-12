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
  'wall-lantern': [art('wall-lantern')],
  'shelf-books': [art('shelf-books')],
  'shelf-goods': [art('shelf-goods')],
  cubbies: [art('cubbies')],
  chimney: [art('chimney')],

  // The street.
  tram: [{ kit: 'train-kit', model: 'train-tram-classic', turns: 1, scale: 2, repaint: { mustard: 'butter' } }],
  fountain: [fantasy('fountain-round', { scale: 2.6 }), fantasy('fountain-center', { scale: 2.6 })],
  'market-stall': [fantasy('stall-red', { scale: 2.2 })],
  cart: [fantasy('cart', { scale: 2 })],
  bin: [furniture('trashcan', { repaint: { stone: 'pine', slate: 'pine', white: 'pine' } })],
  hedge: [art('hedge')],
  fence: [nature('fence_simple', { repaint: NATURE_COLOURS })],

  // Trees, rocks and plants.
  // Modelled in Blender (`art/town/nature.py`).
  'tree-pine': [art('tree-pine')],
  'tree-fat': [art('tree-fat')],
  'tree-cone': [art('tree-cone')],
  'tree-small': [art('tree-small')],
  'bush-large': [art('bush-large')],
  rock: [nature('rock_largeA', { repaint: { terracotta: 'stone', grass: 'leaf' } })],
  'grass-tuft': [nature('grass_large', { repaint: NATURE_COLOURS })],
  lily: [nature('lily_large', { repaint: NATURE_COLOURS })],
  'pot-plant': [nature('pot_large'), nature('plant_bushSmall', { at: [0, 0.5, 0], repaint: NATURE_COLOURS })],

  // The rooms: some modelled in Blender (`art/town/furnishings.py`), some from the furniture kit.
  chair: [art('chair')],
  stool: [furniture('stoolBar')],
  'table-round': [art('table-round')],
  'table-plain': [art('table-plain')],
  sofa: [art('sofa')],
  armchair: [art('armchair')],
  'coffee-table': [art('coffee-table')],
  'floor-lamp': [art('floor-lamp')],
  'table-lamp': [art('table-lamp')],
  tv: [furniture('cabinetTelevision'), furniture('televisionModern', { at: [0, 0.6, 0] })],
  desk: [furniture('desk')],
  computer: [furniture('computerScreen'), furniture('computerKeyboard', { at: [0, 0, 0.25] })],
  'coat-rack': [furniture('coatRackStanding')],
  'fridge-tall': [furniture('kitchenFridgeLarge')],
  'wall-cabinet': [art('wall-cabinet')],
  'coffee-machine': [furniture('kitchenCoffeeMachine')],
  'ceiling-lamp': [furniture('lampSquareCeiling')],
  'rug-round': [art('rug-round')],
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
