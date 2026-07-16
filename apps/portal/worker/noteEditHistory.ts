import type { NoteEditHistoryEntry, NoteEditHistoryResponse } from '../shared/noteEditHistory'
import type {
  DailyPlanStore,
  HistoricalNoteChange,
  NoteEditHistoryStore,
  StudentAccountAccessStore,
} from './persistence'
import { resolveStudentOperationalContext } from './studentOperationalContext'
import { targetScopeValue } from './targetScopeBoundary'
import { studentCanViewTargetScopeNamedAttribution } from './targetScopePolicy'

export async function readNoteEditHistory({
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
  historyStore: NoteEditHistoryStore
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

  const changes = await historyStore.listNoteEditHistory(
    sharedInformationItemId,
  )
  const selected = changes[0]
  if (
    !selected ||
    !studentCanViewTargetScopeNamedAttribution(
      context.studentAffiliation,
      selected.targetScope,
    )
  ) return { status: 'not-found' as const }

  const entries = reconstructNoteTransitions(changes)
  if (entries === null) return { status: 'unavailable' as const }
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

function reconstructNoteTransitions(changes: HistoricalNoteChange[]) {
  const first = changes.filter((change) => change.precedingChangeId === null)
  if (
    first.length !== 1 || first[0].changeKind !== 'add' ||
    first[0].snapshot === null
  ) return null
  const byPredecessor = new Map(
    changes
      .filter((change) => change.precedingChangeId !== null)
      .map((change) => [change.precedingChangeId, change]),
  )
  if (byPredecessor.size !== changes.length - 1) return null
  const ordered = [first[0]]
  while (ordered.length < changes.length) {
    const next = byPredecessor.get(ordered.at(-1)!.sharedInformationChangeId)
    if (!next || ordered.includes(next)) break
    ordered.push(next)
  }
  if (ordered.length !== changes.length) return null
  const byId = new Map(
    ordered.map((change) => [change.sharedInformationChangeId, change]),
  )
  const entries: NoteEditHistoryEntry[] = []
  for (const change of ordered) {
    const predecessor = change.precedingChangeId === null
      ? null
      : byId.get(change.precedingChangeId)
    if (
      change.changeKind !== 'add' && (!predecessor || !predecessor.snapshot)
    ) return null
    if (change.changeKind !== 'remove' && !change.snapshot) return null
    entries.push({
      sharedInformationChangeId: change.sharedInformationChangeId,
      changeKind: change.changeKind,
      sourceType: 'direct',
      primaryActorDisplayName: change.primaryActorDisplayName,
      changedAt: change.changedAt,
      before: change.changeKind === 'add' ? null : predecessor!.snapshot,
      after: change.changeKind === 'remove' ? null : change.snapshot,
      ...(change.changeKind === 'remove' && change.removalReason
        ? { removalReason: change.removalReason }
        : {}),
    })
  }
  return entries.reverse()
}
