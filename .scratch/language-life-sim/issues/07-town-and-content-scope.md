# Town and content scope

Type: grilling
Status: resolved
Blocked by: 01, 02
Map: [Language-learning life sim](../map.md)

## Question

What exactly is in the launch town? Fix the list of places (with opening hours), the NPCs at each, the 2–3 Jobs and what a shift involves, and the catalogue of goal-driven interactions per place — each with its goal, its effect on Well-being/Mood/money, and the Language Proficiency range it suits.

The [Core loop and economy](01-core-loop-and-economy.md) ticket adds requirements here:
- A landlord NPC for paying rent, reminders, and negotiating more time.
- A doctor, plus a pharmacy counter (its own place or part of the hospital or supermarket).
- A catalogue of 3–5 Illnesses with their symptoms.
- Comfort purchases.
- Absolute prices, fitted to that ticket's budget ratios (measured in Shifts of pay).

The [Anatomy of an interaction](02-anatomy-of-an-interaction.md) ticket adds requirements here:
- Each Goal Interaction is authored as data: NPC role and persona, one goal, facts, a completion function with typed arguments, and a Proficiency range.
- Each Job needs a simple action the player does to fill a customer's hidden order (e.g. a menu grid), checked exactly against data.
- A Shift is set by its customer count (5–8), not by clock time.
- Which NPCs start conversations themselves (customers, landlord, doctor) and when.

## Answer

Resolved by grilling on 2026-10-03.

**One town, four Culture Packs.** One shared 3D layout. Each Target Language gets a **Culture Pack** (see `GLOSSARY.md`) containing its menus and goods, currency, customs, signs and opening-hour overrides: onigiri and bowing in Japanese, Brezel and Sunday closing in German. English uses a **UK** setting, which means no tipping, so the restaurant flow is the same in every pack.

**Places (11).**

| Place | Hours (default; a Culture Pack can override) | Staff / NPCs |
|---|---|---|
| Home (apartment block) | always; landlord on site 8:00–20:00 | landlord |
| Café | 7:00–19:00 | barista |
| Supermarket | 9:00–21:00 | cashier |
| Convenience store | 24h | clerk |
| Restaurant | 11:00–22:00, closed Mondays | server |
| Clinic + hospital + pharmacy counter | 9:00–17:00, closed Sundays; the Fainting ward is always open | receptionist, doctor, nurse, pharmacist |
| Park | always | 3–4 regulars (Small Talk) |
| Tram stops (2–3) | trams 6:00–1:00 | passers-by |
| Bookshop / gift shop | 10:00–20:00 | shopkeeper |
| Bathhouse / gym | 10:00–24:00 | attendant |
| Town office / post office | 9:00–17:00, weekdays | clerk |

The German pack closes everything except the bathhouse, the clinic's Fainting ward, the convenience store and the trams on Sunday. Each counter has **one staff role**, with no shift changes. Whether staff are named and remembered belongs to [NPC identity and memory](11-npc-identity-and-memory.md). Trams are fast travel: pick a stop, time passes, you arrive.

**NPCs who start conversations.** No one else approaches the player.
- Job customers walk up to the counter during a Shift.
- The landlord catches you in the hallway as you leave home, on the day rent is due if it's unpaid, and when the Newcomer Discount steps down.
- The doctor or nurse calls your name in the waiting room, and the nurse greets you when you wake from Fainting.
- Park regulars wave you over, at most once per in-game day.

**Jobs (3), all open from day 1.** Language Proficiency only changes which customers come in. A Shift has 5–8 customers, weighted toward the player's band, and can only start while the place is open.

| Job | Customer template | Band | Player action |
|---|---|---|---|
| Barista (café) | Single drink | B | tap the drink on the menu grid |
| | Drink + size + hot/iced + an extra | I | grid plus modifier toggles |
| | Changes their mind halfway | A | undo and redo the order |
| Cashier (supermarket) | Pays, wants a bag and points (or not) | B | scan, toggle bag/card |
| | Pays cash, asks for an item from behind the counter | I | fetch the item, pick coins for the change |
| Server (restaurant) | Single dish + drink | B | order pad |
| | Table of 2–3 with a dietary request | A | order pad with notes |

**Player-led Goal Interactions (25).** Bands **B/I/A** (Beginner/Intermediate/Advanced) are placeholders that [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md) maps onto its scale. The effect listed is what success gives. Failure costs nothing and gives a small Mood dip, as set in [Anatomy of an interaction](02-anatomy-of-an-interaction.md).

| # | Place | Goal | Completion fn | Band | Effect on success |
|---|---|---|---|---|---|
| 1 | Café | Order a drink | `serve_order(items[])` | B | Thirst ↑, −money |
| 2 | Café | Order drink + food with options | `serve_order` | I | Hunger/Thirst ↑ |
| 3 | Café | Order something without an allergen | `serve_order` | A | as above |
| 4 | Supermarket | Pay at the register (bag? points card?) | `complete_purchase(bag, card)` | B | groceries |
| 5 | Supermarket | Ask where an item is | `point_to(item)` | B | marker on item |
| 6 | Supermarket | Return a faulty item | `refund(item, reason)` | A | money back |
| 7 | Convenience | Buy a counter snack / have a bento heated | `serve_order` | B | Hunger ↑ |
| 8 | Restaurant | Get a table | `seat_guest(party, seating)` | B | seated |
| 9 | Restaurant | Order a meal | `serve_order` | I | Hunger ↑↑, Mood ↑ |
| 10 | Restaurant | Get a recommendation within a dietary restriction | `serve_order` | A | as above |
| 11 | Restaurant | Pay the bill | `settle_bill(method)` | B | −money |
| 12 | Clinic | Check in at reception | `register_patient(reason)` | I | queued for doctor |
| 13 | Clinic | Describe symptoms to the doctor | `diagnose(illness)` | I | prescription |
| 14 | Clinic | Get medicine at the pharmacy counter | `dispense(medicine)` | B | cures if the medicine matches the Illness |
| 15 | Clinic | Arrange to pay a hospital bill in instalments | `set_payment_plan(weeks)` | A | debt spread out |
| 16 | Home | Pay rent | `accept_rent(amount)` | B | debt cleared |
| 17 | Home | Ask the landlord for more time | `grant_extension(days)` | A | no Mood penalty for the extension |
| 18 | Bookshop | Buy a book or magazine | `complete_purchase` | B | Comfort Purchase |
| 19 | Bookshop | Buy a gift and have it wrapped | `complete_purchase(wrap)` | I | gift item (stub) |
| 20 | Bookshop | Get a recommendation by taste | `complete_purchase` | A | Comfort Purchase |
| 21 | Bathhouse | Buy entry | `admit(options)` | B | Mood ↑↑ |
| 22 | Bathhouse | Sign up for the gym and ask about the rules | `register_member()` | I | gym access (Fitness) |
| 23 | Town office | Register your address | `register_resident(fields)` | A | flavour only, no unlock |
| 24 | Post office | Send a parcel home | `ship(destination, speed)` | I | Mood ↑ |
| 25 | Tram stop | Ask which tram goes to a place | `give_directions(stop)` | B | route marker |

The park has Small Talk only.

**Illnesses (4).** A wrong diagnosis means the wrong medicine, which doesn't cure the Illness, so the player has to go back. Cold and hay fever both cause sneezing on purpose, to reward precision.

| Illness | Symptoms | Medicine |
|---|---|---|
| Cold | cough, sore throat, runny nose | cold medicine |
| Flu | fever, body aches, chills | fever reducer + rest |
| Food poisoning | stomach ache, nausea (more likely from expired or cheap food) | stomach medicine |
| Hay fever | sneezing, itchy eyes | antihistamine |

**Comfort Purchases (5).** All are consumed rather than kept, since the home is fixed:
- café cake or specialty drink
- book or magazine, read at home
- one bathhouse visit
- restaurant meal
- flowers or a gift to give an NPC (a stub until [NPC identity and memory](11-npc-identity-and-memory.md))

**Prices.** Every price is authored once as a **ratio of one Shift's pay**. Each Culture Pack converts it using its anchor and rounds to natural local price points.

| Pack | 1 Shift | Starting balance (~1.7 Shifts) |
|---|---|---|
| Japanese | ¥6,000 | ¥10,000 |
| Chinese | 240元 | 400元 |
| German | €60 | €100 |
| English (UK) | £60 | £100 |

**Ratio ladder.**
- Supermarket groceries ~0.06/meal, cooked in the fixed home's kitchen. How good the cooking is falls to the Cooking Life Skill.
- Convenience bento ~0.12.
- Café drink ~0.07, café food ~0.1.
- Restaurant meal ~0.25 (a Comfort Purchase).
- Home tap water: free, Thirst only, no Mood.
- Comfort Purchases 0.1–0.3. Weekly rent 2.0 at full price. Fainting bill ~1.5. Doctor + medicine well below 1.5.

A mix of cooking at home and eating out comes to the ~0.5/day survival target from [Core loop and economy](01-core-loop-and-economy.md).

**Amended by [NPC identity and memory](11-npc-identity-and-memory.md):** Small Talk is available with any Named NPC who isn't busy, not only in the park, and gifts now have an effect (Familiarity bump, once per NPC per week).
