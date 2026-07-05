create table if not exists student_account_setup_sessions (
  student_account_setup_session_id text primary key,
  setup_session_token_hash text not null unique,
  school_email text not null,
  created_at integer not null,
  expires_at integer not null,
  invalidated_at integer
);

create index if not exists student_account_setup_sessions_school_email_idx
  on student_account_setup_sessions(school_email);
