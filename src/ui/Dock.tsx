import { useEffect, useState, type CSSProperties } from 'react';
import { formatLocalMoney } from '../content/index.ts';
import { METER_MAX, SAVE, WELL_BEING, type Weekday } from '../sim/index.ts';
import {
  selectClockMinute,
  selectCulturePackId,
  selectDay,
  selectHealth,
  selectHunger,
  selectMood,
  selectMoneyInShifts,
  selectSavedCount,
  selectThirst,
  selectWeekday,
  useGame,
} from '../store/index.ts';
import { formatClock } from './format.ts';

// Strings are English until the i18n module lands (ticket 12).
const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

function RingGauge({ label, icon, value, tone }: { label: string; icon: string; value: number; tone?: 'mood' }) {
  const percent = Math.round((value / METER_MAX) * 100);
  const low = tone !== 'mood' && value <= WELL_BEING.lowWarningAt;
  return (
    <div
      className="ring"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-tone={tone ?? (low ? 'low' : 'ok')}
      style={{ '--fill': `${percent * 3.6}deg` } as CSSProperties}
    >
      <span className="ring-icon" aria-hidden>
        {icon}
      </span>
      <span className="ring-label">{label}</span>
    </div>
  );
}

function Money() {
  const shifts = useGame(selectMoneyInShifts);
  const packId = useGame(selectCulturePackId);
  return (
    <div className="dock-money" aria-label="Money">
      {formatLocalMoney(shifts, packId)}
    </div>
  );
}

// English until the i18n module lands (ticket 12), like the rest of the dock.
/** "Saved ✓" under the clock for a moment after each save. Silent: it makes no sound. */
function SavedNotice() {
  const savedCount = useGame(selectSavedCount);
  const [shownFor, setShownFor] = useState(0);

  useEffect(() => {
    if (savedCount === 0) return;
    setShownFor(savedCount);
    const timer = setTimeout(() => setShownFor(0), SAVE.noticeMs);
    return () => clearTimeout(timer);
  }, [savedCount]);

  return <div className="dock-saved">{shownFor > 0 ? 'Saved ✓' : ''}</div>;
}

/** The always-visible dock at the bottom centre: Well-being, Mood, the clock and money. */
export function Dock() {
  const health = useGame(selectHealth);
  const hunger = useGame(selectHunger);
  const thirst = useGame(selectThirst);
  const mood = useGame(selectMood);
  const minute = useGame(selectClockMinute);
  const day = useGame(selectDay);
  const weekday = useGame(selectWeekday);

  return (
    <section className="dock" aria-label="Dock">
      <RingGauge label="Health" icon="❤️" value={health} />
      <RingGauge label="Hunger" icon="🍙" value={hunger} />
      <RingGauge label="Thirst" icon="💧" value={thirst} />
      {/* The face starts to follow Mood once Mood moves (ticket 15). */}
      <RingGauge label="Mood" icon="🙂" value={mood} tone="mood" />
      <div className="dock-sep" aria-hidden />
      <div className="dock-clock">
        <time className="dock-time" aria-label="Time">
          {formatClock(minute)}
        </time>
        <div className="dock-day">
          Day {day} · {WEEKDAY_LABEL[weekday]}
        </div>
        <SavedNotice />
      </div>
      <div className="dock-sep" aria-hidden />
      <Money />
    </section>
  );
}
