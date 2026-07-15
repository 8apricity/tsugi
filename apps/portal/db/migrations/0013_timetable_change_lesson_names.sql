alter table timetable_change_snapshots
  add column registered_lesson_name_id text
  references registered_lesson_names(registered_lesson_name_id);

alter table timetable_change_snapshots
  add column normalized_custom_lesson_name text;

-- SQLite cannot reproduce NFKC safely. The Worker backfills existing rows with
-- the same application normalizer used for new writes after this migration.
