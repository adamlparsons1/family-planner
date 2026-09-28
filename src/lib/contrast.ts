/**
 * Contrast utilities.
 *
 * Child colours come from the database, so the text colour laid over them
 * cannot be hardcoded - white on the amber child fails WCAG AA badly (2.15:1
 * against a 3:1 requirement for large text). These pick the readable option.
 *
 * WCAG 2.1 relative luminance and contrast ratio.
 */

const INK = '#2b2620';
const PAPER = '#ffffff';

export function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The more readable of ink or white on the given background.
 * Used wherever a child's colour becomes a background.
 */
export function readableTextOn(background: string): string {
  return contrastRatio(background, INK) >= contrastRatio(background, PAPER) ? INK : PAPER;
}

/** WCAG AA: 4.5:1 for body text, 3:1 for large text (>=24px, or >=18.66px bold). */
export function meetsAA(foreground: string, background: string, large = false): boolean {
  return contrastRatio(foreground, background) >= (large ? 3 : 4.5);
}

/**
 * Darken a colour toward black by `amount` (0-1).
 *
 * Used to derive a tile's border from its own fill. Pastel fills sit very close
 * to the warm background - the amber child is only 1.33:1 against it - so
 * without an edge the tiles dissolve into the page. Deriving the border keeps
 * this working for any colour chosen later.
 */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const f = Math.max(0, Math.min(1, 1 - amount));
  const to = (v: number) => Math.round(v * f).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Are two colours tellable apart by someone with colour-vision deficiency?
 *
 * CVD collapses hue differences, leaving lightness as the reliable channel.
 * Two colours of similar lightness can look identical to a protanope or
 * deuteranope however different their hues are — which matters most for
 * children shown in adjacent columns.
 *
 * 0.04 is the separation the seeded palette was chosen against.
 */
export const MIN_LUMINANCE_GAP = 0.04;

export function luminanceGap(a: string, b: string): number {
  return Math.abs(relativeLuminance(a) - relativeLuminance(b));
}

export function areDistinguishable(a: string, b: string): boolean {
  return luminanceGap(a, b) >= MIN_LUMINANCE_GAP;
}

/**
 * Best available text contrast on this background, whichever of ink or white
 * wins. Below 4.5 means no text will meet WCAG AA on it.
 */
export function bestTextContrast(background: string): number {
  return Math.max(contrastRatio(background, INK), contrastRatio(background, PAPER));
}

/**
 * A deeper version of a colour: same hue and saturation, less lightness.
 *
 * Used for the big numerals, which sit on paper rather than on the child's
 * colour. `darken()` mixes toward black and desaturates, which turns the
 * pastels muddy; dropping lightness in HSL keeps them recognisably the same
 * colour as the child's card.
 */
export function deepen(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const nextL = Math.max(0, Math.min(1, l * (1 - amount)));

  const hue = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = nextL < 0.5 ? nextL * (1 + s) : nextL + s - nextL * s;
  const p = 2 * nextL - q;
  const to = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return s === 0
    ? `#${to(nextL)}${to(nextL)}${to(nextL)}`
    : `#${to(hue(p, q, h + 1 / 3))}${to(hue(p, q, h))}${to(hue(p, q, h - 1 / 3))}`;
}

/**
 * Deepen a colour just far enough to be readable on `background`.
 *
 * A fixed amount cannot work for every colour: the amber child is far lighter
 * than the blue one, so the same reduction leaves it at 2.7:1 on paper while
 * the blue clears 4:1. This walks the lightness down until the target is met,
 * which also means it keeps working for whatever colours the family picks next.
 */
export function deepenUntilReadable(
  hex: string,
  background: string,
  minRatio = 3,
  maxAmount = 0.75,
): string {
  let amount = 0;
  let result = hex;
  while (amount < maxAmount) {
    result = deepen(hex, amount);
    if (contrastRatio(result, background) >= minRatio) return result;
    amount += 0.03;
  }
  return deepen(hex, maxAmount);
}
