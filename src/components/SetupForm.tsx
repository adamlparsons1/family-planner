'use client';

import { useActionState, useState } from 'react';
import { completeSetup, type SetupFormState } from '@/lib/actions/setup';
import { readableTextOn } from '@/lib/contrast';
import { GROWN_UP_ICONS, SUGGESTED_COLOURS, SUGGESTED_ICONS } from '@/lib/palette';

type GrownUp = { name: string; displayName: string; icon: string };
type Child = { name: string; colour: string; icon: string };

const initial: SetupFormState = { error: null };

const input =
  'mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.1rem] outline-none focus:border-ink';
const label = 'block text-[0.95rem] font-semibold';
const smallButton = 'rounded-full border-2 border-line px-4 py-2 font-semibold';

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t-2 border-dashed border-line pt-5">
      <h2 className="text-[1.3rem] font-extrabold">
        <span className="serif mr-2">{n}.</span>
        {title}
      </h2>
      {hint ? <p className="text-[0.95rem] text-ink-soft">{hint}</p> : null}
      {children}
    </section>
  );
}

export function SetupForm() {
  const [state, formAction, pending] = useActionState(completeSetup, initial);

  // Every field is controlled so nothing typed is lost when the server says no.
  const [setupCode, setSetupCode] = useState('');
  const [grownUps, setGrownUps] = useState<GrownUp[]>([{ name: '', displayName: '', icon: GROWN_UP_ICONS[0] }]);
  const [children, setChildren] = useState<Child[]>([
    { name: '', colour: SUGGESTED_COLOURS[0].hex, icon: SUGGESTED_ICONS[0] },
  ]);
  const [passcode, setPasscode] = useState('');
  const [passcodeAgain, setPasscodeAgain] = useState('');
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');

  const updateGrownUp = (i: number, patch: Partial<GrownUp>) =>
    setGrownUps((all) => all.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const updateChild = (i: number, patch: Partial<Child>) =>
    setChildren((all) => all.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  function addChild() {
    const colour = SUGGESTED_COLOURS.find((c) => !children.some((k) => k.colour === c.hex))!.hex;
    const icon = SUGGESTED_ICONS.find((e) => !children.some((k) => k.icon === e))!;
    setChildren((all) => [...all, { name: '', colour, icon }]);
  }

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <input
        type="hidden"
        name="people"
        value={JSON.stringify({ parents: grownUps, children })}
      />

      <Step n={1} title="Your setup word" hint="The word you chose when you created the planner in Vercel.">
        <input
          name="setupCode" value={setupCode} onChange={(e) => setSetupCode(e.target.value)}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} required
          aria-label="Setup word" className={input}
        />
      </Step>

      <Step n={2} title="The grown-ups">
        {grownUps.map((g, i) => (
          <div key={i} className="space-y-3 rounded-tile border-2 border-line bg-ground-raised p-4">
            <label className={label}>
              First name
              <input
                value={g.name} onChange={(e) => updateGrownUp(i, { name: e.target.value })}
                maxLength={30} required className={input}
              />
            </label>
            <label className={label}>
              What the children call them <span className="font-normal text-ink-soft">(optional, e.g. Mum)</span>
              <input
                value={g.displayName} onChange={(e) => updateGrownUp(i, { displayName: e.target.value })}
                maxLength={30} className={input}
              />
            </label>
            <fieldset>
              <legend className={label}>Picture</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {GROWN_UP_ICONS.map((emoji) => (
                  <button
                    key={emoji} type="button" onClick={() => updateGrownUp(i, { icon: emoji })}
                    aria-label={`Picture ${emoji}`} aria-pressed={g.icon === emoji}
                    className="h-12 w-12 rounded-xl border-2 text-[1.6rem] transition-transform active:scale-90"
                    style={{
                      borderColor: g.icon === emoji ? 'var(--color-ink)' : 'var(--color-line)',
                      backgroundColor: g.icon === emoji ? 'var(--color-ground-sunken)' : 'transparent',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </fieldset>
            {grownUps.length > 1 ? (
              <button type="button" className={smallButton} onClick={() => setGrownUps((all) => all.filter((_, j) => j !== i))}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {grownUps.length < 2 ? (
          <button
            type="button" className={smallButton}
            onClick={() => setGrownUps((all) => [...all, { name: '', displayName: '', icon: GROWN_UP_ICONS[1] }])}
          >
            + Add another grown-up
          </button>
        ) : null}
      </Step>

      <Step
        n={3} title="The children"
        hint="Each child gets their own colour and picture, so even children who can't read yet can find their jobs."
      >
        {children.map((c, i) => (
          <div key={i} className="space-y-3 rounded-tile border-2 border-line bg-ground-raised p-4">
            <div
              className="flex items-center gap-4 rounded-tile border-4 p-4"
              style={{ backgroundColor: c.colour, borderColor: c.colour, color: readableTextOn(c.colour) }}
            >
              <span className="text-[2.6rem] leading-none" aria-hidden>{c.icon}</span>
              <p className="text-[1.5rem] font-extrabold leading-none">{c.name || 'Name'}</p>
            </div>
            <label className={label}>
              First name
              <input
                value={c.name} onChange={(e) => updateChild(i, { name: e.target.value })}
                maxLength={30} required className={input}
              />
            </label>
            <fieldset>
              <legend className={label}>Colour</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED_COLOURS.map((sw) => {
                  const taken = children.some((k, j) => j !== i && k.colour === sw.hex);
                  return (
                    <button
                      key={sw.hex} type="button" disabled={taken}
                      onClick={() => updateChild(i, { colour: sw.hex })}
                      aria-label={taken ? `${sw.name} (taken)` : sw.name} aria-pressed={c.colour === sw.hex}
                      className="h-12 w-12 rounded-full border-4 transition-transform active:scale-90 disabled:opacity-25"
                      style={{ backgroundColor: sw.hex, borderColor: c.colour === sw.hex ? 'var(--color-ink)' : 'transparent' }}
                    />
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className={label}>Picture</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTED_ICONS.map((emoji) => {
                  const taken = children.some((k, j) => j !== i && k.icon === emoji);
                  return (
                    <button
                      key={emoji} type="button" disabled={taken}
                      onClick={() => updateChild(i, { icon: emoji })}
                      aria-label={taken ? `Picture ${emoji} (taken)` : `Picture ${emoji}`} aria-pressed={c.icon === emoji}
                      className="h-12 w-12 rounded-xl border-2 text-[1.6rem] transition-transform active:scale-90 disabled:opacity-25"
                      style={{
                        borderColor: c.icon === emoji ? 'var(--color-ink)' : 'var(--color-line)',
                        backgroundColor: c.icon === emoji ? 'var(--color-ground-sunken)' : 'transparent',
                      }}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {children.length > 1 ? (
              <button type="button" className={smallButton} onClick={() => setChildren((all) => all.filter((_, j) => j !== i))}>
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {children.length < 6 ? (
          <button type="button" className={smallButton} onClick={addChild}>
            + Add another child
          </button>
        ) : null}
      </Step>

      <Step
        n={4} title="A passcode for the planner"
        hint="Anyone in the family types this once on each device. At least 6 letters or numbers."
      >
        <label className={label}>
          Passcode
          <input
            name="passcode" type="password" autoComplete="new-password" value={passcode}
            onChange={(e) => setPasscode(e.target.value)} minLength={6} required className={input}
          />
        </label>
        <label className={label}>
          Passcode again
          <input
            name="passcodeAgain" type="password" autoComplete="new-password" value={passcodeAgain}
            onChange={(e) => setPasscodeAgain(e.target.value)} required className={input}
          />
        </label>
      </Step>

      <Step
        n={5} title="A grown-ups' PIN"
        hint="4 numbers. It keeps the settings screen away from small fingers."
      >
        <label className={label}>
          PIN
          <input
            name="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4}
            autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            required className={input}
          />
        </label>
        <label className={label}>
          PIN again
          <input
            name="pinAgain" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4}
            autoComplete="off" value={pinAgain} onChange={(e) => setPinAgain(e.target.value.replace(/\D/g, ''))}
            required className={input}
          />
        </label>
      </Step>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[8px] border-[1.5px] border-dashed border-line-strong bg-ground-sunken px-4 py-3 text-[1rem] font-bold text-warn"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full border-2 border-ink bg-ink px-5 py-4 text-kiosk-base font-extrabold text-ground-raised shadow-[0_4px_0_rgba(43,38,32,0.35)] transition active:translate-y-[2px] active:shadow-[0_2px_0_rgba(43,38,32,0.35)] disabled:opacity-60"
      >
        {pending ? 'Setting up… this takes a few seconds' : 'Set up our planner'}
      </button>
    </form>
  );
}
