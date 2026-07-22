# Initial release does not collect Real Names

The initial Tsugi release does not ask for, validate, or store a student's Real
Name. Initial Student Account setup requires a Display Name and Student
Affiliation after School Email verification. A legacy client may still send a
`realName` property, but the Worker ignores it.

The existing nullable `real_name` columns remain in `student_accounts` and
`student_account_setup_sessions`. New setup and account writes leave them null,
and migration `0020_clear_real_names.sql` clears any previously stored values.
Keeping the nullable columns preserves the option to revisit account-level Real
Names without treating that future design as decided today.

A future decision may require a self-declared Real Name during Student Account
creation when a concrete named use needs it. That decision must separately
define its purpose, readers, and migration for existing Student Accounts.
School Email verification proves access to the address; it does not verify the
student's Real Name.
