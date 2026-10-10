import { buildNpcSession, buildPasserBySession, NOT_UNDERSTOOD_TOOL, type ToolResponse } from '../src/ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS, type Interaction } from '../src/content/index.ts';
import { isOutOfPatience, losePatience, namedNpcOf, namesMatch, newPlayerTurn, startPatience } from '../src/sim/index.ts';
import { openLiveSession, type LiveAudio, type LiveDeps, type LiveToken } from '../src/voice/liveSession.ts';
import type { NpcCase, TurnTag } from './cases/schema.ts';

// Plays one scripted NPC case against a real Live session, answering its tool calls the way the game does.

/** One thing that happened, in order. A player turn says which scripted turn it was; a tool call says which turn it answered. */
export type NpcEvent =
  | { speaker: 'npc'; text: string }
  | { speaker: 'player'; turn: number; text: string; tag: TurnTag; heardAs?: string }
  | { speaker: 'tool'; name: string; args: unknown; response: ToolResponse; afterTurn: number | null };

export type NpcOutcome = 'completed' | 'outOfPatience' | 'open';

export type PlayedConversation = {
  transcript: NpcEvent[];
  outcome: NpcOutcome;
  /** The completion's arguments, when it succeeded. */
  completedWith?: unknown;
  /** Why the conversation couldn't be played to its end: the socket, a timeout or an unreadable recording. */
  error?: string;
};

export type NpcTiming = {
  /** After the NPC ends a turn, how long it must stay quiet before the next player turn is sent. */
  settleMs: number;
  /** How long the NPC may take to finish a turn. */
  turnTimeoutMs: number;
  /** The gap between a recording's ~100 ms chunks, so it reaches Live at the pace a real mic sends it. */
  chunkMs: number;
};

export const NPC_TIMING: NpcTiming = { settleMs: 1_500, turnTimeoutMs: 30_000, chunkMs: 100 };

/** After the NPC answers a tool call with no words yet, how many times longer it may stay quiet before its turn counts as over. */
const AFTER_TOOL_SETTLE_FACTOR = 4;

/** A recording's 16 kHz PCM, as base64 chunks of ~100 ms, the way the mic sends it. */
export type RecordedTurn = string[];

export const interactionById = (id: string): Interaction => Object.values(INTERACTIONS).find((interaction) => interaction.id === id)!;

/** Whether the NPC must read back and get a confirmation before completing. A goal with no effect has nothing to read back. */
export const needsReadBack = (interaction: Interaction) => interaction.effect.kind !== 'none';

/** The NPC's session for this case: the real builder, at noon on day 1. A passer-by waits at the central stop. */
export function npcSessionFor(c: NpcCase) {
  const interaction = interactionById(c.interactionId);
  const clock = { day: 1, minuteOfDay: 12 * 60 };
  const npcId = namedNpcOf(interaction);
  if (!npcId) return buildPasserBySession(interaction, CULTURE_PACKS[c.targetLanguage], c.step, { clock, tramStop: 'central-stop', voiceSeed: 0 });
  return buildNpcSession(interaction, CULTURE_PACKS[c.targetLanguage], c.step, NAMED_NPCS[npcId], {
    clock,
    ...(c.basket && { basket: c.basket }),
  });
}

/** Speakers that play nothing, and a mic that sends what `feed` gives it. */
function silentAudio() {
  let onChunk: ((pcm: string, level: number) => void) | null = null;
  const audio: LiveAudio = {
    startMic: async (send) => {
      onChunk = send;
    },
    play: () => {},
    stopPlayback: () => {},
    drained: async () => {},
    close: () => {},
  };
  const feed = async (chunks: string[], gapMs: number) => {
    for (const [i, chunk] of chunks.entries()) {
      if (i > 0 && gapMs > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
      onChunk?.(chunk, 0.5);
    }
  };
  return { audio, feed };
}

export async function playNpcCase(
  c: NpcCase,
  token: LiveToken,
  openSocket: LiveDeps['openSocket'],
  recordings: Map<string, RecordedTurn>,
  timing: NpcTiming,
): Promise<PlayedConversation> {
  const interaction = interactionById(c.interactionId);
  const transcript: NpcEvent[] = [];
  // Set by tool calls, so TypeScript can't narrow it.
  let outcome = 'open' as NpcOutcome;
  let completedWith: unknown;
  let patience = startPatience(c.step);
  let turn: number | null = null;
  let speech = '';

  // Settles the NPC turn being waited for: once it has finished and stayed quiet for `settleMs`, or with an error.
  let settled: ((error?: Error) => void) | null = null;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  let turnTimeout: ReturnType<typeof setTimeout> | undefined;
  const busy = () => clearTimeout(quiet);
  // Set once the connection drops, so a turn waited for after it fails at once instead of timing out.
  let dropped: Error | null = null;
  // A tool call was answered and the NPC hasn't spoken since: a turnComplete now may come before its reply.
  let awaitingToolReply = false;

  // As the game's `answerToolCall`, except that money isn't modelled here, so nothing is "cannot_afford".
  const answer = (name: string, args: unknown): ToolResponse => {
    if (name === NOT_UNDERSTOOD_TOOL) {
      patience = losePatience(patience);
      if (!isOutOfPatience(patience)) return { result: 'noted' };
      outcome = 'outOfPatience';
      return { result: 'out_of_patience' };
    }
    if (name !== interaction.completion.name || outcome !== 'open') return { result: 'unknown_tool' };
    const resolved = interaction.resolveCompletion(args, c.targetLanguage, c.basket);
    if (!resolved.success) return { result: 'invalid_arguments', error: resolved.error };
    if (resolved.application && !namesMatch(resolved.application.name, c.characterName ?? '')) return { result: 'wrong_name' };
    outcome = 'completed';
    completedWith = args;
    return { result: interaction.effect.kind === 'serveOrder' || interaction.effect.kind === 'purchase' ? 'served' : 'done' };
  };

  const mic = silentAudio();
  const session = openLiveSession(
    token,
    npcSessionFor(c),
    {
      onOutputTranscript: (text) => {
        busy();
        awaitingToolReply = false;
        speech += text;
      },
      onInputTranscript: (text) => {
        const player = transcript.findLast((event) => event.speaker === 'player');
        if (player?.speaker === 'player') player.heardAs = (player.heardAs ?? '') + text;
      },
      onTurnComplete: () => {
        busy();
        if (speech.trim()) transcript.push({ speaker: 'npc', text: speech.trim() });
        speech = '';
        quiet = setTimeout(() => settled?.(), timing.settleMs * (awaitingToolReply ? AFTER_TOOL_SETTLE_FACTOR : 1));
      },
      onToolCall: ({ id, name, args }) => {
        busy();
        const response = answer(name, args);
        transcript.push({ speaker: 'tool', name, args, response, afterTurn: turn });
        awaitingToolReply = true;
        session.sendToolResponse(id, response);
      },
      onMicLevel: () => {},
      onMicUnavailable: () => {},
      onUsage: () => {},
      onDisconnect: () => {
        dropped = new Error('the Live connection dropped');
        settled?.(dropped);
      },
    },
    { typedOnly: !c.turns.some((t) => t.recording) },
    { openSocket, createAudio: () => mic.audio },
  );

  /** Waits for the NPC's next turn. Call it before sending what it answers, so a quick reply isn't missed. */
  const npcTurn = () => {
    const turnDone = new Promise<void>((resolve, reject) => {
      if (dropped) return reject(dropped);
      turnTimeout = setTimeout(() => settled?.(new Error(`the NPC took over ${timing.turnTimeoutMs} ms to finish a turn`)), timing.turnTimeoutMs);
      settled = (error) => {
        clearTimeout(turnTimeout);
        settled = null;
        if (error) reject(error);
        else resolve();
      };
    });
    // Awaited later; if what comes before it throws first, its rejection mustn't go unhandled.
    turnDone.catch(() => {});
    return turnDone;
  };

  try {
    const greeting = npcTurn();
    await session.connect();
    await greeting;
    for (const [i, scripted] of c.turns.entries()) {
      if (outcome !== 'open') break;
      turn = i;
      patience = newPlayerTurn(patience);
      const reply = npcTurn();
      if (scripted.recording) {
        transcript.push({ speaker: 'player', turn: i, text: scripted.recording, tag: scripted.tag, heardAs: '' });
        session.startTalking();
        await mic.feed(recordings.get(scripted.recording) ?? [], timing.chunkMs);
        session.stopTalking();
      } else {
        transcript.push({ speaker: 'player', turn: i, text: scripted.text!, tag: scripted.tag });
        session.sendText(scripted.text!);
      }
      await reply;
    }
    return { transcript, outcome, ...(outcome === 'completed' && { completedWith }) };
  } catch (error) {
    return { transcript, outcome, error: error instanceof Error ? error.message : String(error) };
  } finally {
    busy();
    clearTimeout(turnTimeout);
    session.close();
  }
}
