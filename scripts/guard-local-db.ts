import { createConnection } from 'node:net';

/**
 * PGlite stores the local database as files that only ONE process may open.
 * Running a migration or seed while `npm run dev` is up corrupts the directory
 * - it fails with an unreadable WASM "Aborted()" and the database has to be
 * rebuilt. Cheaper to refuse up front and say so plainly.
 *
 * Neon has no such constraint, so this only applies to the local database.
 */
export async function assertLocalDbNotInUse(usingPglite: boolean): Promise<void> {
  if (!usingPglite) return;
  const devServerUp = await isPortOpen(3000);
  if (!devServerUp) return;

  console.error(
    '\nThe dev server is running on port 3000 and is holding the local database.\n' +
      'PGlite allows only one process at a time, and running this anyway would\n' +
      'corrupt it. Stop the dev server, run this again, then restart it.\n',
  );
  process.exit(1);
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(300);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}
