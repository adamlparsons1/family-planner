'use client';

import { useEffect, useState } from 'react';

/**
 * A quiet, friendly notice when the network drops.
 *
 * The service worker keeps the last-known state on screen, so the useful
 * behaviour is to say "this might be out of date" rather than to blank the
 * page. Writes will fail while offline and each screen says so on the attempt.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  // pointer-events-none: this sits over the bottom of every screen, and it
  // used to swallow taps on whatever was under it.
  return (
    <p
      role="status"
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-50 bg-ink/90 px-4 py-2 text-center text-[0.95rem] font-bold text-ground"
    >
      No internet just now — showing the last thing we knew. Ticking things off won&rsquo;t save yet.
    </p>
  );
}
