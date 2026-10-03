import { describe, expect, it } from 'vitest';
import { createHearItSaid, type ClipCache, type HearItSaidClip } from './index.ts';

/** A stand-in gateway for /api/tts, recording what it was asked to say. */
function fakeGateway(answer: (body: { text: string; targetLanguage: string }) => Response) {
  const asked: { text: string; targetLanguage: string }[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe('/api/tts');
    const body = JSON.parse(String(init?.body));
    asked.push(body);
    return answer(body);
  }) as typeof globalThis.fetch;
  return { asked, fetch };
}

function memoryCache() {
  const clips = new Map<string, HearItSaidClip>();
  const cache: ClipCache = {
    get: async (key) => clips.get(key),
    set: async (key, clip) => void clips.set(key, clip),
  };
  return { clips, cache };
}

const clipFor = (text: string) => ({ audio: `pcm of ${text}`, sampleRate: 24_000 });

function hearItSaid(answer = (body: { text: string }) => Response.json(clipFor(body.text))) {
  const gateway = fakeGateway(answer);
  const { clips, cache } = memoryCache();
  const played: HearItSaidClip[] = [];
  const say = createHearItSaid({ fetch: gateway.fetch, cache, play: (clip) => played.push(clip) });
  return { say, gateway, clips, played };
}

describe('hear-it-said', () => {
  it('asks the gateway to say the text, and plays the clip', async () => {
    const { say, gateway, played } = hearItSaid();

    await say('ラテをください', 'ja');

    expect(gateway.asked).toEqual([{ text: 'ラテをください', targetLanguage: 'ja' }]);
    expect(played).toEqual([clipFor('ラテをください')]);
  });

  it('plays a phrase it has said before from the cache, without asking again', async () => {
    const { say, gateway, played } = hearItSaid();

    await say('ラテをください', 'ja');
    await say('ラテをください', 'ja');

    expect(gateway.asked).toHaveLength(1);
    expect(played).toEqual([clipFor('ラテをください'), clipFor('ラテをください')]);
  });

  it('caches by text and voice: the same text in another voice is a new clip', async () => {
    const { say, gateway, clips } = hearItSaid();

    await say('Latte', 'en');
    await say('Latte', 'de');
    await say('Latte!', 'de');

    expect(gateway.asked).toHaveLength(3);
    expect(clips.size).toBe(3);
  });

  it('caches nothing and plays nothing when the gateway cannot say it', async () => {
    const { say, clips, played } = hearItSaid(() => Response.json({ error: 'tts_unavailable' }, { status: 502 }));

    await expect(say('Hallo', 'de')).rejects.toThrow(/502/);

    expect(clips.size).toBe(0);
    expect(played).toEqual([]);
  });
});
