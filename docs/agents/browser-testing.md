# Browser testing

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
