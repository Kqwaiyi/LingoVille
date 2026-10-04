// Public interface of the voice module. Other modules import from here.
export {
  createHearItSaid,
  hearItSaid,
  type ClipCache,
  type HearItSaid,
  type HearItSaidClip,
  type HearItSaidDeps,
} from './hearItSaid.ts';
export { openBrowserMic } from './browserIo.ts';
export { MOCK_DROP_LINE, openMockVoiceSession } from './mockVoiceSession.ts';
export { openVoiceSession } from './openVoiceSession.ts';
export {
  addUsage,
  NO_USAGE,
  VoiceServiceUnavailableError,
  type OpenMic,
  type OpenVoiceSession,
  type TokenUsage,
  type ToolCall,
  type TranscriptLine,
  type VoiceSession,
  type VoiceSessionEvents,
  type VoiceSessionOptions,
} from './voiceSession.ts';
