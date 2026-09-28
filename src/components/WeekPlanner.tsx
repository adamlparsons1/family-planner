'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { setLunchChoice, setLunchDefault, setLunchDish, setMeal } from '@/lib/actions/planner';
import { LUNCH_ICONS, LUNCH_LABELS, lunchKey, type LunchChoice } from '@/lib/lunch';

type Person = {
  id: number; displayName: string; colour: string; icon: string;
  /** Their morning card shows lunch, so they get a school dinner menu box here. */
  showLunchOnCard?: boolean;
};
type Day = {
  date: string;
  label: string;
  isSchoolDay: boolean;
  isToday: boolean;
  meal: { title: string; icon: string } | null;
  lunches: Record<number, { choice: LunchChoice; isOverride: boolean; isUnset: boolean; dish?: string | null }>;
};

const CYCLE: LunchChoice[] = ['school', 'packed', 'none'];

/**
 * The Sunday-evening ritual on one page: set the week's dinners and confirm
 * each child's lunch. Built as one screen rather than five separate forms,
 * because that is how the job is actually done.
 */
export function WeekPlanner({
  days: initialDays,
  people,
  weekLabel,
  defaults,
}: {
  days: Day[];
  people: Person[];
  weekLabel: string;
  defaults: { personId: number; dayOfWeek: number; choice: LunchChoice }[];
}) {
  const [, startTransition] = useTransition();
  const [showDefaults, setShowDefaults] = useState(false);

  const [days, applyLunch] = useOptimistic(
    initialDays,
    (current: Day[], u: { date: string; personId: number; choice: LunchChoice }) =>
      current.map((d) =>
        d.date === u.date
          ? {
              ...d,
              lunches: {
                ...d.lunches,
                // Moving off school dinner clears the dish on the server too.
                [u.personId]: {
                  choice: u.choice, isOverride: true, isUnset: false,
                  dish: u.choice === 'school' ? d.lunches[u.personId]?.dish ?? null : null,
                },
              },
            }
          : d,
      ),
  );

  function cycleLunch(day: Day, person: Person) {
    const currentChoice = day.lunches[person.id]?.choice ?? 'none';
    const next = CYCLE[(CYCLE.indexOf(currentChoice) + 1) % CYCLE.length];
    startTransition(async () => {
      applyLunch({ date: day.date, personId: person.id, choice: next });
      await setLunchChoice({ personId: person.id, date: day.date, choice: next });
    });
  }

  return (
    <div>
      <h2 className="mb-1 text-[1.3rem] font-extrabold">{weekLabel}</h2>
      <p className="mb-5 text-[0.95rem] text-ink-soft">
        Tap a lunch to change it: school dinner → packed lunch → at home. For a
        child whose morning card shows lunch, add what the school dinner is.
        That is what they will see that morning.
      </p>

      <ul className="space-y-3">
        {days.map((day) => (
          <li
            key={day.date}
            className="rounded-tile border-2 p-4"
            style={{
              borderColor: day.isToday ? 'var(--color-ink)' : 'var(--color-line)',
              backgroundColor: day.isSchoolDay ? 'var(--color-ground-raised)' : 'transparent',
            }}
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-[1.15rem] font-extrabold">
                {day.label}
                {day.isToday ? <span className="ml-2 text-[0.85rem] font-bold text-ink-soft">TODAY</span> : null}
              </p>
              {!day.isSchoolDay ? (
                <span className="text-[0.85rem] font-semibold text-ink-soft">No school</span>
              ) : null}
            </div>

            <MealField date={day.date} meal={day.meal} />

            {day.isSchoolDay ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {people.map((p) => {
                  const lunch = day.lunches[p.id] ?? { choice: 'none' as LunchChoice, isOverride: false, isUnset: true };
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => cycleLunch(day, p)}
                      className="tap flex items-center gap-2 rounded-full border-4 px-4 py-2 text-[0.95rem] font-bold"
                      style={{
                        borderColor: p.colour,
                        // A solid fill marks an explicit choice for this date;
                        // an outline means it came from the standing pattern.
                        backgroundColor: lunch.isOverride ? p.colour : 'transparent',
                        opacity: lunch.isUnset ? 0.55 : 1,
                      }}
                      aria-label={`${p.displayName}: ${lunch.isUnset ? 'not set' : LUNCH_LABELS[lunch.choice]}`}
                    >
                      <span aria-hidden>{p.icon}</span>
                      <span aria-hidden className="text-[1.1rem]">
                        {lunch.isUnset ? '?' : LUNCH_ICONS[lunch.choice]}
                      </span>
                      <span>{lunch.isUnset ? 'Not set' : LUNCH_LABELS[lunch.choice]}</span>
                      {lunch.choice === 'school' && lunch.dish ? (
                        <span className="font-semibold opacity-80">· {lunch.dish}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {day.isSchoolDay
              ? people
                  .filter((p) => p.showLunchOnCard && day.lunches[p.id]?.choice === 'school')
                  .map((p) => (
                    <DishField
                      key={`${day.date}-${p.id}`}
                      date={day.date}
                      person={p}
                      dish={day.lunches[p.id]?.dish ?? null}
                    />
                  ))
              : null}
          </li>
        ))}
      </ul>

      <section className="mt-8">
        <button
          type="button"
          onClick={() => setShowDefaults((v) => !v)}
          className="tap rounded-full border-2 border-line px-6 py-3 font-semibold"
        >
          {showDefaults ? 'Hide' : 'Set'} the usual pattern
        </button>
        {showDefaults ? (
          <DefaultsGrid people={people} defaults={defaults} />
        ) : (
          <p className="mt-2 text-[0.9rem] text-ink-soft">
            Optional. A usual pattern pre-fills each week so you only change the exceptions.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * What the school dinner is, for one child on one day. Saves on blur like
 * the evening meal. Typing here also confirms school dinner that day.
 */
function DishField({ date, person, dish }: { date: string; person: Person; dish: string | null }) {
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(dish ?? '');
  const [status, setStatus] = useState<string>('');

  function save() {
    if (value.trim() === (dish ?? '')) return;
    setStatus('Saving');
    startTransition(async () => {
      const result = await setLunchDish({ personId: person.id, date, dish: value });
      setStatus(result.ok ? 'Saved' : result.error);
      if (result.ok) setTimeout(() => setStatus(''), 1200);
    });
  }

  return (
    <label className="mt-3 flex items-center gap-2">
      <span className="flex w-28 shrink-0 items-center gap-1.5 text-[0.9rem] font-bold">
        <span aria-hidden>{person.icon}</span>
        <span>{person.displayName}&rsquo;s school dinner</span>
      </span>
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); setStatus(''); }}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        placeholder="e.g. Fish fingers and chips"
        maxLength={80}
        className="flex-1 rounded-xl border-2 border-line bg-ground px-4 py-2.5 text-[1rem]"
      />
      <span className="w-16 text-[0.85rem] font-semibold text-ink-soft" aria-live="polite">{status}</span>
    </label>
  );
}

function MealField({ date, meal }: { date: string; meal: { title: string; icon: string } | null }) {
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(meal?.title ?? '');
  const [icon, setIcon] = useState(meal?.icon ?? '🍽️');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done'>('idle');

  function save(nextTitle: string, nextIcon: string) {
    setSaved('saving');
    startTransition(async () => {
      await setMeal({ date, title: nextTitle, icon: nextIcon });
      setSaved('done');
      setTimeout(() => setSaved('idle'), 1200);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
        onBlur={() => save(title, icon)}
        aria-label={`Dinner icon for ${date}`}
        maxLength={16}
        className="w-16 rounded-xl border-2 border-line bg-ground px-2 py-3 text-center text-[1.4rem]"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => save(title, icon)}
        placeholder="What's for dinner?"
        aria-label={`Dinner for ${date}`}
        maxLength={80}
        className="flex-1 rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]"
      />
      <span className="w-16 text-[0.85rem] font-semibold text-ink-soft" aria-live="polite">
        {saved === 'saving' ? 'Saving' : saved === 'done' ? 'Saved' : ''}
      </span>
    </div>
  );
}

function DefaultsGrid({
  people,
  defaults,
}: {
  people: Person[];
  defaults: { personId: number; dayOfWeek: number; choice: LunchChoice }[];
}) {
  const [, startTransition] = useTransition();
  const [grid, setGrid] = useState(() => {
    const m = new Map<string, LunchChoice>();
    for (const d of defaults) m.set(`${d.personId}:${d.dayOfWeek}`, d.choice);
    return m;
  });

  const weekdays = [
    { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' },
  ];

  function cycle(personId: number, dayOfWeek: number) {
    const key = `${personId}:${dayOfWeek}`;
    const current = grid.get(key);
    const next: LunchChoice | 'clear' =
      current === undefined ? 'school' : current === 'school' ? 'packed' : current === 'packed' ? 'none' : 'clear';

    const updated = new Map(grid);
    if (next === 'clear') updated.delete(key);
    else updated.set(key, next);
    setGrid(updated);

    startTransition(async () => {
      await setLunchDefault({ personId, dayOfWeek, choice: next });
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {people.map((p) => (
        <div key={p.id}>
          <p className="mb-2 text-[1.05rem] font-bold">
            <span aria-hidden className="mr-2">{p.icon}</span>{p.displayName}
          </p>
          <div className="flex flex-wrap gap-2">
            {weekdays.map((d) => {
              const choice = grid.get(`${p.id}:${d.value}`);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => cycle(p.id, d.value)}
                  className="tap flex min-w-[92px] flex-col items-center gap-1 rounded-xl border-4 px-3 py-2 font-bold"
                  style={{
                    borderColor: p.colour,
                    backgroundColor: choice ? p.colour : 'transparent',
                    opacity: choice ? 1 : 0.55,
                  }}
                  aria-label={`${p.displayName} ${d.label}: ${choice ? LUNCH_LABELS[choice] : 'not set'}`}
                >
                  <span className="text-[0.85rem]">{d.label}</span>
                  <span className="text-[1.3rem]" aria-hidden>{choice ? LUNCH_ICONS[choice] : '—'}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[0.9rem] text-ink-soft">
        Tap to cycle: school dinner → packed lunch → at home → not set.
      </p>
    </div>
  );
}
