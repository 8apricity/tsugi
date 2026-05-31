# Database Design Notes

These are working notes from the initial database design discussion. They are not accepted product language or an implementation contract.

## Current Status

The discussion paused because trust-score-based conflict resolution is being reconsidered. The structures below preserve the design state before restarting the basic design discussion.

## Accepted Direction Before Restart

- Use Cloudflare D1 / SQLite for the initial database.
- Scope the initial database to the core student timetable and task experience.
- Treat the app as a single School Community; do not add `school_id` or `school_community_id` to every table.
- Use Resend-backed custom magic links instead of Google OAuth.
- Store School Year as an integer primary key, not as a generated `school_year_id`.
- Keep Classes as School-Year-owned entities with a generated `class_id`.
- Model Target Scope as a composite scope with multiple parts, interpreted as a union.
- Keep a Target Scope within one School Year.
- Do not add `information_threads` for grouping competing candidates.
- Do not store `trust_score`; if retained at all, derive confidence from confirmations.
- Enforce "only students inside the Target Scope can confirm" in application logic rather than only with SQL constraints.
- Store Standard Timetable entries as lesson names by weekday and period, without room.
- Let Track-specific Standard Timetable entries override Class-common entries for the same lesson slot.

## Candidate Tables Discussed

```sql
student_accounts (
  student_account_id text primary key,
  school_email text not null unique,
  display_name text not null,
  real_name text,
  created_at text not null,
  updated_at text not null,
  disabled_at text
);

magic_link_tokens (
  magic_link_token_id text primary key,
  student_account_id text references student_accounts(student_account_id),
  school_email text not null,
  token_hash text not null unique,
  expires_at text not null,
  consumed_at text,
  created_at text not null
);

school_years (
  school_year integer primary key,
  starts_on text not null,
  ends_on text not null,
  is_current integer not null default 0
);

school_year_classes (
  class_id text primary key,
  school_year integer not null references school_years(school_year),
  grade integer not null,
  class_number integer not null,
  unique (school_year, grade, class_number)
);

tracks (
  track_id text primary key,
  class_id text not null references school_year_classes(class_id),
  track_name text not null,
  unique (class_id, track_name)
);

student_affiliations (
  student_affiliation_id text primary key,
  student_account_id text not null references student_accounts(student_account_id),
  school_year integer not null references school_years(school_year),
  grade integer not null,
  class_id text not null references school_year_classes(class_id),
  track_id text references tracks(track_id),
  selected_at text not null,
  ended_at text
);

target_scopes (
  target_scope_id text primary key,
  school_year integer not null references school_years(school_year),
  created_at text not null
);

target_scope_parts (
  target_scope_part_id text primary key,
  target_scope_id text not null references target_scopes(target_scope_id),
  scope_type text not null, -- 'grade' | 'class' | 'track' | 'student'
  grade integer,
  class_id text references school_year_classes(class_id),
  track_id text references tracks(track_id),
  student_account_id text references student_accounts(student_account_id),
  unique (target_scope_id, scope_type, grade, class_id, track_id, student_account_id)
);

standard_timetable_entries (
  standard_timetable_entry_id text primary key,
  class_id text not null references school_year_classes(class_id),
  track_id text references tracks(track_id),
  weekday integer not null,
  period_number integer not null,
  lesson_name text not null,
  unique (class_id, track_id, weekday, period_number)
);
```

## Shared Information Structure Discussed Before Restart

This part is now explicitly unsettled because trust-score-based conflict resolution may be removed.

```sql
information_candidates (
  information_candidate_id text primary key,
  information_kind text not null, -- 'task' | 'timetable_change'
  target_scope_id text not null references target_scopes(target_scope_id),
  created_by_student_account_id text not null references student_accounts(student_account_id),
  created_at text not null,
  withdrawn_at text
);

confirmations (
  confirmation_id text primary key,
  information_candidate_id text not null references information_candidates(information_candidate_id),
  student_account_id text not null references student_accounts(student_account_id),
  confirmed_at text not null,
  unique (information_candidate_id, student_account_id)
);
```

## Timetable Change Shape Under Discussion

The last unresolved point was whether timetable-change notes should live on change items or a separate notes table. The leaning was to keep notes on change items until notes gain their own lifecycle.

```sql
timetable_changes (
  timetable_change_id text primary key,
  information_candidate_id text not null unique references information_candidates(information_candidate_id),
  change_date text not null
);

timetable_change_items (
  timetable_change_item_id text primary key,
  timetable_change_id text not null references timetable_changes(timetable_change_id),
  period_number integer,
  replacement_type text not null, -- 'lesson_name' | 'period_reference' | 'cancelled' | 'note'
  replacement_lesson_name text,
  reference_weekday integer,
  reference_period_number integer,
  notes text,
  sort_order integer not null default 0
);
```

