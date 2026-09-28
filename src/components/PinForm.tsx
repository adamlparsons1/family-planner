'use client';

import { useActionState } from 'react';
import { unlockPin, type AuthState } from '@/lib/actions/auth';

const initial: AuthState = { error: null };

export function PinForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(unlockPin, initial);

  return (
    <form action={formAction} className="w-full">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label htmlFor="pin" className="block text-kiosk-base font-semibold">
        Grown-up PIN
      </label>
      <input
        id="pin"
        name="pin"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="off"
        autoFocus
        required
        aria-describedby={state.error ? 'pin-error' : undefined}
        aria-invalid={state.error ? true : undefined}
        className="mt-3 w-full rounded-tile border-2 border-ink bg-ground-sunken px-5 py-4 text-center text-kiosk-xl tracking-[0.4em] outline-none focus:border-ink focus:bg-ground-raised"
      />

      {state.error ? (
        <p
          id="pin-error"
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
        {pending ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}
