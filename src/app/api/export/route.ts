import { NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { isHouseholdUnlocked, isPinUnlocked } from '@/lib/session';
import { getCurrentAppDate } from '@/lib/date';

/**
 * Full database as JSON. Parent PIN required.
 *
 * This exists so there is always a trivial backup path that does not involve a
 * database console. Returns 401/403 rather than redirecting, because this is an
 * API route and a redirect to HTML would be a confusing thing to download.
 */
export async function GET() {
  if (!(await isHouseholdUnlocked())) {
    return NextResponse.json({ error: 'Locked' }, { status: 401 });
  }
  if (!(await isPinUnlocked())) {
    return NextResponse.json({ error: 'Parent PIN required' }, { status: 403 });
  }

  const db = await getDb();

  // Deliberately excludes `settings` (password hashes) and `auth_attempts`.
  const [
    people, events, eventPeople, routineTasks, routineCompletions,
    chores, choreCompletions, rewards, pointsLedger,
    meals, lunchChoices, lunchDefaults, nonSchoolDays,
    homeworkItems, homeworkCompletions,
  ] = await Promise.all([
    db.select().from(schema.people),
    db.select().from(schema.events),
    db.select().from(schema.eventPeople),
    db.select().from(schema.routineTasks),
    db.select().from(schema.routineCompletions),
    db.select().from(schema.chores),
    db.select().from(schema.choreCompletions),
    db.select().from(schema.rewards),
    db.select().from(schema.pointsLedger),
    db.select().from(schema.meals),
    db.select().from(schema.lunchChoices),
    db.select().from(schema.lunchDefaults),
    db.select().from(schema.nonSchoolDays),
    db.select().from(schema.homeworkItems),
    db.select().from(schema.homeworkCompletions),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    appDate: getCurrentAppDate(),
    schemaVersion: 1,
    data: {
      people, events, eventPeople, routineTasks, routineCompletions,
      chores, choreCompletions, rewards, pointsLedger,
      meals, lunchChoices, lunchDefaults, nonSchoolDays,
      homeworkItems, homeworkCompletions,
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="family-dashboard-${getCurrentAppDate()}.json"`,
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  });
}
