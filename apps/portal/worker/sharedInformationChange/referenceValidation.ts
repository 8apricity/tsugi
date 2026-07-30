import type {
  MaterializedSharedInformationChange,
} from './materializedChange'
import type {
  DirectChangeCatalog,
  StudentAffiliationAssertion,
} from './atomicProgram'
import { changeSourceKey } from './executionPolicy'

export async function findInvalidReferenceSourceKeys(
  changes: readonly MaterializedSharedInformationChange[],
  catalog: DirectChangeCatalog,
  affiliation?: StudentAffiliationAssertion,
) {
  const validity = await Promise.all(changes.map(async (change) => {
    if (
      change.kind === 'task' &&
      change.changeKind !== 'remove' &&
      change.relatedLessonName?.registeredLessonNameId
    ) {
      return await catalog.findRegisteredLessonName(
        change.relatedLessonName.registeredLessonNameId,
      ) !== null
    }
    if (
      change.kind !== 'timetable_change' ||
      change.changeKind === 'remove'
    ) return true
    if (
      change.replacement.type === 'lesson_name' &&
      change.replacement.registeredLessonNameId
    ) {
      return await catalog.findRegisteredLessonName(
        change.replacement.registeredLessonNameId,
      ) !== null
    }
    if (
      change.replacement.type === 'floating_lesson_reference' &&
      affiliation
    ) {
      return await catalog.findFloatingLessonReferenceLabel(
        change.replacement.floatingLessonReferenceLabelId,
        affiliation.schoolYear,
        affiliation.grade,
      ) !== null
    }
    return true
  }))

  return new Set(
    changes.flatMap((change, index) =>
      validity[index] ? [] : [changeSourceKey(change)]
    ),
  )
}
