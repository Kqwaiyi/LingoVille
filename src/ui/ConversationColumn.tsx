import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CULTURE_PACKS, formatLocalMoney, NAMED_NPCS } from '../content/index.ts';
import type { LanguageCode, NpcExpression } from '../sim/index.ts';
import {
  selectChatLines,
  selectClockMinute,
  selectClosingCard,
  selectConversation,
  selectCulturePackId,
  selectHelpOpen,
  selectLineReading,
  selectListening,
  selectMicLevel,
  selectNativeLanguage,
  selectNpcExpression,
  selectReconnecting,
  selectRecap,
  selectTargetLanguage,
  selectTranslation,
  selectTyping,
  useGame,
  type ChatLine,
  type ClosingCard,
  type RecapView,
} from '../store/index.ts';
import { formatClock } from './format.ts';
import { HelpPanel } from './HelpPanel.tsx';
import { JournalPageView } from './JournalPage.tsx';
import { ReadingLine } from './Ruby.tsx';

// English until the i18n module lands (ticket 12).

/** Under a finished NPC line: Translate, which shows the Native Language line underneath, and 🔊 Replay. */
function NpcLineHelp({ index, text }: { index: number; text: string }) {
  const translation = useGame(selectTranslation(index));
  const nativeLanguage = useGame(selectNativeLanguage);
  const translateLine = useGame((s) => s.translateLine);
  const hearItSaid = useGame((s) => s.hearItSaid);
  return (
    <>
      {translation?.status === 'ready' && (
        <p className="bubble-translation" lang={nativeLanguage}>
          {translation.text}
        </p>
      )}
      {translation?.status === 'loading' && <p className="bubble-translation">Translating…</p>}
      <div className="bubble-actions">
        {translation?.status !== 'ready' && translation?.status !== 'loading' && (
          <button type="button" onClick={() => translateLine(index)}>
            {translation?.status === 'failed' ? 'Couldn’t translate. Try again' : 'Translate'}
          </button>
        )}
        <button type="button" aria-label={`Replay “${text}”`} onClick={() => hearItSaid(text)}>
          🔊 Replay
        </button>
      </div>
    </>
  );
}

function Bubble({ line, index, finished }: { line: ChatLine; index: number; finished: boolean }) {
  const language = useGame(selectTargetLanguage);
  const reading = useGame(selectLineReading(index));
  if (line.speaker === 'npc') {
    return (
      <div className="bubble bubble-npc">
        <ReadingLine language={language} text={line.text} segments={reading} />
        {finished && <NpcLineHelp index={index} text={line.text} />}
      </div>
    );
  }
  return (
    <div className="bubble bubble-player">
      <small>Heard as</small>
      {line.text}
    </div>
  );
}

// A placeholder face until real NPC faces arrive (ticket 30). It's the only way Patience shows.
const FACE: Record<NpcExpression, string> = { relaxed: '🙂', puzzled: '😕', strained: '😟' };

function NpcFace({ role }: { role: string }) {
  const expression = useGame(selectNpcExpression);
  if (!expression) return null;
  return (
    <span className="npc-face" role="img" aria-label={`The ${role} looks ${expression}`} data-expression={expression}>
      {FACE[expression]}
    </span>
  );
}

function outcomeLine(card: ClosingCard, packId: LanguageCode) {
  // A meter already at its limit doesn't move, so there's nothing to show.
  const mood = card.moodChange === 0 ? [] : [card.moodChange > 0 ? 'Mood ↑' : 'Mood ↓'];
  if (card.kind === 'failure') return ['No charge', ...mood];
  const items = card.served.map(({ gloss, quantity }) => (quantity > 1 ? `${gloss} ×${quantity}` : gloss)).join(', ');
  return [items, `−${formatLocalMoney(card.paidInShifts, packId)}`, ...mood];
}

/** Replaces the input bar once the conversation is over: the outcome, its effects, and the way on to the Recap. */
function ClosingCardPanel({ card, role }: { card: ClosingCard; role: string }) {
  const packId = useGame(selectCulturePackId);
  const skipRecap = useGame((s) => s.skipRecap);
  const seeRecap = useGame((s) => s.seeRecap);
  return (
    <section className="closing-card" aria-label="Conversation over" data-outcome={card.kind}>
      <h2>{card.kind === 'success' ? 'Done!' : `The ${role} couldn’t understand you`}</h2>
      <p>{outcomeLine(card, packId).join(' · ')}</p>
      <div className="closing-card-actions">
        <button type="button" onClick={skipRecap} autoFocus>
          Skip Recap
        </button>
        <button type="button" className="primary" onClick={seeRecap}>
          See Recap
        </button>
      </div>
    </section>
  );
}

/** The Recap in the column, as a lined Journal page, with a loading state while it is written. */
function RecapPanel({ recap }: { recap: RecapView }) {
  const closeRecap = useGame((s) => s.closeRecap);
  return (
    <section className="recap" aria-label="Recap" aria-busy={recap.status === 'writing'}>
      <div className="recap-body">
        {recap.status === 'writing' && (
          <p className="recap-writing" role="status">
            Writing your Recap…
          </p>
        )}
        {recap.status === 'failed' && (
          <p className="recap-writing" role="status">
            The Recap couldn’t be written this time. The conversation is saved to your Journal.
          </p>
        )}
        {recap.status === 'ready' && <JournalPageView page={recap.entry} />}
      </div>
      <div className="closing-card-actions recap-actions">
        <button type="button" className="primary" onClick={closeRecap} autoFocus>
          Done
        </button>
      </div>
    </section>
  );
}

/** The always-present typed field: T focuses it, Enter sends, and Space types a space. */
function TypedField() {
  const [text, setText] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const typing = useGame(selectTyping);
  const sendTypedLine = useGame((s) => s.sendTypedLine);
  const setTyping = useGame((s) => s.setTyping);

  useEffect(() => {
    if (typing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyT' || e.repeat) return;
      // Otherwise the T itself lands in the field it just focused.
      e.preventDefault();
      field.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typing]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    // Enter while an IME is composing (Japanese, Chinese) confirms the characters; it doesn't send.
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    sendTypedLine(text);
    setText('');
  };

  return (
    <input
      ref={field}
      type="text"
      aria-label="Typed reply"
      placeholder="Type a reply (T), Enter to send"
      autoComplete="off"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => setTyping(true)}
      onBlur={() => setTyping(false)}
    />
  );
}

/**
 * Push-to-talk: hold Space (unless the typed field has focus) or hold the mic
 * button. Red with a live dot while listening.
 */
function MicButton() {
  const listening = useGame(selectListening);
  const level = useGame(selectMicLevel);
  const typing = useGame(selectTyping);
  const startTalking = useGame((s) => s.startTalking);
  const stopTalking = useGame((s) => s.stopTalking);

  useEffect(() => {
    // Focusing the typed field mid-turn would otherwise lose the Space release.
    if (typing) return stopTalking();
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      // Space would otherwise scroll, or press whichever button has focus.
      e.preventDefault();
      if (!e.repeat) startTalking();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      stopTalking();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [typing, startTalking, stopTalking]);

  // Releasing Space or the button outside the window must still end the turn.
  useEffect(() => {
    window.addEventListener('blur', stopTalking);
    return () => {
      window.removeEventListener('blur', stopTalking);
      stopTalking();
    };
  }, [stopTalking]);

  return (
    <button
      type="button"
      className="mic"
      aria-label="Hold to talk (Space)"
      aria-pressed={listening}
      data-listening={listening || undefined}
      style={{ '--level': level } as CSSProperties}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        startTalking();
      }}
      onPointerUp={stopTalking}
      onPointerCancel={stopTalking}
    >
      <span className="mic-dot" aria-hidden="true" />
      🎤
    </button>
  );
}

function InputBar() {
  return (
    <div className="chat-input">
      <MicButton />
      <TypedField />
    </div>
  );
}

/** The conversation column on the right: header, chat bubbles and the input bar. */
export function ConversationColumn() {
  const conversation = useGame(selectConversation);
  const lines = useGame(selectChatLines);
  const minute = useGame(selectClockMinute);
  const packId = useGame(selectCulturePackId);
  const closingCard = useGame(selectClosingCard);
  const reconnecting = useGame(selectReconnecting);
  const recap = useGame(selectRecap);
  const helpOpen = useGame(selectHelpOpen);
  const typing = useGame(selectTyping);
  const leaveConversation = useGame((s) => s.leaveConversation);
  const toggleHelp = useGame((s) => s.toggleHelp);
  const log = useRef<HTMLDivElement>(null);
  const open = conversation !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') leaveConversation();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, leaveConversation]);

  // H toggles Help, unless the typed field has focus.
  useEffect(() => {
    if (!open || typing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat) toggleHelp();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, typing, toggleHelp]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines, helpOpen]);

  if (!conversation) return null;
  const npc = NAMED_NPCS[conversation.npcId];
  const role = npc.role.charAt(0).toUpperCase() + npc.role.slice(1);

  return (
    <aside className="chat-column" aria-label="Conversation">
      <header className="chat-header">
        <div className="chat-who">
          <NpcFace role={npc.role} />
          <span>{role}</span>
        </div>
        <div className="chat-meta">
          {/* The café is the only staffed place until the whole town lands (ticket 13). */}
          {CULTURE_PACKS[packId].cafe.name} · {formatClock(minute)}
        </div>
        <div className="chat-tabs">
          <div role="tablist" aria-label="Conversation tabs">
            <button type="button" role="tab" aria-selected={!helpOpen} onClick={() => helpOpen && toggleHelp()}>
              Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={helpOpen}
              disabled={conversation.closed}
              onClick={() => !helpOpen && toggleHelp()}
            >
              Help <kbd>H</kbd>
            </button>
          </div>
          <button type="button" className="chat-leave" onClick={leaveConversation}>
            Leave <kbd>Esc</kbd>
          </button>
        </div>
      </header>
      {recap ? (
        <RecapPanel recap={recap} />
      ) : (
        <>
          {helpOpen ? (
            <HelpPanel />
          ) : (
            <div className="chat-log" role="log" aria-label="Chat" ref={log}>
              {lines.map((line, i) => (
                <Bubble key={i} line={line} index={i} finished={i !== conversation.npcLine} />
              ))}
              {reconnecting && (
                <p className="chat-notice" role="status">
                  Reconnecting…
                </p>
              )}
            </div>
          )}
          {closingCard ? <ClosingCardPanel card={closingCard} role={npc.role} /> : <InputBar />}
        </>
      )}
    </aside>
  );
}
