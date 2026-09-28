import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The existing planner has SESSION_SECRET set in Vercel. That path must never
 * consult the database, so the secret its cookies are signed with cannot change.
 */
const getDbSpy = vi.hoisted(() => vi.fn());
vi.mock('@/db', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/db')>();
  getDbSpy.mockImplementation(real.getDb);
  return { ...real, getDb: getDbSpy };
});

const { resolveSessionSecret } = await import('@/lib/session');
const ENV_SECRET = process.env.SESSION_SECRET;

afterEach(() => {
  process.env.SESSION_SECRET = ENV_SECRET;
});

describe('resolveSessionSecret', () => {
  it('uses SESSION_SECRET without touching the database', async () => {
    expect(await resolveSessionSecret()).toBe(ENV_SECRET);
    expect(getDbSpy).not.toHaveBeenCalled();
  });

  it('still rejects a short SESSION_SECRET rather than falling back', async () => {
    process.env.SESSION_SECRET = 'too-short';
    await expect(resolveSessionSecret()).rejects.toThrow(/at least 32/);
    expect(getDbSpy).not.toHaveBeenCalled();
  });

  it('with no SESSION_SECRET and no stored one, fails with the original message', async () => {
    delete process.env.SESSION_SECRET;
    await expect(resolveSessionSecret()).rejects.toThrow(/SESSION_SECRET is not set/);
  });
});
