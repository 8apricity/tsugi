import { NoteCard } from './noteCard'

export type TaskNoteListItem = {
  noteId: string
  body: string
  draft?: boolean
  changeKind?: 'add' | 'update' | 'remove'
  conflicted?: boolean
  onCancelDraft?: () => void
  onEdit?: () => void
  onRemove?: () => void
  onOpenHistory?: () => void
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
