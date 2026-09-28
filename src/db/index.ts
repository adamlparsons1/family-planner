/**
 * Database handle.
 *
 * Production uses Neon over HTTP. Local development and tests use PGlite, which
 * is real Postgres compiled to WASM and needs no installed server. The schema,
 * the migrations and every query are identical across both; only the driver
 * differs, and that choice is made here and nowhere else.
 */
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

export type Database = ReturnType<typeof drizzleNeon<typeof schema>>;

/**
 * Find the Postgres connection string.
 *
 * `DATABASE_URL` is the name this app documents, but the Vercel-Neon
 * marketplace integration provisions its own prefixed variables instead
 * (`<project>_DATABASE_URL`, `<project>_DATABASE_URL_UNPOOLED`), and Vercel's
 * own Postgres integration uses `POSTGRES_URL`. Requiring the exact name meant
 * a correctly-provisioned database looked like no database at all.
 *
 * Pooled connections are preferred: `_UNPOOLED` is a direct connection and will
 * exhaust Postgres connection limits from serverless functions.
 */
function resolveDatabaseUrl(): { url?: string; source: string } {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) return { url: direct, source: 'DATABASE_URL' };

  const postgres = process.env.POSTGRES_URL?.trim();
  if (postgres) return { url: postgres, source: 'POSTGRES_URL' };

  // An integration-provisioned variable, e.g. family_planner_DATABASE_URL.
  const candidates = Object.keys(process.env)
    .filter((k) => k.endsWith('_DATABASE_URL') && !k.endsWith('_UNPOOLED'))
    .sort();
  for (const key of candidates) {
    const value = process.env[key]?.trim();
    if (value?.startsWith('postgres')) return { url: value, source: key };
  }
  return { source: 'none' };
}

const resolved = resolveDatabaseUrl();
const url = resolved.url;
export const databaseUrlSource = resolved.source;
const usePglite = !url || url === 'pglite' || url.startsWith('file:') || url.startsWith('memory:');

/**
 * PGlite is a LOCAL DEVELOPMENT convenience. Falling back to it in production is
 * never right: Vercel's filesystem is read-only, so a missing DATABASE_URL would
 * surface as an unreadable crash inside a WASM module rather than naming the
 * variable.
 *
 * Checked lazily inside getDb() and NOT at module load. A module-level throw
 * runs during `next build` too, and an environment variable marked Sensitive in
 * Vercel is not necessarily available to the build step — so the guard meant to
 * make a misconfiguration obvious instead broke the build for everyone. Import
 * time is the wrong place to have opinions about runtime configuration.
 */
function assertConfigured(): void {
  // Checks the RESOLVED url, not one specific variable name — the whole point
  // of resolveDatabaseUrl() is that the name varies by integration.
  if (process.env.NODE_ENV === 'production' && !url) {
    throw new Error(
      'No Postgres connection string found. Set DATABASE_URL (or POSTGRES_URL, ' +
        'or an integration-provided <project>_DATABASE_URL) in the hosting ' +
        'environment and REDEPLOY — environment variables are snapshotted per ' +
        'deployment, so existing deployments keep the old values.',
    );
  }
}

let cached: Database | null = null;

async function createPgliteDb(): Promise<Database> {
  // Imported lazily so the WASM bundle never reaches a production build.
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  // 'memory://' gives a throwaway database, used by the integration tests.
  const dataDir = url?.startsWith('memory:')
    ? 'memory://'
    : url?.startsWith('file:')
      ? url.slice('file:'.length)
      : '.pglite';
  const client = new PGlite(dataDir);
  return drizzlePglite(client, { schema }) as unknown as Database;
}

/**
 * Get the shared database handle. Async because PGlite initialises asynchronously;
 * on Neon the promise resolves immediately.
 */
export async function getDb(): Promise<Database> {
  if (cached) return cached;
  assertConfigured();
  cached = usePglite ? await createPgliteDb() : drizzleNeon(neon(url!), { schema });
  return cached;
}

/** True when running against the embedded local database rather than Neon. */
export const isLocalDatabase = usePglite;

export { schema };
