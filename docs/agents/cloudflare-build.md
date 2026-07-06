# Cloudflare Build Notes

Use this when changing the Portal app build, Wrangler config, Worker bindings, or generated Cloudflare types.

## Production build rule

The production build must regenerate Wrangler runtime types before TypeScript checks:

```sh
wrangler types worker-configuration.d.ts --include-env false
```

Do not rely on `wrangler types --check` as the production build gate. A stale committed `worker-configuration.d.ts` can make Cloudflare fail before the app typecheck runs.

Do not let Wrangler generate the `Env` interface. Cloudflare production does not have local `.dev.vars`, so generated Env types can differ between local and production builds. Keep app bindings in `apps/portal/worker/env.d.ts`.

## When changing bindings

If you change any of these files, regenerate and verify Cloudflare types:

- `apps/portal/wrangler.jsonc`
- `apps/portal/worker/index.ts`
- `apps/portal/worker/env.d.ts`
- Worker env bindings such as D1, KV, R2, secrets, or vars

Run from `apps/portal`:

```sh
pnpm run cf-typegen
pnpm run build
```

Commit any intentional `worker-configuration.d.ts` changes.

## D1 migrations

Agents should own D1 table creation and migration application when a change needs
new database structure. Do not stop after writing SQL.

When adding or changing D1 migrations:

- Put migration files under `apps/portal/db/migrations/`.
- Ensure the D1 binding in `apps/portal/wrangler.jsonc` declares
  `"migrations_dir": "db/migrations"`.
- Apply migrations to local D1 from `apps/portal`:

```sh
pnpm exec wrangler d1 migrations apply jikanwari-d1 --local
```

- Verify the expected tables or indexes exist with `wrangler d1 execute`.
- Add `.wrangler` to gitignore if local D1 state appears in `git status`.
- Run tests, lint, and build after applying migrations.

If production or remote D1 must be updated, request approval and then run:

```sh
pnpm exec wrangler d1 migrations apply jikanwari-d1 --remote
```

In the final response, state exactly which database locations were updated:
local only, remote only, or both. If remote migration was not applied, say so
explicitly and include the command needed to apply it.

For the staging environment, use the separate staging database:

```text
https://jikanwari-staging.8-apricity.workers.dev/
```

```sh
pnpm exec wrangler d1 migrations apply jikanwari-staging-d1 --env staging --remote
pnpm exec wrangler d1 execute jikanwari-staging-d1 --env staging --remote --file db/seeds/test-students.sql
```

Verify the staging seed with the real table id columns:

```sh
pnpm exec wrangler d1 execute jikanwari-staging-d1 --env staging --remote --command "SELECT COUNT(*) AS cnt FROM student_accounts WHERE student_account_id LIKE 'test-student-%';"
pnpm exec wrangler d1 execute jikanwari-staging-d1 --env staging --remote --command "SELECT COUNT(*) AS cnt FROM student_affiliations WHERE student_affiliation_id LIKE 'test-affiliation-%';"
```

Never apply the test-students seed file to the production database.

## Debugging production failures

If Cloudflare reports:

```text
Types at worker-configuration.d.ts are out of date. Run `wrangler types` to regenerate.
```

Check:

- Cloudflare is building the same commit as `origin/main`.
- `apps/portal/worker-configuration.d.ts` was regenerated after the latest `wrangler.jsonc` or binding change.
- `apps/portal/package.json` build script still runs `wrangler types worker-configuration.d.ts --include-env false` before `tsc`.
- Secret bindings such as `RESEND_API_KEY` are declared in `apps/portal/worker/env.d.ts`, not inferred from `.dev.vars`.

Local Windows sandbox may fail with `spawn EPERM` when running npm scripts. Treat that as sandbox/tooling failure, not project build failure; retry with the approved build command outside the sandbox if needed.
