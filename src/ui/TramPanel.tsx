import { useEffect, useRef } from 'react';
import { useTranslation } from '../i18n/index.ts';
import { selectRouteMarker, selectTramChoosing, selectTramDestinations, selectTramStop, useGame } from '../store/index.ts';

/** At a tram stop, after E: the other stops on the line, each with its trip time, and the one a passer-by said to get off at marked. Trams are free. */
export function TramPanel() {
  const { t } = useTranslation();
  const choosing = useGame(selectTramChoosing);
  const stopId = useGame(selectTramStop);
  const routeMarker = useGame(selectRouteMarker);
  const rideTram = useGame((s) => s.rideTram);
  const closeTram = useGame((s) => s.closeTram);
  const nearestStop = useRef<HTMLButtonElement>(null);
  const open = choosing && stopId !== null;

  useEffect(() => {
    if (!open) return;
    nearestStop.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeTram();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeTram]);

  if (!open) return null;
  return (
    <section className="tram-panel" role="dialog" aria-label={t('tram.heading')}>
      <h2>{t('tram.heading')}</h2>
      <p className="tram-from">{t(`tramStops.${stopId}`)}</p>
      <ul>
        {selectTramDestinations(stopId).map(({ stopId: to, minutes }, i) => (
          <li key={to}>
            <button ref={i === 0 ? nearestStop : undefined} onClick={() => rideTram(to)}>
              <span>{t(`tramStops.${to}`)}</span>
              {to === routeMarker && <span className="tram-marker">{t('tram.routeMarker')}</span>}
              <span className="tram-trip">{t('tram.trip', { minutes })}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="tram-cancel" onClick={closeTram}>
        {t('tram.cancel')}
      </button>
    </section>
  );
}
