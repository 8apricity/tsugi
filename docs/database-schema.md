# Database Schema

This document records the current initial database design for Tsugi. It is intended as an implementation guide for Cloudflare D1 / SQLite.

The previous trust-score-based database sketch has been replaced by the current shared information change model: active shared information, shared information changes, change proposals, direct changes, approvals, and rejections.

## Scope

Initial schema includes:

- Student accounts and school email verification code authentication
- School years, classes, tracks, and student affiliations
- Target scopes
- Standard timetables
- Shared information snapshots for tasks, timetable changes, and notes
- Shared information items and applied changes
- Change proposals and proposal reviews
- Task completions
- Usage events

Initial schema excludes:

- Collections, requests, test-result collections, aggregate results, and personalised reports
- Threads
- Group entities
- Notifications
- UI-only display ordering and pinning
- A separate direct changes table

## Student Accounts

Student accounts are created after a student proves access to an eligible school email and completes required account details such as display name and student affiliation.

```sql
create table student_accounts (
  student_account_id text primary key,
  school_email text not null unique,
  display_name text not null,
  real_name text,
  created_at text not null,
  updated_at text not null,
  disabled_at text
);

create table email_verification_codes (
  email_verification_code_id text primary key,
  school_email text not null,
  code_hash text not null,
  requested_at integer not null,
  invalidated_at integer
);

create index email_verification_codes_school_email_requested_at_idx
  on email_verification_codes(school_email, requested_at);
```

Verification code values are never stored directly. `code_hash` stores only a hash of the code sent by email. `invalidated_at is null` means the code request may still be used if it is also within the application-enforced expiry window. When a new code is issued for the same school email, older unused codes are invalidated. Request history is retained so resend cooldowns and hourly send limits can be enforced.

## School Structure

```sql
create table school_years (
  school_year integer primary key,
  starts_on text not null,
  ends_on text not null,
  is_current integer not null default 0
);

create table school_year_classes (
  class_id text primary key,
  school_year integer not null references school_years(school_year),
  grade integer not null,
  class_number integer not null,
  unique (school_year, grade, class_number)
);

create table tracks (
  track_id text primary key,
  class_id text not null references school_year_classes(class_id),
  track_name text not null,
  unique (class_id, track_name)
);

create table student_affiliations (
  student_affiliation_id text primary key,
  student_account_id text not null references student_accounts(student_account_id),
  school_year integer not null references school_years(school_year),
  grade integer not null,
  class_id text not null references school_year_classes(class_id),
  track_id text references tracks(track_id),
  selected_at text not null,
  ended_at text
);

create unique index student_affiliations_one_current_per_year
  on student_affiliations(student_account_id, school_year)
  where ended_at is null;
```

`school_year` is the integer academic year itself, not a generated ID. Student affiliation is self-selected and renewed manually for each school year.

## Target Scopes

```sql
create table target_scopes (
  target_scope_id text primary key,
  school_year integer not null references school_years(school_year),
  created_at text not null
);

create table target_scope_parts (
  target_scope_part_id text primary key,
  target_scope_id text not null references target_scopes(target_scope_id),
  scope_type text not null,
  grade integer,
  class_id text references school_year_classes(class_id),
  track_id text references tracks(track_id),
  student_account_id text references student_accounts(student_account_id),

  check (scope_type in ('grade', 'class', 'track', 'student')),
  check (
    (scope_type = 'grade' and grade is not null and class_id is null and track_id is null and student_account_id is null)
    or (scope_type = 'class' and grade is null and class_id is not null and track_id is null and student_account_id is null)
    or (scope_type = 'track' and grade is null and class_id is null and track_id is not null and student_account_id is null)
    or (scope_type = 'student' and grade is null and class_id is null and track_id is null and student_account_id is not null)
  )
);

create unique index target_scope_parts_unique_grade
  on target_scope_parts(target_scope_id, grade)
  where scope_type = 'grade';

create unique index target_scope_parts_unique_class
  on target_scope_parts(target_scope_id, class_id)
  where scope_type = 'class';

create unique index target_scope_parts_unique_track
  on target_scope_parts(target_scope_id, track_id)
  where scope_type = 'track';

create unique index target_scope_parts_unique_student
  on target_scope_parts(target_scope_id, student_account_id)
  where scope_type = 'student';
```

A target scope is a union of its parts. Exclusions and cross-school-year scopes are not part of the initial model.

The schema can represent a union containing multiple target scope parts. The initial Portal Timetable Direct Add flow intentionally creates exactly one part per target scope: the creator's Grade, Class, Track, or Student scope. Multiple-part creation is reserved for later product work.

## Standard Timetables

Floating Lesson Reference labels are defined once per School Year and Grade so editors can list the labels without inferring them from Class/Track resolution rows. The label ID is authoritative for Standard Timetable resolution and Timetable Change snapshots, so changing display text does not break an existing reference. `reference_label` remains on migrated Standard Timetable rows as compatibility data, but application reads resolve through `floating_lesson_reference_label_id`.

```sql
create table floating_lesson_reference_labels (
  floating_lesson_reference_label_id text primary key,
  school_year integer not null references school_years(school_year),
  grade integer not null,
  reference_label text not null,
  display_order integer not null default 0,
  unique (school_year, grade, reference_label)
);
```

```sql
create table standard_timetable_entries (
  standard_timetable_entry_id text primary key,
  class_id text not null references school_year_classes(class_id),
  track_id text references tracks(track_id),
  reference_type text not null,
  weekday integer,
  period_number integer,
  reference_label text,
  floating_lesson_reference_label_id text
    references floating_lesson_reference_labels(floating_lesson_reference_label_id),
  lesson_name text not null,

  check (reference_type in ('period', 'floating')),
  check (weekday is null or weekday between 1 and 7),
  check (period_number is null or period_number > 0),
  check (
    (reference_type = 'period' and weekday is not null and period_number is not null and reference_label is null)
    or (reference_type = 'floating' and weekday is null and period_number is null and reference_label is not null)
  )
);

create unique index standard_timetable_entries_unique_class_common_period
  on standard_timetable_entries(class_id, weekday, period_number)
  where track_id is null and reference_type = 'period';

create unique index standard_timetable_entries_unique_track_period
  on standard_timetable_entries(class_id, track_id, weekday, period_number)
  where track_id is not null and reference_type = 'period';

create unique index standard_timetable_entries_unique_class_common_floating
  on standard_timetable_entries(class_id, reference_label)
  where track_id is null and reference_type = 'floating';

create unique index standard_timetable_entries_unique_track_floating
  on standard_timetable_entries(class_id, track_id, reference_label)
  where track_id is not null and reference_type = 'floating';
```

`standard_timetable_entries` stores lesson references. A `period` entry represents a recurring lesson slot; a `floating` entry represents a floating lesson reference, such as `★`, that is not bound to a weekday and period number. `track_id is null` means the class-common value. A track-specific value overrides the class-common value for the same lesson slot or reference label.

## Shared Information Snapshots

Snapshots are immutable value records. They do not store creator, target scope, or review information.

```sql
create table task_snapshots (
  task_snapshot_id text primary key,
  title text not null,
  due_date text,
  related_lesson_school_date text,
  related_lesson_period_number integer,
  related_lesson_name text,
  created_at text not null,

  check (
    (related_lesson_school_date is null and related_lesson_period_number is null)
    or (related_lesson_school_date is not null and related_lesson_period_number is not null)
  ),
  check (related_lesson_period_number is null or related_lesson_period_number > 0)
);

create table timetable_change_snapshots (
  timetable_change_snapshot_id text primary key,
  change_date text not null,
  period_number integer not null,
  replacement_type text not null,
  replacement_lesson_name text,
  reference_weekday integer,
  reference_period_number integer,
  reference_label text,
  floating_lesson_reference_label_id text
    references floating_lesson_reference_labels(floating_lesson_reference_label_id),
  created_at text not null,

  check (period_number > 0),
  check (replacement_type in ('lesson_name', 'period_reference', 'floating_lesson_reference', 'cancelled')),
  check (reference_weekday is null or reference_weekday between 1 and 7),
  check (reference_period_number is null or reference_period_number > 0),
  check (
    (replacement_type = 'lesson_name' and replacement_lesson_name is not null and reference_weekday is null and reference_period_number is null and reference_label is null)
    or (replacement_type = 'period_reference' and replacement_lesson_name is null and reference_weekday is not null and reference_period_number is not null and reference_label is null)
    or (replacement_type = 'floating_lesson_reference' and replacement_lesson_name is null and reference_weekday is null and reference_period_number is null and reference_label is not null)
    or (replacement_type = 'cancelled' and replacement_lesson_name is null and reference_weekday is null and reference_period_number is null and reference_label is null)
  )
);

create table note_snapshots (
  note_snapshot_id text primary key,
  body text not null,
  related_context_type text,
  related_school_date text,
  related_period_number integer,
  related_task_item_id text references shared_information_items(shared_information_item_id),
  created_at text not null,

  check (related_context_type is null or related_context_type in ('school_date', 'daily_lesson', 'task')),
  check (
    (related_context_type is null and related_school_date is null and related_period_number is null and related_task_item_id is null)
    or (related_context_type = 'school_date' and related_school_date is not null and related_period_number is null and related_task_item_id is null)
    or (related_context_type = 'daily_lesson' and related_school_date is not null and related_period_number is not null and related_task_item_id is null)
    or (related_context_type = 'task' and related_school_date is null and related_period_number is null and related_task_item_id is not null)
  )
);
```

Tasks store due timing at school-date level only. If a student needs to record a finer instruction such as "before third period" or "by the start of class", that detail belongs in a note related to the task rather than in formal task due fields.

`related_lesson_school_date` and `related_lesson_period_number` identify a specific daily lesson in the displayed timetable for one school date. `related_lesson_name` may be stored with or without a specific related daily lesson; the two are not exclusive. For example, a task created from a daily plan can store both the specific daily lesson and its lesson name, while a task created from a table-like view may be related only to a lesson name.

`timetable_change_snapshots` represents one date and one period. A UI may create several timetable changes in one operation, but the database stores them as separate shared information items.
For `floating_lesson_reference`, `floating_lesson_reference_label_id` is authoritative. The current migration also fills `reference_label` with a non-null compatibility token to preserve the original table check; it is not used to resolve the Lesson Name.

## Shared Information Items

```sql
create table shared_information_items (
  shared_information_item_id text primary key,
  kind text not null,
  target_scope_id text not null references target_scopes(target_scope_id),
  latest_change_id text,
  current_task_snapshot_id text references task_snapshots(task_snapshot_id),
  current_timetable_change_snapshot_id text references timetable_change_snapshots(timetable_change_snapshot_id),
  current_note_snapshot_id text references note_snapshots(note_snapshot_id),
  created_by_student_account_id text not null references student_accounts(student_account_id),
  created_at text not null,
  removed_at text,

  check (kind in ('task', 'timetable_change', 'note')),
  check (
    (kind = 'task' and current_task_snapshot_id is not null and current_timetable_change_snapshot_id is null and current_note_snapshot_id is null)
    or (kind = 'timetable_change' and current_task_snapshot_id is null and current_timetable_change_snapshot_id is not null and current_note_snapshot_id is null)
    or (kind = 'note' and current_task_snapshot_id is null and current_timetable_change_snapshot_id is null and current_note_snapshot_id is not null)
  )
);
```

Rows are retained after removal. `removed_at is null` means the item is active.

## Shared Information Changes

```sql
create table shared_information_changes (
  shared_information_change_id text primary key,
  shared_information_item_id text not null references shared_information_items(shared_information_item_id),
  change_kind text not null,
  source_type text not null,
  source_id text,
  changed_by_student_account_id text not null references student_accounts(student_account_id),
  changed_at text not null,
  task_snapshot_id text references task_snapshots(task_snapshot_id),
  timetable_change_snapshot_id text references timetable_change_snapshots(timetable_change_snapshot_id),
  note_snapshot_id text references note_snapshots(note_snapshot_id),

  check (change_kind in ('add', 'update', 'remove')),
  check (source_type in ('proposal', 'direct')),
  check (
    (change_kind = 'remove' and task_snapshot_id is null and timetable_change_snapshot_id is null and note_snapshot_id is null)
    or (change_kind != 'remove' and (
      (task_snapshot_id is not null and timetable_change_snapshot_id is null and note_snapshot_id is null)
      or (task_snapshot_id is null and timetable_change_snapshot_id is not null and note_snapshot_id is null)
      or (task_snapshot_id is null and timetable_change_snapshot_id is null and note_snapshot_id is not null)
    ))
  )
);
```

Accepted proposals and direct changes both create a shared information change. A separate direct changes table is intentionally not used.
`changed_by_student_account_id` is stored for traceability, but ordinary named attribution is shown only for direct changes. Accepted proposals, approvals, and rejections should not expose the individual students behind them in normal product surfaces.

## Change Proposals

```sql
create table change_proposals (
  change_proposal_id text primary key,
  shared_information_item_id text references shared_information_items(shared_information_item_id),
  description text,
  kind text not null,
  change_kind text not null,
  target_scope_id text not null references target_scopes(target_scope_id),
  base_change_id text references shared_information_changes(shared_information_change_id),
  proposed_by_student_account_id text not null references student_accounts(student_account_id),
  status text not null,
  proposed_at text not null,
  resolved_at text,
  proposed_task_snapshot_id text references task_snapshots(task_snapshot_id),
  proposed_timetable_change_snapshot_id text references timetable_change_snapshots(timetable_change_snapshot_id),
  proposed_note_snapshot_id text references note_snapshots(note_snapshot_id),

  check (kind in ('task', 'timetable_change', 'note')),
  check (change_kind in ('add', 'update', 'remove')),
  check (status in ('pending', 'accepted', 'rejected', 'stale')),
  check (
    (change_kind = 'add' and shared_information_item_id is null and base_change_id is null)
    or (change_kind in ('update', 'remove') and shared_information_item_id is not null and base_change_id is not null)
  ),
  check (
    (change_kind = 'remove' and proposed_task_snapshot_id is null and proposed_timetable_change_snapshot_id is null and proposed_note_snapshot_id is null)
    or (change_kind != 'remove' and (
      (kind = 'task' and proposed_task_snapshot_id is not null and proposed_timetable_change_snapshot_id is null and proposed_note_snapshot_id is null)
      or (kind = 'timetable_change' and proposed_task_snapshot_id is null and proposed_timetable_change_snapshot_id is not null and proposed_note_snapshot_id is null)
      or (kind = 'note' and proposed_task_snapshot_id is null and proposed_timetable_change_snapshot_id is null and proposed_note_snapshot_id is not null)
    ))
  )
);
```

Proposal acceptance is automatic when two eligible approvals are present. Proposal rejection is automatic when two eligible rejections are present. The proposer does not count toward the required approvals.
For update and remove proposals, `kind` and `target_scope_id` must match the referenced shared information item. Updating shared information cannot change its kind or target scope. To represent a different kind or target scope, remove the old item and add a separate new item.

## Proposal Reviews

```sql
create table proposal_reviews (
  proposal_review_id text primary key,
  change_proposal_id text not null references change_proposals(change_proposal_id),
  student_account_id text not null references student_accounts(student_account_id),
  decision text not null,
  decided_at text not null,

  unique (change_proposal_id, student_account_id),
  check (decision in ('approval', 'rejection'))
);
```

Approvals and rejections are stored in the same table so one student can have only one current decision for a proposal. Pending decisions may be changed or removed while the proposal is still pending.

## Task Completions

```sql
create table task_completions (
  task_completion_id text primary key,
  task_item_id text not null references shared_information_items(shared_information_item_id),
  student_account_id text not null references student_accounts(student_account_id),
  status text not null,
  completed_at text,
  updated_at text not null,

  unique (task_item_id, student_account_id),
  check (status in ('pending', 'completed', 'hidden'))
);
```

Only task items may have task completions. This is validated by application logic.

## Usage Events

```sql
create table usage_events (
  usage_event_id text primary key,
  student_account_id text references student_accounts(student_account_id),
  event_name text not null,
  occurred_at text not null,
  metadata_json text
);

create index usage_events_occurred_at_idx
  on usage_events(occurred_at);

create index usage_events_event_name_occurred_at_idx
  on usage_events(event_name, occurred_at);
```

Usage events are for product analytics, not application behavior. They should not contain school email addresses, shared information body text, or other unnecessary personal data. Use small metadata such as `kind`, `change_kind`, or target scope summary when needed.
