import Link from 'next/link';
import { requireHousehold } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { addAppDays, formatFriendlyDate, getCurrentAppDate } from '@/lib/date';
import { getAllChildRoutines, loadNonSchoolDates } from '@/lib/queries/routine';
import { getEventsForDates } from '@/lib/queries/events';
import { ChildCardHeader } from '@/components/ChildCardHeader';
import { getLunchGrid, getMealsForDates } from '@/lib/queries/meals';
import { isSchoolDay } from '@/lib/school';
import { LUNCH_ICONS, LUNCH_LABELS, lunchKey } from '@/lib/lunch';
import { EventChip } from '@/components/EventChip';
import { KioskRefresh } from '@/components/KioskRefresh';
import { countPendingApprovals } from '@/lib/queries/points';

export default async function HomePage() {
  await requireHousehold('/');

  const settings = await getSettings();
  const today = getCurrentAppDate(new Date(), settings.dayRolloverHour);
  const tomorrow = addAppDays(today, 1);

  const [routines, eventsByDate, nonSchool, jobsToCheck] = await Promise.all([
    getAllChildRoutines(today),
    getEventsForDates([today, tomorrow]),
    loadNonSchoolDates([today, tomorrow]),
    countPendingApprovals(),
  ]);

  const schoolDay = (d: string) => isSchoolDay(d, nonSchool);
  const [mealsByDate, lunches] = await Promise.all([
    getMealsForDates([today, tomorrow]),
    getLunchGrid([today], routines.map((r) => r.person.id), schoolDay),
  ]);

  const todayEvents = eventsByDate.get(today) ?? [];
  const tomorrowEvents = eventsByDate.get(tomorrow) ?? [];
  const dinner = mealsByDate.get(today);
  const tomorrowDinner = mealsByDate.get(tomorrow);

  return (
    <main className="flex min-h-dvh flex-col p-5">
      <KioskRefresh />
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="serif text-[2.7rem] font-bold leading-none">{formatFriendlyDate(today)}</h1>
          <p className="mt-1.5 text-[13px] font-extrabold uppercase tracking-[0.16em] text-ink-soft">
            {nonSchool.has(today) ? 'No school today' : 'School day'}
          </p>
        </div>
        <nav className="flex gap-2">
          {[
            { href: '/routine', label: 'Morning' },
            { href: '/week', label: 'This week' },
            { href: '/chores', label: 'Jobs' },
            { href: '/homework', label: 'Homework' },
            // The badge is the reminder to do the evening check, and
            // goes straight to it when there is something waiting.
            { href: jobsToCheck > 0 ? '/admin/chores' : '/admin', label: 'Grown-ups', badge: jobsToCheck },
          ].map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="tap relative rounded-full border-2 border-ink bg-ground-raised px-5 py-2 text-[0.95rem] font-extrabold shadow-[0_3px_0_rgba(88,66,36,0.28)]"
            >
              {l.label}
              {'badge' in l && l.badge ? (
                <span
                  className="absolute -right-2 -top-2 min-w-[1.5rem] rounded-full border-2 border-ink bg-warn px-1.5 text-center text-[0.8rem] leading-[1.3rem] text-ground"
                  aria-label={`${l.badge} job${l.badge === 1 ? '' : 's'} to check`}
                >
                  {l.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </header>

      {/* Today, across the whole family. All-day items first. */}
      {todayEvents.length > 0 ? (
        <section className="mt-4" aria-label="Today">
          <ul className="flex flex-wrap gap-2.5">
            {todayEvents.map((e) => (
              <li key={`${e.eventId}-${e.date}`} className="min-w-[180px] flex-1 sm:max-w-xs">
                <EventChip title={e.title} icon={e.icon} startTime={e.startTime} people={e.people} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-5 grid gap-5 sm:grid-cols-3">
        {routines.map(({ person, stages, total, completed }, i) => {
          const nextUp = stages.flatMap((s) => s.tasks).find((t) => !t.done);
          const lunch = lunches.get(lunchKey(person.id, today));
          const theirEvents = todayEvents.filter((e) => e.people.some((p) => p.id === person.id));
          const tilt = [-1.1, 0.8, -0.6][i % 3];
          return (
            <Link
              key={person.id}
              href="/routine"
              className={`paper taped${i % 2 === 1 ? ' taped-r' : ''} tap block transition-transform active:scale-[0.99]`}
              style={{ transform: `rotate(${tilt}deg)` }}
            >
              <div className="h-[9px] rounded-t-[3px]" style={{ backgroundColor: person.colour }} />
              <div className="px-4 pb-4 pt-4">
                <ChildCardHeader
                  displayName={person.displayName}
                  colour={person.colour}
                  completed={completed}
                  total={total}
                  nameSize={29}
                  numeralSize={66}
                />

                <div className="mt-3 flex items-end justify-between gap-3 border-t-[1.5px] border-line pt-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-muted">
                      {total === 0 ? 'Today' : completed === total ? 'Morning' : 'Next'}
                    </p>
                    <p className="truncate text-[1.05rem] font-extrabold">
                      {total === 0 ? (
                        'Nothing to do'
                      ) : completed === total ? (
                        'All done!'
                      ) : (
                        <>
                          <span aria-hidden className="mr-2">{nextUp?.icon}</span>
                          {nextUp?.title}
                        </>
                      )}
                    </p>
                  </div>
                  {lunch && lunch.choice !== 'none' ? (
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-muted">
                        Lunch
                      </p>
                      <p className="text-[1.3rem] leading-tight" title={LUNCH_LABELS[lunch.choice]}>
                        <span aria-hidden>{LUNCH_ICONS[lunch.choice]}</span>
                        <span className="sr-only">{LUNCH_LABELS[lunch.choice]}</span>
                      </p>
                      {lunch.dish ? (
                        <p className="max-w-[9rem] text-[0.8rem] font-semibold leading-tight text-ink-soft">
                          {lunch.dish}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {theirEvents.length > 0 ? (
                  <ul className="mt-2.5 space-y-1">
                    {theirEvents.map((e) => (
                      <li
                        key={`${e.eventId}-${e.date}`}
                        className="rounded-[6px] border-[1.5px] border-dashed border-line-strong bg-ground-sunken px-2 py-1 text-[0.85rem] font-extrabold"
                      >
                        <span aria-hidden className="mr-1">{e.icon}</span>
                        {e.title}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Link>
          );
        })}
      </section>

      <section className="mt-5 grid flex-1 gap-5 sm:grid-cols-[1.4fr_1fr]">
        {/* Tonight's dinner. One prominent card. */}
        <div
          className="paper taped flex flex-col justify-center px-6 py-5"
          style={{ transform: 'rotate(0.5deg)' }}
          aria-label="Tonight's dinner"
        >
          <p className="text-[12px] font-extrabold uppercase tracking-[0.17em] text-ink-muted">
            Tonight&rsquo;s dinner
          </p>
          {dinner ? (
            <p className="mt-1 flex items-center gap-4">
              <span className="text-[2.8rem] leading-none" aria-hidden>{dinner.icon}</span>
              <span className="serif text-[2.5rem] font-bold leading-tight">{dinner.title}</span>
            </p>
          ) : (
            <p className="serif mt-1 text-[1.8rem] font-bold text-ink-soft">Not planned yet</p>
          )}
        </div>

        {/* Tomorrow. The horizon that matters at 4-7. */}
        <div className="paper taped taped-r px-5 py-4" style={{ transform: 'rotate(-0.7deg)' }} aria-label="Tomorrow">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.17em] text-ink-muted">
            Tomorrow{nonSchool.has(tomorrow) ? ' — no school' : ''}
          </p>
          {tomorrowDinner ? (
            <p className="mt-1.5 text-[1rem] font-extrabold">
              <span aria-hidden className="mr-1">{tomorrowDinner.icon}</span>
              {tomorrowDinner.title}
            </p>
          ) : null}
          {tomorrowEvents.length === 0 ? (
            <p className="mt-1.5 text-[1rem] text-ink-soft">Nothing else planned yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {tomorrowEvents.slice(0, 3).map((e) => (
                <li key={`${e.eventId}-${e.date}`} className="flex items-center gap-2.5">
                  <span
                    className="h-8 w-[9px] shrink-0 rounded-[2px] border-[1.5px] border-ink"
                    style={{ backgroundColor: e.people[0]?.colour ?? '#dfe6ea' }}
                  />
                  <span className="min-w-0">
                    <span className="serif block truncate text-[1.05rem] font-bold leading-tight">
                      {e.title}
                    </span>
                    <span className="block text-[0.85rem] font-bold text-ink-soft">
                      {e.people.map((p) => p.displayName).join(', ') || 'Everyone'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
