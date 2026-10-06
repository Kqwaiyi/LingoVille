import manifest from '../recordings/manifest.json' with { type: 'json' };
import { RecordingManifestSchema } from '../recordings.ts';
import type { EvalCases } from '../runEval.ts';
import annotateJa from './annotate/ja.ts';
import annotateZh from './annotate/zh.ts';
import npcDe from './npc/de.ts';
import npcEn from './npc/en.ts';
import npcJa from './npc/ja.ts';
import npcZh from './npc/zh.ts';
import recapDe from './recap/de.ts';
import recapEn from './recap/en.ts';
import recapJa from './recap/ja.ts';
import recapZh from './recap/zh.ts';

/** Every eval case, by kind. Annotate cases are zh and ja only: the other languages have no readings to check. */
export const CASES: EvalCases = {
  recap: [...recapZh, ...recapJa, ...recapEn, ...recapDe],
  npc: [...npcZh, ...npcJa, ...npcEn, ...npcDe],
  annotate: [...annotateZh, ...annotateJa],
};

/** The dev's recordings the NPC cases may use. The audio itself is gitignored. */
export const RECORDINGS = RecordingManifestSchema.parse(manifest);
