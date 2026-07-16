import {
  projectTimetableSlot,
  timetableReplacementsEqual,
  type DesiredTimetableLayer,
  type TargetScopeType as ProjectionTargetScopeType,
  type TimetableReference as ProjectionTimetableReference,
  type TimetableReplacement as ProjectionTimetableReplacement,
} from '../shared/timetableProjection'
import { isTargetScopeType } from '../shared/targetScope'

export type TargetScopeType = ProjectionTargetScopeType
export type TimetableReference = ProjectionTimetableReference
export type TimetableReplacement =
  | Exclude<
      ProjectionTimetableReplacement,
      { type: 'floating_lesson_reference' }
    >
  | (Extract<
      ProjectionTimetableReplacement,
      { type: 'floating_lesson_reference' }
    > & { referenceLabel: string })

export type TimetableLayerKey = {
  targetScopeType: TargetScopeType
  changeDate: string
  periodNumber: number
}

type TimetableChangeDraftBase = TimetableLayerKey & {
  sourceId: string
}

export type TimetableChangeDraft = TimetableChangeDraftBase & (
  | {
      changeKind: 'add'
      replacement: TimetableReplacement
      sharedInformationItemId?: never
      expectedLatestChangeId?: never
      serverReplacement?: never
    }
  | {
      changeKind: 'update'
      replacement: TimetableReplacement
      sharedInformationItemId: string
      expectedLatestChangeId: string
      serverReplacement: TimetableReplacement
    }
  | {
      changeKind: 'remove'
      replacement?: never
      sharedInformationItemId: string
      expectedLatestChangeId: string
      serverReplacement: TimetableReplacement
    }
)

export type TaskRelatedLessonName = {
  lessonName: string
  registeredLessonNameId?: string
}

export type NewTaskDraftForm = {
  title: string
  dueDate: string | null
  relatedLessonName: TaskRelatedLessonName | null
  targetScopeType: TargetScopeType | null
}

type TaskSnapshotDraft = Omit<NewTaskDraftForm, 'targetScopeType'>

export type ActiveTaskForEditing = TaskSnapshotDraft & {
  taskId: string
  latestChangeId: string
  targetScopeType: TargetScopeType
}

type TaskDraftBase = TaskSnapshotDraft & {
  sourceId: string
  targetScopeType: TargetScopeType
}

export type TaskDraft = TaskDraftBase & (
  | {
      changeKind: 'add'
      sharedInformationItemId?: never
      expectedLatestChangeId?: never
    }
  | {
      changeKind: 'update' | 'remove'
      sharedInformationItemId: string
      expectedLatestChangeId: string
    }
)

export type TimetableLayerState = {
  status: 'ready'
  schoolDate: string
  periodNumber: number
  standardTimetable: {
    periodReference: { weekday: number; periodNumber: number }
    lessonName: string
  } | null
  layers: Array<
    | { targetScopeType: TargetScopeType; state: 'unchanged' }
    | {
        targetScopeType: TargetScopeType
        state: 'active'
        sharedInformationItemId: string
        latestChangeId: string
        replacement: TimetableReplacement
        changedAt: number
      }
  >
  finalDailyLesson: {
    lessonName: string
    timetableChangeState:
      | 'unchanged'
      | 'resolved'
      | 'cancelled'
      | 'unresolved-reference'
  }
}

type StorageLike = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
type DesiredStateInput = TimetableLayerKey & { replacement: TimetableReplacement }

type TimetableSubmissionChangeBase = TimetableLayerKey & { sourceId: string }

export type TimetableSubmissionChange = TimetableSubmissionChangeBase & (
  | { changeKind: 'add'; replacement: Readonly<TimetableReplacement> }
  | {
      changeKind: 'update'
      replacement: Readonly<TimetableReplacement>
      sharedInformationItemId: string
      expectedLatestChangeId: string
    }
  | {
      changeKind: 'remove'
      sharedInformationItemId: string
      expectedLatestChangeId: string
    }
)

type TaskSubmissionChangeBase = {
  kind: 'task'
  sourceId: string
  targetScopeType: TargetScopeType
}

export type TaskSubmissionChange = TaskSubmissionChangeBase & (
  | {
      changeKind: 'remove'
      sharedInformationItemId: string
      expectedLatestChangeId: string
    }
  | {
      changeKind: 'add' | 'update'
      title: string
      dueDate: string | null
      relatedLessonName?: {
        registeredLessonNameId?: string
        lessonName?: string
      }
      sharedInformationItemId?: string
      expectedLatestChangeId?: string
    }
)

export type DirectSubmissionChange =
  | TimetableSubmissionChange
  | TaskSubmissionChange

export type TimetableSubmissionPreview = Readonly<{
  changes: readonly Readonly<DirectSubmissionChange>[]
}>

type TimetableSubmissionFreshnessInput =
  | { type: 'applied'; affectedKeys: readonly TimetableLayerKey[] }
  | { type: 'remote-conflict'; conflictingKeys: readonly TimetableLayerKey[] }

export type TimetableSubmissionFreshnessEffect =
  TimetableSubmissionFreshnessInput & { signal: AbortSignal }

export type DirectTimetableSubmissionTransportResult =
  | { status: 'applied' }
  | {
      status: 'remote-conflict' | 'idempotency-conflict'
      conflictingKeys: readonly TimetableLayerKey[]
      conflictingSourceIds?: readonly string[]
    }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }
  | { status: 'rejected' }

export type SubmitDirectTimetableChanges = (
  payload: Readonly<{ changes: readonly DirectSubmissionChange[] }>,
) => Promise<DirectTimetableSubmissionTransportResult>

type SubmitCurrentBatchOptions = {
  confirmSubmission(
    preview: TimetableSubmissionPreview,
  ): boolean | Promise<boolean>
  applyFreshness(
    effect: TimetableSubmissionFreshnessEffect,
  ): 'refreshed' | 'stale' | Promise<'refreshed' | 'stale'>
}

const storageKey = 'tsugi:timetable-direct-add-drafts:v1'
const maximumDraftKeys = 50

export function createNewTaskDraftForm(schoolDate: string): NewTaskDraftForm {
  return {
    title: '',
    dueDate: schoolDate,
    relatedLessonName: null,
    targetScopeType: null,
  }
}

export function normalizeDirectLessonReplacement(
  lessonName: string,
): TimetableReplacement {
  const trimmed = lessonName.trim()
  const normalized = trimmed.replace(/\s+/g, '')
  const reference = normalized.match(/^([月火水木金土])([1-7])$/)

  if (reference) {
    return {
      type: 'period_reference',
      weekday: '月火水木金土'.indexOf(reference[1]) + 1,
      periodNumber: Number(reference[2]),
    }
  }

  return { type: 'lesson_name', lessonName: trimmed }
}

export function createTimetableEditorClient({
  storage,
  createId = () => crypto.randomUUID(),
  submitDirectTimetableChanges,
}: {
  storage: StorageLike
  createId?: () => string
  submitDirectTimetableChanges: SubmitDirectTimetableChanges
}) {
  const restored = restore(storage)
  let editing = restored.editing
  let lastTargetScopeType = restored.lastTargetScopeType
  let drafts = restored.drafts
  let taskDrafts = restored.taskDrafts
  let lastCommitFailed = false
  let submitting = false
  let lifecycleGeneration = 0
  let activeFreshnessController: AbortController | null = null
  const loadedServerLayers = new Map<
    string,
    TimetableLayerState['layers'][number]
  >()
  const conflictKeys = new Set<string>()
  const taskConflictSourceIds = new Set(restored.taskConflictSourceIds)
  const stickyConflictKeys = new Set<string>()
  const reconciledKeys = new Set<string>()
  let snapshot = buildSnapshot()
  const listeners = new Set<() => void>()

  function buildSnapshot() {
    return {
      editing,
      lastTargetScopeType,
      drafts: drafts.map((draft) => ({
        ...draft,
        conflicted: conflictKeys.has(draftKey(draft)),
      })),
      taskDrafts: taskDrafts.map((draft) => ({
        ...draft,
        conflicted: taskConflictSourceIds.has(draft.sourceId),
      })),
      draftCount: drafts.length + taskDrafts.length,
      atLimit: drafts.length + taskDrafts.length >= maximumDraftKeys,
      conflictCount: conflictKeys.size + taskConflictSourceIds.size,
      unreconciledDrafts: drafts
        .filter((draft) => !reconciledKeys.has(draftKey(draft)))
        .map(({ targetScopeType, changeDate, periodNumber }) => ({
          targetScopeType,
          changeDate,
          periodNumber,
        })),
      lastCommitFailed,
      submitting,
      draftDates: [...new Set([
        ...drafts.map((draft) => draft.changeDate),
        ...taskDrafts.flatMap((draft) => draft.dueDate ? [draft.dueDate] : []),
      ])].sort(),
    }
  }

  function publish() {
    snapshot = buildSnapshot()
    storage.setItem(
      storageKey,
      JSON.stringify({
        editing,
        lastTargetScopeType,
        drafts,
        taskDrafts,
        taskConflictSourceIds: [...taskConflictSourceIds],
      }),
    )
    listeners.forEach((listener) => listener())
  }

  function removeDraftByKey(key: string) {
    const next = drafts.filter((draft) => draftKey(draft) !== key)
    const removed = next.length !== drafts.length
    drafts = next
    return removed
  }

  function commitPayload(
    batch: readonly TimetableChangeDraft[] = drafts,
    taskBatch: readonly TaskDraft[] = taskDrafts,
  ) {
    return {
      changes: [
        ...batch.map(toTimetableSubmissionChange),
        ...taskBatch.map(toTaskSubmissionChange),
      ],
    }
  }

  function clearEditorState() {
    editing = false
    drafts = []
    taskDrafts = []
    lastCommitFailed = false
    conflictKeys.clear()
    taskConflictSourceIds.clear()
    stickyConflictKeys.clear()
    reconciledKeys.clear()
    lastTargetScopeType = 'track'
    storage.removeItem(storageKey)
    snapshot = buildSnapshot()
    listeners.forEach((listener) => listener())
  }

  function recordCommitFailure(
    conflictingKeys: readonly TimetableLayerKey[] = [],
    conflictingSourceIds: readonly string[] = [],
    sticky = false,
    refreshPending = false,
  ) {
    submitting = refreshPending
    lastCommitFailed = true
    conflictingKeys.forEach((key) => {
      const serializedKey = draftKey(key)
      conflictKeys.add(serializedKey)
      if (sticky) stickyConflictKeys.add(serializedKey)
      reconciledKeys.delete(serializedKey)
    })
    conflictingSourceIds.forEach((sourceId) => {
      if (taskDrafts.some((draft) => draft.sourceId === sourceId)) {
        taskConflictSourceIds.add(sourceId)
      }
    })
    publish()
  }

  async function applyFreshnessSafely(
    adapter: SubmitCurrentBatchOptions['applyFreshness'],
    effect: TimetableSubmissionFreshnessInput,
  ) {
    const controller = new AbortController()
    activeFreshnessController = controller
    try {
      return await adapter({ ...effect, signal: controller.signal })
    } catch {
      return 'stale' as const
    } finally {
      if (activeFreshnessController === controller) {
        activeFreshnessController = null
      }
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
    enterEditing() {
      if (submitting) return { status: 'submission-in-progress' as const }
      editing = true
      publish()
      return { status: 'editing' as const }
    },
    shouldConfirmExit() {
      return drafts.length + taskDrafts.length > 0
    },
    discard() {
      if (submitting) return { status: 'submission-in-progress' as const }
      clearEditorState()
      return { status: 'discarded' as const }
    },
    reset() {
      lifecycleGeneration += 1
      submitting = false
      activeFreshnessController?.abort()
      activeFreshnessController = null
      loadedServerLayers.clear()
      clearEditorState()
    },
    reconcileLayerState(state: TimetableLayerState) {
      applyLayerState(state)
      publish()
    },
    reconcileLayerStates(states: TimetableLayerState[]) {
      states.forEach(applyLayerState)
      publish()
    },
    setDesiredState(input: DesiredStateInput) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const key = draftKey(input)
      const existing = drafts.find((draft) => draftKey(draft) === key)
      const serverLayer = loadedServerLayers.get(key)
      const serverReplacement = existing?.serverReplacement ??
        (serverLayer?.state === 'active' ? serverLayer.replacement : undefined)
      if (
        serverReplacement &&
        timetableReplacementsEqual(input.replacement, serverReplacement)
      ) {
        if (removeDraftByKey(key)) {
          conflictKeys.delete(key)
          stickyConflictKeys.delete(key)
          publish()
        }
        return { status: 'removed-noop' as const }
      }
      if (!existing && drafts.length + taskDrafts.length >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }

      const sourceId = existing?.sourceId ?? createId()
      const operation = existing
        ? existing.changeKind === 'update' || existing.changeKind === 'remove'
          ? {
              changeKind: 'update' as const,
              sharedInformationItemId: existing.sharedInformationItemId,
              expectedLatestChangeId: existing.expectedLatestChangeId,
              serverReplacement: existing.serverReplacement,
            }
          : { changeKind: 'add' as const }
        : serverLayer?.state === 'active'
          ? {
              changeKind: 'update' as const,
              sharedInformationItemId: serverLayer.sharedInformationItemId,
              expectedLatestChangeId: serverLayer.latestChangeId,
              serverReplacement: serverLayer.replacement,
            }
          : { changeKind: 'add' as const }
      drafts = drafts.filter((draft) => draftKey(draft) !== key)
      drafts.push({ ...input, ...operation, sourceId })
      if (serverLayer) reconciledKeys.add(key)
      lastTargetScopeType = input.targetScopeType
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    saveTaskDraft(input: NewTaskDraftForm) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const snapshot = normalizeTaskSnapshot(input)
      if (!input.targetScopeType || !snapshot) {
        return { status: 'invalid-task' as const }
      }
      if (drafts.length + taskDrafts.length >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const sourceId = createId()
      taskDrafts.push({
        sourceId,
        changeKind: 'add',
        ...snapshot,
        targetScopeType: input.targetScopeType,
      })
      lastTargetScopeType = input.targetScopeType
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    saveTaskUpdateDraft(
      activeTask: ActiveTaskForEditing,
      input: TaskSnapshotDraft,
    ) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const snapshot = normalizeTaskSnapshot(input)
      if (!snapshot) return { status: 'invalid-task' as const }
      const existing = taskDrafts.find(
        (draft) =>
          draft.changeKind !== 'add' &&
          draft.sharedInformationItemId === activeTask.taskId,
      )
      if (!existing && drafts.length + taskDrafts.length >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const sourceId = existing?.sourceId ?? createId()
      taskDrafts = taskDrafts.filter((draft) => draft.sourceId !== sourceId)
      taskDrafts.push({
        sourceId,
        changeKind: 'update',
        sharedInformationItemId: activeTask.taskId,
        expectedLatestChangeId: activeTask.latestChangeId,
        targetScopeType: activeTask.targetScopeType,
        ...snapshot,
      })
      taskConflictSourceIds.delete(sourceId)
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    saveTaskRemoveDraft(activeTask: ActiveTaskForEditing) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const existing = taskDrafts.find(
        (draft) =>
          draft.changeKind !== 'add' &&
          draft.sharedInformationItemId === activeTask.taskId,
      )
      if (!existing && drafts.length + taskDrafts.length >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const sourceId = existing?.sourceId ?? createId()
      taskDrafts = taskDrafts.filter((draft) => draft.sourceId !== sourceId)
      taskDrafts.push({
        sourceId,
        changeKind: 'remove',
        sharedInformationItemId: activeTask.taskId,
        expectedLatestChangeId: activeTask.latestChangeId,
        targetScopeType: activeTask.targetScopeType,
        title: activeTask.title,
        dueDate: activeTask.dueDate,
        relatedLessonName: activeTask.relatedLessonName,
      })
      taskConflictSourceIds.delete(sourceId)
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    removeTaskDraft(sourceId: string) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const next = taskDrafts.filter((draft) => draft.sourceId !== sourceId)
      if (next.length === taskDrafts.length) {
        return { status: 'unchanged' as const }
      }
      taskDrafts = next
      taskConflictSourceIds.delete(sourceId)
      publish()
      return { status: 'removed' as const }
    },
    removeDesiredState(keyInput: TimetableLayerKey) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const { targetScopeType } = keyInput
      const key = draftKey(keyInput)
      const existing = drafts.find((draft) => draftKey(draft) === key)
      const serverLayer = loadedServerLayers.get(key)
      if (serverLayer?.state !== 'active') {
        return { status: 'not-active' as const }
      }
      if (!existing && drafts.length + taskDrafts.length >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const sourceId = existing?.sourceId ?? createId()
      drafts = drafts.filter((draft) => draftKey(draft) !== key)
      drafts.push({
        ...keyInput,
        changeKind: 'remove',
        sourceId,
        sharedInformationItemId: serverLayer.sharedInformationItemId,
        expectedLatestChangeId: serverLayer.latestChangeId,
        serverReplacement: serverLayer.replacement,
      })
      reconciledKeys.add(key)
      conflictKeys.delete(key)
      stickyConflictKeys.delete(key)
      lastTargetScopeType = targetScopeType
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    restoreServerState(
      targetScopeType: TargetScopeType,
      changeDate: string,
      periodNumber: number,
    ) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const key = draftKey({ targetScopeType, changeDate, periodNumber })
      if (removeDraftByKey(key)) {
        conflictKeys.delete(key)
        stickyConflictKeys.delete(key)
        reconciledKeys.delete(key)
        publish()
        return { status: 'removed-noop' as const }
      }
      return { status: 'unchanged' as const }
    },
    findDraft(
      targetScopeType: TargetScopeType,
      changeDate: string,
      periodNumber: number,
    ) {
      const draft = drafts.find(
        (draft) =>
          draft.targetScopeType === targetScopeType &&
          draft.changeDate === changeDate &&
          draft.periodNumber === periodNumber,
      )
      return draft
        ? { ...draft, conflicted: conflictKeys.has(draftKey(draft)) }
        : undefined
    },
    isLessonEdited(changeDate: string, periodNumber: number) {
      return drafts.some(
        (draft) =>
          draft.changeDate === changeDate && draft.periodNumber === periodNumber,
      )
    },
    previewLayerState(
      state: TimetableLayerState,
      resolveReference: (reference: TimetableReference) => string | null,
    ) {
      const slotDrafts = drafts.filter(
        (draft) =>
          draft.changeDate === state.schoolDate &&
          draft.periodNumber === state.periodNumber,
      )
      const desiredLayers: DesiredTimetableLayer[] = slotDrafts.map((draft) =>
        draft.changeKind === 'remove'
          ? { targetScopeType: draft.targetScopeType, change: 'remove' }
          : {
              targetScopeType: draft.targetScopeType,
              change: 'replace',
              replacement: draft.replacement,
            },
      )
      const projection = projectTimetableSlot({
        standardTimetable: state.standardTimetable
          ? { type: 'selected', lessonName: state.standardTimetable.lessonName }
          : null,
        activeLayers: state.layers.flatMap((layer) =>
          layer.state === 'active'
            ? [{
                targetScopeType: layer.targetScopeType,
                replacement: layer.replacement,
              }]
            : [],
        ),
        desiredLayers,
        resolveReference,
      })
      const projectedLayers = new Map(
        projection.layers.map((layer) => [layer.targetScopeType, layer]),
      )
      const layers = state.layers.map((layer) => {
        const draft = slotDrafts.find(
          (candidate) => candidate.targetScopeType === layer.targetScopeType,
        )
        const projectedLayer = projectedLayers.get(layer.targetScopeType)
        if (
          projectedLayer?.state === 'unchanged' &&
          'origin' in projectedLayer &&
          projectedLayer.origin === 'desired' &&
          draft
        ) {
          return {
            targetScopeType: layer.targetScopeType,
            state: 'unchanged' as const,
            desired: true,
            removalPlanned: true,
            conflicted: conflictKeys.has(draftKey(draft)),
          }
        }
        if (projectedLayer?.state === 'active') {
          const replacement = draft && draft.changeKind !== 'remove'
            ? draft.replacement
            : layer.state === 'active'
              ? layer.replacement
              : undefined
          if (!replacement) {
            return { ...layer, desired: false, conflicted: false }
          }
          return {
            ...layer,
            state: 'active' as const,
            replacement,
            desired: !!draft,
            conflicted: draft ? conflictKeys.has(draftKey(draft)) : false,
          }
        }
        return { ...layer, desired: false, conflicted: false }
      })
      return {
        ...state,
        layers,
        finalDailyLesson: slotDrafts.length > 0
          ? projection.finalDailyLesson
          : state.finalDailyLesson,
      }
    },
    async submitCurrentBatch({
      confirmSubmission,
      applyFreshness,
    }: SubmitCurrentBatchOptions) {
      if (submitting) return { status: 'already-submitting' as const }
      if (conflictKeys.size + taskConflictSourceIds.size > 0) {
        return { status: 'local-conflict' as const }
      }
      if (drafts.length + taskDrafts.length === 0) {
        return { status: 'empty' as const }
      }

      const generation = lifecycleGeneration
      const batch = drafts.map((draft) => ({ ...draft }))
      const taskBatch = taskDrafts.map((draft) => ({ ...draft }))
      const payload = commitPayload(batch, taskBatch)
      const preview = Object.freeze({
        changes: Object.freeze(
          payload.changes.map((change) => Object.freeze(change)),
        ),
      })
      submitting = true
      publish()

      let confirmed: boolean
      try {
        confirmed = await confirmSubmission(preview)
      } catch {
        if (generation !== lifecycleGeneration) {
          return { status: 'cancelled' as const }
        }
        submitting = false
        publish()
        return { status: 'rejected' as const }
      }
      if (generation !== lifecycleGeneration) {
        return { status: 'cancelled' as const }
      }
      if (!confirmed) {
        submitting = false
        publish()
        return { status: 'cancelled' as const }
      }

      let transportResult: DirectTimetableSubmissionTransportResult
      try {
        transportResult = await submitDirectTimetableChanges(payload)
      } catch {
        if (generation !== lifecycleGeneration) {
          return { status: 'cancelled' as const }
        }
        submitting = false
        lastCommitFailed = true
        publish()
        return { status: 'network-error' as const }
      }
      if (generation !== lifecycleGeneration) {
        return { status: 'cancelled' as const }
      }
      if (transportResult.status !== 'applied') {
        if (
          transportResult.status === 'remote-conflict' ||
          transportResult.status === 'idempotency-conflict'
        ) {
          const { conflictingKeys, conflictingSourceIds = [] } = transportResult
          const idempotencyConflict =
            transportResult.status === 'idempotency-conflict'
          recordCommitFailure(
            conflictingKeys,
            conflictingSourceIds,
            idempotencyConflict,
            true,
          )
          if (generation !== lifecycleGeneration) {
            return { status: 'cancelled' as const }
          }
          const freshness = await applyFreshnessSafely(applyFreshness, {
            type: 'remote-conflict',
            conflictingKeys,
          })
          if (generation !== lifecycleGeneration) {
            return { status: 'cancelled' as const }
          }
          submitting = false
          publish()
          return {
            status: idempotencyConflict
              ? 'idempotency-conflict' as const
              : 'remote-conflict' as const,
            freshness,
          }
        }
        if (transportResult.status === 'affiliation-renewal-needed') {
          recordCommitFailure()
          return {
            status: 'affiliation-renewal-needed' as const,
            schoolYear: transportResult.schoolYear,
          }
        }
        recordCommitFailure()
        return { status: 'rejected' as const }
      }

      editing = false
      drafts = []
      taskDrafts = []
      lastCommitFailed = false
      conflictKeys.clear()
      taskConflictSourceIds.clear()
      stickyConflictKeys.clear()
      reconciledKeys.clear()
      storage.removeItem(storageKey)
      snapshot = buildSnapshot()
      listeners.forEach((listener) => listener())
      if (generation !== lifecycleGeneration) {
        return { status: 'cancelled' as const }
      }
      const freshness = await applyFreshnessSafely(
        applyFreshness,
        {
          type: 'applied',
          affectedKeys: payload.changes.flatMap((change) =>
            'changeDate' in change
              ? [{
                  targetScopeType: change.targetScopeType,
                  changeDate: change.changeDate,
                  periodNumber: change.periodNumber,
                }]
              : [],
          ),
        },
      )
      if (generation !== lifecycleGeneration) {
        return { status: 'cancelled' as const }
      }
      submitting = false
      publish()
      return { status: 'applied' as const, freshness }
    },
  }

  function applyLayerState(state: TimetableLayerState) {
      for (const layer of state.layers) {
        const key = draftKey({
          targetScopeType: layer.targetScopeType,
          changeDate: state.schoolDate,
          periodNumber: state.periodNumber,
        })
        loadedServerLayers.set(key, layer)
        reconciledKeys.add(key)
        const draft = drafts.find((candidate) => draftKey(candidate) === key)
        if (!draft) {
          conflictKeys.delete(key)
          continue
        }
        const conflicted = draft.changeKind === 'add'
          ? layer.state === 'active'
          : layer.state !== 'active' ||
            layer.sharedInformationItemId !== draft.sharedInformationItemId ||
            layer.latestChangeId !== draft.expectedLatestChangeId
        if (conflicted || stickyConflictKeys.has(key)) conflictKeys.add(key)
        else conflictKeys.delete(key)
      }
    }
}

function draftKey(
  draft: TimetableLayerKey,
) {
  return `${draft.targetScopeType}:${draft.changeDate}:${draft.periodNumber}`
}

function toTimetableSubmissionChange(
  draft: TimetableChangeDraft,
): TimetableSubmissionChange {
  const base = {
    sourceId: draft.sourceId,
    targetScopeType: draft.targetScopeType,
    changeDate: draft.changeDate,
    periodNumber: draft.periodNumber,
  }
  if (draft.changeKind === 'remove') {
    return {
      ...base,
      changeKind: draft.changeKind,
      sharedInformationItemId: draft.sharedInformationItemId,
      expectedLatestChangeId: draft.expectedLatestChangeId,
    }
  }
  const replacement = Object.freeze({ ...draft.replacement })
  if (draft.changeKind === 'update') {
    return {
      ...base,
      changeKind: draft.changeKind,
      replacement,
      sharedInformationItemId: draft.sharedInformationItemId,
      expectedLatestChangeId: draft.expectedLatestChangeId,
    }
  }
  return { ...base, changeKind: draft.changeKind, replacement }
}

function toTaskSubmissionChange(draft: TaskDraft): TaskSubmissionChange {
  const base = {
    kind: 'task',
    sourceId: draft.sourceId,
    targetScopeType: draft.targetScopeType,
  } as const
  if (draft.changeKind === 'remove') {
    return {
      ...base,
      changeKind: draft.changeKind,
      sharedInformationItemId: draft.sharedInformationItemId,
      expectedLatestChangeId: draft.expectedLatestChangeId,
    }
  }
  return {
    ...base,
    changeKind: draft.changeKind,
    title: draft.title,
    dueDate: draft.dueDate,
    ...(draft.relatedLessonName
      ? {
          relatedLessonName: draft.relatedLessonName.registeredLessonNameId
            ? {
                registeredLessonNameId:
                  draft.relatedLessonName.registeredLessonNameId,
              }
            : { lessonName: draft.relatedLessonName.lessonName },
        }
      : {}),
    ...(draft.changeKind === 'update'
      ? {
          sharedInformationItemId: draft.sharedInformationItemId,
          expectedLatestChangeId: draft.expectedLatestChangeId,
        }
      : {}),
  }
}

function restore(storage: StorageLike): {
  editing: boolean
  lastTargetScopeType: TargetScopeType
  drafts: TimetableChangeDraft[]
  taskDrafts: TaskDraft[]
  taskConflictSourceIds: string[]
} {
  try {
    const value = storage.getItem(storageKey)
    if (!value) throw new Error('empty')
    const parsed = JSON.parse(value) as Record<string, unknown>
    const drafts = Array.isArray(parsed.drafts)
      ? parsed.drafts
          .map(restoreTimetableChangeDraft)
          .filter((draft): draft is TimetableChangeDraft => draft !== null)
          .slice(0, maximumDraftKeys)
      : []
    const taskDrafts = Array.isArray(parsed.taskDrafts)
      ? parsed.taskDrafts
          .map(restoreTaskDraft)
          .filter((draft): draft is TaskDraft => draft !== null)
          .slice(0, maximumDraftKeys - drafts.length)
      : []
    const taskDraftSourceIds = new Set(
      taskDrafts.map((draft) => draft.sourceId),
    )
    const taskConflictSourceIds = Array.isArray(parsed.taskConflictSourceIds)
      ? parsed.taskConflictSourceIds.filter(
          (sourceId): sourceId is string =>
            typeof sourceId === 'string' &&
            taskDraftSourceIds.has(sourceId),
        )
      : []

    return {
      editing: parsed.editing === true || drafts.length + taskDrafts.length > 0,
      lastTargetScopeType: isTargetScopeType(parsed.lastTargetScopeType)
        ? parsed.lastTargetScopeType
        : 'track',
      drafts,
      taskDrafts,
      taskConflictSourceIds,
    }
  } catch {
    return {
      editing: false,
      lastTargetScopeType: 'track',
      drafts: [],
      taskDrafts: [],
      taskConflictSourceIds: [],
    }
  }
}

function restoreTaskDraft(value: unknown): TaskDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Record<string, unknown>
  if (
    typeof draft.sourceId !== 'string' ||
    (draft.changeKind !== undefined &&
      draft.changeKind !== 'add' &&
      draft.changeKind !== 'update' &&
      draft.changeKind !== 'remove') ||
    !isTargetScopeType(draft.targetScopeType) ||
    typeof draft.title !== 'string' ||
    draft.title.length < 1 ||
    draft.title.length > 120 ||
    (draft.dueDate !== null && typeof draft.dueDate !== 'string') ||
    (draft.relatedLessonName !== null &&
      !isTaskRelatedLessonName(draft.relatedLessonName))
  ) return null
  const base = {
    sourceId: draft.sourceId,
    targetScopeType: draft.targetScopeType,
    title: draft.title,
    dueDate: draft.dueDate as string | null,
    relatedLessonName: draft.relatedLessonName as TaskRelatedLessonName | null,
  }
  if (draft.changeKind === 'update' || draft.changeKind === 'remove') {
    return typeof draft.sharedInformationItemId === 'string' &&
      typeof draft.expectedLatestChangeId === 'string'
      ? {
          ...base,
          changeKind: draft.changeKind,
          sharedInformationItemId: draft.sharedInformationItemId,
          expectedLatestChangeId: draft.expectedLatestChangeId,
        }
      : null
  }
  return draft.sharedInformationItemId === undefined &&
      draft.expectedLatestChangeId === undefined
    ? { ...base, changeKind: 'add' }
    : null
}

function normalizeTaskSnapshot(
  input: TaskSnapshotDraft,
): TaskSnapshotDraft | null {
  const title = input.title.trim()
  const relatedLessonName = input.relatedLessonName
    ? {
        ...input.relatedLessonName,
        lessonName: input.relatedLessonName.lessonName.trim(),
      }
    : null
  if (
    title.length < 1 ||
    title.length > 120 ||
    /[\r\n]/.test(input.title) ||
    (input.dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) ||
    (relatedLessonName !== null &&
      (relatedLessonName.lessonName.length < 1 ||
        relatedLessonName.lessonName.length > 80 ||
        /[\r\n]/.test(relatedLessonName.lessonName)))
  ) return null
  return { title, dueDate: input.dueDate, relatedLessonName }
}

function isTaskRelatedLessonName(value: unknown): value is TaskRelatedLessonName {
  if (!value || typeof value !== 'object') return false
  const lessonName = value as Record<string, unknown>
  return typeof lessonName.lessonName === 'string' &&
    (lessonName.registeredLessonNameId === undefined ||
      typeof lessonName.registeredLessonNameId === 'string')
}

function restoreTimetableChangeDraft(value: unknown): TimetableChangeDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Record<string, unknown>
  if (
    typeof draft.sourceId !== 'string' ||
    (draft.changeKind !== undefined &&
      draft.changeKind !== 'add' &&
      draft.changeKind !== 'update' &&
      draft.changeKind !== 'remove') ||
    !isTargetScopeType(draft.targetScopeType) ||
    typeof draft.changeDate !== 'string' ||
    typeof draft.periodNumber !== 'number' ||
    !Number.isInteger(draft.periodNumber) ||
    (draft.changeKind !== 'remove' && !isReplacement(draft.replacement))
  ) return null
  const base = {
    sourceId: draft.sourceId,
    targetScopeType: draft.targetScopeType,
    changeDate: draft.changeDate,
    periodNumber: draft.periodNumber,
  }
  if (draft.changeKind === 'update') {
    return typeof draft.sharedInformationItemId === 'string' &&
      typeof draft.expectedLatestChangeId === 'string' &&
      isReplacement(draft.serverReplacement)
      ? {
          ...base,
          changeKind: 'update',
          replacement: draft.replacement as TimetableReplacement,
          sharedInformationItemId: draft.sharedInformationItemId,
          expectedLatestChangeId: draft.expectedLatestChangeId,
          serverReplacement: draft.serverReplacement,
        }
      : null
  }
  if (draft.changeKind === 'remove') {
    return typeof draft.sharedInformationItemId === 'string' &&
      typeof draft.expectedLatestChangeId === 'string' &&
      isReplacement(draft.serverReplacement)
      ? {
          ...base,
          changeKind: 'remove',
          sharedInformationItemId: draft.sharedInformationItemId,
          expectedLatestChangeId: draft.expectedLatestChangeId,
          serverReplacement: draft.serverReplacement,
        }
      : null
  }
  return draft.sharedInformationItemId === undefined &&
      draft.expectedLatestChangeId === undefined &&
      draft.serverReplacement === undefined
    ? { ...base, changeKind: 'add', replacement: draft.replacement as TimetableReplacement }
    : null
}

function isReplacement(value: unknown): value is TimetableReplacement {
  if (!value || typeof value !== 'object') return false
  const replacement = value as Record<string, unknown>
  if (replacement.type === 'cancelled') return true
  if (replacement.type === 'lesson_name') {
    return typeof replacement.lessonName === 'string' &&
      (replacement.registeredLessonNameId === undefined ||
        typeof replacement.registeredLessonNameId === 'string')
  }
  if (replacement.type === 'period_reference') {
    return Number.isInteger(replacement.weekday) && Number.isInteger(replacement.periodNumber)
  }
  return replacement.type === 'floating_lesson_reference' &&
    typeof replacement.floatingLessonReferenceLabelId === 'string' &&
    replacement.floatingLessonReferenceLabelId.length > 0 &&
    typeof replacement.referenceLabel === 'string' &&
    replacement.referenceLabel.length > 0
}
