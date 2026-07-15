pragma foreign_keys = off;

create table task_snapshots (
  task_snapshot_id text primary key,
  title text not null,
  due_date text,
  registered_related_lesson_name_id text
    references registered_lesson_names(registered_lesson_name_id),
  related_lesson_name text,
  normalized_custom_lesson_name text,
  created_at text not null,
  check (length(title) between 1 and 120),
  check (instr(title, char(10)) = 0 and instr(title, char(13)) = 0),
  check (
    (registered_related_lesson_name_id is null and related_lesson_name is null
      and normalized_custom_lesson_name is null)
    or (registered_related_lesson_name_id is not null and related_lesson_name is null
      and normalized_custom_lesson_name is null)
    or (registered_related_lesson_name_id is null and related_lesson_name is not null
      and normalized_custom_lesson_name is not null)
  )
);

create index task_snapshots_due_date_idx on task_snapshots(due_date);
create index task_snapshots_registered_lesson_idx
  on task_snapshots(registered_related_lesson_name_id);
create index task_snapshots_custom_lesson_idx
  on task_snapshots(normalized_custom_lesson_name);

create table shared_information_items_new (
  shared_information_item_id text primary key,
  kind text not null,
  target_scope_id text not null references target_scopes(target_scope_id),
  latest_change_id text,
  current_task_snapshot_id text references task_snapshots(task_snapshot_id),
  current_timetable_change_snapshot_id text
    references timetable_change_snapshots(timetable_change_snapshot_id),
  created_by_student_account_id text not null
    references student_accounts(student_account_id),
  created_at text not null,
  removed_at text,
  check (kind in ('task', 'timetable_change')),
  check (
    (kind = 'task' and current_task_snapshot_id is not null
      and current_timetable_change_snapshot_id is null)
    or (kind = 'timetable_change' and current_task_snapshot_id is null
      and current_timetable_change_snapshot_id is not null)
  )
);

insert into shared_information_items_new (
  shared_information_item_id, kind, target_scope_id, latest_change_id,
  current_task_snapshot_id, current_timetable_change_snapshot_id,
  created_by_student_account_id, created_at, removed_at
)
select shared_information_item_id, kind, target_scope_id, latest_change_id,
       null, current_timetable_change_snapshot_id,
       created_by_student_account_id, created_at, removed_at
from shared_information_items;

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
  check (change_kind in ('add', 'update', 'remove')),
  check (source_type in ('proposal', 'direct')),
  check (
    (change_kind = 'remove' and task_snapshot_id is null
      and timetable_change_snapshot_id is null)
    or (change_kind != 'remove' and (
      (task_snapshot_id is not null and timetable_change_snapshot_id is null)
      or (task_snapshot_id is null and timetable_change_snapshot_id is not null)
    ))
  )
);

insert into shared_information_changes_new (
  shared_information_change_id, shared_information_item_id, change_kind,
  source_type, source_id, preceding_change_id,
  changed_by_student_account_id, changed_at, task_snapshot_id,
  timetable_change_snapshot_id
)
select shared_information_change_id, shared_information_item_id, change_kind,
       source_type, source_id, preceding_change_id,
       changed_by_student_account_id, changed_at, null,
       timetable_change_snapshot_id
from shared_information_changes;

create table active_timetable_change_slots_new (
  timetable_change_slot_key text primary key,
  shared_information_item_id text not null unique
    references shared_information_items_new(shared_information_item_id)
);

insert into active_timetable_change_slots_new
select timetable_change_slot_key, shared_information_item_id
from active_timetable_change_slots;

drop table active_timetable_change_slots;
drop table shared_information_changes;
drop table shared_information_items;

alter table shared_information_items_new rename to shared_information_items;
alter table shared_information_changes_new rename to shared_information_changes;
alter table active_timetable_change_slots_new rename to active_timetable_change_slots;

create unique index shared_information_changes_direct_source_id_unique
  on shared_information_changes(source_id)
  where source_type = 'direct';
create index shared_information_changes_preceding_change_idx
  on shared_information_changes(preceding_change_id);

pragma foreign_keys = on;
