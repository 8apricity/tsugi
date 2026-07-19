import { NoteCard } from './noteCard'

export type DailyLessonNoteListItem = {
  noteId: string
  body: string
  targetScopeLabel?: string
  draft?: boolean
  changeKind?: 'add' | 'update' | 'remove'
  conflicted?: boolean
  onOpen?: () => void
  onCancelDraft?: () => void
  onEdit?: () => void
  onRemove?: () => void
  onOpenHistory?: () => void
}

export function DailyLessonNoteList({
  notes,
  className = 'daily-lesson-note-list',
  presentation = 'related',
  onOpenRelatedNote,
}: {
  notes: DailyLessonNoteListItem[]
  className?: string
  presentation?: 'related' | 'detail'
  onOpenRelatedNote?: () => void
}) {
  if (notes.length === 0) return null
  return (
    <div className={className} aria-label="この時限のノート">
      {notes.map((note) => (
        <NoteCard
          key={note.noteId}
          {...note}
          presentation={presentation === 'related' ? 'related' : 'independent'}
          onOpen={note.onOpen ?? onOpenRelatedNote}
          showChevron={presentation === 'detail' && Boolean(note.onOpen)}
        />
      ))}
    </div>
  )
}
