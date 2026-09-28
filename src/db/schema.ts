/**
 * Family dashboard schema.
 *
 * Conventions that apply throughout and are easy to get wrong:
 *
 *  - Day-shaped values are `date` columns in `string` mode, so they arrive as
 *    'YYYY-MM-DD' and never become a Date with an accidental timezone.
 *  - `days_of_week` is an integer array using JS convention: 0 = Sunday .. 6 = Saturday.
 *  - Timestamps are `timestamptz` and stored in UTC.
 *  - Points balances are DERIVED by summing points_ledger. There is deliberately
 *    no balance column anywhere in this file. Do not add one.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  time,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const personRole = pgEnum('person_role', ['parent', 'child']);
export const partOfDay = pgEnum('part_of_day', ['morning', 'evening']);
export const lunchChoice = pgEnum('lunch_choice', ['school', 'packed', 'none']);
export const ledgerSource = pgEnum('ledger_source', ['chore', 'reward', 'manual']);
/**
 * Weekends are NOT stored here. They are derived from the date.
 * Storing them would rot the moment a year's rows were not entered.
 */
export const nonSchoolReason = pgEnum('non_school_reason', ['holiday', 'inset', 'sick', 'other']);
export const homeworkKind = pgEnum('homework_kind', ['weekly', 'one_off']);

/* ------------------------------------------------------------------ people */

export const people = pgTable('people', {
  id: serial('id').primaryKey(),
  /** First name only. No surnames anywhere in this app. */
  name: text('name').notNull(),
  /** What appears on the wall. May be a nickname. */
  displayName: text('display_name').notNull(),
  role: personRole('role').notNull(),
  /** Hex, e.g. '#0072B2'. The primary identifier for a child across the whole app. */
  colour: text('colour').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  /**
   * Show today's lunch on this child's morning card, and the school dinner
   * menu box for them in the week planner. Off by default;
   * editable in People admin.
   */
  showLunchOnCard: boolean('show_lunch_on_card').notNull().default(false),
});

/* ------------------------------------------------------------------ events */

export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    icon: text('icon').notNull(),
    /** Set for a one-off event. Null for a recurring one. */
    date: date('date', { mode: 'string' }),
    /** Set for a recurring event (0 = Sunday). Null for a one-off. */
    daysOfWeek: integer('days_of_week').array(),
    /** Optional bounds for a recurring event, e.g. "swimming until 12 December". */
    startsOn: date('starts_on', { mode: 'string' }),
    endsOn: date('ends_on', { mode: 'string' }),
    startTime: time('start_time'),
    endTime: time('end_time'),
    location: text('location'),
    notes: text('notes'),
    isSchoolRelated: boolean('is_school_related').notNull().default(false),
  },
  (t) => [
    // An event is either a single date or a weekly rule. Never both, never neither.
    check(
      'events_exactly_one_schedule_mode',
      sql`(${t.date} IS NOT NULL AND ${t.daysOfWeek} IS NULL)
       OR (${t.date} IS NULL AND ${t.daysOfWeek} IS NOT NULL)`,
    ),
    check(
      'events_end_after_start',
      sql`${t.endsOn} IS NULL OR ${t.startsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`,
    ),
  ],
);

/** No rows = a whole-family event, displayed in a neutral colour. */
export const eventPeople = pgTable(
  'event_people',
  {
    eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.personId] })],
);

/* ---------------------------------------------------------------- routines */

export const routineTasks = pgTable('routine_tasks', {
  id: serial('id').primaryKey(),
  personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  /** Required. Spec: there are no text-only tasks. */
  icon: text('icon').notNull(),
  partOfDay: partOfDay('part_of_day').notNull().default('morning'),
  /**
   * Stage of the morning: 'Breakfast', 'Bathroom', 'Getting dressed', 'Ready to go'.
   * Sixteen tiles at once is too much for a four-year-old; grouping them into
   * stages means only one small set is ever being looked at.
   */
  category: text('category').notNull().default('Morning'),
  /** Global sequence. Categories are contiguous blocks within it. */
  sortOrder: integer('sort_order').notNull().default(0),
  /** Hard calendar filter, 0 = Sunday. */
  daysOfWeek: integer('days_of_week').array().notNull(),
  /** ANDed with daysOfWeek: additionally requires the date to be a school day. */
  schoolDaysOnly: boolean('school_days_only').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
});

/**
 * A completion is a row. Unticking DELETES the row - undo must be instant and
 * consequence-free for a four-year-old who mistapped.
 */
export const routineCompletions = pgTable(
  'routine_completions',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id').notNull().references(() => routineTasks.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('routine_completions_task_date').on(t.taskId, t.date)],
);

/* ------------------------------------------------------------------ chores */

export const chores = pgTable('chores', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  icon: text('icon').notNull(),
  /** Null = unassigned, up for grabs by any child. */
  personId: integer('person_id').references(() => people.id, { onDelete: 'set null' }),
  points: integer('points').notNull().default(1),
  daysOfWeek: integer('days_of_week').array(),
  /** On by default: stars wait for a grown-up. Switch off per job to pay instantly. */
  requiresApproval: boolean('requires_approval').notNull().default(true),
  /**
   * For a job open to anyone: true = one child claims it per day ("Feed
   * the dog"), false = each child does their own ("Make your bed"). Ignored
   * for a job assigned to one child.
   */
  onePerDay: boolean('one_per_day').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
});

/**
 * onDelete is deliberately 'set null': deleting a chore must never delete the
 * rows it produced, or a child's historical balance silently changes.
 */
export const choreCompletions = pgTable(
  'chore_completions',
  {
    id: serial('id').primaryKey(),
    choreId: integer('chore_id').references(() => chores.id, { onDelete: 'set null' }),
    personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
    /** Snapshot of title/points at completion time, so history survives edits. */
    choreTitle: text('chore_title').notNull(),
    pointsAwarded: integer('points_awarded').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: integer('approved_by').references(() => people.id, { onDelete: 'set null' }),
  },
  (t) => [unique('chore_completions_chore_person_date').on(t.choreId, t.personId, t.date)],
);

/* ----------------------------------------------------------------- rewards */

export const rewards = pgTable('rewards', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  icon: text('icon').notNull(),
  costPoints: integer('cost_points').notNull(),
  /** Null = available to every child. */
  personId: integer('person_id').references(() => people.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').notNull().default(true),
});

/**
 * The only source of truth for points. A balance is SUM(delta) for a person.
 * Rows are append-only: corrections are new rows with a reason, never edits.
 */
export const pointsLedger = pgTable('points_ledger', {
  id: serial('id').primaryKey(),
  personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  sourceType: ledgerSource('source_type').notNull(),
  /** Soft reference only - no FK, so deleting a chore cannot corrupt history. */
  sourceId: integer('source_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------- meals and lunches */

export const meals = pgTable('meals', {
  id: serial('id').primaryKey(),
  date: date('date', { mode: 'string' }).notNull().unique(),
  title: text('title').notNull(),
  icon: text('icon').notNull(),
  notes: text('notes'),
});

/** An explicit choice for one date. Overrides lunch_defaults for that date. */
export const lunchChoices = pgTable(
  'lunch_choices',
  {
    id: serial('id').primaryKey(),
    personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    choice: lunchChoice('choice').notNull(),
    /**
     * What the school dinner is, e.g. "Fish fingers and chips". Only
     * ever set with choice = 'school'; cleared when the choice changes away.
     */
    dish: text('dish'),
  },
  (t) => [unique('lunch_choices_person_date').on(t.personId, t.date)],
);

/** The standing pattern, e.g. "school dinners on Mondays and Thursdays". */
export const lunchDefaults = pgTable(
  'lunch_defaults',
  {
    id: serial('id').primaryKey(),
    personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    choice: lunchChoice('choice').notNull(),
  },
  (t) => [
    unique('lunch_defaults_person_day').on(t.personId, t.dayOfWeek),
    check('lunch_defaults_day_range', sql`${t.dayOfWeek} BETWEEN 0 AND 6`),
  ],
);

/* ---------------------------------------------------------------- homework */

/**
 * A piece of homework for one child. Separate from chores: no points, a
 * weekly target rather than once a day, and several ticks allowed in a day.
 *
 * - `weekly`: `target_per_week` ticks, counted from the homework week start
 *   day in settings. "Read with a grown-up" = 3; times-tables practice = 4,
 *   with `unit_label` "25 correct" so each tick is a quarter of the 100.
 * - `one_off`: one tick and it is done. Shown from `set_on` until ticked, and
 *   marked overdue after `due_date` rather than disappearing.
 */
export const homeworkItems = pgTable(
  'homework_items',
  {
    id: serial('id').primaryKey(),
    personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Required, as for every task: two of the children cannot read yet. */
    icon: text('icon').notNull(),
    kind: homeworkKind('kind').notNull(),
    targetPerWeek: integer('target_per_week'),
    unitLabel: text('unit_label'),
    dueDate: date('due_date', { mode: 'string' }),
    setOn: date('set_on', { mode: 'string' }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('homework_target_range', sql`${t.targetPerWeek} IS NULL OR ${t.targetPerWeek} BETWEEN 1 AND 20`),
  ],
);

/**
 * One tick. No unique-per-day rule: a child can do two lots of practice in
 * an evening. Unticking deletes the latest row, the same instant undo the
 * morning routine has.
 */
export const homeworkCompletions = pgTable('homework_completions', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => homeworkItems.id, { onDelete: 'cascade' }),
  personId: integer('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------- non-school days */

export const nonSchoolDays = pgTable('non_school_days', {
  id: serial('id').primaryKey(),
  date: date('date', { mode: 'string' }).notNull().unique(),
  reason: nonSchoolReason('reason').notNull(),
  /** Optional human label, e.g. 'October half term'. */
  label: text('label'),
});

/* ---------------------------------------------------------------- settings */

/** Single row, enforced by a check constraint on the primary key. */
export const settings = pgTable(
  'settings',
  {
    id: integer('id').primaryKey().default(1),
    householdPasscodeHash: text('household_passcode_hash').notNull(),
    parentPinHash: text('parent_pin_hash').notNull(),
    dayRolloverHour: integer('day_rollover_hour').notNull().default(3),
    /** Hour after which the kiosk dims to the night theme. */
    nightThemeFromHour: integer('night_theme_from_hour').notNull().default(19),
    /** Day the homework week starts, 0 = Sunday. Thursday, when it comes home. */
    homeworkWeekStartDay: integer('homework_week_start_day').notNull().default(4),
    /**
     * Cookie-signing secret generated by /setup, used ONLY when the SESSION_SECRET
     * environment variable is unset. Null wherever SESSION_SECRET is set.
     */
    sessionSecret: text('session_secret'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('settings_single_row', sql`${t.id} = 1`),
    check('settings_rollover_range', sql`${t.dayRolloverHour} BETWEEN 0 AND 23`),
    check('settings_homework_week_start_range', sql`${t.homeworkWeekStartDay} BETWEEN 0 AND 6`),
  ],
);

/* ----------------------------------------------------------- auth attempts */

/**
 * Passcode/PIN attempt log, used for rate limiting.
 *
 * This lives in the database rather than in memory on purpose: Vercel may run
 * several instances, and an in-memory counter is trivially defeated by an
 * attacker whose requests land on different ones. Rows are pruned on write.
 *
 * The IP is stored as a salted hash, not in the clear.
 */
export const authAttempts = pgTable('auth_attempts', {
  id: serial('id').primaryKey(),
  ipHash: text('ip_hash').notNull(),
  kind: text('kind').notNull(),
  succeeded: boolean('succeeded').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
});
