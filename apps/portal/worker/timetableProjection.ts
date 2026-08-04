import {
  projectTimetableSlot,
  type ActiveTimetableLayer,
  type DisplayTimetableReplacement,
  type TimetableProjection,
  type TimetableReference,
  type TimetableReplacement,
} from '../shared/timetableProjection'
import type {
  DailyPlanStore,
  PeriodStandardTimetableEntry,
} from './persistence'
import { weekdayForSchoolDate } from './timetable'
import type { TargetScopePolicy } from './targetScopePolicy'

export type TimetableProjectionStore = Pick<
  DailyPlanStore,
  | 'listStandardTimetableEntriesForWeekday'
  | 'findStandardTimetableEntryForFloatingReferenceLabelId'
  | 'listActiveTimetableChanges'
>

export interface TimetableProjectionModule {
  project(input: {
    scopePolicy: TargetScopePolicy
    schoolDates: readonly string[]
  }): Promise<TimetableProjection[]>
}

export function createTimetableProjectionModule({
  store,
}: {
  store: TimetableProjectionStore
}): TimetableProjectionModule {
  return {
    async project({ scopePolicy, schoolDates }) {
      const affiliation = scopePolicy.studentAffiliation
      const dates = [...new Set(schoolDates)].sort()
      if (dates.length === 0) return []

      const requestedDateSet = new Set(dates)
      const activeChanges = (
        await store.listActiveTimetableChanges(
          scopePolicy.ownReadAccess,
          dates[0],
          dates[dates.length - 1],
        )
      ).filter((change) => requestedDateSet.has(change.changeDate))
      assertUniqueActiveLayers(activeChanges)

      const weekdays = new Set(dates.map(weekdayForSchoolDate))
      for (const change of activeChanges) {
        if (change.replacement.type === 'period_reference') {
          weekdays.add(change.replacement.weekday)
        }
      }
      const standardEntriesByWeekday = new Map(
        await Promise.all([...weekdays].map(async (weekday) => [
          weekday,
          await store.listStandardTimetableEntriesForWeekday(
            affiliation.classId,
            affiliation.trackId,
            weekday,
          ),
        ] as const)),
      )
      const floatingReferences = new Map(
        await Promise.all(uniqueFloatingReferenceIds(activeChanges).map(
          async (floatingLessonReferenceLabelId) => [
            floatingLessonReferenceLabelId,
            await store.findStandardTimetableEntryForFloatingReferenceLabelId(
              affiliation.classId,
              affiliation.trackId,
              floatingLessonReferenceLabelId,
            ),
          ] as const,
        )),
      )

      const projections: TimetableProjection[] = []
      for (const schoolDate of dates) {
        const weekday = weekdayForSchoolDate(schoolDate)
        const standardEntries = standardEntriesByWeekday.get(weekday) ?? []
        for (let periodNumber = 1; periodNumber <= 7; periodNumber += 1) {
          const slotChanges = activeChanges.filter(
            (change) =>
              change.changeDate === schoolDate &&
              change.periodNumber === periodNumber,
          )
          const activeLayers = slotChanges.map((change): ActiveTimetableLayer => ({
            targetScopeType: change.targetScope.type,
            sharedInformationItemId: change.sharedInformationItemId,
            latestChangeId: change.latestChangeId,
            replacement: withFloatingReferenceLabel(
              change.replacement,
              floatingReferences,
            ),
            changedAt: change.changedAt,
          }))
          const projection = projectTimetableSlot({
            standardTimetable: {
              type: 'candidates',
              selectedTrackId: affiliation.trackId,
              periodReference: { weekday, periodNumber },
              candidates: standardEntries.filter(
                (entry) => entry.periodNumber === periodNumber,
              ),
            },
            activeLayers,
            resolveReference: (reference) => resolveReference(
              reference,
              affiliation.trackId,
              standardEntriesByWeekday,
              floatingReferences,
            ),
          })
          const activeByScope = new Map(
            activeLayers.map((layer) => [layer.targetScopeType, layer]),
          )
          projections.push({
            schoolDate,
            periodNumber,
            standardTimetable: projection.standardTimetable
              ? {
                  lessonName: projection.standardTimetable.lessonName,
                  periodReference: { weekday, periodNumber },
                }
              : null,
            layers: projection.layers.map((layer) => ({
              targetScopeType: layer.targetScopeType,
              active: activeByScope.get(layer.targetScopeType) ?? null,
              desired: null,
              projected: layer.state === 'active'
                ? { state: 'active', replacement: layer.replacement }
                : { state: 'unchanged' },
            })),
            finalDailyLesson: projection.finalDailyLesson,
          })
        }
      }
      return projections
    },
  }
}

function resolveReference(
  reference: TimetableReference,
  selectedTrackId: string,
  entriesByWeekday: ReadonlyMap<number, readonly PeriodStandardTimetableEntry[]>,
  floatingReferences: ReadonlyMap<
    string,
    Awaited<ReturnType<
      TimetableProjectionStore['findStandardTimetableEntryForFloatingReferenceLabelId']
    >>
  >,
) {
  if (reference.type === 'floating_lesson_reference') {
    return floatingReferences.get(reference.floatingLessonReferenceLabelId)
      ?.lessonName ?? null
  }
  const candidates = (entriesByWeekday.get(reference.weekday) ?? []).filter(
    (entry) => entry.periodNumber === reference.periodNumber,
  )
  return candidates.find((entry) => entry.trackId === selectedTrackId)
    ?.lessonName ?? candidates.find((entry) => entry.trackId === null)
    ?.lessonName ?? null
}

function withFloatingReferenceLabel(
  replacement: TimetableReplacement,
  floatingReferences: ReadonlyMap<
    string,
    Awaited<ReturnType<
      TimetableProjectionStore['findStandardTimetableEntryForFloatingReferenceLabelId']
    >>
  >,
): DisplayTimetableReplacement {
  if (replacement.type !== 'floating_lesson_reference') return replacement
  return {
    ...replacement,
    referenceLabel: floatingReferences.get(
      replacement.floatingLessonReferenceLabelId,
    )?.referenceLabel ?? '不明な参照',
  }
}

function uniqueFloatingReferenceIds(
  changes: readonly {
    replacement: TimetableReplacement
  }[],
) {
  return [...new Set(changes.flatMap((change) =>
    change.replacement.type === 'floating_lesson_reference'
      ? [change.replacement.floatingLessonReferenceLabelId]
      : [],
  ))]
}

function assertUniqueActiveLayers(
  changes: readonly {
    changeDate: string
    periodNumber: number
    targetScope: { type: string }
  }[],
) {
  const keys = new Set<string>()
  for (const change of changes) {
    if (!Number.isInteger(change.periodNumber) || change.periodNumber < 1 ||
      change.periodNumber > 7) {
      throw new Error('Timetable Projection received an invalid period number')
    }
    const key = [
      change.changeDate,
      change.periodNumber,
      change.targetScope.type,
    ].join(':')
    if (keys.has(key)) {
      throw new Error('Timetable Projection received duplicate active layers')
    }
    keys.add(key)
  }
}
