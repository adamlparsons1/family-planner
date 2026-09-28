/**
 * Suggested colours and icons for children.
 *
 * The colours are pastels spread across both hue AND lightness, so any pair
 * picked from this list is likely to survive colour-vision deficiency. The
 * admin screen still checks the actual combination chosen, because a person
 * can pick any colour they like.
 *
 * The icons are chosen for distinct SILHOUETTES, not just distinct colours —
 * young children cannot read yet, and shape is the channel that keeps
 * working when everything else fails.
 */
export const SUGGESTED_COLOURS: { hex: string; name: string }[] = [
  { hex: '#7FB3DA', name: 'Blue' },
  { hex: '#A8D8F0', name: 'Sky' },
  { hex: '#7FCFC4', name: 'Teal' },
  { hex: '#A8D8A8', name: 'Green' },
  { hex: '#CDE08A', name: 'Lime' },
  { hex: '#F5D492', name: 'Amber' },
  { hex: '#F5BE8A', name: 'Orange' },
  { hex: '#F4A9A0', name: 'Coral' },
  { hex: '#EFB0CC', name: 'Pink' },
  { hex: '#E8A0B8', name: 'Rose' },
  { hex: '#C9B3E0', name: 'Lilac' },
  { hex: '#B9A0D8', name: 'Purple' },
];

export const SUGGESTED_ICONS = [
  '🦋', '🌸', '⭐', '🌈', '🐬', '🦊', '🐢', '🐝',
  '🦉', '🐙', '🍄', '🌻', '🦕', '🐳', '🚀', '🎈',
  '⚽', '🎨', '🐧', '🦩', '🌺', '🍀', '🐨', '🦄',
];

/** Grown-ups share one neutral colour, so their icon is the only choice at setup. */
export const GROWN_UP_ICONS = ['🧔', '👩', '🧑', '👨', '👱‍♀️', '👵', '👴'] as const;
