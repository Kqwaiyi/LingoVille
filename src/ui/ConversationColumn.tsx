import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CULTURE_PACKS, formatLocalMoney, localNpcPlaceName, TOWN_NPCS, type ServedItem } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import type { LanguageCode } from '../sim/index.ts';
import {
  selectCanTakeTurn,
  selectChatLines,
  selectClockMinute,
  selectClosingCard,
  selectConversation,
  selectCulturePackId,
  selectInputMode,
  selectListening,
  selectMicLevel,
  selectNativeLanguage,
  selectNpcExpression,
  selectNpcLook,
  selectReconnecting,
  selectTargetLanguage,
  selectTyping,
  useGame,
  type ChatLine,
  type ClosingCard,
} from '../store/index.ts';
import { NpcPortrait } from '../world/index.ts';
import { formatClock } from './format.ts';

function Bubble({ line }: { line: ChatLine }) {
  const { t } = useTranslation();
  const language = useGame(selectTargetLanguage);
  if (line.speaker === 'npc') {
    return (
      <div className="bubble bubble-npc">
        <span lang={language}>{line.text}</span>
      </div>
    );
  }
  return (
    <div className="bubble bubble-player">
      <small>{t('chat.heardAs')}</small>
      {line.text}
    </div>
  );
}

/** The face of whoever the Player is talking to, which shows their Patience; `who` names them to start a sentence. */
function NpcFace({ who }: { who: string }) {
  const { t } = useTranslation();
  const expression = useGame(selectNpcExpression);
  const look = useGame(selectNpcLook);
  if (!expression || !look) return null;
  return (
    <div className="npc-face" role="img" aria-label={t(`faces.${expression}`, { who })} data-expression={expression}>
      <NpcPortrait appearance={look} expression={expression} />
    </div>
  );
}

/** What was served, in the Native Language. */
function servedLine(served: readonly ServedItem[], nativeLanguage: LanguageCode) {
  return served
    .map(({ name, glosses, quantity }) => {
      // A pack glosses its items in every Native Language but its own, where the local name already reads.
      const gloss = glosses[nativeLanguage] ?? name;
      return quantity > 1 ? `${gloss} ×${quantity}` : gloss;
    })
    .join(', ');
}

/** Replaces the input bar once the conversation is over: the outcome and its effects. */
function ClosingCardPanel({ card, who }: { card: ClosingCard; who: string }) {
  const { t } = useTranslation();
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);

  const outcome =
    card.kind === 'failure'
      ? [t('closing.noCharge')]
      : [
          // Only what happened: nothing served or paid for shows no line for it.
          ...(card.served.length > 0 ? [servedLine(card.served, nativeLanguage)] : []),
          ...(card.paidInShifts > 0 ? [`−${formatLocalMoney(card.paidInShifts, packId)}`] : []),
        ];

  const heading = { success: t('closing.success'), failure: t('closing.notUnderstood', { who }) }[card.kind];

  return (
    <section className="closing-card" aria-label={t('closing.label')} data-outcome={card.kind}>
      <h2>{heading}</h2>
      <p>{outcome.join(' · ')}</p>
    </section>
  );
}

/** The always-present typed field: T focuses it, Enter sends, and Space types a space. */
function TypedField() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const typing = useGame(selectTyping);
  // While the NPC says goodbye, or the connection is coming back, a line typed now would go nowhere.
  const canTakeTurn = useGame(selectCanTakeTurn);
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
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || !canTakeTurn) return;
    e.preventDefault();
    sendTypedLine(text);
    setText('');
  };

  return (
    <input
      ref={field}
      type="text"
      aria-label={t('chat.typedLabel')}
      placeholder={t('chat.typedPlaceholder')}
      autoComplete="off"
      readOnly={!canTakeTurn}
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
  const { t } = useTranslation();
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
      aria-label={t('chat.mic')}
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

/** The mic button. In the Typed Fallback, a chip says the mic is off where the mic button would be. */
function InputBar() {
  const { t } = useTranslation();
  const micOff = useGame(selectInputMode) === 'typed';
  return (
    <div className="chat-input">
      {micOff ? (
        <span className="mic-off" title={t('chat.micOffHint')}>
          {t('chat.micOff')}
        </span>
      ) : (
        <MicButton />
      )}
      <TypedField />
    </div>
  );
}

/** The conversation column on the right: header, chat bubbles and the input bar. */
export function ConversationColumn() {
  const { t } = useTranslation();
  const conversation = useGame(selectConversation);
  const lines = useGame(selectChatLines);
  const minute = useGame(selectClockMinute);
  const packId = useGame(selectCulturePackId);
  const closingCard = useGame(selectClosingCard);
  const reconnecting = useGame(selectReconnecting);
  const leaveConversation = useGame((s) => s.leaveConversation);
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

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines]);

  if (!conversation) return null;
  const { npcId } = conversation;
  const who = t(`roles.${TOWN_NPCS[npcId].role}.subject`);
  // A Named NPC goes by their local name, with their role beside it.
  const name = CULTURE_PACKS[packId].personas[npcId].name;
  const role = t(`roles.${TOWN_NPCS[npcId].role}.name`);

  return (
    <aside className="chat-column" aria-label={t('chat.label')}>
      <header className="chat-header">
        <div className="chat-who">
          <NpcFace who={who} />
          <span>{name}</span>
          <span className="chat-role">{role}</span>
        </div>
        <div className="chat-meta">
          {localNpcPlaceName(npcId, packId)} · {formatClock(minute)}
        </div>
        <div className="chat-tabs">
          <button type="button" className="chat-leave" onClick={leaveConversation}>
            {t('chat.leave')} <kbd>Esc</kbd>
          </button>
        </div>
      </header>
      <div className="chat-log" role="log" aria-label={t('chat.log')} ref={log}>
        {lines.map((line, i) => (
          <Bubble key={i} line={line} />
        ))}
        {reconnecting && (
          <p className="chat-notice" role="status">
            {t('chat.reconnecting')}
          </p>
        )}
      </div>
      {closingCard ? (
        <ClosingCardPanel card={closingCard} who={who} />
      ) : (
        <InputBar />
      )}
    </aside>
  );
}
