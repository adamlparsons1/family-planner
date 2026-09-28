'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  createRoutineTask, moveRoutineTask, setRoutineTaskActive, updateRoutineTask,
  type ActionState,
} from '@/lib/actions/admin-routine';
import { Notice } from './Notice';

type Task = {
  id: number; title: string; icon: string; category: string;
  sortOrder: number; daysOfWeek: number[]; schoolDaysOnly: boolean; isActive: boolean;
};
type Person = { id: number; name: string; displayName: string; colour: string; icon: string };

const DAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const initial: ActionState = { error: null };

export function RoutineAdmin({
  people,
  tasksByPerson,
  categories,
}: {
  people: Person[];
  tasksByPerson: Record<number, Task[]>;
  categories: readonly string[];
}) {
  const [selected, setSelected] = useState(people[0]?.id ?? 0);
  const tasks = tasksByPerson[selected] ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-3">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            aria-pressed={p.id === selected}
            className="tap rounded-full border-4 px-5 py-3 text-[1.05rem] font-bold"
            style={{
              backgroundColor: p.id === selected ? p.colour : 'transparent',
              borderColor: p.colour,
              color: '#2b2620',
            }}
          >
            <span aria-hidden className="mr-2">{p.icon}</span>
            {p.displayName}
          </button>
        ))}
      </div>

      {categories.map((category) => {
        const inCategory = tasks.filter((t) => t.category === category);
        return (
          <section key={category} className="mb-8">
            <h2 className="mb-3 text-[1.25rem] font-extrabold uppercase tracking-wide text-ink-soft">
              {category}
            </h2>
            {inCategory.length === 0 ? (
              <p className="mb-3 text-[1rem] text-ink-soft">Nothing in this stage yet.</p>
            ) : (
              <ul className="space-y-3">
                {inCategory.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    personId={selected}
                    categories={categories}
                    isFirst={i === 0}
                    isLast={i === inCategory.length - 1}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <NewTaskForm personId={selected} categories={categories} />
    </div>
  );
}

function TaskRow({
  task, personId, categories, isFirst, isLast,
}: {
  task: Task; personId: number; categories: readonly string[]; isFirst: boolean; isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateRoutineTask, initial);
  const [, startTransition] = useTransition();

  if (editing) {
    return (
      <li className="rounded-tile border-2 border-line bg-ground-raised p-4">
        <form action={formAction}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="personId" value={personId} />
          <TaskFields task={task} categories={categories} />
          <Notice error={state.error} ok={state.ok} />
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={pending} className="rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60">
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full border-2 border-line px-6 py-3 font-semibold">
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className="flex items-center gap-3 rounded-tile border-2 border-line bg-ground-raised p-3"
      style={{ opacity: task.isActive ? 1 : 0.5 }}
    >
      <span className="text-[2rem] leading-none" aria-hidden>{task.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.15rem] font-bold">{task.title}</p>
        <p className="text-[0.9rem] text-ink-soft">
          {task.daysOfWeek.length === 5 && !task.daysOfWeek.includes(0) && !task.daysOfWeek.includes(6)
            ? 'Weekdays'
            : DAYS.filter((d) => task.daysOfWeek.includes(d.value)).map((d) => d.label).join(', ')}
          {task.schoolDaysOnly ? ' · school days only' : ''}
          {task.isActive ? '' : ' · hidden'}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button" aria-label="Move up" disabled={isFirst}
          onClick={() => startTransition(() => { void moveRoutineTask(task.id, 'up'); })}
          className="rounded-full border-2 border-line px-3 py-2 disabled:opacity-30"
        >↑</button>
        <button
          type="button" aria-label="Move down" disabled={isLast}
          onClick={() => startTransition(() => { void moveRoutineTask(task.id, 'down'); })}
          className="rounded-full border-2 border-line px-3 py-2 disabled:opacity-30"
        >↓</button>
        <button type="button" onClick={() => setEditing(true)} className="rounded-full border-2 border-line px-4 py-2 font-semibold">
          Edit
        </button>
        <button
          type="button"
          onClick={() => startTransition(() => { void setRoutineTaskActive(task.id, !task.isActive); })}
          className="rounded-full border-2 border-line px-4 py-2 font-semibold"
        >
          {task.isActive ? 'Hide' : 'Show'}
        </button>
      </div>
    </li>
  );
}

function NewTaskForm({ personId, categories }: { personId: number; categories: readonly string[] }) {
  const [state, formAction, pending] = useActionState(createRoutineTask, initial);
  return (
    <section className="rounded-tile border-2 border-dashed border-line p-4">
      <h2 className="mb-3 text-[1.25rem] font-extrabold">Add a job</h2>
      <form action={formAction}>
        <input type="hidden" name="personId" value={personId} />
        <TaskFields categories={categories} />
        <Notice error={state.error} ok={state.ok} />
        <button type="submit" disabled={pending} className="mt-3 rounded-full bg-ink px-6 py-3 font-bold text-ground disabled:opacity-60">
          {pending ? 'Adding…' : 'Add job'}
        </button>
      </form>
    </section>
  );
}

function TaskFields({ task, categories }: { task?: Task; categories: readonly string[] }) {
  const days = task?.daysOfWeek ?? [1, 2, 3, 4, 5];
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <label className="w-24">
          <span className="block text-[0.95rem] font-semibold">Icon</span>
          <input
            name="icon" defaultValue={task?.icon} required maxLength={16}
            className="mt-1 w-full rounded-xl border-2 border-line bg-ground-raised px-3 py-3 text-center text-[1.6rem]"
          />
        </label>
        <label className="flex-1">
          <span className="block text-[0.95rem] font-semibold">Name</span>
          <input
            name="title" defaultValue={task?.title} required maxLength={60}
            className="mt-1 w-full rounded-xl border-2 border-line bg-ground-raised px-4 py-3 text-[1.1rem]"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-[0.95rem] font-semibold">Stage</span>
        <select
          name="category" defaultValue={task?.category ?? categories[0]}
          className="mt-1 w-full rounded-xl border-2 border-line bg-ground-raised px-4 py-3 text-[1.1rem]"
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <fieldset>
        <legend className="text-[0.95rem] font-semibold">Days</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <label key={d.value} className="cursor-pointer">
              <input
                type="checkbox" name="daysOfWeek" value={d.value}
                defaultChecked={days.includes(d.value)} className="peer sr-only"
              />
              <span className="tap inline-flex items-center rounded-full border-2 border-line px-4 py-2 font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-ground">
                {d.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3">
        <input
          type="checkbox" name="schoolDaysOnly" defaultChecked={task?.schoolDaysOnly ?? false}
          className="h-6 w-6"
        />
        <span className="text-[1rem] font-semibold">
          School days only <span className="font-normal text-ink-soft">— hidden in the holidays and on INSET days</span>
        </span>
      </label>
    </div>
  );
}
