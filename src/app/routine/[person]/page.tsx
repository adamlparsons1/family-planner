import { notFound } from 'next/navigation';
import { RoutineBoard } from '@/components/RoutineBoard';
import { requireHousehold } from '@/lib/guards';
import { getChildRoutine, getPersonBySlug } from '@/lib/queries/routine';
import { getCurrentAppDate } from '@/lib/date';
import { getSettings } from '@/lib/settings';

export default async function RoutinePage({
  params,
}: {
  params: Promise<{ person: string }>;
}) {
  const { person: slug } = await params;
  await requireHousehold(`/routine/${slug}`);

  const person = await getPersonBySlug(decodeURIComponent(slug));
  if (!person) notFound();

  const settings = await getSettings();
  const today = getCurrentAppDate(new Date(), settings.dayRolloverHour);
  const routine = await getChildRoutine(person, today);

  if (routine.total === 0) {
    return (
      <main
        className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center"
        style={{ backgroundColor: person.colour }}
      >
        <p className="text-[5rem] leading-none" aria-hidden>{person.icon}</p>
        <h1 className="text-kiosk-xl font-extrabold">Nothing to do today</h1>
        <p className="text-kiosk-base">No jobs for {person.displayName} today. Enjoy it.</p>
        <a href="/" className="tap rounded-full bg-white px-8 py-4 text-kiosk-base font-bold text-ink">
          Back home
        </a>
      </main>
    );
  }

  return (
    <RoutineBoard
      stages={routine.stages}
      colour={person.colour}
      displayName={person.displayName}
      icon={person.icon}
    />
  );
}
