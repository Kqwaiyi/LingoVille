import { createStore, get, set, type UseStore } from 'idb-keyval';
import { z } from 'zod';
import { LANGUAGE_CODES } from '../sim/index.ts';

// Device settings: one record per browser, outside saves, so they follow the
// Player from one save to the next. They are conveniences, not progress: a
// record that can't be read falls back to the defaults.

const volume = z.number().min(0).max(1);

const DeviceSettingsSchema = z.object({
  nativeLanguage: z.enum(LANGUAGE_CODES),
  volumes: z.object({ master: volume, music: volume, ambient: volume, voice: volume, ui: volume }),
  /** Speak with the mic, or use the Typed Fallback. */
  inputMode: z.enum(['mic', 'typed']),
  talkMode: z.enum(['push-to-talk', 'open-mic']),
  readingAids: z.boolean(),
  showRomaji: z.boolean(),
  tooltips: z.boolean(),
  tooltipsSeen: z.array(z.string()),
  micCheckPassed: z.boolean(),
});

export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>;

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  nativeLanguage: 'en',
  volumes: { master: 1, music: 1, ambient: 1, voice: 1, ui: 1 },
  inputMode: 'mic',
  talkMode: 'push-to-talk',
  readingAids: true,
  showRomaji: false,
  tooltips: true,
  tooltipsSeen: [],
  micCheckPassed: false,
};

const KEY = 'device';

export type DeviceSettingsStore = {
  load(): Promise<DeviceSettings>;
  save(settings: DeviceSettings): Promise<void>;
};

export function createDeviceSettings(openStore: () => UseStore): DeviceSettingsStore {
  let store: UseStore | null = null;
  const db = () => (store ??= openStore());

  return {
    load: async () => {
      const raw = await get<unknown>(KEY, db());
      if (raw === undefined) return DEFAULT_DEVICE_SETTINGS;
      const parsed = DeviceSettingsSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
      console.warn('[settings] unreadable, using the defaults:', z.prettifyError(parsed.error));
      return DEFAULT_DEVICE_SETTINGS;
    },
    save: (settings) => set(KEY, DeviceSettingsSchema.parse(settings), db()),
  };
}

/** This browser's device settings, in their own IndexedDB database. */
export const browserDeviceSettings = createDeviceSettings(() => createStore('insomniacs-device', 'settings'));
