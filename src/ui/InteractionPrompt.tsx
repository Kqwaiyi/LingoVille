import { useEffect } from 'react';
import { formatLocalMoney, formatTime, menuPrice, TOWN_NPCS, type TownNpcId } from '../content/index.ts';
import { Trans, useTranslation } from '../i18n/index.ts';
import {
  selectBasket,
  selectConversation,
  selectCulturePackId,
  selectInteractable,
  selectNativeLanguage,
  selectShelf,
  selectTramHours,
  selectTramRunning,
  selectTramStop,
  selectWorldKeysOff,
  useGame,
} from '../store/index.ts';
import { itemLabel } from './itemLabel.ts';

/** "Press E to …" while the Character is close enough to use something, and E to use it. */
export function InteractionPrompt() {
  const { t } = useTranslation();
  const interactable = useGame(selectInteractable);
  const tramStop = useGame(selectTramStop);
  const tramRunning = useGame(selectTramRunning);
  const tramHours = useGame(selectTramHours);
  const shelf = useGame(selectShelf);
  const hasShopping = useGame(selectBasket).length > 0;
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const talking = useGame(selectConversation) !== null;
  const keysOff = useGame(selectWorldKeysOff);
  const drinkWater = useGame((s) => s.drinkWater);
  const sleep = useGame((s) => s.sleep);
  const talk = useGame((s) => s.talk);
  const openTram = useGame((s) => s.openTram);
  const takeFromShelf = useGame((s) => s.takeFromShelf);
  const active = interactable !== null && !talking && !keysOff;
  // Outside the trams' hours, the stop only says so: E does nothing there.
  const usable = active && (tramStop === null || tramRunning);

  useEffect(() => {
    if (!usable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || e.repeat) return;
      if (interactable === 'tap') drinkWater();
      else if (interactable === 'bed') sleep();
      else if (tramStop) openTram();
      else if (shelf) takeFromShelf();
      else talk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [usable, interactable, tramStop, shelf, drinkWater, sleep, openTram, takeFromShelf, talk]);

  if (!active) return null;
  // Trams that ran all day (null hours) would always be running, so they have hours here.
  if (tramStop && !tramRunning && tramHours) {
    return (
      <div className="prompt" role="status">
        {t('prompt.noTram', { opens: formatTime(tramHours.opensAt), closes: formatTime(tramHours.closesAt) })}
      </div>
    );
  }
  return (
    <div className="prompt">
      {interactable === 'tap' ? (
        <Trans i18nKey="prompt.drink" components={{ kbd: <kbd /> }} />
      ) : interactable === 'bed' ? (
        <Trans i18nKey="prompt.sleep" components={{ kbd: <kbd /> }} />
      ) : tramStop ? (
        <Trans i18nKey="prompt.tram" components={{ kbd: <kbd /> }} />
      ) : shelf ? (
        <Trans
          i18nKey="prompt.take"
          values={{ item: itemLabel(shelf, packId, nativeLanguage), price: formatLocalMoney(menuPrice(shelf, packId), packId) }}
          components={{ kbd: <kbd /> }}
        />
      ) : (
        <Trans
          // With shopping in the basket, the cashier is where it's paid for.
          i18nKey={hasShopping && TOWN_NPCS[interactable as TownNpcId].role === 'cashier' ? 'prompt.pay' : 'prompt.talk'}
          values={{ role: t(`roles.${TOWN_NPCS[interactable as TownNpcId].role}.name`) }}
          components={{ kbd: <kbd /> }}
        />
      )}
    </div>
  );
}
