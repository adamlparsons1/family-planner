import { redirect } from 'next/navigation';
import { PasscodeForm } from '@/components/PasscodeForm';
import { getDb } from '@/db';
import { isHouseholdUnlocked } from '@/lib/session';
import { getSetupState } from '@/lib/setup';

export default async function LockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // A brand-new planner has no passcode to type yet. Only on positive evidence
  // of an empty database; any other database trouble shows the lock as before.
  if ((await getSetupState(getDb)) === 'needs-setup') redirect('/setup');
  if (await isHouseholdUnlocked()) redirect('/');
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8">
      <div className="paper taped w-full max-w-md px-8 pb-8 pt-10">
        <div className="text-center">
          <p className="text-[3.4rem] leading-none">🏡</p>
          <h1 className="serif mt-2 text-[2rem] font-bold">Family Dashboard</h1>
        </div>
        <div className="mt-6">
          <PasscodeForm next={next} />
        </div>
      </div>
    </main>
  );
}
