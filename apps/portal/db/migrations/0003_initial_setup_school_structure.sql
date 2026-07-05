create table if not exists school_years (
  school_year integer primary key,
  starts_on text not null,
  ends_on text not null,
  is_current integer not null default 0
);

create table if not exists school_year_classes (
  class_id text primary key,
  school_year integer not null references school_years(school_year),
  grade integer not null,
  class_number integer not null,
  unique (school_year, grade, class_number)
);

create table if not exists tracks (
  track_id text primary key,
  class_id text not null references school_year_classes(class_id),
  track_name text not null,
  unique (class_id, track_name)
);

alter table student_account_setup_sessions
  add column display_name text;

alter table student_account_setup_sessions
  add column real_name text;

alter table student_account_setup_sessions
  add column school_year integer references school_years(school_year);

alter table student_account_setup_sessions
  add column grade integer;

alter table student_account_setup_sessions
  add column class_id text references school_year_classes(class_id);

alter table student_account_setup_sessions
  add column track_id text references tracks(track_id);
