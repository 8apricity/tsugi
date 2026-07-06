insert into school_years (school_year, starts_on, ends_on, is_current)
values
  (2025, '2025-04-01', '2026-03-31', 0),
  (2026, '2026-04-01', '2027-03-31', 1)
on conflict (school_year) do update set
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  is_current = excluded.is_current;

insert into school_year_classes (class_id, school_year, grade, class_number)
values
  ('2025-grade-2-class-3', 2025, 2, 3),
  ('2026-grade-2-class-3', 2026, 2, 3),
  ('2026-grade-2-class-4', 2026, 2, 4)
on conflict (class_id) do update set
  school_year = excluded.school_year,
  grade = excluded.grade,
  class_number = excluded.class_number;

insert into tracks (track_id, class_id, track_name)
values
  ('2025-grade-2-class-3-humanities', '2025-grade-2-class-3', '文科'),
  ('2026-grade-2-class-3-humanities', '2026-grade-2-class-3', '文科'),
  ('2026-grade-2-class-3-science', '2026-grade-2-class-3', '理科'),
  ('2026-grade-2-class-4-humanities', '2026-grade-2-class-4', '文科')
on conflict (track_id) do update set
  class_id = excluded.class_id,
  track_name = excluded.track_name;

insert into student_accounts (
  student_account_id,
  school_email,
  display_name,
  real_name,
  created_at,
  updated_at,
  disabled_at
)
values
  ('test-student-2026-2-3-humanities-1', 'test-student-2026-2-3-humanities-1@example.invalid', '文科1', '検証 文科1', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', null),
  ('test-student-2026-2-3-humanities-2', 'test-student-2026-2-3-humanities-2@example.invalid', '文科2', '検証 文科2', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', null),
  ('test-student-2026-2-3-humanities-3', 'test-student-2026-2-3-humanities-3@example.invalid', '文科3', '検証 文科3', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', null),
  ('test-student-2026-2-3-science-1', 'test-student-2026-2-3-science-1@example.invalid', '理科1', '検証 理科1', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', null),
  ('test-student-2026-2-3-science-2', 'test-student-2026-2-3-science-2@example.invalid', '理科2', '検証 理科2', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', null),
  ('test-student-2026-2-3-science-3', 'test-student-2026-2-3-science-3@example.invalid', '理科3', '検証 理科3', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', null),
  ('test-student-2026-2-4-humanities-1', 'test-student-2026-2-4-humanities-1@example.invalid', '4組文科1', '検証 4組文科1', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', null),
  ('test-student-2026-2-4-humanities-2', 'test-student-2026-2-4-humanities-2@example.invalid', '4組文科2', '検証 4組文科2', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', null),
  ('test-student-2025-2-3-humanities-1', 'test-student-2025-2-3-humanities-1@example.invalid', '25年度文科1', '検証 25年度文科1', '2025-04-01T00:00:00.000Z', '2025-04-01T00:00:00.000Z', null)
on conflict (student_account_id) do update set
  school_email = excluded.school_email,
  display_name = excluded.display_name,
  real_name = excluded.real_name,
  updated_at = excluded.updated_at,
  disabled_at = excluded.disabled_at;

insert into student_affiliations (
  student_affiliation_id,
  student_account_id,
  school_year,
  grade,
  class_id,
  track_id,
  selected_at,
  ended_at
)
values
  ('test-affiliation-2026-2-3-humanities-1', 'test-student-2026-2-3-humanities-1', 2026, 2, '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 1775001600000, null),
  ('test-affiliation-2026-2-3-humanities-2', 'test-student-2026-2-3-humanities-2', 2026, 2, '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 1775001600000, null),
  ('test-affiliation-2026-2-3-humanities-3', 'test-student-2026-2-3-humanities-3', 2026, 2, '2026-grade-2-class-3', '2026-grade-2-class-3-humanities', 1775001600000, null),
  ('test-affiliation-2026-2-3-science-1', 'test-student-2026-2-3-science-1', 2026, 2, '2026-grade-2-class-3', '2026-grade-2-class-3-science', 1775001600000, null),
  ('test-affiliation-2026-2-3-science-2', 'test-student-2026-2-3-science-2', 2026, 2, '2026-grade-2-class-3', '2026-grade-2-class-3-science', 1775001600000, null),
  ('test-affiliation-2026-2-3-science-3', 'test-student-2026-2-3-science-3', 2026, 2, '2026-grade-2-class-3', '2026-grade-2-class-3-science', 1775001600000, null),
  ('test-affiliation-2026-2-4-humanities-1', 'test-student-2026-2-4-humanities-1', 2026, 2, '2026-grade-2-class-4', '2026-grade-2-class-4-humanities', 1775001600000, null),
  ('test-affiliation-2026-2-4-humanities-2', 'test-student-2026-2-4-humanities-2', 2026, 2, '2026-grade-2-class-4', '2026-grade-2-class-4-humanities', 1775001600000, null),
  ('test-affiliation-2025-2-3-humanities-1', 'test-student-2025-2-3-humanities-1', 2025, 2, '2025-grade-2-class-3', '2025-grade-2-class-3-humanities', 1743465600000, null)
on conflict (student_affiliation_id) do update set
  student_account_id = excluded.student_account_id,
  school_year = excluded.school_year,
  grade = excluded.grade,
  class_id = excluded.class_id,
  track_id = excluded.track_id,
  selected_at = excluded.selected_at,
  ended_at = excluded.ended_at;
