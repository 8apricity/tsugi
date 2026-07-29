import type { ReactNode } from 'react'
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
  wrapDraftCancellation,
}: {
  notes: DailyLessonNoteListItem[]
  className?: string
  presentation?: 'related' | 'detail'
  onOpenRelatedNote?: () => void
  wrapDraftCancellation?: (
    note: DailyLessonNoteListItem,
    content: ReactNode,
  ) => ReactNode
}) {
  if (notes.length === 0) return null
  return (
    <div className={className} aria-label="この時限のノート">
      {notes.map((note) => {
        const card = (
          <NoteCard
          key={note.noteId}
          {...note}
          onCancelDraft={wrapDraftCancellation ? undefined : note.onCancelDraft}
          presentation={presentation === 'related' ? 'related' : 'independent'}
          onOpen={note.onOpen ?? onOpenRelatedNote}
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
