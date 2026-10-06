import { z } from 'zod';
import { LANGUAGE_CODES } from '../src/sim/index.ts';

// The dev's own learner recordings. The audio is gitignored in `evals/recordings/`; only the manifest is committed.

export const RecordingManifestSchema = z.object({
  recordings: z.array(
    z.object({
      /** The file in `evals/recordings/`: a 16 kHz mono 16-bit WAV. */
      file: z.string().regex(/^[\w-]+\.wav$/),
      language: z.enum(LANGUAGE_CODES),
      /** What the dev meant to say. */
      intended: z.string().min(1),
      /** How to say it: a mistake to make on purpose, a hesitation, background noise. */
      note: z.string().optional(),
    }),
  ),
});
export type RecordingManifest = z.infer<typeof RecordingManifestSchema>;

/** The mic's chunk: ~100 ms of 16 kHz 16-bit PCM. */
const CHUNK_BYTES = 3_200;

/** A recording's PCM as base64 chunks the size the mic sends. Throws if it isn't a 16 kHz mono 16-bit PCM WAV. */
export function pcmChunks(wav: Uint8Array): string[] {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4));
  if (wav.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let format: { pcm: boolean; channels: number; rate: number; bits: number } | null = null;
  for (let at = 12; at + 8 <= wav.byteLength; ) {
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (tag(at) === 'fmt ') {
      format = { pcm: view.getUint16(body, true) === 1, channels: view.getUint16(body + 2, true), rate: view.getUint32(body + 4, true), bits: view.getUint16(body + 14, true) };
    } else if (tag(at) === 'data') {
      if (!format?.pcm || format.channels !== 1 || format.rate !== 16_000 || format.bits !== 16) {
        throw new Error('a recording must be 16 kHz mono 16-bit PCM');
      }
      const data = wav.subarray(body, Math.min(body + size, wav.byteLength));
      const chunks: string[] = [];
      for (let i = 0; i < data.byteLength; i += CHUNK_BYTES) chunks.push(Buffer.from(data.subarray(i, i + CHUNK_BYTES)).toString('base64'));
      return chunks;
    }
    // Chunks are padded to an even length.
    at = body + size + (size % 2);
  }
  throw new Error('a WAV file with no audio');
}
