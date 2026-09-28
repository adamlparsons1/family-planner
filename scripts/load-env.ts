import { config } from 'dotenv';

/**
 * Loads env the way Next.js does, so a script and the app see the same values.
 *
 * `dotenv/config` alone reads only `.env`, but the README tells you to put your
 * settings in `.env.local` (which is what Next.js reads and what is gitignored).
 * Following the README then produced a confusing "must be set on first seed"
 * failure. Order matters: the first file to define a variable wins.
 */
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });
