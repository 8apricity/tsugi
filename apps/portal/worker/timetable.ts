import type {
  DailyPlanStore,
  StudentAffiliation,
} from './persistence'
import type {
  TimetableReference,
  TimetableReplacement,
} from '../shared/timetableProjection'

export type DisplayTimetableReplacement =
  | Exclude<TimetableReplacement, { type: 'floating_lesson_reference' }>
  | (Extract<
      TimetableReplacement,
      { type: 'floating_lesson_reference' }
    > & { referenceLabel: string })

export async function withTimetableReferenceLabel(
  replacement: TimetableReplacement,
  affiliation: StudentAffiliation,
  store: DailyPlanStore,
): Promise<DisplayTimetableReplacement> {
  if (replacement.type !== 'floating_lesson_reference') return replacement
  const entry = await store.findStandardTimetableEntryForFloatingReferenceLabelId(
    affiliation.classId,
    affiliation.trackId,
    replacement.floatingLessonReferenceLabelId,
  )
  return {
    ...replacement,
    referenceLabel: entry?.referenceLabel ?? '不明な参照',
  }
}

export async function createTimetableReferenceResolver(
  replacements: readonly TimetableReplacement[],
  affiliation: StudentAffiliation,
  store: DailyPlanStore,
): Promise<(reference: TimetableReference) => string | null> {
  const references = replacements.filter(
    (replacement): replacement is TimetableReference =>
      replacement.type === 'period_reference' ||
      replacement.type === 'floating_lesson_reference',
  )
  const resolvedReferences = new Map(
    await Promise.all(
      references.map(async (reference) => [
        timetableReferenceKey(reference),
        await resolveTimetableReference(reference, affiliation, store),
      ] as const),
    ),
  )
  return (reference) =>
    resolvedReferences.get(timetableReferenceKey(reference)) ?? null
}

async function resolveTimetableReference(
  reference: TimetableReference,
  affiliation: StudentAffiliation,
  store: DailyPlanStore,
): Promise<string | null> {
  const entry =
    reference.type === 'period_reference'
      ? await store.findStandardTimetableEntryForPeriodReference(
          affiliation.classId,
          affiliation.trackId,
          reference.weekday,
          reference.periodNumber,
        )
      : await store.findStandardTimetableEntryForFloatingReferenceLabelId(
          affiliation.classId,
          affiliation.trackId,
          reference.floatingLessonReferenceLabelId,
        )
  return entry?.lessonName ?? null
}

function timetableReferenceKey(reference: TimetableReference) {
  return reference.type === 'period_reference'
    ? `period:${reference.weekday}:${reference.periodNumber}`
    : `floating:${reference.floatingLessonReferenceLabelId}`
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
