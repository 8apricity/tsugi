alter table shared_information_changes
  add column preceding_change_id text
  references shared_information_changes(shared_information_change_id);

update shared_information_changes as current_change
set preceding_change_id = (
  select preceding_change.shared_information_change_id
  from shared_information_changes preceding_change
  where preceding_change.shared_information_item_id =
      current_change.shared_information_item_id
    and preceding_change.rowid < current_change.rowid
  order by preceding_change.rowid desc
  limit 1
)
where current_change.change_kind in ('update', 'remove')
  and current_change.preceding_change_id is null;

create index if not exists shared_information_changes_preceding_change_idx
  on shared_information_changes(preceding_change_id);
