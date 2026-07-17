create table if not exists interactive_test_login_tickets (
  interactive_test_login_ticket_id text primary key,
  ticket_token_hash text not null unique,
  student_account_id text not null references student_accounts(student_account_id),
  created_at integer not null,
  expires_at integer not null,
  consumed_at integer,
  consumption_nonce text unique,

  check (expires_at > created_at),
  check (
    (consumed_at is null and consumption_nonce is null)
    or (consumed_at is not null and consumption_nonce is not null)
  )
);

create index if not exists interactive_test_login_tickets_cleanup_idx
  on interactive_test_login_tickets(expires_at, consumed_at);
