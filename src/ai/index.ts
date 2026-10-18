// Public interface of the ai module. Other modules import from here.
export type { FunctionDeclaration } from '../content/index.ts';
export {
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
