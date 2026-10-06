import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CULTURE_PACKS, formatLocalMoney, localPlaceName, TOWN_NPCS, type ServedItem } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import type { JobId, LanguageCode, NpcExpression } from '../sim/index.ts';
import {
  selectChatLines,
  selectClockMinute,
  selectClosingCard,
  selectConversation,
  selectCulturePackId,
  selectHelpOpen,
  selectInputMode,
  selectLineReading,
  selectListening,
  selectMicLevel,
  selectNativeLanguage,
  selectNpcExpression,
  selectPlaceId,
  selectReconnecting,
  selectRecap,
  selectShift,
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
import { MenuGrid, OrderPad, Till } from './ShiftPanel.tsx';

/** The Job action UI for the Shift Customer at the counter: the barista's menu grid, the cashier's till or the server's order pad. */
function JobPanel({ jobId, conversationId }: { jobId: JobId | undefined; conversationId: number }) {
  if (jobId === 'cashier') return <Till key={conversationId} />;
  if (jobId === 'server') return <OrderPad />;
  return <MenuGrid />;
}

/** Under a finished NPC line: Translate, which shows the Native Language line underneath, and 🔊 Replay. */
function NpcLineHelp({ index, text }: { index: number; text: string }) {
  const { t } = useTranslation();
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
      {translation?.status === 'loading' && <p className="bubble-translation">{t('chat.translating')}</p>}
      <div className="bubble-actions">
        {translation?.status !== 'ready' && translation?.status !== 'loading' && (
          <button type="button" onClick={() => translateLine(index)}>
            {translation?.status === 'failed' ? t('chat.translateFailed') : t('chat.translate')}
          </button>
        )}
        <button type="button" aria-label={t('chat.replayLabel', { text })} onClick={() => hearItSaid(text)}>
          {t('chat.replay')}
        </button>
      </div>
    </>
  );
}

function Bubble({ line, index, finished }: { line: ChatLine; index: number; finished: boolean }) {
  const { t } = useTranslation();
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
      <small>{t('chat.heardAs')}</small>
      {line.text}
    </div>
  );
}

// A placeholder face until real NPC faces arrive (ticket 30). It's the only way Patience shows.
const FACE: Record<NpcExpression, string> = { relaxed: '🙂', puzzled: '😕', strained: '😟' };

/** The face of whoever the Player is talking to; `who` names them to start a sentence. */
function NpcFace({ who }: { who: string }) {
  const { t } = useTranslation();
  const expression = useGame(selectNpcExpression);
  if (!expression) return null;
  return (
    <span
      className="npc-face"
      role="img"
      aria-label={t(`faces.${expression}`, { who })}
      data-expression={expression}
    >
      {FACE[expression]}
    </span>
  );
}

/** What was served (or pointed to), in the Native Language. */
function servedLine(served: readonly ServedItem[], nativeLanguage: LanguageCode) {
  return served
    .map(({ name, glosses, quantity }) => {
      // A pack glosses its items in every Native Language but its own, where the local name already reads.
      const gloss = glosses[nativeLanguage] ?? name;
      return quantity > 1 ? `${gloss} ×${quantity}` : gloss;
    })
    .join(', ');
}

/** Replaces the input bar once the conversation is over: the outcome, its effects, and the way on to the Recap. */
function ClosingCardPanel({ card, who }: { card: ClosingCard; who: string }) {
  const { t } = useTranslation();
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const skipRecap = useGame((s) => s.skipRecap);
  const seeRecap = useGame((s) => s.seeRecap);

  // A meter already at its limit doesn't move, so there's nothing to show.
  const mood = card.moodChange === 0 ? [] : [card.moodChange > 0 ? t('closing.moodUp') : t('closing.moodDown')];
  const outcome =
    card.kind === 'smallTalk'
      ? mood
      : card.kind === 'failure'
        ? [t('closing.noCharge'), ...mood]
        : [
            // Only what happened: nothing served or paid for (the nurse letting the patient go) shows no line for it.
            ...(card.served.length > 0 ? [servedLine(card.served, nativeLanguage)] : []),
            ...(card.pointedTo ? [t('closing.pointedTo', { item: servedLine([card.pointedTo], nativeLanguage) })] : []),
            ...(card.extendedDays ? [t('closing.moreTime', { days: card.extendedDays })] : []),
            ...(card.hired ? [t('closing.hired', { job: t(`skills.names.${card.hired}`) })] : []),
            ...(card.paidInShifts > 0 ? [`−${formatLocalMoney(card.paidInShifts, packId)}`] : []),
            ...mood,
          ];

  const heading = { success: t('closing.success'), failure: t('closing.notUnderstood', { who }), smallTalk: t('closing.smallTalk') }[card.kind];

  return (
    <section className="closing-card" aria-label={t('closing.label')} data-outcome={card.kind}>
      <h2>{heading}</h2>
      <p>{outcome.join(' · ')}</p>
      <div className="closing-card-actions">
        <button type="button" onClick={skipRecap} autoFocus>
          {t('closing.skipRecap')}
        </button>
        <button type="button" className="primary" onClick={seeRecap}>
          {t('closing.seeRecap')}
        </button>
      </div>
    </section>
  );
}

/** The Recap in the column, as a lined Journal page, with a loading state while it is written. */
function RecapPanel({ recap }: { recap: RecapView }) {
  const { t } = useTranslation();
  const closeRecap = useGame((s) => s.closeRecap);
  return (
    <section className="recap" aria-label={t('recap.label')} aria-busy={recap.status === 'writing'}>
      <div className="recap-body">
        {recap.status === 'writing' && (
          <p className="recap-writing" role="status">
            {t('recap.writing')}
          </p>
        )}
        {recap.status === 'failed' && (
          <p className="recap-writing" role="status">
            {t('recap.failed')}
          </p>
        )}
        {recap.status === 'ready' && <JournalPageView page={recap.entry} />}
      </div>
      <div className="closing-card-actions recap-actions">
        <button type="button" className="primary" onClick={closeRecap} autoFocus>
          {t('recap.done')}
        </button>
      </div>
    </section>
  );
}

/** The always-present typed field: T focuses it, Enter sends, and Space types a space. */
function TypedField() {
  const { t } = useTranslation();
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
      aria-label={t('chat.typedLabel')}
      placeholder={t('chat.typedPlaceholder')}
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

/** In the Typed Fallback, a chip says the mic is off where the mic button would be. */
function InputBar() {
  const { t } = useTranslation();
  const inputMode = useGame(selectInputMode);
  return (
    <div className="chat-input">
      {inputMode === 'typed' ? (
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
  const recap = useGame(selectRecap);
  const helpOpen = useGame(selectHelpOpen);
  const typing = useGame(selectTyping);
  const leaveConversation = useGame((s) => s.leaveConversation);
  const toggleHelp = useGame((s) => s.toggleHelp);
  const placeId = useGame(selectPlaceId);
  const shift = useGame(selectShift);
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
  const { npcId } = conversation;
  // A Shift Customer is anonymous: just "Customer", and how far into the Shift they come. One already dealt with
  // counts as done while they say goodbye, so they keep their own number until they leave.
  const who = npcId ? t(`roles.${TOWN_NPCS[npcId].role}.subject`) : t('shift.customerSubject');
  // A Named NPC goes by their local name, with their role beside it.
  const name = npcId
    ? CULTURE_PACKS[packId].personas[npcId].name
    : t('shift.customer', { number: (shift?.done ?? 0) + (conversation.outcome ? 0 : 1), count: shift?.customers ?? 1 });
  const role = npcId ? t(`roles.${TOWN_NPCS[npcId].role}.name`) : null;

  return (
    <aside className="chat-column" aria-label={t('chat.label')}>
      <header className="chat-header">
        <div className="chat-who">
          <NpcFace who={who} />
          <span>{name}</span>
          {role && <span className="chat-role">{role}</span>}
        </div>
        <div className="chat-meta">
          {localPlaceName(conversation.interaction?.placeId ?? placeId, packId)} · {formatClock(minute)}
        </div>
        <div className="chat-tabs">
          <div role="tablist" aria-label={t('chat.tabs')}>
            <button type="button" role="tab" aria-selected={!helpOpen} onClick={() => helpOpen && toggleHelp()}>
              {t('chat.chatTab')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={helpOpen}
              disabled={conversation.closed}
              onClick={() => !helpOpen && toggleHelp()}
            >
              {t('chat.helpTab')} <kbd>H</kbd>
            </button>
          </div>
          <button type="button" className="chat-leave" onClick={leaveConversation}>
            {t('chat.leave')} <kbd>Esc</kbd>
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
            <div className="chat-log" role="log" aria-label={t('chat.log')} ref={log}>
              {lines.map((line, i) => (
                <Bubble key={i} line={line} index={i} finished={i !== conversation.npcLine} />
              ))}
              {reconnecting && (
                <p className="chat-notice" role="status">
                  {t('chat.reconnecting')}
                </p>
              )}
            </div>
          )}
          {conversation.shiftCustomer && <JobPanel jobId={shift?.jobId} conversationId={conversation.id} />}
          {closingCard ? <ClosingCardPanel card={closingCard} who={who} /> : <InputBar />}
        </>
      )}
    </aside>
  );
}
