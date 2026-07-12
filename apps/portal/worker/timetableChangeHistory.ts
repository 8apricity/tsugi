import type {
  DailyPlanStore,
  HistoricalTimetableChange,
  HistoricalTimetableChangeReplacement,
  StudentAccountAccessStore,
  StudentAffiliation,
  TargetScopeType,
  TimetableChangeHistoryStore,
} from './persistence'
import { readStudentSession } from './studentAccountAccess'
import { isValidSchoolDate } from './timetable'

export type ProposalHistoryParticipants = {
  proposerDisplayName: string
  approvingStudentDisplayNames: string[]
  rejectingStudentDisplayNames: string[]
}

export type TimetableChangeHistoryEntry = Omit<
  HistoricalTimetableChange,
  'replacement' | 'schoolYear' | 'targetScopeType' | 'targetScopeValue' |
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
  const targetScopeValue = affiliationScopeValue(
    access.affiliation,
    targetScopeType,
  )
  const changes = await historyStore.listTimetableChangeHistory({
    schoolYear: access.schoolYear.schoolYear,
    targetScopeType,
    targetScopeValue,
    changeDate,
    periodNumber: selectedPeriod,
  })
  return {
    status: 'ready' as const,
    targetScope: { type: targetScopeType, value: targetScopeValue },
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
    !affiliationIncludes(access.affiliation, selected)
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
      type: selected.targetScopeType,
      value: selected.targetScopeValue,
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
  const session = await readStudentSession({
    sessionToken,
    now,
    store: studentAccountStore,
  })
  if (session.status === 'unauthenticated') return session
  const schoolYear = await dailyPlanStore.findCurrentSchoolYear()
  if (!schoolYear) return { status: 'unavailable' as const }
  const affiliation = await dailyPlanStore.findCurrentStudentAffiliation(
    session.studentAccount.studentAccountId,
    schoolYear.schoolYear,
  )
  if (!affiliation) {
    return {
      status: 'affiliation-renewal-needed' as const,
      schoolYear: schoolYear.schoolYear,
    }
  }
  return { status: 'ready' as const, schoolYear, affiliation }
}

function affiliationIncludes(
  affiliation: StudentAffiliation,
  change: Pick<
    HistoricalTimetableChange,
    'schoolYear' | 'targetScopeType' | 'targetScopeValue'
  >,
) {
  return change.schoolYear === affiliation.schoolYear &&
    affiliationScopeValue(affiliation, change.targetScopeType) ===
      change.targetScopeValue
}

function affiliationScopeValue(
  affiliation: StudentAffiliation,
  targetScopeType: TargetScopeType,
) {
  if (targetScopeType === 'grade') return String(affiliation.grade)
  if (targetScopeType === 'class') return affiliation.classId
  if (targetScopeType === 'track') return affiliation.trackId
  return affiliation.studentAccountId
}

function isTargetScopeType(value: string | null): value is TargetScopeType {
  return value === 'grade' || value === 'class' || value === 'track' ||
    value === 'student'
}
