create table if not exists email_verification_codes (
  email_verification_code_id text primary key,
  school_email text not null,
  code_hash text not null,
  requested_at integer not null,
  invalidated_at integer
);

create index if not exists email_verification_codes_school_email_requested_at_idx
  on email_verification_codes(school_email, requested_at);
