import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { people } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { AdminShell } from '@/components/AdminShell';
import { PointsAdmin } from '@/components/PointsAdmin';
import { getBalances, getLedger } from '@/lib/queries/points';

export default async function PointsPage() {
  await requireParentPin('/admin/points');

  const db = await getDb();
  const children = await db
    .select().from(people).where(eq(people.role, 'child')).orderBy(asc(people.sortOrder));
  const ids = children.map((c) => c.id);

  const balances = await getBalances(ids);
  const ledgerList = await Promise.all(ids.map((id) => getLedger(id, 20)));

  const ledgers: Record<number, { id: number; delta: number; reason: string; sourceType: string; createdAt: string }[]> = {};
  ids.forEach((id, i) => {
    ledgers[id] = ledgerList[i].map((e) => ({
      id: e.id, delta: e.delta, reason: e.reason,
      sourceType: e.sourceType, createdAt: e.createdAt.toISOString(),
    }));
  });

  return (
    <AdminShell title="Points">
      <PointsAdmin
        people={children.map((c) => ({ id: c.id, displayName: c.displayName, colour: c.colour, icon: c.icon }))}
        balances={Object.fromEntries(balances)}
        ledgers={ledgers}
      />
    </AdminShell>
  );
}
