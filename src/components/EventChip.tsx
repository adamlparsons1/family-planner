import { formatTime } from '@/lib/date';
import { readableTextOn } from '@/lib/contrast';

type Person = { id: number; displayName: string; colour: string; icon: string };

/**
 * One event. Colour comes from the people it belongs to; an event with nobody
 * attached is a family event and takes a neutral colour.
 *
 * Colour is never the only channel: the person's icon rides along with it, and
 * the time is always written out.
 */
export function EventChip({
  title,
  icon,
  startTime,
  people,
  compact = false,
}: {
  title: string;
  icon: string;
  startTime: string | null;
  people: Person[];
  compact?: boolean;
}) {
  const isFamily = people.length === 0;
  const background = isFamily ? '#dfe6ea' : people[0].colour;
  const colour = readableTextOn(background);
  const time = formatTime(startTime);

  return (
    <div
      className={`rounded-xl ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}
      style={{ backgroundColor: background, color: colour }}
    >
      <div className="flex items-start gap-1.5">
        <span className={compact ? 'text-[1rem]' : 'text-[1.25rem]'} aria-hidden>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className={`font-bold leading-tight ${compact ? 'text-[0.8rem]' : 'text-[1rem]'}`}>
            {title}
          </p>
          <p className={`leading-tight opacity-80 ${compact ? 'text-[0.7rem]' : 'text-[0.85rem]'}`}>
            {time ?? 'All day'}
            {isFamily ? ' · Everyone' : ''}
          </p>
        </div>
        {/* Whose it is, by icon as well as by colour. */}
        {people.length > 0 ? (
          <span className={compact ? 'text-[0.8rem]' : 'text-[1rem]'} aria-hidden>
            {people.map((p) => p.icon).join('')}
          </span>
        ) : null}
      </div>
      <span className="sr-only">
        {isFamily ? 'Everyone' : people.map((p) => p.displayName).join(', ')}
      </span>
    </div>
  );
}
