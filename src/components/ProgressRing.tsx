/**
 * "3 of 5" plus a filled ring. Deliberately not a percentage: a four-year-old
 * can count tasks, and 60% means nothing to them.
 */
export function ProgressRing({
  completed,
  total,
  colour,
  size = 96,
}: {
  completed: number;
  total: number;
  colour: string;
  size?: number;
}) {
  const stroke = Math.max(6, Math.round(size * 0.11));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total === 0 ? 0 : completed / total;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${completed} of ${total} done`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={stroke}
          className="opacity-20"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={colour} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 400ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <span
        className="absolute font-extrabold tabular-nums"
        style={{ fontSize: size * 0.28 }}
        aria-hidden
      >
        {completed}/{total}
      </span>
    </div>
  );
}
