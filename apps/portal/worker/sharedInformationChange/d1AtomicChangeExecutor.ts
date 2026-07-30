import type {
  MaterializedSharedInformationChange,
} from './materializedChange'
import type {
  AtomicChangeExecutor,
  DirectChangeCatalog,
  StudentAffiliationAssertion,
} from './atomicProgram'
import {
  evaluateAtomicExecution,
  type AtomicExecutionSnapshot,
} from './executionPolicy'
import { executeAtomicProgram } from './executor'
import {
  rethrowKnownStorageUnavailable,
} from './storageError'

export interface D1AtomicChangeBackend {
  loadSnapshot(
    changes: readonly MaterializedSharedInformationChange[],
    affiliation?: StudentAffiliationAssertion,
  ): Promise<AtomicExecutionSnapshot>
  commit(
    pending: readonly MaterializedSharedInformationChange[],
    affiliation?: StudentAffiliationAssertion,
  ): Promise<void>
}

export function createD1AtomicChangeExecutor(
  backend: D1AtomicChangeBackend,
): AtomicChangeExecutor {
  return {
    async execute(program) {
      try {
        return await executeAtomicProgram({
          apply: (changes, affiliation) =>
            applyMaterializedChangesToD1Backend(
              backend,
              changes,
              affiliation,
            ),
        }, program)
      } catch (error) {
        rethrowKnownStorageUnavailable(error)
      }
    },
  }
}

export async function applyMaterializedChangesToD1Backend(
  backend: D1AtomicChangeBackend,
  changes: MaterializedSharedInformationChange[],
  affiliation?: StudentAffiliationAssertion,
) {
  const decision = evaluateAtomicExecution(
    changes,
    await backend.loadSnapshot(changes, affiliation),
  )
  if (decision.status === 'applied') {
    return { status: 'applied' as const, changes }
  }
  if (decision.status !== 'ready') return mapDecision(decision)
  try {
    await backend.commit(decision.pending, affiliation)
  } catch (error) {
    const retry = evaluateAtomicExecution(
      changes,
      await backend.loadSnapshot(changes, affiliation),
    )
    if (retry.status === 'applied') {
      return { status: 'applied' as const, changes }
    }
    if (retry.status !== 'ready') return mapDecision(retry)
    throw error
  }
  return { status: 'applied' as const, changes }
}

function mapDecision(
  decision: Exclude<
    ReturnType<typeof evaluateAtomicExecution>,
    { status: 'applied' | 'ready' }
  >,
) {
  return decision.status === 'invalid-change'
    ? { status: 'invalid-change' as const }
    : {
        status: decision.status,
        conflictingSourceIds: decision.sourceIds,
      }
}

export function createD1DirectChangeCatalog(
  catalog: DirectChangeCatalog,
): DirectChangeCatalog {
  return {
    async findRegisteredLessonName(registeredLessonNameId) {
      try {
        return await catalog.findRegisteredLessonName(registeredLessonNameId)
      } catch (error) {
        rethrowKnownStorageUnavailable(error)
      }
    },
    async findFloatingLessonReferenceLabel(
      floatingLessonReferenceLabelId,
      schoolYear,
      grade,
    ) {
      try {
        return await catalog.findFloatingLessonReferenceLabel(
          floatingLessonReferenceLabelId,
          schoolYear,
          grade,
        )
      } catch (error) {
        rethrowKnownStorageUnavailable(error)
      }
    },
  }
}
