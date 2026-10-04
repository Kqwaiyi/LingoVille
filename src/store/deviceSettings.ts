import { createStore, get, set, update, type UseStore } from 'idb-keyval';
import { z } from 'zod';
import { LANGUAGE_CODES, type LanguageCode } from '../sim/index.ts';

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

/** The first of the browser's languages that is a Native Language, by base tag (`de-AT` is `de`), or else English. */
export function pickNativeLanguage(browserLanguages: readonly string[]): LanguageCode {
  for (const tag of browserLanguages) {
    const base = tag.split('-')[0]!.toLowerCase();
    const code = LANGUAGE_CODES.find((language) => language === base);
    if (code) return code;
  }
  return 'en';
}

const navigatorLanguages = () => (typeof navigator === 'undefined' ? [] : (navigator.languages ?? []));

export type DeviceSettingsStore = {
  load(): Promise<DeviceSettings>;
  save(settings: DeviceSettings): Promise<void>;
  /**
   * Changes the settings and starts writing them at once, from the ones this page last read or
   * wrote, so a page reloaded right after can't lose the change. A change of `null` leaves them as
   * they are.
   */
  update(change: (settings: DeviceSettings) => DeviceSettings | null): Promise<void>;
};

/** Until the Player chooses, the Native Language is the one the browser's languages suggest. */
export function createDeviceSettings(
  openStore: () => UseStore,
  { browserLanguages = navigatorLanguages }: { browserLanguages?: () => readonly string[] } = {},
): DeviceSettingsStore {
  let store: UseStore | null = null;
  const db = () => (store ??= openStore());
  const defaults = (): DeviceSettings => ({ ...DEFAULT_DEVICE_SETTINGS, nativeLanguage: pickNativeLanguage(browserLanguages()) });

  // The settings this page last read or wrote, so a change is one write with no read before it.
  let latest: DeviceSettings | null = null;
  let writes = 0;
  const read = (raw: unknown): DeviceSettings => {
    if (raw === undefined) return defaults();
    const parsed = DeviceSettingsSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    console.warn('[settings] unreadable, using the defaults:', z.prettifyError(parsed.error));
    return defaults();
  };
  const write = (settings: DeviceSettings) => {
    latest = DeviceSettingsSchema.parse(settings);
    writes++;
    return set(KEY, latest, db());
  };

  return {
    load: async () => {
      const before = writes;
      const loaded = read(await get<unknown>(KEY, db()));
      // A read that a write overtook would undo it.
      if (writes === before) latest = loaded;
      return loaded;
    },
    save: write,
    update: async (change) => {
      if (latest) {
        const changed = change(latest);
        return changed ? write(changed) : undefined;
      }
      // Not read yet: read and write in one transaction.
      return update<unknown>(
        KEY,
        (raw) => {
          const changed = change(read(raw));
          if (!changed) return raw;
          writes++;
          return (latest = DeviceSettingsSchema.parse(changed));
        },
        db(),
      );
    },
  };
}

/** This browser's device settings, in their own IndexedDB database. */
export const browserDeviceSettings = createDeviceSettings(() => createStore('insomniacs-device', 'settings'));
