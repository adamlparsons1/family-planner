/**
 * The stages of a morning, in the order the morning actually happens.
 *
 * Grouping matters: sixteen tiles at once is too much for a four-year-old, and
 * children who cannot read yet need the choice kept small and the order obvious.
 */
export const ROUTINE_CATEGORIES = [
  'Breakfast',
  'Bathroom',
  'Getting dressed',
  'Ready to go',
] as const;

export type RoutineCategory = (typeof ROUTINE_CATEGORIES)[number];

/**
 * A made-up household for local development and tests only (`npm run db:seed`).
 * Real families are created through /setup and never appear in the code.
 *
 * The three child colours are pastels spaced apart in LUMINANCE as well as hue,
 * so they stay tellable apart for someone who is colour-blind (see contrast.test.ts).
 */
export const EXAMPLE_FAMILY = {
  parents: [
    { name: 'Sam', displayName: 'Dad', colour: '#475569', icon: '🧔', sortOrder: 0 },
    { name: 'Jo', displayName: 'Mum', colour: '#475569', icon: '👩', sortOrder: 1 },
  ],
  children: [
    { name: 'Ruby', displayName: 'Ruby', colour: '#7FB3DA', icon: '🦋', sortOrder: 0 },
    { name: 'Max', displayName: 'Max', colour: '#EFB0CC', icon: '🌸', sortOrder: 1 },
    { name: 'Ivy', displayName: 'Ivy', colour: '#F5D492', icon: '⭐', sortOrder: 2 },
  ],
} as const;
