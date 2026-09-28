import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { getDb } from '@/db';
import { settings } from '@/db/schema';
import { hashSecret, verifySecret } from '@/lib/auth-hash';
import { changeCredential } from '@/lib/credentials';

const PASSCODE = 'our-house';
const PIN = '2580';

async function current() {
  const db = await getDb();
  const [row] = await db.select().from(settings);
  return row;
}

beforeAll(async () => {
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: './drizzle' });
});

beforeEach(async () => {
  const db = await getDb();
  await db.delete(settings);
  await db.insert(settings).values({
    id: 1,
    householdPasscodeHash: await hashSecret(PASSCODE),
    parentPinHash: await hashSecret(PIN),
    sessionSecret: 's'.repeat(43),
    homeworkWeekStartDay: 2,
  });
});

describe('changing the household passcode', () => {
  it('changes it with the right PIN, and only the passcode changes', async () => {
    const before = await current();
    const r = await changeCredential(await getDb(), 'passcode', {
      currentPin: PIN, newValue: 'new-house', newValueAgain: 'new-house',
    });
    expect(r).toEqual({ ok: true });

    const after = await current();
    expect(await verifySecret('new-house', after.householdPasscodeHash)).toBe(true);
    expect(await verifySecret(PASSCODE, after.householdPasscodeHash)).toBe(false);
    expect(after.parentPinHash).toBe(before.parentPinHash);
    expect(after.sessionSecret).toBe(before.sessionSecret);
    expect(after.homeworkWeekStartDay).toBe(2);
  });

  it('refuses a wrong PIN and changes nothing', async () => {
    const before = await current();
    const r = await changeCredential(await getDb(), 'passcode', {
      currentPin: '1111', newValue: 'new-house', newValueAgain: 'new-house',
    });
    expect(r).toMatchObject({ ok: false, reason: 'wrong-pin' });
    expect(await current()).toEqual(before);
  });

  it.each([
    ['too short', { newValue: 'abc', newValueAgain: 'abc' }],
    ['mismatched', { newValue: 'new-house', newValueAgain: 'new-hous' }],
    ['a malformed current PIN', { currentPin: '12', newValue: 'new-house', newValueAgain: 'new-house' }],
  ])('rejects %s without checking the PIN', async (_label, patch) => {
    const before = await current();
    const r = await changeCredential(await getDb(), 'passcode', { currentPin: PIN, ...patch });
    expect(r).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await current()).toEqual(before);
  });
});

describe("changing the grown-ups' PIN", () => {
  it('changes it with the right current PIN, and only the PIN changes', async () => {
    const before = await current();
    const r = await changeCredential(await getDb(), 'pin', {
      currentPin: PIN, newValue: '4826', newValueAgain: '4826',
    });
    expect(r).toEqual({ ok: true });

    const after = await current();
    expect(await verifySecret('4826', after.parentPinHash)).toBe(true);
    expect(await verifySecret(PIN, after.parentPinHash)).toBe(false);
    expect(after.householdPasscodeHash).toBe(before.householdPasscodeHash);
  });

  it('refuses a wrong current PIN and changes nothing', async () => {
    const before = await current();
    const r = await changeCredential(await getDb(), 'pin', {
      currentPin: '0000', newValue: '4826', newValueAgain: '4826',
    });
    expect(r).toMatchObject({ ok: false, reason: 'wrong-pin' });
    expect(await current()).toEqual(before);
  });

  it.each([
    ['3 digits', '482'],
    ['letters', 'abcd'],
    ['5 digits', '48261'],
  ])('rejects a new PIN of %s', async (_label, value) => {
    const r = await changeCredential(await getDb(), 'pin', {
      currentPin: PIN, newValue: value, newValueAgain: value,
    });
    expect(r).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('reports a planner that is not set up', async () => {
    const db = await getDb();
    await db.delete(settings);
    const r = await changeCredential(db, 'pin', { currentPin: PIN, newValue: '4826', newValueAgain: '4826' });
    expect(r).toMatchObject({ ok: false, reason: 'not-set-up' });
  });
});
