import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  chores, events, homeworkItems, nonSchoolDays, people, rewards, routineTasks, settings,
} from '@/db/schema';
import { verifySecret } from '@/lib/auth-hash';
import { getSetupState, runSetup, setupSchema, type SetupInput } from '@/lib/setup';
import { STARTER_ROUTINE } from '@/lib/starter-household';

/** A brand-new planner: an empty database with no tables at all. */

const CODE = 'blue-giraffe-42';

const family: SetupInput = {
  setupCode: '  Blue-Giraffe-42 ',
  parents: [
    { name: 'Sam', displayName: 'Dad', icon: '🧔' },
    { name: 'Jo', displayName: '', icon: '👩' },
  ],
  children: [
    { name: 'Ruby', colour: '#EFB0CC', icon: '🌸' },
    { name: 'Max', colour: '#7FCFC4', icon: '🦕' },
  ],
  passcode: 'our-house',
  passcodeAgain: 'our-house',
  pin: '2580',
  pinAgain: '2580',
};

async function tableExists(name: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.execute(sql`select to_regclass(${`public.${name}`}) as t`);
  return (r.rows[0] as { t: string | null }).t !== null;
}

describe('/setup on a brand-new planner', () => {
  it('sees an empty database as needing setup', async () => {
    expect(await tableExists('settings')).toBe(false);
    expect(await getSetupState(getDb)).toBe('needs-setup');
  });

  it('creates nothing when the setup word is wrong', async () => {
    const r = await runSetup(getDb, { ...family, setupCode: 'nope' }, {
      expectedCode: CODE, envSessionSecret: undefined,
    });
    expect(r).toMatchObject({ ok: false, reason: 'bad-code' });
    expect(await tableExists('settings')).toBe(false);
  });

  it('creates nothing when the setup word configured in Vercel is too short', async () => {
    const r = await runSetup(getDb, { ...family, setupCode: 'abc' }, {
      expectedCode: 'abc', envSessionSecret: undefined,
    });
    expect(r).toMatchObject({ ok: false, reason: 'code-too-short' });
    expect(await tableExists('settings')).toBe(false);
  });

  it('sets up the family, forgiving case and spaces in the setup word', async () => {
    const r = await runSetup(getDb, family, { expectedCode: CODE, envSessionSecret: undefined });
    expect(r).toEqual({ ok: true });
    expect(await getSetupState(getDb)).toBe('ready');

    const db = await getDb();
    const everyone = await db.select().from(people).orderBy(people.role, people.sortOrder);
    expect(everyone.map((p) => [p.role, p.name, p.displayName])).toEqual([
      ['parent', 'Sam', 'Dad'], ['parent', 'Jo', 'Jo'],
      ['child', 'Ruby', 'Ruby'], ['child', 'Max', 'Max'],
    ]);
    const tasks = await db.select().from(routineTasks);
    expect(tasks.length).toBe(20);
    const starterTitles = new Set(Object.values(STARTER_ROUTINE).flat().map((t) => t.title));
    expect(tasks.every((t) => starterTitles.has(t.title))).toBe(true);
    expect((await db.select().from(chores)).length).toBe(6);
    expect((await db.select().from(rewards)).length).toBe(5);
    expect(await db.select().from(events)).toEqual([]);
    expect(await db.select().from(homeworkItems)).toEqual([]);
    expect(await db.select().from(nonSchoolDays)).toEqual([]);
  });

  it('stores working credentials and a strong session secret', async () => {
    const db = await getDb();
    const [row] = await db.select().from(settings);
    expect(await verifySecret('our-house', row.householdPasscodeHash)).toBe(true);
    expect(await verifySecret('2580', row.parentPinHash)).toBe(true);
    expect(row.sessionSecret?.length).toBeGreaterThanOrEqual(43);
  });

  it('refuses to run a second time', async () => {
    const r = await runSetup(getDb, { ...family, pin: '1111', pinAgain: '1111' }, {
      expectedCode: CODE, envSessionSecret: undefined,
    });
    expect(r).toMatchObject({ ok: false, reason: 'already-set-up' });
    const db = await getDb();
    const [row] = await db.select().from(settings);
    expect(await verifySecret('2580', row.parentPinHash)).toBe(true);
  });
});

describe('the setup form rules', () => {
  const parse = (patch: Partial<SetupInput>) => setupSchema.safeParse({ ...family, ...patch });

  it('accepts the example family', () => {
    expect(parse({}).success).toBe(true);
  });

  it.each([
    ['mismatched passcodes', { passcodeAgain: 'other' }],
    ['mismatched PINs', { pinAgain: '0000' }],
    ['a short passcode', { passcode: 'abc', passcodeAgain: 'abc' }],
    ['a 3-digit PIN', { pin: '123', pinAgain: '123' }],
    ['no children', { children: [] }],
    ['two children with one colour', {
      children: [{ name: 'A', colour: '#EFB0CC', icon: '🌸' }, { name: 'B', colour: '#EFB0CC', icon: '🦕' }],
    }],
    ['two children with one picture', {
      children: [{ name: 'A', colour: '#EFB0CC', icon: '🌸' }, { name: 'B', colour: '#7FCFC4', icon: '🌸' }],
    }],
    ['a colour outside the safe palette', { children: [{ name: 'A', colour: '#FF0000', icon: '🌸' }] }],
    ['two people with the same name', {
      children: [{ name: 'sam', colour: '#EFB0CC', icon: '🌸' }],
    }],
  ])('rejects %s', (_label, patch) => {
    expect(parse(patch as Partial<SetupInput>).success).toBe(false);
  });
});
