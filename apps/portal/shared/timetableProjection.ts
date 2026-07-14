import {
  targetScopeTypesBroadToNarrow,
  type TargetScopeType,
} from './targetScope'

export type { TargetScopeType } from './targetScope'

export type TimetableReplacement =
  | { type: 'lesson_name'; lessonName: string }
  | { type: 'period_reference'; weekday: number; periodNumber: number }
  | { type: 'floating_lesson_reference'; floatingLessonReferenceLabelId: string }
  | { type: 'cancelled' }

export type TimetableReference = Extract<
  TimetableReplacement,
  { type: 'period_reference' | 'floating_lesson_reference' }
>

export type ProjectedDailyLesson = {
  lessonName: string
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
      candidates: readonly {
        trackId: string | null
        lessonName: string
      }[]
    }
  | { type: 'selected'; lessonName: string }
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
): { lessonName: string } | null {
  if (!input) return null
  if (input.type === 'selected') {
    return input.lessonName === '' ? null : { lessonName: input.lessonName }
  }
  const candidates = input.candidates.filter(
    (candidate) => candidate.lessonName !== '',
  )
  const selected = candidates.find(
    (candidate) => candidate.trackId === input.selectedTrackId,
  ) ?? candidates.find((candidate) => candidate.trackId === null)
  return selected ? { lessonName: selected.lessonName } : null
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
