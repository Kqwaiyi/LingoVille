import { useTranslation } from '../i18n/index.ts';
import { selectFirstMorningBanner, selectFirstMorningGuide, useGame } from '../store/index.ts';

/** The First Morning's prompt: a banner at the top centre with the step to do next, an arrow pointing the way and how far it is. */
export function FirstMorningBanner() {
  const { t } = useTranslation();
  const step = useGame(selectFirstMorningBanner);
  const guide = useGame(selectFirstMorningGuide);

  if (!step) return null;
  return (
    <section className="first-morning" aria-label={t('firstMorning.label')}>
      {guide && (
        <span className="first-morning-arrow" aria-hidden="true" style={{ transform: `rotate(${guide.bearing}deg)` }}>
          ↑
        </span>
      )}
      <p>{t(`firstMorning.${step}`)}</p>
      {guide && <span className="first-morning-distance">{t('firstMorning.distance', { metres: guide.metres })}</span>}
    </section>
  );
}
