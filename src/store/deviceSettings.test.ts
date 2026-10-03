import 'fake-indexeddb/auto';
import { createStore, set } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import { createDeviceSettings, DEFAULT_DEVICE_SETTINGS } from './index.ts';

let databases = 0;
function fresh() {
  const raw = createStore(`device-test-${++databases}`, 'settings');
  return { settings: createDeviceSettings(() => raw), raw };
}

describe('device settings', () => {
  it('start from the defaults on a browser that has none', async () => {
    const { settings } = fresh();

    expect(await settings.load()).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it('keep one record per browser that a reload reads back', async () => {
    const { settings, raw } = fresh();
    const changed = {
      ...DEFAULT_DEVICE_SETTINGS,
      nativeLanguage: 'de' as const,
      volumes: { ...DEFAULT_DEVICE_SETTINGS.volumes, music: 0.3 },
      inputMode: 'typed' as const,
      tooltipsSeen: ['walk'],
      micCheckPassed: true,
    };

    await settings.save(changed);

    expect(await createDeviceSettings(() => raw).load()).toEqual(changed);
  });

  it('fall back to the defaults if the record can’t be read', async () => {
    const { settings, raw } = fresh();
    await set('device', { nativeLanguage: 'klingon' }, raw);

    expect(await settings.load()).toEqual(DEFAULT_DEVICE_SETTINGS);
  });
});
