import 'server-only';
import { createHash } from 'node:crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { authAttempts } from '@/db/schema';

/** 5 attempts per minute per IP. */
export const MAX_ATTEMPTS_PER_MINUTE = 5;
const WINDOW_MS = 60_000;
const PRUNE_AFTER_MS = 60 * 60 * 1000;

function hashIp(ip: string): string {
  return createHash('sha256')
    .update(`${process.env.SESSION_SECRET ?? ''}:${ip}`)
    .digest('hex');
}

/** How many failed attempts of this kind the IP has made in the last minute. */
export async function recentFailures(ip: string, kind: string): Promise<number> {
  const db = await getDb();
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authAttempts)
    .where(
      and(
        eq(authAttempts.ipHash, hashIp(ip)),
        eq(authAttempts.kind, kind),
        eq(authAttempts.succeeded, false),
        gt(authAttempts.attemptedAt, since),
      ),
    );
  return row?.count ?? 0;
}

export async function isRateLimited(ip: string, kind: string): Promise<boolean> {
  return (await recentFailures(ip, kind)) >= MAX_ATTEMPTS_PER_MINUTE;
}

export async function recordAttempt(ip: string, kind: string, succeeded: boolean): Promise<void> {
  const db = await getDb();
  await db.insert(authAttempts).values({ ipHash: hashIp(ip), kind, succeeded });
  // Opportunistic prune so the table never needs maintenance.
  await db.delete(authAttempts).where(lt(authAttempts.attemptedAt, new Date(Date.now() - PRUNE_AFTER_MS)));
}
