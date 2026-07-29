import type { ReactNode } from 'react'
import { NoteCard } from './noteCard'
import { taskRemovalCascadeDetails } from './taskNoteCopy'
import { ConfirmationDialog } from './dialogFoundation'

export type TaskNoteListItem = {
  noteId: string
  body: string
  draft?: boolean
  changeKind?: 'add' | 'update' | 'remove'
  conflicted?: boolean
  removalReason?: 'task-cascade'
  onOpen?: () => void
  onCancelDraft?: () => void
  onEdit?: () => void
  onRemove?: () => void
  onOpenHistory?: () => void
}

export function TaskNoteList({
  notes,
  presentation = 'daily-plan',
  onOpenRelatedNote,
  wrapDraftCancellation,
}: {
  notes: TaskNoteListItem[]
  presentation?: 'daily-plan' | 'detail'
  onOpenRelatedNote?: () => void
  wrapDraftCancellation?: (
    note: TaskNoteListItem,
    content: ReactNode,
  ) => ReactNode
}) {
  if (notes.length === 0) return null
  return (
    <div className={`task-note-list${
      presentation === 'detail' ? ' task-note-detail-list' : ''
    }`}>
      {notes.map((note) => {
        const card = (
          <NoteCard
          key={note.noteId}
          {...note}
          onCancelDraft={wrapDraftCancellation ? undefined : note.onCancelDraft}
          presentation={presentation === 'daily-plan' ? 'related' : 'independent'}
          onOpen={note.removalReason === 'task-cascade'
            ? undefined
            : note.onOpen ?? onOpenRelatedNote}
          showChevron={presentation === 'detail' && Boolean(note.onOpen)}
        />
        )
        return note.draft && note.onCancelDraft && wrapDraftCancellation
          ? wrapDraftCancellation(note, card)
          : card
      })}
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
  if (notes.length === 0) return null

  const details = taskRemovalCascadeDetails(notes)

  return (
    <ConfirmationDialog
      active
      title="タスクを削除予定にしますか？"
      description={(
        <>
          <p className="task-removal-confirmation-title">{taskTitle}</p>
          <p>{details.consequence}</p>
          {details.previews.length > 0 ? (
            <ul
              className="task-removal-confirmation-notes"
              aria-label="削除予定のノート"
            >
              {details.previews.map((preview, index) => (
                <li key={`${index}:${preview}`}>{preview}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      tone="danger"
      cancelLabel="キャンセル"
      confirmLabel="削除予定にする"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
