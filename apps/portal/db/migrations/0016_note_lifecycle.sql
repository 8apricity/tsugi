pragma foreign_keys = off;

create table note_snapshots_new (
  note_snapshot_id text primary key,
  body text not null,
  related_context_type text not null,
  related_school_date text,
  related_period_number integer,
  related_task_item_id text references shared_information_items_new(shared_information_item_id),
  created_at text not null,
  check (length(trim(body)) between 1 and 1000),
  check (
    (related_context_type = 'none' and related_school_date is null
      and related_period_number is null and related_task_item_id is null)
    or (related_context_type = 'school_date'
      and related_school_date is not null
      and related_period_number is null and related_task_item_id is null)
  )
);

create table shared_information_items_new (
  shared_information_item_id text primary key,
  kind text not null,
  target_scope_id text not null references target_scopes(target_scope_id),
  latest_change_id text,
  current_task_snapshot_id text references task_snapshots(task_snapshot_id),
  current_timetable_change_snapshot_id text
    references timetable_change_snapshots(timetable_change_snapshot_id),
  current_note_snapshot_id text references note_snapshots_new(note_snapshot_id),
  created_by_student_account_id text not null
    references student_accounts(student_account_id),
  created_at text not null,
  removed_at text,
  check (kind in ('task', 'timetable_change', 'note')),
  check (
    (kind = 'task' and current_task_snapshot_id is not null
      and current_timetable_change_snapshot_id is null
      and current_note_snapshot_id is null)
    or (kind = 'timetable_change' and current_task_snapshot_id is null
      and current_timetable_change_snapshot_id is not null
      and current_note_snapshot_id is null)
    or (kind = 'note' and current_task_snapshot_id is null
      and current_timetable_change_snapshot_id is null
      and current_note_snapshot_id is not null)
  )
);

insert into note_snapshots_new
select * from note_snapshots;

insert into shared_information_items_new
select * from shared_information_items;

create table shared_information_changes_new (
  shared_information_change_id text primary key,
  shared_information_item_id text not null
    references shared_information_items_new(shared_information_item_id),
  change_kind text not null,
  source_type text not null,
  source_id text,
  preceding_change_id text
    references shared_information_changes_new(shared_information_change_id),
  changed_by_student_account_id text not null
    references student_accounts(student_account_id),
  changed_at text not null,
  task_snapshot_id text references task_snapshots(task_snapshot_id),
  timetable_change_snapshot_id text
    references timetable_change_snapshots(timetable_change_snapshot_id),
  note_snapshot_id text references note_snapshots_new(note_snapshot_id),
  removal_reason text,
  check (change_kind in ('add', 'update', 'remove')),
  check (source_type in ('proposal', 'direct')),
  check (removal_reason is null or removal_reason in ('student', 'task_cascade')),
  check (change_kind = 'remove' or removal_reason is null),
  check (
    (change_kind = 'remove' and task_snapshot_id is null
      and timetable_change_snapshot_id is null and note_snapshot_id is null)
    or (change_kind != 'remove' and (
      (task_snapshot_id is not null and timetable_change_snapshot_id is null
        and note_snapshot_id is null)
      or (task_snapshot_id is null and timetable_change_snapshot_id is not null
        and note_snapshot_id is null)
      or (task_snapshot_id is null and timetable_change_snapshot_id is null
        and note_snapshot_id is not null)
    ))
  )
);

insert into shared_information_changes_new (
  shared_information_change_id, shared_information_item_id, change_kind,
  source_type, source_id, preceding_change_id,
  changed_by_student_account_id, changed_at, task_snapshot_id,
  timetable_change_snapshot_id, note_snapshot_id, removal_reason
)
select shared_information_change_id, shared_information_item_id, change_kind,
       source_type, source_id, preceding_change_id,
       changed_by_student_account_id, changed_at, task_snapshot_id,
       timetable_change_snapshot_id, note_snapshot_id, null
from shared_information_changes;

create table active_timetable_change_slots_new (
  timetable_change_slot_key text primary key,
  shared_information_item_id text not null unique
    references shared_information_items_new(shared_information_item_id)
);

insert into active_timetable_change_slots_new
select * from active_timetable_change_slots;

drop table active_timetable_change_slots;
drop table shared_information_changes;
drop table shared_information_items;
drop table note_snapshots;

alter table note_snapshots_new rename to note_snapshots;
alter table shared_information_items_new rename to shared_information_items;
alter table shared_information_changes_new rename to shared_information_changes;
alter table active_timetable_change_slots_new rename to active_timetable_change_slots;

create index note_snapshots_school_date_idx
  on note_snapshots(related_school_date);
create unique index shared_information_changes_direct_source_id_unique
  on shared_information_changes(source_id)
  where source_type = 'direct';
create index shared_information_changes_preceding_change_idx
  on shared_information_changes(preceding_change_id);

pragma foreign_keys = on;
