import { describe, expect, it } from 'vitest';
import type { PlaceId } from '../sim/index.ts';
import { CULTURE_PACKS, culturePackProblems, HIRING_PLACES, INTERACTIONS, type Band } from './index.ts';

/** The spec's catalogue of Goal Interactions, #1–#25 (the hiring ones, #26–#28, aside): the interaction, place, completion and band. */
const CATALOGUE: [number, keyof typeof INTERACTIONS, PlaceId, string, Band][] = [
  [1, 'orderDrink', 'cafe', 'serve_order', 'B'],
  [2, 'orderWithOptions', 'cafe', 'serve_order', 'I'],
  [3, 'orderAvoidingAllergen', 'cafe', 'serve_order', 'A'],
  [4, 'payForGroceries', 'supermarket', 'complete_purchase', 'B'],
  [5, 'findAnItem', 'supermarket', 'point_to', 'B'],
  [6, 'returnAnItem', 'supermarket', 'refund', 'A'],
  [7, 'buyCounterFood', 'convenience-store', 'serve_order', 'B'],
  [8, 'getATable', 'restaurant', 'seat_guest', 'B'],
  [9, 'orderAMeal', 'restaurant', 'serve_order', 'I'],
  [10, 'recommendAMeal', 'restaurant', 'serve_order', 'A'],
  [11, 'payTheBill', 'restaurant', 'settle_bill', 'B'],
  [12, 'checkIn', 'clinic', 'register_patient', 'I'],
  [13, 'seeTheDoctor', 'clinic', 'diagnose', 'I'],
  [14, 'getMedicine', 'clinic', 'dispense', 'B'],
  [15, 'settleHospitalBill', 'clinic', 'set_payment_plan', 'A'],
  [16, 'payRent', 'home', 'accept_rent', 'B'],
  [17, 'askForMoreTime', 'home', 'grant_extension', 'A'],
  [18, 'buyABook', 'bookshop', 'complete_purchase', 'B'],
  [19, 'buyAGift', 'bookshop', 'complete_purchase', 'I'],
  [20, 'recommendABook', 'bookshop', 'complete_purchase', 'A'],
  [21, 'buyBathEntry', 'bathhouse', 'admit', 'B'],
  [22, 'joinTheGym', 'bathhouse', 'register_member', 'I'],
  [23, 'registerAddress', 'town-office', 'register_resident', 'A'],
  [24, 'sendAParcel', 'town-office', 'ship', 'I'],
  [25, 'askForDirections', 'tram-stop', 'give_directions', 'B'],
];

describe('the Goal Interaction catalogue', () => {
  it('lists every non-hiring Goal Interaction, #1 to #25, once', () => {
    expect(CATALOGUE.map(([n]) => n)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(new Set(CATALOGUE.map(([, key]) => key)).size).toBe(25);
  });

  it.each(CATALOGUE)('defines #%i (%s) at its place, with its completion and band', (_, key, placeId, completion, band) => {
    const interaction = INTERACTIONS[key];
    expect(interaction).toMatchObject({ placeId, band, completion: { name: completion } });
    expect(interaction.toolDeclaration.name).toBe(completion);
  });

  it('hires at three places, #26–#28: the café, the supermarket and the restaurant', () => {
    expect(HIRING_PLACES).toEqual(['cafe', 'supermarket', 'restaurant']);
  });

  it('cross-references cleanly in every pack', () => {
    expect(culturePackProblems(CULTURE_PACKS, CATALOGUE.map(([, key]) => INTERACTIONS[key]))).toEqual([]);
  });
});
