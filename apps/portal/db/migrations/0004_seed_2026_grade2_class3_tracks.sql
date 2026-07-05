insert or ignore into school_years (
  school_year,
  starts_on,
  ends_on,
  is_current
) values (
  2026,
  '2026-04-01',
  '2027-03-31',
  1
);

insert or ignore into school_year_classes (
  class_id,
  school_year,
  grade,
  class_number
) values (
  '2026-grade-2-class-3',
  2026,
  2,
  3
);

insert or ignore into tracks (
  track_id,
  class_id,
  track_name
) values
  (
    '2026-grade-2-class-3-humanities',
    '2026-grade-2-class-3',
    '文科'
  ),
  (
    '2026-grade-2-class-3-science',
    '2026-grade-2-class-3',
    '理科'
  );
