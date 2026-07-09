create table if not exists standard_timetable_entries (
  standard_timetable_entry_id text primary key,
  class_id text not null references school_year_classes(class_id),
  track_id text references tracks(track_id),
  weekday integer not null,
  period_number integer not null,
  lesson_name text not null,

  check (weekday between 1 and 7),
  check (period_number > 0)
);

create unique index if not exists standard_timetable_entries_unique_class_common
  on standard_timetable_entries(class_id, weekday, period_number)
  where track_id is null;

create unique index if not exists standard_timetable_entries_unique_track
  on standard_timetable_entries(class_id, track_id, weekday, period_number)
  where track_id is not null;

-- Seed derived from db/seeds/standard-timetable-2026-grade-2-class-3.csv.
insert into standard_timetable_entries (
  standard_timetable_entry_id,
  class_id,
  track_id,
  weekday,
  period_number,
  lesson_name
) values
  ('2026-grade-2-class-3-common-tue-1', '2026-grade-2-class-3', null, 2, 1, '英語G'),
  ('2026-grade-2-class-3-humanities-tue-2', '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 2, 2, '古典'),
  ('2026-grade-2-class-3-science-tue-2', '2026-grade-2-class-3', '2026-grade-2-class-3-science', 2, 2, '生物'),
  ('2026-grade-2-class-3-common-tue-3', '2026-grade-2-class-3', null, 2, 3, '現代文'),
  ('2026-grade-2-class-3-common-tue-4', '2026-grade-2-class-3', null, 2, 4, '地理'),
  ('2026-grade-2-class-3-common-tue-5', '2026-grade-2-class-3', null, 2, 5, 'CSⅡ'),
  ('2026-grade-2-class-3-common-tue-6', '2026-grade-2-class-3', null, 2, 6, 'CSⅡ'),
  ('2026-grade-2-class-3-common-fri-1', '2026-grade-2-class-3', null, 5, 1, '地理'),
  ('2026-grade-2-class-3-common-fri-2', '2026-grade-2-class-3', null, 5, 2, 'DD'),
  ('2026-grade-2-class-3-common-fri-3', '2026-grade-2-class-3', null, 5, 3, '数Ⅱβ'),
  ('2026-grade-2-class-3-humanities-fri-4', '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 5, 4, '現代文'),
  ('2026-grade-2-class-3-science-fri-4', '2026-grade-2-class-3', '2026-grade-2-class-3-science', 5, 4, '古典'),
  ('2026-grade-2-class-3-common-fri-5', '2026-grade-2-class-3', null, 5, 5, '歴史α'),
  ('2026-grade-2-class-3-common-fri-6', '2026-grade-2-class-3', null, 5, 6, '英語G'),
  ('2026-grade-2-class-3-humanities-fri-7', '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 5, 7, '古典'),
  ('2026-grade-2-class-3-science-fri-7', '2026-grade-2-class-3', '2026-grade-2-class-3-science', 5, 7, '理科'),
  ('2026-grade-2-class-3-common-mon-1', '2026-grade-2-class-3', null, 1, 1, '数Ⅱβ'),
  ('2026-grade-2-class-3-common-mon-2', '2026-grade-2-class-3', null, 1, 2, '数Ⅱα'),
  ('2026-grade-2-class-3-common-mon-3', '2026-grade-2-class-3', null, 1, 3, '家庭'),
  ('2026-grade-2-class-3-common-mon-4', '2026-grade-2-class-3', null, 1, 4, '家庭'),
  ('2026-grade-2-class-3-humanities-mon-5', '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 1, 5, '歴史β'),
  ('2026-grade-2-class-3-science-mon-5', '2026-grade-2-class-3', '2026-grade-2-class-3-science', 1, 5, '化学'),
  ('2026-grade-2-class-3-common-mon-6', '2026-grade-2-class-3', null, 1, 6, '英語R'),
  ('2026-grade-2-class-3-common-mon-7', '2026-grade-2-class-3', null, 1, 7, '柔道・体育'),
  ('2026-grade-2-class-3-humanities-wed-1', '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 3, 1, '歴史β'),
  ('2026-grade-2-class-3-science-wed-1', '2026-grade-2-class-3', '2026-grade-2-class-3-science', 3, 1, '現代文'),
  ('2026-grade-2-class-3-common-wed-2', '2026-grade-2-class-3', null, 3, 2, '体育'),
  ('2026-grade-2-class-3-humanities-wed-3', '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 3, 3, '現代文'),
  ('2026-grade-2-class-3-science-wed-3', '2026-grade-2-class-3', '2026-grade-2-class-3-science', 3, 3, '古典'),
  ('2026-grade-2-class-3-common-wed-4', '2026-grade-2-class-3', null, 3, 4, '保健'),
  ('2026-grade-2-class-3-common-wed-5', '2026-grade-2-class-3', null, 3, 5, '数Ⅱα'),
  ('2026-grade-2-class-3-common-wed-6', '2026-grade-2-class-3', null, 3, 6, '数Ⅱβ'),
  ('2026-grade-2-class-3-common-wed-7', '2026-grade-2-class-3', null, 3, 7, 'HR'),
  ('2026-grade-2-class-3-common-sat-1', '2026-grade-2-class-3', null, 6, 1, '三丘SHSP'),
  ('2026-grade-2-class-3-common-thu-1', '2026-grade-2-class-3', null, 4, 1, '体育'),
  ('2026-grade-2-class-3-common-thu-2', '2026-grade-2-class-3', null, 4, 2, '歴史α'),
  ('2026-grade-2-class-3-humanities-thu-3', '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 4, 3, '古典'),
  ('2026-grade-2-class-3-science-thu-3', '2026-grade-2-class-3', '2026-grade-2-class-3-science', 4, 3, '化学'),
  ('2026-grade-2-class-3-common-thu-4', '2026-grade-2-class-3', null, 4, 4, '英語R'),
  ('2026-grade-2-class-3-common-thu-5', '2026-grade-2-class-3', null, 4, 5, 'DD'),
  ('2026-grade-2-class-3-common-thu-6', '2026-grade-2-class-3', null, 4, 6, '数Ⅱα')
on conflict(standard_timetable_entry_id) do update set
  class_id = excluded.class_id,
  track_id = excluded.track_id,
  weekday = excluded.weekday,
  period_number = excluded.period_number,
  lesson_name = excluded.lesson_name;
