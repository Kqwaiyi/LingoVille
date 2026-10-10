import { formatLocalMoney, HIRING_PLACES } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import { selectCulturePackId, selectFirstMorningCard, selectMoneyInShifts, selectRentDueDay, useGame } from '../store/index.ts';

/** The First Morning's end: a card at the top centre with the money, the day rent is due and the places hiring, until Got it. */
export function FirstMorningCard() {
  const { t, i18n } = useTranslation();
  const shows = useGame(selectFirstMorningCard);
  const shifts = useGame(selectMoneyInShifts);
  const packId = useGame(selectCulturePackId);
  const rentDueDay = useGame(selectRentDueDay);
  const dismiss = useGame((s) => s.dismissFirstMorningCard);

  if (!shows) return null;
  const places = new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(HIRING_PLACES.map((placeId) => t(`places.${placeId}`)));
  return (
    <section className="first-morning-card" aria-labelledby="first-morning-card-title">
      <h2 id="first-morning-card-title">{t('firstMorning.cardTitle')}</h2>
      <ul>
        <li>{t('firstMorning.cardMoney', { amount: formatLocalMoney(shifts, packId) })}</li>
        <li>{t('firstMorning.cardRent', { day: rentDueDay })}</li>
        <li>{t('firstMorning.cardHiring', { number: HIRING_PLACES.length, places })}</li>
      </ul>
      <button type="button" onClick={dismiss} autoFocus>
        {t('firstMorning.cardOk')}
      </button>
    </section>
  );
}
