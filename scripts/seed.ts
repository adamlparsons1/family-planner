/**
 * Seeds the made-up example household, for local development only. Real
 * families are set up in the browser at /setup. Idempotent: safe to re-run, will not duplicate people
 * or wipe anything a child has already ticked.
 *
 * The settings row is written only if absent, so re-seeding never resets a
 * passcode that has since been changed in the app.
 */
import './load-env';
import { assertLocalDbNotInUse } from './guard-local-db';
import { getDb, schema } from '../src/db';
import { EXAMPLE_FAMILY } from '../src/lib/family';
import { createSettingsIfAbsent, seedHousehold } from '../src/lib/household-seed';
import { starterHousehold } from '../src/lib/starter-household';

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  await assertLocalDbNotInUse(!url || url === 'pglite' || url.startsWith('file:'));
  const db = await getDb();

  /* -------------------------------------------------------------- settings */
  const existingSettings = await db.select({ id: schema.settings.id }).from(schema.settings);
  if (existingSettings.length === 0) {
    const passcode = process.env.SEED_HOUSEHOLD_PASSCODE;
    const pin = process.env.SEED_PARENT_PIN;
    if (!passcode || !pin) {
      throw new Error(
        'SEED_HOUSEHOLD_PASSCODE and SEED_PARENT_PIN must be set on first seed. See .env.example.',
      );
    }
    if (!/^\d{4}$/.test(pin)) throw new Error('SEED_PARENT_PIN must be exactly 4 digits.');
    if (passcode.length < 6) throw new Error('SEED_HOUSEHOLD_PASSCODE must be at least 6 characters.');

    await createSettingsIfAbsent(db, { passcode, pin });
    console.log('  settings: created');
  } else {
    console.log('  settings: already present, left untouched');
  }

  await seedHousehold(
    db,
    starterHousehold(EXAMPLE_FAMILY.parents, EXAMPLE_FAMILY.children),
    (line) => console.log(line),
  );

  console.log('\nSeed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
