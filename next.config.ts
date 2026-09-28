import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * PGlite ships a WASM build and resolves its own asset paths at runtime.
   * Bundling it breaks that resolution, so it is loaded as a plain Node module.
   * Local development only - production talks to Neon over HTTP.
   */
  serverExternalPackages: ['@electric-sql/pglite'],

  /** /setup creates the tables on a brand-new planner, so it needs the migration files (D61). */
  outputFileTracingIncludes: {
    '/setup': ['./drizzle/**/*'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Private household app. Belt and braces alongside proxy.ts.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
