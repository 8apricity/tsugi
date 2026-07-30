import type {
  AtomicChangeExecutor,
  DirectChangeApplication,
  DirectChangeCatalog,
} from '../sharedInformationChange/atomicProgram'
import { compileDirectChanges } from './compiler'

export function createDirectChangeApplication({
  catalog,
  executor,
  clock,
}: {
  catalog: DirectChangeCatalog
  executor: AtomicChangeExecutor
  clock: () => number
}): DirectChangeApplication {
  return {
    async apply({ context, drafts }) {
      const compiled = await compileDirectChanges({
        context,
        drafts,
        catalog,
        appliedAt: clock(),
      })
      if (compiled.status === 'invalid-change') return compiled
      return executor.execute(compiled.program)
    },
  }
}
