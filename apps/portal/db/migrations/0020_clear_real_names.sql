update student_accounts
set real_name = null
where real_name is not null;

update student_account_setup_sessions
set real_name = null
where real_name is not null;
