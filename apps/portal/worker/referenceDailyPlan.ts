import type {
  DailyPlanStore,
  StudentAccountAccessStore,
} from './persistence'
import {
  resolveStudentOperationalContext,
  type StudentOperationalContextResult,
} from './studentOperationalContext'
import {
  createTargetScopePolicy,
  type ReferenceTargetScope,
  type ReferenceTargetScopeAccess,
} from './targetScopePolicy'
import { isValidSchoolDate } from './timetable'
import type {
  ReferenceDailyPlanContent,
  ReferenceDailyPlanNote,
  ReferenceScopeOption,
} from '../shared/referenceDailyPlan'

export type ReferenceDailyPlanResult =
  | {
      status: 'ready'
      schoolDate: string
      referenceScope: ReferenceTargetScope
      tasks: ReferenceDailyPlanContent['tasks']
      periods: ReferenceDailyPlanContent['periods']
      notes: ReferenceDailyPlanContent['notes']
    }
  | { status: 'unauthenticated' }
  | { status: 'invalid-reference-scope' }
  | { status: 'invalid-date' }
  | { status: 'daily-plan-unavailable' }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }

export async function readReferenceDailyPlan({
  sessionToken,
  schoolDate,
  scopeType,
  scopeValue,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  schoolDate: string | null
  scopeType: string | null
  scopeValue: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DailyPlanStore
}): Promise<ReferenceDailyPlanResult> {
  const selection = await resolveReferenceRequest({
    sessionToken,
    schoolDate,
    scopeType,
    scopeValue,
    now,
    studentAccountStore,
    store,
  })
  if (selection.status !== 'ready') return selection
  const {
    referenceScope,
    referenceScopeAccess,
    schoolDate: selectedSchoolDate,
  } = selection

  const tasks = await store.listActiveTasks(
    referenceScopeAccess,
    selectedSchoolDate,
    selectedSchoolDate,
  )
  const activeNotes = await store.listActiveNotes(
    referenceScopeAccess,
    selectedSchoolDate,
    selectedSchoolDate,
  )
  return {
    status: 'ready',
    schoolDate: selectedSchoolDate,
    referenceScope,
    tasks: tasks.map((task) => ({
      taskId: task.sharedInformationItemId,
      ...toReferenceTaskFields(task, referenceScope.type),
      notes: activeNotes
        .filter((note) =>
          note.relatedTaskItemId === task.sharedInformationItemId)
        .map(toReferenceNote),
    })),
    periods: Array.from({ length: 7 }, (_, index) => ({
      periodNumber: index + 1,
      notes: activeNotes
        .filter((note) =>
          note.relatedTaskItemId === undefined &&
          note.schoolDate === selectedSchoolDate &&
          note.periodNumber === index + 1)
        .map(toReferenceNote),
    })),
    notes: activeNotes
      .filter((note) =>
        note.relatedTaskItemId === undefined &&
        note.periodNumber === null)
      .map(toReferenceNote),
  }
}

function toReferenceTaskFields(
  task: Awaited<ReturnType<DailyPlanStore['listActiveTasks']>>[number],
  targetScopeType: ReferenceTargetScope['type'],
) {
  return {
    title: task.title,
    dueDate: task.dueDate,
    ...(task.relatedLessonName
      ? { relatedLessonName: task.relatedLessonName.lessonName }
      : {}),
    targetScopeType,
    createdAt: task.createdAt,
  }
}

export type ReferenceTasksResult =
  | {
      status: 'ready'
      schoolDate: string
      referenceScope: ReferenceTargetScope
      tasks: Array<Omit<ReferenceDailyPlanContent['tasks'][number], 'notes'>>
    }
  | Exclude<ReferenceDailyPlanResult, { status: 'ready' }>

export async function readReferenceTasks({
  sessionToken,
  schoolDate,
  scopeType,
  scopeValue,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  schoolDate: string | null
  scopeType: string | null
  scopeValue: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DailyPlanStore
}): Promise<ReferenceTasksResult> {
  const selection = await resolveReferenceRequest({
    sessionToken,
    schoolDate,
    scopeType,
    scopeValue,
    now,
    studentAccountStore,
    store,
  })
  if (selection.status !== 'ready') return selection
  const tasks = await store.listActiveTasks(
    selection.referenceScopeAccess,
    selection.schoolDate,
    selection.schoolDate,
  )
  return {
    status: 'ready',
    schoolDate: selection.schoolDate,
    referenceScope: selection.referenceScope,
    tasks: tasks.map((task) => ({
      taskId: task.sourceId,
      ...toReferenceTaskFields(task, selection.referenceScope.type),
    })),
  }
}

export type ReferenceScopeOptionsResult =
  | { status: 'ready'; options: ReferenceScopeOption[] }
  | { status: 'unauthenticated' }
  | { status: 'daily-plan-unavailable' }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }

type ReferenceOperationalContextResult =
  | Extract<StudentOperationalContextResult, { status: 'ready' }>
  | Exclude<ReferenceScopeOptionsResult, { status: 'ready' }>

async function resolveReferenceOperationalContext({
  sessionToken,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DailyPlanStore
}): Promise<ReferenceOperationalContextResult> {
  const context = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore: store,
  })
  if (context.status === 'school-year-unavailable') {
    return { status: 'daily-plan-unavailable' }
  }
  if (context.status === 'affiliation-renewal-needed') {
    return {
      status: context.status,
      schoolYear: context.currentSchoolYear.schoolYear,
    }
  }
  return context
}

export async function readReferenceScopeOptions({
  sessionToken,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DailyPlanStore
}): Promise<ReferenceScopeOptionsResult> {
  const context = await resolveReferenceOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    store,
  })
  if (context.status !== 'ready') return context

  const choices = await createTargetScopePolicy(context.studentAffiliation)
    .listReferenceScopes(store)
  return {
    status: 'ready',
    options: choices.map((choice): ReferenceScopeOption => {
      if (!('classNumber' in choice)) {
        return {
          type: 'grade',
          value: String(choice.targetScope.grade),
          label: `${choice.targetScope.grade}年`,
        }
      }
      if (!('trackName' in choice)) {
        return {
          type: 'class',
          value: choice.targetScope.classId,
          label: `${choice.grade}年${choice.classNumber}組`,
        }
      }
      return {
        type: 'track',
        value: choice.targetScope.trackId,
        label: `${choice.grade}年${choice.classNumber}組 ${choice.trackName}`,
      }
    }),
  }
}

function toReferenceNote(
  note: Awaited<ReturnType<DailyPlanStore['listActiveNotes']>>[number],
): ReferenceDailyPlanNote {
  return {
    noteId: note.sharedInformationItemId,
    body: note.body,
    targetScopeType: note.targetScope.type as ReferenceTargetScope['type'],
    relatedContext: note.relatedTaskItemId
      ? { type: 'task', taskId: note.relatedTaskItemId }
      : note.schoolDate === null
        ? null
        : note.periodNumber === null
          ? { type: 'school-date', schoolDate: note.schoolDate }
          : {
              type: 'daily-lesson',
              schoolDate: note.schoolDate,
              periodNumber: note.periodNumber,
            },
  }
}

type ReferenceRequestSelection =
  | {
      status: 'ready'
      schoolDate: string
      referenceScope: ReferenceTargetScope
      referenceScopeAccess: ReferenceTargetScopeAccess
    }
  | Exclude<ReferenceDailyPlanResult, { status: 'ready' }>

async function resolveReferenceRequest({
  sessionToken,
  schoolDate,
  scopeType,
  scopeValue,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  schoolDate: string | null
  scopeType: string | null
  scopeValue: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DailyPlanStore
}): Promise<ReferenceRequestSelection> {
  const context = await resolveReferenceOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    store,
  })
  if (context.status !== 'ready') return context
  if (
    schoolDate === null ||
    !isValidSchoolDate(schoolDate) ||
    schoolDate < context.currentSchoolYear.startsOn ||
    schoolDate > context.currentSchoolYear.endsOn
  ) {
    return { status: 'invalid-date' }
  }

  const referenceScopeAccess = await createTargetScopePolicy(
    context.studentAffiliation,
  ).resolveReferenceScope({ type: scopeType, value: scopeValue }, store)
  if (referenceScopeAccess === null) {
    return { status: 'invalid-reference-scope' }
  }
  return {
    status: 'ready',
    schoolDate,
    referenceScope: referenceScopeAccess.targetScope,
    referenceScopeAccess,
  }
}
