import 'fake-indexeddb/auto';
import { createStore, set } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import { createDeviceSettings, DEFAULT_DEVICE_SETTINGS, pickNativeLanguage } from './index.ts';

let databases = 0;
function fresh(browserLanguages: readonly string[] = ['en-US']) {
  const raw = createStore(`device-test-${++databases}`, 'settings');
  return { settings: createDeviceSettings(() => raw, { browserLanguages: () => browserLanguages }), raw };
}

describe('the Native Language a browser suggests', () => {
  it('is the first of its languages that is ja, zh, en or de, by base tag', () => {
    expect(pickNativeLanguage(['de-AT', 'en-US'])).toBe('de');
    expect(pickNativeLanguage(['fr-FR', 'zh-Hant-TW', 'ja'])).toBe('zh');
    expect(pickNativeLanguage(['JA-jp'])).toBe('ja');
  });

  it('is English when none of them is', () => {
    expect(pickNativeLanguage(['fr-FR', 'es'])).toBe('en');
    expect(pickNativeLanguage([])).toBe('en');
  });
});

describe('device settings', () => {
  it('start from the defaults on a browser that has none', async () => {
    const { settings } = fresh();

    expect(await settings.load()).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it('start in the Native Language the browser suggests until one is chosen', async () => {
    const { settings } = fresh(['de-DE', 'en']);

    expect(await settings.load()).toEqual({ ...DEFAULT_DEVICE_SETTINGS, nativeLanguage: 'de' });
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

  it('change from the record a reload reads back, whether or not this page has read it', async () => {
    const { settings, raw } = fresh();
    await set('device', { ...DEFAULT_DEVICE_SETTINGS, inputMode: 'typed' }, raw);

    await settings.update((current) => ({ ...current, showRomaji: true }));
    await settings.update((current) => ({ ...current, tooltipsSeen: [...current.tooltipsSeen, 'walk'] }));
    await settings.update(() => null);

    expect(await createDeviceSettings(() => raw).load()).toEqual({
      ...DEFAULT_DEVICE_SETTINGS,
      inputMode: 'typed',
      showRomaji: true,
      tooltipsSeen: ['walk'],
    });
  });

  it('keep a quick run of changes, each from the one before, even with a read still going', async () => {
    const { settings, raw } = fresh();
    await settings.load();

    const reading = settings.load();
    const first = settings.update((current) => ({ ...current, readingAids: false }));
    const second = settings.update((current) => ({ ...current, showRomaji: true }));
    await Promise.all([reading, first, second]);
    await settings.update((current) => ({ ...current, micCheckPassed: true }));

    expect(await createDeviceSettings(() => raw).load()).toEqual({
      ...DEFAULT_DEVICE_SETTINGS,
      readingAids: false,
      showRomaji: true,
      micCheckPassed: true,
    });
  });
});
