import type {
  DailyPlanStore,
  StudentAccountAccessStore,
  TargetScope,
} from './persistence'
import { resolveStudentOperationalContext } from './studentOperationalContext'
import { studentAffiliationIncludesTargetScope } from './targetScopePolicy'
import { isValidSchoolDate } from './timetable'

type ReferenceTargetScope = Exclude<TargetScope, { type: 'student' }>

export type ReferenceTasksResult =
  | {
      status: 'ready'
      schoolDate: string
      referenceScope: ReferenceTargetScope
      tasks: Array<{
        taskId: string
        title: string
        dueDate: string | null
        relatedLessonName?: string
        targetScopeType: ReferenceTargetScope['type']
        createdAt: number
      }>
    }
  | { status: 'unauthenticated' }
  | { status: 'invalid-reference-scope' }
  | { status: 'invalid-date' }
  | { status: 'daily-plan-unavailable' }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }

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
  const context = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore: store,
  })
  if (context.status === 'unauthenticated') return context
  if (context.status === 'school-year-unavailable') {
    return { status: 'daily-plan-unavailable' }
  }
  if (context.status === 'affiliation-renewal-needed') {
    return {
      status: context.status,
      schoolYear: context.currentSchoolYear.schoolYear,
    }
  }
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

  const tasks = await store.listActiveTasksForTargetScope(
    referenceScope,
    schoolDate,
  )
  return {
    status: 'ready',
    schoolDate,
    referenceScope,
    tasks: tasks.map((task) => ({
      taskId: task.sourceId,
      title: task.title,
      dueDate: task.dueDate,
      ...(task.relatedLessonName
        ? { relatedLessonName: task.relatedLessonName.lessonName }
        : {}),
      targetScopeType: referenceScope.type,
      createdAt: task.createdAt,
    })),
  }
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
