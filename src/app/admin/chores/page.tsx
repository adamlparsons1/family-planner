import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { chores, people, rewards } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { AdminShell } from '@/components/AdminShell';
import { ChoresAdmin } from '@/components/ChoresAdmin';
import { getPendingApprovals } from '@/lib/queries/points';

export default async function ChoresAdminPage() {
  await requireParentPin('/admin/chores');

  const db = await getDb();
  const [choreRows, rewardRows, children, pending] = await Promise.all([
    db.select().from(chores).orderBy(asc(chores.title)),
    db.select().from(rewards).orderBy(asc(rewards.costPoints)),
    db.select().from(people).where(eq(people.role, 'child')).orderBy(asc(people.sortOrder)),
    getPendingApprovals(),
  ]);
  const childOrder = (id: number) => {
    const i = children.findIndex((c) => c.id === id);
    return i === -1 ? children.length : i;
  };

  return (
    <AdminShell title="Jobs and rewards">
      <ChoresAdmin
        chores={choreRows}
        rewards={rewardRows}
        people={children.map((c) => ({ id: c.id, displayName: c.displayName, colour: c.colour, icon: c.icon }))}
        // Grouped by child in family order, newest claim first within each.
        pending={[...pending]
          .sort((x, y) => childOrder(x.personId) - childOrder(y.personId))
          .map((p) => ({
          id: p.id,
          choreTitle: p.choreTitle,
          pointsAwarded: p.pointsAwarded,
          date: p.date,
          personId: p.personId,
          personName: p.person?.displayName ?? 'Someone',
          personIcon: p.person?.icon ?? '',
        }))}
      />
    </AdminShell>
  );
}
