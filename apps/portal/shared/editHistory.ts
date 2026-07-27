import type { NoteHistorySnapshot } from './noteEditHistory'
import type { TargetScopeType } from './targetScope'
import type { TaskHistorySnapshot } from './taskEditHistory'
import type { TimetableReplacement } from './timetableProjection'

export type TimetableHistorySnapshot =
  | Exclude<TimetableReplacement, { type: 'floating_lesson_reference' }>
  | (
      Extract<TimetableReplacement, { type: 'floating_lesson_reference' }>
      & { referenceLabel: string }
    )

export type SharedInformationChangeSource =
  | {
      type: 'direct'
      primaryActorDisplayName: string
    }
  | {
      type: 'proposal'
    }

type SharedInformationChangeDetailBase = {
  status: 'ready'
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changeKind: 'add' | 'update' | 'remove'
  source: SharedInformationChangeSource
  changedAt: number
  targetScope: {
    type: TargetScopeType
    value: string
  }
}

export type TimetableChangeDetail =
  & SharedInformationChangeDetailBase
  & {
    kind: 'timetable_change'
    changeDate: string
    periodNumber: number
    before: TimetableHistorySnapshot | null
    after: TimetableHistorySnapshot | null
  }

export type TaskChangeDetail =
  & SharedInformationChangeDetailBase
  & {
    kind: 'task'
    before: TaskHistorySnapshot | null
    after: TaskHistorySnapshot | null
  }

export type NoteChangeDetail =
  & SharedInformationChangeDetailBase
  & {
    kind: 'note'
    before: NoteHistorySnapshot | null
    after: NoteHistorySnapshot | null
    removalReason?: 'student' | 'task_cascade'
  }

export type SharedInformationChangeDetail =
  | TimetableChangeDetail
  | TaskChangeDetail
  | NoteChangeDetail
