'use client';

import { useEffect } from 'react';

/**
 * Friendly failure: never show a stack trace, never
 * leave a blank screen. Say what happened in plain English and offer the one
 * useful action.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vercel's runtime logs are where the real detail lives.
    console.error('Page error:', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
      <p className="text-[4rem] leading-none" aria-hidden>🙈</p>
      <h1 className="text-kiosk-lg font-extrabold">Something went wrong</h1>
      <p className="max-w-md text-kiosk-sm text-ink-soft">
        The dashboard could not load this page. Trying again usually fixes it.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="tap rounded-full bg-ink px-8 py-4 text-kiosk-base font-bold text-ground"
        >
          Try again
        </button>
        <a
          href="/"
          className="tap rounded-full border-2 border-line px-8 py-4 text-kiosk-base font-semibold"
        >
          Back home
        </a>
      </div>
      {error.digest ? (
        <p className="text-[0.8rem] text-ink-soft">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </main>
  );
}
