'use client';

import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleRoutineTask } from '@/lib/actions/routine';
import { ChildCardHeader } from './ChildCardHeader';
import { useScrollToNext } from './useScrollToNext';
import { LUNCH_ICONS, LUNCH_LABELS } from '@/lib/lunch';

type Task = { id: number; title: string; icon: string; category: string; done: boolean };
type Stage = { category: string; tasks: Task[] };
type Child = {
  id: number; name: string; displayName: string; colour: string; icon: string;
  stages: Stage[];
  /** Present only when this child's card shows today's lunch. */
  lunch?: { choice: 'school' | 'packed' | null; dish: string | null } | null;
};

/**
 * Every child side by side, each with their own scrolling list.
 *
 * This is the shape the morning actually takes: several children looking at one
 * wall display at the same time, moving at different speeds. Each column is a
 * single list, grouped by stage, that keeps itself pointed at that child's next
 * job. Nothing here is shared between columns except the screen.
 */
export function RoutineColumns({ children: initialChildren }: { children: Child[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [kids, setOptimistic] = useOptimistic(
    initialChildren,
    (current: Child[], u: { taskId: number; done: boolean }) =>
      current.map((c) => ({
        ...c,
        stages: c.stages.map((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === u.taskId ? { ...t, done: u.done } : t)),
        })),
      })),
  );

  function onToggle(task: Task) {
    setError(null);
    const next = !task.done;
    startTransition(async () => {
      setOptimistic({ taskId: task.id, done: next });
      const result = await toggleRoutineTask({ taskId: task.id, done: next });
      if (!result.ok) setError('That did not save. Check the wifi and try again.');
      router.refresh();
    });
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-tile bg-ground-sunken px-5 py-3 text-center text-kiosk-sm font-bold text-warn">
          {error}
        </p>
      ) : null}

      {/* min-h-0 is load-bearing: without it the grid grows to fit its
          content and the whole page scrolls, instead of each column
          scrolling inside a fixed-height board. */}
      <div className="grid flex-1 grid-cols-1 gap-6 md:min-h-0 md:grid-cols-3 md:gap-3">
        {kids.map((child, i) => (
          <ChildColumn key={child.id} child={child} onToggle={onToggle} column={i} />
        ))}
      </div>
    </>
  );
}

function ChildColumn({
  child,
  onToggle,
  column,
}: {
  child: Child;
  onToggle: (t: Task) => void;
  /** Position on the board, so each card's tilt is stable and they alternate. */
  column: number;
}) {
  const all = useMemo(() => child.stages.flatMap((s) => s.tasks), [child.stages]);
  const total = all.length;
  const completed = all.filter((t) => t.done).length;
  const allDone = total > 0 && completed === total;
  const nextTask = all.find((t) => !t.done);

  const listRef = useScrollToNext(completed);

  /** Deterministic per column, so the tilt never jitters between renders. */
  const tilt = [-1.1, 0.8, -0.6][column % 3];

  return (
    <section
      className={`paper taped${column % 2 === 1 ? ' taped-r' : ''} flex flex-col md:min-h-0`}
      style={{ transform: `rotate(${tilt}deg)` }}
      aria-label={`${child.displayName}'s morning`}
    >
      <div
        className="h-[9px] shrink-0 rounded-t-[3px]"
        style={{ backgroundColor: child.colour }}
      />

      <div className="px-4 pt-4">
        <ChildCardHeader
          displayName={child.displayName}
          colour={child.colour}
          completed={completed}
          total={total}
          caption={
            total === 0
              ? undefined
              : allDone
                ? 'All done'
                : `${nextTask?.category ?? ''} · ${total - completed} left`
          }
        />
        {child.lunch?.choice ? <LunchNote choice={child.lunch.choice} dish={child.lunch.dish} /> : null}
      </div>

      {total === 0 ? (
        <p className="flex flex-1 items-center justify-center p-4 text-center text-[1.05rem] font-bold text-ink-soft">
          Nothing to do today
        </p>
      ) : (
        <>
          {/* A banner, not a replacement: the tiles stay below it so a
              mis-tapped last job can still be unticked. */}
          {allDone ? (
            <div
              className="mx-4 mt-2 flex items-center gap-3 rounded-tile border-2 border-ink px-4 py-2"
              style={{ backgroundColor: child.colour }}
              role="status"
            >
              <span className="serif text-[2rem] leading-none" aria-hidden>&#10003;</span>
              <p className="leading-tight">
                <span className="serif block text-[1.35rem] font-bold">All done!</span>
                <span className="text-[0.9rem] font-semibold">Well done, {child.displayName}.</span>
              </p>
            </div>
          ) : null}

          <div
            ref={listRef}
            className="mt-2 px-4 pb-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain"
          >
            {child.stages.map((stage) => {
              const stageDone = stage.tasks.every((t) => t.done);
              return (
                <section key={stage.category} aria-label={stage.category} className="mb-3">
                  {/* Sticky so a child mid-list can always see which part of
                      the morning they are in. */}
                  <h3 className="sticky top-0 z-[2] -mx-1 flex items-center gap-2 bg-ground-raised px-1 py-2 text-[0.8rem] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-[3px] border-2"
                      style={{
                        backgroundColor: stageDone ? child.colour : 'transparent',
                        borderColor: 'var(--color-ink)',
                      }}
                    />
                    {stage.category}
                    {stageDone ? <span aria-label="done">&#10003;</span> : null}
                  </h3>
                  <ul className="grid grid-cols-2 gap-[9px]">
                    {stage.tasks.map((task) => (
                      <li key={task.id} className="w-full" data-next={task.id === nextTask?.id ? 'true' : undefined}>
                        <TaskTile task={task} colour={child.colour} onToggle={() => onToggle(task)} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Today's lunch, to read and not to change. Grown-ups set it, and the
 * school dinner menu, in the week planner. The icon carries it for a child
 * who is still learning to read; the dish is for one who can.
 */
function LunchNote({ choice, dish }: { choice: 'school' | 'packed'; dish: string | null }) {
  return (
    <p
      className="mt-3 flex items-center gap-2.5 rounded-tile border-[1.5px] border-line bg-ground-sunken px-3 py-2"
      aria-label={`Lunch today: ${LUNCH_LABELS[choice]}${choice === 'school' && dish ? `, ${dish}` : ''}`}
    >
      <span aria-hidden className="text-[1.6rem] leading-none">{LUNCH_ICONS[choice]}</span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[0.95rem] font-extrabold">{LUNCH_LABELS[choice]}</span>
        {choice === 'school' && dish ? (
          <span className="block text-[0.9rem] font-semibold text-ink-soft">{dish}</span>
        ) : null}
      </span>
    </p>
  );
}

function TaskTile({ task, colour, onToggle }: { task: Task; colour: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={task.done}
      className="relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-tile p-2 transition-transform duration-150 active:scale-95"
      style={{
        minHeight: 108,
        // To do: a dashed note waiting to be filled in. Done: inked in.
        backgroundColor: task.done ? colour : 'var(--color-ground-sunken)',
        border: task.done ? '2px solid var(--color-ink)' : '2px dashed var(--color-line-strong)',
        color: 'var(--color-ink)',
      }}
    >
      <span
        className="text-[2rem] leading-none transition-all duration-300"
        style={{ transform: task.done ? 'scale(0.86)' : 'scale(1)', opacity: task.done ? 0.5 : 1 }}
        aria-hidden
      >
        {task.icon}
      </span>
      <span className="text-center text-[0.82rem] font-extrabold leading-tight">{task.title}</span>
      {/* A ticked-off entry in a ledger. Never colour alone. */}
      <span
        className="serif absolute right-1.5 top-0.5 text-[1.55rem] font-extrabold leading-none"
        style={{ opacity: task.done ? 1 : 0, transition: 'opacity 200ms' }}
        aria-hidden
      >
        &#10003;
      </span>
      <span className="sr-only">{task.done ? 'Done' : 'Not done'}</span>
    </button>
  );
}
