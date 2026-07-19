# Browser testing

## Local automated browser smoke tests

Run from repository root:

```powershell
pnpm test:browser
pnpm test:browser:chromium
pnpm test:browser:webkit
```

`test:browser` is the required matrix: Playwright Chromium with a desktop
configuration plus Playwright WebKit with the `iPhone 13` device descriptor
(390 x 664 viewport, 390 x 844 screen, mobile and touch enabled). The engine
commands run one required project for focused diagnosis. WebKit results show
WebKit compatibility; they are not Safari certification. Real Safari remains
a separate manual verification surface.

For an explicit check against an installed branded Google Chrome binary, run:

```powershell
pnpm test:browser:chrome
```

The `chrome` project uses Playwright's `chrome` channel. It is optional, is not
part of `test:browser`, and does not make branded Google Chrome a required local
dependency. Playwright Chromium, branded Google Chrome, Playwright WebKit, real
Safari, and Codex In-app Browser are distinct verification surfaces; report
the one actually used.

Playwright owns server startup for this command. Its configured server command
is also available directly when only local preparation and serving are needed:

```powershell
pnpm browser:test:serve
```

That one command deletes and recreates only
`apps/portal/.wrangler/browser-test`, applies every local D1 migration there,
inserts the fixed test Students from `db/seeds/test-students.sql`, builds current
Portal code, and serves it on `http://127.0.0.1:8790`. Ordinary local
development state under Wrangler's default persistence location is not read or
changed. Stop the standalone server with Ctrl+C; rerunning it safely recreates
the dedicated browser-test database.

Fixed test Students are disposable QA identities whose Student Account IDs
start with `test-student-`. They are not real Students and the dedicated local
database must not contain real school or personal data. Never apply the fixed
test Student seed to production.

Before a selected project starts, Playwright generates an ephemeral test-login
secret in Node. Global setup creates separate Node-side `APIRequestContext`s
for every selected project, calls the existing `POST /api/test/login` endpoint,
and writes resulting cookies to disposable state files. Each project receives
its default session for `test-student-2026-2-3-humanities-1`:

- Chromium: `test-results/playwright/auth/chromium.json`
- WebKit/iPhone: `test-results/playwright/auth/webkit-iphone.json`
- optional branded Chrome: `test-results/playwright/auth/chrome.json`

Draft-lifecycle tests also receive isolated secondary-account, switch-back, and
post-logout sessions under the same directory. Their filenames add
`-secondary`, `-relogin`, or `-post-logout` before `.json`; these sessions keep
account-switch and logout checks from invalidating another test's default
session.

Each project's `BrowserContext` starts from only its corresponding state; WebKit
never uses Chromium state. No UI login step runs. The secret is not written to
a state file or supplied to a page, URL, DOM, application-managed storage,
screenshot, trace, or committed file.

Auth state and browser-test D1 state are disposable and ignored by Git. Passing
runs retain no screenshots or traces. Failures retain an automatic screenshot
and trace below the selected project's directory in `test-results/playwright`;
the HTML report is written to `playwright-report`. Delete these local artifacts
when no longer needed because auth state and failure diagnostics can contain a
test Student session.

Required coverage contains four journeys: Chromium desktop verifies the
unauthenticated School Email entry and authenticated Daily Plan; WebKit/iPhone
verifies the authenticated Daily Plan plus primary/task editor open/close and
mobile field/date-control geometry. Assertions use accessible roles, labels,
and visible Japanese UI behavior. No visual snapshot baseline is used.

If required browser binaries are not installed locally, run:

```powershell
pnpm exec playwright install chromium webkit
```

## Interactive Browser secret-header decision

**Decision: use the one-time login-ticket fallback.** Direct use of the
long-lived `TEST_LOGIN_SECRET` is prohibited in every interactive Browser
surface. This remains the gate for later agent Browser work until a new probe
documents a supported, non-exposing header API for each required surface.

The probe for issue #45 used only the fixed dummy sentinel
`TSUGI_DUMMY_HEADER_SENTINEL_45_20260717`. No local, staging, or production
secret was read or supplied.

### Recorded environment

Probe date: 2026-07-17 (Asia/Tokyo).

| Surface | Recorded information | Availability |
| --- | --- | --- |
| Codex In-app Browser | Browser client type `iab`; Browser plugin build `26.715.21425`; reported user agent `Chrome/150.0.0.0` on Windows | Available and probed |
| Chrome interactive Browser | No Chrome skill or `extension` Browser binding was present; Browser inventory contained only the in-app Browser | Unavailable; not approved |

The in-app Browser did not expose an exact Codex app version or Chromium build
revision. That missing version information is another reason not to generalise
the result beyond the recorded surface.

### Probe design

[`scripts/browser-header-isolation-probe.mjs`](../../scripts/browser-header-isolation-probe.mjs)
starts a loopback-only controlled receiver. It has a fixed dummy sentinel and
accepts no secret input. The page-context comparison route sends the sentinel
as `x-test-login-secret`, while `/evidence` reports only whether the header
matched; it never echoes the value.

The documented in-app Browser API offered navigation, DOM inspection,
screenshots, console-log reads, and the `visibility`, `viewport`, and
`pageAssets` capabilities. It offered no request interception, extra-header,
secret injection, or trace API. Therefore no documented path could make the
sentinel originate outside page JavaScript and arrive as a header.

The comparison page proved that page JavaScript can send the intended header,
but also proved why that path is rejected:

| Condition | Evidence | Result |
| --- | --- | --- |
| Controlled receiver gets `x-test-login-secret` | `/evidence` returned `"headerMatched":true` | Pass |
| Sentinel originates outside page context | Only the inline page script could attach it; no Browser header API existed | **Fail** |
| Page JavaScript cannot read sentinel | Page reported `"pageJavaScriptCanReadSentinel":true` | **Fail** |
| DOM does not contain sentinel | Page reported `"domSourceContainsSentinel":true` because the inline script is DOM source | **Fail** |
| URL does not contain sentinel | Browser URL stayed `http://127.0.0.1:41783/`; page reported `false` | Pass |
| Browser storage does not contain sentinel | Page-visible cookies and all local/session storage keys and values reported `false`; only Cache Storage and IndexedDB container names were checked, not every stored body or record | **Fail: ambiguous** |
| Console does not contain sentinel | Full captured console log set was empty | Pass |
| Screenshot does not contain sentinel | Full-page screenshot showed booleans and receiver metadata, not the sentinel value | Pass |
| Trace does not contain sentinel | The surface exposed no trace API, so this could not be established | **Fail: ambiguous** |
| Tool input/output does not contain sentinel | The page-context path required the sentinel in probe source/tool traffic | **Fail** |

One failed, unavailable, undocumented, or ambiguous condition rejects a
surface. The in-app Browser is therefore **not approved** for direct secret
use. Chrome was unavailable and is independently **not approved**; the in-app
result must not be used as Chrome evidence.

### Reproduction

1. Confirm the probe source still contains only the fixed dummy sentinel. Never
   replace it with `TEST_LOGIN_SECRET` or another credential.
2. From the repository root, run:

   ```powershell
   node scripts/browser-header-isolation-probe.mjs
   ```

3. In the Browser surface being tested, navigate to
   `http://127.0.0.1:41783/` using that surface's documented API. Do not reuse a
   result from another surface.
4. Confirm the rendered result includes `headerMatched: true`,
   `pageJavaScriptCanReadSentinel: true`, and
   `domSourceContainsSentinel: true`. Storage output is deliberately named
   `storageSignals`; it is not a complete non-exposure claim.
5. Read receiver evidence without exposing the value:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:41783/evidence |
     ConvertTo-Json -Compress
   ```

   Recorded output:

   ```json
   {"headerName":"x-test-login-secret","headerMatched":true,"requestCount":1,"userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"}
   ```

6. Record the surface inventory and version data, current URL, complete console
   log set, full-page screenshot, available trace capability, storage booleans,
   and whether the sentinel appeared in tool input/output.
7. Stop the receiver with Ctrl+C.

Future approval requires all conditions to pass using a documented API and a
fresh dummy-only probe on every required interactive Browser surface. Until
then, issue the long-lived secret outside Browser automation and give the
Browser only the short-lived, fixed-Student, one-time login ticket defined by
the secure browser QA specification.

## Interactive test Student login

This workflow implements the fallback selected by issue #45 above. Never put
`TEST_LOGIN_SECRET` in Browser JavaScript, a URL, DOM, storage, console, trace,
screenshot, or Browser tool input/output.

### Choose the target and Student

- Prefer local for ordinary UI work. Use staging only when deployed Worker,
  binding, or staging data behavior matters. Production has no QA login path.
- Choose exactly one `test-student-*` Student Account ID from
  [`test-students.sql`](../../apps/portal/db/seeds/test-students.sql). Arbitrary
  or non-seeded Student Account IDs return the same not-found response.
- Cloudflare Access remains a separate outer staging boundary. The ticket
  issuer and exchange neither create nor bypass an Access session. If Access
  rejects the Node-side issuer request, run it from an already Access-authorized
  environment; never move the long-lived secret into Browser to work around it.

For local work, apply migrations, seed the dedicated local D1 database, build,
and start the Worker from `apps/portal`:

```powershell
pnpm exec wrangler d1 migrations apply jikanwari-d1 --local
pnpm exec wrangler d1 execute jikanwari-d1 --local --file db/seeds/test-students.sql
pnpm run build
pnpm exec wrangler dev
```

Keep `TEST_LOGIN_ENABLED=true` and `TEST_LOGIN_SECRET=<local secret>` in the
ignored `apps/portal/.dev.vars`. Never enable either in production.

### Issue outside Browser, exchange inside Browser

From the repository root, give the long-lived secret only to the Node process:

```powershell
$env:TEST_LOGIN_SECRET = '<local-or-staging-secret>'
pnpm issue:interactive-test-login-ticket -- `
  http://127.0.0.1:8787 `
  test-student-2026-2-3-humanities-1
Remove-Item Env:TEST_LOGIN_SECRET
```

The issuer accepts HTTPS targets plus loopback HTTP, authenticates through the
existing secret header, and prints one exchange URL. The ticket expires after
two minutes, is restricted to the selected fixed Student, is stored only as a
hash, and can create one normal Student Session.

Open the exchange URL in the selected interactive Browser. A successful
exchange atomically consumes the ticket, sets the normal `tsugi_session`
HttpOnly cookie, and redirects to `/` with `Cache-Control: no-store` and
`Referrer-Policy: no-referrer`. It does not run School Email verification.

Browser sessions are independent. Issue a new ticket for every fresh in-app
Browser or Chrome session; never reuse a ticket or assume a cookie crosses
Browser surfaces. Invalid, expired, used, disabled-environment, and production
requests all return the same not-found response.

### Viewport, artifacts, and verification

- Keep the Browser's default viewport unless the requested check names a
  device or breakpoint. For mobile/PWA checks, record the exact override; use
  `390 x 844` when no product-specific mobile size is supplied.
- Treat the exchange URL as a disposable credential. Do not post or retain it.
  Capture screenshots, console output, or traces only after the redirect has
  removed the ticket from the current URL. Delete failure artifacts that retain
  a ticket URL.
- Confirm the redirected Portal reaches the authenticated Daily Plan and does
  not show School Email verification. The Student Session must continue to work
  through `/api/auth/session` like any normal session.

Every final Browser report must state:

1. target environment and URL;
2. actual Browser surface/version;
3. viewport or device override;
4. selected fixed test Student Account ID;
5. whether ticket issuance, exchange, redirect, and authenticated Daily Plan
   succeeded;
6. artifacts retained or deleted; and
7. for staging, that Cloudflare Access was independently satisfied and not
   bypassed.

### Recorded local verification for issue #47

On 2026-07-17, a fresh Codex In-app Browser session (`iab`, reported
`Chrome/150.0.0.0` on Windows) used its default viewport with no override
against `http://127.0.0.1:8787/`. The Node issuer selected
`test-student-2026-2-3-humanities-1` and received `201`; Browser navigation to
the disposable exchange URL received `303`, ended at `/`, and rendered the
authenticated Daily Plan without School Email verification. The Daily Plan
showed the seeded Saturday lesson and produced no captured console errors.

No screenshot, trace, ticket URL, or other Browser artifact was retained.
Cloudflare Access was not applicable to this local target. An initial run also
proved that SPA asset fallback intercepted API navigation until
`assets.run_worker_first` included `/api/*`; the successful run used that
committed routing configuration.
