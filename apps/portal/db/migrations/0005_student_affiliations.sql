create table if not exists student_affiliations (
  student_affiliation_id text primary key,
  student_account_id text not null references student_accounts(student_account_id),
  school_year integer not null references school_years(school_year),
  grade integer not null,
  class_id text not null references school_year_classes(class_id),
  track_id text not null references tracks(track_id),
  selected_at integer not null,
  ended_at integer
);

create unique index if not exists student_affiliations_current_year_idx
  on student_affiliations(student_account_id, school_year)
  where ended_at is null;
