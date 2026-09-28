import 'server-only';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { isHouseholdUnlocked, isPinUnlocked } from '@/lib/session';
import { getSetupState } from '@/lib/setup';

/**
 * A planner that has never been set up has no secret to check a cookie with,
 * so reading the session throws. Send it to /setup instead of an error page —
 * but only on positive evidence of an empty database.
 */
async function unlockedOrSetup(): Promise<boolean> {
  try {
    return await isHouseholdUnlocked();
  } catch (err) {
    if ((await getSetupState(getDb)) === 'needs-setup') redirect('/setup');
    throw err;
  }
}

/**
 * Call at the top of any page, route handler or server action that must not be
 * reachable without the household passcode.
 */
export async function requireHousehold(returnTo?: string): Promise<void> {
  if (await unlockedOrSetup()) return;
  redirect(returnTo ? `/lock?next=${encodeURIComponent(returnTo)}` : '/lock');
}

/**
 * Call at the top of anything destructive or administrative. This is the real
 * gate; hiding the link in the UI is not.
 */
export async function requireParentPin(returnTo?: string): Promise<void> {
  await requireHousehold(returnTo);
  if (await isPinUnlocked()) return;
  redirect(returnTo ? `/pin?next=${encodeURIComponent(returnTo)}` : '/pin');
}
