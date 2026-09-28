import type { Config } from 'drizzle-kit';

/**
 * Migrations are generated from src/db/schema.ts and checked into ./drizzle.
 * Never edit a generated migration or a database console by hand.
 */
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://localhost:5432/placeholder',
  },
  strict: true,
  verbose: true,
} satisfies Config;
