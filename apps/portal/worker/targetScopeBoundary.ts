import type { TargetScope } from './targetScopePolicy'

export function targetScopeValue(targetScope: TargetScope) {
  if (targetScope.type === 'grade') return String(targetScope.grade)
  if (targetScope.type === 'class') return targetScope.classId
  if (targetScope.type === 'track') return targetScope.trackId
  return targetScope.studentAccountId
}
