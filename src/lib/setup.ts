/**
 * First-run setup for a brand-new planner. Auth-free so tests can call it.
 *
 * The one rule everything here serves: on a planner that is already set up,
 * this must change nothing. "Set up" means the settings row exists, and the
 * only write that can happen before that row is confirmed absent is none.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Database } from '@/db';
import { migrateDatabase } from '@/db/migrate-runtime';
import { createSettingsIfAbsent, seedHousehold } from '@/lib/household-seed';
import { GROWN_UP_ICONS, SUGGESTED_COLOURS, SUGGESTED_ICONS } from '@/lib/palette';
import { GROWN_UP_COLOUR, starterHousehold } from '@/lib/starter-household';

export type SetupState = 'ready' | 'needs-setup' | 'unknown';

export const MIN_SETUP_CODE_LENGTH = 8;

/** Postgres "undefined_table": a brand-new database with no tables yet. */
function isMissingTable(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if (typeof e === 'object' && (e as { code?: unknown }).code === '42P01') return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * 'needs-setup' only on positive evidence: the settings table is empty, or it
 * does not exist. Any other failure (Neon asleep, network, bad credentials) is
 * 'unknown', and nothing is written on 'unknown'.
 */
export async function getSetupState(getDb: () => Promise<Database>): Promise<SetupState> {
  try {
    const db = await getDb();
    const rows = await db.select({ id: schema.settings.id }).from(schema.settings);
    return rows.length > 0 ? 'ready' : 'needs-setup';
  } catch (err) {
    return isMissingTable(err) ? 'needs-setup' : 'unknown';
  }
}

const personName = z.string().trim().min(1, 'Every person needs a name').max(30, 'Keep names under 30 letters');

export const setupSchema = z
  .object({
    setupCode: z.string().max(200),
    parents: z
      .array(z.object({
        name: personName,
        displayName: z.string().trim().max(30).optional(),
        icon: z.enum(GROWN_UP_ICONS),
      }))
      .min(1, 'Add at least one grown-up')
      .max(4),
    children: z
      .array(z.object({
        name: personName,
        colour: z.enum(SUGGESTED_COLOURS.map((c) => c.hex) as [string, ...string[]]),
        icon: z.enum(SUGGESTED_ICONS as unknown as [string, ...string[]]),
      }))
      .min(1, 'Add at least one child')
      .max(6, 'Up to six children'),
    passcode: z.string().min(6, 'The passcode needs at least 6 characters').max(200),
    passcodeAgain: z.string(),
    pin: z.string().regex(/^\d{4}$/, 'The PIN is exactly 4 numbers'),
    pinAgain: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.passcode !== v.passcodeAgain) ctx.addIssue({ code: 'custom', message: 'The two passcodes do not match' });
    if (v.pin !== v.pinAgain) ctx.addIssue({ code: 'custom', message: 'The two PINs do not match' });
    const names = [...v.parents, ...v.children].map((p) => p.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: 'custom', message: 'Two people have the same name. Add an initial to tell them apart.' });
    }
    const colours = v.children.map((c) => c.colour);
    if (new Set(colours).size !== colours.length) {
      ctx.addIssue({ code: 'custom', message: 'Give each child a different colour' });
    }
    const icons = v.children.map((c) => c.icon);
    if (new Set(icons).size !== icons.length) {
      ctx.addIssue({ code: 'custom', message: 'Give each child a different picture' });
    }
  });

export type SetupInput = z.infer<typeof setupSchema>;

export type SetupResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'already-set-up' | 'no-code-configured' | 'code-too-short' | 'bad-code' | 'unreachable' | 'failed';
      message: string;
    };

const digest = (s: string) => createHash('sha256').update(s.trim().toLowerCase()).digest();

/** Forgiving about case and stray spaces: this is typed on an iPad by a beginner. */
export function setupCodeMatches(provided: string, expected: string): boolean {
  return timingSafeEqual(digest(provided), digest(expected));
}

export async function runSetup(
  getDb: () => Promise<Database>,
  input: SetupInput,
  opts: {
    expectedCode: string | undefined;
    envSessionSecret: string | undefined;
    seed?: typeof seedHousehold;
  },
): Promise<SetupResult> {
  const expected = opts.expectedCode?.trim();
  if (!expected) {
    return {
      ok: false, reason: 'no-code-configured',
      message: 'This planner has no setup word yet. Add SETUP_CODE in Vercel, redeploy, then come back.',
    };
  }
  if (expected.length < MIN_SETUP_CODE_LENGTH) {
    return {
      ok: false, reason: 'code-too-short',
      message: `The setup word chosen in Vercel is too short. It needs at least ${MIN_SETUP_CODE_LENGTH} letters.`,
    };
  }
  if (!setupCodeMatches(input.setupCode, expected)) {
    return { ok: false, reason: 'bad-code', message: 'That setup word is not right.' };
  }

  const alreadySetUp = {
    ok: false as const, reason: 'already-set-up' as const,
    message: 'This planner is already set up.',
  };

  const before = await getSetupState(getDb);
  if (before === 'ready') return alreadySetUp;
  if (before === 'unknown') {
    return { ok: false, reason: 'unreachable', message: 'Could not reach the database. Wait a minute and try again.' };
  }

  const db = await getDb();
  await migrateDatabase(db);

  // Claim the planner. If anyone got here first, the database refuses us.
  const claimed = await createSettingsIfAbsent(db, {
    passcode: input.passcode,
    pin: input.pin,
    // Only needed when Vercel has no SESSION_SECRET; see resolveSessionSecret().
    sessionSecret: opts.envSessionSecret ? null : randomBytes(32).toString('base64url'),
  });
  if (!claimed) return alreadySetUp;

  const household = starterHousehold(
    input.parents.map((p, i) => ({
      name: p.name.trim(),
      displayName: p.displayName?.trim() || p.name.trim(),
      colour: GROWN_UP_COLOUR,
      icon: p.icon,
      sortOrder: i,
    })),
    input.children.map((c, i) => ({
      name: c.name.trim(), displayName: c.name.trim(), colour: c.colour, icon: c.icon, sortOrder: i,
    })),
  );

  try {
    await (opts.seed ?? seedHousehold)(db, household);
  } catch (err) {
    // Release our claim so the family can simply try again, possibly with
    // different names. Only reachable by the request that created the settings
    // row a moment ago, on a database that had none: there is no one else's
    // household here to lose. People cascade to their routine tasks.
    await db.delete(schema.people);
    await db.delete(schema.settings).where(eq(schema.settings.id, 1));
    console.error('Setup failed while adding the household:', err);
    return { ok: false, reason: 'failed', message: 'Something went wrong adding your family. Please try again.' };
  }
  return { ok: true };
}
