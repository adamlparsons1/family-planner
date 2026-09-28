'use client';

import { useEffect } from 'react';
import { isNightHour } from '@/lib/date';

/**
 * Dims the display after a set hour so the iPad is not blazing at 9pm.
 *
 * Deliberately client-side and clock-driven rather than rendered on the server:
 * the kiosk sits on one page for hours, and a server-rendered decision would be
 * stuck at whatever the hour was when the page loaded.
 */
export function NightTheme({ fromHour, untilHour = 6 }: { fromHour: number; untilHour?: number }) {
  useEffect(() => {
    const apply = () => {
      const hour = new Date().getHours();
      document.documentElement.dataset.theme =
        isNightHour(hour, fromHour, untilHour) ? 'night' : 'day';
    };

    apply();
    // Checking every minute is ample and costs nothing.
    const timer = setInterval(apply, 60_000);
    return () => {
      clearInterval(timer);
      delete document.documentElement.dataset.theme;
    };
  }, [fromHour, untilHour]);

  return null;
}
