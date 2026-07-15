import type {
  DailyPlanStore,
  HistoricalTaskChange,
  StudentAccountAccessStore,
  TaskEditHistoryStore,
} from './persistence'
import { resolveStudentOperationalContext } from './studentOperationalContext'
import { targetScopeValue } from './targetScopeBoundary'
import { studentCanViewTargetScopeNamedAttribution } from './targetScopePolicy'
import type {
  TaskEditHistoryEntry,
  TaskEditHistoryResponse,
} from '../shared/taskEditHistory'

export async function readTaskEditHistory({
  sessionToken,
  sharedInformationItemId,
  now,
  studentAccountStore,
  dailyPlanStore,
  historyStore,
}: {
  sessionToken: string | null
  sharedInformationItemId: string
  now: number
  studentAccountStore: StudentAccountAccessStore
  dailyPlanStore: DailyPlanStore
  historyStore: TaskEditHistoryStore
}) {
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

  const changes = await historyStore.listTaskEditHistory(
    sharedInformationItemId,
  )
  const selected = changes[0]
  if (
    !selected ||
    !studentCanViewTargetScopeNamedAttribution(
      context.studentAffiliation,
      selected.targetScope,
    )
  ) {
    return { status: 'not-found' as const }
  }

  const entries = reconstructTaskTransitions(changes)
  if (entries === null) return { status: 'unavailable' as const }
  const response: TaskEditHistoryResponse = {
    status: 'ready' as const,
    taskId: selected.sharedInformationItemId,
    targetScope: {
      type: selected.targetScope.type,
      value: targetScopeValue(selected.targetScope),
    },
    entries,
  }
  return response
}

function reconstructTaskTransitions(changes: HistoricalTaskChange[]) {
  const firstChanges = changes.filter(
    (change) => change.precedingChangeId === null,
  )
  if (
    firstChanges.length !== 1 ||
    firstChanges[0].changeKind !== 'add' ||
    firstChanges[0].snapshot === null
  ) return null
  const byPredecessor = new Map(
    changes
      .filter((change) => change.precedingChangeId !== null)
      .map((change) => [change.precedingChangeId, change]),
  )
  if (byPredecessor.size !== changes.length - 1) return null
  const ordered = [firstChanges[0]]
  while (ordered.length < changes.length) {
    const latest = ordered.at(-1)!
    const next = byPredecessor.get(latest.sharedInformationChangeId)
    if (!next || ordered.includes(next)) break
    ordered.push(next)
  }
  if (ordered.length !== changes.length) return null
  const byChangeId = new Map(
    ordered.map((change) => [change.sharedInformationChangeId, change]),
  )
  if (byChangeId.size !== changes.length) return null
  const entries: TaskEditHistoryEntry[] = []
  for (const change of ordered) {
    const predecessor = change.precedingChangeId === null
      ? null
      : byChangeId.get(change.precedingChangeId)
    if (
      change.changeKind !== 'add' &&
      (!predecessor || predecessor.snapshot === null)
    ) return null
    if (change.changeKind !== 'remove' && change.snapshot === null) {
      return null
    }
    const entry = {
      sharedInformationChangeId: change.sharedInformationChangeId,
      changeKind: change.changeKind,
      changedAt: change.changedAt,
      before: change.changeKind === 'add' ? null : predecessor!.snapshot,
      after: change.changeKind === 'remove' ? null : change.snapshot,
    }
    entries.push(change.sourceType === 'direct'
      ? {
          ...entry,
          sourceType: 'direct',
          primaryActorDisplayName: change.primaryActorDisplayName,
        }
      : { ...entry, sourceType: 'proposal' })
  }
  return entries.reverse()
}
