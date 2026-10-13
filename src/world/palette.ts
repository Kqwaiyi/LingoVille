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

// The sky's own colours, and its light's: deeper blues, the glow of sunrise and sunset, night, sunlight and moonlight.
// Nothing in the town is painted in them, so they're kept out of `PALETTE`, which the art builds snap colours to.
export const SKY_PALETTE = {
  // By day.
  azure: '#5d9de2',
  cornflower: '#8cb6e6',
  mist: '#dbe9f3',
  sunlight: '#fff3dd',
  // Sunrise and sunset.
  apricot: '#f8b47a',
  rose: '#ec9aa2',
  mauve: '#a68cc4',
  // Night.
  indigo: '#34457c',
  navy: '#17213f',
  moonlight: '#a8bfe8',
} as const;

// Clawd's own colour: the Claude Code mascot's orange, which everyone in town is. Nothing in the town is painted in it,
// so it's kept out of `PALETTE`, which the art builds snap to.
export const CLAWD_PALETTE = {
  clawd: '#d77757',
} as const;

/** Every colour the world draws, the town's, the sky's and Clawd's, by name. */
export const WORLD_COLOURS = { ...PALETTE, ...SKY_PALETTE, ...CLAWD_PALETTE } as const;
export type WorldColour = keyof typeof WORLD_COLOURS;
