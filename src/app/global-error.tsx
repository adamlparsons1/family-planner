'use client';

/**
 * Last resort: an error in the root layout itself, where the normal error
 * boundary cannot render because the layout never mounted. Must supply its own
 * <html> and <body>, and cannot rely on the app's fonts or theme tokens.
 *
 * A misconfigured SESSION_SECRET or DATABASE_URL lands here, so it names those
 * two directly — a blank 500 with no clue is exactly what wasted an evening.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          background: '#faf6f0',
          color: '#2b2620',
          fontFamily: 'ui-rounded, system-ui, sans-serif',
        }}
      >
        <p style={{ fontSize: '4rem', lineHeight: 1, margin: 0 }}>🛠️</p>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>The dashboard could not start</h1>
        <p style={{ maxWidth: '34rem', color: '#6b6055', lineHeight: 1.5 }}>
          This usually means a setting is missing on the server. Check that{' '}
          <code>SESSION_SECRET</code> (32 characters or more) and <code>DATABASE_URL</code>{' '}
          are both set, and that the site has been redeployed since they were added —
          environment variables only apply to new deployments.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 48,
            padding: '0.9rem 2rem',
            borderRadius: 999,
            border: 'none',
            background: '#2b2620',
            color: '#faf6f0',
            fontSize: '1.1rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        {error.digest ? (
          <p style={{ fontSize: '0.8rem', color: '#6b6055' }}>
            Reference: <code>{error.digest}</code>
          </p>
        ) : null}
      </body>
    </html>
  );
}
