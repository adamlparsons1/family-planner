'use client';

import { useActionState } from 'react';
import { unlockHousehold, type AuthState } from '@/lib/actions/auth';

const initial: AuthState = { error: null };

export function PasscodeForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(unlockHousehold, initial);

  return (
    <form action={formAction} className="w-full">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label htmlFor="passcode" className="block text-kiosk-base font-semibold">
        Household passcode
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        aria-describedby={state.error ? 'passcode-error' : undefined}
        aria-invalid={state.error ? true : undefined}
        className="mt-3 w-full rounded-tile border-2 border-ink bg-ground-sunken px-5 py-4 text-kiosk-base outline-none focus:border-ink focus:bg-ground-raised"
      />

      {state.error ? (
        <p
          id="passcode-error"
          role="alert"
          className="mt-3 rounded-[8px] border-[1.5px] border-dashed border-line-strong bg-ground-sunken px-4 py-3 text-[1rem] font-bold text-warn"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-full border-2 border-ink bg-ink px-5 py-4 text-kiosk-base font-extrabold text-ground-raised shadow-[0_4px_0_rgba(43,38,32,0.35)] transition active:translate-y-[2px] active:shadow-[0_2px_0_rgba(43,38,32,0.35)] disabled:opacity-60"
      >
        {pending ? 'Checking…' : 'Unlock'}
      </button>
    </form>
  );
}
