create table if not exists email_verification_codes (
  email_verification_code_id text primary key,
  school_email text not null,
  code_hash text not null,
  requested_at integer not null,
  invalidated_at integer
);

create index if not exists email_verification_codes_school_email_requested_at_idx
  on email_verification_codes(school_email, requested_at);

create table if not exists student_accounts (
  student_account_id text primary key,
  school_email text not null unique,
  display_name text not null,
  real_name text,
  created_at text not null,
  updated_at text not null,
  disabled_at text
);

create table if not exists student_sessions (
  student_session_id text primary key,
  session_token_hash text not null unique,
  student_account_id text not null references student_accounts(student_account_id),
  created_at integer not null,
  expires_at integer not null,
  invalidated_at integer
);

create index if not exists student_sessions_student_account_id_idx
  on student_sessions(student_account_id);
