export const targetScopeTypesBroadToNarrow = [
  'grade',
  'class',
  'track',
  'student',
] as const

export type TargetScopeType = typeof targetScopeTypesBroadToNarrow[number]

export function isTargetScopeType(value: unknown): value is TargetScopeType {
  return typeof value === 'string' &&
    (targetScopeTypesBroadToNarrow as readonly string[]).includes(value)
}
