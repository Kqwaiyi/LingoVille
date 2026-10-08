// The town's one shared palette: every colour the world draws, kit art included. `npm run build:town` snaps the kits'
// own colours to these, and `tooling/townArt.test.ts` fails art or world code that strays from them.

export const PALETTE = {
  // Neutrals.
  white: '#fbf8f2',
  cream: '#f6efe2',
  linen: '#e8dcc6',
  sand: '#d6c2a0',
  stone: '#b9b3aa',
  slate: '#878d98',
  charcoal: '#4d5260',
  ink: '#2f2a24',
  // Wood and earth.
  wood: '#d19a68',
  walnut: '#8b6a4f',
  terracotta: '#d98a6c',
  brick: '#a85a4c',
  // Pastel façades.
  peach: '#f2c4a0',
  butter: '#f0dc96',
  mint: '#b5dcc4',
  sky: '#bcd6ea',
  lavender: '#c6b8de',
  blush: '#efbcbf',
  // Greens.
  grass: '#b4d39c',
  leaf: '#86b86c',
  pine: '#4f8a5b',
  // Accents.
  teal: '#4f8f84',
  mustard: '#d4ac44',
  denim: '#5b7fae',
  plum: '#7b5f99',
  red: '#d9554a',
  lamplight: '#ffd98a',
} as const;

export type PaletteColour = keyof typeof PALETTE;
export const PALETTE_COLOURS = Object.keys(PALETTE) as PaletteColour[];
