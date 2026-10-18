import { useTranslation } from '../i18n/index.ts';
import { selectConversation, selectPersistCallout, useGame } from '../store/index.ts';

/**
 * Shown once, until dismissed, when the browser won't promise to keep saves:
 * bottom right, on the title screen or in the game outside conversations.
 */
export function PersistCallout() {
  const { t } = useTranslation();
  const shown = useGame(selectPersistCallout);
  const talking = useGame(selectConversation) !== null;
  const dismiss = useGame((s) => s.dismissPersistCallout);

  if (!shown || talking) return null;
  return (
    <aside className="persist-callout" aria-label={t('persist.label')}>
      <p>{t('persist.body')}</p>
      <button type="button" onClick={dismiss}>
        {t('persist.gotIt')}
      </button>
    </aside>
  );
}
