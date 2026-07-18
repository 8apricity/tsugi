export function taskRemovalConfirmation(notes: ReadonlyArray<{ body: string }>) {
  if (notes.length === 0) return 'このタスクを削除予定にします'
  const previews = notes.map(({ body }) =>
    `・${(body.split(/\r?\n/, 1)[0] ?? '').slice(0, 80)}`)
  return `このタスクとノート${notes.length}件を削除予定にします\n\n${previews.join('\n')}`
}
