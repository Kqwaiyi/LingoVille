import { useEffect } from 'react';
import {
  formatLocalMoney,
  formatTime,
  INTERACTIONS,
  menuPrice,
  TOWN_NPCS,
  type EffectKind,
  type Interaction,
  type TownNpcId,
} from '../content/index.ts';
import { Trans, useTranslation } from '../i18n/index.ts';
import {
  selectConversation,
  selectCulturePackId,
  selectInteractable,
  selectNativeLanguage,
  selectShelf,
  selectSmallTalkKey,
  selectStaffDoor,
  selectTalkWithE,
  selectTalkWithF,
  selectTalkWithR,
  selectTramHours,
  selectTramRunning,
  selectTramStop,
  selectWorldKeysOff,
  useGame,
} from '../store/index.ts';
import { itemLabel } from './itemLabel.ts';

/** What the staff door says when E can't start a Shift there now. */
const STAFF_DOOR_REFUSALS = { notHired: 'prompt.staffOnly', workedToday: 'prompt.workedToday', closed: 'prompt.shiftClosed' } as const;

/** What F offers, by the second conversation's effect: asking where something is, for more time or for work, or settling the hospital bill. */
const F_PROMPTS: Partial<Record<EffectKind, 'prompt.askForTime' | 'prompt.askForWork' | 'prompt.settleHospitalBill'>> = {
  extendRent: 'prompt.askForTime',
  hire: 'prompt.askForWork',
  setPaymentPlan: 'prompt.settleHospitalBill',
};

/** What F offers by the conversation itself, where its effect doesn't say. */
const F_PROMPTS_BY_INTERACTION = new Map<
  Interaction,
  'prompt.buyGift' | 'prompt.askRecommendation' | 'prompt.joinGym' | 'prompt.renewGym' | 'prompt.registerAddress'
>([
  [INTERACTIONS.buyAGift, 'prompt.buyGift'],
  [INTERACTIONS.registerAddress, 'prompt.registerAddress'],
  [INTERACTIONS.recommendAMeal, 'prompt.askRecommendation'],
  [INTERACTIONS.joinTheGym, 'prompt.joinGym'],
  [INTERACTIONS.renewGymMembership, 'prompt.renewGym'],
]);

/**
 * What F offers with this conversation: at the bookshop, buying a gift, at a restaurant table, a recommendation, at the
 * bathhouse, joining or renewing at the gym, at the town office, registering an address, and otherwise by its effect.
 */
const fPrompt = (interaction: Interaction) =>
  F_PROMPTS_BY_INTERACTION.get(interaction) ?? F_PROMPTS[interaction.effect.kind] ?? 'prompt.ask';

/** E pays at the till for shopping, and for the bill at the restaurant. */
const PAYS: readonly EffectKind[] = ['purchase', 'settleBill'];

/**
 * "Press E to …" while the Character is close enough to use something, and E to use it. Some NPCs also offer a second
 * conversation on F, and the cashier a third on R, to bring something back. A Named NPC with nothing else to talk about
 * chats on E; staff chat on T. E asks a passer-by the way.
 */
export function InteractionPrompt() {
  const { t } = useTranslation();
  const interactable = useGame(selectInteractable);
  const tramStop = useGame(selectTramStop);
  const tramRunning = useGame(selectTramRunning);
  const tramHours = useGame(selectTramHours);
  const shelf = useGame(selectShelf);
  const staffDoor = useGame(selectStaffDoor);
  const talkWithE = useGame(selectTalkWithE);
  const talkWithF = useGame(selectTalkWithF);
  const talkWithR = useGame(selectTalkWithR);
  const smallTalkKey = useGame(selectSmallTalkKey);
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const talking = useGame(selectConversation) !== null;
  const keysOff = useGame(selectWorldKeysOff);
  const drinkWater = useGame((s) => s.drinkWater);
  const cook = useGame((s) => s.cook);
  const workOut = useGame((s) => s.workOut);
  const sleep = useGame((s) => s.sleep);
  const talk = useGame((s) => s.talk);
  const openTram = useGame((s) => s.openTram);
  const takeFromShelf = useGame((s) => s.takeFromShelf);
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
      if (e.code === 'KeyT' && smallTalkKey === 'T' && !e.ctrlKey && !e.metaKey) return talk('T');
      // Ctrl+R stays the browser's reload.
      if (e.code === 'KeyR' && talkWithR && !e.ctrlKey && !e.metaKey) return talk('R');
      if (e.code !== 'KeyE') return;
      if (interactable === 'tap') drinkWater();
      else if (interactable === 'stove') cook();
      else if (interactable === 'bed') sleep();
      else if (interactable === 'gym') workOut();
      else if (tramStop) openTram();
      else if (shelf) takeFromShelf();
      else if (staffDoor) startShift();
      else talk('E');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [usable, interactable, tramStop, shelf, staffDoor, talkWithF, talkWithR, smallTalkKey, drinkWater, cook, sleep, workOut, openTram, takeFromShelf, startShift, talk]);

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
  return (
    <div className="prompt">
      {interactable === 'tap' ? (
        <Trans i18nKey="prompt.drink" components={{ kbd: <kbd /> }} />
      ) : interactable === 'stove' ? (
        <Trans i18nKey="prompt.cook" components={{ kbd: <kbd /> }} />
      ) : interactable === 'bed' ? (
        <Trans i18nKey="prompt.sleep" components={{ kbd: <kbd /> }} />
      ) : interactable === 'gym' ? (
        <Trans i18nKey="prompt.workOut" components={{ kbd: <kbd /> }} />
      ) : tramStop ? (
        <Trans i18nKey="prompt.tram" components={{ kbd: <kbd /> }} />
      ) : staffDoor ? (
        <Trans i18nKey="prompt.startShift" values={{ job: t(`skills.names.${staffDoor.jobId}`) }} components={{ kbd: <kbd /> }} />
      ) : shelf ? (
        <Trans
          i18nKey="prompt.take"
          values={{ item: itemLabel(shelf, packId, nativeLanguage), price: formatLocalMoney(menuPrice(shelf, packId), packId) }}
          components={{ kbd: <kbd /> }}
        />
      ) : (
        <>
          <Trans
            i18nKey={
              talkWithE && PAYS.includes(talkWithE.effect.kind)
                ? 'prompt.pay'
                : talkWithE === INTERACTIONS.askForDirections
                  ? 'prompt.askTheWay'
                  : smallTalkKey === 'E'
                    ? 'prompt.chat'
                    : 'prompt.talk'
            }
            values={{ role: t(`roles.${TOWN_NPCS[interactable as TownNpcId].role}.name`) }}
            components={{ kbd: <kbd /> }}
          />
          {talkWithF && (
            <>
              {' · '}
              <Trans i18nKey={fPrompt(talkWithF)} components={{ kbd: <kbd /> }} />
            </>
          )}
          {talkWithR && (
            <>
              {' · '}
              <Trans i18nKey="prompt.returnItem" components={{ kbd: <kbd /> }} />
            </>
          )}
          {smallTalkKey === 'T' && (
            <>
              {' · '}
              <Trans i18nKey="prompt.chatWithT" components={{ kbd: <kbd /> }} />
            </>
          )}
        </>
      )}
    </div>
  );
}
