import type {
  DailyPlanStore,
  PeriodStandardTimetableEntry,
  StudentAffiliation,
  TargetScopeType,
  TimetableChangeReplacement,
} from './persistence'

export const timetableLayerOrder: TargetScopeType[] = [
  'grade',
  'class',
  'track',
  'student',
]

export type ResolvedTimetableReplacement = {
  lessonName: string
  timetableChangeState: 'resolved' | 'cancelled' | 'unresolved-reference'
}

export function selectStandardTimetableEntry(
  entries: PeriodStandardTimetableEntry[],
  trackId: string,
  periodNumber: number,
) {
  const matching = entries.filter((entry) => entry.periodNumber === periodNumber)
  return matching.find((entry) => entry.trackId === trackId) ?? matching[0] ?? null
}

export async function resolveTimetableChangeReplacement(
  replacement: TimetableChangeReplacement,
  affiliation: StudentAffiliation,
  store: DailyPlanStore,
): Promise<ResolvedTimetableReplacement> {
  if (replacement.type === 'lesson_name') {
    return { lessonName: replacement.lessonName, timetableChangeState: 'resolved' }
  }
  if (replacement.type === 'cancelled') {
    return { lessonName: '', timetableChangeState: 'cancelled' }
  }
  const entry =
    replacement.type === 'period_reference'
      ? await store.findStandardTimetableEntryForPeriodReference(
          affiliation.classId,
          affiliation.trackId,
          replacement.weekday,
          replacement.periodNumber,
        )
      : await store.findStandardTimetableEntryForFloatingReferenceLabelId(
          affiliation.classId,
          affiliation.trackId,
          replacement.floatingLessonReferenceLabelId,
        )

  return entry
    ? { lessonName: entry.lessonName, timetableChangeState: 'resolved' }
    : {
        lessonName: replacement.type === 'floating_lesson_reference' ? 'エラー' : '',
        timetableChangeState:
          replacement.type === 'floating_lesson_reference'
            ? 'unresolved-reference'
            : 'cancelled',
      }
}

export function isValidSchoolDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function weekdayForSchoolDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 ? 7 : weekday
}
