// The Appearance Preset pool. Placeholder ids until the presets themselves
// arrive (tickets 12 and 30): Culture Packs already map Named NPCs and Shift
// Customers onto them.

export const APPEARANCE_PRESET_IDS = ['preset-1', 'preset-2', 'preset-3', 'preset-4'] as const;
export type AppearancePresetId = (typeof APPEARANCE_PRESET_IDS)[number];
