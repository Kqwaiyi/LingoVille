import { STEP_BANDS, type ApproachId, type GymMembership, type JobId, type ProficiencyStep, type RestaurantTable } from '../sim/index.ts';
import type { Interaction } from './defineInteraction.ts';
import { INTERACTIONS } from './interactions.ts';
import type { NamedNpcId } from './npcs.ts';

/** The conversation an NPC opens when they approach the Character. */
const APPROACH_INTERACTIONS: Record<ApproachId, Interaction> = {
  nurseOnWaking: INTERACTIONS.wakeInWard,
  landlordRentDue: INTERACTIONS.rentReminder,
  landlordDiscountStepDown: INTERACTIONS.newcomerDiscountNews,
  doctorCallsName: INTERACTIONS.seeTheDoctor,
};

export function approachInteraction(approachId: ApproachId): Interaction {
  return APPROACH_INTERACTIONS[approachId];
}

const OPENED_BY_NPCS = new Set(Object.values(APPROACH_INTERACTIONS));

/**
 * What the Character brings to the conversation: shopping from the supermarket's shelves, or none, the Jobs they
 * already have, their current Proficiency Step, their table and bill at the restaurant, whether they owe it for a
 * bill they walked out on, their gym membership, whether they owe the hospital and whether they hold a prescription.
 */
export type Bringing = {
  shopping: boolean;
  jobsHired?: readonly JobId[];
  step?: ProficiencyStep;
  restaurant?: RestaurantTable;
  owesRestaurant?: boolean;
  gymMembership?: GymMembership;
  owesHospital?: boolean;
  holdsPrescription?: boolean;
};

/** No table at the restaurant, and nothing owed there. */
const NO_TABLE: RestaurantTable = { seated: false, bill: [] };

/**
 * The conversation E starts with this Named NPC, or null if they only ever start one themselves.
 * The cashier takes payment for shopping brought to the till, and otherwise helps find something.
 * The shopkeeper sells a book, and from the Advanced band recommends one by taste instead. The server takes the
 * bill while anything is on it or anything is owed from a bill walked out on, takes the order at the Character's
 * table, and otherwise gets them a table. The attendant sells a bath. The receptionist checks the Character in to see the
 * doctor, and the pharmacist hands over what the doctor prescribed, with nothing to hand over without a prescription.
 */
export function interactionStartedWithE(
  npcId: NamedNpcId,
  { shopping, step = 'A1', restaurant = NO_TABLE, owesRestaurant = false, holdsPrescription = false }: Bringing = { shopping: false },
): Interaction | null {
  if (npcId === 'cashier') return shopping ? INTERACTIONS.payForGroceries : INTERACTIONS.findAnItem;
  if (npcId === 'server') {
    if (restaurant.bill.length > 0 || owesRestaurant) return INTERACTIONS.payTheBill;
    return restaurant.seated ? INTERACTIONS.orderAMeal : INTERACTIONS.getATable;
  }
  if (npcId === 'shopkeeper') return STEP_BANDS[step] === 'A' ? INTERACTIONS.recommendABook : INTERACTIONS.buyABook;
  if (npcId === 'attendant') return INTERACTIONS.buyBathEntry;
  if (npcId === 'receptionist') return INTERACTIONS.checkIn;
  if (npcId === 'pharmacist') return holdsPrescription ? INTERACTIONS.getMedicine : null;
  return Object.values(INTERACTIONS).find((i) => i.npcId === npcId && !OPENED_BY_NPCS.has(i) && i.effect.kind !== 'hire') ?? null;
}

/**
 * The second conversation F starts with this Named NPC, or null when E is the only one.
 * With shopping, E at the cashier pays, so F asks where something else is. E at the
 * landlord pays the rent, and F asks for more time. F at the shopkeeper buys a gift, and F at the server, from a
 * table, asks for a recommendation within a dietary restriction. F at the attendant joins the gym, or renews a
 * membership that has run out (never while it runs). F at the receptionist settles the hospital bill while one is owed.
 * Staff who are hiring take an application on F until the Character has that Job (the cashier, when not paying for
 * shopping; the server, when not seated).
 */
export function interactionStartedWithF(
  npcId: NamedNpcId,
  { shopping, jobsHired = [], restaurant = NO_TABLE, gymMembership = 'none', owesHospital = false }: Bringing = { shopping: false },
): Interaction | null {
  if (npcId === 'landlord') return INTERACTIONS.askForMoreTime;
  if (npcId === 'receptionist') return owesHospital ? INTERACTIONS.settleHospitalBill : null;
  if (npcId === 'attendant') {
    if (gymMembership === 'active') return null;
    return gymMembership === 'expired' ? INTERACTIONS.renewGymMembership : INTERACTIONS.joinTheGym;
  }
  if (npcId === 'server' && restaurant.seated) return INTERACTIONS.recommendAMeal;
  if (npcId === 'shopkeeper') return INTERACTIONS.buyAGift;
  if (npcId === 'cashier' && shopping) return INTERACTIONS.findAnItem;
  for (const interaction of Object.values(INTERACTIONS)) {
    const { effect } = interaction;
    if (interaction.npcId === npcId && effect.kind === 'hire') return jobsHired.includes(effect.jobId) ? null : interaction;
  }
  return null;
}
