import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { hashSecret } from '@/lib/auth-hash';
import { getSettings } from '@/lib/settings';
import { getSetupState } from '@/lib/setup';
import { GET as health } from '@/app/api/health/route';

/**
 * The live planner's database as it is BEFORE migration 0009: no
 * session_secret column. If this code is deployed first by mistake, unlocking
 * and the health check must still work.
 */
beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
  await db.execute(sql`alter table settings drop column session_secret`);
  await db.execute(sql`insert into settings (id, household_passcode_hash, parent_pin_hash)
    values (1, ${await hashSecret('the-real-passcode')}, ${await hashSecret('4271')})`);
});

describe('new code on a database without the new column', () => {
  it('still reads the settings the lock screen needs', async () => {
    const s = await getSettings();
    expect(s.id).toBe(1);
    expect(s.householdPasscodeHash).toMatch(/^\$2/);
  });

  it('still reports the planner as set up', async () => {
    expect(await getSetupState(getDb)).toBe('ready');
  });

  it('still reports healthy', async () => {
    const res = await health();
    const body = await res.json();
    expect(body).toMatchObject({ database: 'reachable', seeded: true, sessionSecret: 'ok' });
    expect(res.status).toBe(200);
  });
});
