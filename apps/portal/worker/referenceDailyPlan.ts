import type {
  DailyPlanStore,
  StudentAccountAccessStore,
  TargetScope,
} from './persistence'
import {
  resolveStudentOperationalContext,
  type StudentOperationalContextResult,
} from './studentOperationalContext'
import { studentAffiliationIncludesTargetScope } from './targetScopePolicy'
import { isValidSchoolDate } from './timetable'
import type {
  ReferenceDailyPlanContent,
  ReferenceDailyPlanNote,
  ReferenceScopeOption,
} from '../shared/referenceDailyPlan'

type ReferenceTargetScope = Exclude<TargetScope, { type: 'student' }>

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
  const { referenceScope, schoolDate: selectedSchoolDate } = selection

  const tasks = await store.listActiveTasksForTargetScope(
    referenceScope,
    selectedSchoolDate,
  )
  const activeNotes = await store.listActiveNotesForTargetScope(
    referenceScope,
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
  task: Awaited<ReturnType<DailyPlanStore['listActiveTasksForTargetScope']>>[number],
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
  const tasks = await store.listActiveTasksForTargetScope(
    selection.referenceScope,
    selection.schoolDate,
  )
  return {
    ...selection,
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

  const schoolYear = context.currentSchoolYear.schoolYear
  const classes = await store.listClassesForSchoolYear(schoolYear)
  const tracks = await store.listTracksForSchoolYear(schoolYear)
  const classById = new Map(classes.map((schoolClass) => [
    schoolClass.classId,
    schoolClass,
  ]))
  const grades = [...new Set(classes.map((schoolClass) => schoolClass.grade))]
    .sort((left, right) => left - right)
    .filter((grade) => grade !== context.studentAffiliation.grade)
    .map((grade): ReferenceScopeOption => ({
      type: 'grade',
      value: String(grade),
      label: `${grade}年`,
    }))
  const classOptions = classes
    .filter((schoolClass) =>
      schoolClass.classId !== context.studentAffiliation.classId)
    .map((schoolClass): ReferenceScopeOption => ({
      type: 'class',
      value: schoolClass.classId,
      label: `${schoolClass.grade}年${schoolClass.classNumber}組`,
    }))
  const trackOptions = tracks
    .filter((track) => track.trackId !== context.studentAffiliation.trackId)
    .flatMap((track): ReferenceScopeOption[] => {
      const schoolClass = classById.get(track.classId)
      return schoolClass
        ? [{
            type: 'track',
            value: track.trackId,
            label: `${schoolClass.grade}年${schoolClass.classNumber}組 ${track.trackName}`,
          }]
        : []
    })

  return { status: 'ready', options: [...grades, ...classOptions, ...trackOptions] }
}

function toReferenceNote(
  note: Awaited<ReturnType<DailyPlanStore['listActiveNotesForTargetScope']>>[number],
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

  const referenceScope = await resolveReferenceScope({
    scopeType,
    scopeValue,
    schoolYear: context.currentSchoolYear.schoolYear,
    store,
  })
  if (
    referenceScope === null ||
    studentAffiliationIncludesTargetScope(
      context.studentAffiliation,
      referenceScope,
    )
  ) {
    return { status: 'invalid-reference-scope' }
  }
  return { status: 'ready', schoolDate, referenceScope }
}

async function resolveReferenceScope({
  scopeType,
  scopeValue,
  schoolYear,
  store,
}: {
  scopeType: string | null
  scopeValue: string | null
  schoolYear: number
  store: DailyPlanStore
}): Promise<ReferenceTargetScope | null> {
  if (!scopeValue) return null
  if (scopeType === 'grade') {
    const grade = Number(scopeValue)
    const classes = await store.listClassesForSchoolYear(schoolYear)
    return Number.isInteger(grade) && classes.some((item) => item.grade === grade)
      ? { type: 'grade', schoolYear, grade }
      : null
  }
  if (scopeType === 'class') {
    const schoolClass = await store.findSchoolYearClassById(scopeValue, schoolYear)
    return schoolClass ? { type: 'class', schoolYear, classId: scopeValue } : null
  }
  if (scopeType === 'track') {
    const track = await store.findTrackById(scopeValue)
    const schoolClass = track
      ? await store.findSchoolYearClassById(track.classId, schoolYear)
      : null
    return track && schoolClass
      ? { type: 'track', schoolYear, trackId: scopeValue }
      : null
  }
  return null
}
