// Public interface of the ai module. Other modules import from here.
export type { FunctionDeclaration } from '../content/index.ts';
export {
  buildShiftCustomerSession,
  readServedScene,
  readShiftOrder,
  shiftCustomerServedScene,
  type ShiftCustomerContext,
} from './shiftCustomerSession.ts';
export {
  basketChangedScene,
  buildNpcSession,
  GREETING_SCENE,
  NOT_UNDERSTOOD_TOOL,
  OUT_OF_PATIENCE_SCENE,
  RESUME_SCENE,
  type CompletionResponse,
  type NotUnderstoodResponse,
  type NpcSession,
  type NpcSessionContext,
  type ToolResponse,
  type VoiceRequest,
} from './npcSession.ts';
export {
  buildRecapRequest,
  RecapRequestSchema,
  RecapSchema,
  recapSchemaFor,
  type HelpLogEntry,
  type Recap,
  type RecapConversation,
  type ShiftRecapCustomer,
  type RecapLine,
  type RecapRequest,
  type RecapRequestBody,
} from './recap.ts';
export {
  AnnotateRequestSchema,
  AnnotationSchema,
  annotationSchemaFor,
  buildAnnotateRequest,
  type Annotation,
  type AnnotateRequest,
} from './annotate.ts';
export { buildHintRequest, HintRequestSchema, HintsSchema, type Hint, type HintRequest, type Hints } from './hint.ts';
export type { GenerateContentBody } from './common.ts';
export {
  alignFurigana,
  hasReadingAids,
  libraryKana,
  libraryPinyin,
  READING_LANGUAGES,
  romaji,
  rubyUnits,
  SegmentSchema,
  type KanaToken,
  type ReadingLanguage,
  type Segment,
} from './readings.ts';
export { checkReadings, wordReading, type ReadingCheck, type ReadingRule } from './annotateValidator.ts';
