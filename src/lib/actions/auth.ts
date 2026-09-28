'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSession, PIN_TTL_MS } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { verifySecret } from '@/lib/auth-hash';
import { isRateLimited, recordAttempt } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

/**
 * Every mutation goes through a validated server action. These two are the
 * gates the rest of the app depends on.
 */

const passcodeSchema = z.object({
  passcode: z.string().min(1, 'Enter the passcode').max(200),
  next: z.string().max(500).optional(),
});

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'The PIN is 4 digits'),
  next: z.string().max(500).optional(),
});

export type AuthState = { error: string | null };

/**
 * Turns an infrastructure failure into something a person can act on.
 * Deliberately names the setting: this is a private household app and the
 * person reading it is the one who can fix it.
 */
function databaseErrorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (text.includes('DATABASE_URL')) {
    return 'The database is not connected yet (DATABASE_URL is not set on the server). Set it and redeploy.';
  }
  if (text.includes('No settings row')) {
    return 'The database has no household set up yet. Run the seed against it, then try again.';
  }
  return 'Could not reach the database just now. Check the connection and try again.';
}

/**
 * Only same-origin relative paths are accepted as a post-unlock destination,
 * so a crafted link cannot bounce someone off-site after they authenticate.
 */
function safeNext(next: string | undefined, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

export async function unlockHousehold(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = passcodeSchema.safeParse({
    passcode: formData.get('passcode'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter the passcode' };
  }

  let ok: boolean;
  try {
    const ip = await clientIp();
    if (await isRateLimited(ip, 'household')) {
      return { error: 'Too many tries. Wait a minute, then try again.' };
    }
    const settings = await getSettings();
    ok = await verifySecret(parsed.data.passcode, settings.householdPasscodeHash);
    await recordAttempt(ip, 'household', ok);
  } catch (err) {
    // An unreachable or unseeded database must not take the whole page down.
    // The lock screen stays usable and says something a person can act on.
    console.error('unlockHousehold failed:', err);
    return { error: databaseErrorMessage(err) };
  }
  if (!ok) return { error: 'That passcode is not right.' };

  const session = await getSession();
  session.household = true;
  await session.save();
  redirect(safeNext(parsed.data.next, '/'));
}

export async function unlockPin(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = pinSchema.safeParse({
    pin: formData.get('pin'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'The PIN is 4 digits' };
  }

  const session = await getSession();
  if (session.household !== true) redirect('/lock');

  let ok: boolean;
  try {
    const ip = await clientIp();
    if (await isRateLimited(ip, 'pin')) {
      return { error: 'Too many tries. Wait a minute, then try again.' };
    }
    const settings = await getSettings();
    ok = await verifySecret(parsed.data.pin, settings.parentPinHash);
    await recordAttempt(ip, 'pin', ok);
  } catch (err) {
    console.error('unlockPin failed:', err);
    return { error: databaseErrorMessage(err) };
  }
  if (!ok) return { error: 'That PIN is not right.' };

  session.pinUnlockedUntil = Date.now() + PIN_TTL_MS;
  await session.save();
  redirect(safeNext(parsed.data.next, '/admin'));
}

/** Ends the parent's elevated session without logging the household out. */
export async function lockPin(): Promise<void> {
  const session = await getSession();
  delete session.pinUnlockedUntil;
  await session.save();
  redirect('/');
}
