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
  lessonReference?: TimetableReference
  timetableChangeState:
    | 'unchanged'
    | 'resolved'
    | 'cancelled'
    | 'unresolved-reference'
}

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
  | { targetScopeType: TargetScopeType; state: 'unchanged' }
  | {
      targetScopeType: TargetScopeType
      state: 'unchanged'
      origin: 'desired'
      desiredChange: 'remove'
    }
  | {
      targetScopeType: TargetScopeType
      state: 'active'
      origin: 'active' | 'desired'
      replacement: TimetableReplacement
    }

export type StandardTimetableProjectionInput =
  | {
      type: 'candidates'
      selectedTrackId: string
      periodReference?: { weekday: number; periodNumber: number }
      candidates: readonly {
        trackId: string | null
        lessonName: string
      }[]
    }
  | {
      type: 'selected'
      lessonName: string
      periodReference?: { weekday: number; periodNumber: number }
    }
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
    ...(standardTimetable?.periodReference
      ? {
          lessonReference: {
            type: 'period_reference' as const,
            ...standardTimetable.periodReference,
          },
        }
      : {}),
    timetableChangeState: 'unchanged',
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
      })
      continue
    }
    const activeLayer = activeLayersByScope.get(targetScopeType)
    const replacement = desiredLayer?.change === 'replace'
      ? desiredLayer.replacement
      : activeLayer?.replacement
    if (!replacement) {
      layers.push({ targetScopeType, state: 'unchanged' })
      continue
    }
    finalDailyLesson = resolveReplacement(replacement, resolveReference)
    layers.push({
      targetScopeType,
      replacement,
      state: 'active',
      origin: desiredLayer ? 'desired' : 'active',
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
): {
  lessonName: string
  periodReference?: { weekday: number; periodNumber: number }
} | null {
  if (!input) return null
  if (input.type === 'selected') {
    return input.lessonName === ''
      ? null
      : {
          lessonName: input.lessonName,
          ...(input.periodReference
            ? { periodReference: input.periodReference }
            : {}),
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
        ...(input.periodReference
          ? { periodReference: input.periodReference }
          : {}),
      }
    : null
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
    return {
      lessonName,
      lessonReference: replacement,
      timetableChangeState: 'resolved',
    }
  }
  return replacement.type === 'floating_lesson_reference'
    ? {
        lessonName: 'エラー',
        lessonReference: replacement,
        timetableChangeState: 'unresolved-reference',
      }
    : {
        lessonName: '',
        lessonReference: replacement,
        timetableChangeState: 'cancelled',
      }
}
