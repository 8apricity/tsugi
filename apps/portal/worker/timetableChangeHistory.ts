import type {
  DailyPlanStore,
  HistoricalTimetableChange,
  HistoricalTimetableChangeReplacement,
  StudentAccountAccessStore,
  TimetableChangeHistoryStore,
} from './persistence'
import { resolveStudentOperationalContext } from './studentOperationalContext'
import { targetScopeValue } from './targetScopeBoundary'
import {
  isTargetScopeType,
  studentCanViewTargetScopeNamedAttribution,
  targetScopeForStudentAffiliation,
} from './targetScopePolicy'
import { isValidSchoolDate } from './timetable'

export type ProposalHistoryParticipants = {
  proposerDisplayName: string
  approvingStudentDisplayNames: string[]
  rejectingStudentDisplayNames: string[]
}

export type TimetableChangeHistoryEntry = Omit<
  HistoricalTimetableChange,
  'replacement' | 'targetScope' |
  'changeDate' | 'periodNumber' | 'precedingChangeId'
> & {
  before: HistoricalTimetableChangeReplacement | null
  after: HistoricalTimetableChangeReplacement | null
  proposalParticipants?: ProposalHistoryParticipants
}

type HistoryAccess = {
  sessionToken: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  dailyPlanStore: DailyPlanStore
  historyStore: TimetableChangeHistoryStore
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
  return {
    status: 'ready' as const,
    targetScope: { type: targetScope.type, value: targetScopeValue(targetScope) },
    changeDate,
    periodNumber: selectedPeriod,
    entries: reconstructTransitions(changes),
  }
}

export async function readDirectTimetableChangeDetail({
  sessionToken,
  sharedInformationChangeId,
  now,
  studentAccountStore,
  dailyPlanStore,
  historyStore,
}: HistoryAccess & { sharedInformationChangeId: string }) {
  const access = await currentHistoryAccess({
    sessionToken,
    now,
    studentAccountStore,
    dailyPlanStore,
  })
  if (access.status !== 'ready') return access
  const changes = await historyStore.listTimetableChangeItemHistoryByChangeId(
    sharedInformationChangeId,
  )
  const selected = changes.find(
    (change) => change.sharedInformationChangeId === sharedInformationChangeId,
  )
  if (
    !selected ||
    selected.sourceType !== 'direct' ||
    !studentCanViewTargetScopeNamedAttribution(
      access.affiliation,
      selected.targetScope,
    )
  ) {
    return { status: 'not-found' as const }
  }
  const entry = reconstructTransitions(changes).find(
    (change) => change.sharedInformationChangeId === sharedInformationChangeId,
  )!
  return {
    status: 'ready' as const,
    ...entry,
    targetScope: {
      type: selected.targetScope.type,
      value: targetScopeValue(selected.targetScope),
    },
    changeDate: selected.changeDate,
    periodNumber: selected.periodNumber,
  }
}

function reconstructTransitions(changes: HistoricalTimetableChange[]) {
  const byItem = new Map<string, HistoricalTimetableChange[]>()
  for (const change of changes) {
    const item = byItem.get(change.sharedInformationItemId) ?? []
    item.push(change)
    byItem.set(change.sharedInformationItemId, item)
  }
  const entries: Array<{
    entry: TimetableChangeHistoryEntry
    itemOrder: number
  }> = []
  for (const itemChanges of byItem.values()) {
    sortItemChanges(itemChanges)
    let previous: HistoricalTimetableChangeReplacement | null = null
    for (const [itemOrder, change] of itemChanges.entries()) {
      entries.push({ entry: {
        sharedInformationChangeId: change.sharedInformationChangeId,
        sharedInformationItemId: change.sharedInformationItemId,
        changeKind: change.changeKind,
        sourceType: change.sourceType,
        primaryActorDisplayName: change.primaryActorDisplayName,
        changedAt: change.changedAt,
        before: change.changeKind === 'add' ? null : previous,
        after: change.changeKind === 'remove' ? null : change.replacement,
      }, itemOrder })
      if (change.replacement !== null) previous = change.replacement
    }
  }
  return entries.sort((left, right) => {
    const timeOrder = right.entry.changedAt - left.entry.changedAt
    if (timeOrder !== 0) return timeOrder
    if (left.entry.sharedInformationItemId === right.entry.sharedInformationItemId) {
      return right.itemOrder - left.itemOrder
    }
    return right.entry.sharedInformationChangeId.localeCompare(
      left.entry.sharedInformationChangeId,
    )
  }).map(({ entry }) => entry)
}

function sortItemChanges(itemChanges: HistoricalTimetableChange[]) {
  const fallback = [...itemChanges].sort((left, right) =>
    left.changedAt - right.changedAt ||
    left.sharedInformationChangeId.localeCompare(right.sharedInformationChangeId),
  )
  const byPredecessor = new Map(
    itemChanges
      .filter((change) => change.precedingChangeId !== null)
      .map((change) => [change.precedingChangeId, change]),
  )
  const first = itemChanges.find((change) => change.precedingChangeId === null)
  if (!first) {
    itemChanges.splice(0, itemChanges.length, ...fallback)
    return
  }
  const ordered = [first]
  while (ordered.length < itemChanges.length) {
    const next = byPredecessor.get(
      ordered[ordered.length - 1].sharedInformationChangeId,
    )
    if (!next || ordered.includes(next)) break
    ordered.push(next)
  }
  itemChanges.splice(
    0,
    itemChanges.length,
    ...(ordered.length === itemChanges.length ? ordered : fallback),
  )
}

async function currentHistoryAccess({
  sessionToken,
  now,
  studentAccountStore,
  dailyPlanStore,
}: Omit<HistoryAccess, 'historyStore'>) {
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
