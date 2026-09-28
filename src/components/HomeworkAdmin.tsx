'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  createHomework, setHomeworkActive, setHomeworkWeekStart, updateHomework, type ActionState,
} from '@/lib/actions/homework';
import { formatDueDate, WEEKDAY_NAMES } from '@/lib/homework';
import { Notice } from './Notice';

type Person = { id: number; displayName: string; colour: string; icon: string };
type Item = {
  id: number; personId: number; title: string; icon: string; kind: 'weekly' | 'one_off';
  targetPerWeek: number | null; unitLabel: string | null; dueDate: string | null; isActive: boolean;
};

const initial: ActionState = { error: null };

/** Grown-ups' homework page: the week start, and what each child has. */
export function HomeworkAdmin({
  weekStartDay, people, items,
}: {
  weekStartDay: number;
  people: Person[];
  items: Item[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-10">
      <WeekStart day={weekStartDay} />

      <section>
        <h2 className="mb-3 text-[1.25rem] font-extrabold">Homework</h2>
        {adding ? (
          <HomeworkForm people={people} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            className="tap mb-4 w-full rounded-tile border-2 border-dashed border-line px-6 py-4 font-bold">
            + Add homework
          </button>
        )}

        <div className="space-y-6">
          {people.map((p) => {
            const theirs = items.filter((i) => i.personId === p.id);
            return (
              <div key={p.id}>
                <h3 className="mb-2 text-[1.05rem] font-extrabold">
                  <span aria-hidden>{p.icon} </span>{p.displayName}
                </h3>
                {theirs.length === 0 ? (
                  <p className="text-[0.95rem] text-ink-soft">Nothing yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {theirs.map((i) => <HomeworkRow key={i.id} item={i} people={people} />)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WeekStart({ day }: { day: number }) {
  const [value, setValue] = useState(day);
  const [status, setStatus] = useState('');
  const [, startTransition] = useTransition();

  return (
    <section>
      <label className="block">
        <span className="block text-[1.25rem] font-extrabold">The homework week starts on</span>
        <span className="mb-2 block text-[0.9rem] text-ink-soft">
          Weekly ticks start again from empty on this morning. Set it to the day new homework comes home.
        </span>
        <span className="flex items-center gap-3">
          <select
            value={value}
            onChange={(e) => {
              const next = Number(e.target.value);
              setValue(next);
              setStatus('Saving');
              startTransition(async () => {
                const r = await setHomeworkWeekStart(next);
                setStatus(r.ok ? 'Saved' : r.error);
              });
            }}
            className="rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]"
          >
            {WEEKDAY_NAMES.map((name, i) => <option key={name} value={i}>{name}</option>)}
          </select>
          <span className="text-[0.9rem] font-semibold text-ink-soft" aria-live="polite">{status}</span>
        </span>
      </label>
    </section>
  );
}

function describe(item: Item): string {
  if (item.kind === 'weekly') {
    const times = item.targetPerWeek ?? 1;
    return `${times === 1 ? 'Once' : `${times} times`} a week${item.unitLabel ? ` · ${item.unitLabel} each` : ''}`;
  }
  return item.dueDate ? `One-off · due ${formatDueDate(item.dueDate)}` : 'One-off';
}

function HomeworkRow({ item, people }: { item: Item; people: Person[] }) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  if (editing) return <li><HomeworkForm item={item} people={people} onDone={() => setEditing(false)} /></li>;

  return (
    <li className="flex items-center gap-3 rounded-tile border-2 border-line bg-ground-raised p-3"
      style={{ opacity: item.isActive ? 1 : 0.5 }}>
      <span className="text-[1.8rem] leading-none" aria-hidden>{item.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.1rem] font-bold">{item.title}</p>
        <p className="text-[0.9rem] text-ink-soft">{describe(item)}{item.isActive ? '' : ' · retired'}</p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="rounded-full border-2 border-line px-4 py-2 font-semibold">Edit</button>
      <button type="button"
        onClick={() => startTransition(() => { void setHomeworkActive(item.id, !item.isActive); })}
        className="rounded-full border-2 border-line px-4 py-2 font-semibold">
        {item.isActive ? 'Retire' : 'Restore'}
      </button>
    </li>
  );
}

function HomeworkForm({ item, people, onDone }: { item?: Item; people: Person[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(item ? updateHomework : createHomework, initial);
  const [kind, setKind] = useState<'weekly' | 'one_off'>(item?.kind ?? 'weekly');

  return (
    <section className="mb-4 rounded-tile border-2 border-line bg-ground-raised p-4">
      <form action={formAction} className="space-y-3">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}

        <label className="block">
          <span className="block text-[0.95rem] font-semibold">Who</span>
          <select name="personId" defaultValue={item?.personId ?? people[0]?.id} required
            className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]">
            {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="w-20">
            <span className="block text-[0.95rem] font-semibold">Icon</span>
            <input name="icon" defaultValue={item?.icon ?? '📝'} required maxLength={16}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-2 py-3 text-center text-[1.5rem]" />
          </label>
          <label className="flex-1">
            <span className="block text-[0.95rem] font-semibold">What is it?</span>
            <input name="title" defaultValue={item?.title} required maxLength={60}
              placeholder="e.g. Topic project on the Romans"
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
          </label>
        </div>

        <fieldset>
          <legend className="text-[0.95rem] font-semibold">How often</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {([['weekly', 'Every week'], ['one_off', 'Just once']] as const).map(([value, label]) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" name="kind" value={value} checked={kind === value}
                  onChange={() => setKind(value)} className="peer sr-only" />
                <span className="tap inline-flex rounded-full border-2 border-line px-4 py-2 font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-ground">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === 'weekly' ? (
          <div className="flex gap-3">
            <label className="w-32">
              <span className="block text-[0.95rem] font-semibold">Times a week</span>
              <input type="number" name="targetPerWeek" min={1} max={20} defaultValue={item?.targetPerWeek ?? 1}
                className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-3 py-3 text-center text-[1.05rem]" />
            </label>
            <label className="flex-1">
              <span className="block text-[0.95rem] font-semibold">
                Each tick is <span className="font-normal text-ink-soft">(optional)</span>
              </span>
              <input name="unitLabel" defaultValue={item?.unitLabel ?? ''} maxLength={30}
                placeholder="e.g. 25 correct answers"
                className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
            </label>
          </div>
        ) : (
          <label className="block">
            <span className="block text-[0.95rem] font-semibold">
              Due <span className="font-normal text-ink-soft">(optional)</span>
            </span>
            <input type="date" name="dueDate" defaultValue={item?.dueDate ?? ''}
              className="mt-1 w-full rounded-xl border-2 border-line bg-ground px-4 py-3 text-[1.05rem]" />
          </label>
        )}

        <Notice error={state.error} ok={state.ok} />
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60">
            {pending ? 'Saving…' : item ? 'Save' : 'Add homework'}
          </button>
          <button type="button" onClick={onDone} className="rounded-full border-2 border-line px-6 py-3 font-semibold">
            {state.ok ? 'Done' : 'Cancel'}
          </button>
        </div>
      </form>
    </section>
  );
}
