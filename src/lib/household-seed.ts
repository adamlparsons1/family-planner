/**
 * Seeding a household, shared by `npm run db:seed` (the made-up example family
 * in src/lib/family.ts) and the /setup page (a real family, from a form).
 *
 * Auth-free and idempotent: every section only writes when its table is empty,
 * except people, whose look is synced by name. Safe to re-run.
 */
import { eq } from 'drizzle-orm';
import { schema, type Database } from '@/db';
import { hashSecret } from '@/lib/auth-hash';
import { datesBetween, isWeekend } from '@/lib/date';
import { ROUTINE_CATEGORIES, type RoutineCategory } from '@/lib/family';

export type SeedPerson = {
  name: string;
  displayName: string;
  colour: string;
  icon: string;
  sortOrder: number;
  showLunchOnCard?: boolean;
};

export type SeedRoutineTask = {
  title: string;
  icon: string;
  schoolDaysOnly?: boolean;
  /** Children this task applies to, by name. Omitted = every child. */
  only?: readonly string[];
};

export type HouseholdSeed = {
  parents: readonly SeedPerson[];
  children: readonly SeedPerson[];
  routine: Record<RoutineCategory, readonly SeedRoutineTask[]>;
  nonSchoolPeriods: readonly {
    from: string; to: string; reason: 'holiday' | 'inset' | 'sick' | 'other'; label: string;
  }[];
  events: readonly {
    title: string; icon: string; date?: string; daysOfWeek?: number[]; startsOn?: string;
    endsOn?: string; startTime?: string; isSchoolRelated?: boolean; people: readonly string[];
  }[];
  homework: readonly {
    person: string; title: string; icon: string; targetPerWeek: number; unitLabel?: string;
  }[];
  chores: readonly {
    title: string; icon: string; points: number; person?: string; daysOfWeek?: number[];
    onePerDay?: boolean;
  }[];
  rewards: readonly { title: string; icon: string; costPoints: number }[];
};

type Log = (line: string) => void;

const WEEKDAYS = [1, 2, 3, 4, 5];

export function routineTasksFor(
  routine: HouseholdSeed['routine'],
  child: string,
) {
  const rows: {
    title: string; icon: string; partOfDay: 'morning'; category: RoutineCategory;
    sortOrder: number; daysOfWeek: number[]; schoolDaysOnly: boolean;
  }[] = [];
  let order = 0;
  for (const category of ROUTINE_CATEGORIES) {
    for (const task of routine[category]) {
      if (task.only && !task.only.includes(child)) continue;
      rows.push({
        title: task.title,
        icon: task.icon,
        partOfDay: 'morning',
        category,
        sortOrder: order++,
        daysOfWeek: WEEKDAYS,
        schoolDaysOnly: task.schoolDaysOnly ?? false,
      });
    }
  }
  return rows;
}

/**
 * Writes the single settings row if, and only if, none exists. Returns whether
 * this call created it. The primary key is pinned to 1 by a check constraint,
 * so two simultaneous callers cannot both succeed: the database decides.
 */
export async function createSettingsIfAbsent(
  db: Database,
  input: { passcode: string; pin: string; sessionSecret?: string | null },
): Promise<boolean> {
  const inserted = await db
    .insert(schema.settings)
    .values({
      id: 1,
      householdPasscodeHash: await hashSecret(input.passcode),
      parentPinHash: await hashSecret(input.pin),
      sessionSecret: input.sessionSecret ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: schema.settings.id });
  return inserted.length > 0;
}

/** Everything except the settings row. */
export async function seedHousehold(db: Database, household: HouseholdSeed, log: Log = () => {}) {
  /* ---------------------------------------------------------------- people */
  const existingPeople = await db.select().from(schema.people);
  const byName = new Map(existingPeople.map((p) => [p.name, p]));

  /**
   * The seed is the source of truth for how a person LOOKS. Existing rows have
   * their colour, icon, display name and order synced on every seed. Nothing a
   * child has ticked is touched, because completions key off ids, not colours.
   */
  const roster = [
    ...household.parents.map((p) => ({
      name: p.name, displayName: p.displayName, colour: p.colour, icon: p.icon,
      sortOrder: p.sortOrder, role: 'parent' as const,
    })),
    ...household.children.map((c) => ({
      name: c.name, displayName: c.displayName, colour: c.colour,
      icon: c.icon, sortOrder: c.sortOrder, role: 'child' as const,
      showLunchOnCard: c.showLunchOnCard ?? false,
    })),
  ];

  for (const person of roster) {
    const existing = byName.get(person.name);
    if (!existing) {
      const [row] = await db.insert(schema.people).values(person).returning();
      byName.set(row.name, row);
      log(`  person: ${row.name} (${row.role}, ${row.colour}) created`);
      continue;
    }
    const changed =
      existing.colour !== person.colour ||
      existing.icon !== person.icon ||
      existing.displayName !== person.displayName ||
      existing.sortOrder !== person.sortOrder;
    if (changed) {
      await db
        .update(schema.people)
        .set({
          colour: person.colour,
          icon: person.icon,
          displayName: person.displayName,
          sortOrder: person.sortOrder,
        })
        .where(eq(schema.people.id, existing.id));
      log(`  person: ${person.name} updated (${existing.colour} -> ${person.colour})`);
    } else {
      log(`  person: ${person.name} unchanged`);
    }
  }

  /* --------------------------------------------------------- routine tasks */
  const existingTasks = await db.select().from(schema.routineTasks);
  const uncategorised = existingTasks.some((t) => t.category === 'Morning');
  if (existingTasks.length === 0 || uncategorised) {
    // Only rebuild when the tasks predate categories. Completions cascade with
    // the task, so this is safe before real use and destructive after it.
    if (uncategorised) {
      await db.delete(schema.routineTasks);
      log('  routine: rebuilding uncategorised tasks');
    }
    for (const child of household.children) {
      const person = byName.get(child.name)!;
      const tasks = routineTasksFor(household.routine, child.name);
      if (tasks.length === 0) continue;
      await db
        .insert(schema.routineTasks)
        .values(tasks.map((t) => ({ ...t, personId: person.id })));
      log(`  routine: ${tasks.length} morning tasks for ${child.name}`);
    }
  } else {
    log(`  routine: ${existingTasks.length} tasks already present, left untouched`);
  }

  /* -------------------------------------------------------- non-school days */
  const existingNonSchool = await db.select().from(schema.nonSchoolDays);
  const known = new Set(existingNonSchool.map((d) => d.date));
  const rows: { date: string; reason: 'holiday' | 'inset' | 'sick' | 'other'; label: string }[] = [];

  for (const period of household.nonSchoolPeriods) {
    for (const date of datesBetween(period.from, period.to)) {
      // Weekends are derived, never stored. Storing them would rot.
      if (isWeekend(date) || known.has(date)) continue;
      known.add(date);
      rows.push({ date, reason: period.reason, label: period.label });
    }
  }
  if (rows.length > 0) {
    await db.insert(schema.nonSchoolDays).values(rows);
  }
  log(`  school calendar: ${rows.length} new non-school weekdays`);

  /* ---------------------------------------------------------------- events */
  const existingEvents = await db.select().from(schema.events);
  if (existingEvents.length === 0) {
    for (const e of household.events) {
      const [row] = await db.insert(schema.events).values({
        title: e.title,
        icon: e.icon,
        date: e.date ?? null,
        daysOfWeek: e.daysOfWeek ?? null,
        startsOn: e.startsOn ?? null,
        endsOn: e.endsOn ?? null,
        startTime: e.startTime ?? null,
        isSchoolRelated: e.isSchoolRelated ?? false,
      }).returning();
      for (const name of e.people) {
        const person = byName.get(name);
        if (person) await db.insert(schema.eventPeople).values({ eventId: row.id, personId: person.id });
      }
      log(`  event: ${e.title}`);
    }
  } else {
    log(`  events: ${existingEvents.length} already present, left untouched`);
  }

  /* --------------------------------------------------------------- homework */
  const existingHomework = await db.select().from(schema.homeworkItems);
  if (existingHomework.length === 0) {
    const setOn = new Date().toISOString().slice(0, 10);
    const homeworkRows = household.homework.flatMap((h, i) => {
      const person = byName.get(h.person);
      return person
        ? [{
            personId: person.id, title: h.title, icon: h.icon, kind: 'weekly' as const,
            targetPerWeek: h.targetPerWeek, unitLabel: h.unitLabel ?? null, setOn, sortOrder: i,
          }]
        : [];
    });
    if (homeworkRows.length > 0) await db.insert(schema.homeworkItems).values(homeworkRows);
    log(`  homework: ${homeworkRows.length} added (starter set, edit in admin)`);
  } else {
    log(`  homework: ${existingHomework.length} already present, left untouched`);
  }

  /* ------------------------------------------------------ chores, rewards */
  const existingChores = await db.select().from(schema.chores);
  if (existingChores.length === 0) {
    if (household.chores.length > 0) {
      await db.insert(schema.chores).values(
        household.chores.map((c) => ({
          title: c.title,
          icon: c.icon,
          points: c.points,
          personId: c.person ? (byName.get(c.person)?.id ?? null) : null,
          daysOfWeek: c.daysOfWeek ?? null,
          // Approval by default: stars wait for a grown-up.
          requiresApproval: true,
          onePerDay: c.onePerDay ?? false,
        })),
      );
    }
    log(`  chores: ${household.chores.length} added (starter set, edit in admin)`);
  } else {
    log(`  chores: ${existingChores.length} already present, left untouched`);
  }

  const existingRewards = await db.select().from(schema.rewards);
  if (existingRewards.length === 0) {
    if (household.rewards.length > 0) {
      await db.insert(schema.rewards).values(
        household.rewards.map((r) => ({ title: r.title, icon: r.icon, costPoints: r.costPoints })),
      );
    }
    log(`  rewards: ${household.rewards.length} added (placeholder prices, edit in admin)`);
  } else {
    log(`  rewards: ${existingRewards.length} already present, left untouched`);
  }
}
