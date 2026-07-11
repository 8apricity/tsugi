create table if not exists floating_lesson_reference_labels (
  floating_lesson_reference_label_id text primary key,
  school_year integer not null references school_years(school_year),
  grade integer not null,
  reference_label text not null,
  display_order integer not null default 0,
  unique (school_year, grade, reference_label)
);

insert or ignore into floating_lesson_reference_labels (
  floating_lesson_reference_label_id,
  school_year,
  grade,
  reference_label,
  display_order
)
select
  school_year_classes.school_year || '-grade-' || school_year_classes.grade || '-floating-' || lower(hex(standard_timetable_entries.reference_label)),
  school_year_classes.school_year,
  school_year_classes.grade,
  standard_timetable_entries.reference_label,
  0
from standard_timetable_entries
join school_year_classes on school_year_classes.class_id = standard_timetable_entries.class_id
where standard_timetable_entries.reference_type = 'floating';

alter table standard_timetable_entries
  add column floating_lesson_reference_label_id text
  references floating_lesson_reference_labels(floating_lesson_reference_label_id);

update standard_timetable_entries
set floating_lesson_reference_label_id = (
  select labels.floating_lesson_reference_label_id
  from floating_lesson_reference_labels labels
  join school_year_classes on school_year_classes.school_year = labels.school_year
    and school_year_classes.grade = labels.grade
  where school_year_classes.class_id = standard_timetable_entries.class_id
    and labels.reference_label = standard_timetable_entries.reference_label
)
where reference_type = 'floating';

create index if not exists standard_timetable_entries_floating_label_idx
  on standard_timetable_entries(floating_lesson_reference_label_id);

create table if not exists target_scopes (
  target_scope_id text primary key,
  school_year integer not null references school_years(school_year),
  created_at text not null
);

create table if not exists target_scope_parts (
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

create table if not exists timetable_change_snapshots (
  timetable_change_snapshot_id text primary key,
  change_date text not null,
  period_number integer not null,
  replacement_type text not null,
  replacement_lesson_name text,
  reference_weekday integer,
  reference_period_number integer,
  reference_label text,
  created_at text not null,
  check (period_number between 1 and 7),
  check (replacement_type in ('lesson_name', 'period_reference', 'floating_lesson_reference', 'cancelled')),
  check (
    (replacement_type = 'lesson_name' and replacement_lesson_name is not null and reference_weekday is null and reference_period_number is null and reference_label is null)
    or (replacement_type = 'period_reference' and replacement_lesson_name is null and reference_weekday between 1 and 6 and reference_period_number between 1 and 7 and reference_label is null)
    or (replacement_type = 'floating_lesson_reference' and replacement_lesson_name is null and reference_weekday is null and reference_period_number is null and reference_label is not null)
    or (replacement_type = 'cancelled' and replacement_lesson_name is null and reference_weekday is null and reference_period_number is null and reference_label is null)
  )
);

create table if not exists shared_information_items (
  shared_information_item_id text primary key,
  kind text not null,
  target_scope_id text not null references target_scopes(target_scope_id),
  latest_change_id text,
  current_timetable_change_snapshot_id text references timetable_change_snapshots(timetable_change_snapshot_id),
  created_by_student_account_id text not null references student_accounts(student_account_id),
  created_at text not null,
  removed_at text,
  check (kind = 'timetable_change')
);

create table if not exists shared_information_changes (
  shared_information_change_id text primary key,
  shared_information_item_id text not null references shared_information_items(shared_information_item_id),
  change_kind text not null,
  source_type text not null,
  source_id text,
  changed_by_student_account_id text not null references student_accounts(student_account_id),
  changed_at text not null,
  timetable_change_snapshot_id text references timetable_change_snapshots(timetable_change_snapshot_id),
  check (change_kind in ('add', 'update', 'remove')),
  check (source_type in ('proposal', 'direct'))
);

create unique index if not exists shared_information_changes_direct_source_id_unique
  on shared_information_changes(source_id)
  where source_type = 'direct';

create table if not exists active_timetable_change_slots (
  timetable_change_slot_key text primary key,
  shared_information_item_id text not null unique
    references shared_information_items(shared_information_item_id)
);

create index if not exists timetable_change_snapshots_change_date_idx
  on timetable_change_snapshots(change_date, period_number);
