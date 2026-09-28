import { asc } from 'drizzle-orm';
import { getDb } from '@/db';
import { people } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { AdminShell } from '@/components/AdminShell';
import { EventsAdmin } from '@/components/EventsAdmin';
import { listEvents } from '@/lib/queries/events';
import { getCurrentAppDate } from '@/lib/date';
import { getSettings } from '@/lib/settings';

export default async function EventsAdminPage() {
  await requireParentPin('/admin/events');

  const settings = await getSettings();
  const db = await getDb();
  const [everyone, events] = await Promise.all([
    db.select().from(people).orderBy(asc(people.sortOrder)),
    listEvents(),
  ]);

  return (
    <AdminShell title="Calendar">
      <EventsAdmin
        events={events}
        people={everyone.map((p) => ({ id: p.id, displayName: p.displayName, colour: p.colour, icon: p.icon }))}
        today={getCurrentAppDate(new Date(), settings.dayRolloverHour)}
      />
    </AdminShell>
  );
}
