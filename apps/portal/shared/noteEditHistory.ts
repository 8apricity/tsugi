import type { TargetScopeType } from './targetScope'

export type NoteHistorySnapshot = { body: string }

export type NoteEditHistoryEntry = {
  sharedInformationChangeId: string
  changeKind: 'add' | 'update' | 'remove'
  sourceType: 'direct'
  primaryActorDisplayName: string
  changedAt: number
  before: NoteHistorySnapshot | null
  after: NoteHistorySnapshot | null
  removalReason?: 'student' | 'task_cascade'
}

export type NoteEditHistoryResponse = {
  status: 'ready'
  noteId: string
  targetScope: { type: TargetScopeType; value: string }
  entries: NoteEditHistoryEntry[]
}
