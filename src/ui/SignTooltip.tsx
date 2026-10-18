import { useTranslation } from '../i18n/index.ts';
import { selectConversation, selectCulturePackId, selectNativeLanguage, selectSignTooltip, useGame } from '../store/index.ts';
import { ReadingLine } from './Ruby.tsx';

/**
 * The tooltip over a sign or menu the Player is pointing at: each line with its
 * reading aid, and Translate for the authored glosses. The pointer can move onto
 * it to reach Translate without it closing.
 */
export function SignTooltip() {
  const { t } = useTranslation();
  const tooltip = useGame(selectSignTooltip);
  const talking = useGame(selectConversation) !== null;
  // Signs are written in the Culture Pack's language.
  const language = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const hold = useGame((s) => s.holdSignTooltip);
  const translate = useGame((s) => s.translateSign);
  if (!tooltip || talking) return null;

  return (
    <aside className="sign-tooltip" aria-label={t('sign.label')} onPointerEnter={() => hold(true)} onPointerLeave={() => hold(false)}>
      <ul>
        {tooltip.lines.map((line, i) => (
          <li key={i}>
            <span className="sign-line">
              <ReadingLine language={language} text={line.text} segments={line.segments} />
              {line.note && <span className="sign-note">{line.note}</span>}
            </span>
            {line.gloss && (
              <span className="sign-gloss" lang={nativeLanguage}>
                {line.gloss}
              </span>
            )}
          </li>
        ))}
      </ul>
      {tooltip.canTranslate && !tooltip.translated && (
        <button type="button" onClick={translate}>
          {t('sign.translate')}
        </button>
      )}
    </aside>
  );
}
