import Link from 'next/link';
import { requireParentPin } from '@/lib/guards';
import { AdminShell } from '@/components/AdminShell';

const SECTIONS = [
  { href: '/admin/planner', title: 'Week planner', body: 'Dinners and lunches for the week, on one page. The Sunday job.' },
  { href: '/admin/people', title: 'People', body: 'Each child\u2019s colour, icon and name. Let them pick their own.' },
  { href: '/admin/routines', title: 'Morning routines', body: 'Add, edit, reorder and hide each child\u2019s morning jobs.' },
  { href: '/admin/events', title: 'Calendar', body: 'Events, clubs and one-off dates. Weekly things repeat on their own.' },
  { href: '/admin/chores', title: 'Jobs and rewards', body: 'What earns stars, what they buy, and anything waiting for approval.' },
  { href: '/admin/homework', title: 'Homework', body: 'Weekly reading and practice, one-off projects, and the day the week starts.' },
  { href: '/admin/points', title: 'Points', body: 'Every star earned and spent, and manual adjustments.' },
  { href: '/admin/school', title: 'School days', body: 'Term dates, holidays and INSET days. Weekends work themselves out.' },
];

export default async function AdminPage() {
  await requireParentPin('/admin');

  return (
    <AdminShell title="Grown-ups">
      <ul className="space-y-3">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="tap block rounded-tile border-2 border-line bg-ground-raised p-5"
            >
              <p className="text-[1.3rem] font-extrabold">{s.title}</p>
              <p className="mt-1 text-[1rem] text-ink-soft">{s.body}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <Link
          href="/api/export"
          className="tap inline-flex items-center rounded-full border-2 border-line px-6 py-3 font-semibold"
        >
          Download a backup
        </Link>
      </div>
    </AdminShell>
  );
}
