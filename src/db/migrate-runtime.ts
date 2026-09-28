import path from 'node:path';
import { isLocalDatabase, type Database } from '@/db';

/**
 * Applies the checked-in migrations from inside the running app. Called only by
 * /setup, and only once it has confirmed the database holds no household.
 * Existing planners keep migrating the way they always have.
 *
 * The ./drizzle folder reaches the deployed function via
 * outputFileTracingIncludes in next.config.ts.
 */
export async function migrateDatabase(db: Database): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  if (isLocalDatabase) {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(db as never, { migrationsFolder });
  } else {
    const { migrate } = await import('drizzle-orm/neon-http/migrator');
    await migrate(db as never, { migrationsFolder });
  }
}
