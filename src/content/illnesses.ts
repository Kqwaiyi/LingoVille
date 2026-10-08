import { z } from 'zod';
import { ILLNESS_IDS, type IllnessId } from '../sim/index.ts';

// The four Illnesses the Character can fall ill with, the same in every Culture Pack.
// Each has its own symptoms, which the Player has to describe to the doctor, and the
// one medicine that cures it.

/** What the Character feels while ill. The UI names them in the Native Language; the doctor's facts in English. */
export const SYMPTOM_IDS = [
  'cough',
  'sore-throat',
  'runny-nose',
  'fever',
  'body-aches',
  'chills',
  'stomach-ache',
  'nausea',
  'sneezing',
  'itchy-eyes',
] as const;
export type SymptomId = (typeof SYMPTOM_IDS)[number];

/** What the pharmacy dispenses: one medicine per Illness. */
export const MEDICINE_IDS = ['cold-medicine', 'fever-reducer', 'stomach-medicine', 'antihistamine'] as const;
export type MedicineId = (typeof MEDICINE_IDS)[number];

export const illnessSchema = z.object({
  id: z.enum(ILLNESS_IDS),
  symptoms: z.array(z.enum(SYMPTOM_IDS)).min(1),
  medicine: z.enum(MEDICINE_IDS),
});
export type Illness = z.infer<typeof illnessSchema>;

const illness = (data: Illness): Illness => illnessSchema.parse(data);

export const ILLNESSES: Record<IllnessId, Illness> = {
  cold: illness({ id: 'cold', symptoms: ['cough', 'sore-throat', 'runny-nose'], medicine: 'cold-medicine' }),
  // The fever reducer stops flu's Health drain at once, but the flu clears only after the next sleep.
  flu: illness({ id: 'flu', symptoms: ['fever', 'body-aches', 'chills'], medicine: 'fever-reducer' }),
  'food-poisoning': illness({ id: 'food-poisoning', symptoms: ['stomach-ache', 'nausea'], medicine: 'stomach-medicine' }),
  'hay-fever': illness({ id: 'hay-fever', symptoms: ['sneezing', 'itchy-eyes'], medicine: 'antihistamine' }),
};
