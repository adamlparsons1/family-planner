'use server';

import { getDb } from '@/db';
import { changeCredential, type CredentialKind } from '@/lib/credentials';
import { clientIp } from '@/lib/client-ip';
import { requireParentPin } from '@/lib/guards';
import { isRateLimited, recordAttempt } from '@/lib/rate-limit';
import type { ActionState } from '@/lib/actions/admin-people';

async function change(kind: CredentialKind, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/passcode');

  const input = {
    currentPin: String(form.get('currentPin') ?? ''),
    newValue: String(form.get('newValue') ?? ''),
    newValueAgain: String(form.get('newValueAgain') ?? ''),
  };

  // Shares the PIN screen's limit, so this form is no back door for guessing.
  const ip = await clientIp();
  if (await isRateLimited(ip, 'pin')) {
    return { error: 'Too many tries. Wait a minute, then try again.' };
  }

  const result = await changeCredential(await getDb(), kind, input);
  if (!result.ok) {
    if (result.reason === 'wrong-pin') await recordAttempt(ip, 'pin', false);
    return { error: result.error };
  }
  await recordAttempt(ip, 'pin', true);
  return {
    error: null,
    ok: kind === 'passcode'
      ? 'Passcode changed. Devices already signed in stay signed in.'
      : 'PIN changed. Use the new PIN from now on.',
  };
}

export async function changePasscode(_prev: ActionState, form: FormData): Promise<ActionState> {
  return change('passcode', form);
}

export async function changePin(_prev: ActionState, form: FormData): Promise<ActionState> {
  return change('pin', form);
}
