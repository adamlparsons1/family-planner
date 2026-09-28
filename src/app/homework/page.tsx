import Link from 'next/link';
import { requireHousehold } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { addAppDays, getCurrentAppDate } from '@/lib/date';
import { getChildren } from '@/lib/queries/routine';
import { getHomeworkBoard } from '@/lib/homework-store';
import { dueLabel, homeworkWeek, WEEKDAY_NAMES } from '@/lib/homework';
import { HomeworkColumns } from '@/components/HomeworkColumns';
import { KioskRefresh } from '@/components/KioskRefresh';

/**
 * Homework, every child at once. Same shape as the morning and
 * jobs boards: they look at it together, so each has their own column.
 */
export default async function HomeworkPage() {
  await requireHousehold('/homework');

  const settings = await getSettings();
  const today = getCurrentAppDate(new Date(), settings.dayRolloverHour);
  const startDay = settings.homeworkWeekStartDay;
  const { end } = homeworkWeek(today, startDay);
  const children = await getChildren();
  const board = await getHomeworkBoard(children.map((c) => c.id), today, startDay);

  // "Starts again Thursday" is what matters at a glance; the date is for grown-ups.
  const resets = addAppDays(end, 1);
  const subtitle = resets === addAppDays(today, 1)
    ? `New week starts tomorrow`
    : `New week starts ${WEEKDAY_NAMES[startDay]}`;

  return (
    <main className="safe-pad flex min-h-dvh flex-col md:h-dvh">
      <KioskRefresh />
      <header className="relative z-10 mb-5 flex flex-wrap items-baseline justify-between gap-3 px-1">
        <div>
          <h1 className="serif text-[2.1rem] font-bold leading-none">Homework</h1>
          <p className="mt-1.5 text-[13px] font-extrabold uppercase tracking-[0.16em] text-ink-soft">{subtitle}</p>
        </div>
        <nav className="flex gap-2">
          {[
            { href: '/', label: 'Home' },
            { href: '/routine', label: 'Morning' },
            { href: '/chores', label: 'Jobs' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="tap rounded-full border-2 border-ink bg-ground-raised px-5 py-2 text-[0.95rem] font-extrabold shadow-[0_3px_0_rgba(88,66,36,0.28)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      <HomeworkColumns
        children={children.map((c) => ({
          id: c.id,
          displayName: c.displayName,
          colour: c.colour,
          icon: c.icon,
          items: (board.get(c.id) ?? []).map((h) => ({
            id: h.id,
            title: h.title,
            icon: h.icon,
            kind: h.kind,
            unitLabel: h.unitLabel,
            done: h.done,
            target: h.target,
            overdue: h.overdue,
            due: h.dueDate ? dueLabel(h.dueDate, today) : null,
          })),
        }))}
      />
    </main>
  );
}
