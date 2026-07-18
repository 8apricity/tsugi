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

export type TaskNoteSnapshot = {
  noteId: string
  latestChangeId: string
  body: string
  targetScopeType: TargetScopeType
  relatedContext:
    | { type: 'daily-lesson'; schoolDate: string; periodNumber: number }
    | { type: 'school-date'; schoolDate: string }
    | { type: 'task'; taskId: string }
    | null
}

export type ActiveTaskForEditing = TaskSnapshotDraft & {
  taskId: string
  latestChangeId: string
  targetScopeType: TargetScopeType
  notes?: TaskNoteSnapshot[]
}

export type TaskBaseSnapshot = ActiveTaskForEditing & {
  notes: TaskNoteSnapshot[]
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
      changeKind: 'update'
      sharedInformationItemId: string
      expectedLatestChangeId: string
      baseTask?: TaskBaseSnapshot
    }
  | {
      changeKind: 'remove'
      sharedInformationItemId: string
      expectedLatestChangeId: string
      baseTask?: TaskBaseSnapshot
      suspendedDependentNoteDrafts?: NoteDraft[]
      suspendedDependentNoteConflictSourceIds?: string[]
    }
)

export type NewNoteDraftForm = {
  body: string
  schoolDate: string | null
  periodNumber?: number | null
  targetScopeType: TargetScopeType | null
}

export type ActiveNoteForEditing = {
  noteId: string
  latestChangeId: string
  body: string
  schoolDate: string | null
  periodNumber?: number | null
  targetScopeType: TargetScopeType
  relatedTaskItemId?: string
}

type NoteDraftBase = {
  kind: 'note'
  sourceId: string
  body: string
  schoolDate: string | null
  periodNumber?: number | null
  targetScopeType: TargetScopeType
  relatedTaskItemId?: string
}

export type NoteDraft = NoteDraftBase & (
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
    | {
        targetScopeType: TargetScopeType
        state: 'unchanged'
        notes?: Array<{
          noteId: string
          latestChangeId: string
          body: string
          targetScopeType: TargetScopeType
          relatedContext: {
            type: 'daily-lesson'
            schoolDate: string
            periodNumber: number
          }
        }>
      }
    | {
        targetScopeType: TargetScopeType
        state: 'active'
        sharedInformationItemId: string
        latestChangeId: string
        replacement: TimetableReplacement
        changedAt: number
        notes?: Array<{
          noteId: string
          latestChangeId: string
          body: string
          targetScopeType: TargetScopeType
          relatedContext: {
            type: 'daily-lesson'
            schoolDate: string
            periodNumber: number
          }
        }>
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

type NoteSubmissionChangeBase = {
  kind: 'note'
  sourceId: string
  targetScopeType: TargetScopeType
}

export type NoteSubmissionChange = NoteSubmissionChangeBase & (
  | {
      changeKind: 'add'
      body: string
      schoolDate?: string | null
      periodNumber?: number
      relatedTaskItemId?: string
    }
  | {
      changeKind: 'update'
      body: string
      sharedInformationItemId: string
      expectedLatestChangeId: string
    }
  | {
      changeKind: 'remove'
      sharedInformationItemId: string
      expectedLatestChangeId: string
    }
)

export type DirectSubmissionChange =
  | TimetableSubmissionChange
  | TaskSubmissionChange
  | NoteSubmissionChange

export type DirectChangeSubmissionPreview = Readonly<{
  changes: readonly Readonly<DirectSubmissionChange>[]
}>

type TimetableSubmissionFreshnessInput =
  | { type: 'applied'; affectedKeys: readonly TimetableLayerKey[] }
  | { type: 'remote-conflict'; conflictingKeys: readonly TimetableLayerKey[] }

export type TimetableSubmissionFreshnessEffect =
  TimetableSubmissionFreshnessInput & { signal: AbortSignal }

export type DirectChangeSubmissionTransportResult =
  | { status: 'applied' }
  | {
      status: 'remote-conflict' | 'idempotency-conflict'
      conflictingKeys: readonly TimetableLayerKey[]
      conflictingSourceIds?: readonly string[]
    }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }
  | { status: 'rejected' }

export type SubmitDirectChanges = (
  payload: Readonly<{ changes: readonly DirectSubmissionChange[] }>,
) => Promise<DirectChangeSubmissionTransportResult>

export type TimetableSubmissionPreview = DirectChangeSubmissionPreview
export type DirectTimetableSubmissionTransportResult =
  DirectChangeSubmissionTransportResult
export type SubmitDirectTimetableChanges = SubmitDirectChanges

type SubmitCurrentBatchOptions = {
  confirmSubmission(
    preview: DirectChangeSubmissionPreview,
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

export function createNewNoteDraftForm(schoolDate: string): NewNoteDraftForm {
  return {
    body: '',
    schoolDate,
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

export function createSharedInformationEditorClient({
  storage,
  createId = () => crypto.randomUUID(),
  draftStorageScope,
  submitDirectChanges,
  submitDirectTimetableChanges,
}: {
  storage: StorageLike
  createId?: () => string
  draftStorageScope?: string | null
  submitDirectChanges?: SubmitDirectChanges
  /** @deprecated Use submitDirectChanges. */
  submitDirectTimetableChanges?: SubmitDirectChanges
}) {
  const submitDirectChangesTransport =
    submitDirectChanges ?? submitDirectTimetableChanges
  if (!submitDirectChangesTransport) {
    throw new Error('submitDirectChanges is required')
  }
  let activeDraftStorageScope = draftStorageScope
  const restored = restore(storage, currentStorageKey())
  let editing = restored.editing
  let lastTargetScopeType = restored.lastTargetScopeType
  let drafts = restored.drafts
  let taskDrafts = restored.taskDrafts
  let noteDrafts = restored.noteDrafts
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
  const noteConflictSourceIds = new Set(restored.noteConflictSourceIds)
  const stickyConflictKeys = new Set<string>()
  const reconciledKeys = new Set<string>()
  let snapshot = buildSnapshot()
  const listeners = new Set<() => void>()

  function currentStorageKey() {
    if (activeDraftStorageScope === null) return null
    return activeDraftStorageScope === undefined
      ? storageKey
      : `${storageKey}:${encodeURIComponent(activeDraftStorageScope)}`
  }

  function restoreCurrentDraftStorage() {
    const restored = restore(storage, currentStorageKey())
    editing = restored.editing
    lastTargetScopeType = restored.lastTargetScopeType
    drafts = restored.drafts
    taskDrafts = restored.taskDrafts
    noteDrafts = restored.noteDrafts
    taskConflictSourceIds.clear()
    restored.taskConflictSourceIds.forEach((sourceId) => {
      taskConflictSourceIds.add(sourceId)
    })
    noteConflictSourceIds.clear()
    restored.noteConflictSourceIds.forEach((sourceId) => {
      noteConflictSourceIds.add(sourceId)
    })
    lastCommitFailed = false
    conflictKeys.clear()
    stickyConflictKeys.clear()
    reconciledKeys.clear()
  }

  function totalDraftCount() {
    return drafts.length + taskDrafts.length + noteDrafts.length
  }

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
      noteDrafts: noteDrafts.map((draft) => ({
        ...draft,
        conflicted: noteConflictSourceIds.has(draft.sourceId),
      })),
      draftCount: totalDraftCount(),
      atLimit: totalDraftCount() >= maximumDraftKeys,
      conflictCount:
        conflictKeys.size + taskConflictSourceIds.size + noteConflictSourceIds.size,
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
        ...noteDrafts.flatMap((draft) =>
          draft.schoolDate === null ? [] : [draft.schoolDate]),
      ])].sort(),
    }
  }

  function publish() {
    snapshot = buildSnapshot()
    const currentKey = currentStorageKey()
    if (currentKey) {
      storage.setItem(
        currentKey,
        JSON.stringify({
          editing,
          lastTargetScopeType,
          drafts,
          taskDrafts,
          noteDrafts,
          taskConflictSourceIds: [...taskConflictSourceIds],
          noteConflictSourceIds: [...noteConflictSourceIds],
        }),
      )
    }
    listeners.forEach((listener) => listener())
  }

  function removeDraftByKey(key: string) {
    const next = drafts.filter((draft) => draftKey(draft) !== key)
    const removed = next.length !== drafts.length
    drafts = next
    return removed
  }

  function removeDependentNoteDrafts(taskId: string) {
    const dependentDrafts = noteDrafts.filter(
      (draft) => draft.relatedTaskItemId === taskId,
    )
    const dependentSourceIds = new Set(dependentDrafts.map((draft) => draft.sourceId))
    const dependentConflictSourceIds = dependentDrafts
      .filter((draft) => noteConflictSourceIds.has(draft.sourceId))
      .map((draft) => draft.sourceId)
    noteDrafts = noteDrafts.filter(
      (draft) => !dependentSourceIds.has(draft.sourceId),
    )
    dependentSourceIds.forEach((id) => noteConflictSourceIds.delete(id))
    return { dependentDrafts, dependentConflictSourceIds }
  }

  function restoreDependentNoteDrafts(
    draft: Extract<TaskDraft, { changeKind: 'remove' }>,
  ) {
    const restoredDrafts = draft.suspendedDependentNoteDrafts ?? []
    const existingSourceIds = new Set(noteDrafts.map((note) => note.sourceId))
    const draftsToRestore = restoredDrafts.filter(
      (note) => !existingSourceIds.has(note.sourceId),
    )
    noteDrafts.push(...draftsToRestore)
    const restoredSourceIds = new Set(draftsToRestore.map((note) => note.sourceId))
    for (const sourceId of draft.suspendedDependentNoteConflictSourceIds ?? []) {
      if (restoredSourceIds.has(sourceId)) noteConflictSourceIds.add(sourceId)
    }
  }

  function commitPayload(
    batch: readonly TimetableChangeDraft[] = drafts,
    taskBatch: readonly TaskDraft[] = taskDrafts,
    noteBatch: readonly NoteDraft[] = noteDrafts,
  ) {
    return {
      changes: [
        ...batch.map(toTimetableSubmissionChange),
        ...taskBatch.map(toTaskSubmissionChange),
        ...noteBatch.map(toNoteSubmissionChange),
      ],
    }
  }

  function clearEditorState() {
    editing = false
    drafts = []
    taskDrafts = []
    noteDrafts = []
    lastCommitFailed = false
    conflictKeys.clear()
    taskConflictSourceIds.clear()
    noteConflictSourceIds.clear()
    stickyConflictKeys.clear()
    reconciledKeys.clear()
    lastTargetScopeType = 'track'
    const currentKey = currentStorageKey()
    if (currentKey) storage.removeItem(currentKey)
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
      const taskDraft = taskDrafts.find((draft) => draft.sourceId === sourceId)
      if (taskDraft) {
        taskConflictSourceIds.add(sourceId)
        const taskIdentity = taskDraft.changeKind === 'add'
          ? taskDraft.sourceId
          : taskDraft.sharedInformationItemId
        noteDrafts
          .filter((draft) => draft.relatedTaskItemId === taskIdentity)
          .forEach((draft) => noteConflictSourceIds.add(draft.sourceId))
      }
      if (noteDrafts.some((draft) => draft.sourceId === sourceId)) {
        noteConflictSourceIds.add(sourceId)
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

  function appendTaskNoteDrafts(
    taskId: string,
    targetScopeType: TargetScopeType,
    noteBodies: readonly string[],
  ) {
    const sourceIds: string[] = []
    for (const body of noteBodies) {
      const sourceId = createId()
      sourceIds.push(sourceId)
      noteDrafts.push({
        kind: 'note',
        changeKind: 'add',
        sourceId,
        body,
        schoolDate: null,
        targetScopeType,
        relatedTaskItemId: taskId,
      })
    }
    return sourceIds
  }

  function removeAddedTaskNoteDrafts(taskId: string) {
    const removed = noteDrafts.filter(
      (draft) => draft.changeKind === 'add' && draft.relatedTaskItemId === taskId,
    )
    if (removed.length === 0) return 0
    const removedSourceIds = new Set(removed.map((draft) => draft.sourceId))
    noteDrafts = noteDrafts.filter(
      (draft) => !removedSourceIds.has(draft.sourceId),
    )
    removedSourceIds.forEach((sourceId) => noteConflictSourceIds.delete(sourceId))
    return removed.length
  }

  function saveTaskDraftWithNotes(
    input: NewTaskDraftForm,
    requestedNoteBodies: readonly string[],
  ) {
    if (submitting) return { status: 'submission-in-progress' as const }
    const snapshot = normalizeTaskSnapshot(input)
    const noteBodies = normalizeNoteBodies(requestedNoteBodies)
    if (!input.targetScopeType || !snapshot) {
      return { status: 'invalid-task' as const }
    }
    if (noteBodies === null) return { status: 'invalid-note' as const }
    if (totalDraftCount() + 1 + noteBodies.length > maximumDraftKeys) {
      return { status: 'limit-reached' as const }
    }

    const sourceId = createId()
    taskDrafts.push({
      sourceId,
      changeKind: 'add',
      ...snapshot,
      targetScopeType: input.targetScopeType,
    })
    const noteSourceIds = appendTaskNoteDrafts(
      sourceId,
      input.targetScopeType,
      noteBodies,
    )
    lastTargetScopeType = input.targetScopeType
    editing = true
    lastCommitFailed = false
    publish()
    return { status: 'saved' as const, sourceId, noteSourceIds }
  }

  function saveTaskUpdateDraftWithNotes(
    activeTask: ActiveTaskForEditing,
    input: TaskSnapshotDraft,
    requestedNoteBodies: readonly string[],
  ) {
    if (submitting) return { status: 'submission-in-progress' as const }
    const snapshot = normalizeTaskSnapshot(input)
    const noteBodies = normalizeNoteBodies(requestedNoteBodies)
    if (!snapshot) return { status: 'invalid-task' as const }
    if (noteBodies === null) return { status: 'invalid-note' as const }

    const existing = taskDrafts.find(
      (draft) =>
        draft.changeKind !== 'add' &&
        draft.sharedInformationItemId === activeTask.taskId,
    )
    const existingAddedNoteCount = noteDrafts.filter(
      (draft) =>
        draft.changeKind === 'add' &&
        draft.relatedTaskItemId === activeTask.taskId,
    ).length
    const taskChanged = !taskSnapshotsEqual(snapshot, activeTask)
    if (
      !taskChanged &&
      !existing &&
      existingAddedNoteCount === 0 &&
      noteBodies.length === 0
    ) {
      return { status: 'removed-noop' as const }
    }
    if (
      totalDraftCount() - (existing ? 1 : 0) +
        (taskChanged ? 1 : 0) - existingAddedNoteCount +
        noteBodies.length > maximumDraftKeys
    ) {
      return { status: 'limit-reached' as const }
    }

    const sourceId = existing?.sourceId ?? (taskChanged ? createId() : undefined)
    if (existing) {
      taskDrafts = taskDrafts.filter((draft) => draft.sourceId !== existing.sourceId)
      taskConflictSourceIds.delete(existing.sourceId)
      if (existing.changeKind === 'remove') restoreDependentNoteDrafts(existing)
    }
    removeAddedTaskNoteDrafts(activeTask.taskId)
    if (taskChanged && sourceId) {
      taskDrafts.push({
        sourceId,
        changeKind: 'update',
        sharedInformationItemId: activeTask.taskId,
        expectedLatestChangeId: activeTask.latestChangeId,
        baseTask: taskBaseSnapshot(activeTask),
        targetScopeType: activeTask.targetScopeType,
        ...snapshot,
      })
      taskConflictSourceIds.delete(sourceId)
    }
    const noteSourceIds = appendTaskNoteDrafts(
      activeTask.taskId,
      activeTask.targetScopeType,
      noteBodies,
    )
    editing = true
    lastCommitFailed = false
    publish()
    return {
      status: 'saved' as const,
      ...(sourceId ? { sourceId } : {}),
      noteSourceIds,
    }
  }

  function updateTaskDraftWithNotes(
    sourceId: string,
    input: NewTaskDraftForm,
    requestedNoteBodies: readonly string[],
  ) {
    if (submitting) return { status: 'submission-in-progress' as const }
    const snapshot = normalizeTaskSnapshot(input)
    const noteBodies = normalizeNoteBodies(requestedNoteBodies)
    const existing = taskDrafts.find((draft) => draft.sourceId === sourceId)
    if (
      !existing ||
      existing.changeKind !== 'add' ||
      !input.targetScopeType ||
      !snapshot
    ) return { status: 'invalid-task' as const }
    if (noteBodies === null) return { status: 'invalid-note' as const }
    const existingAddedNoteCount = noteDrafts.filter(
      (draft) =>
        draft.changeKind === 'add' && draft.relatedTaskItemId === sourceId,
    ).length
    if (totalDraftCount() - existingAddedNoteCount + noteBodies.length > maximumDraftKeys) {
      return { status: 'limit-reached' as const }
    }

    removeAddedTaskNoteDrafts(sourceId)
    taskDrafts = taskDrafts.map((draft) =>
      draft.sourceId === sourceId
        ? { ...draft, ...snapshot, targetScopeType: input.targetScopeType! }
        : draft,
    )
    const noteSourceIds = appendTaskNoteDrafts(
      sourceId,
      input.targetScopeType,
      noteBodies,
    )
    lastTargetScopeType = input.targetScopeType
    editing = true
    lastCommitFailed = false
    publish()
    return { status: 'saved' as const, sourceId, noteSourceIds }
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
    exitEditing() {
      if (submitting) return { status: 'submission-in-progress' as const }
      editing = false
      publish()
      return { status: 'paused' as const }
    },
    shouldConfirmExit() {
      return totalDraftCount() > 0
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
    setDraftStorageScope(nextScope: string | null) {
      if (activeDraftStorageScope === nextScope) return
      lifecycleGeneration += 1
      submitting = false
      activeFreshnessController?.abort()
      activeFreshnessController = null
      loadedServerLayers.clear()
      activeDraftStorageScope = nextScope
      restoreCurrentDraftStorage()
      snapshot = buildSnapshot()
      listeners.forEach((listener) => listener())
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
      if (!existing && totalDraftCount() >= maximumDraftKeys) {
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
    saveDailyLessonDialogDraft({
      targetScopeType,
      schoolDate,
      periodNumber,
      replacement,
      noteBodies,
      removeTimetableChange = false,
    }: {
      targetScopeType: TargetScopeType
      schoolDate: string
      periodNumber: number
      replacement: TimetableReplacement | null
      noteBodies?: readonly string[]
      removeTimetableChange?: boolean
    }) {
      if (submitting) return { status: 'submission-in-progress' as const }
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(schoolDate) ||
        !Number.isInteger(periodNumber) ||
        periodNumber < 1 ||
        periodNumber > 7
      ) return { status: 'invalid-note' as const }

      const normalizedNoteBodies = normalizeNoteBodies(noteBodies ?? [])
      if (normalizedNoteBodies === null) {
        return { status: 'invalid-note' as const }
      }
      if (
        replacement === null &&
        !removeTimetableChange &&
        normalizedNoteBodies.length === 0
      ) {
        return { status: 'empty' as const }
      }

      const keyInput = {
        targetScopeType,
        changeDate: schoolDate,
        periodNumber,
      }
      const key = draftKey(keyInput)
      const existing = drafts.find((draft) => draftKey(draft) === key)
      const serverLayer = loadedServerLayers.get(key)
      const serverReplacement = existing?.serverReplacement ??
        (serverLayer?.state === 'active' ? serverLayer.replacement : undefined)
      if (
        removeTimetableChange &&
        serverLayer?.state !== 'active' &&
        existing?.changeKind !== 'remove'
      ) {
        return { status: 'not-active' as const }
      }
      const timetableNoop = replacement !== null && serverReplacement !== undefined &&
        timetableReplacementsEqual(replacement, serverReplacement)
      const willWriteTimetable = removeTimetableChange ||
        (replacement !== null && !timetableNoop)
      const existingTimetableDraftAdjustment = Boolean(
        existing &&
        (removeTimetableChange || (replacement !== null && timetableNoop)),
      )
      const nextCount = totalDraftCount() -
        (existingTimetableDraftAdjustment ? 1 : 0) +
        (!existing && willWriteTimetable ? 1 : 0) +
        normalizedNoteBodies.length
      if (nextCount > maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }

      let timetableSourceId: string | undefined
      if (removeTimetableChange) {
        if (existing?.changeKind === 'remove') {
          timetableSourceId = existing.sourceId
        } else {
          timetableSourceId = existing?.sourceId ?? createId()
          const operation = serverLayer?.state === 'active'
            ? {
                changeKind: 'remove' as const,
                sharedInformationItemId: serverLayer.sharedInformationItemId,
                expectedLatestChangeId: serverLayer.latestChangeId,
                serverReplacement: serverLayer.replacement,
              }
            : null
          if (!operation) return { status: 'not-active' as const }
          drafts = drafts.filter((draft) => draftKey(draft) !== key)
          drafts.push({ ...keyInput, ...operation, sourceId: timetableSourceId })
          reconciledKeys.add(key)
        }
      } else if (replacement !== null) {
        if (timetableNoop) {
          if (removeDraftByKey(key)) {
            conflictKeys.delete(key)
            stickyConflictKeys.delete(key)
          }
        } else {
          timetableSourceId = existing?.sourceId ?? createId()
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
          drafts.push({ ...keyInput, replacement, ...operation, sourceId: timetableSourceId })
          if (serverLayer) reconciledKeys.add(key)
        }
      }

      const noteSourceIds: string[] = []
      for (const normalizedNoteBody of normalizedNoteBodies) {
        const noteSourceId = createId()
        noteSourceIds.push(noteSourceId)
        noteDrafts.push({
          kind: 'note',
          changeKind: 'add',
          sourceId: noteSourceId,
          body: normalizedNoteBody,
          schoolDate,
          periodNumber,
          targetScopeType,
        })
      }
      lastTargetScopeType = targetScopeType
      editing = true
      lastCommitFailed = false
      publish()
      return {
        status: 'saved' as const,
        savedTimetable: willWriteTimetable,
        savedNote: normalizedNoteBodies.length > 0,
        savedNotes: normalizedNoteBodies.length,
        ...(timetableSourceId ? { timetableSourceId } : {}),
        ...(noteSourceIds.length > 0 ? { noteSourceIds } : {}),
      }
    },
    saveTaskDraft(input: NewTaskDraftForm) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const snapshot = normalizeTaskSnapshot(input)
      if (!input.targetScopeType || !snapshot) {
        return { status: 'invalid-task' as const }
      }
      if (totalDraftCount() >= maximumDraftKeys) {
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
    saveTaskDraftWithNotes,
    saveNoteDraft(input: NewNoteDraftForm) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const body = normalizeNoteBody(input.body)
      if (
        !input.targetScopeType ||
        (input.schoolDate !== null &&
          !/^\d{4}-\d{2}-\d{2}$/.test(input.schoolDate)) ||
        (input.periodNumber != null &&
          (input.schoolDate === null ||
            !Number.isInteger(input.periodNumber) ||
            input.periodNumber < 1 || input.periodNumber > 7)) ||
        body === null
      ) {
        return { status: 'invalid-note' as const }
      }
      if (totalDraftCount() >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const sourceId = createId()
      noteDrafts.push({
        kind: 'note',
        changeKind: 'add',
        sourceId,
        body,
        schoolDate: input.schoolDate,
        ...(input.periodNumber == null
          ? {}
          : { periodNumber: input.periodNumber }),
        targetScopeType: input.targetScopeType,
      })
      lastTargetScopeType = input.targetScopeType
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    saveTaskNoteDraft(
      task: { taskId: string; targetScopeType: TargetScopeType },
      desiredBody: string,
    ) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const body = normalizeNoteBody(desiredBody)
      const taskDraft = taskDrafts.find(
        (draft) =>
          draft.changeKind === 'add' && draft.sourceId === task.taskId,
      )
      const taskRemovalPlanned = taskDrafts.some(
        (draft) =>
          draft.changeKind === 'remove' &&
          draft.sharedInformationItemId === task.taskId,
      )
      if (
        body === null ||
        taskRemovalPlanned ||
        (taskDraft && taskDraft.targetScopeType !== task.targetScopeType)
      ) return { status: 'invalid-note' as const }
      if (totalDraftCount() >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const sourceId = createId()
      noteDrafts.push({
        kind: 'note',
        changeKind: 'add',
        sourceId,
        body,
        schoolDate: null,
        targetScopeType: task.targetScopeType,
        relatedTaskItemId: task.taskId,
      })
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    updateNoteDraft(sourceId: string, input: NewNoteDraftForm) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const existing = noteDrafts.find((draft) => draft.sourceId === sourceId)
      if (!existing || existing.changeKind === 'remove') {
        return { status: 'unchanged' as const }
      }
      const body = normalizeNoteBody(input.body)
      if (body === null) return { status: 'invalid-note' as const }
      if (existing.changeKind === 'add') {
        if (
          !input.targetScopeType ||
          (input.schoolDate !== null &&
            !/^\d{4}-\d{2}-\d{2}$/.test(input.schoolDate)) ||
          (input.periodNumber != null &&
            (input.schoolDate === null ||
              !Number.isInteger(input.periodNumber) ||
              input.periodNumber < 1 || input.periodNumber > 7))
        ) return { status: 'invalid-note' as const }
        noteDrafts = noteDrafts.map((draft) =>
          draft.sourceId === sourceId
            ? {
                ...draft,
                body,
                schoolDate: input.schoolDate,
                periodNumber: input.periodNumber ?? draft.periodNumber,
                targetScopeType: input.targetScopeType!,
              }
            : draft,
        )
      } else {
        noteDrafts = noteDrafts.map((draft) =>
          draft.sourceId === sourceId ? { ...draft, body } : draft,
        )
      }
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const }
    },
    saveNoteUpdateDraft(activeNote: ActiveNoteForEditing, desiredBody: string) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const body = normalizeNoteBody(desiredBody)
      if (body === null) return { status: 'invalid-note' as const }
      const existing = noteDrafts.find(
        (draft) =>
          draft.changeKind !== 'add' &&
          draft.sharedInformationItemId === activeNote.noteId,
      )
      if (body === activeNote.body) {
        if (existing) {
          noteDrafts = noteDrafts.filter(
            (draft) => draft.sourceId !== existing.sourceId,
          )
          noteConflictSourceIds.delete(existing.sourceId)
          publish()
        }
        return { status: 'removed-noop' as const }
      }
      if (!existing && totalDraftCount() >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const sourceId = existing?.sourceId ?? createId()
      noteDrafts = noteDrafts.filter((draft) => draft.sourceId !== sourceId)
      noteDrafts.push({
        kind: 'note',
        changeKind: 'update',
        sourceId,
        sharedInformationItemId: activeNote.noteId,
        expectedLatestChangeId: activeNote.latestChangeId,
        body,
        schoolDate: activeNote.schoolDate,
        periodNumber: activeNote.periodNumber,
        targetScopeType: activeNote.targetScopeType,
        ...(activeNote.relatedTaskItemId
          ? { relatedTaskItemId: activeNote.relatedTaskItemId }
          : {}),
      })
      noteConflictSourceIds.delete(sourceId)
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    saveNoteRemoveDraft(activeNote: ActiveNoteForEditing) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const existing = noteDrafts.find(
        (draft) =>
          draft.changeKind !== 'add' &&
          draft.sharedInformationItemId === activeNote.noteId,
      )
      if (!existing && totalDraftCount() >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const sourceId = existing?.sourceId ?? createId()
      noteDrafts = noteDrafts.filter((draft) => draft.sourceId !== sourceId)
      noteDrafts.push({
        kind: 'note',
        changeKind: 'remove',
        sourceId,
        sharedInformationItemId: activeNote.noteId,
        expectedLatestChangeId: activeNote.latestChangeId,
        body: activeNote.body,
        schoolDate: activeNote.schoolDate,
        periodNumber: activeNote.periodNumber,
        targetScopeType: activeNote.targetScopeType,
        ...(activeNote.relatedTaskItemId
          ? { relatedTaskItemId: activeNote.relatedTaskItemId }
          : {}),
      })
      noteConflictSourceIds.delete(sourceId)
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    reconcileActiveNotes(
      activeNotes: readonly ActiveNoteForEditing[],
      loadedSchoolDate?: string,
    ) {
      const activeById = new Map(activeNotes.map((note) => [note.noteId, note]))
      const nextDrafts: NoteDraft[] = []
      for (const draft of noteDrafts) {
        if (draft.changeKind === 'add') {
          nextDrafts.push(draft)
          continue
        }
        if (noteConflictSourceIds.has(draft.sourceId)) {
          nextDrafts.push(draft)
          continue
        }
        if (
          loadedSchoolDate !== undefined &&
          draft.schoolDate !== null &&
          draft.schoolDate !== loadedSchoolDate
        ) {
          nextDrafts.push(draft)
          continue
        }
        const active = activeById.get(draft.sharedInformationItemId)
        if (!active || active.latestChangeId !== draft.expectedLatestChangeId) {
          noteConflictSourceIds.add(draft.sourceId)
          nextDrafts.push(draft)
          continue
        }
        if (draft.changeKind === 'update' && draft.body === active.body) {
          noteConflictSourceIds.delete(draft.sourceId)
          continue
        }
        noteConflictSourceIds.delete(draft.sourceId)
        nextDrafts.push(draft)
      }
      noteDrafts = nextDrafts
      publish()
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
      if (taskSnapshotsEqual(snapshot, activeTask)) {
        if (existing) {
          taskDrafts = taskDrafts.filter(
            (draft) => draft.sourceId !== existing.sourceId,
          )
          taskConflictSourceIds.delete(existing.sourceId)
          if (existing.changeKind === 'remove') {
            restoreDependentNoteDrafts(existing)
          }
          publish()
        }
        return { status: 'removed-noop' as const }
      }
      if (!existing && totalDraftCount() >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const sourceId = existing?.sourceId ?? createId()
      taskDrafts = taskDrafts.filter((draft) => draft.sourceId !== sourceId)
      if (existing?.changeKind === 'remove') {
        restoreDependentNoteDrafts(existing)
      }
      taskDrafts.push({
        sourceId,
        changeKind: 'update',
        sharedInformationItemId: activeTask.taskId,
        expectedLatestChangeId: activeTask.latestChangeId,
        baseTask: taskBaseSnapshot(activeTask),
        targetScopeType: activeTask.targetScopeType,
        ...snapshot,
      })
      taskConflictSourceIds.delete(sourceId)
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    saveTaskUpdateDraftWithNotes,
    updateTaskDraft(sourceId: string, input: NewTaskDraftForm) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const snapshot = normalizeTaskSnapshot(input)
      const targetScopeType = input.targetScopeType
      const existing = taskDrafts.find((draft) => draft.sourceId === sourceId)
      if (
        !existing ||
        existing.changeKind !== 'add' ||
        !targetScopeType ||
        !snapshot
      ) {
        return { status: 'invalid-task' as const }
      }
      taskDrafts = taskDrafts.map((draft) =>
        draft.sourceId === sourceId
          ? {
              ...draft,
              ...snapshot,
              targetScopeType,
            }
          : draft,
      )
      lastTargetScopeType = targetScopeType
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    updateTaskDraftWithNotes,
    saveTaskRemoveDraft(activeTask: ActiveTaskForEditing) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const existing = taskDrafts.find(
        (draft) =>
          draft.changeKind !== 'add' &&
          draft.sharedInformationItemId === activeTask.taskId,
      )
      if (!existing && totalDraftCount() >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }
      const suspendedNotes = existing?.changeKind === 'remove'
        ? {
            dependentDrafts: existing.suspendedDependentNoteDrafts ?? [],
            dependentConflictSourceIds:
              existing.suspendedDependentNoteConflictSourceIds ?? [],
          }
        : removeDependentNoteDrafts(activeTask.taskId)
      const sourceId = existing?.sourceId ?? createId()
      taskDrafts = taskDrafts.filter((draft) => draft.sourceId !== sourceId)
      taskDrafts.push({
        sourceId,
        changeKind: 'remove',
        sharedInformationItemId: activeTask.taskId,
        expectedLatestChangeId: activeTask.latestChangeId,
        baseTask: taskBaseSnapshot(activeTask),
        targetScopeType: activeTask.targetScopeType,
        title: activeTask.title,
        dueDate: activeTask.dueDate,
        relatedLessonName: activeTask.relatedLessonName,
        ...(suspendedNotes.dependentDrafts.length > 0
          ? { suspendedDependentNoteDrafts: suspendedNotes.dependentDrafts }
          : {}),
        ...(suspendedNotes.dependentConflictSourceIds.length > 0
          ? {
              suspendedDependentNoteConflictSourceIds:
                suspendedNotes.dependentConflictSourceIds,
            }
          : {}),
      })
      taskConflictSourceIds.delete(sourceId)
      editing = true
      lastCommitFailed = false
      publish()
      return { status: 'saved' as const, sourceId }
    },
    removeTaskDraft(sourceId: string) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const removedDraft = taskDrafts.find((draft) => draft.sourceId === sourceId)
      const next = taskDrafts.filter((draft) => draft.sourceId !== sourceId)
      if (next.length === taskDrafts.length) {
        return { status: 'unchanged' as const }
      }
      taskDrafts = next
      taskConflictSourceIds.delete(sourceId)
      if (removedDraft?.changeKind === 'add') {
        removeDependentNoteDrafts(sourceId)
      } else if (removedDraft?.changeKind === 'remove') {
        restoreDependentNoteDrafts(removedDraft)
      }
      publish()
      return { status: 'removed' as const }
    },
    removeNoteDraft(sourceId: string) {
      if (submitting) return { status: 'submission-in-progress' as const }
      const next = noteDrafts.filter((draft) => draft.sourceId !== sourceId)
      if (next.length === noteDrafts.length) {
        return { status: 'unchanged' as const }
      }
      noteDrafts = next
      noteConflictSourceIds.delete(sourceId)
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
      if (!existing && totalDraftCount() >= maximumDraftKeys) {
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
            notes: layer.notes,
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
      if (conflictKeys.size + taskConflictSourceIds.size + noteConflictSourceIds.size > 0) {
        return { status: 'local-conflict' as const }
      }
      if (totalDraftCount() === 0) {
        return { status: 'empty' as const }
      }

      const generation = lifecycleGeneration
      const batch = drafts.map((draft) => ({ ...draft }))
      const taskBatch = taskDrafts.map((draft) => ({ ...draft }))
      const noteBatch = noteDrafts.map((draft) => ({ ...draft }))
      const payload = commitPayload(batch, taskBatch, noteBatch)
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

      let transportResult: DirectChangeSubmissionTransportResult
      try {
        transportResult = await submitDirectChangesTransport(payload)
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
      noteDrafts = []
      lastCommitFailed = false
      conflictKeys.clear()
      taskConflictSourceIds.clear()
      noteConflictSourceIds.clear()
      stickyConflictKeys.clear()
      reconciledKeys.clear()
      const currentKey = currentStorageKey()
      if (currentKey) storage.removeItem(currentKey)
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

export const createTimetableEditorClient = createSharedInformationEditorClient

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

function toNoteSubmissionChange(draft: NoteDraft): NoteSubmissionChange {
  const base = {
    kind: 'note',
    sourceId: draft.sourceId,
    targetScopeType: draft.targetScopeType,
  } as const
  if (draft.changeKind === 'remove') {
    return {
      ...base,
      changeKind: 'remove',
      sharedInformationItemId: draft.sharedInformationItemId,
      expectedLatestChangeId: draft.expectedLatestChangeId,
    }
  }
  return draft.changeKind === 'update'
    ? {
        ...base,
        changeKind: 'update',
        sharedInformationItemId: draft.sharedInformationItemId,
        expectedLatestChangeId: draft.expectedLatestChangeId,
        body: draft.body,
      }
    : {
        ...base,
        changeKind: 'add',
        ...(draft.relatedTaskItemId
          ? { relatedTaskItemId: draft.relatedTaskItemId }
          : {
              schoolDate: draft.schoolDate,
              ...(draft.periodNumber == null
                ? {}
                : { periodNumber: draft.periodNumber }),
            }),
        body: draft.body,
      }
}

function restore(storage: StorageLike, key: string | null): {
  editing: boolean
  lastTargetScopeType: TargetScopeType
  drafts: TimetableChangeDraft[]
  taskDrafts: TaskDraft[]
  noteDrafts: NoteDraft[]
  taskConflictSourceIds: string[]
  noteConflictSourceIds: string[]
} {
  try {
    if (!key) throw new Error('no storage scope')
    const value = storage.getItem(key)
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
    const noteDrafts = Array.isArray(parsed.noteDrafts)
      ? parsed.noteDrafts
          .map(restoreNoteDraft)
          .filter((draft): draft is NoteDraft => draft !== null)
          .slice(0, maximumDraftKeys - drafts.length - taskDrafts.length)
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
    const noteDraftSourceIds = new Set(noteDrafts.map((draft) => draft.sourceId))
    const noteConflictSourceIds = Array.isArray(parsed.noteConflictSourceIds)
      ? parsed.noteConflictSourceIds.filter(
          (sourceId): sourceId is string =>
            typeof sourceId === 'string' && noteDraftSourceIds.has(sourceId),
        )
      : []

    return {
      editing: typeof parsed.editing === 'boolean'
        ? parsed.editing
        : drafts.length + taskDrafts.length + noteDrafts.length > 0,
      lastTargetScopeType: isTargetScopeType(parsed.lastTargetScopeType)
        ? parsed.lastTargetScopeType
        : 'track',
      drafts,
      taskDrafts,
      noteDrafts,
      taskConflictSourceIds,
      noteConflictSourceIds,
    }
  } catch {
    return {
      editing: false,
      lastTargetScopeType: 'track',
      drafts: [],
      taskDrafts: [],
      noteDrafts: [],
      taskConflictSourceIds: [],
      noteConflictSourceIds: [],
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
    const baseTask = restoreTaskBaseSnapshot(draft.baseTask)
    const suspendedDependentNoteDrafts = draft.changeKind === 'remove'
      ? restoreSuspendedNoteDrafts(draft.suspendedDependentNoteDrafts)
      : []
    if (suspendedDependentNoteDrafts === null) return null
    const suspendedDependentNoteConflictSourceIds = draft.changeKind === 'remove'
      ? restoreSuspendedNoteConflictSourceIds(
          draft.suspendedDependentNoteConflictSourceIds,
          suspendedDependentNoteDrafts,
        )
      : []
    if (suspendedDependentNoteConflictSourceIds === null) return null
    return typeof draft.sharedInformationItemId === 'string' &&
      typeof draft.expectedLatestChangeId === 'string'
      ? {
          ...base,
          changeKind: draft.changeKind,
          sharedInformationItemId: draft.sharedInformationItemId,
          expectedLatestChangeId: draft.expectedLatestChangeId,
          ...(baseTask ? { baseTask } : {}),
          ...(draft.changeKind === 'remove' &&
            suspendedDependentNoteDrafts.length > 0
            ? { suspendedDependentNoteDrafts }
            : {}),
          ...(draft.changeKind === 'remove' &&
            suspendedDependentNoteConflictSourceIds.length > 0
            ? { suspendedDependentNoteConflictSourceIds }
            : {}),
        }
      : null
  }
  return draft.sharedInformationItemId === undefined &&
      draft.expectedLatestChangeId === undefined
    ? { ...base, changeKind: 'add' }
    : null
}

function restoreSuspendedNoteDrafts(value: unknown): NoteDraft[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const drafts = value.map(restoreNoteDraft)
  return drafts.some((draft) => draft === null)
    ? null
    : drafts as NoteDraft[]
}

function restoreSuspendedNoteConflictSourceIds(
  value: unknown,
  drafts: readonly NoteDraft[],
) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) {
    return null
  }
  const draftSourceIds = new Set(drafts.map((draft) => draft.sourceId))
  return value.filter((id): id is string =>
    typeof id === 'string' && draftSourceIds.has(id))
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

function taskSnapshotsEqual(
  left: TaskSnapshotDraft,
  right: TaskSnapshotDraft,
) {
  return (
    left.title === right.title &&
    left.dueDate === right.dueDate &&
    left.relatedLessonName?.lessonName === right.relatedLessonName?.lessonName &&
    left.relatedLessonName?.registeredLessonNameId ===
      right.relatedLessonName?.registeredLessonNameId
  )
}

function taskBaseSnapshot(task: ActiveTaskForEditing): TaskBaseSnapshot {
  return {
    taskId: task.taskId,
    latestChangeId: task.latestChangeId,
    title: task.title,
    dueDate: task.dueDate,
    relatedLessonName: task.relatedLessonName,
    targetScopeType: task.targetScopeType,
    notes: task.notes?.map((note) => ({
      noteId: note.noteId,
      latestChangeId: note.latestChangeId,
      body: note.body,
      targetScopeType: note.targetScopeType,
      relatedContext: note.relatedContext && { ...note.relatedContext },
    })) ?? [],
  }
}

function restoreTaskBaseSnapshot(value: unknown): TaskBaseSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const task = value as Record<string, unknown>
  if (
    typeof task.title !== 'string' ||
    (task.dueDate !== null && typeof task.dueDate !== 'string') ||
    (task.relatedLessonName !== null &&
      !isTaskRelatedLessonName(task.relatedLessonName))
  ) return null
  const snapshot = normalizeTaskSnapshot({
    title: task.title,
    dueDate: task.dueDate as string | null,
    relatedLessonName: task.relatedLessonName as TaskRelatedLessonName | null,
  })
  if (
    !snapshot ||
    typeof task.taskId !== 'string' ||
    typeof task.latestChangeId !== 'string' ||
    !isTargetScopeType(task.targetScopeType) ||
    !Array.isArray(task.notes)
  ) return null
  const notes = task.notes.map(restoreTaskNoteSnapshot)
  if (notes.some((note) => note === null)) return null
  return {
    taskId: task.taskId,
    latestChangeId: task.latestChangeId,
    ...snapshot,
    targetScopeType: task.targetScopeType,
    notes: notes as TaskNoteSnapshot[],
  }
}

function restoreTaskNoteSnapshot(value: unknown): TaskNoteSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const note = value as Record<string, unknown>
  const relatedContext = note.relatedContext as Record<string, unknown> | null
  return (
    typeof note.noteId === 'string' &&
    typeof note.latestChangeId === 'string' &&
    typeof note.body === 'string' &&
    isTargetScopeType(note.targetScopeType) &&
    relatedContext !== null &&
    relatedContext.type === 'task' &&
    typeof relatedContext.taskId === 'string'
  )
    ? {
        noteId: note.noteId,
        latestChangeId: note.latestChangeId,
        body: note.body,
        targetScopeType: note.targetScopeType,
        relatedContext: { type: 'task', taskId: relatedContext.taskId },
      }
    : null
}

function normalizeNoteBody(body: string) {
  const trimmed = body.trim()
  return trimmed.length >= 1 && trimmed.length <= 1000 ? trimmed : null
}

function normalizeNoteBodies(noteBodies: readonly string[]) {
  const normalized: string[] = []
  for (const noteBody of noteBodies) {
    if (noteBody.trim().length === 0) continue
    const body = normalizeNoteBody(noteBody)
    if (body === null) return null
    normalized.push(body)
  }
  return normalized
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

function restoreNoteDraft(value: unknown): NoteDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Record<string, unknown>
  const body = typeof draft.body === 'string'
    ? normalizeNoteBody(draft.body)
    : null
  if (draft.kind !== 'note' ||
      (draft.changeKind !== 'add' && draft.changeKind !== 'update' &&
        draft.changeKind !== 'remove') ||
      typeof draft.sourceId !== 'string') return null
  if (
    body === null ||
    (draft.relatedTaskItemId !== undefined &&
      typeof draft.relatedTaskItemId !== 'string') ||
    (draft.periodNumber !== undefined && draft.periodNumber !== null &&
      (!Number.isInteger(draft.periodNumber) ||
        Number(draft.periodNumber) < 1 || Number(draft.periodNumber) > 7)) ||
    (draft.periodNumber != null && draft.schoolDate === null) ||
    (draft.schoolDate !== null &&
      (typeof draft.schoolDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(draft.schoolDate))) ||
    !isTargetScopeType(draft.targetScopeType)
  ) return null
  const base = {
    kind: 'note' as const,
    sourceId: draft.sourceId as string,
    body,
    schoolDate: draft.schoolDate as string | null,
    ...(draft.periodNumber == null
      ? {}
      : { periodNumber: Number(draft.periodNumber) }),
    targetScopeType: draft.targetScopeType,
    ...(typeof draft.relatedTaskItemId === 'string'
      ? { relatedTaskItemId: draft.relatedTaskItemId }
      : {}),
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
