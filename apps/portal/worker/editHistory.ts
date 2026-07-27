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
  const access = await currentHistoryAccess({
    sessionToken,
    now,
    studentAccountStore,
    dailyPlanStore,
  })
  if (access.status !== 'ready') return access

  const changes = await historyStore.listTaskEditHistory(
    sharedInformationItemId,
  )
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

  const transitions = reconstructItemTransitions<
    TaskHistorySnapshot,
    HistoricalTaskChange
  >(
    changes,
    sharedInformationItemId,
  )
  if (transitions === null) return { status: 'unavailable' as const }
  const entries: TaskEditHistoryEntry[] = transitions.map(({
    change,
    before,
    after,
  }): TaskEditHistoryEntry => {
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
  }).reverse()
  const response: TaskEditHistoryResponse = {
    status: 'ready',
    taskId: selected.sharedInformationItemId,
    targetScope: {
      type: selected.targetScope.type,
      value: targetScopeValue(selected.targetScope),
    },
    entries,
  }
  return response
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
  const access = await currentHistoryAccess({
    sessionToken,
    now,
    studentAccountStore,
    dailyPlanStore,
  })
  if (access.status !== 'ready') return access

  const changes = await historyStore.listNoteEditHistory(
    sharedInformationItemId,
  )
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
  const transitions = reconstructItemTransitions<
    NoteHistorySnapshot,
    HistoricalNoteChange
  >(changes, sharedInformationItemId)
  if (transitions === null) return { status: 'unavailable' as const }
  const entries: NoteEditHistoryEntry[] = transitions.map(({
    change,
    before,
    after,
  }): NoteEditHistoryEntry => ({
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
  })).reverse()
  const response: NoteEditHistoryResponse = {
    status: 'ready',
    noteId: selected.sharedInformationItemId,
    targetScope: {
      type: selected.targetScope.type,
      value: targetScopeValue(selected.targetScope),
    },
    entries,
  }
  return response
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
  if (identity.kind === 'timetable_change') {
    const changes = await historyStore.listTimetableChangeItemHistory(
      identity.sharedInformationItemId,
    )
    if (
      changes.some((change) =>
        change.sharedInformationItemId !== identity.sharedInformationItemId
      )
    ) return { status: 'unavailable' as const }
    const selected = changes.find(
      (change) =>
        change.sharedInformationChangeId === sharedInformationChangeId,
    )
    if (
      !selected ||
      !studentCanViewTargetScopeNamedAttribution(
        access.affiliation,
        selected.targetScope,
      )
    ) {
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
      sharedInformationItemId: identity.sharedInformationItemId,
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
  const changes = identity.kind === 'task'
    ? await historyStore.listTaskEditHistory(identity.sharedInformationItemId)
    : await historyStore.listNoteEditHistory(identity.sharedInformationItemId)
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
  const transitions = identity.kind === 'task'
    ? reconstructItemTransitions<TaskHistorySnapshot, HistoricalTaskChange>(
        changes as HistoricalTaskChange[],
        identity.sharedInformationItemId,
      )
    : reconstructItemTransitions<NoteHistorySnapshot, HistoricalNoteChange>(
        changes as HistoricalNoteChange[],
        identity.sharedInformationItemId,
      )
  if (transitions === null) return { status: 'unavailable' as const }
  const transition = transitions.find(
    ({ change }) =>
      change.sharedInformationChangeId === sharedInformationChangeId,
  )
  if (!transition) return { status: 'not-found' as const }
  const common = {
    status: 'ready',
    sharedInformationChangeId,
    sharedInformationItemId: identity.sharedInformationItemId,
    changeKind: transition.change.changeKind,
    source: changeSource(transition.change),
    changedAt: transition.change.changedAt,
    targetScope: {
      type: selected.targetScope.type,
      value: targetScopeValue(selected.targetScope),
    },
    before: transition.before,
    after: transition.after,
  } as const
  const detail: SharedInformationChangeDetail = identity.kind === 'task'
    ? {
        ...common,
        kind: 'task',
        before: transition.before as TaskHistorySnapshot | null,
        after: transition.after as TaskHistorySnapshot | null,
      }
    : {
        ...common,
        kind: 'note',
        before: transition.before as NoteHistorySnapshot | null,
        after: transition.after as NoteHistorySnapshot | null,
        ...(transition.change.changeKind === 'remove' &&
          (transition.change as HistoricalNoteChange).removalReason
          ? {
              removalReason:
                (transition.change as HistoricalNoteChange).removalReason!,
            }
          : {}),
      }
  return detail
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

function reconstructItemTransitions<
  TSnapshot,
  TChange extends ItemHistoryChange<TSnapshot>,
>(
  changes: TChange[],
  expectedItemId: string,
) {
  const selected = changes[0]
  if (!selected) return null
  const expectedScopeKey = scopeKey(selected.targetScope)
  if (
    changes.some((change) =>
      change.sharedInformationItemId !== expectedItemId ||
      scopeKey(change.targetScope) !== expectedScopeKey
    )
  ) return null
  const ordered = orderItemChanges(changes)
  if (ordered === null) return null
  const transitions: Array<{
    change: TChange
    before: TSnapshot | null
    after: TSnapshot | null
  }> = []
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
