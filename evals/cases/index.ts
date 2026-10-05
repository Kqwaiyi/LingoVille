import type { EvalCases } from '../runEval.ts';
import annotateJa from './annotate/ja.ts';
import annotateZh from './annotate/zh.ts';
import recapDe from './recap/de.ts';
import recapEn from './recap/en.ts';
import recapJa from './recap/ja.ts';
import recapZh from './recap/zh.ts';

/** Every eval case, by kind. Annotate cases are zh and ja only: the other languages have no readings to check. */
export const CASES: EvalCases = {
  recap: [...recapZh, ...recapJa, ...recapEn, ...recapDe],
  annotate: [...annotateZh, ...annotateJa],
};
