import { useEffect } from 'react';
import { formatTime, TOWN_NPCS, type TownNpcId } from '../content/index.ts';
import { Trans, useTranslation } from '../i18n/index.ts';
import {
  selectConversation,
  selectInteractable,
  selectTalkWithE,
  selectTramHours,
  selectTramRunning,
  selectTramStop,
  selectWorldKeysOff,
  useGame,
} from '../store/index.ts';

/**
 * "Press E to …" while the Character is close enough to use something, and E to use it. Someone with nothing to talk
 * about yet has no prompt.
 */
export function InteractionPrompt() {
  const { t } = useTranslation();
  const interactable = useGame(selectInteractable);
  const tramStop = useGame(selectTramStop);
  const tramRunning = useGame(selectTramRunning);
  const tramHours = useGame(selectTramHours);
  const talkWithE = useGame(selectTalkWithE);
  const talking = useGame(selectConversation) !== null;
  const keysOff = useGame(selectWorldKeysOff);
  const talk = useGame((s) => s.talk);
  const openTram = useGame((s) => s.openTram);
  const active = interactable !== null && !talking && !keysOff;
  // Outside the trams' hours there's only a note: E does nothing there.
  const usable = active && (tramStop === null || tramRunning);

  useEffect(() => {
    if (!usable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code !== 'KeyE') return;
      if (tramStop) openTram();
      else talk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [usable, tramStop, openTram, talk]);

  if (!active) return null;
  // Trams that ran all day (null hours) would always be running, so they have hours here.
  if (tramStop && !tramRunning && tramHours) {
    return (
      <div className="prompt" role="status">
        {t('prompt.noTram', { opens: formatTime(tramHours.opensAt), closes: formatTime(tramHours.closesAt) })}
      </div>
    );
  }
  if (!tramStop && !talkWithE) return null;
  return (
    <div className="prompt">
      {tramStop ? (
        <Trans i18nKey="prompt.tram" components={{ kbd: <kbd /> }} />
      ) : (
        <Trans
          i18nKey="prompt.talk"
          values={{ role: t(`roles.${TOWN_NPCS[interactable as TownNpcId].role}.name`) }}
          components={{ kbd: <kbd /> }}
        />
      )}
    </div>
  );
}
