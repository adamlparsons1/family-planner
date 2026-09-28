'use client';

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleRoutineTask } from '@/lib/actions/routine';
import { ProgressRing } from './ProgressRing';
import { darken, readableTextOn } from '@/lib/contrast';
import { useScrollToNext } from './useScrollToNext';

type Task = { id: number; title: string; icon: string; category: string; done: boolean };
type Stage = { category: string; tasks: Task[] };

const AUTO_RETURN_MS = 60_000;

/**
 * One child's whole morning as a single scrolling list, grouped by stage.
 *
 * Same shape as a column on /routine: the list keeps itself pointed at
 * the next job, and finishing everything shows a banner above the tiles rather
 * than replacing them, so a mis-tap on the last job can still be undone.
 */
export function RoutineBoard({
  stages: initialStages,
  colour,
  displayName,
  icon,
}: {
  stages: Stage[];
  colour: string;
  displayName: string;
  icon: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [stages, setOptimistic] = useOptimistic(
    initialStages,
    (current: Stage[], update: { taskId: number; done: boolean }) =>
      current.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === update.taskId ? { ...t, done: update.done } : t)),
      })),
  );

  const all = useMemo(() => stages.flatMap((s) => s.tasks), [stages]);
  const total = all.length;
  const completed = all.filter((t) => t.done).length;
  const allDone = total > 0 && completed === total;
  const nextTask = all.find((t) => !t.done);
  const ink = readableTextOn(colour);

  const listRef = useScrollToNext(completed, 56);

  /** Auto-return home, so the wall display never sits stranded on one child. */
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetReturnTimer = () => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    returnTimer.current = setTimeout(() => router.push('/'), AUTO_RETURN_MS);
  };
  useEffect(() => {
    resetReturnTimer();
    return () => {
      if (returnTimer.current) clearTimeout(returnTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onToggle(task: Task) {
    resetReturnTimer();
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
    <div className="safe-pad flex h-dvh flex-col" style={{ backgroundColor: colour, color: ink }}>
      <header className="relative z-10 flex items-center justify-between gap-6 px-3 pt-3">
        <a
          href="/"
          className="tap inline-flex items-center gap-3 rounded-full px-6 py-3 text-kiosk-base font-bold"
          style={{ backgroundColor: darken(colour, 0.18), color: ink }}
        >
          <span aria-hidden>←</span> Home
        </a>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-kiosk-lg font-extrabold leading-none">{displayName}</p>
            <p className="text-kiosk-sm opacity-80">
              {allDone ? 'All done' : `${nextTask?.category ?? ''} · ${total - completed} to go`}
            </p>
          </div>
          <ProgressRing completed={completed} total={total} colour={ink} size={84} />
        </div>
      </header>

      {error ? (
        <p role="alert" className="mx-3 mt-4 rounded-tile bg-white/90 px-6 py-4 text-kiosk-base font-semibold text-ink">
          {error}
        </p>
      ) : null}

      {/* A banner, not a replacement screen: the tiles stay below. */}
      {allDone ? (
        <div
          className="mx-3 mt-4 flex items-center justify-center gap-4 rounded-tile bg-white px-6 py-3 text-ink"
          role="status"
        >
          <span className="text-[3rem] leading-none" aria-hidden>{icon}</span>
          <p>
            <span className="block text-kiosk-lg font-extrabold leading-none">All done!</span>
            <span className="text-kiosk-sm font-semibold">Well done, {displayName}.</span>
          </p>
        </div>
      ) : null}

      <div ref={listRef} className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6">
        {stages.map((stage) => {
          const stageDone = stage.tasks.every((t) => t.done);
          return (
            <section key={stage.category} aria-label={stage.category} className="mx-auto mb-5 max-w-5xl">
              <h2
                className="sticky top-0 z-[2] py-2 text-center text-kiosk-base font-extrabold"
                style={{ backgroundColor: colour }}
              >
                {stageDone ? '✓ ' : ''}{stage.category}
              </h2>
              <ul
                className="grid justify-center gap-4"
                style={{
                  // Cap the column width so a one-task stage does not become one
                  // enormous tile filling the screen.
                  gridTemplateColumns: `repeat(${Math.min(stage.tasks.length, 4)}, minmax(130px, 210px))`,
                }}
              >
                {stage.tasks.map((task) => (
                  <li key={task.id} data-next={task.id === nextTask?.id ? 'true' : undefined}>
                    <TaskTile task={task} colour={colour} onToggle={() => onToggle(task)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskTile({
  task,
  colour,
  onToggle,
}: {
  task: Task;
  colour: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={task.done}
      className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-tile p-3 transition-transform duration-150 active:scale-95"
      style={{
        minHeight: 130,
        backgroundColor: task.done ? darken(colour, 0.32) : '#ffffff',
        color: task.done ? '#ffffff' : '#2b2620',
        boxShadow: task.done ? 'none' : '0 4px 0 rgba(0,0,0,0.16)',
      }}
    >
      <span
        className="text-[2.75rem] leading-none transition-transform duration-300"
        style={{ transform: task.done ? 'scale(0.85)' : 'scale(1)' }}
        aria-hidden
      >
        {task.icon}
      </span>
      <span className="text-center text-[1.05rem] font-bold leading-tight">{task.title}</span>
      {/* A tick as well as a colour change: "done" is never carried by colour alone. */}
      <span
        className="text-[1.35rem] leading-none"
        style={{ opacity: task.done ? 1 : 0, transition: 'opacity 200ms' }}
        aria-hidden
      >
        ✓
      </span>
      <span className="sr-only">{task.done ? 'Done' : 'Not done'}</span>
    </button>
  );
}
