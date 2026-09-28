import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { getDb } from '@/db';
import { people, routineTasks, settings } from '@/db/schema';
import { seedHousehold } from '@/lib/household-seed';
import { runSetup, type SetupInput } from '@/lib/setup';

const opts = { expectedCode: 'blue-giraffe-42', envSessionSecret: 'y'.repeat(40) };

const family = (child: string, pin: string): SetupInput => ({
  setupCode: 'blue-giraffe-42',
  parents: [{ name: 'Sam', icon: '🧔' }],
  children: [{ name: child, colour: '#EFB0CC', icon: '🌸' }],
  passcode: 'our-house', passcodeAgain: 'our-house', pin, pinAgain: pin,
});

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
});

describe('/setup when something goes wrong', () => {
  it('releases the planner if adding the family fails, so it can be retried', async () => {
    const r = await runSetup(getDb, family('Wrongname', '1111'), {
      ...opts,
      seed: async (db, household) => {
        await seedHousehold(db, { ...household, chores: [], rewards: [] });
        throw new Error('network dropped');
      },
    });
    expect(r).toMatchObject({ ok: false, reason: 'failed' });
    const db = await getDb();
    expect(await db.select().from(settings)).toEqual([]);
    expect(await db.select().from(people)).toEqual([]);
    expect(await db.select().from(routineTasks)).toEqual([]);
  });

  it('lets exactly one of two simultaneous attempts win', async () => {
    const results = await Promise.all([
      runSetup(getDb, family('Ruby', '2222'), opts),
      runSetup(getDb, family('Max', '3333'), opts),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === 'already-set-up')).toHaveLength(1);

    const db = await getDb();
    const kids = (await db.select().from(people)).filter((p) => p.role === 'child');
    expect(kids).toHaveLength(1);
  });

  it('does not store a secret when Vercel already has SESSION_SECRET', async () => {
    const db = await getDb();
    const [row] = await db.select().from(settings);
    expect(row.sessionSecret).toBeNull();
  });
});
