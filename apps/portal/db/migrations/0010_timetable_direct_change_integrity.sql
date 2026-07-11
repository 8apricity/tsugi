create unique index if not exists target_scope_parts_unique_grade
  on target_scope_parts(target_scope_id, grade)
  where scope_type = 'grade';

create unique index if not exists target_scope_parts_unique_class
  on target_scope_parts(target_scope_id, class_id)
  where scope_type = 'class';

create unique index if not exists target_scope_parts_unique_track
  on target_scope_parts(target_scope_id, track_id)
  where scope_type = 'track';

create unique index if not exists target_scope_parts_unique_student
  on target_scope_parts(target_scope_id, student_account_id)
  where scope_type = 'student';

alter table timetable_change_snapshots
  add column floating_lesson_reference_label_id text
  references floating_lesson_reference_labels(floating_lesson_reference_label_id);
