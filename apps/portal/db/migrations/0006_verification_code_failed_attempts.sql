alter table email_verification_codes
  add column failed_attempts integer not null default 0;
