import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { getDb } from '@/db';
import { eventPeople, events, people } from '@/db/schema';
import { getEventsForDate, getEventsForDates } from '@/lib/queries/events';

let ruby: typeof people.$inferSelect;
let max: typeof people.$inferSelect;

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });

  [ruby] = await db.insert(people).values({
    name: 'R', displayName: 'Ruby', role: 'child', colour: '#7FB3DA', icon: 'B', sortOrder: 0,
  }).returning();
  [max] = await db.insert(people).values({
    name: 'M', displayName: 'Max', role: 'child', colour: '#EFB0CC', icon: 'F', sortOrder: 1,
  }).returning();

  const [club] = await db.insert(events).values({
    title: 'Swim Club', icon: 'S', daysOfWeek: [2],
    startsOn: '2026-09-15', endsOn: '2026-12-08', startTime: '15:30:00',
  }).returning();
  await db.insert(eventPeople).values({ eventId: club.id, personId: ruby.id });

  const [swimming] = await db.insert(events).values({
    title: 'Swimming', icon: 'W', daysOfWeek: [6], startTime: '10:00:00',
  }).returning();
  await db.insert(eventPeople).values([
    { eventId: swimming.id, personId: ruby.id },
    { eventId: swimming.id, personId: max.id },
  ]);

  // No people attached: a whole-family event.
  await db.insert(events).values({ title: 'First day of term', icon: 'T', date: '2026-09-02' });
});

describe('events carry their people', () => {
  it('attaches one child to a club', async () => {
    const [club] = await getEventsForDate('2026-09-15');
    expect(club.title).toBe('Swim Club');
    expect(club.people.map((p) => p.displayName)).toEqual(['Ruby']);
  });

  it('attaches several children, in their display order', async () => {
    const [swim] = await getEventsForDate('2026-09-19'); // a Saturday
    expect(swim.title).toBe('Swimming');
    expect(swim.people.map((p) => p.displayName)).toEqual(['Ruby', 'Max']);
  });

  it('treats an event with nobody attached as a family event', async () => {
    const [term] = await getEventsForDate('2026-09-02');
    expect(term.title).toBe('First day of term');
    expect(term.people).toEqual([]);
  });
});

describe('the week view query', () => {
  it('returns an entry for every day, even empty ones', async () => {
    const week = ['2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19','2026-09-20'];
    const map = await getEventsForDates(week);
    expect([...map.keys()]).toHaveLength(7);
    expect(map.get('2026-09-14')).toEqual([]);
    expect(map.get('2026-09-15')).toHaveLength(1);
    expect(map.get('2026-09-19')).toHaveLength(1);
  });

  it('stops showing the club after its end date without any tidying up', async () => {
    const after = await getEventsForDates(['2026-12-08', '2026-12-15']);
    expect(after.get('2026-12-08')).toHaveLength(1);
    expect(after.get('2026-12-15')).toEqual([]);
  });
});
