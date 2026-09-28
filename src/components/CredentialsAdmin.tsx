'use client';

import { useActionState } from 'react';
import { changePasscode, changePin } from '@/lib/actions/admin-credentials';
import type { ActionState } from '@/lib/actions/admin-people';
import { Notice } from '@/components/Notice';

const initial: ActionState = { error: null };

const input =
  'mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.1rem] outline-none focus:border-ink';
const label = 'block text-[0.95rem] font-semibold';

function ChangeForm({
  kind,
  title,
  help,
  action,
}: {
  kind: 'passcode' | 'pin';
  title: string;
  help: string;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const isPin = kind === 'pin';
  const numeric = { inputMode: 'numeric' as const, pattern: '\\d{4}', maxLength: 4 };

  return (
    <section className="rounded-tile border-2 border-line bg-ground-raised p-4">
      <h2 className="text-[1.25rem] font-extrabold">{title}</h2>
      <p className="mt-1 text-[0.95rem] text-ink-soft">{help}</p>

      {/* Uncontrolled on purpose: React clears these after each attempt, so no secret lingers on screen. */}
      <form action={formAction} className="mt-4 space-y-4">
        <label className={label}>
          {isPin ? 'New PIN' : 'New passcode'}
          <input
            name="newValue" type="password" required autoComplete={isPin ? 'off' : 'new-password'}
            {...(isPin ? numeric : { minLength: 6 })}
            className={input}
          />
        </label>
        <label className={label}>
          {isPin ? 'New PIN again' : 'New passcode again'}
          <input
            name="newValueAgain" type="password" required autoComplete={isPin ? 'off' : 'new-password'}
            {...(isPin ? numeric : {})}
            className={input}
          />
        </label>
        <label className={label}>
          Current grown-ups&apos; PIN
          <input name="currentPin" type="password" required autoComplete="off" {...numeric} className={input} />
        </label>

        <Notice error={state.error} ok={state.ok} />

        <button
          type="submit" disabled={pending}
          className="rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60"
        >
          {pending ? 'Saving…' : isPin ? 'Change PIN' : 'Change passcode'}
        </button>
      </form>
    </section>
  );
}

export function CredentialsAdmin() {
  return (
    <div className="space-y-5">
      <ChangeForm
        kind="passcode"
        title="Household passcode"
        help="Typed once on each device to open the planner. At least 6 characters. Devices already signed in stay signed in."
        action={changePasscode}
      />
      <ChangeForm
        kind="pin"
        title="Grown-ups' PIN"
        help="4 numbers. It opens these settings."
        action={changePin}
      />
    </div>
  );
}
