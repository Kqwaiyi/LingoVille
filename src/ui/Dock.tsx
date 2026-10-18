import { useEffect, useState } from 'react';
import { formatLocalMoney, formatTime } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import { PLACE_LINE, SAVE } from '../sim/index.ts';
import {
  selectClockMinute,
  selectCulturePackId,
  selectDay,
  selectMoneyInShifts,
  selectPlaceHours,
  selectPlaceId,
  selectPlaceOpen,
  selectSavedCount,
  selectWeekday,
  useGame,
} from '../store/index.ts';
import { formatClock } from './format.ts';
import { usePlaceName } from './placeName.ts';

/** The money. */
function Money() {
  const { t } = useTranslation();
  const shifts = useGame(selectMoneyInShifts);
  const packId = useGame(selectCulturePackId);
  return (
    <div className="dock-wallet">
      <div className="dock-money" aria-label={t('dock.money')}>
        {formatLocalMoney(shifts, packId)}
      </div>
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

/**
 * Just above the dock on arriving somewhere, and when the place opens or closes: where the Character is, its opening
 * hours, and whether it's open now. It fades away after a few seconds, still there for a screen reader, and keeps its
 * room so nothing moves when it goes. Home has no hours to show.
 */
function PlaceLine() {
  const { t, i18n } = useTranslation();
  const placeId = useGame(selectPlaceId);
  const packId = useGame(selectCulturePackId);
  const hours = useGame(selectPlaceHours);
  const open = useGame(selectPlaceOpen);
  const placeName = usePlaceName();
  // What the line says, and what it last said for long enough to fade.
  const saying = `${placeId} ${open}`;
  const [faded, setFaded] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setFaded(saying), PLACE_LINE.shownMs);
    return () => clearTimeout(timer);
  }, [saying]);

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
    <div className="place-line" role="status" aria-label={t('placeLine.label')} data-faded={faded === saying || undefined}>
      <span>{parts.join(' · ')}</span>
      {placeId !== 'home' && (
        <span className="place-status" data-open={open}>
          {t(open ? 'placeLine.openNow' : 'placeLine.closedNow')}
        </span>
      )}
    </div>
  );
}

/** The always-visible dock at the bottom centre: the clock and money, with the place line above it. */
export function Dock() {
  const { t } = useTranslation();
  const minute = useGame(selectClockMinute);
  const day = useGame(selectDay);
  const weekday = useGame(selectWeekday);

  return (
    <div className="dock-area">
      <PlaceLine />
      <section className="dock" aria-label={t('dock.label')}>
        <div className="dock-clock">
          <time className="dock-time" aria-label={t('dock.time')}>
            {formatClock(minute)}
          </time>
          <div className="dock-day">{t('dock.day', { day, weekday: t(`weekdays.${weekday}`) })}</div>
          <SavedNotice />
        </div>
        <div className="dock-sep" aria-hidden />
        <Money />
      </section>
    </div>
  );
}
