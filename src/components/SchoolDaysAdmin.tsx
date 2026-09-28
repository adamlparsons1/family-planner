'use client';

import { useActionState, useTransition } from 'react';
import { addNonSchoolRange, removeNonSchoolDay, type ActionState } from '@/lib/actions/admin-routine';
import { Notice } from './Notice';

type Day = { date: string; reason: string; label: string | null };

const initial: ActionState = { error: null };

export function SchoolDaysAdmin({ upcoming, today }: { upcoming: Day[]; today: string }) {
  const [state, formAction, pending] = useActionState(addNonSchoolRange, initial);
  const [, startTransition] = useTransition();

  // Consecutive days sharing a label are one period, shown as one row.
  const periods: { from: string; to: string; reason: string; label: string | null; dates: string[] }[] = [];
  for (const day of upcoming) {
    const last = periods.at(-1);
    if (last && last.label === day.label && last.reason === day.reason) {
      last.to = day.date;
      last.dates.push(day.date);
    } else {
      periods.push({ from: day.date, to: day.date, reason: day.reason, label: day.label, dates: [day.date] });
    }
  }

  return (
    <div>
      <section className="mb-8 rounded-tile border-2 border-dashed border-line p-4">
        <h2 className="mb-1 text-[1.25rem] font-extrabold">Add holidays or INSET days</h2>
        <p className="mb-3 text-[0.95rem] text-ink-soft">
          Weekends are worked out automatically, so you only need term-time dates.
        </p>
        <form action={formAction} className="space-y-3">
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-[0.95rem] font-semibold">From</span>
              <input type="date" name="from" defaultValue={today} required
                className="mt-1 w-full rounded-xl border-2 border-line bg-ground-raised px-4 py-3 text-[1.05rem]" />
            </label>
            <label className="flex-1">
              <span className="block text-[0.95rem] font-semibold">To</span>
              <input type="date" name="to" defaultValue={today} required
                className="mt-1 w-full rounded-xl border-2 border-line bg-ground-raised px-4 py-3 text-[1.05rem]" />
            </label>
          </div>
          <div className="flex gap-3">
            <label className="w-40">
              <span className="block text-[0.95rem] font-semibold">Type</span>
              <select name="reason" className="mt-1 w-full rounded-xl border-2 border-line bg-ground-raised px-4 py-3 text-[1.05rem]">
                <option value="holiday">Holiday</option>
                <option value="inset">INSET day</option>
                <option value="sick">Off sick</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="flex-1">
              <span className="block text-[0.95rem] font-semibold">Label (optional)</span>
              <input name="label" maxLength={60} placeholder="October half term"
                className="mt-1 w-full rounded-xl border-2 border-line bg-ground-raised px-4 py-3 text-[1.05rem]" />
            </label>
          </div>
          <Notice error={state.error} ok={state.ok} />
          <button type="submit" disabled={pending} className="rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60">
            {pending ? 'Adding…' : 'Add'}
          </button>
        </form>
      </section>

      <h2 className="mb-3 text-[1.25rem] font-extrabold">Coming up</h2>
      {periods.length === 0 ? (
        <p className="text-[1rem] text-ink-soft">
          No non-school days recorded from today onwards. Add the school&rsquo;s term dates above.
        </p>
      ) : (
        <ul className="space-y-2">
          {periods.map((p) => (
            <li key={p.from} className="flex items-center gap-3 rounded-tile border-2 border-line bg-ground-raised p-3">
              <div className="min-w-0 flex-1">
                <p className="text-[1.1rem] font-bold">
                  {p.label ?? p.reason}
                  {p.reason === 'inset' ? <span className="ml-2 text-[0.85rem] font-semibold text-ink-soft">INSET</span> : null}
                </p>
                <p className="text-[0.9rem] text-ink-soft">
                  {p.from === p.to ? p.from : `${p.from} to ${p.to}`}
                  {' · '}{p.dates.length} school day{p.dates.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startTransition(() => { p.dates.forEach((d) => void removeNonSchoolDay(d)); })}
                className="shrink-0 rounded-full border-2 border-line px-4 py-2 font-semibold"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
