import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { databaseUrlSource, getDb } from '@/db';
import { settings } from '@/db/schema';

/**
 * Deployment health. Deliberately unauthenticated, because its whole purpose is
 * to be reachable when the app is not: the passcode screen is the first thing
 * that touches the database, so a database problem locks you out of the very
 * screen you would use to diagnose it.
 *
 * Reveals only whether things are configured and reachable — never a
 * connection string, a hostname, a credential, or any household data.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, unknown> = {
    sessionSecret: process.env.SESSION_SECRET
      ? process.env.SESSION_SECRET.length >= 32
        ? 'ok'
        : `too short (${process.env.SESSION_SECRET.length} chars, needs 32+)`
      : 'NOT SET',
    // Which variable the connection string actually came from, so a mis-set
    // env var is obvious without exposing the value.
    databaseUrlFrom: databaseUrlSource,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID ? 'vercel' : 'local',
  };

  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    checks.database = 'reachable';
  } catch (err) {
    checks.database = 'UNREACHABLE';
    // The driver's message names the failure mode without exposing credentials.
    checks.databaseError = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    return NextResponse.json(checks, { status: 503, headers: { 'cache-control': 'no-store' } });
  }

  try {
    const db = await getDb();
    const rows = await db
      .select({ passcode: settings.householdPasscodeHash, pin: settings.parentPinHash })
      .from(settings);
    checks.seeded = rows.length > 0;
    if (rows.length > 0) {
      checks.hasPasscode = Boolean(rows[0].passcode);
      checks.hasPin = Boolean(rows[0].pin);
      // A planner made through /setup keeps its own secret.
      if (checks.sessionSecret === 'NOT SET') {
        const [stored] = await db.select({ secret: settings.sessionSecret }).from(settings);
        if (stored?.secret) checks.sessionSecret = 'ok';
      }
    }
  } catch (err) {
    if ((err as { cause?: { code?: string } })?.cause?.code === '42P01' || (err as { code?: string })?.code === '42P01') {
      checks.seeded = false;
      checks.setup = 'not done yet: open /setup';
    } else {
      checks.seeded = 'CHECK FAILED';
      checks.seedError = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    }
  }

  const healthy = checks.database === 'reachable' && checks.seeded === true && checks.sessionSecret === 'ok';
  return NextResponse.json(checks, {
    status: healthy ? 200 : 503,
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}
