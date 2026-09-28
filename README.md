# Family Dashboard

A private planner for one household: calendar, morning routines, meals, school lunches, chores,
rewards and homework. Runs all day on a wall-mounted iPad and on parents' phones.

Each family runs its own copy, with its own database. Nobody else can see your planner, and you
set up your family in the browser: no terminal needed.

---

## Deploying your own

You need free accounts on [GitHub](https://github.com), [Vercel](https://vercel.com) and
[Neon](https://neon.tech) (Neon can be added from inside Vercel).

1. **Import this repository into Vercel.** It detects Next.js on its own.
2. **Add a database.** In the Vercel project, open **Storage**, add a **Neon** Postgres database
   and connect it to the project. The app finds the connection string itself.
3. **Choose a setup word.** Add an environment variable called `SETUP_CODE`: any word or phrase
   of at least 8 characters. It stops anyone else setting up your planner before you do.
4. **Deploy**, then open your planner's address. It goes straight to **Set up your planner**:
   enter the setup word, your family, a passcode and a 4-digit grown-ups' PIN.

That's all. `/setup` creates the database tables, and it can only ever run once: after that it
just says the planner is already set up.

`SESSION_SECRET` is optional. If you don't set one, `/setup` creates one and keeps it in the
database. If something looks wrong, open `/api/health` on your planner: it reports what is set
up without revealing anything private.

### Changing the passcode or PIN later

From a computer with this repository:

```bash
DATABASE_URL="<your Neon connection string>" npm run db:credentials -- --passcode "new passcode" --pin 4821
```

Take a backup any time from **Grown-ups → Download a backup**.

### What "private" means here

The planner is on the public internet, protected by a passcode rather than by network isolation.
That is a reasonable trade for a chore chart and a dinner menu, and it is why the sign-in is built
properly: hashed secrets, signed `httpOnly` cookies, database-backed rate limiting, `noindex` on
every page, and first names only.

---

## Running it locally (for developers)

```bash
npm install
npm run dev
```

Create `.env.local` with `DATABASE_URL=pglite` (an embedded Postgres in `./.pglite`, no server to
install) and `SETUP_CODE=<anything 8+ characters>`, then open `/setup`. Or run
`npm run db:migrate && npm run db:seed` to load a made-up example family instead.
`npm run db:seed` also needs `SEED_HOUSEHOLD_PASSCODE` and `SEED_PARENT_PIN`, and signing in
afterwards needs `SESSION_SECRET` (32+ characters), because only `/setup` generates one.

**Stop the dev server before running any `db:` command.** The local database is a single set of
files that only one process may open.

| Command | What it does |
|---|---|
| `npm run dev` | development server on :3000 |
| `npm run build` | production build |
| `npm test` | full test suite |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:generate` | generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` | load the example family (idempotent) |
| `npm run db:reset` | wipe the local database and start again |

Never edit a generated migration or a database console by hand.

---

## iPad kiosk setup

1. Open the deployed URL in **Safari** and enter the household passcode. The session lasts 90 days and survives a restart.
2. **Share → Add to Home Screen.** Launch it from that icon, not from Safari — you get full screen, no browser chrome, and much better storage durability.
3. **Settings → Display & Brightness → Auto-Lock → Never.** Keep the iPad on charge.
4. **Settings → Accessibility → Guided Access → On.** Then triple-click the side button inside the app to lock the iPad to it.

Pinch-zoom is disabled deliberately — on a wall display it is a bug, not a feature.

---

## What the app does

| Screen | Route | For |
|---|---|---|
| Kiosk home | `/` | The day, today's events, each child's progress, dinner, tomorrow |
| Morning routine | `/routine/<name>` | One child, one stage at a time, tap to tick off |
| Week | `/week` | Mon-Sun: events, lunches, dinners. Read-only. |
| Jobs and rewards | `/chores` | Pick a child, do jobs, spend stars |
| Grown-ups | `/admin` | Everything editable, behind the PIN, phone-first |

Admin covers the week planner (dinners and lunches for the week on one page), routines, calendar, jobs and rewards, points, and school days.

## How it is put together

- **Next.js 16 (App Router) + TypeScript**, Server Components by default.
- **Tailwind v4** with a custom theme in `src/app/globals.css`. No component library.
- **Drizzle + Postgres.** Neon in production, PGlite locally.
- **Zod** validates every input at the server boundary. Every mutation is a server action or route handler; nothing writes to the database from the client.

### Things that will bite you if you forget them

- **Never call `new Date()` inline.** Use `getCurrentAppDate()` from `src/lib/date.ts`. The app's day rolls over at **03:00**, not midnight, so someone checking the plan at 00:30 still sees the day that just ended.
- **Day-shaped values are `'YYYY-MM-DD'` strings**, never `Date` objects. Everything renders in `Europe/London`; timestamps are stored in UTC.
- **`days_of_week` is 0 = Sunday.**
- **Never hardcode text colour over a child's colour.** Use `readableTextOn()`. Colours come from the database, so a hardcoded white silently breaks the next time a palette changes.
- **Points balances are summed from `points_ledger`.** There is no balance column and there must never be one.
- **Weekends are derived, not stored** in `non_school_days`.
- **`requireHousehold()` / `requireParentPin()` are the real gates.** `src/proxy.ts` is only a redirect for a nicer experience.

## Layout

```
src/
  app/          routes: / (kiosk), /lock, /pin, /admin, /api/export
  components/   client components (interaction only)
  db/           schema.ts, index.ts (driver selection)
  lib/          date, school, contrast, session, guards, rate-limit, family
  proxy.ts      redirect layer (Next 16's renamed middleware)
drizzle/        generated migrations, checked in
scripts/        migrate, seed, icon generation
tests/          integration tests against a throwaway Postgres
```
