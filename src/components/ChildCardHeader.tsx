import { SegmentBar } from './SegmentBar';
import { deepenUntilReadable } from '@/lib/contrast';

/**
 * The header block on every child's card: name, then the count as a large
 * serif numeral with its total, and the percentage on the right.
 *
 * The numeral sits on paper rather than on the child's colour, so its colour is
 * deepened until it is readable there — adaptively, because the amber child is
 * far lighter than the blue one and a fixed amount fails for one of them.
 */
export function ChildCardHeader({
  displayName,
  colour,
  completed,
  total,
  caption,
  nameSize = 27,
  numeralSize = 62,
}: {
  displayName: string;
  colour: string;
  completed: number;
  total: number;
  caption?: string;
  nameSize?: number;
  numeralSize?: number;
}) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const numeralColour = deepenUntilReadable(colour, '#fffdf8');

  return (
    <div>
      <p className="serif font-bold leading-none" style={{ fontSize: nameSize }}>
        {displayName}
      </p>

      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className="serif font-extrabold leading-[0.8] tabular-nums"
          style={{ fontSize: numeralSize, color: numeralColour }}
        >
          {completed}
        </span>
        <span
          className="serif font-semibold text-ink-muted tabular-nums"
          style={{ fontSize: numeralSize * 0.39 }}
        >
          /{total}
        </span>
        <span
          className="serif ml-auto font-bold text-ink-soft tabular-nums"
          style={{ fontSize: numeralSize * 0.48 }}
        >
          {percent}%
        </span>
      </div>

      <div className="mt-2.5">
        <SegmentBar completed={completed} total={total} colour={colour} />
      </div>

      {caption ? (
        <p className="mt-3 border-t-[1.5px] border-line pt-2 text-[12px] font-extrabold uppercase tracking-[0.15em] text-ink-soft">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
