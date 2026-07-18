export function taskRemovalCascadeDetails(
  notes: ReadonlyArray<{ body: string }>,
) {
  return {
    consequence: notes.length === 0
      ? 'このタスクだけが削除予定になります。'
      : `関連するノート${notes.length}件も削除予定になります。`,
    previews: notes.map(({ body }) =>
      (body.split(/\r?\n/, 1)[0] ?? '').slice(0, 80)),
  }
}
