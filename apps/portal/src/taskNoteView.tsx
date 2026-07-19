import { NoteCard } from './noteCard'
import { taskRemovalCascadeDetails } from './taskNoteCopy'
import { DialogBody } from './dialogFoundation'

export type TaskNoteListItem = {
  noteId: string
  body: string
  draft?: boolean
  changeKind?: 'add' | 'update' | 'remove'
  conflicted?: boolean
  removalReason?: 'task-cascade'
  onCancelDraft?: () => void
  onEdit?: () => void
  onRemove?: () => void
  onOpenHistory?: () => void
  onOpenDetail?: () => void
  wholeCardDetailTarget?: boolean
  related?: boolean
}

export function TaskNoteList({ notes }: { notes: TaskNoteListItem[] }) {
  if (notes.length === 0) return null
  return (
    <div className="task-note-list">
      {notes.map((note) => (
        <NoteCard
          key={note.noteId}
          {...note}
        />
      ))}
    </div>
  )
}

export function TaskRemovalConfirmationDialog({
  taskTitle,
  notes,
  onCancel,
  onConfirm,
}: {
  taskTitle: string
  notes: ReadonlyArray<{ body: string }>
  onCancel: () => void
  onConfirm: () => void
}) {
  const details = taskRemovalCascadeDetails(notes)

  return (
    <div className="editor-dialog-backdrop" role="presentation">
      <section
        className="timetable-editor-dialog task-removal-confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-removal-confirmation-title"
      >
        <header className="editor-dialog-header">
          <h2 id="task-removal-confirmation-title">タスクを削除予定にしますか？</h2>
        </header>
        <DialogBody>
          <div className="task-removal-confirmation-content">
            <p className="task-removal-confirmation-title">{taskTitle}</p>
            {details.consequence ? <p>{details.consequence}</p> : null}
            {details.previews.length > 0 ? (
              <ul className="task-removal-confirmation-notes" aria-label="削除予定のノート">
                {details.previews.map((preview, index) => (
                  <li key={`${index}:${preview}`}>{preview}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="editor-dialog-actions task-removal-confirmation-actions">
            <button className="button-secondary" type="button" onClick={onCancel}>
              キャンセル
            </button>
            <button className="button-danger" type="button" onClick={onConfirm}>
              削除予定にする
            </button>
          </div>
        </DialogBody>
      </section>
    </div>
  )
}
