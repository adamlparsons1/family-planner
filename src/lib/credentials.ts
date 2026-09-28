/**
 * Changing the household passcode and the grown-ups' PIN from inside the app.
 * Auth-free so tests can call it; the server actions add the PIN session gate
 * and rate limiting.
 *
 * Both changes need the CURRENT PIN typed again, even though the PIN session is
 * already unlocked: that session lasts 30 minutes on a shared kiosk iPad, and a
 * child who finds it open must not be able to lock the grown-ups out.
 *
 * The passcode deliberately does not need the current passcode. A grown-up who
 * has forgotten it, but has a device still signed in and knows the PIN, can
 * set a new one. That is the most common reason to change it.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Database } from '@/db';
import { hashSecret, verifySecret } from '@/lib/auth-hash';

export const passcodeRule = z
  .string()
  .min(6, 'The passcode needs at least 6 characters')
  .max(200, 'That passcode is too long');
export const pinRule = z.string().regex(/^\d{4}$/, 'The PIN is exactly 4 numbers');

export type CredentialKind = 'passcode' | 'pin';

export type ChangeInput = {
  currentPin: string;
  newValue: string;
  newValueAgain: string;
};

export type ChangeResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'wrong-pin' | 'not-set-up'; error: string };

/** Check the new value's rules before the PIN, so a typo never costs an attempt. */
export function validateChange(kind: CredentialKind, input: ChangeInput): ChangeResult | null {
  const rule = kind === 'passcode' ? passcodeRule : pinRule;
  const parsed = rule.safeParse(input.newValue);
  if (!parsed.success) return { ok: false, reason: 'invalid', error: parsed.error.issues[0].message };
  if (input.newValue !== input.newValueAgain) {
    return {
      ok: false, reason: 'invalid',
      error: kind === 'passcode' ? 'The two new passcodes do not match' : 'The two new PINs do not match',
    };
  }
  if (!pinRule.safeParse(input.currentPin).success) {
    return { ok: false, reason: 'invalid', error: 'Enter your current PIN: 4 numbers' };
  }
  return null;
}

export async function changeCredential(
  db: Database,
  kind: CredentialKind,
  input: ChangeInput,
): Promise<ChangeResult> {
  const invalid = validateChange(kind, input);
  if (invalid) return invalid;

  const [row] = await db
    .select({ pinHash: schema.settings.parentPinHash })
    .from(schema.settings);
  if (!row) return { ok: false, reason: 'not-set-up', error: 'This planner is not set up yet.' };

  if (!(await verifySecret(input.currentPin, row.pinHash))) {
    return { ok: false, reason: 'wrong-pin', error: 'That is not the current PIN.' };
  }

  const hash = await hashSecret(input.newValue);
  await db
    .update(schema.settings)
    .set(kind === 'passcode'
      ? { householdPasscodeHash: hash, updatedAt: new Date() }
      : { parentPinHash: hash, updatedAt: new Date() })
    .where(eq(schema.settings.id, 1));
  return { ok: true };
}
