import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['./tests/setup-env.ts'],
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      // `server-only` throws outside a React Server Component graph. These
      // modules are genuinely server-only; the marker just gets in the way here.
      'server-only': new URL('./tests/server-only-stub.ts', import.meta.url).pathname,
    },
  },
});
