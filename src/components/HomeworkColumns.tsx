'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { tickHomework, untickHomework } from '@/lib/actions/homework';
import { ChildCardHeader } from './ChildCardHeader';

type Item = {
  id: number; title: string; icon: string; kind: 'weekly' | 'one_off';
  unitLabel: string | null; done: number; target: number;
  overdue: boolean; due: string | null;
};
type Child = { id: number; displayName: string; colour: string; icon: string; items: Item[] };

/**
 * Three columns of homework. A weekly item is a row of boxes to fill,
 * one per time it is needed this week: a young child can count boxes long before
 * they can read "3 times". A one-off is a single box with its due date.
 */
export function HomeworkColumns({ children: initial }: { children: Child[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [kids, apply] = useOptimistic(
    initial,
    (current: Child[], u: { itemId: number; delta: 1 | -1 }) =>
      current.map((c) => ({
        ...c,
        items: c.items.map((i) =>
          i.id === u.itemId ? { ...i, done: Math.min(i.target, Math.max(0, i.done + u.delta)) } : i,
        ),
      })),
  );

  function change(child: Child, item: Item, delta: 1 | -1) {
    if (delta === 1 && item.done >= item.target) return;
    if (delta === -1 && item.done === 0) return;
    setError(null);
    startTransition(async () => {
      apply({ itemId: item.id, delta });
      const result = delta === 1
        ? await tickHomework(item.id, child.id)
        : await untickHomework(item.id, child.id);
      if (!result.ok) setError(result.error);
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
      <div className="grid flex-1 grid-cols-1 gap-6 md:min-h-0 md:grid-cols-3 md:gap-3">
        {kids.map((child, i) => (
          <ChildColumn key={child.id} child={child} column={i} onChange={(item, d) => change(child, item, d)} />
        ))}
      </div>
    </>
  );
}

function ChildColumn({
  child, column, onChange,
}: {
  child: Child;
  column: number;
  onChange: (item: Item, delta: 1 | -1) => void;
}) {
  const weekly = child.items.filter((i) => i.kind === 'weekly');
  const oneOffs = child.items.filter((i) => i.kind === 'one_off');
  const completed = child.items.reduce((n, i) => n + i.done, 0);
  const total = child.items.reduce((n, i) => n + i.target, 0);
  const tilt = [-1.1, 0.8, -0.6][column % 3];

  return (
    <section
      className={`paper taped${column % 2 === 1 ? ' taped-r' : ''} flex flex-col md:min-h-0`}
      style={{ transform: `rotate(${tilt}deg)` }}
      aria-label={`${child.displayName}'s homework`}
    >
      <div className="h-[9px] shrink-0 rounded-t-[3px]" style={{ backgroundColor: child.colour }} />
      <div className="px-4 pt-4">
        {total === 0 ? (
          // No homework: a "0/0" tally would only be noise.
          <p className="serif text-[27px] font-bold leading-none">{child.displayName}</p>
        ) : (
          <ChildCardHeader
            displayName={child.displayName}
            colour={child.colour}
            completed={completed}
            total={total}
            caption={completed >= total ? 'All done' : `${total - completed} to do`}
          />
        )}
      </div>

      <div className="mt-2 px-4 pb-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
        {child.items.length === 0 ? (
          <p className="py-6 text-center text-[1.05rem] font-bold text-ink-soft">No homework yet.</p>
        ) : null}

        {weekly.length > 0 ? (
          <ul className="space-y-2">
            {weekly.map((item) => (
              <li key={item.id}>
                <HomeworkRow item={item} colour={child.colour} onChange={(d) => onChange(item, d)} />
              </li>
            ))}
          </ul>
        ) : null}

        {oneOffs.length > 0 ? (
          <>
            <h3 className="mb-2 mt-4 border-t-[1.5px] border-line pt-2.5 text-[12px] font-extrabold uppercase tracking-[0.15em] text-ink-soft">
              To hand in
            </h3>
            <ul className="space-y-2">
              {oneOffs.map((item) => (
                <li key={item.id}>
                  <HomeworkRow item={item} colour={child.colour} onChange={(d) => onChange(item, d)} />
                </li>
              ))}
            </ul>
          </>
        ) : null}

      </div>
    </section>
  );
}

function HomeworkRow({
  item, colour, onChange,
}: {
  item: Item;
  colour: string;
  onChange: (delta: 1 | -1) => void;
}) {
  const complete = item.done >= item.target;
  const label = `${item.title}: ${item.done} of ${item.target}${complete ? ', done' : ''}`;

  return (
    <div
      className="flex items-stretch gap-1.5 rounded-tile p-1.5"
      style={{
        backgroundColor: complete ? colour : 'var(--color-ground-sunken)',
        border: complete ? '2px solid var(--color-ink)' : '2px dashed var(--color-line-strong)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label={label}
        aria-disabled={complete}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-transform duration-150 active:scale-[0.98]"
      >
        <span aria-hidden className="text-[1.8rem] leading-none" style={{ opacity: complete ? 0.55 : 1 }}>
          {item.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.95rem] font-extrabold leading-tight">{item.title}</span>
          {item.unitLabel ? (
            <span className="block text-[0.8rem] font-semibold text-ink-soft">{item.unitLabel} each</span>
          ) : null}
          {item.due ? (
            <span
              className="block text-[0.8rem] font-bold"
              style={{ color: item.overdue ? 'var(--color-warn)' : 'var(--color-ink-soft)' }}
            >
              {item.due}
            </span>
          ) : null}
          {/* One box per time it is needed. Counted, not read. */}
          <span className="mt-1.5 flex flex-wrap gap-1" aria-hidden>
            {Array.from({ length: item.target }, (_, i) => (
              <span
                key={i}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] border-2 text-[0.8rem] font-extrabold"
                style={{
                  backgroundColor: i < item.done ? (complete ? 'var(--color-ground-raised)' : colour) : 'transparent',
                  borderColor: i < item.done ? 'var(--color-ink)' : 'var(--color-line-strong)',
                }}
              >
                {i < item.done ? '✓' : ''}
              </span>
            ))}
          </span>
        </span>
      </button>

      {item.done > 0 ? (
        <button
          type="button"
          onClick={() => onChange(-1)}
          aria-label={`Take one tick off ${item.title}`}
          className="tap shrink-0 self-center rounded-full border-2 border-ink bg-ground-raised px-3 text-[1.3rem] font-extrabold leading-none"
        >
          <span aria-hidden>−</span>
        </button>
      ) : null}
    </div>
  );
}
