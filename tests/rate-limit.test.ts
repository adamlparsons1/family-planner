import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { getDb } from '@/db';
import { authAttempts } from '@/db/schema';
import { isRateLimited, recentFailures, recordAttempt, MAX_ATTEMPTS_PER_MINUTE } from '@/lib/rate-limit';

/**
 * Runs against a throwaway in-memory Postgres (see tests/setup-env.ts), so this
 * exercises the real SQL rather than a mock.
 */
beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
});

const IP_A = '203.0.113.10';
const IP_B = '203.0.113.99';

describe('passcode rate limiting', () => {
  it('starts unlimited', async () => {
    expect(await isRateLimited(IP_A, 'household')).toBe(false);
  });

  it('blocks after 5 failures in a minute', async () => {
    for (let i = 0; i < MAX_ATTEMPTS_PER_MINUTE; i++) {
      expect(await isRateLimited(IP_A, 'household')).toBe(false);
      await recordAttempt(IP_A, 'household', false);
    }
    expect(await isRateLimited(IP_A, 'household')).toBe(true);
    expect(await recentFailures(IP_A, 'household')).toBe(MAX_ATTEMPTS_PER_MINUTE);
  });

  it('does not punish a different IP for the first one\'s failures', async () => {
    expect(await isRateLimited(IP_B, 'household')).toBe(false);
  });

  it('tracks the PIN separately from the passcode', async () => {
    // IP_A is blocked for 'household' but has made no PIN attempts.
    expect(await isRateLimited(IP_A, 'household')).toBe(true);
    expect(await isRateLimited(IP_A, 'pin')).toBe(false);
  });

  it('ignores successful attempts when counting', async () => {
    for (let i = 0; i < 10; i++) await recordAttempt(IP_B, 'pin', true);
    expect(await recentFailures(IP_B, 'pin')).toBe(0);
    expect(await isRateLimited(IP_B, 'pin')).toBe(false);
  });

  it('ignores failures older than the one-minute window', async () => {
    const db = await getDb();
    await db.delete(authAttempts);
    // Six failures, but all from two minutes ago.
    const old = new Date(Date.now() - 120_000);
    for (let i = 0; i < 6; i++) {
      await recordAttempt(IP_A, 'household', false);
    }
    await db.update(authAttempts).set({ attemptedAt: old });
    expect(await recentFailures(IP_A, 'household')).toBe(0);
    expect(await isRateLimited(IP_A, 'household')).toBe(false);
  });

  it('stores a hash of the IP, never the IP itself', async () => {
    const db = await getDb();
    await db.delete(authAttempts);
    await recordAttempt(IP_A, 'household', false);
    const rows = await db.select().from(authAttempts);
    expect(rows).toHaveLength(1);
    expect(rows[0].ipHash).not.toContain(IP_A);
    expect(rows[0].ipHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
