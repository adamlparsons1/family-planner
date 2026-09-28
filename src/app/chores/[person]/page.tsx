import { notFound } from 'next/navigation';
import { requireHousehold } from '@/lib/guards';
import { getPersonBySlug } from '@/lib/queries/routine';
import {
  getBalance, getChoresForChild, getEarnedSince, getRewardsForChild,
} from '@/lib/queries/points';
import { canRedeem } from '@/lib/actions/chores';
import { ChoresBoard } from '@/components/ChoresBoard';
import { getSettings } from '@/lib/settings';
import { getCurrentAppDate, weekOf } from '@/lib/date';

export default async function ChildChoresPage({
  params,
}: {
  params: Promise<{ person: string }>;
}) {
  const { person: slug } = await params;
  await requireHousehold(`/chores/${slug}`);

  const person = await getPersonBySlug(decodeURIComponent(slug));
  if (!person) notFound();

  const settings = await getSettings();
  const today = getCurrentAppDate(new Date(), settings.dayRolloverHour);

  const [chores, rewards, balance, earned, redeemAllowed] = await Promise.all([
    getChoresForChild(person.id, today),
    getRewardsForChild(person.id),
    getBalance(person.id),
    getEarnedSince([person.id], weekOf(today)[0]),
    canRedeem(),
  ]);

  return (
    <ChoresBoard
      person={{ id: person.id, displayName: person.displayName, colour: person.colour, icon: person.icon }}
      chores={chores.map((c) => ({
        id: c.id,
        title: c.title,
        icon: c.icon,
        points: c.points,
        requiresApproval: c.requiresApproval,
        done: c.completion !== null,
        pending: c.completion !== null && c.completion.approvedAt === null,
        claimedBy: c.claimedBy,
      }))}
      rewards={rewards.map((r) => ({ id: r.id, title: r.title, icon: r.icon, costPoints: r.costPoints }))}
      balance={balance}
      earnedThisWeek={earned.get(person.id) ?? 0}
      canRedeem={redeemAllowed}
    />
  );
}
