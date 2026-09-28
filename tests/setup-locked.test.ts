import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { people, pointsLedger } from '@/db/schema';
import { EXAMPLE_FAMILY } from '@/lib/family';
import { createSettingsIfAbsent, seedHousehold } from '@/lib/household-seed';
import { starterHousehold } from '@/lib/starter-household';
import { getSetupState, runSetup, type SetupInput } from '@/lib/setup';

/**
 * An EXISTING planner (seeded from the terminal, SESSION_SECRET in the
 * environment) with some real use on top. /setup must not change one byte of
 * it, however it is called.
 */

async function snapshot(): Promise<string> {
  const db = await getDb();
  const tables = await db.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`);
  const out: Record<string, unknown> = {};
  for (const { table_name } of tables.rows) {
    out[table_name] = (await db.execute(sql.raw(`select * from "${table_name}" order by 1`))).rows;
  }
  return JSON.stringify(out);
}

const intruder: SetupInput = {
  setupCode: 'correct horse battery',
  parents: [{ name: 'Mallory', displayName: 'Mal', icon: '🧑' }],
  children: [{ name: 'Eve', colour: '#7FB3DA', icon: '🦋' }],
  passcode: 'taken-over',
  passcodeAgain: 'taken-over',
  pin: '0000',
  pinAgain: '0000',
};

let before: string;

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
  await createSettingsIfAbsent(db, { passcode: 'the-real-passcode', pin: '4271' });
  await seedHousehold(db, starterHousehold(EXAMPLE_FAMILY.parents, EXAMPLE_FAMILY.children));
  const [child] = await db.select().from(people).where(sql`${people.role} = 'child'`).limit(1);
  await db.insert(pointsLedger).values({ personId: child.id, delta: 7, reason: 'Stars earned', sourceType: 'manual' });
  before = await snapshot();
});

describe('/setup on a planner that is already set up', () => {
  it('reports the planner as set up', async () => {
    expect(await getSetupState(getDb)).toBe('ready');
  });

  it('refuses even with the right setup word, and changes nothing', async () => {
    const result = await runSetup(getDb, intruder, {
      expectedCode: 'correct horse battery', envSessionSecret: 'x'.repeat(40),
    });
    expect(result).toMatchObject({ ok: false, reason: 'already-set-up' });
    expect(await snapshot()).toBe(before);
  });

  it('refuses when Vercel has no SESSION_SECRET either, and stores no secret', async () => {
    const result = await runSetup(getDb, intruder, {
      expectedCode: 'correct horse battery', envSessionSecret: undefined,
    });
    expect(result).toMatchObject({ ok: false, reason: 'already-set-up' });
    expect(await snapshot()).toBe(before);
  });

  it('refuses with a wrong setup word before touching the database', async () => {
    const result = await runSetup(getDb, { ...intruder, setupCode: 'guess' }, {
      expectedCode: 'correct horse battery', envSessionSecret: undefined,
    });
    expect(result).toMatchObject({ ok: false, reason: 'bad-code' });
    expect(await snapshot()).toBe(before);
  });

  it('refuses when no setup word is configured at all (as on the original planner)', async () => {
    const result = await runSetup(getDb, intruder, { expectedCode: undefined, envSessionSecret: undefined });
    expect(result).toMatchObject({ ok: false, reason: 'no-code-configured' });
    expect(await snapshot()).toBe(before);
  });

  it('refuses a second time running the same attempt in parallel', async () => {
    const opts = { expectedCode: 'correct horse battery', envSessionSecret: undefined };
    const results = await Promise.all([
      runSetup(getDb, intruder, opts), runSetup(getDb, intruder, opts), runSetup(getDb, intruder, opts),
    ]);
    expect(results.every((r) => !r.ok && r.reason === 'already-set-up')).toBe(true);
    expect(await snapshot()).toBe(before);
  });
});
