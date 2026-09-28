import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { homeworkItems, people } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { getSettings } from '@/lib/settings';
import { AdminShell } from '@/components/AdminShell';
import { HomeworkAdmin } from '@/components/HomeworkAdmin';

export default async function HomeworkAdminPage() {
  await requireParentPin('/admin/homework');

  const db = await getDb();
  const [settings, children, items] = await Promise.all([
    getSettings(),
    db.select().from(people).where(eq(people.role, 'child')).orderBy(asc(people.sortOrder)),
    db.select().from(homeworkItems).orderBy(asc(homeworkItems.sortOrder), asc(homeworkItems.createdAt)),
  ]);

  return (
    <AdminShell title="Homework">
      <HomeworkAdmin
        weekStartDay={settings.homeworkWeekStartDay}
        people={children.map((c) => ({ id: c.id, displayName: c.displayName, colour: c.colour, icon: c.icon }))}
        items={items.map((i) => ({
          id: i.id, personId: i.personId, title: i.title, icon: i.icon, kind: i.kind,
          targetPerWeek: i.targetPerWeek, unitLabel: i.unitLabel, dueDate: i.dueDate, isActive: i.isActive,
        }))}
      />
    </AdminShell>
  );
}
