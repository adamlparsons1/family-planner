'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeChore, redeemReward, undoChore } from '@/lib/actions/chores';
import { deepenUntilReadable } from '@/lib/contrast';

type Chore = {
  id: number; title: string; icon: string; points: number;
  requiresApproval: boolean; done: boolean; pending: boolean;
  /** Open to anyone and one per day: claiming it greys it out for the others. */
  shared: boolean;
  claimedBy: { personId: number; displayName: string; icon: string } | null;
};
type Reward = { id: number; title: string; icon: string; costPoints: number };
type Child = {
  id: number; name: string; displayName: string; colour: string; icon: string;
  chores: Chore[]; rewards: Reward[]; balance: number; earnedThisWeek: number;
  /** Claimed but not yet approved. Shown apart from the balance. */
  pendingStars: number;
};

/**
 * Every child side by side, same reasoning as the routine board: they
 * are all looking at this at once and comparing. A single-child view meant two
 * of them could not see their own stars.
 */
export function ChoresColumns({ children: initial, canRedeem }: { children: Child[]; canRedeem: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [kids, apply] = useOptimistic(
    initial,
    (current: Child[], u: {
      childId: number; choreId: number; done: boolean; points: number; pending: boolean; shared: boolean;
    }) => {
      const claimer = current.find((c) => c.id === u.childId);
      return current.map((c) => {
        if (c.id !== u.childId) {
          // A shared job greys out in the other columns the moment it is claimed.
          if (!u.shared || !claimer) return c;
          return {
            ...c,
            chores: c.chores.map((ch) =>
              ch.id === u.choreId
                ? {
                    ...ch,
                    claimedBy: u.done
                      ? { personId: claimer.id, displayName: claimer.displayName, icon: claimer.icon }
                      : null,
                  }
                : ch,
            ),
          };
        }
        return {
          ...c,
          chores: c.chores.map((ch) =>
            ch.id === u.choreId ? { ...ch, done: u.done, pending: u.pending } : ch,
          ),
          // A chore awaiting approval does not move the balance; it moves "waiting".
          balance: c.balance + (u.pending ? 0 : u.done ? u.points : -u.points),
          pendingStars: c.pendingStars + (u.pending ? (u.done ? u.points : -u.points) : 0),
        };
      });
    },
  );

  function toggle(child: Child, chore: Chore) {
    setMessage(null);
    if (chore.claimedBy) return;
    const next = !chore.done;
    startTransition(async () => {
      apply({
        childId: child.id, choreId: chore.id, done: next, points: chore.points,
        // Undoing a claim that was still waiting takes it off "waiting", not the balance.
        pending: next ? chore.requiresApproval : chore.pending,
        shared: chore.shared,
      });
      const result = next
        ? await completeChore(chore.id, child.id)
        : await undoChore(chore.id, child.id);
      if (!result.ok) setMessage(result.error);
      router.refresh();
    });
  }

  function redeem(child: Child, reward: Reward) {
    setMessage(null);
    startTransition(async () => {
      const result = await redeemReward(reward.id, child.id);
      setMessage(result.ok ? (result.message ?? 'Redeemed') : result.error);
      router.refresh();
    });
  }

  return (
    <>
      {message ? (
        <p role="status" className="mb-3 rounded-tile bg-ground-sunken px-5 py-3 text-center text-kiosk-sm font-bold">
          {message}
        </p>
      ) : null}

      {/* min-h-0 is load-bearing: without it the grid grows to fit its
          content and the whole page scrolls, instead of each column
          scrolling inside a fixed-height board. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        {kids.map((child, i) => (
          <ChildColumn
            key={child.id}
            column={i}
            child={child}
            canRedeem={canRedeem}
            onToggle={(chore) => toggle(child, chore)}
            onRedeem={(reward) => redeem(child, reward)}
          />
        ))}
      </div>
    </>
  );
}

function ChildColumn({
  child, canRedeem, onToggle, onRedeem, column,
}: {
  child: Child;
  canRedeem: boolean;
  onToggle: (c: Chore) => void;
  onRedeem: (r: Reward) => void;
  column: number;
}) {
  const todo = child.chores.filter((c) => !c.done && !c.claimedBy);
  const tilt = [-1.1, 0.8, -0.6][column % 3];
  const numeralColour = deepenUntilReadable(child.colour, '#fffdf8');

  return (
    <section
      className={`paper taped${column % 2 === 1 ? ' taped-r' : ''} flex min-h-0 flex-col`}
      style={{ transform: `rotate(${tilt}deg)` }}
      aria-label={`${child.displayName}'s jobs`}
    >
      <div className="h-[9px] shrink-0 rounded-t-[3px]" style={{ backgroundColor: child.colour }} />

      <div className="px-4 pt-4">
        <p className="serif text-[27px] font-bold leading-none">{child.displayName}</p>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span
            className="serif text-[62px] font-extrabold leading-[0.8] tabular-nums"
            style={{ color: numeralColour }}
          >
            {child.balance}
          </span>
          <span className="serif text-[24px] font-semibold text-ink-muted">stars</span>
          {child.pendingStars > 0 ? (
            <span className="serif ml-auto text-[18px] font-bold tabular-nums text-ink-soft">
              +{child.pendingStars} waiting
            </span>
          ) : null}
        </div>
        <p className="mt-3 border-t-[1.5px] border-line pt-2 text-[12px] font-extrabold uppercase tracking-[0.15em] text-ink-soft">
          {child.earnedThisWeek} this week &middot; {todo.length} job{todo.length === 1 ? '' : 's'} left
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {child.chores.length === 0 ? (
          <p className="py-6 text-center text-[1.05rem] font-bold text-ink-soft">No jobs today.</p>
        ) : (
          <ul className="grid grid-cols-2 justify-items-center gap-[9px]">
            {child.chores.map((chore) => (
              <li key={chore.id} className="w-full">
                <ChoreTile chore={chore} colour={child.colour} onToggle={() => onToggle(chore)} />
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-2 mt-4 border-t-[1.5px] border-line pt-2.5 text-[12px] font-extrabold uppercase tracking-[0.15em] text-ink-soft">
          Rewards
        </h3>
        <ul className="space-y-1.5">
          {child.rewards.map((reward) => {
            const affordable = child.balance >= reward.costPoints;
            const gap = reward.costPoints - child.balance;
            return (
              <li key={reward.id}>
                <div
                  className="flex items-center gap-2 rounded-[8px] border-[1.5px] border-dashed border-line-strong bg-ground-sunken px-2 py-1.5"
                  style={{ opacity: affordable ? 1 : 0.55 }}
                >
                  <span className="text-[1.3rem] leading-none" aria-hidden>{reward.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-[0.85rem] font-extrabold">{reward.title}</span>
                  {affordable ? (
                    <button
                      type="button"
                      onClick={() => onRedeem(reward)}
                      className="shrink-0 rounded-full border-2 border-ink bg-ground-raised px-3 py-1.5 text-[0.8rem] font-extrabold"
                    >
                      {canRedeem ? 'Get it' : 'Ask'}
                    </button>
                  ) : (
                    <span className="serif shrink-0 text-[0.95rem] font-bold tabular-nums text-ink-soft">
                      {gap} more
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ChoreTile({ chore, colour, onToggle }: { chore: Chore; colour: string; onToggle: () => void }) {
  if (chore.claimedBy) {
    // Someone else got there first. Visibly not available, and not tappable,
    // with whose it was carried by their icon for children who cannot read yet.
    return (
      <button
        type="button"
        disabled
        aria-disabled
        className="relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-tile p-2"
        style={{
          minHeight: 104,
          backgroundColor: 'var(--color-ground-sunken)',
          border: '2px solid var(--color-line)',
          color: 'var(--color-ink)',
          opacity: 0.45,
        }}
      >
        <span className="text-[1.85rem] leading-none grayscale" aria-hidden>{chore.icon}</span>
        <span className="text-center text-[0.78rem] font-extrabold leading-tight">{chore.title}</span>
        <span className="text-[0.8rem] font-bold">
          <span aria-hidden>{chore.claimedBy.icon} </span>{chore.claimedBy.displayName} did it
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={chore.done}
      className="relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-tile p-2 transition-transform duration-150 active:scale-95"
      style={{
        minHeight: 104,
        backgroundColor: chore.done ? colour : 'var(--color-ground-sunken)',
        border: chore.done ? '2px solid var(--color-ink)' : '2px dashed var(--color-line-strong)',
        color: 'var(--color-ink)',
      }}
    >
      <span
        className="text-[1.85rem] leading-none transition-all duration-300"
        style={{ opacity: chore.done ? 0.5 : 1 }}
        aria-hidden
      >
        {chore.icon}
      </span>
      <span className="text-center text-[0.78rem] font-extrabold leading-tight">{chore.title}</span>
      <span className="serif text-[0.9rem] font-bold">
        {chore.pending ? `\u2605 waiting` : `${chore.points} \u2605`}
      </span>
      {chore.done ? (
        <span className="serif absolute right-1.5 top-0.5 text-[1.5rem] font-extrabold leading-none" aria-hidden>
          &#10003;
        </span>
      ) : null}
      <span className="sr-only">
        {chore.pending ? 'Waiting for a grown-up' : chore.done ? 'Done' : 'Not done'}
      </span>
    </button>
  );
}
