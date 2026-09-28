# Family Dashboard — working notes

A private planner for one household: calendar, morning routines, meals, school lunches, chores,
rewards and homework. Runs all day on a wall-mounted iPad and on parents' phones. Each family
deploys its own copy and creates its household in the browser at `/setup`.

## Rules that are easy to break by accident

- **Never `new Date()` inline.** Use `getCurrentAppDate()` (`src/lib/date.ts`). The day rolls over at **03:00**, not midnight.
- **Day-shaped values are `'YYYY-MM-DD'` strings**, never `Date`. Render in `Europe/London`; store timestamps in UTC.
- **`days_of_week` is 0 = Sunday** everywhere.
- **Points balances are `SUM(points_ledger.delta)`.** Never add a balance column.
- **Weekends are derived**, never stored in `non_school_days`.
- **Text over a child's colour uses `readableTextOn()`.** Do not hardcode white.
- **Every task needs an icon.** Young children cannot read yet; colour and picture carry everything.
- **`requireHousehold()` / `requireParentPin()` are the gates.** `src/proxy.ts` is only a redirect.
- **Every mutation is a validated server action or route handler.** No client-to-database writes.
- **`/setup` must never change a planner that is already set up.** `tests/setup-locked.test.ts` guards this; keep it passing.
- **No real family's details in the code.** The only household in the repo is the made-up one in `src/lib/family.ts`.
- No analytics, telemetry, or third-party scripts. Ask before adding any dependency.

## Working style

- `npm test` and `npm run build` must both pass before a change is called done.
- Deploying, and checking it on the iPad, is the family's job; say so rather than claiming it.
