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

export type DisplayTimetableReplacement =
  | Exclude<TimetableReplacement, { type: 'floating_lesson_reference' }>
  | (Extract<
      TimetableReplacement,
      { type: 'floating_lesson_reference' }
    > & { referenceLabel: string })

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

export type ActiveTimetableLayer = {
  targetScopeType: TargetScopeType
  sharedInformationItemId: string
  latestChangeId: string
  replacement: DisplayTimetableReplacement
  changedAt: number
}

export type EffectiveTimetableLayer =
  | { state: 'unchanged' }
  | { state: 'active'; replacement: TimetableReplacement }

export type TimetableProjectionLayer = {
  targetScopeType: TargetScopeType
  active: ActiveTimetableLayer | null
  desired: DesiredTimetableLayer | null
  projected: EffectiveTimetableLayer
}

export type TimetableProjection = {
  schoolDate: string
  periodNumber: number
  standardTimetable: {
    lessonName: string
    periodReference: { weekday: number; periodNumber: number }
  } | null
  layers: TimetableProjectionLayer[]
  finalDailyLesson: ProjectedDailyLesson
}

export type TimetableReferenceCatalog = {
  periodReferences: readonly {
    weekday: number
    periodNumber: number
    lessonName: string | null
  }[]
  floatingLessonReferences: readonly {
    floatingLessonReferenceLabelId: string
    referenceLabel: string
    lessonName: string | null
  }[]
}

export function previewTimetableProjection({
  activeProjection,
  desiredLayers,
  referenceCatalog,
}: {
  activeProjection: TimetableProjection
  desiredLayers: readonly DesiredTimetableLayer[]
  referenceCatalog: TimetableReferenceCatalog
}): TimetableProjection {
  assertUniqueDesiredLayers(desiredLayers)
  const desiredByScope = new Map(desiredLayers.map((layer) => [
    layer.targetScopeType,
    withReferenceLabel(layer, referenceCatalog),
  ]))
  const activeLayers = activeProjection.layers.flatMap((layer) =>
    layer.active
      ? [{
          targetScopeType: layer.targetScopeType,
          replacement: layer.active.replacement,
        }]
      : [],
  )
  const projected = projectTimetableSlot({
    standardTimetable: activeProjection.standardTimetable
      ? {
          type: 'selected',
          lessonName: activeProjection.standardTimetable.lessonName,
          periodReference: activeProjection.standardTimetable.periodReference,
        }
      : null,
    activeLayers,
    desiredLayers: [...desiredByScope.values()],
    resolveReference: (reference) => resolveFromCatalog(
      reference,
      referenceCatalog,
    ),
  })
  const projectedByScope = new Map(
    projected.layers.map((layer) => [layer.targetScopeType, layer]),
  )
  return {
    ...activeProjection,
    layers: activeProjection.layers.map((layer) => {
      const effective = projectedByScope.get(layer.targetScopeType)
      return {
        ...layer,
        desired: desiredByScope.get(layer.targetScopeType) ?? null,
        projected: effective?.state === 'active'
          ? { state: 'active', replacement: effective.replacement }
          : { state: 'unchanged' },
      }
    }),
    finalDailyLesson: projected.finalDailyLesson,
  }
}

function resolveFromCatalog(
  reference: TimetableReference,
  catalog: TimetableReferenceCatalog,
) {
  if (reference.type === 'period_reference') {
    return catalog.periodReferences.find((entry) =>
      entry.weekday === reference.weekday &&
      entry.periodNumber === reference.periodNumber)
      ?.lessonName ?? null
  }
  return catalog.floatingLessonReferences.find((entry) =>
    entry.floatingLessonReferenceLabelId ===
      reference.floatingLessonReferenceLabelId)
    ?.lessonName ?? null
}

function withReferenceLabel(
  layer: DesiredTimetableLayer,
  catalog: TimetableReferenceCatalog,
): DesiredTimetableLayer {
  if (
    layer.change !== 'replace' ||
    layer.replacement.type !== 'floating_lesson_reference'
  ) return layer
  const replacement = layer.replacement
  return {
    ...layer,
    replacement: {
      ...replacement,
      referenceLabel: catalog.floatingLessonReferences.find((entry) =>
        entry.floatingLessonReferenceLabelId ===
          replacement.floatingLessonReferenceLabelId)
        ?.referenceLabel ?? replacement.referenceLabel ?? '不明な参照',
    },
  }
}

function assertUniqueDesiredLayers(layers: readonly DesiredTimetableLayer[]) {
  const scopes = new Set<TargetScopeType>()
  for (const layer of layers) {
    if (scopes.has(layer.targetScopeType)) {
      throw new Error('Timetable Projection received duplicate desired layers')
    }
    scopes.add(layer.targetScopeType)
  }
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
  assertValidPeriodReference(standardTimetableInput?.periodReference)
  for (const layer of activeLayers) {
    assertValidReplacementReference(layer.replacement)
  }
  for (const layer of desiredLayers) {
    if (layer.change === 'replace') {
      assertValidReplacementReference(layer.replacement)
    }
  }
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

function assertValidReplacementReference(replacement: TimetableReplacement) {
  if (replacement.type === 'period_reference') {
    assertValidPeriodReference(replacement)
  }
}

function assertValidPeriodReference(
  reference: { periodNumber: number } | undefined,
) {
  if (
    reference &&
    (!Number.isInteger(reference.periodNumber) ||
      reference.periodNumber < 1 ||
      reference.periodNumber > 7)
  ) {
    throw new Error('Timetable Projection received an invalid Period Reference')
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
