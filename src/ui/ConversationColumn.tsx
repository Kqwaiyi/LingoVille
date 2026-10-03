import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CULTURE_PACKS, NAMED_NPCS } from '../content/index.ts';
import {
  selectChatLines,
  selectClockMinute,
  selectConversation,
  selectCulturePackId,
  selectTyping,
  useGame,
  type ChatLine,
} from '../store/index.ts';
import { formatClock } from './format.ts';

// English until the i18n module lands (ticket 12).

function Bubble({ line }: { line: ChatLine }) {
  if (line.speaker === 'npc') return <div className="bubble bubble-npc">{line.text}</div>;
  return (
    <div className="bubble bubble-player">
      <small>Heard as</small>
      {line.text}
    </div>
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
    <div className="chat-input">
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
    </div>
  );
}

/** The conversation column on the right: header, chat bubbles and the input bar. */
export function ConversationColumn() {
  const conversation = useGame(selectConversation);
  const lines = useGame(selectChatLines);
  const minute = useGame(selectClockMinute);
  const packId = useGame(selectCulturePackId);
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
  const npc = NAMED_NPCS[conversation.npcId];

  return (
    <aside className="chat-column" aria-label="Conversation">
      <header className="chat-header">
        <div className="chat-who">{npc.role.charAt(0).toUpperCase() + npc.role.slice(1)}</div>
        <div className="chat-meta">
          {/* The café is the only staffed place until the whole town lands (ticket 13). */}
          {CULTURE_PACKS[packId].cafe.name} · {formatClock(minute)}
        </div>
        <div className="chat-tabs">
          <div role="tablist" aria-label="Conversation tabs">
            <button type="button" role="tab" aria-selected="true">
              Chat
            </button>
          </div>
          <button type="button" className="chat-leave" onClick={leaveConversation}>
            Leave <kbd>Esc</kbd>
          </button>
        </div>
      </header>
      <div className="chat-log" role="log" aria-label="Chat" ref={log}>
        {lines.map((line, i) => (
          <Bubble key={i} line={line} />
        ))}
      </div>
      <TypedField />
    </aside>
  );
}
