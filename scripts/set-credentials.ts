import './load-env';
import { assertLocalDbNotInUse } from './guard-local-db';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../src/db';
import { hashSecret } from '../src/lib/auth-hash';

/**
 * Change the household passcode and/or the parent PIN.
 *
 * The seed deliberately refuses to touch an existing settings row, so this is
 * the way to change credentials afterwards — including the case where the seed
 * was run with placeholder values still in the command.
 *
 * Usage:
 *   npm run db:credentials -- --passcode "new passcode"
 *   npm run db:credentials -- --pin 4821
 *   npm run db:credentials -- --passcode "new passcode" --pin 4821
 */
function argOf(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  await assertLocalDbNotInUse(!url || url === 'pglite' || url.startsWith('file:'));

  const passcode = argOf('--passcode');
  const pin = argOf('--pin');

  if (!passcode && !pin) {
    console.error(
      '\nNothing to change. Pass --passcode, --pin, or both:\n' +
        '  npm run db:credentials -- --passcode "new passcode" --pin 4821\n',
    );
    process.exit(1);
  }
  if (passcode !== undefined && passcode.length < 6) {
    console.error('\nThe passcode must be at least 6 characters.\n');
    process.exit(1);
  }
  if (pin !== undefined && !/^\d{4}$/.test(pin)) {
    console.error('\nThe PIN must be exactly 4 digits.\n');
    process.exit(1);
  }

  const db = await getDb();
  const [existing] = await db.select({ id: schema.settings.id }).from(schema.settings);
  if (!existing) {
    console.error('\nNo settings row yet. Run `npm run db:seed` first.\n');
    process.exit(1);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (passcode !== undefined) patch.householdPasscodeHash = await hashSecret(passcode);
  if (pin !== undefined) patch.parentPinHash = await hashSecret(pin);

  await db.update(schema.settings).set(patch).where(eq(schema.settings.id, 1));

  console.log('');
  if (passcode !== undefined) console.log('  household passcode: updated');
  if (pin !== undefined) console.log('  parent PIN: updated');
  console.log('\nEveryone stays signed in — existing sessions are not revoked.');
  console.log('To sign every device out instead, change SESSION_SECRET in Vercel.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
