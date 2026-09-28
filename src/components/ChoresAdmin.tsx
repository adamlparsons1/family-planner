'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  createChore, createReward, setChoreActive, setRewardActive, updateChore, updateReward,
  type ActionState,
} from '@/lib/actions/admin-chores';
import { approveAllChores, approveChore, rejectChore } from '@/lib/actions/chores';
import { Notice } from './Notice';

type Person = { id: number; displayName: string; colour: string; icon: string };
type Chore = {
  id: number; title: string; icon: string; points: number; personId: number | null;
  daysOfWeek: number[] | null; requiresApproval: boolean; onePerDay: boolean; isActive: boolean;
};
type Reward = { id: number; title: string; icon: string; costPoints: number; personId: number | null; isActive: boolean };
type Pending = {
  id: number; choreTitle: string; pointsAwarded: number; date: string;
  personId: number; personName: string; personIcon: string;
};

const initial: ActionState = { error: null };
const DAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export function ChoresAdmin({
  chores, rewards, people, pending,
}: {
  chores: Chore[]; rewards: Reward[]; people: Person[]; pending: Pending[];
}) {
  const [, startTransition] = useTransition();
  const [addingChore, setAddingChore] = useState(false);
  const [addingReward, setAddingReward] = useState(false);

  return (
    <div className="space-y-10">
      {pending.length > 0 ? <PendingChecks pending={pending} /> : null}

      <section>
        <h2 className="mb-3 text-[1.25rem] font-extrabold">Jobs</h2>
        {addingChore ? (
          <ChoreForm people={people} onDone={() => setAddingChore(false)} />
        ) : (
          <button type="button" onClick={() => setAddingChore(true)}
            className="tap mb-4 w-full rounded-tile border-2 border-dashed border-line px-6 py-4 font-bold">
            + Add a job
          </button>
        )}
        <ul className="space-y-2">
          {chores.map((c) => (
            <ChoreRow key={c.id} chore={c} people={people} />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 text-[1.25rem] font-extrabold">Rewards</h2>
        <p className="mb-3 text-[0.9rem] text-ink-soft">
          These prices are a placeholder. Agree them with your children — the system fails on
          motivation long before it fails on code.
        </p>
        {addingReward ? (
          <RewardForm people={people} onDone={() => setAddingReward(false)} />
        ) : (
          <button type="button" onClick={() => setAddingReward(true)}
            className="tap mb-4 w-full rounded-tile border-2 border-dashed border-line px-6 py-4 font-bold">
            + Add a reward
          </button>
        )}
        <ul className="space-y-2">
          {rewards.map((r) => (
            <RewardRow key={r.id} reward={r} people={people} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ChoreRow({ chore, people }: { chore: Chore; people: Person[] }) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  if (editing) return <li><ChoreForm chore={chore} people={people} onDone={() => setEditing(false)} /></li>;

  const owner = chore.personId ? people.find((p) => p.id === chore.personId) : null;
  return (
    <li className="flex items-center gap-3 rounded-tile border-2 border-line bg-ground-raised p-3"
      style={{ opacity: chore.isActive ? 1 : 0.5 }}>
      <span className="text-[1.8rem] leading-none" aria-hidden>{chore.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.1rem] font-bold">{chore.title}</p>
        <p className="text-[0.9rem] text-ink-soft">
          {chore.points} ★ · {owner ? `${owner.icon} ${owner.displayName}` : 'Anyone'}
          {chore.daysOfWeek ? ` · ${DAYS.filter((d) => chore.daysOfWeek!.includes(d.value)).map((d) => d.label).join(', ')}` : ''}
          {chore.requiresApproval ? ' · needs approval' : ''}
          {chore.personId === null && chore.onePerDay ? ' · one child a day' : ''}
          {chore.isActive ? '' : ' · retired'}
        </p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="rounded-full border-2 border-line px-4 py-2 font-semibold">Edit</button>
      <button type="button"
        onClick={() => startTransition(() => { void setChoreActive(chore.id, !chore.isActive); })}
        className="rounded-full border-2 border-line px-4 py-2 font-semibold">
        {chore.isActive ? 'Retire' : 'Restore'}
      </button>
    </li>
  );
}

function ChoreForm({ chore, people, onDone }: { chore?: Chore; people: Person[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(chore ? updateChore : createChore, initial);
  return (
    <section className="mb-4 rounded-tile border-2 border-line bg-ground-raised p-4">
      <form action={formAction} className="space-y-3">
        {chore ? <input type="hidden" name="id" value={chore.id} /> : null}
        <div className="flex gap-3">
          <label className="w-20">
            <span className="block text-[0.95rem] font-semibold">Icon</span>
            <input name="icon" defaultValue={chore?.icon ?? '⭐'} required maxLength={16}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-2 py-3 text-center text-[1.5rem]" />
          </label>
          <label className="flex-1">
            <span className="block text-[0.95rem] font-semibold">Job</span>
            <input name="title" defaultValue={chore?.title} required maxLength={60}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
          </label>
          <label className="w-24">
            <span className="block text-[0.95rem] font-semibold">Stars</span>
            <input type="number" name="points" defaultValue={chore?.points ?? 1} min={0} max={100}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-3 py-3 text-center text-[1.05rem]" />
          </label>
        </div>
        <label className="block">
          <span className="block text-[0.95rem] font-semibold">Who</span>
          <select name="personId" defaultValue={chore?.personId ?? ''}
            className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]">
            <option value="">Anyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="text-[0.95rem] font-semibold">Days <span className="font-normal text-ink-soft">— none selected means every day</span></legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <label key={d.value} className="cursor-pointer">
                <input type="checkbox" name="daysOfWeek" value={d.value}
                  defaultChecked={chore?.daysOfWeek?.includes(d.value) ?? false} className="peer sr-only" />
                <span className="tap inline-flex rounded-full border-2 border-line px-4 py-2 font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-ground">
                  {d.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="requiresApproval" defaultChecked={chore?.requiresApproval ?? true} className="h-6 w-6" />
          <span className="text-[1rem] font-semibold">
            Needs a grown-up to approve
            <span className="block text-[0.85rem] font-normal text-ink-soft">
              On by default: stars wait until you approve them. Turn off for a job you always see done.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="onePerDay" defaultChecked={chore?.onePerDay ?? false} className="h-6 w-6" />
          <span className="text-[1rem] font-semibold">
            Only one child can do this each day
            <span className="block text-[0.85rem] font-normal text-ink-soft">
              For a job that is done once for the whole house, like feeding the pet. Only applies when Who is Anyone.
            </span>
          </span>
        </label>
        <Notice error={state.error} ok={state.ok} />
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60">
            {pending ? 'Saving…' : chore ? 'Save' : 'Add job'}
          </button>
          <button type="button" onClick={onDone} className="rounded-full border-2 border-line px-6 py-3 font-semibold">
            {state.ok ? 'Done' : 'Cancel'}
          </button>
        </div>
      </form>
    </section>
  );
}

function RewardRow({ reward, people }: { reward: Reward; people: Person[] }) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  if (editing) return <li><RewardForm reward={reward} people={people} onDone={() => setEditing(false)} /></li>;

  const owner = reward.personId ? people.find((p) => p.id === reward.personId) : null;
  return (
    <li className="flex items-center gap-3 rounded-tile border-2 border-line bg-ground-raised p-3"
      style={{ opacity: reward.isActive ? 1 : 0.5 }}>
      <span className="text-[1.8rem] leading-none" aria-hidden>{reward.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.1rem] font-bold">{reward.title}</p>
        <p className="text-[0.9rem] text-ink-soft">
          {reward.costPoints} ★ · {owner ? owner.displayName : 'Anyone'}{reward.isActive ? '' : ' · retired'}
        </p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="rounded-full border-2 border-line px-4 py-2 font-semibold">Edit</button>
      <button type="button"
        onClick={() => startTransition(() => { void setRewardActive(reward.id, !reward.isActive); })}
        className="rounded-full border-2 border-line px-4 py-2 font-semibold">
        {reward.isActive ? 'Retire' : 'Restore'}
      </button>
    </li>
  );
}

function RewardForm({ reward, people, onDone }: { reward?: Reward; people: Person[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(reward ? updateReward : createReward, initial);
  return (
    <section className="mb-4 rounded-tile border-2 border-line bg-ground-raised p-4">
      <form action={formAction} className="space-y-3">
        {reward ? <input type="hidden" name="id" value={reward.id} /> : null}
        <div className="flex gap-3">
          <label className="w-20">
            <span className="block text-[0.95rem] font-semibold">Icon</span>
            <input name="icon" defaultValue={reward?.icon ?? '🎁'} required maxLength={16}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-2 py-3 text-center text-[1.5rem]" />
          </label>
          <label className="flex-1">
            <span className="block text-[0.95rem] font-semibold">Reward</span>
            <input name="title" defaultValue={reward?.title} required maxLength={60}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
          </label>
          <label className="w-24">
            <span className="block text-[0.95rem] font-semibold">Costs</span>
            <input type="number" name="costPoints" defaultValue={reward?.costPoints ?? 10} min={1} max={1000}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-3 py-3 text-center text-[1.05rem]" />
          </label>
        </div>
        <label className="block">
          <span className="block text-[0.95rem] font-semibold">Who</span>
          <select name="personId" defaultValue={reward?.personId ?? ''}
            className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]">
            <option value="">Anyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </label>
        <Notice error={state.error} ok={state.ok} />
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60">
            {pending ? 'Saving…' : reward ? 'Save' : 'Add reward'}
          </button>
          <button type="button" onClick={onDone} className="rounded-full border-2 border-line px-6 py-3 font-semibold">
            {state.ok ? 'Done' : 'Cancel'}
          </button>
        </div>
      </form>
    </section>
  );
}

/**
 * The evening check. Claims wait here until a grown-up says yes or no.
 * Grouped by child, because that is how a parent remembers the day: "did
 * they really feed the dog?".
 */
function PendingChecks({ pending }: { pending: Pending[] }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byChild = new Map<number, Pending[]>();
  for (const p of pending) byChild.set(p.personId, [...(byChild.get(p.personId) ?? []), p]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? 'That did not save. Try again.');
    });
  }

  return (
    <section aria-busy={busy}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.25rem] font-extrabold">Jobs to check ({pending.length})</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => approveAllChores(pending.map((p) => p.id)))}
          className="tap rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60"
        >
          Approve all
        </button>
      </div>
      <Notice error={error} />

      <div className="space-y-5">
        {[...byChild.values()].map((rows) => (
          <div key={rows[0].personId}>
            <h3 className="mb-2 text-[1.05rem] font-extrabold">
              <span aria-hidden>{rows[0].personIcon} </span>{rows[0].personName}
            </h3>
            <ul className="space-y-2">
              {rows.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-tile border-2 border-line bg-ground-raised p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[1.1rem] font-bold">{p.choreTitle}</p>
                    <p className="text-[0.9rem] text-ink-soft">{p.date} · {p.pointsAwarded} ★</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => rejectChore(p.id))}
                    className="tap shrink-0 rounded-full border-2 border-ink px-5 py-3 font-bold disabled:opacity-60"
                  >
                    Not done
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => approveChore(p.id))}
                    className="tap shrink-0 rounded-full bg-ink px-5 py-3 font-bold text-ground disabled:opacity-60"
                  >
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
