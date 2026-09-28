'use client';

import { useActionState, useState, useTransition } from 'react';
import { createEvent, deleteEvent, updateEvent, type ActionState } from '@/lib/actions/admin-events';
import { Notice } from './Notice';

type Person = { id: number; displayName: string; colour: string; icon: string };
type EventRow = {
  id: number; title: string; icon: string; date: string | null; daysOfWeek: number[] | null;
  startsOn: string | null; endsOn: string | null; startTime: string | null; endTime: string | null;
  location: string | null; notes: string | null; isSchoolRelated: boolean; people: Person[];
};

const DAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const initial: ActionState = { error: null };

export function EventsAdmin({ events, people, today }: { events: EventRow[]; people: Person[]; today: string }) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {adding ? (
        <EventForm people={people} today={today} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="tap mb-6 w-full rounded-tile border-2 border-dashed border-line px-6 py-4 text-[1.1rem] font-bold"
        >
          + Add an event
        </button>
      )}

      {events.length === 0 ? (
        <p className="text-[1rem] text-ink-soft">No events yet.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => <EventRowItem key={e.id} event={e} people={people} today={today} />)}
        </ul>
      )}
    </div>
  );
}

function EventRowItem({ event, people, today }: { event: EventRow; people: Person[]; today: string }) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  if (editing) {
    return (
      <li>
        <EventForm event={event} people={people} today={today} onDone={() => setEditing(false)} />
      </li>
    );
  }

  const when = event.date
    ? event.date
    : `${DAYS.filter((d) => event.daysOfWeek?.includes(d.value)).map((d) => d.label).join(', ')}` +
      (event.endsOn ? ` · until ${event.endsOn}` : ' · ongoing');

  return (
    <li className="flex items-center gap-3 rounded-tile border-2 border-line bg-ground-raised p-3">
      <span className="text-[2rem] leading-none" aria-hidden>{event.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.15rem] font-bold">{event.title}</p>
        <p className="text-[0.9rem] text-ink-soft">
          {when}
          {event.startTime ? ` · ${event.startTime.slice(0, 5)}` : ' · all day'}
        </p>
        <p className="text-[0.9rem] text-ink-soft">
          {event.people.length === 0
            ? 'Everyone'
            : event.people.map((p) => `${p.icon} ${p.displayName}`).join(', ')}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => setEditing(true)} className="rounded-full border-2 border-line px-4 py-2 font-semibold">
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete "${event.title}"? This removes every occurrence.`)) {
              startTransition(() => { void deleteEvent(event.id); });
            }
          }}
          className="rounded-full border-2 border-line px-4 py-2 font-semibold"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function EventForm({
  event, people, today, onDone,
}: {
  event?: EventRow; people: Person[]; today: string; onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(event ? updateEvent : createEvent, initial);
  const [repeats, setRepeats] = useState<'once' | 'weekly'>(
    event ? (event.date ? 'once' : 'weekly') : 'once',
  );

  return (
    <section className="rounded-tile border-2 border-line bg-ground-raised p-4">
      <h2 className="mb-3 text-[1.25rem] font-extrabold">{event ? 'Edit event' : 'New event'}</h2>
      <form action={formAction} className="space-y-3">
        {event ? <input type="hidden" name="id" value={event.id} /> : null}

        <div className="flex gap-3">
          <label className="w-24">
            <span className="block text-[0.95rem] font-semibold">Icon</span>
            <input name="icon" defaultValue={event?.icon ?? '📅'} required maxLength={16}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-3 py-3 text-center text-[1.6rem]" />
          </label>
          <label className="flex-1">
            <span className="block text-[0.95rem] font-semibold">Name</span>
            <input name="title" defaultValue={event?.title} required maxLength={80}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.1rem]" />
          </label>
        </div>

        <fieldset>
          <legend className="text-[0.95rem] font-semibold">Repeats</legend>
          <div className="mt-1 flex gap-2">
            {(['once', 'weekly'] as const).map((r) => (
              <label key={r} className="cursor-pointer">
                <input type="radio" name="repeats" value={r} checked={repeats === r}
                  onChange={() => setRepeats(r)} className="peer sr-only" />
                <span className="tap inline-flex rounded-full border-2 border-line px-5 py-2 font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-ground">
                  {r === 'once' ? 'Just once' : 'Every week'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {repeats === 'once' ? (
          <label className="block">
            <span className="block text-[0.95rem] font-semibold">Date</span>
            <input type="date" name="date" defaultValue={event?.date ?? today}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
          </label>
        ) : (
          <>
            <fieldset>
              <legend className="text-[0.95rem] font-semibold">Days</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <label key={d.value} className="cursor-pointer">
                    <input type="checkbox" name="daysOfWeek" value={d.value}
                      defaultChecked={event?.daysOfWeek?.includes(d.value) ?? false} className="peer sr-only" />
                    <span className="tap inline-flex rounded-full border-2 border-line px-4 py-2 font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-ground">
                      {d.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="block text-[0.95rem] font-semibold">Starts (optional)</span>
                <input type="date" name="startsOn" defaultValue={event?.startsOn ?? ''}
                  className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
              </label>
              <label className="flex-1">
                <span className="block text-[0.95rem] font-semibold">Ends (optional)</span>
                <input type="date" name="endsOn" defaultValue={event?.endsOn ?? ''}
                  className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
              </label>
            </div>
            <p className="text-[0.85rem] text-ink-soft">
              An end date means the activity disappears on its own when the term finishes.
            </p>
          </>
        )}

        <div className="flex gap-3">
          <label className="flex-1">
            <span className="block text-[0.95rem] font-semibold">Start time (optional)</span>
            <input type="time" name="startTime" defaultValue={event?.startTime?.slice(0, 5) ?? ''}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
          </label>
          <label className="flex-1">
            <span className="block text-[0.95rem] font-semibold">End time (optional)</span>
            <input type="time" name="endTime" defaultValue={event?.endTime?.slice(0, 5) ?? ''}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
          </label>
        </div>
        <p className="text-[0.85rem] text-ink-soft">Leave times blank for an all-day event.</p>

        <fieldset>
          <legend className="text-[0.95rem] font-semibold">Who is it for?</legend>
          <p className="text-[0.85rem] text-ink-soft">Choose nobody for a whole-family event.</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {people.map((p) => (
              <label key={p.id} className="cursor-pointer">
                <input type="checkbox" name="personIds" value={p.id}
                  defaultChecked={event?.people.some((e) => e.id === p.id) ?? false} className="peer sr-only" />
                <span
                  className="tap inline-flex items-center gap-2 rounded-full border-4 px-4 py-2 font-semibold peer-checked:bg-[var(--sel)]"
                  style={{ borderColor: p.colour, ['--sel' as string]: p.colour }}
                >
                  <span aria-hidden>{p.icon}</span>{p.displayName}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="block text-[0.95rem] font-semibold">Where (optional)</span>
          <input name="location" defaultValue={event?.location ?? ''} maxLength={80}
            className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
        </label>

        <label className="flex items-center gap-3">
          <input type="checkbox" name="isSchoolRelated" defaultChecked={event?.isSchoolRelated ?? false} className="h-6 w-6" />
          <span className="text-[1rem] font-semibold">School related</span>
        </label>

        <Notice error={state.error} ok={state.ok} />

        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60">
            {pending ? 'Saving…' : event ? 'Save' : 'Add event'}
          </button>
          <button type="button" onClick={onDone} className="rounded-full border-2 border-line px-6 py-3 font-semibold">
            {state.ok ? 'Done' : 'Cancel'}
          </button>
        </div>
      </form>
    </section>
  );
}
