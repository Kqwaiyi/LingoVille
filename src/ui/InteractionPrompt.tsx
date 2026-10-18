import { useEffect } from 'react';
import { formatTime, TOWN_NPCS, type TownNpcId } from '../content/index.ts';
import { Trans, useTranslation } from '../i18n/index.ts';
import {
  selectConversation,
  selectInteractable,
  selectStaffDoor,
  selectTalkWithE,
  selectTalkWithF,
  selectTramHours,
  selectTramRunning,
  selectTramStop,
  selectWorldKeysOff,
  useGame,
} from '../store/index.ts';

/** What the staff door says when E can't start a Shift there now. */
const STAFF_DOOR_REFUSALS = { notHired: 'prompt.staffOnly', workedToday: 'prompt.workedToday', closed: 'prompt.shiftClosed' } as const;

/**
 * "Press E to …" while the Character is close enough to use something, and E to use it. Staff who are hiring also
 * take an application on F. Someone with nothing to talk about yet has no prompt.
 */
export function InteractionPrompt() {
  const { t } = useTranslation();
  const interactable = useGame(selectInteractable);
  const tramStop = useGame(selectTramStop);
  const tramRunning = useGame(selectTramRunning);
  const tramHours = useGame(selectTramHours);
  const staffDoor = useGame(selectStaffDoor);
  const talkWithE = useGame(selectTalkWithE);
  const talkWithF = useGame(selectTalkWithF);
  const talking = useGame(selectConversation) !== null;
  const keysOff = useGame(selectWorldKeysOff);
  const talk = useGame((s) => s.talk);
  const openTram = useGame((s) => s.openTram);
  const startShift = useGame((s) => s.startShift);
  const active = interactable !== null && !talking && !keysOff;
  // Outside the trams' hours, or at a staff door that can't start a Shift now, there's only a note: E does nothing there.
  const usable = active && (tramStop === null || tramRunning) && (staffDoor === null || staffDoor.refusal === null);

  useEffect(() => {
    if (!usable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Ctrl+F stays the browser's find.
      if (e.code === 'KeyF' && talkWithF && !e.ctrlKey && !e.metaKey) return talk('F');
      if (e.code !== 'KeyE') return;
      if (tramStop) openTram();
      else if (staffDoor) startShift();
      else talk('E');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [usable, tramStop, staffDoor, talkWithF, openTram, startShift, talk]);

  if (!active) return null;
  // Trams that ran all day (null hours) would always be running, so they have hours here.
  if (tramStop && !tramRunning && tramHours) {
    return (
      <div className="prompt" role="status">
        {t('prompt.noTram', { opens: formatTime(tramHours.opensAt), closes: formatTime(tramHours.closesAt) })}
      </div>
    );
  }
  if (staffDoor?.refusal) {
    return (
      <div className="prompt" role="status">
        {t(STAFF_DOOR_REFUSALS[staffDoor.refusal])}
      </div>
    );
  }
  if (!tramStop && !staffDoor && !talkWithE && !talkWithF) return null;
  return (
    <div className="prompt">
      {tramStop ? (
        <Trans i18nKey="prompt.tram" components={{ kbd: <kbd /> }} />
      ) : staffDoor ? (
        <Trans i18nKey="prompt.startShift" values={{ job: t(`skills.names.${staffDoor.jobId}`) }} components={{ kbd: <kbd /> }} />
      ) : (
        <>
          {talkWithE && (
            <Trans
              i18nKey="prompt.talk"
              values={{ role: t(`roles.${TOWN_NPCS[interactable as TownNpcId].role}.name`) }}
              components={{ kbd: <kbd /> }}
            />
          )}
          {talkWithF && (
            <>
              {talkWithE && ' · '}
              <Trans i18nKey="prompt.askForWork" components={{ kbd: <kbd /> }} />
            </>
          )}
        </>
      )}
    </div>
  );
}
