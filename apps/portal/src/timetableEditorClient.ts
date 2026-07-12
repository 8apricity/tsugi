export type TargetScopeType = 'grade' | 'class' | 'track' | 'student'

export type TimetableReplacement =
  | { type: 'lesson_name'; lessonName: string }
  | { type: 'period_reference'; weekday: number; periodNumber: number }
  | {
      type: 'floating_lesson_reference'
      floatingLessonReferenceLabelId: string
      referenceLabel: string
    }
  | { type: 'cancelled' }

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

const storageKey = 'tsugi:timetable-direct-add-drafts:v1'
const maximumDraftKeys = 50

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
}: {
  storage: StorageLike
  createId?: () => string
}) {
  const restored = restore(storage)
  let editing = restored.editing
  let lastTargetScopeType = restored.lastTargetScopeType
  let drafts = restored.drafts
  let lastCommitFailed = false
  const loadedServerLayers = new Map<
    string,
    TimetableLayerState['layers'][number]
  >()
  const conflictKeys = new Set<string>()
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
      draftCount: drafts.length,
      atLimit: drafts.length >= maximumDraftKeys,
      conflictCount: conflictKeys.size,
      unreconciledDrafts: drafts
        .filter((draft) => !reconciledKeys.has(draftKey(draft)))
        .map(({ targetScopeType, changeDate, periodNumber }) => ({
          targetScopeType,
          changeDate,
          periodNumber,
        })),
      lastCommitFailed,
      draftDates: [...new Set(drafts.map((draft) => draft.changeDate))].sort(),
    }
  }

  function publish() {
    snapshot = buildSnapshot()
    storage.setItem(
      storageKey,
      JSON.stringify({ editing, lastTargetScopeType, drafts }),
    )
    listeners.forEach((listener) => listener())
  }

  function removeDraftByKey(key: string) {
    const next = drafts.filter((draft) => draftKey(draft) !== key)
    const removed = next.length !== drafts.length
    drafts = next
    return removed
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
      editing = true
      publish()
    },
    shouldConfirmExit() {
      return drafts.length > 0
    },
    discard() {
      editing = false
      drafts = []
      lastCommitFailed = false
      conflictKeys.clear()
      stickyConflictKeys.clear()
      reconciledKeys.clear()
      lastTargetScopeType = 'track'
      storage.removeItem(storageKey)
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
      const key = draftKey(input)
      const existing = drafts.find((draft) => draftKey(draft) === key)
      const serverLayer = loadedServerLayers.get(key)
      const serverReplacement = existing?.serverReplacement ??
        (serverLayer?.state === 'active' ? serverLayer.replacement : undefined)
      if (
        serverReplacement &&
        replacementsEqual(input.replacement, serverReplacement)
      ) {
        if (removeDraftByKey(key)) {
          conflictKeys.delete(key)
          stickyConflictKeys.delete(key)
          publish()
        }
        return { status: 'removed-noop' as const }
      }
      if (!existing && drafts.length >= maximumDraftKeys) {
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
    removeDesiredState(keyInput: TimetableLayerKey) {
      const { targetScopeType } = keyInput
      const key = draftKey(keyInput)
      const existing = drafts.find((draft) => draftKey(draft) === key)
      const serverLayer = loadedServerLayers.get(key)
      if (serverLayer?.state !== 'active') {
        return { status: 'not-active' as const }
      }
      if (!existing && drafts.length >= maximumDraftKeys) {
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
      resolveReference: (replacement: TimetableReplacement) => string | null,
    ) {
      const hasDraft = drafts.some(
        (draft) =>
          draft.changeDate === state.schoolDate &&
          draft.periodNumber === state.periodNumber,
      )
      let finalDailyLesson = {
        lessonName: state.standardTimetable?.lessonName ?? '',
        timetableChangeState: 'unchanged' as TimetableLayerState['finalDailyLesson']['timetableChangeState'],
      }
      const layers = state.layers.map((layer) => {
        const draft = drafts.find(
          (candidate) =>
            candidate.targetScopeType === layer.targetScopeType &&
            candidate.changeDate === state.schoolDate &&
            candidate.periodNumber === state.periodNumber,
        )
        if (draft?.changeKind === 'remove') {
          return {
            targetScopeType: layer.targetScopeType,
            state: 'unchanged' as const,
            desired: true,
            removalPlanned: true,
            conflicted: conflictKeys.has(draftKey(draft)),
          }
        }
        const replacement = draft?.replacement ??
          (layer.state === 'active' ? layer.replacement : undefined)
        if (replacement) {
          finalDailyLesson = resolvePreviewReplacement(replacement, resolveReference)
        }
        return replacement
          ? {
              ...layer,
              state: 'active' as const,
              replacement,
              desired: !!draft,
              conflicted: draft ? conflictKeys.has(draftKey(draft)) : false,
            }
          : { ...layer, desired: false, conflicted: false }
      })
      return {
        ...state,
        layers,
        finalDailyLesson: hasDraft ? finalDailyLesson : state.finalDailyLesson,
      }
    },
    toCommitPayload() {
      return {
        changes: drafts.map((draft) => ({
          changeKind: draft.changeKind,
          sourceId: draft.sourceId,
          ...(draft.changeKind === 'update' || draft.changeKind === 'remove'
            ? {
                sharedInformationItemId: draft.sharedInformationItemId,
                expectedLatestChangeId: draft.expectedLatestChangeId,
              }
            : {}),
          targetScopeType: draft.targetScopeType,
          changeDate: draft.changeDate,
          periodNumber: draft.periodNumber,
          ...(draft.changeKind === 'remove'
            ? {}
            : { replacement: draft.replacement }),
        })),
      }
    },
    commitFailed(
      conflictingKeys: TimetableLayerKey[] = [],
      sticky = false,
    ) {
      lastCommitFailed = true
      conflictingKeys.forEach((key) => {
        const serializedKey = draftKey(key)
        conflictKeys.add(serializedKey)
        if (sticky) stickyConflictKeys.add(serializedKey)
        reconciledKeys.delete(serializedKey)
      })
      publish()
    },
    commitSucceeded() {
      editing = false
      drafts = []
      lastCommitFailed = false
      conflictKeys.clear()
      stickyConflictKeys.clear()
      reconciledKeys.clear()
      storage.removeItem(storageKey)
      snapshot = buildSnapshot()
      listeners.forEach((listener) => listener())
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

function resolvePreviewReplacement(
  replacement: TimetableReplacement,
  resolveReference: (replacement: TimetableReplacement) => string | null,
) {
  if (replacement.type === 'cancelled') {
    return { lessonName: '', timetableChangeState: 'cancelled' as const }
  }
  if (replacement.type === 'lesson_name') {
    return { lessonName: replacement.lessonName, timetableChangeState: 'resolved' as const }
  }
  const lessonName = resolveReference(replacement)
  return lessonName === null
    ? { lessonName: '', timetableChangeState: 'unresolved-reference' as const }
    : { lessonName, timetableChangeState: 'resolved' as const }
}

function draftKey(
  draft: TimetableLayerKey,
) {
  return `${draft.targetScopeType}:${draft.changeDate}:${draft.periodNumber}`
}

function restore(storage: StorageLike): {
  editing: boolean
  lastTargetScopeType: TargetScopeType
  drafts: TimetableChangeDraft[]
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

    return {
      editing: parsed.editing === true || drafts.length > 0,
      lastTargetScopeType: isTargetScopeType(parsed.lastTargetScopeType)
        ? parsed.lastTargetScopeType
        : 'track',
      drafts,
    }
  } catch {
    return { editing: false, lastTargetScopeType: 'track', drafts: [] }
  }
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

function replacementsEqual(left: TimetableReplacement, right: TimetableReplacement) {
  if (left.type !== right.type) return false
  if (left.type === 'cancelled') return true
  if (left.type === 'lesson_name' && right.type === 'lesson_name') {
    return left.lessonName === right.lessonName
  }
  if (left.type === 'period_reference' && right.type === 'period_reference') {
    return left.weekday === right.weekday && left.periodNumber === right.periodNumber
  }
  return left.type === 'floating_lesson_reference' &&
    right.type === 'floating_lesson_reference' &&
    left.floatingLessonReferenceLabelId === right.floatingLessonReferenceLabelId
}

function isReplacement(value: unknown): value is TimetableReplacement {
  if (!value || typeof value !== 'object') return false
  const replacement = value as Record<string, unknown>
  if (replacement.type === 'cancelled') return true
  if (replacement.type === 'lesson_name') return typeof replacement.lessonName === 'string'
  if (replacement.type === 'period_reference') {
    return Number.isInteger(replacement.weekday) && Number.isInteger(replacement.periodNumber)
  }
  return replacement.type === 'floating_lesson_reference' &&
    typeof replacement.floatingLessonReferenceLabelId === 'string' &&
    typeof replacement.referenceLabel === 'string'
}

function isTargetScopeType(value: unknown): value is TargetScopeType {
  return value === 'grade' || value === 'class' || value === 'track' || value === 'student'
}
