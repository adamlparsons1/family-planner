import Link from 'next/link';
import { lockPin } from '@/lib/actions/auth';

/**
 * Phone-first admin chrome. Parents use this standing in the kitchen on a
 * phone, so navigation is a row of large targets rather than a sidebar.
 */
export function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const links = [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/planner', label: 'Week planner' },
    { href: '/admin/people', label: 'People' },
    { href: '/admin/routines', label: 'Routines' },
    { href: '/admin/events', label: 'Calendar' },
    { href: '/admin/chores', label: 'Jobs' },
    { href: '/admin/homework', label: 'Homework' },
    { href: '/admin/points', label: 'Points' },
    { href: '/admin/school', label: 'School days' },
  ];

  return (
    <div className="min-h-dvh bg-ground">
      <header className="border-b-2 border-line px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="tap text-kiosk-sm font-bold">
            ← Home
          </Link>
          <form action={lockPin}>
            <button type="submit" className="rounded-full border-2 border-line px-5 py-2 text-[0.95rem] font-semibold">
              Lock
            </button>
          </form>
        </div>
        <h1 className="mt-3 text-[1.9rem] font-extrabold leading-tight">{title}</h1>
        <nav className="mt-3 flex flex-wrap gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="tap rounded-full bg-ground-sunken px-5 py-2 text-[0.95rem] font-semibold"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="px-5 py-6">{children}</main>
    </div>
  );
}
