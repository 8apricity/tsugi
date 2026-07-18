import { NoteCard } from './noteCard'

export type DailyLessonNoteListItem = {
  noteId: string
  body: string
  targetScopeLabel: string
  draft?: boolean
  changeKind?: 'add' | 'update' | 'remove'
  conflicted?: boolean
  onCancelDraft?: () => void
  onEdit?: () => void
  onRemove?: () => void
  onOpenHistory?: () => void
  onOpenDetail?: () => void
  wholeCardDetailTarget?: boolean
  related?: boolean
}

export function DailyLessonNoteList({
  notes,
  className = 'daily-lesson-note-list',
}: {
  notes: DailyLessonNoteListItem[]
  className?: string
}) {
  if (notes.length === 0) return null
  return (
    <div className={className} aria-label="この時限のノート">
      {notes.map((note) => (
        <NoteCard key={note.noteId} {...note} />
      ))}
    </div>
  )
}
