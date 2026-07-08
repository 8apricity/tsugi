# Authentication uses school email verification codes

Tsugi authenticates students by sending short verification codes to eligible school email addresses. It does not use magic links, passwords, domain-only eligibility, or third-party account providers for the initial authentication model.

A student enters the school email number, Tsugi constructs the full school email, sends a verification code, and stores only a hash of that code. Older unused codes for the same school email are invalidated when a new code is issued, and repeated requests are rate-limited. A student account is created only after the student proves access to the school email and completes required account details such as display name and student affiliation.

This keeps the sign-up flow compatible with school-issued email addresses that students may need to type manually, avoids exposing school email parts as identity, and matches the current implementation direction.
