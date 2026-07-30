import type {
  TimetableReplacement,
} from '../../shared/timetableProjection'
import type { TargetScope } from '../targetScopePolicy'
import type {
  ChangeSource,
  PersistenceIds,
} from './atomicProgram'

type MaterializedChangeBase = {
  source: ChangeSource
  sharedInformationItemId: string
  latestChangeId: string
  persistenceIds: PersistenceIds
  targetScope: TargetScope
  changedByStudentAccountId: string
  changedAt: number
}

export type MaterializedTimetableChange = MaterializedChangeBase & {
  kind: 'timetable_change'
  changeDate: string
  periodNumber: number
} & (
  | {
      changeKind: 'add'
      replacement: TimetableReplacement
    }
  | {
      changeKind: 'update'
      replacement: TimetableReplacement
      expectedLatestChangeId: string
    }
  | {
      changeKind: 'remove'
      expectedLatestChangeId: string
    }
)

export type MaterializedTaskLessonName = {
  lessonName: string
  registeredLessonNameId?: string
}

export type MaterializedTaskChange = MaterializedChangeBase & {
  kind: 'task'
} & (
  | {
      changeKind: 'add'
      title: string
      dueDate: string | null
      relatedLessonName: MaterializedTaskLessonName | null
      createdAt: number
    }
  | {
      changeKind: 'update'
      title: string
      dueDate: string | null
      relatedLessonName: MaterializedTaskLessonName | null
      expectedLatestChangeId: string
    }
  | {
      changeKind: 'remove'
      expectedLatestChangeId: string
      cascade: {
        type: 'remove-active-task-notes'
        cause: {
          type: 'task-cascade'
          causedByChangeId: string
        }
      }
    }
)

export type MaterializedNoteChange = MaterializedChangeBase & {
  kind: 'note'
} & (
  | {
      changeKind: 'add'
      schoolDate: string | null
      periodNumber: number | null
      relatedTaskItemId?: string
      body: string
      createdAt: number
    }
  | {
      changeKind: 'update'
      body: string
      expectedLatestChangeId: string
    }
  | {
      changeKind: 'remove'
      expectedLatestChangeId: string
      removalReason: 'student' | 'task_cascade'
      causedByChangeId?: string
    }
)

export type MaterializedSharedInformationChange =
  | MaterializedTimetableChange
  | MaterializedTaskChange
  | MaterializedNoteChange

export type ActiveTimetableChangeState = {
  sharedInformationItemId: string
  latestChangeId: string
  targetScope: TargetScope
  changeDate: string
  periodNumber: number
}

export type ActiveTaskState = {
  sharedInformationItemId: string
  latestChangeId: string
  targetScope: TargetScope
}

export type ActiveNoteState = {
  sharedInformationItemId: string
  latestChangeId: string
  targetScope: TargetScope
  relatedTaskItemId?: string
}

export type StudentAffiliationState = {
  studentAffiliationId: string
  studentAccountId: string
  schoolYear: number
  grade: number
  classId: string
  trackId: string
  selectedAt: number
  endedAt: number | null
}
