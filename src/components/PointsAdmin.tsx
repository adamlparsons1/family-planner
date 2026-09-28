'use client';

import { useActionState } from 'react';
import { adjustPoints } from '@/lib/actions/chores';
import { Notice } from './Notice';

type Person = { id: number; displayName: string; colour: string; icon: string };
type Entry = { id: number; delta: number; reason: string; sourceType: string; createdAt: string };

const initial = { error: null as string | null };

export function PointsAdmin({
  people, balances, ledgers,
}: {
  people: Person[];
  balances: Record<number, number>;
  ledgers: Record<number, Entry[]>;
}) {
  const [state, formAction, pending] = useActionState(adjustPoints, initial);

  return (
    <div className="space-y-8">
      <section className="rounded-tile border-2 border-line bg-ground-raised p-4">
        <h2 className="mb-3 text-[1.25rem] font-extrabold">Adjust points by hand</h2>
        <form action={formAction} className="space-y-3">
          <label className="block">
            <span className="block text-[0.95rem] font-semibold">Who</span>
            <select name="personId" required
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]">
              {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[0.95rem] font-semibold">
              Stars <span className="font-normal text-ink-soft">— negative to take away</span>
            </span>
            <input type="number" name="delta" required placeholder="5"
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
          </label>
          <label className="block">
            <span className="block text-[0.95rem] font-semibold">Reason <span className="font-normal text-ink-soft">— required</span></span>
            <input name="reason" required maxLength={120} placeholder="Helped without being asked"
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
          </label>
          <Notice error={state.error} ok={'ok' in state ? (state.ok as string) : undefined} />
          <button type="submit" disabled={pending}
            className="rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60">
            {pending ? 'Recording…' : 'Record'}
          </button>
        </form>
      </section>

      {people.map((p) => (
        <section key={p.id}>
          <h2 className="mb-2 text-[1.25rem] font-extrabold">
            <span aria-hidden className="mr-2">{p.icon}</span>
            {p.displayName} — {balances[p.id] ?? 0} ★
          </h2>
          {(ledgers[p.id] ?? []).length === 0 ? (
            <p className="text-[0.95rem] text-ink-soft">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-1">
              {(ledgers[p.id] ?? []).map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 rounded-lg bg-ground-raised px-3 py-2">
                  <span className="w-14 shrink-0 text-right text-[1.05rem] font-extrabold tabular-nums"
                    style={{ color: e.delta < 0 ? 'var(--color-warn)' : 'var(--color-affirm)' }}>
                    {e.delta > 0 ? '+' : ''}{e.delta}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[1rem]">{e.reason}</span>
                  <span className="shrink-0 text-[0.8rem] text-ink-soft">{e.sourceType}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
