import { describe, expect, it } from 'vitest';
import {
  MIN_LUMINANCE_GAP, areDistinguishable, bestTextContrast, contrastRatio, darken,
  deepen, deepenUntilReadable, luminanceGap, meetsAA, parseHex, readableTextOn,
  relativeLuminance,
} from './contrast';
import { EXAMPLE_FAMILY as FAMILY } from './family';

const INK = '#2b2620';
const WHITE = '#ffffff';
const GROUND = '#faf6f0';

describe('contrastRatio', () => {
  it('is 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('is 1:1 for a colour against itself', () => {
    expect(contrastRatio('#0072B2', '#0072B2')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#0072B2', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#0072B2'), 5);
  });

  it('accepts shorthand hex', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 5);
  });

  it('rejects nonsense', () => {
    expect(() => relativeLuminance('not-a-colour')).toThrow();
  });
});

describe('every child colour is legible in the ways the app actually uses it', () => {
  for (const child of FAMILY.children) {
    describe(`${child.name} (${child.colour})`, () => {
      it('has a chosen text colour that meets AA for large text on their tile', () => {
        const text = readableTextOn(child.colour);
        expect(meetsAA(text, child.colour, true)).toBe(true);
      });

      it('meets AA for normal text too, so the tile can carry small labels', () => {
        const text = readableTextOn(child.colour);
        expect(meetsAA(text, child.colour, false)).toBe(true);
      });

      it('gets an edge that separates the tile from the page background', () => {
        // The pastel fills sit close to the warm ground (the amber is only
        // 1.33:1 against it), so the tile relies on its derived border to read
        // as a block at all. That border must contrast with BOTH.
        const border = darken(child.colour, 0.22);
        expect(contrastRatio(border, GROUND)).toBeGreaterThanOrEqual(1.9);
        expect(contrastRatio(border, child.colour)).toBeGreaterThanOrEqual(1.4);
      });

      it('uses near-black text, never white', () => {
        expect(readableTextOn(child.colour)).toBe(INK);
      });
    });
  }

  it('still picks white when a background is genuinely dark', () => {
    // The helper is not hardcoded to ink - it would flip if a dark colour were
    // ever chosen for a child.
    expect(readableTextOn('#0072B2')).toBe(WHITE);
    expect(readableTextOn('#1a1a2e')).toBe(WHITE);
    expect(readableTextOn('#E69F00')).toBe(INK);
  });

  it('would have caught the bug: white on amber fails AA even for large text', () => {
    expect(meetsAA(WHITE, '#E69F00', true)).toBe(false);
  });

  it('white on pink only scrapes large-text AA and fails for normal text', () => {
    // 3.06:1 - technically passing for a big bold name, but not for anything
    // smaller, which is why readableTextOn picks ink here instead.
    expect(contrastRatio(WHITE, '#CC79A7')).toBeLessThan(3.2);
    expect(meetsAA(WHITE, '#CC79A7', false)).toBe(false);
    expect(readableTextOn('#CC79A7')).toBe(INK);
  });

  it('the example child colours are mutually distinguishable by luminance as well as hue', () => {
    // Colour-vision deficiency collapses hue differences; luminance must also differ,
    // so the columns stay tellable apart for a protanope or deuteranope.
    const lums = FAMILY.children.map((c) => relativeLuminance(c.colour)).sort((a, b) => a - b);
    for (let i = 1; i < lums.length; i++) {
      expect(lums[i] - lums[i - 1]).toBeGreaterThan(0.04);
    }
  });
});

describe('darken', () => {
  it('moves a colour toward black without changing its hue family', () => {
    expect(darken('#ffffff', 0)).toBe('#ffffff');
    expect(darken('#ffffff', 1)).toBe('#000000');
    expect(relativeLuminance(darken('#7FB3DA', 0.22))).toBeLessThan(relativeLuminance('#7FB3DA'));
  });

  it('clamps out-of-range amounts rather than producing nonsense', () => {
    expect(darken('#7FB3DA', 2)).toBe('#000000');
    expect(darken('#7FB3DA', -1)).toBe('#7fb3da');
  });
});

describe('colour-vision separation between children', () => {
  it('accepts the seeded palette', () => {
    const colours = FAMILY.children.map((c) => c.colour);
    for (let i = 0; i < colours.length; i++) {
      for (let j = i + 1; j < colours.length; j++) {
        expect(areDistinguishable(colours[i], colours[j]), `${colours[i]} vs ${colours[j]}`).toBe(true);
      }
    }
  });

  it('rejects two colours of near-identical lightness, however different the hue', () => {
    // A blue and a pink that look quite different to most people and nearly
    // identical to a deuteranope.
    expect(areDistinguishable('#8FBFE0', '#E9A6C6')).toBe(false);
    expect(luminanceGap('#8FBFE0', '#E9A6C6')).toBeLessThan(MIN_LUMINANCE_GAP);
  });

  it('accepts the same hue at clearly different lightness', () => {
    expect(areDistinguishable('#7FB3DA', '#D6E9F7')).toBe(true);
  });

  it('is symmetric and zero against itself', () => {
    expect(luminanceGap('#7FB3DA', '#7FB3DA')).toBe(0);
    expect(luminanceGap('#7FB3DA', '#F5D492')).toBeCloseTo(luminanceGap('#F5D492', '#7FB3DA'), 6);
  });
});

describe('bestTextContrast', () => {
  it('is high for both very light and very dark backgrounds', () => {
    expect(bestTextContrast('#ffffff')).toBeGreaterThan(10);
    expect(bestTextContrast('#000000')).toBeGreaterThan(10);
  });

  it('is low for a mid-grey, where neither ink nor white reaches AA', () => {
    expect(bestTextContrast('#7a7a7a')).toBeLessThan(4.5);
  });

  it('clears AA for every seeded child colour', () => {
    for (const child of FAMILY.children) {
      expect(bestTextContrast(child.colour)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('deepen', () => {
  const PAPER_CARD = '#fffdf8';

  it('keeps the hue family while reducing lightness', () => {
    for (const child of FAMILY.children) {
      const deep = deepen(child.colour, 0.42);
      expect(relativeLuminance(deep)).toBeLessThan(relativeLuminance(child.colour));
    }
  });

  it('produces numerals that are readable on the paper card', () => {
    // The big count sits on paper, not on the child's colour, so it has to
    // clear AA for large text there. A FIXED deepening cannot do this for all
    // three - the amber child is much lighter than the blue one - so the
    // adaptive helper is what the app actually uses.
    for (const child of FAMILY.children) {
      expect(
        contrastRatio(deepenUntilReadable(child.colour, PAPER_CARD), PAPER_CARD),
        `${child.name} numeral`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('deepens the light amber further than the darker blue', () => {
    const blue = deepenUntilReadable('#7FB3DA', PAPER_CARD);
    const amber = deepenUntilReadable('#F5D492', PAPER_CARD);
    const drop = (from: string, to: string) => relativeLuminance(from) - relativeLuminance(to);
    expect(drop('#F5D492', amber)).toBeGreaterThan(drop('#7FB3DA', blue));
  });

  it('still reads as the same colour as the child\'s card', () => {
    const deep = deepenUntilReadable('#7FB3DA', PAPER_CARD);
    const [r, g, b] = parseHex(deep);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it('does not desaturate the way darken does', () => {
    // darken() mixes toward black and dulls the hue; deepen keeps it.
    const source = '#7FB3DA';
    const deep = deepen(source, 0.42);
    const [dr, dg, db] = parseHex(deep);
    // Blue still clearly dominant.
    expect(db).toBeGreaterThan(dr);
    expect(db).toBeGreaterThan(dg);
  });

  it('clamps and handles greys without dividing by zero', () => {
    expect(deepen('#808080', 0)).toBe('#808080');
    expect(deepen('#7FB3DA', 1)).toBe('#000000');
  });
});
