import type { HouseholdSeed, SeedPerson } from '@/lib/household-seed';

/**
 * What a family set up through /setup starts with. Deliberately generic: no
 * child-specific tasks, no school calendar, no events, no homework. Everything
 * here is editable in Grown-ups.
 */
export const STARTER_ROUTINE: HouseholdSeed['routine'] = {
  Breakfast: [
    { title: 'Eat breakfast', icon: '\u{1F963}' },
  ],
  Bathroom: [
    { title: 'Have a wee', icon: '\u{1F6BD}' },
    { title: 'Wash face', icon: '\u{1F9FC}' },
    { title: 'Brush teeth', icon: '\u{1FAA5}' },
  ],
  'Getting dressed': [
    { title: 'Get dressed', icon: '\u{1F455}' },
    { title: 'Brush hair', icon: '\u{1FAAE}' },
  ],
  'Ready to go': [
    { title: 'Water bottle', icon: '\u{1F4A7}', schoolDaysOnly: true },
    { title: 'School bag', icon: '\u{1F392}', schoolDaysOnly: true },
    { title: 'Shoes on', icon: '\u{1F45F}' },
    { title: 'Coat on', icon: '\u{1F9E5}' },
  ],
};

export const STARTER_CHORES: HouseholdSeed['chores'] = [
  { title: 'Make your bed', icon: '\u{1F6CF}\u{FE0F}', points: 1 },
  { title: 'Tidy your room', icon: '\u{1F9F8}', points: 3 },
  { title: 'Lay the table', icon: '\u{1F37D}\u{FE0F}', points: 2, onePerDay: true },
  { title: 'Clear the table', icon: '\u{1F9FD}', points: 2, onePerDay: true },
  { title: 'Put washing away', icon: '\u{1F455}', points: 3 },
  { title: 'Read to a grown-up', icon: '\u{1F4D6}', points: 2 },
];

export const STARTER_REWARDS: HouseholdSeed['rewards'] = [
  { title: 'Choose the film', icon: '\u{1F3AC}', costPoints: 15 },
  { title: 'Ice cream', icon: '\u{1F366}', costPoints: 20 },
  { title: 'Stay up 15 minutes later', icon: '\u{1F989}', costPoints: 25 },
  { title: 'Choose a weekend dinner', icon: '\u{1F355}', costPoints: 30 },
  { title: 'A trip out', icon: '\u{1F3CA}', costPoints: 50 },
];

/** Grown-ups share one neutral colour, as in the original household. */
export const GROWN_UP_COLOUR = '#475569';

export function starterHousehold(
  parents: readonly SeedPerson[],
  children: readonly SeedPerson[],
): HouseholdSeed {
  return {
    parents,
    children,
    routine: STARTER_ROUTINE,
    nonSchoolPeriods: [],
    events: [],
    homework: [],
    chores: STARTER_CHORES,
    rewards: STARTER_REWARDS,
  };
}
