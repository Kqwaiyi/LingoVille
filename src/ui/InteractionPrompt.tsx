import { useEffect } from 'react';
import { Trans, useTranslation } from '../i18n/index.ts';
import { selectConversation, selectInteractable, selectWorldKeysOff, useGame } from '../store/index.ts';

/** "Press E to …" while the Character is close enough to use something, and E to use it. */
export function InteractionPrompt() {
  const { t } = useTranslation();
  const interactable = useGame(selectInteractable);
  const talking = useGame(selectConversation) !== null;
  const keysOff = useGame(selectWorldKeysOff);
  const drinkWater = useGame((s) => s.drinkWater);
  const talk = useGame((s) => s.talk);
  const active = interactable !== null && !talking && !keysOff;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || e.repeat) return;
      if (interactable === 'tap') drinkWater();
      else talk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, interactable, drinkWater, talk]);

  if (!active) return null;
  return (
    <div className="prompt">
      {interactable === 'tap' ? (
        <Trans i18nKey="prompt.drink" components={{ kbd: <kbd /> }} />
      ) : (
        <Trans i18nKey="prompt.talk" values={{ role: t(`roles.${interactable}.name`) }} components={{ kbd: <kbd /> }} />
      )}
    </div>
  );
}
