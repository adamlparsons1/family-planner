/**
 * Applies checked-in migrations from ./drizzle to whichever database
 * DATABASE_URL points at. Safe to run repeatedly.
 */
import './load-env';
import { assertLocalDbNotInUse } from './guard-local-db';

const url = process.env.DATABASE_URL?.trim();
const usePglite = !url || url === 'pglite' || url.startsWith('file:');

async function main() {
  await assertLocalDbNotInUse(usePglite);
  if (usePglite) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const dataDir = url?.startsWith('file:') ? url.slice('file:'.length) : '.pglite';
    const client = new PGlite(dataDir);
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
    await client.close();
    console.log(`Migrations applied to local PGlite database (${dataDir}).`);
  } else {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { migrate } = await import('drizzle-orm/neon-http/migrator');
    await migrate(drizzle(neon(url!)), { migrationsFolder: './drizzle' });
    console.log('Migrations applied to Neon.');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
