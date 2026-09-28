/**
 * One block per job, filled as they are done.
 *
 * Replaces a sliding progress bar because young children cannot read a percentage
 * but can count blocks — and because a row of ruled cells reads as a tally
 * chart, which suits the printed-ledger look. The percentage is shown
 * alongside it for older children who like it.
 */
export function SegmentBar({
  completed,
  total,
  colour,
  height = 13,
}: {
  completed: number;
  total: number;
  colour: string;
  height?: number;
}) {
  // Above roughly twenty jobs the blocks get too thin to read, so fall back
  // to a single continuous bar rather than a row of slivers.
  if (total > 20) {
    const fraction = total === 0 ? 0 : completed / total;
    return (
      <div
        className="w-full overflow-hidden rounded-[2px] border-[1.5px] border-segment-line bg-segment-empty"
        style={{ height }}
        role="img"
        aria-label={`${completed} of ${total} done`}
      >
        <div className="h-full" style={{ width: `${fraction * 100}%`, backgroundColor: colour }} />
      </div>
    );
  }

  return (
    <div className="flex w-full gap-[2px]" role="img" aria-label={`${completed} of ${total} done`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="flex-1 rounded-[2px] border-[1.5px]"
          style={{
            height,
            backgroundColor: i < completed ? colour : 'var(--color-segment-empty)',
            borderColor: i < completed ? 'var(--color-ink)' : 'var(--color-segment-line)',
            transition: 'background-color 220ms ease, border-color 220ms ease',
          }}
        />
      ))}
    </div>
  );
}
