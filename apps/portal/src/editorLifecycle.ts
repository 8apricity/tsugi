export type LifecycleKind = 'add' | 'update' | 'remove'
export type EditorKind = 'timetable' | 'task' | 'note'
export type NotePlacementKind = 'task' | 'daily-lesson' | 'school-date'

export function lifecycleLabel(kind: LifecycleKind, conflicted: boolean) {
  const planned = kind === 'add'
    ? '追加予定'
    : kind === 'update'
      ? '更新予定'
      : '削除予定'
  return conflicted ? `${planned}・要確認` : planned
}

export function lifecycleTitle(kind: LifecycleKind, conflicted: boolean) {
  return conflicted
    ? 'ほかの変更と重なっています'
    : `${lifecycleLabel(kind, false)}の下書き`
}

export function editorActionLabel(kind: LifecycleKind) {
  if (kind === 'remove') return '削除予定にする'
  return kind === 'update' ? '下書きを更新' : '下書きを保存'
}

export function hasUnsavedEditorInput<T>(initial: T, current: T) {
  return JSON.stringify(initial) !== JSON.stringify(current)
}

export function immutableFieldMessage(
  kind: EditorKind,
  notePlacement: NotePlacementKind = 'school-date',
) {
  if (kind === 'task') {
    return 'タスクの変更適用範囲は変更できません。削除予定にしてから追加し直してください。'
  }
  if (kind === 'timetable') {
    return '時間割変更の日付・時限・変更適用範囲は変更できません。削除予定にしてから追加し直してください。'
  }
  if (notePlacement === 'task') {
    return 'ノートを関連付けるタスクは変更できません。削除予定にしてから追加し直してください。'
  }
  if (notePlacement === 'daily-lesson') {
    return 'ノートの日付・時限・変更適用範囲は変更できません。削除予定にしてから追加し直してください。'
  }
  return 'ノートの日付と変更適用範囲は変更できません。削除予定にしてから追加し直してください。'
}
