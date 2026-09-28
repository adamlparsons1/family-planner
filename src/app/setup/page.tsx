import Link from 'next/link';
import { getDb } from '@/db';
import { SetupForm } from '@/components/SetupForm';
import { getSetupState } from '@/lib/setup';

export const dynamic = 'force-dynamic';

/**
 * First-run setup. Reachable without a session, because a new planner
 * has no passcode yet. On a planner that is already set up it only says so.
 */
export default async function SetupPage() {
  const state = await getSetupState(getDb);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-start p-4 sm:p-8">
      <div className="paper taped w-full max-w-xl px-5 pb-8 pt-10 sm:px-8">
        <div className="text-center">
          <p className="text-[3.4rem] leading-none">🏡</p>
          <h1 className="serif mt-2 text-[2rem] font-bold">
            {state === 'needs-setup' ? 'Set up your planner' : 'Family Dashboard'}
          </h1>
        </div>

        {state === 'ready' ? (
          <div className="mt-6 space-y-5 text-center">
            <p className="text-kiosk-base">This planner is already set up.</p>
            <Link
              href="/lock"
              className="inline-block rounded-full border-2 border-ink bg-ink px-6 py-3 font-extrabold text-ground-raised"
            >
              Go to the planner
            </Link>
          </div>
        ) : state === 'unknown' ? (
          <p role="alert" className="mt-6 rounded-xl bg-ground-sunken px-4 py-3 font-semibold text-warn">
            The planner can&apos;t reach its database just now. Wait a minute, then reload this page.
          </p>
        ) : !process.env.SETUP_CODE ? (
          <p role="alert" className="mt-6 rounded-xl bg-ground-sunken px-4 py-3 font-semibold text-warn">
            This planner has no setup word yet. In Vercel, add one called SETUP_CODE, redeploy,
            then come back to this page.
          </p>
        ) : (
          <SetupForm />
        )}
      </div>
    </main>
  );
}
