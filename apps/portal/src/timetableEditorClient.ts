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

export type TimetableChangeDraft = {
  sourceId: string
  targetScopeType: TargetScopeType
  changeDate: string
  periodNumber: number
  replacement: TimetableReplacement
}

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
type DesiredStateInput = Omit<TimetableChangeDraft, 'sourceId'>

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
  const occupiedServerKeys = new Set<string>()
  let snapshot = buildSnapshot()
  const listeners = new Set<() => void>()

  function buildSnapshot() {
    return {
      editing,
      lastTargetScopeType,
      drafts: [...drafts],
      draftCount: drafts.length,
      atLimit: drafts.length >= maximumDraftKeys,
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
      lastTargetScopeType = 'track'
      storage.removeItem(storageKey)
      snapshot = buildSnapshot()
      listeners.forEach((listener) => listener())
    },
    reconcileLayerState(state: TimetableLayerState) {
      for (const layer of state.layers) {
        const key = draftKey({
          targetScopeType: layer.targetScopeType,
          changeDate: state.schoolDate,
          periodNumber: state.periodNumber,
        })
        if (layer.state === 'active') occupiedServerKeys.add(key)
        else occupiedServerKeys.delete(key)
      }
      publish()
    },
    setDesiredState(input: DesiredStateInput) {
      const key = draftKey(input)
      const existing = drafts.find((draft) => draftKey(draft) === key)
      if (!existing && occupiedServerKeys.has(key)) {
        return { status: 'active-layer' as const }
      }
      if (!existing && drafts.length >= maximumDraftKeys) {
        return { status: 'limit-reached' as const }
      }

      const sourceId = existing?.sourceId ?? createId()
      drafts = drafts.filter((draft) => draftKey(draft) !== key)
      drafts.push({ ...input, sourceId })
      lastTargetScopeType = input.targetScopeType
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
      if (removeDraftByKey(draftKey({ targetScopeType, changeDate, periodNumber }))) {
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
      return drafts.find(
        (draft) =>
          draft.targetScopeType === targetScopeType &&
          draft.changeDate === changeDate &&
          draft.periodNumber === periodNumber,
      )
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
        const replacement = draft?.replacement ??
          (layer.state === 'active' ? layer.replacement : undefined)
        if (replacement) {
          finalDailyLesson = resolvePreviewReplacement(replacement, resolveReference)
        }
        return replacement
          ? { ...layer, state: 'active' as const, replacement, desired: !!draft }
          : { ...layer, desired: false }
      })
      return {
        ...state,
        layers,
        finalDailyLesson: hasDraft ? finalDailyLesson : state.finalDailyLesson,
      }
    },
    toCommitPayload() {
      return {
        changes: drafts.map(({ sourceId, targetScopeType, changeDate, periodNumber, replacement }) => ({
          sourceId,
          targetScopeType,
          changeDate,
          periodNumber,
          replacement,
        })),
      }
    },
    commitFailed() {
      lastCommitFailed = true
      publish()
    },
    commitSucceeded() {
      editing = false
      drafts = []
      lastCommitFailed = false
      storage.removeItem(storageKey)
      snapshot = buildSnapshot()
      listeners.forEach((listener) => listener())
    },
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
  draft: Pick<TimetableChangeDraft, 'targetScopeType' | 'changeDate' | 'periodNumber'>,
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
      ? parsed.drafts.filter(isTimetableChangeDraft).slice(0, maximumDraftKeys)
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

function isTimetableChangeDraft(value: unknown): value is TimetableChangeDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return (
    typeof draft.sourceId === 'string' &&
    isTargetScopeType(draft.targetScopeType) &&
    typeof draft.changeDate === 'string' &&
    Number.isInteger(draft.periodNumber) &&
    isReplacement(draft.replacement)
  )
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
