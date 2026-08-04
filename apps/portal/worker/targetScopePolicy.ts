import {
  targetScopeTypesBroadToNarrow,
  type TargetScopeType,
} from '../shared/targetScope'

export {
  isTargetScopeType,
  type TargetScopeType,
} from '../shared/targetScope'

export type TargetScope =
  | { type: 'grade'; schoolYear: number; grade: number }
  | { type: 'class'; schoolYear: number; classId: string }
  | { type: 'track'; schoolYear: number; trackId: string }
  | {
      type: 'student'
      schoolYear: number
      studentAccountId: string
    }

export type ReferenceTargetScope = Exclude<TargetScope, { type: 'student' }>

type StudentAffiliationTargetScopeFacts = {
  studentAccountId: string
  schoolYear: number
  grade: number
  classId: string
  trackId: string
}

declare const targetScopeAccessBrand: unique symbol

export type OwnTargetScopeAccess = {
  readonly kind: 'own'
  readonly targetScopes: readonly TargetScope[]
  readonly [targetScopeAccessBrand]: 'own'
}

export type ReferenceTargetScopeAccess = {
  readonly kind: 'reference'
  readonly targetScope: ReferenceTargetScope
  readonly [targetScopeAccessBrand]: 'reference'
}

export type TargetScopeReadAccess =
  | OwnTargetScopeAccess
  | ReferenceTargetScopeAccess

export type TargetScopeSchoolStructure = {
  listClassesForSchoolYear(schoolYear: number): Promise<readonly {
    classId: string
    schoolYear: number
    grade: number
    classNumber: number
  }[]>
  listTracksForSchoolYear(schoolYear: number): Promise<readonly {
    trackId: string
    classId: string
    trackName: string
  }[]>
}

export type ReferenceScopeChoice =
  | {
      targetScope: Extract<ReferenceTargetScope, { type: 'grade' }>
    }
  | {
      targetScope: Extract<ReferenceTargetScope, { type: 'class' }>
      grade: number
      classNumber: number
    }
  | {
      targetScope: Extract<ReferenceTargetScope, { type: 'track' }>
      grade: number
      classNumber: number
      trackName: string
    }

export type TargetScopePolicy = {
  readonly studentAffiliation: Readonly<StudentAffiliationTargetScopeFacts>
  readonly ownReadAccess: OwnTargetScopeAccess
  creatorTargetScope(type: TargetScopeType): TargetScope
  listReferenceScopes(
    schoolStructure: TargetScopeSchoolStructure,
  ): Promise<ReferenceScopeChoice[]>
  resolveReferenceScope(
    request: { type: string | null; value: string | null },
    schoolStructure: TargetScopeSchoolStructure,
  ): Promise<ReferenceTargetScopeAccess | null>
}

export function createTargetScopePolicy(
  affiliation: StudentAffiliationTargetScopeFacts,
): TargetScopePolicy {
  const currentAffiliation = Object.freeze({ ...affiliation })
  const listReferenceScopes = async (
    schoolStructure: TargetScopeSchoolStructure,
  ): Promise<ReferenceScopeChoice[]> => {
    const [classes, tracks] = await Promise.all([
      schoolStructure.listClassesForSchoolYear(currentAffiliation.schoolYear),
      schoolStructure.listTracksForSchoolYear(currentAffiliation.schoolYear),
    ])
    const currentClasses = classes.filter(
      (schoolClass) => schoolClass.schoolYear === currentAffiliation.schoolYear,
    )
    const classById = new Map(
      currentClasses.map((schoolClass) => [schoolClass.classId, schoolClass]),
    )
    const gradeChoices: ReferenceScopeChoice[] = [
      ...new Set(currentClasses.map((schoolClass) => schoolClass.grade)),
    ]
      .sort((left, right) => left - right)
      .filter((grade) => grade !== currentAffiliation.grade)
      .map((grade) => ({
        targetScope: {
          type: 'grade' as const,
          schoolYear: currentAffiliation.schoolYear,
          grade,
        },
      }))
    const classChoices: ReferenceScopeChoice[] = currentClasses
      .filter((schoolClass) =>
        schoolClass.classId !== currentAffiliation.classId)
      .map((schoolClass) => ({
        targetScope: {
          type: 'class' as const,
          schoolYear: currentAffiliation.schoolYear,
          classId: schoolClass.classId,
        },
        grade: schoolClass.grade,
        classNumber: schoolClass.classNumber,
      }))
    const trackChoices = tracks.flatMap((track): ReferenceScopeChoice[] => {
      if (track.trackId === currentAffiliation.trackId) return []
      const schoolClass = classById.get(track.classId)
      return schoolClass
        ? [{
            targetScope: {
              type: 'track',
              schoolYear: currentAffiliation.schoolYear,
              trackId: track.trackId,
            },
            grade: schoolClass.grade,
            classNumber: schoolClass.classNumber,
            trackName: track.trackName,
          }]
        : []
    })
    return [...gradeChoices, ...classChoices, ...trackChoices]
  }

  return {
    studentAffiliation: currentAffiliation,
    ownReadAccess: {
      kind: 'own',
      targetScopes: targetScopeTypesBroadToNarrow.map((type) =>
        targetScopeForStudentAffiliation(currentAffiliation, type)),
    } as unknown as OwnTargetScopeAccess,
    creatorTargetScope(type) {
      return targetScopeForStudentAffiliation(currentAffiliation, type)
    },
    listReferenceScopes,
    async resolveReferenceScope(request, schoolStructure) {
      if (!request.type || !request.value) return null
      const choice = (await listReferenceScopes(schoolStructure)).find(
        ({ targetScope }) =>
          targetScope.type === request.type &&
          targetScopeValue(targetScope) === request.value,
      )
      return choice
        ? {
            kind: 'reference',
            targetScope: choice.targetScope,
          } as ReferenceTargetScopeAccess
        : null
    },
  }
}

function targetScopeForStudentAffiliation(
  affiliation: StudentAffiliationTargetScopeFacts,
  type: TargetScopeType,
): TargetScope {
  if (type === 'grade') {
    return { type, schoolYear: affiliation.schoolYear, grade: affiliation.grade }
  }
  if (type === 'class') {
    return {
      type,
      schoolYear: affiliation.schoolYear,
      classId: affiliation.classId,
    }
  }
  if (type === 'track') {
    return {
      type,
      schoolYear: affiliation.schoolYear,
      trackId: affiliation.trackId,
    }
  }
  return {
    type,
    schoolYear: affiliation.schoolYear,
    studentAccountId: affiliation.studentAccountId,
  }
}

export function targetScopesEqual(left: TargetScope, right: TargetScope) {
  if (left.schoolYear !== right.schoolYear) return false
  if (left.type === 'grade') {
    return right.type === 'grade' && left.grade === right.grade
  }
  if (left.type === 'class') {
    return right.type === 'class' && left.classId === right.classId
  }
  if (left.type === 'track') {
    return right.type === 'track' && left.trackId === right.trackId
  }
  return right.type === 'student' &&
    left.studentAccountId === right.studentAccountId
}

export function targetScopeValue(targetScope: TargetScope) {
  if (targetScope.type === 'grade') return String(targetScope.grade)
  if (targetScope.type === 'class') return targetScope.classId
  if (targetScope.type === 'track') return targetScope.trackId
  return targetScope.studentAccountId
}

export function targetScopesForReadAccess(
  access: TargetScopeReadAccess,
): readonly TargetScope[] {
  return access.kind === 'own'
    ? access.targetScopes
    : [access.targetScope]
}

export function targetScopeReadAccessIncludes(
  access: TargetScopeReadAccess,
  targetScope: TargetScope,
) {
  return targetScopesForReadAccess(access).some((candidate) =>
    targetScopesEqual(candidate, targetScope))
}
