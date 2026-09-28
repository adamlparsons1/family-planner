import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Family Dashboard',
    short_name: 'Family',
    description: 'The family calendar, routines, meals and chores.',
    start_url: '/',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#faf6f0',
    theme_color: '#faf6f0',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
