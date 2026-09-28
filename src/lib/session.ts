import 'server-only';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { settings } from '@/db/schema';

/**
 * Two independent gates, both held in one signed cookie:
 *
 *  - `household`: set by the household passcode. Long-lived (90 days) so the
 *    kiosk iPad stays logged in indefinitely.
 *  - `pinUnlockedUntil`: set by the parent PIN. Short-lived (30 minutes) so a
 *    child cannot wander into admin on a device a parent used earlier.
 *
 * The PIN gate is checked SERVER-SIDE on every admin action. Hiding a route in
 * the UI is not a gate; a seven-year-old with a bookmark defeats that.
 */
export type SessionData = {
  household?: true;
  /** Epoch ms after which the parent PIN must be re-entered. */
  pinUnlockedUntil?: number;
};

export const HOUSEHOLD_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
export const PIN_TTL_MS = 1000 * 60 * 30; // 30 minutes

let storedSecret: string | null = null;

/**
 * The environment variable always wins, and when it is set the database is
 * never consulted. Only a planner created through /setup, which has no
 * SESSION_SECRET, falls back to the secret /setup stored.
 */
export async function resolveSessionSecret(): Promise<string> {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) {
    if (fromEnv.length < 32) {
      throw new Error(
        `SESSION_SECRET is only ${fromEnv.length} characters; it must be at least 32. ` +
          'Generate one with: openssl rand -base64 32',
      );
    }
    return fromEnv;
  }
  if (!storedSecret) {
    try {
      const db = await getDb();
      const [row] = await db.select({ secret: settings.sessionSecret }).from(settings);
      storedSecret = row?.secret ?? null;
    } catch {
      storedSecret = null;
    }
  }
  if (storedSecret) return storedSecret;
  throw new Error(
    'SESSION_SECRET is not set. Add it to the hosting environment (32+ random ' +
      'characters, e.g. `openssl rand -base64 32`) and REDEPLOY — environment ' +
      'variables only apply to new deployments.',
  );
}

async function sessionOptions(): Promise<SessionOptions> {
  const password = await resolveSessionSecret();
  return {
    password,
    cookieName: 'fd_session',
    ttl: HOUSEHOLD_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: HOUSEHOLD_TTL_SECONDS,
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), await sessionOptions());
}

export async function isHouseholdUnlocked(): Promise<boolean> {
  return (await getSession()).household === true;
}

export async function isPinUnlocked(): Promise<boolean> {
  const session = await getSession();
  return typeof session.pinUnlockedUntil === 'number' && session.pinUnlockedUntil > Date.now();
}

export { sessionOptions };
