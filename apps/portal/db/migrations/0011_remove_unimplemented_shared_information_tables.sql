pragma defer_foreign_keys = true;

drop table if exists proposal_reviews;
drop table if exists change_proposals;
drop table if exists task_completions;
drop table if exists note_snapshots;
drop table if exists task_snapshots;
drop table if exists usage_events;

create table active_timetable_change_slots_backup (
  timetable_change_slot_key text primary key,
  shared_information_item_id text not null unique
);

insert into active_timetable_change_slots_backup (
  timetable_change_slot_key,
  shared_information_item_id
)
select timetable_change_slot_key, shared_information_item_id
from active_timetable_change_slots;

drop table active_timetable_change_slots;

create table shared_information_items_new (
  shared_information_item_id text primary key,
  kind text not null,
  target_scope_id text not null references target_scopes(target_scope_id),
  latest_change_id text,
  current_timetable_change_snapshot_id text not null
    references timetable_change_snapshots(timetable_change_snapshot_id),
  created_by_student_account_id text not null
    references student_accounts(student_account_id),
  created_at text not null,
  removed_at text,
  check (kind = 'timetable_change')
);

insert into shared_information_items_new (
  shared_information_item_id,
  kind,
  target_scope_id,
  latest_change_id,
  current_timetable_change_snapshot_id,
  created_by_student_account_id,
  created_at,
  removed_at
)
select
  shared_information_item_id,
  kind,
  target_scope_id,
  latest_change_id,
  current_timetable_change_snapshot_id,
  created_by_student_account_id,
  created_at,
  removed_at
from shared_information_items
where kind = 'timetable_change';

create table shared_information_changes_new (
  shared_information_change_id text primary key,
  shared_information_item_id text not null
    references shared_information_items_new(shared_information_item_id),
  change_kind text not null,
  source_type text not null,
  source_id text,
  changed_by_student_account_id text not null
    references student_accounts(student_account_id),
  changed_at text not null,
  timetable_change_snapshot_id text
    references timetable_change_snapshots(timetable_change_snapshot_id),
  check (change_kind in ('add', 'update', 'remove')),
  check (source_type in ('proposal', 'direct')),
  check (
    (change_kind = 'remove' and timetable_change_snapshot_id is null)
    or (change_kind != 'remove' and timetable_change_snapshot_id is not null)
  )
);

insert into shared_information_changes_new (
  shared_information_change_id,
  shared_information_item_id,
  change_kind,
  source_type,
  source_id,
  changed_by_student_account_id,
  changed_at,
  timetable_change_snapshot_id
)
select
  shared_information_change_id,
  shared_information_item_id,
  change_kind,
  source_type,
  source_id,
  changed_by_student_account_id,
  changed_at,
  timetable_change_snapshot_id
from shared_information_changes
where shared_information_item_id in (
  select shared_information_item_id from shared_information_items_new
);

drop table shared_information_changes;
drop table shared_information_items;

alter table shared_information_items_new rename to shared_information_items;
alter table shared_information_changes_new rename to shared_information_changes;

create unique index shared_information_changes_direct_source_id_unique
  on shared_information_changes(source_id)
  where source_type = 'direct';

create table active_timetable_change_slots (
  timetable_change_slot_key text primary key,
  shared_information_item_id text not null unique
    references shared_information_items(shared_information_item_id)
);

insert into active_timetable_change_slots (
  timetable_change_slot_key,
  shared_information_item_id
)
select timetable_change_slot_key, shared_information_item_id
from active_timetable_change_slots_backup;

drop table active_timetable_change_slots_backup;
