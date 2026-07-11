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

type StorageLike = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

const storageKey = 'tsugi:timetable-direct-add-drafts:v1'

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
  let snapshot = buildSnapshot()
  const listeners = new Set<() => void>()

  function buildSnapshot() {
    return {
      editing,
      lastTargetScopeType,
      drafts: [...drafts],
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
      lastTargetScopeType = 'track'
      storage.removeItem(storageKey)
      snapshot = buildSnapshot()
      listeners.forEach((listener) => listener())
    },
    saveDraft(
      input: Omit<TimetableChangeDraft, 'sourceId'>,
      previousSourceId?: string,
    ) {
      const key = draftKey(input)
      const existing = drafts.find((draft) => draftKey(draft) === key)
      const sourceId =
        existing?.sourceId ??
        (previousSourceId && drafts.some((draft) => draft.sourceId === previousSourceId)
          ? previousSourceId
          : createId())

      drafts = drafts.filter(
        (draft) => draftKey(draft) !== key && draft.sourceId !== previousSourceId,
      )
      drafts.push({ ...input, sourceId })
      lastTargetScopeType = input.targetScopeType
      editing = true
      publish()
      return sourceId
    },
    deleteDraft(sourceId: string) {
      drafts = drafts.filter((draft) => draft.sourceId !== sourceId)
      publish()
    },
    findDraft(targetScopeType: TargetScopeType, changeDate: string, periodNumber: number) {
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
    toCommitPayload() {
      return { changes: [...drafts] }
    },
    commitSucceeded() {
      editing = false
      drafts = []
      storage.removeItem(storageKey)
      snapshot = buildSnapshot()
      listeners.forEach((listener) => listener())
    },
  }
}

function draftKey(draft: Pick<TimetableChangeDraft, 'targetScopeType' | 'changeDate' | 'periodNumber'>) {
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
      ? parsed.drafts.filter(isTimetableChangeDraft)
      : []

    return {
      editing: parsed.editing === true,
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
    !!draft.replacement &&
    typeof draft.replacement === 'object'
  )
}

function isTargetScopeType(value: unknown): value is TargetScopeType {
  return value === 'grade' || value === 'class' || value === 'track' || value === 'student'
}
