'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeChore, redeemReward, undoChore } from '@/lib/actions/chores';
import { darken, readableTextOn } from '@/lib/contrast';

type Chore = {
  id: number; title: string; icon: string; points: number;
  requiresApproval: boolean; done: boolean; pending: boolean;
  claimedBy: { personId: number; displayName: string; icon: string } | null;
};
type Reward = { id: number; title: string; icon: string; costPoints: number };
type Person = { id: number; displayName: string; colour: string; icon: string };

export function ChoresBoard({
  person, chores: initialChores, rewards, balance: initialBalance, earnedThisWeek, canRedeem,
}: {
  person: Person;
  chores: Chore[];
  rewards: Reward[];
  balance: number;
  earnedThisWeek: number;
  canRedeem: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [state, apply] = useOptimistic(
    { chores: initialChores, balance: initialBalance },
    (current, u: { choreId: number; done: boolean; points: number; pending: boolean }) => ({
      chores: current.chores.map((c) =>
        c.id === u.choreId ? { ...c, done: u.done, pending: u.pending } : c,
      ),
      // Pending chores do not move the balance until a grown-up approves.
      balance: current.balance + (u.pending ? 0 : u.done ? u.points : -u.points),
    }),
  );

  const ink = readableTextOn(person.colour);

  function toggle(chore: Chore) {
    setMessage(null);
    if (chore.claimedBy) return;
    const next = !chore.done;
    startTransition(async () => {
      apply({
        choreId: chore.id,
        done: next,
        points: chore.points,
        // Undoing a claim that was still waiting never touched the balance.
        pending: next ? chore.requiresApproval : chore.pending,
      });
      const result = next
        ? await completeChore(chore.id, person.id)
        : await undoChore(chore.id, person.id);
      if (!result.ok) setMessage(result.error);
      else if (result.message) setMessage(result.message);
      router.refresh();
    });
  }

  function redeem(reward: Reward) {
    setMessage(null);
    startTransition(async () => {
      const result = await redeemReward(reward.id, person.id);
      if (!result.ok) setMessage(result.error);
      else setMessage(result.message ?? 'Redeemed');
      router.refresh();
    });
  }

  return (
    <div className="min-h-dvh" style={{ backgroundColor: person.colour, color: ink }}>
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6">
        <a
          href="/"
          className="tap rounded-full px-6 py-3 text-kiosk-base font-bold"
          style={{ backgroundColor: darken(person.colour, 0.18), color: ink }}
        >
          ← Home
        </a>
        <div className="text-right">
          <p className="text-kiosk-lg font-extrabold leading-none">
            <span aria-hidden className="mr-2">{person.icon}</span>{person.displayName}
          </p>
          <p className="text-kiosk-sm font-semibold">
            {earnedThisWeek} earned this week
          </p>
        </div>
      </header>

      <div className="mx-6 mt-5 rounded-tile bg-white/90 px-6 py-5 text-center text-ink">
        <p className="text-[1.1rem] font-bold uppercase tracking-wide text-ink-soft">Stars</p>
        <p className="text-[4.5rem] font-extrabold leading-none tabular-nums">{state.balance}</p>
      </div>

      {message ? (
        <p role="status" className="mx-6 mt-4 rounded-tile bg-white/90 px-5 py-3 text-center text-kiosk-base font-bold text-ink">
          {message}
        </p>
      ) : null}

      <section className="px-6 py-6">
        <h2 className="mb-3 text-kiosk-base font-extrabold uppercase tracking-wide opacity-80">
          Jobs today
        </h2>
        {state.chores.length === 0 ? (
          <p className="text-kiosk-sm">No jobs today.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {state.chores.map((chore) => (
              <li key={chore.id}>
                <button
                  type="button"
                  onClick={() => toggle(chore)}
                  disabled={chore.claimedBy !== null}
                  aria-pressed={chore.done}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-tile p-3 transition-transform active:scale-95"
                  style={{
                    minHeight: 140,
                    backgroundColor: chore.done ? darken(person.colour, 0.32) : '#ffffff',
                    color: chore.done ? '#ffffff' : '#2b2620',
                    boxShadow: chore.done ? 'none' : '0 4px 0 rgba(0,0,0,0.16)',
                    opacity: chore.claimedBy ? 0.45 : 1,
                  }}
                >
                  <span className="text-[2.5rem] leading-none" aria-hidden>{chore.icon}</span>
                  <span className="text-center text-[1rem] font-bold leading-tight">{chore.title}</span>
                  <span className="text-[0.95rem] font-extrabold">
                    {chore.claimedBy
                      ? `${chore.claimedBy.icon} ${chore.claimedBy.displayName} did it`
                      : chore.pending ? 'Waiting for a grown-up' : `${chore.points} ★`}
                  </span>
                  {chore.done ? <span className="text-[1.2rem]" aria-hidden>✓</span> : null}
                  <span className="sr-only">
                    {chore.pending ? 'Waiting for a grown-up' : chore.done ? 'Done' : 'Not done'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-6 pb-12">
        <h2 className="mb-3 text-kiosk-base font-extrabold uppercase tracking-wide opacity-80">
          Rewards
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rewards.map((reward) => {
            const affordable = state.balance >= reward.costPoints;
            const gap = reward.costPoints - state.balance;
            return (
              <li key={reward.id}>
                <div
                  className="flex h-full flex-col items-center justify-between gap-2 rounded-tile bg-white p-4 text-center text-ink"
                  style={{ opacity: affordable ? 1 : 0.55 }}
                >
                  <span className="text-[2.5rem] leading-none" aria-hidden>{reward.icon}</span>
                  <p className="text-[1rem] font-bold leading-tight">{reward.title}</p>
                  <p className="text-[0.95rem] font-extrabold">
                    {affordable ? `${reward.costPoints} ★` : `${gap} more ★`}
                  </p>
                  {affordable ? (
                    <button
                      type="button"
                      onClick={() => redeem(reward)}
                      className="tap w-full rounded-full bg-ink px-4 py-3 text-[1rem] font-bold text-ground"
                    >
                      {canRedeem ? 'Get it' : 'Ask a grown-up'}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-kiosk-sm opacity-80">
          A grown-up has to say yes before a reward can be used.
        </p>
      </section>
    </div>
  );
}
