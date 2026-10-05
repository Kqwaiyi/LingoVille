import { formatLocalMoney, menuPrice } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import { selectBasket, selectConversation, selectCulturePackId, selectNativeLanguage, useGame } from '../store/index.ts';
import { itemLabel } from './itemLabel.ts';

/** The supermarket basket, while it holds anything: what's in it, the total, and putting things back. */
export function BasketPanel() {
  const { t } = useTranslation();
  const basket = useGame(selectBasket);
  const talking = useGame(selectConversation) !== null;
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const putBack = useGame((s) => s.putBack);
  if (basket.length === 0) return null;

  const total = basket.reduce((sum, { itemId, quantity }) => sum + menuPrice(itemId, packId) * quantity, 0);
  return (
    <section className="basket" aria-label={t('basket.label')}>
      <h2>{t('basket.label')}</h2>
      <ul>
        {basket.map(({ itemId, quantity }) => {
          const item = itemLabel(itemId, packId, nativeLanguage);
          return (
            <li key={itemId}>
              <span>
                {item} ×{quantity}
              </span>
              <button type="button" aria-label={t('basket.putBack', { item })} disabled={talking} onClick={() => putBack(itemId)}>
                −
              </button>
            </li>
          );
        })}
      </ul>
      <p className="basket-total">
        {t('basket.total', { amount: formatLocalMoney(total, packId) })} · {t('basket.payAtTill')}
      </p>
    </section>
  );
}
