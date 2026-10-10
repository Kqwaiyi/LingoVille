import { useTranslation } from '../i18n/index.ts';
import { selectTooltip, useGame } from '../store/index.ts';

/** A one-time tooltip: a card above the dock the first time a system comes up, until Got it. */
export function TooltipCard() {
  const { t } = useTranslation();
  const tooltip = useGame(selectTooltip);
  const dismiss = useGame((s) => s.dismissTooltip);

  if (!tooltip) return null;
  return (
    <aside key={tooltip} className="tooltip-card" role="status" aria-labelledby="tooltip-card-title">
      <h2 id="tooltip-card-title">{t(`tooltip.${tooltip}.title`)}</h2>
      <p>{t(`tooltip.${tooltip}.body`)}</p>
      <button type="button" onClick={dismiss}>
        {t('tooltip.gotIt')}
      </button>
    </aside>
  );
}
