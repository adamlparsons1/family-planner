export function Notice({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (!error && !ok) return null;
  return (
    <p
      role={error ? 'alert' : 'status'}
      className="mb-4 rounded-xl px-4 py-3 text-[1rem] font-semibold"
      style={
        error
          ? { background: 'var(--color-ground-sunken)', color: 'var(--color-warn)' }
          : { background: 'var(--color-ground-sunken)', color: 'var(--color-affirm)' }
      }
    >
      {error ?? ok}
    </p>
  );
}
