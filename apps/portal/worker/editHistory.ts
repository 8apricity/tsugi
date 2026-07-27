import type {
  DailyPlanStore,
  EditHistoryStore,
  HistoricalNoteChange,
  HistoricalTaskChange,
  HistoricalTimetableChange,
  HistoricalTimetableChangeReplacement,
  NoteEditHistoryStore,
  StudentAccountAccessStore,
  TaskEditHistoryStore,
  TimetableChangeHistoryStore,
} from './persistence'
import type {
  NoteEditHistoryEntry,
  NoteEditHistoryResponse,
  NoteHistorySnapshot,
} from '../shared/noteEditHistory'
import type {
  SharedInformationChangeDetail,
  SharedInformationChangeSource,
} from '../shared/editHistory'
import type {
  TaskEditHistoryEntry,
  TaskEditHistoryResponse,
  TaskHistorySnapshot,
} from '../shared/taskEditHistory'
import { resolveStudentOperationalContext } from './studentOperationalContext'
import { targetScopeValue } from './targetScopeBoundary'
import {
  isTargetScopeType,
  studentCanViewTargetScopeNamedAttribution,
  targetScopeForStudentAffiliation,
} from './targetScopePolicy'
import { isValidSchoolDate } from './timetable'

export type TimetableChangeHistoryEntry = Omit<
  HistoricalTimetableChange,
  'replacement' | 'targetScope' |
  'changeDate' | 'periodNumber' | 'precedingChangeId'
> & {
  before: HistoricalTimetableChangeReplacement | null
  after: HistoricalTimetableChangeReplacement | null
}

type HistoryAccess = {
  sessionToken: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  dailyPlanStore: DailyPlanStore
}

export async function readTimetableChangeHistory({
  sessionToken,
  targetScopeType,
  changeDate,
  periodNumber,
  now,
  studentAccountStore,
  dailyPlanStore,
  historyStore,
}: HistoryAccess & {
  targetScopeType: string | null
  changeDate: string | null
  periodNumber: string | null
  historyStore: TimetableChangeHistoryStore
}) {
  const access = await currentHistoryAccess({
    sessionToken,
    now,
    studentAccountStore,
    dailyPlanStore,
  })
  if (access.status !== 'ready') return access
  const selectedPeriod = Number(periodNumber)
  if (
    !isTargetScopeType(targetScopeType) ||
    changeDate === null ||
    !isValidSchoolDate(changeDate) ||
    changeDate < access.schoolYear.startsOn ||
    changeDate > access.schoolYear.endsOn ||
    periodNumber === null ||
    !/^[1-7]$/.test(periodNumber) ||
    !Number.isInteger(selectedPeriod)
  ) {
    return { status: 'invalid-selection' as const }
  }
  const targetScope = targetScopeForStudentAffiliation(
    access.affiliation,
    targetScopeType,
  )
  const changes = await historyStore.listTimetableChangeHistory({
    targetScope,
    changeDate,
    periodNumber: selectedPeriod,
  })
  const entries = reconstructTimetableTransitions(changes, {
    targetScopeValue: targetScopeValue(targetScope),
    targetScopeType: targetScope.type,
    changeDate,
    periodNumber: selectedPeriod,
  })
  if (entries === null) return { status: 'unavailable' as const }
  return {
    status: 'ready' as const,
    targetScope: { type: targetScope.type, value: targetScopeValue(targetScope) },
    changeDate,
    periodNumber: selectedPeriod,
    entries,
  }
}

export async function readTaskEditHistory({
  sessionToken,
  sharedInformationItemId,
  now,
  studentAccountStore,
  dailyPlanStore,
  historyStore,
}: HistoryAccess & {
  sharedInformationItemId: string
  historyStore: TaskEditHistoryStore
}) {
  return readItemEditHistory<
    TaskHistorySnapshot,
    HistoricalTaskChange,
    TaskEditHistoryEntry,
    TaskEditHistoryResponse
  >({
    sessionToken,
    now,
    studentAccountStore,
    dailyPlanStore,
    sharedInformationItemId,
    loadChanges: () =>
      historyStore.listTaskEditHistory(sharedInformationItemId),
    toEntry: ({ change, before, after }) => {
      const entry = {
        sharedInformationChangeId: change.sharedInformationChangeId,
        changeKind: change.changeKind,
        changedAt: change.changedAt,
        before,
        after,
      }
      return change.sourceType === 'direct'
        ? {
            ...entry,
            sourceType: 'direct',
            primaryActorDisplayName: change.primaryActorDisplayName,
          }
        : { ...entry, sourceType: 'proposal' }
    },
    toResponse: (selected, entries) => ({
      status: 'ready',
      taskId: selected.sharedInformationItemId,
      targetScope: {
        type: selected.targetScope.type,
        value: targetScopeValue(selected.targetScope),
      },
      entries,
    }),
  })
}

export async function readNoteEditHistory({
  sessionToken,
  sharedInformationItemId,
  now,
  studentAccountStore,
  dailyPlanStore,
  historyStore,
}: HistoryAccess & {
  sharedInformationItemId: string
  historyStore: NoteEditHistoryStore
}) {
  return readItemEditHistory<
    NoteHistorySnapshot,
    HistoricalNoteChange,
    NoteEditHistoryEntry,
    NoteEditHistoryResponse
  >({
    sessionToken,
    now,
    studentAccountStore,
    dailyPlanStore,
    sharedInformationItemId,
    loadChanges: () =>
      historyStore.listNoteEditHistory(sharedInformationItemId),
    immutableKey: (change) =>
      `${scopeKey(change.targetScope)}:${
        noteRelatedContextKey(change.relatedContext)
      }`,
    toEntry: ({ change, before, after }) => ({
      sharedInformationChangeId: change.sharedInformationChangeId,
      changeKind: change.changeKind,
      sourceType: 'direct',
      primaryActorDisplayName: change.primaryActorDisplayName,
      changedAt: change.changedAt,
      before,
      after,
      ...(change.changeKind === 'remove' && change.removalReason
        ? { removalReason: change.removalReason }
        : {}),
    }),
    toResponse: (selected, entries) => ({
      status: 'ready',
      noteId: selected.sharedInformationItemId,
      targetScope: {
        type: selected.targetScope.type,
        value: targetScopeValue(selected.targetScope),
      },
      entries,
    }),
  })
}

export async function readSharedInformationChangeDetail({
  sessionToken,
  sharedInformationChangeId,
  now,
  studentAccountStore,
  dailyPlanStore,
  historyStore,
}: HistoryAccess & {
  sharedInformationChangeId: string
  historyStore: EditHistoryStore
}) {
  const access = await currentHistoryAccess({
    sessionToken,
    now,
    studentAccountStore,
    dailyPlanStore,
  })
  if (access.status !== 'ready') return access

  const identity = await historyStore.findSharedInformationChange(
    sharedInformationChangeId,
  )
  if (!identity) {
    return { status: 'not-found' as const }
  }
  const canView = (change: {
    targetScope: HistoricalTaskChange['targetScope']
  }) =>
    studentCanViewTargetScopeNamedAttribution(
      access.affiliation,
      change.targetScope,
    )

  switch (identity.kind) {
    case 'timetable_change':
      return readTimetableSharedInformationChangeDetail({
        sharedInformationChangeId,
        sharedInformationItemId: identity.sharedInformationItemId,
        changes: await historyStore.listTimetableChangeItemHistory(
          identity.sharedInformationItemId,
        ),
        canView,
      })
    case 'task':
      return readItemSharedInformationChangeDetail<
        TaskHistorySnapshot,
        HistoricalTaskChange
      >({
        sharedInformationChangeId,
        sharedInformationItemId: identity.sharedInformationItemId,
        changes: await historyStore.listTaskEditHistory(
          identity.sharedInformationItemId,
        ),
        canView,
        toDetail: (common) => ({ ...common, kind: 'task' }),
      })
    case 'note':
      return readItemSharedInformationChangeDetail<
        NoteHistorySnapshot,
        HistoricalNoteChange
      >({
        sharedInformationChangeId,
        sharedInformationItemId: identity.sharedInformationItemId,
        changes: await historyStore.listNoteEditHistory(
          identity.sharedInformationItemId,
        ),
        canView,
        immutableKey: (change) =>
          `${scopeKey(change.targetScope)}:${
            noteRelatedContextKey(change.relatedContext)
          }`,
        toDetail: (common, change) => ({
          ...common,
          kind: 'note',
          ...(change.changeKind === 'remove' && change.removalReason
            ? { removalReason: change.removalReason }
            : {}),
        }),
      })
  }
}

type CanViewHistoricalChange = (change: {
  targetScope: HistoricalTaskChange['targetScope']
}) => boolean

function readTimetableSharedInformationChangeDetail({
  sharedInformationChangeId,
  sharedInformationItemId,
  changes,
  canView,
}: {
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changes: HistoricalTimetableChange[]
  canView: CanViewHistoricalChange
}) {
  if (
    changes.some((change) =>
      change.sharedInformationItemId !== sharedInformationItemId
    )
  ) return { status: 'unavailable' as const }
  const selected = changes.find(
    (change) =>
      change.sharedInformationChangeId === sharedInformationChangeId,
  )
  if (!selected || !canView(selected)) {
    return { status: 'not-found' as const }
  }
  const entries = reconstructTimetableTransitions(changes, {
    targetScopeType: selected.targetScope.type,
    targetScopeValue: targetScopeValue(selected.targetScope),
    changeDate: selected.changeDate,
    periodNumber: selected.periodNumber,
  })
  if (entries === null) return { status: 'unavailable' as const }
  const entry = entries.find(
    (candidate) =>
      candidate.sharedInformationChangeId === sharedInformationChangeId,
  )
  if (!entry) return { status: 'not-found' as const }
  const detail: SharedInformationChangeDetail = {
    status: 'ready',
    kind: 'timetable_change',
    sharedInformationChangeId,
    sharedInformationItemId,
    changeKind: entry.changeKind,
    source: changeSource(entry),
    changedAt: entry.changedAt,
    targetScope: {
      type: selected.targetScope.type,
      value: targetScopeValue(selected.targetScope),
    },
    changeDate: selected.changeDate,
    periodNumber: selected.periodNumber,
    before: entry.before,
    after: entry.after,
  }
  return detail
}

type ItemChangeDetailCommon<TSnapshot> = {
  status: 'ready'
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changeKind: 'add' | 'update' | 'remove'
  source: SharedInformationChangeSource
  changedAt: number
  targetScope: {
    type: HistoricalTaskChange['targetScope']['type']
    value: string
  }
  before: TSnapshot | null
  after: TSnapshot | null
}

function readItemSharedInformationChangeDetail<
  TSnapshot,
  TChange extends ItemHistoryChange<TSnapshot> & {
    sourceType: 'direct' | 'proposal'
    primaryActorDisplayName?: string
    changedAt: number
  },
>({
  sharedInformationChangeId,
  sharedInformationItemId,
  changes,
  canView,
  immutableKey,
  toDetail,
}: {
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changes: TChange[]
  canView: CanViewHistoricalChange
  immutableKey?: (change: TChange) => string
  toDetail: (
    common: ItemChangeDetailCommon<TSnapshot>,
    change: TChange,
  ) => SharedInformationChangeDetail
}) {
  const selected = changes.find(
    (change) =>
      change.sharedInformationChangeId === sharedInformationChangeId,
  )
  if (!selected || !canView(selected)) {
    return { status: 'not-found' as const }
  }
  const transitions = reconstructItemTransitions<TSnapshot, TChange>(
    changes,
    sharedInformationItemId,
    immutableKey,
  )
  if (transitions === null) return { status: 'unavailable' as const }
  const transition = transitions.find(
    ({ change }) =>
      change.sharedInformationChangeId === sharedInformationChangeId,
  )
  if (!transition) return { status: 'not-found' as const }
  return toDetail({
    status: 'ready',
    sharedInformationChangeId,
    sharedInformationItemId,
    changeKind: transition.change.changeKind,
    source: changeSource(transition.change),
    changedAt: transition.change.changedAt,
    targetScope: {
      type: selected.targetScope.type,
      value: targetScopeValue(selected.targetScope),
    },
    before: transition.before,
    after: transition.after,
  }, transition.change)
}

function changeSource(change: {
  sourceType: 'direct' | 'proposal'
  primaryActorDisplayName?: string
}): SharedInformationChangeSource {
  return change.sourceType === 'direct'
    ? {
        type: 'direct',
        primaryActorDisplayName: change.primaryActorDisplayName ?? '',
      }
    : { type: 'proposal' }
}

type ItemHistoryChange<TSnapshot> = {
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changeKind: 'add' | 'update' | 'remove'
  targetScope: HistoricalTaskChange['targetScope']
  precedingChangeId: string | null
  snapshot: TSnapshot | null
}

type ItemHistoryTransition<TSnapshot, TChange> = {
  change: TChange
  before: TSnapshot | null
  after: TSnapshot | null
}

async function readItemEditHistory<
  TSnapshot,
  TChange extends ItemHistoryChange<TSnapshot>,
  TEntry,
  TResponse,
>({
  sessionToken,
  now,
  studentAccountStore,
  dailyPlanStore,
  sharedInformationItemId,
  loadChanges,
  immutableKey,
  toEntry,
  toResponse,
}: HistoryAccess & {
  sharedInformationItemId: string
  loadChanges: () => Promise<TChange[]>
  immutableKey?: (change: TChange) => string
  toEntry: (
    transition: ItemHistoryTransition<TSnapshot, TChange>,
  ) => TEntry
  toResponse: (selected: TChange, entries: TEntry[]) => TResponse
}) {
  const access = await currentHistoryAccess({
    sessionToken,
    now,
    studentAccountStore,
    dailyPlanStore,
  })
  if (access.status !== 'ready') return access

  const changes = await loadChanges()
  const selected = changes[0]
  if (
    !selected ||
    !studentCanViewTargetScopeNamedAttribution(
      access.affiliation,
      selected.targetScope,
    )
  ) {
    return { status: 'not-found' as const }
  }
  const transitions = reconstructItemTransitions<TSnapshot, TChange>(
    changes,
    sharedInformationItemId,
    immutableKey,
  )
  if (transitions === null) return { status: 'unavailable' as const }
  return toResponse(selected, transitions.map(toEntry).reverse())
}

function reconstructItemTransitions<
  TSnapshot,
  TChange extends ItemHistoryChange<TSnapshot>,
>(
  changes: TChange[],
  expectedItemId: string,
  immutableKey: (change: TChange) => string = (change) =>
    scopeKey(change.targetScope),
) {
  const selected = changes[0]
  if (!selected) return null
  const expectedImmutableKey = immutableKey(selected)
  if (
    changes.some((change) =>
      change.sharedInformationItemId !== expectedItemId ||
      immutableKey(change) !== expectedImmutableKey
    )
  ) return null
  const ordered = orderItemChanges(changes)
  if (ordered === null) return null
  const transitions: Array<ItemHistoryTransition<TSnapshot, TChange>> = []
  let previous: TSnapshot | null = null
  for (const [index, change] of ordered.entries()) {
    if (
      (index > 0 && change.changeKind === 'add') ||
      (change.changeKind === 'add' && change.snapshot === null) ||
      (change.changeKind === 'update' && change.snapshot === null) ||
      (change.changeKind === 'remove' && change.snapshot !== null) ||
      (change.changeKind !== 'add' && previous === null)
    ) return null
    transitions.push({
      change,
      before: change.changeKind === 'add' ? null : previous,
      after: change.changeKind === 'remove' ? null : change.snapshot,
    })
    previous = change.snapshot
  }
  return transitions
}

function scopeKey(scope: HistoricalTaskChange['targetScope']) {
  return `${scope.schoolYear}:${scope.type}:${targetScopeValue(scope)}`
}

function noteRelatedContextKey(
  context: HistoricalNoteChange['relatedContext'],
) {
  if (context === null || context.type === 'none') {
    return context?.type ?? 'invalid'
  }
  if (context.type === 'school_date') {
    return `${context.type}:${context.schoolDate}`
  }
  if (context.type === 'daily_lesson') {
    return `${context.type}:${context.schoolDate}:${context.periodNumber}`
  }
  return `${context.type}:${context.taskItemId}`
}

function reconstructTimetableTransitions(
  changes: HistoricalTimetableChange[],
  expected: {
    targetScopeType: HistoricalTimetableChange['targetScope']['type']
    targetScopeValue: string
    changeDate: string
    periodNumber: number
  },
) {
  const byItem = new Map<string, HistoricalTimetableChange[]>()
  for (const change of changes) {
    if (
      change.targetScope.type !== expected.targetScopeType ||
      targetScopeValue(change.targetScope) !== expected.targetScopeValue ||
      change.changeDate !== expected.changeDate ||
      change.periodNumber !== expected.periodNumber
    ) return null
    const item = byItem.get(change.sharedInformationItemId) ?? []
    item.push(change)
    byItem.set(change.sharedInformationItemId, item)
  }

  const entries: Array<{
    entry: TimetableChangeHistoryEntry
    itemOrder: number
  }> = []
  for (const [itemId, itemChanges] of byItem) {
    const transitions = reconstructItemTransitions<
      HistoricalTimetableChangeReplacement,
      HistoricalTimetableChange & {
        snapshot: HistoricalTimetableChangeReplacement | null
      }
    >(
      itemChanges.map((change) => ({
        ...change,
        snapshot: change.replacement,
      })),
      itemId,
    )
    if (transitions === null) return null
    for (const [itemOrder, { change, before, after }] of
      transitions.entries()) {
      entries.push({
        entry: {
          sharedInformationChangeId: change.sharedInformationChangeId,
          sharedInformationItemId: change.sharedInformationItemId,
          changeKind: change.changeKind,
          sourceType: change.sourceType,
          primaryActorDisplayName: change.primaryActorDisplayName,
          changedAt: change.changedAt,
          before,
          after,
        },
        itemOrder,
      })
    }
  }
  return entries.sort((left, right) => {
    const timeOrder = right.entry.changedAt - left.entry.changedAt
    if (timeOrder !== 0) return timeOrder
    if (
      left.entry.sharedInformationItemId ===
        right.entry.sharedInformationItemId
    ) {
      return right.itemOrder - left.itemOrder
    }
    return right.entry.sharedInformationChangeId.localeCompare(
      left.entry.sharedInformationChangeId,
    )
  }).map(({ entry }) => entry)
}

function orderItemChanges<TChange extends {
  sharedInformationChangeId: string
  precedingChangeId: string | null
  changeKind: 'add' | 'update' | 'remove'
}>(changes: TChange[]) {
  const firstChanges = changes.filter(
    (change) => change.precedingChangeId === null,
  )
  if (firstChanges.length !== 1 || firstChanges[0].changeKind !== 'add') {
    return null
  }
  const byChangeId = new Map(
    changes.map((change) => [change.sharedInformationChangeId, change]),
  )
  if (byChangeId.size !== changes.length) return null
  const byPredecessor = new Map(
    changes
      .filter((change) => change.precedingChangeId !== null)
      .map((change) => [change.precedingChangeId, change]),
  )
  if (byPredecessor.size !== changes.length - 1) return null
  const ordered = [firstChanges[0]]
  while (ordered.length < changes.length) {
    const next = byPredecessor.get(
      ordered.at(-1)!.sharedInformationChangeId,
    )
    if (!next || ordered.includes(next)) return null
    ordered.push(next)
  }
  return ordered
}

async function currentHistoryAccess({
  sessionToken,
  now,
  studentAccountStore,
  dailyPlanStore,
}: HistoryAccess) {
  const context = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore: dailyPlanStore,
  })
  if (context.status === 'unauthenticated') return context
  if (context.status === 'school-year-unavailable') {
    return { status: 'unavailable' as const }
  }
  if (context.status === 'affiliation-renewal-needed') {
    return {
      status: context.status,
      schoolYear: context.currentSchoolYear.schoolYear,
    }
  }
  return {
    status: 'ready' as const,
    schoolYear: context.currentSchoolYear,
    affiliation: context.studentAffiliation,
  }
}
