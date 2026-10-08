import { useEffect, useState, type CSSProperties } from 'react';
import { formatLocalMoney, formatTime } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import { LIFE_SKILL_IDS, LIFE_SKILLS, METER_MAX, SAVE, WELL_BEING, type MoodFace } from '../sim/index.ts';
import {
  selectClockMinute,
  selectCulturePackId,
  selectDay,
  selectDebts,
  selectHealth,
  selectHunger,
  selectInventory,
  selectLifeSkillLevels,
  selectMood,
  selectMoodFace,
  selectMoneyInShifts,
  selectNativeLanguage,
  selectPlaceHours,
  selectPlaceId,
  selectPlaceOpen,
  selectSavedCount,
  selectSymptoms,
  selectThirst,
  selectWeekday,
  useGame,
} from '../store/index.ts';
import { formatClock } from './format.ts';
import { itemLabel } from './itemLabel.ts';
import { usePlaceName } from './placeName.ts';

const MOOD_FACE_ICONS: Record<MoodFace, string> = { miserable: '😫', low: '🙁', okay: '😐', good: '🙂', great: '😄' };

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

/** The money, with anything owed under it. */
function Money() {
  const { t } = useTranslation();
  const shifts = useGame(selectMoneyInShifts);
  const debts = useGame(selectDebts);
  const packId = useGame(selectCulturePackId);
  return (
    <div className="dock-wallet">
      <div className="dock-money" aria-label={t('dock.money')}>
        {formatLocalMoney(shifts, packId)}
      </div>
      {debts.length > 0 && (
        <ul className="dock-debts" aria-label={t('dock.debts')}>
          {debts.map(({ kind, amountInShifts }) => (
            <li key={kind}>{t(`dock.debt.${kind}`, { amount: formatLocalMoney(amountInShifts, packId) })}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What the Character owns, behind a button in the dock: each thing, how many, and whether groceries are still fresh. */
function Inventory() {
  const { t } = useTranslation();
  const inventory = useGame(selectInventory);
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const [open, setOpen] = useState(false);
  const count = inventory.reduce((sum, { quantity }) => sum + quantity, 0);

  return (
    <div className="dock-inventory">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('inventory.open', { count })}
      </button>
      {open && (
        <section className="inventory" aria-label={t('inventory.label')}>
          <h2>{t('inventory.label')}</h2>
          {inventory.length === 0 ? (
            <p className="inventory-empty">{t('inventory.empty')}</p>
          ) : (
            <ul>
              {inventory.map(({ itemId, quantity, expiresOnDay, goneOff }) => (
                <li key={`${itemId}-${expiresOnDay}`} data-gone-off={goneOff || undefined}>
                  <span>
                    {itemLabel(itemId, packId, nativeLanguage)} ×{quantity}
                  </span>
                  {expiresOnDay !== null && (
                    <span className="inventory-fresh">{goneOff ? t('inventory.goneOff') : t('inventory.freshUntil', { day: expiresOnDay })}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="inventory-close" onClick={() => setOpen(false)}>
            {t('inventory.close')}
          </button>
        </section>
      )}
    </div>
  );
}

/** The skills page, behind a button in the dock: each Life Skill's level as stars out of 5. */
function Skills() {
  const { t } = useTranslation();
  const levels = useGame(selectLifeSkillLevels);
  const [open, setOpen] = useState(false);
  const max = LIFE_SKILLS.maxLevel;

  return (
    <div className="dock-skills">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('skills.open')}
      </button>
      {open && (
        <section className="skills" aria-label={t('skills.label')}>
          <h2>{t('skills.label')}</h2>
          <ul>
            {LIFE_SKILL_IDS.map((skill) => (
              <li key={skill}>
                <span>{t(`skills.names.${skill}`)}</span>
                <span className="skills-stars" role="img" aria-label={t('skills.level', { level: levels[skill], max })}>
                  {'★'.repeat(levels[skill])}
                  {'☆'.repeat(max - levels[skill])}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="skills-close" onClick={() => setOpen(false)}>
            {t('skills.close')}
          </button>
        </section>
      )}
    </div>
  );
}

/** "Saved ✓" under the clock for a moment after each save. Silent: it makes no sound. */
function SavedNotice() {
  const { t } = useTranslation();
  const savedCount = useGame(selectSavedCount);
  const [shownFor, setShownFor] = useState(0);

  useEffect(() => {
    if (savedCount === 0) return;
    setShownFor(savedCount);
    const timer = setTimeout(() => setShownFor(0), SAVE.noticeMs);
    return () => clearTimeout(timer);
  }, [savedCount]);

  return <div className="dock-saved">{shownFor > 0 ? t('dock.saved') : ''}</div>;
}

/** Just above the dock: where the Character is, its opening hours, and whether it's open now. Home has no hours to show. */
function PlaceLine() {
  const { t, i18n } = useTranslation();
  const placeId = useGame(selectPlaceId);
  const packId = useGame(selectCulturePackId);
  const hours = useGame(selectPlaceHours);
  const open = useGame(selectPlaceOpen);
  const placeName = usePlaceName();

  const parts = [placeName(placeId, packId)];
  if (placeId !== 'home') {
    if (hours === null) parts.push(t('placeLine.allDay'));
    else {
      parts.push(
        t('placeLine.hours', {
          opens: formatTime(hours.opensAt),
          closes: formatTime(hours.closesAt),
        }),
      );
      if (hours.closedOn.length > 0) {
        const days = new Intl.ListFormat(i18n.language, {
          type: 'conjunction',
        }).format(hours.closedOn.map((day) => t(`weekdays.${day}`)));
        parts.push(t('placeLine.closedOn', { days }));
      }
    }
  }

  return (
    <div className="place-line" role="status" aria-label={t('placeLine.label')}>
      <span>{parts.join(' · ')}</span>
      {placeId !== 'home' && (
        <span className="place-status" data-open={open}>
          {t(open ? 'placeLine.openNow' : 'placeLine.closedNow')}
        </span>
      )}
    </div>
  );
}

/**
 * Just above the dock while the Character is ill: what they feel, so the Player knows to see the doctor and
 * what to describe. It never names the Illness: working that out is the doctor's job.
 */
function UnwellLine() {
  const { t, i18n } = useTranslation();
  const symptoms = useGame(selectSymptoms);
  if (symptoms.length === 0) return null;
  const felt = new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(symptoms.map((symptom) => t(`symptoms.${symptom}`)));
  return (
    <div className="unwell-line" role="status" aria-label={t('dock.unwell.label')}>
      <span aria-hidden>🤒</span> {t('dock.unwell.symptoms', { symptoms: felt })}
    </div>
  );
}

/** The always-visible dock at the bottom centre: Well-being, Mood, the clock and money, with the place line above it. */
export function Dock() {
  const { t } = useTranslation();
  const health = useGame(selectHealth);
  const hunger = useGame(selectHunger);
  const thirst = useGame(selectThirst);
  const mood = useGame(selectMood);
  const moodFace = useGame(selectMoodFace);
  const minute = useGame(selectClockMinute);
  const day = useGame(selectDay);
  const weekday = useGame(selectWeekday);

  return (
    <div className="dock-area">
      <UnwellLine />
      <PlaceLine />
      <section className="dock" aria-label={t('dock.label')}>
        <RingGauge label={t('dock.health')} icon="❤️" value={health} />
        <RingGauge label={t('dock.hunger')} icon="🍙" value={hunger} />
        <RingGauge label={t('dock.thirst')} icon="💧" value={thirst} />
        <RingGauge label={t('dock.mood')} icon={MOOD_FACE_ICONS[moodFace]} value={mood} tone="mood" />
        <div className="dock-sep" aria-hidden />
        <div className="dock-clock">
          <time className="dock-time" aria-label={t('dock.time')}>
            {formatClock(minute)}
          </time>
          <div className="dock-day">{t('dock.day', { day, weekday: t(`weekdays.${weekday}`) })}</div>
          <SavedNotice />
        </div>
        <div className="dock-sep" aria-hidden />
        <Money />
        <div className="dock-sep" aria-hidden />
        <Inventory />
        <Skills />
      </section>
    </div>
  );
}
