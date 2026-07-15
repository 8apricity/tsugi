import type { TargetScopeType } from './targetScope'

export type TaskHistorySnapshot = {
  title: string
  dueDate: string | null
  relatedLessonName: string | null
}

type TaskEditHistoryEntryBase = {
  sharedInformationChangeId: string
  changeKind: 'add' | 'update' | 'remove'
  changedAt: number
  before: TaskHistorySnapshot | null
  after: TaskHistorySnapshot | null
}

export type TaskEditHistoryEntry = TaskEditHistoryEntryBase & (
  | { sourceType: 'direct'; primaryActorDisplayName: string }
  | { sourceType: 'proposal'; primaryActorDisplayName?: never }
)

export type TaskEditHistoryResponse = {
  status: 'ready'
  taskId: string
  targetScope: { type: TargetScopeType; value: string }
  entries: TaskEditHistoryEntry[]
}
