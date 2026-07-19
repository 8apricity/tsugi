import {
  targetScopeTypesBroadToNarrow,
  type TargetScopeType,
} from './targetScope'

export type { TargetScopeType } from './targetScope'

export type TimetableReplacement =
  | {
      type: 'lesson_name'
      lessonName: string
      registeredLessonNameId?: string
    }
  | { type: 'period_reference'; weekday: number; periodNumber: number }
  | {
      type: 'floating_lesson_reference'
      floatingLessonReferenceLabelId: string
      referenceLabel?: string
    }
  | { type: 'cancelled' }

export type TimetableReference = Extract<
  TimetableReplacement,
  { type: 'period_reference' | 'floating_lesson_reference' }
>

export function timetableReplacementsEqual(
  left: TimetableReplacement,
  right: TimetableReplacement,
) {
  if (left.type !== right.type) return false
  if (left.type === 'cancelled') return true
  if (left.type === 'lesson_name' && right.type === 'lesson_name') {
    return left.registeredLessonNameId || right.registeredLessonNameId
      ? left.registeredLessonNameId === right.registeredLessonNameId
      : left.lessonName === right.lessonName
  }
  if (left.type === 'period_reference' && right.type === 'period_reference') {
    return left.weekday === right.weekday &&
      left.periodNumber === right.periodNumber
  }
  return left.type === 'floating_lesson_reference' &&
    right.type === 'floating_lesson_reference' &&
    left.floatingLessonReferenceLabelId ===
      right.floatingLessonReferenceLabelId
}

export type ProjectedDailyLesson = {
  lessonName: string
  timetableChangeState:
    | 'unchanged'
    | 'resolved'
    | 'cancelled'
    | 'unresolved-reference'
}

export type TimetableLessonSource =
  | { type: 'period_reference'; weekday: number; periodNumber: number }
  | { type: 'floating_lesson_reference'; referenceLabel: string | null }

export type DesiredTimetableLayer =
  | {
      targetScopeType: TargetScopeType
      change: 'replace'
      replacement: TimetableReplacement
    }
  | {
      targetScopeType: TargetScopeType
      change: 'remove'
    }

export type ProjectedTimetableLayer =
  | {
      targetScopeType: TargetScopeType
      state: 'unchanged'
      effectiveLessonName: string
      effectiveLessonSource: TimetableLessonSource | null
    }
  | {
      targetScopeType: TargetScopeType
      state: 'unchanged'
      origin: 'desired'
      desiredChange: 'remove'
      effectiveLessonName: string
      effectiveLessonSource: TimetableLessonSource | null
    }
  | {
      targetScopeType: TargetScopeType
      state: 'active'
      origin: 'active' | 'desired'
      replacement: TimetableReplacement
      effectiveLessonName: string
      effectiveLessonSource: TimetableLessonSource | null
    }

export type StandardTimetableProjectionInput =
  | {
      type: 'candidates'
      selectedTrackId: string
      candidates: readonly {
        trackId: string | null
        lessonName: string
        source?: TimetableLessonSource
      }[]
    }
  | { type: 'selected'; lessonName: string; source?: TimetableLessonSource }
  | null

export function projectTimetableSlot({
  standardTimetable: standardTimetableInput,
  activeLayers,
  desiredLayers = [],
  resolveReference,
}: {
  standardTimetable: StandardTimetableProjectionInput
  activeLayers: readonly {
    targetScopeType: TargetScopeType
    replacement: TimetableReplacement
  }[]
  desiredLayers?: readonly DesiredTimetableLayer[]
  resolveReference(
    reference: TimetableReference,
  ): string | null
}) {
  const standardTimetable = selectStandardTimetable(standardTimetableInput)
  const activeLayersByScope = new Map(
    activeLayers.map((layer) => [layer.targetScopeType, layer]),
  )
  const desiredLayersByScope = new Map(
    desiredLayers.map((layer) => [layer.targetScopeType, layer]),
  )
  let finalDailyLesson: ProjectedDailyLesson = {
    lessonName: standardTimetable?.lessonName ?? '',
    timetableChangeState: 'unchanged',
  }
  let effectiveLesson = {
    lessonName: standardTimetable?.lessonName ?? '',
    source: standardTimetable?.source ?? null,
  }
  const layers: ProjectedTimetableLayer[] = []
  for (const targetScopeType of targetScopeTypesBroadToNarrow) {
    const desiredLayer = desiredLayersByScope.get(targetScopeType)
    if (desiredLayer?.change === 'remove') {
      layers.push({
        targetScopeType,
        state: 'unchanged',
        origin: 'desired',
        desiredChange: 'remove',
        effectiveLessonName: effectiveLesson.lessonName,
        effectiveLessonSource: effectiveLesson.source,
      })
      continue
    }
    const activeLayer = activeLayersByScope.get(targetScopeType)
    const replacement = desiredLayer?.change === 'replace'
      ? desiredLayer.replacement
      : activeLayer?.replacement
    if (!replacement) {
      layers.push({
        targetScopeType,
        state: 'unchanged',
        effectiveLessonName: effectiveLesson.lessonName,
        effectiveLessonSource: effectiveLesson.source,
      })
      continue
    }
    finalDailyLesson = resolveReplacement(replacement, resolveReference)
    effectiveLesson = {
      lessonName: finalDailyLesson.lessonName,
      source: replacementSource(replacement),
    }
    layers.push({
      targetScopeType,
      replacement,
      state: 'active',
      origin: desiredLayer ? 'desired' : 'active',
      effectiveLessonName: effectiveLesson.lessonName,
      effectiveLessonSource: effectiveLesson.source,
    })
  }

  return {
    standardTimetable,
    layers,
    finalDailyLesson,
  }
}

function selectStandardTimetable(
  input: StandardTimetableProjectionInput,
): { lessonName: string; source?: TimetableLessonSource } | null {
  if (!input) return null
  if (input.type === 'selected') {
    return input.lessonName === ''
      ? null
      : {
          lessonName: input.lessonName,
          ...(input.source ? { source: input.source } : {}),
        }
  }
  const candidates = input.candidates.filter(
    (candidate) => candidate.lessonName !== '',
  )
  const selected = candidates.find(
    (candidate) => candidate.trackId === input.selectedTrackId,
  ) ?? candidates.find((candidate) => candidate.trackId === null)
  return selected
    ? {
        lessonName: selected.lessonName,
        ...(selected.source ? { source: selected.source } : {}),
      }
    : null
}

function replacementSource(
  replacement: TimetableReplacement,
): TimetableLessonSource | null {
  if (replacement.type === 'period_reference') {
    return {
      type: 'period_reference',
      weekday: replacement.weekday,
      periodNumber: replacement.periodNumber,
    }
  }
  if (replacement.type === 'floating_lesson_reference') {
    return {
      type: 'floating_lesson_reference',
      referenceLabel: replacement.referenceLabel ?? null,
    }
  }
  return null
}

function resolveReplacement(
  replacement: TimetableReplacement,
  resolveReference: (reference: TimetableReference) => string | null,
): ProjectedDailyLesson {
  if (replacement.type === 'lesson_name') {
    return { lessonName: replacement.lessonName, timetableChangeState: 'resolved' }
  }
  if (replacement.type === 'cancelled') {
    return { lessonName: '', timetableChangeState: 'cancelled' }
  }
  const lessonName = resolveReference(replacement)
  if (lessonName !== null) {
    return { lessonName, timetableChangeState: 'resolved' }
  }
  return replacement.type === 'floating_lesson_reference'
    ? { lessonName: 'エラー', timetableChangeState: 'unresolved-reference' }
    : { lessonName: '', timetableChangeState: 'cancelled' }
}
