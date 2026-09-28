import { asc, gte } from 'drizzle-orm';
import { getDb } from '@/db';
import { nonSchoolDays } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { AdminShell } from '@/components/AdminShell';
import { SchoolDaysAdmin } from '@/components/SchoolDaysAdmin';
import { getCurrentAppDate } from '@/lib/date';
import { getSettings } from '@/lib/settings';

export default async function SchoolDaysPage() {
  await requireParentPin('/admin/school');

  const settings = await getSettings();
  const today = getCurrentAppDate(new Date(), settings.dayRolloverHour);

  const db = await getDb();
  const upcoming = await db
    .select()
    .from(nonSchoolDays)
    .where(gte(nonSchoolDays.date, today))
    .orderBy(asc(nonSchoolDays.date));

  return (
    <AdminShell title="School days">
      <SchoolDaysAdmin
        upcoming={upcoming.map((d) => ({ date: d.date, reason: d.reason, label: d.label }))}
        today={today}
      />
    </AdminShell>
  );
}
