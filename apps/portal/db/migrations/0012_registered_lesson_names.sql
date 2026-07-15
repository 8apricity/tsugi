pragma defer_foreign_keys = true;

create table registered_lesson_names (
  registered_lesson_name_id text primary key,
  full_lesson_name text not null,
  short_lesson_name text not null,
  normalized_full_lesson_name text not null unique,

  check (length(full_lesson_name) between 1 and 80),
  check (length(short_lesson_name) between 1 and 40),
  check (instr(full_lesson_name, char(10)) = 0 and instr(full_lesson_name, char(13)) = 0),
  check (instr(short_lesson_name, char(10)) = 0 and instr(short_lesson_name, char(13)) = 0),
  check (length(normalized_full_lesson_name) > 0)
);

create table registered_lesson_name_migration_seed (
  legacy_lesson_name text primary key,
  registered_lesson_name_id text not null unique,
  full_lesson_name text not null,
  short_lesson_name text not null,
  normalized_full_lesson_name text not null
);

insert into registered_lesson_name_migration_seed (
  legacy_lesson_name,
  registered_lesson_name_id,
  full_lesson_name,
  short_lesson_name,
  normalized_full_lesson_name
) values
  ('数Ⅱβ', 'mathematics-2-beta', '理数数学Ⅱβ', '数Ⅱβ', '理数数学iiβ'),
  ('数Ⅱα', 'mathematics-2-alpha', '理数数学Ⅱα', '数Ⅱα', '理数数学iiα'),
  ('家庭', 'home-economics', '家庭基礎', '家庭', '家庭基礎'),
  ('歴史β', 'history-beta', '歴史総合β', '歴史β', '歴史総合β'),
  ('英語R', 'english-reading', '総合英語ⅡR', '英語R', '総合英語iir'),
  ('化学', 'chemistry', '理数化学特講Ⅰ', '化学', '理数化学特講i'),
  ('英語G', 'english-grammar', '総合英語ⅡG', '英語G', '総合英語iig'),
  ('古典', 'classics', '古典探究', '古典', '古典探究'),
  ('現代文', 'modern-japanese', '現代文探究', '現代文', '現代文探究'),
  ('地理', 'geography', '地理総合', '地理', '地理総合'),
  ('CSⅡ', 'creative-solutions-2', 'Creative SolutionsⅡ', 'CSⅡ', 'creative solutionsii'),
  ('生物', 'biology', '理数生物特講Ⅰ', '生物', '理数生物特講i'),
  ('体育', 'physical-education', '体育', '体育', '体育'),
  ('保健', 'health', '保健', '保健', '保健'),
  ('HR', 'homeroom-activities', 'ホームルーム活動', 'HR', 'ホームルーム活動'),
  ('歴史α', 'history-alpha', '歴史総合α', '歴史α', '歴史総合α'),
  ('DD', 'debate-discussion-1', 'ディベート・ディスカッションⅠ', 'DD', 'ディベート・ディスカッションi'),
  ('理科', 'advanced-science', '理数理科特講', '理科', '理数理科特講'),
  ('三丘SHSP', 'mioka-shsp', '三丘SHSP', '三丘SHSP', '三丘shsp'),
  ('自走', 'self-directed-study', '自走', '自走', '自走');

insert into registered_lesson_names (
  registered_lesson_name_id,
  full_lesson_name,
  short_lesson_name,
  normalized_full_lesson_name
)
select
  registered_lesson_name_id,
  full_lesson_name,
  short_lesson_name,
  normalized_full_lesson_name
from registered_lesson_name_migration_seed;

drop index standard_timetable_entries_unique_class_common_period;
drop index standard_timetable_entries_unique_track_period;
drop index standard_timetable_entries_unique_class_common_floating;
drop index standard_timetable_entries_unique_track_floating;
drop index standard_timetable_entries_floating_label_idx;

alter table standard_timetable_entries rename to standard_timetable_entries_old;

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
  registered_lesson_name_id text not null
    references registered_lesson_names(registered_lesson_name_id),

  check (reference_type in ('period', 'floating')),
  check (weekday is null or weekday between 1 and 7),
  check (period_number is null or period_number > 0),
  check (
    (reference_type = 'period' and weekday is not null and period_number is not null and reference_label is null and floating_lesson_reference_label_id is null)
    or (reference_type = 'floating' and weekday is null and period_number is null and reference_label is not null and floating_lesson_reference_label_id is not null)
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
  floating_lesson_reference_label_id,
  registered_lesson_name_id
)
select
  standard_timetable_entry_id,
  class_id,
  track_id,
  reference_type,
  weekday,
  period_number,
  reference_label,
  floating_lesson_reference_label_id,
  (
    select seed.registered_lesson_name_id
    from registered_lesson_name_migration_seed seed
    where seed.legacy_lesson_name = case
      when standard_timetable_entries_old.lesson_name = '柔道・体育'
        then '体育'
      else standard_timetable_entries_old.lesson_name
    end
  )
from standard_timetable_entries_old;

drop table standard_timetable_entries_old;
drop table registered_lesson_name_migration_seed;

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

create index standard_timetable_entries_floating_label_idx
  on standard_timetable_entries(floating_lesson_reference_label_id);
