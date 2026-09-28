import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { people, routineTasks } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { AdminShell } from '@/components/AdminShell';
import { RoutineAdmin } from '@/components/RoutineAdmin';
import { ROUTINE_CATEGORIES } from '@/lib/family';

export default async function RoutinesAdminPage() {
  await requireParentPin('/admin/routines');

  const db = await getDb();
  const [children, tasks] = await Promise.all([
    db.select().from(people).where(eq(people.role, 'child')).orderBy(asc(people.sortOrder)),
    db.select().from(routineTasks).orderBy(asc(routineTasks.sortOrder)),
  ]);

  const tasksByPerson: Record<number, typeof tasks> = {};
  for (const t of tasks) (tasksByPerson[t.personId] ??= []).push(t);

  return (
    <AdminShell title="Morning routines">
      <RoutineAdmin
        people={children}
        tasksByPerson={tasksByPerson}
        categories={ROUTINE_CATEGORIES}
      />
    </AdminShell>
  );
}
