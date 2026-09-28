import { asc } from 'drizzle-orm';
import { getDb } from '@/db';
import { people } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { AdminShell } from '@/components/AdminShell';
import { PeopleAdmin } from '@/components/PeopleAdmin';

export default async function PeopleAdminPage() {
  await requireParentPin('/admin/people');

  const db = await getDb();
  const everyone = await db.select().from(people).orderBy(asc(people.role), asc(people.sortOrder));

  return (
    <AdminShell title="People">
      <PeopleAdmin people={everyone} />
    </AdminShell>
  );
}
