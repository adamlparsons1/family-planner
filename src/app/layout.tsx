import type { Metadata, Viewport } from 'next';
import { Fraunces, Nunito } from 'next/font/google';
import './globals.css';
import { NightTheme } from '@/components/NightTheme';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ServiceWorker } from '@/components/ServiceWorker';
import { getNightThemeHour } from '@/lib/settings';

/**
 * Nunito: friendly, round, and highly legible at distance and at small sizes.
 * Self-hosted at build time by next/font, so nothing is fetched from Google at
 * runtime and no third-party script is involved.
 */
const appFont = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-app',
  display: 'swap',
});

/**
 * Fraunces carries the names, dates and numerals. A serif is what makes the
 * board read as printed rather than as software, and its numerals have enough
 * character to be the biggest thing on a child's card.
 */
const displayFont = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Family Dashboard',
  applicationName: 'Family',
  // Private household app: never index, never follow, never cache a snippet.
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Family' },
};

export const viewport: Viewport = {
  themeColor: '#e5d8c2',
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom on a wall-mounted kiosk is a bug, not a feature.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nightFromHour = await getNightThemeHour();

  return (
    <html lang="en-GB" className={`${appFont.variable} ${displayFont.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <NightTheme fromHour={nightFromHour} />
        <OfflineBanner />
        <ServiceWorker />
      </body>
    </html>
  );
}
