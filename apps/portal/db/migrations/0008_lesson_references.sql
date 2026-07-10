pragma defer_foreign_keys = true;

drop index standard_timetable_entries_unique_class_common;
drop index standard_timetable_entries_unique_track;

alter table standard_timetable_entries rename to standard_timetable_entries_old;

create table standard_timetable_entries (
  standard_timetable_entry_id text primary key,
  class_id text not null references school_year_classes(class_id),
  track_id text references tracks(track_id),
  reference_type text not null,
  weekday integer,
  period_number integer,
  reference_label text,
  lesson_name text not null,

  check (reference_type in ('period', 'floating')),
  check (weekday is null or weekday between 1 and 7),
  check (period_number is null or period_number > 0),
  check (
    (reference_type = 'period' and weekday is not null and period_number is not null and reference_label is null)
    or (reference_type = 'floating' and weekday is null and period_number is null and reference_label is not null)
  )
);

insert into standard_timetable_entries (
  standard_timetable_entry_id,
  class_id,
  track_id,
  reference_type,
  weekday,
  period_number,
  reference_label,
  lesson_name
)
select
  standard_timetable_entry_id,
  class_id,
  track_id,
  'period',
  weekday,
  period_number,
  null,
  lesson_name
from standard_timetable_entries_old;

drop table standard_timetable_entries_old;

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

insert into standard_timetable_entries (
  standard_timetable_entry_id,
  class_id,
  track_id,
  reference_type,
  weekday,
  period_number,
  reference_label,
  lesson_name
) values
  (
    '2026-grade-2-class-3-humanities-floating-star',
    '2026-grade-2-class-3',
    '2026-grade-2-class-3-humanities',
    'floating',
    null,
    null,
    '★',
    '自走'
  ),
  (
    '2026-grade-2-class-3-science-floating-star',
    '2026-grade-2-class-3',
    '2026-grade-2-class-3-science',
    'floating',
    null,
    null,
    '★',
    '生物'
  );
