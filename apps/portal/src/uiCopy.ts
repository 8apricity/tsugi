import type { TargetScopeType } from '../shared/targetScope'

const targetScopeLabels: Record<TargetScopeType, string> = {
  grade: '学年全体',
  class: 'クラス全体',
  track: '同じ履修タイプ',
  student: '自分だけ',
}

export type TargetScopeDisplayContext = {
  grade: number
  classNumber: number
  trackName: string
}

export function targetScopeLabel(
  scope: TargetScopeType,
  context?: TargetScopeDisplayContext,
) {
  if (context) {
    if (scope === 'grade') return `${context.grade}年全体`
    if (scope === 'class') return `${context.classNumber}組`
    if (scope === 'track') return context.trackName
  }
  return targetScopeLabels[scope]
}

export function formatSchoolDate(
  schoolDate: string,
  { referenceSchoolDate }: { referenceSchoolDate?: string } = {},
) {
  const [year, month, day] = schoolDate.split('-').map(Number)
  if (!year || !month || !day) return schoolDate
  const referenceYear = referenceSchoolDate
    ? Number(referenceSchoolDate.split('-')[0])
    : year
  const includeYear = referenceYear !== year
  return `${includeYear ? `${year}年` : ''}${month}月${day}日`
}

export function formatDueDate(
  dueDate: string,
  referenceSchoolDate?: string,
) {
  return `${formatSchoolDate(dueDate, { referenceSchoolDate })}まで`
}

export function formatTaskDueLabel(
  dueDate: string | null,
  referenceSchoolDate?: string,
) {
  return dueDate ? `期限 ${formatDueDate(dueDate, referenceSchoolDate)}` : '期限なし'
}

export function formatRelativeTime(timestamp: number, now = Date.now()) {
  const elapsed = Math.max(0, now - timestamp)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  return `${Math.floor(hours / 24)}日前`
}
