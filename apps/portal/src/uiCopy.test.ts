import { describe, expect, it } from 'vitest'
import {
  formatDueDate,
  formatRelativeTime,
  formatSchoolDate,
  formatTaskDueLabel,
  targetScopeLabel,
} from './uiCopy'

describe('student-facing UI copy', () => {
  it('describes target scopes without exposing domain terms or internal ids', () => {
    expect(targetScopeLabel('grade')).toBe('学年全体')
    expect(targetScopeLabel('class')).toBe('クラス全体')
    expect(targetScopeLabel('track')).toBe('同じ履修タイプ')
    expect(targetScopeLabel('student')).toBe('自分だけ')
    const affiliation = { grade: 2, classNumber: 3, trackName: '文科' }
    expect(targetScopeLabel('grade', affiliation)).toBe('2年全体')
    expect(targetScopeLabel('class', affiliation)).toBe('3組')
    expect(targetScopeLabel('track', affiliation)).toBe('文科')
  })

  it('formats stored school dates for Japanese UI', () => {
    expect(formatSchoolDate('2026-07-10')).toBe('7月10日')
    expect(formatSchoolDate('2027-01-08', {
      referenceSchoolDate: '2026-12-20',
    })).toBe(
      '2027年1月8日',
    )
    expect(formatDueDate('2027-01-08', '2026-12-20')).toBe(
      '2027年1月8日まで',
    )
    expect(formatTaskDueLabel('2026-07-10', '2026-07-01')).toBe(
      '期限 7月10日まで',
    )
    expect(formatTaskDueLabel(null)).toBe('期限なし')
  })

  it('formats relative times consistently across history views', () => {
    const now = Date.parse('2026-07-27T05:00:00.000Z')
    expect(formatRelativeTime(now - 30_000, now)).toBe('たった今')
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5分前')
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('3時間前')
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe('2日前')
  })
})
