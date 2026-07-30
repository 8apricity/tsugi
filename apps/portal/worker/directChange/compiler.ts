import type { ReadyStudentOperationalContext } from '../studentOperationalContext'
import {
  affiliationAssertion,
  sourceId,
  type AtomicApplicationProgram,
  type AtomicChange,
  type DirectChangeCatalog,
} from '../sharedInformationChange/atomicProgram'
import { targetScopesEqual } from '../targetScopePolicy'
import {
  isDirectChangeKind,
  parseDirectChange,
  type DirectChangeDraft,
} from './kindRules'

export type DirectChangeCompilationResult =
  | { status: 'compiled'; program: AtomicApplicationProgram }
  | { status: 'invalid-change'; sourceIds: string[] }

export async function compileDirectChanges({
  context,
  drafts,
  catalog,
  appliedAt,
}: {
  context: ReadyStudentOperationalContext
  drafts: unknown
  catalog: DirectChangeCatalog
  appliedAt: number
}): Promise<DirectChangeCompilationResult> {
  if (!Array.isArray(drafts) || drafts.length === 0 || drafts.length > 50) {
    return { status: 'invalid-change', sourceIds: [] }
  }

  const changes: AtomicChange[] = []
  for (const candidate of drafts as DirectChangeDraft[]) {
    if (!candidate || typeof candidate !== 'object') {
      return { status: 'invalid-change', sourceIds: [] }
    }
    const kind = candidate.kind ?? 'timetable_change'
    const changeKind = candidate.changeKind ?? 'add'
    if (!isDirectChangeKind(kind)) {
      return { status: 'invalid-change', sourceIds: candidateSourceIds(drafts) }
    }
    const change = await parseDirectChange(kind, {
      candidate,
      changeKind,
      context,
      catalog,
    })
    if (!change) {
      return { status: 'invalid-change', sourceIds: candidateSourceIds(drafts) }
    }
    changes.push(change)
  }

  if (hasDuplicateOperation(changes)) {
    return {
      status: 'invalid-change',
      sourceIds: changes.map((change) => sourceId(change.source)),
    }
  }
  return {
    status: 'compiled',
    program: {
      affiliation: affiliationAssertion(context),
      appliedAt,
      changes,
    },
  }
}

function hasDuplicateOperation(changes: readonly AtomicChange[]) {
  if (
    new Set(changes.map((change) => sourceId(change.source))).size !==
      changes.length
  ) return true

  return changes.some((change, index) =>
    changes.slice(0, index).some((candidate) => {
      if (
        change.kind === 'timetable_change' &&
        candidate.kind === 'timetable_change'
      ) {
        return targetScopesEqual(candidate.targetScope, change.targetScope) &&
          candidate.changeDate === change.changeDate &&
          candidate.periodNumber === change.periodNumber
      }
      return change.sharedInformationItemId ===
        candidate.sharedInformationItemId
    }),
  )
}

function candidateSourceIds(drafts: unknown[]) {
  return drafts.flatMap((candidate) =>
    candidate &&
      typeof candidate === 'object' &&
      typeof (candidate as { sourceId?: unknown }).sourceId === 'string'
      ? [(candidate as { sourceId: string }).sourceId]
      : [],
  )
}
