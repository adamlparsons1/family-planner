import Link from 'next/link';
import { requireHousehold } from '@/lib/guards';
import { getChildren } from '@/lib/queries/routine';
import {
  getBalances, getChoresForChild, getEarnedSince, getPendingStars, getRewardsForChild,
} from '@/lib/queries/points';
import { canRedeem } from '@/lib/actions/chores';
import { ChoresColumns } from '@/components/ChoresColumns';
import { KioskRefresh } from '@/components/KioskRefresh';
import { getSettings } from '@/lib/settings';
import { getCurrentAppDate, weekOf } from '@/lib/date';

/** Every child's jobs and stars at once. */
export default async function ChoresPage() {
  await requireHousehold('/chores');

  const settings = await getSettings();
  const today = getCurrentAppDate(new Date(), settings.dayRolloverHour);
  const children = await getChildren();
  const ids = children.map((c) => c.id);

  const [balances, earned, pendingStars, redeemAllowed, perChild] = await Promise.all([
    getBalances(ids),
    getEarnedSince(ids, weekOf(today)[0]),
    getPendingStars(ids),
    canRedeem(),
    Promise.all(
      children.map(async (child) => ({
        child,
        chores: await getChoresForChild(child.id, today),
        rewards: await getRewardsForChild(child.id),
      })),
    ),
  ]);

  return (
    <main className="flex h-dvh flex-col p-3">
      <KioskRefresh />
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3 px-1">
        <h1 className="serif text-[2.1rem] font-bold leading-none">Jobs and rewards</h1>
        <nav className="flex gap-2">
          <Link href="/" className="tap rounded-full border-2 border-ink bg-ground-raised px-5 py-2 text-[0.95rem] font-extrabold shadow-[0_3px_0_rgba(88,66,36,0.28)]">
            Home
          </Link>
          <Link href="/routine" className="tap rounded-full border-2 border-ink bg-ground-raised px-5 py-2 text-[0.95rem] font-extrabold shadow-[0_3px_0_rgba(88,66,36,0.28)]">
            Morning
          </Link>
          <Link href="/homework" className="tap rounded-full border-2 border-ink bg-ground-raised px-5 py-2 text-[0.95rem] font-extrabold shadow-[0_3px_0_rgba(88,66,36,0.28)]">
            Homework
          </Link>
        </nav>
      </header>

      <ChoresColumns
        canRedeem={redeemAllowed}
        children={perChild.map(({ child, chores, rewards }) => ({
          id: child.id,
          name: child.name,
          displayName: child.displayName,
          colour: child.colour,
          icon: child.icon,
          balance: balances.get(child.id) ?? 0,
          earnedThisWeek: earned.get(child.id) ?? 0,
          pendingStars: pendingStars.get(child.id) ?? 0,
          chores: chores.map((c) => ({
            id: c.id, title: c.title, icon: c.icon, points: c.points,
            requiresApproval: c.requiresApproval,
            done: c.completion !== null,
            pending: c.completion !== null && c.completion.approvedAt === null,
            shared: c.personId === null && c.onePerDay,
            claimedBy: c.claimedBy,
          })),
          rewards: rewards.map((r) => ({
            id: r.id, title: r.title, icon: r.icon, costPoints: r.costPoints,
          })),
        }))}
      />
    </main>
  );
}
