'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { getSession } from '@/lib/session';
import { runSetup, setupSchema } from '@/lib/setup';

export type SetupFormState = { error: string | null };

export async function completeSetup(_prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  let people: unknown;
  try {
    people = JSON.parse(String(formData.get('people') ?? '{}'));
  } catch {
    return { error: 'Something was wrong with the form. Reload the page and try again.' };
  }
  const parsed = setupSchema.safeParse({
    ...(people as object),
    setupCode: formData.get('setupCode') ?? '',
    passcode: formData.get('passcode') ?? '',
    passcodeAgain: formData.get('passcodeAgain') ?? '',
    pin: formData.get('pin') ?? '',
    pinAgain: formData.get('pinAgain') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  let result;
  try {
    result = await runSetup(getDb, parsed.data, {
      expectedCode: process.env.SETUP_CODE,
      envSessionSecret: process.env.SESSION_SECRET,
    });
  } catch (err) {
    console.error('Setup failed:', err);
    return { error: 'Something went wrong. Wait a minute, then press the button again.' };
  }

  if (!result.ok) {
    if (result.reason === 'already-set-up') redirect('/lock');
    // There is no attempts table before setup, so slow guessing down instead.
    if (result.reason === 'bad-code') await new Promise((r) => setTimeout(r, 1500));
    return { error: result.message };
  }

  const session = await getSession();
  session.household = true;
  await session.save();
  redirect('/');
}
