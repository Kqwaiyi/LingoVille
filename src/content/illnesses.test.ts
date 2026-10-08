import { describe, expect, it } from 'vitest';
import { ECONOMY, ILLNESS_IDS, LANGUAGE_CODES, type IllnessId } from '../sim/index.ts';
import { chargeInShifts, illnessCuredBy, ILLNESSES, illnessSchema, MEDICINE_IDS, menuPrice, type MedicineId, type SymptomId } from './index.ts';

/** The spec's Illness table. */
const TABLE: Record<IllnessId, { symptoms: SymptomId[]; medicine: MedicineId }> = {
  cold: { symptoms: ['cough', 'sore-throat', 'runny-nose'], medicine: 'cold-medicine' },
  flu: { symptoms: ['fever', 'body-aches', 'chills'], medicine: 'fever-reducer' },
  'food-poisoning': { symptoms: ['stomach-ache', 'nausea'], medicine: 'stomach-medicine' },
  'hay-fever': { symptoms: ['sneezing', 'itchy-eyes'], medicine: 'antihistamine' },
};

describe('Illnesses', () => {
  it.each(ILLNESS_IDS)('gives %s the symptoms and medicine from the spec', (id) => {
    expect(ILLNESSES[id].symptoms).toEqual(TABLE[id].symptoms);
    expect(ILLNESSES[id].medicine).toBe(TABLE[id].medicine);
  });

  it('passes the schema', () => {
    for (const illness of Object.values(ILLNESSES)) expect(illnessSchema.safeParse(illness).success).toBe(true);
  });

  it('gives each Illness its own symptoms and its own medicine, so describing them tells them apart', () => {
    const symptoms = ILLNESS_IDS.flatMap((id) => ILLNESSES[id].symptoms);
    expect(new Set(symptoms).size).toBe(symptoms.length);
    expect(new Set(ILLNESS_IDS.map((id) => ILLNESSES[id].medicine)).size).toBe(ILLNESS_IDS.length);
  });
});

describe('the clinic’s prices', () => {
  // "Clearly less" than Fainting: no more than half its bill, so going to the doctor early is always the smart move.
  it.each(LANGUAGE_CODES)('in %s, a doctor’s visit plus any medicine costs no more than half of Fainting', (packId) => {
    const visit = chargeInShifts(ECONOMY.consultationFeeInShifts, packId);
    const fainting = chargeInShifts(ECONOMY.faintingBillInShifts, packId);
    for (const id of ILLNESS_IDS) expect(visit + menuPrice(ILLNESSES[id].medicine, packId)).toBeLessThanOrEqual(fainting / 2);
  });

  it.each(ILLNESS_IDS)('cures %s only with its own medicine', (id) => {
    for (const medicine of MEDICINE_IDS) expect(illnessCuredBy(medicine) === id).toBe(medicine === ILLNESSES[id].medicine);
  });
});
