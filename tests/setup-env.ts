// Integration tests run against a throwaway in-memory Postgres.
process.env.DATABASE_URL = 'memory://';
process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters-long';
