'use client';

import { useActionState, useState, useTransition } from 'react';
import { movePerson, setPersonActive, updatePerson, type ActionState } from '@/lib/actions/admin-people';
import { SUGGESTED_COLOURS, SUGGESTED_ICONS } from '@/lib/palette';
import {
  MIN_LUMINANCE_GAP, areDistinguishable, bestTextContrast, darken, luminanceGap, readableTextOn,
} from '@/lib/contrast';
import { Notice } from './Notice';

type Person = {
  id: number; name: string; displayName: string; colour: string; icon: string;
  role: string; sortOrder: number; isActive: boolean; showLunchOnCard: boolean;
};

const initial: ActionState = { error: null };

export function PeopleAdmin({ people }: { people: Person[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const children = people.filter((p) => p.role === 'child');

  return (
    <div className="space-y-3">
      <p className="text-[0.95rem] text-ink-soft">
        Each child&rsquo;s colour and icon are used everywhere in the app — the wall display,
        the calendar, their jobs. Let them choose their own; it matters more to them than
        it does to you.
      </p>

      {people.map((person) => {
        const others = children.filter((c) => c.id !== person.id);
        return editingId === person.id ? (
          <PersonForm
            key={person.id}
            person={person}
            others={others}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <div
            key={person.id}
            className="flex items-center gap-3 rounded-tile border-4 p-3"
            style={{
              backgroundColor: person.colour,
              borderColor: darken(person.colour, 0.22),
              color: readableTextOn(person.colour),
              opacity: person.isActive ? 1 : 0.5,
            }}
          >
            <span className="text-[2.4rem] leading-none" aria-hidden>{person.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.3rem] font-extrabold">{person.displayName}</p>
              <p className="text-[0.85rem] font-semibold opacity-80">
                {person.role === 'child' ? 'Child' : 'Grown-up'} · {person.colour}
                {person.isActive ? '' : ' · hidden'}
              </p>
            </div>
            {person.role === 'child' ? (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button" aria-label={`Move ${person.displayName} left`}
                  onClick={() => startTransition(() => { void movePerson(person.id, 'up'); })}
                  className="rounded-full border-2 px-3 py-2 font-bold"
                  style={{ borderColor: 'currentColor' }}
                >←</button>
                <button
                  type="button" aria-label={`Move ${person.displayName} right`}
                  onClick={() => startTransition(() => { void movePerson(person.id, 'down'); })}
                  className="rounded-full border-2 px-3 py-2 font-bold"
                  style={{ borderColor: 'currentColor' }}
                >→</button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setEditingId(person.id)}
              className="shrink-0 rounded-full bg-white px-5 py-3 font-bold text-ink"
            >
              Edit
            </button>
            {person.role === 'child' ? (
              <button
                type="button"
                onClick={() => startTransition(() => { void setPersonActive(person.id, !person.isActive); })}
                className="shrink-0 rounded-full border-2 px-4 py-3 font-semibold"
                style={{ borderColor: 'currentColor' }}
              >
                {person.isActive ? 'Hide' : 'Show'}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PersonForm({
  person, others, onDone,
}: {
  person: Person; others: Person[]; onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(updatePerson, initial);
  const [colour, setColour] = useState(person.colour);
  const [icon, setIcon] = useState(person.icon);
  const [displayName, setDisplayName] = useState(person.displayName);

  const ink = readableTextOn(colour);
  const textContrast = bestTextContrast(colour);
  const clashes = others.filter((o) => !areDistinguishable(colour, o.colour));
  const iconClashes = others.filter((o) => o.icon === icon);

  return (
    <section className="rounded-tile border-2 border-line bg-ground-raised p-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={person.id} />
        <input type="hidden" name="colour" value={colour} />
        <input type="hidden" name="icon" value={icon} />

        {/* What it will actually look like on the wall. */}
        <div
          className="flex items-center gap-4 rounded-tile border-4 p-5"
          style={{ backgroundColor: colour, borderColor: darken(colour, 0.22), color: ink }}
        >
          <span className="text-[3.5rem] leading-none" aria-hidden>{icon}</span>
          <div>
            <p className="text-[1.8rem] font-extrabold leading-none">{displayName || '…'}</p>
            <p className="mt-1 text-[0.95rem] font-semibold opacity-80">This is how it will look</p>
          </div>
        </div>

        <label className="block">
          <span className="block text-[0.95rem] font-semibold">Name on the screen</span>
          <input
            name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            required maxLength={30}
            className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.1rem]"
          />
        </label>

        <fieldset>
          <legend className="text-[0.95rem] font-semibold">Colour</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTED_COLOURS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColour(c.hex)}
                aria-label={c.name}
                aria-pressed={colour.toUpperCase() === c.hex.toUpperCase()}
                className="h-12 w-12 rounded-full border-4 transition-transform active:scale-90"
                style={{
                  backgroundColor: c.hex,
                  borderColor: colour.toUpperCase() === c.hex.toUpperCase() ? 'var(--color-ink)' : 'transparent',
                }}
              />
            ))}
          </div>
          <label className="mt-3 flex items-center gap-3">
            <span className="text-[0.95rem] font-semibold">Or any colour</span>
            <input
              type="color" value={colour} onChange={(e) => setColour(e.target.value)}
              aria-label="Custom colour"
              className="h-12 w-20 cursor-pointer rounded-lg border-2 border-line bg-ground"
            />
            <span className="font-mono text-[0.9rem] text-ink-soft">{colour.toUpperCase()}</span>
          </label>
        </fieldset>

        {/* Warnings, not blocks. It is his household and his call. */}
        {textContrast < 4.5 ? (
          <p role="alert" className="rounded-xl bg-ground-sunken px-4 py-3 text-[0.95rem] font-semibold text-warn">
            Text will be hard to read on this colour ({textContrast.toFixed(1)}:1, and 4.5:1 is the
            minimum). Something lighter or darker would be safer.
          </p>
        ) : null}
        {clashes.length > 0 ? (
          <p role="alert" className="rounded-xl bg-ground-sunken px-4 py-3 text-[0.95rem] font-semibold text-warn">
            Too close to {clashes.map((c) => c.displayName).join(' and ')} — they may look identical
            to someone who is colour-blind, and to anyone glancing at the wall from across the room.
            {clashes[0] ? ` (Lightness differs by ${luminanceGap(colour, clashes[0].colour).toFixed(2)};
            ${MIN_LUMINANCE_GAP} is the minimum.)` : ''}
          </p>
        ) : null}

        <fieldset>
          <legend className="text-[0.95rem] font-semibold">Icon</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                aria-label={`Icon ${emoji}`}
                aria-pressed={icon === emoji}
                className="h-12 w-12 rounded-xl border-2 text-[1.6rem] transition-transform active:scale-90"
                style={{
                  borderColor: icon === emoji ? 'var(--color-ink)' : 'var(--color-line)',
                  backgroundColor: icon === emoji ? 'var(--color-ground-sunken)' : 'transparent',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-3">
            <span className="text-[0.95rem] font-semibold">Or type one</span>
            <input
              value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={16}
              aria-label="Custom icon"
              className="w-24 rounded-xl border-2 border-line bg-ground px-3 py-3 text-center text-[1.6rem]"
            />
          </label>
        </fieldset>

        {person.role === 'child' ? (
          <label className="flex items-center gap-3">
            <input type="hidden" name="hasLunchOnCard" value="1" />
            <input type="checkbox" name="showLunchOnCard" defaultChecked={person.showLunchOnCard} className="h-6 w-6" />
            <span className="text-[1rem] font-semibold">
              Show lunch on the morning screen
              <span className="block text-[0.85rem] font-normal text-ink-soft">
                Their card shows school dinner (and what it is) or packed lunch. You set both in the week planner.
              </span>
            </span>
          </label>
        ) : null}

        {iconClashes.length > 0 ? (
          <p role="alert" className="rounded-xl bg-ground-sunken px-4 py-3 text-[0.95rem] font-semibold text-warn">
            {iconClashes.map((c) => c.displayName).join(' and ')} already {iconClashes.length === 1 ? 'uses' : 'use'} this
            icon. The youngest two find their column by its shape, so give each child their own.
          </p>
        ) : null}

        <Notice error={state.error} ok={state.ok} />

        <div className="flex gap-3">
          <button type="submit" disabled={pending}
            className="rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60">
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onDone}
            className="rounded-full border-2 border-line px-6 py-3 font-semibold">
            {state.ok ? 'Done' : 'Cancel'}
          </button>
        </div>
      </form>
    </section>
  );
}
