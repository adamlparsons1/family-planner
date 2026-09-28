'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps the wall display current without anyone touching it.
 *
 * Polling, not websockets or SSE (spec open question 1): five users and a
 * handful of writes a day do not justify a persistent connection, and a poll
 * recovers from a dropped network on its own with no reconnect logic.
 *
 * Two triggers:
 *  - every `intervalMs` while the tab is visible
 *  - immediately when the tab becomes visible again, so a phone coming out of
 *    a pocket is current at once rather than up to 20 seconds stale
 *
 * Polling pauses while hidden. A backgrounded iPad has no reason to fetch.
 */
export function KioskRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    window.addEventListener('online', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      window.removeEventListener('online', onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
