# Tsugi Portal

## Test Login For Local/Staging QA

Test login is an API-only QA helper for local and staging multi-account checks. It must stay disabled in production.

Enable it only in local/staging:

```sh
TEST_LOGIN_ENABLED=true
TEST_LOGIN_SECRET=<secret>
```

Staging URL:

```text
https://tsugi-staging.8-apricity.workers.dev/
```

Seed local D1:

```sh
pnpm exec wrangler d1 execute jikanwari-d1 --local --file db/seeds/test-students.sql
```

Seed staging D1 after configuring a staging D1 binding:

```sh
pnpm exec wrangler d1 execute jikanwari-staging-d1 --env staging --remote --file db/seeds/test-students.sql
```

Apply migrations to staging D1:

```sh
pnpm exec wrangler d1 migrations apply jikanwari-staging-d1 --env staging --remote
```

Verify staging seeded account counts:

```sh
pnpm exec wrangler d1 execute jikanwari-staging-d1 --env staging --remote --command "SELECT COUNT(*) AS cnt FROM student_accounts WHERE student_account_id LIKE 'test-student-%';"
pnpm exec wrangler d1 execute jikanwari-staging-d1 --env staging --remote --command "SELECT COUNT(*) AS cnt FROM student_affiliations WHERE student_affiliation_id LIKE 'test-affiliation-%';"
```

Create a session:

```sh
curl -i -X POST http://localhost:5173/api/test/login \
  -H "content-type: application/json" \
  -H "x-test-login-secret: <secret>" \
  --data "{\"studentAccountId\":\"test-student-2026-2-3-humanities-1\"}"
```

Available seeded accounts:

- `test-student-2026-2-3-humanities-1`
- `test-student-2026-2-3-humanities-2`
- `test-student-2026-2-3-humanities-3`
- `test-student-2026-2-3-science-1`
- `test-student-2026-2-3-science-2`
- `test-student-2026-2-3-science-3`
- `test-student-2026-2-4-humanities-1`
- `test-student-2026-2-4-humanities-2`
- `test-student-2025-2-3-humanities-1`

The endpoint returns `404` when disabled, when the secret is missing/wrong, when the account does not exist, or when the id is not one of the fixed seeded ids above. The seed script upserts only fixed `test-student-*` rows and does not delete or alter non-test data.
