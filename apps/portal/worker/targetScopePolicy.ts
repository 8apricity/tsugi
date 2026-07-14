export type TargetScopeType = 'grade' | 'class' | 'track' | 'student'

export type TargetScope =
  | { type: 'grade'; schoolYear: number; grade: number }
  | { type: 'class'; schoolYear: number; classId: string }
  | { type: 'track'; schoolYear: number; trackId: string }
  | {
      type: 'student'
      schoolYear: number
      studentAccountId: string
    }

type StudentAffiliationTargetScopeFacts = {
  studentAccountId: string
  schoolYear: number
  grade: number
  classId: string
  trackId: string
}

export function isTargetScopeType(value: unknown): value is TargetScopeType {
  return value === 'grade' || value === 'class' || value === 'track' ||
    value === 'student'
}

export function targetScopeForStudentAffiliation(
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

export function studentAffiliationIncludesTargetScope(
  affiliation: StudentAffiliationTargetScopeFacts,
  targetScope: TargetScope,
) {
  if (affiliation.schoolYear !== targetScope.schoolYear) return false
  if (targetScope.type === 'grade') return affiliation.grade === targetScope.grade
  if (targetScope.type === 'class') return affiliation.classId === targetScope.classId
  if (targetScope.type === 'track') return affiliation.trackId === targetScope.trackId
  return affiliation.studentAccountId === targetScope.studentAccountId
}

export function studentCanViewTargetScopeNamedAttribution(
  affiliation: StudentAffiliationTargetScopeFacts,
  targetScope: TargetScope,
) {
  return studentAffiliationIncludesTargetScope(affiliation, targetScope)
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
