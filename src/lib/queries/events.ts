import 'server-only';
import { asc, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { eventPeople, events, people } from '@/db/schema';
import { expandForDate, type EventRule, type Occurrence } from '@/lib/recurrence';
import type { AppDate } from '@/lib/date';

export type Person = typeof people.$inferSelect;

/** An occurrence plus the people it belongs to. No people = a family event. */
export type DatedEvent = Occurrence & { people: Person[] };

async function loadRules(): Promise<{ rules: EventRule[]; peopleByEvent: Map<number, Person[]> }> {
  const db = await getDb();
  const [rows, links, allPeople] = await Promise.all([
    db.select().from(events).orderBy(asc(events.startTime)),
    db.select().from(eventPeople),
    db.select().from(people),
  ]);

  const peopleById = new Map(allPeople.map((p) => [p.id, p]));
  const peopleByEvent = new Map<number, Person[]>();
  for (const link of links) {
    const person = peopleById.get(link.personId);
    if (!person) continue;
    const list = peopleByEvent.get(link.eventId) ?? [];
    list.push(person);
    peopleByEvent.set(link.eventId, list);
  }
  for (const list of peopleByEvent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  return { rules: rows as EventRule[], peopleByEvent };
}

/** Events on one date, ordered all-day first. */
export async function getEventsForDate(date: AppDate): Promise<DatedEvent[]> {
  const { rules, peopleByEvent } = await loadRules();
  return expandForDate(rules, date).map((o) => ({ ...o, people: peopleByEvent.get(o.eventId) ?? [] }));
}

/** Events across several dates, keyed by date. One database read for the lot. */
export async function getEventsForDates(dates: AppDate[]): Promise<Map<AppDate, DatedEvent[]>> {
  const { rules, peopleByEvent } = await loadRules();
  const out = new Map<AppDate, DatedEvent[]>();
  for (const date of dates) {
    out.set(
      date,
      expandForDate(rules, date).map((o) => ({ ...o, people: peopleByEvent.get(o.eventId) ?? [] })),
    );
  }
  return out;
}

export async function getEventWithPeople(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(events).where(inArray(events.id, [id]));
  if (!row) return null;
  const links = await db.select().from(eventPeople).where(inArray(eventPeople.eventId, [id]));
  return { event: row, personIds: links.map((l) => l.personId) };
}

export async function listEvents() {
  const { rules, peopleByEvent } = await loadRules();
  return rules.map((r) => ({ ...r, people: peopleByEvent.get(r.id) ?? [] }));
}
