import { describe, expect, it } from 'vitest'
import type { StudentAffiliation } from './persistence'
import { targetScopeValue } from './targetScopeBoundary'
import {
  studentCanViewTargetScopeNamedAttribution,
  isTargetScopeType,
  studentAffiliationIncludesTargetScope,
  targetScopeForStudentAffiliation,
  targetScopesEqual,
  type TargetScope,
  type TargetScopeType,
} from './targetScopePolicy'

const affiliation: StudentAffiliation = {
  studentAffiliationId: 'affiliation-1',
  studentAccountId: 'student-1',
  schoolYear: 2026,
  grade: 2,
  classId: 'class-1',
  trackId: 'track-1',
  selectedAt: 1,
  endedAt: null,
}

describe('Target Scope policy', () => {
  it('recognises only current Target Scope types', () => {
    expect(
      ['grade', 'class', 'track', 'student', 'group', null].map(
        isTargetScopeType,
      ),
    ).toEqual([true, true, true, true, false, false])
  })

  it.each<{
    type: TargetScopeType
    expected: TargetScope
  }>([
    {
      type: 'grade',
      expected: { type: 'grade', schoolYear: 2026, grade: 2 },
    },
    {
      type: 'class',
      expected: { type: 'class', schoolYear: 2026, classId: 'class-1' },
    },
    {
      type: 'track',
      expected: { type: 'track', schoolYear: 2026, trackId: 'track-1' },
    },
    {
      type: 'student',
      expected: {
        type: 'student',
        schoolYear: 2026,
        studentAccountId: 'student-1',
      },
    },
  ])('derives the Student $type Creator Scope', ({ type, expected }) => {
    expect(targetScopeForStudentAffiliation(affiliation, type)).toEqual(expected)
  })

  it.each<TargetScope>([
    { type: 'grade', schoolYear: 2026, grade: 2 },
    { type: 'class', schoolYear: 2026, classId: 'class-1' },
    { type: 'track', schoolYear: 2026, trackId: 'track-1' },
    {
      type: 'student',
      schoolYear: 2026,
      studentAccountId: 'student-1',
    },
  ])('includes the Student in their $type Target Scope', (targetScope) => {
    expect(
      studentAffiliationIncludesTargetScope(affiliation, targetScope),
    ).toBe(true)
  })

  it.each<TargetScope>([
    { type: 'grade', schoolYear: 2025, grade: 2 },
    { type: 'grade', schoolYear: 2026, grade: 3 },
    { type: 'class', schoolYear: 2026, classId: 'class-2' },
    { type: 'track', schoolYear: 2026, trackId: 'track-2' },
    {
      type: 'student',
      schoolYear: 2026,
      studentAccountId: 'student-2',
    },
  ])('excludes the Student from a different $type Target Scope', (targetScope) => {
    expect(
      studentAffiliationIncludesTargetScope(affiliation, targetScope),
    ).toBe(false)
  })

  it('allows Named Attribution only for a current Target Scope member', () => {
    expect(
      studentCanViewTargetScopeNamedAttribution(affiliation, {
        type: 'track',
        schoolYear: 2026,
        trackId: 'track-1',
      }),
    ).toBe(true)
    expect(
      studentCanViewTargetScopeNamedAttribution(affiliation, {
        type: 'track',
        schoolYear: 2026,
        trackId: 'track-2',
      }),
    ).toBe(false)
  })

  it('compares typed Target Scopes without flattening them', () => {
    expect(
      targetScopesEqual(
        { type: 'grade', schoolYear: 2026, grade: 2 },
        { type: 'grade', schoolYear: 2026, grade: 2 },
      ),
    ).toBe(true)
    expect(
      targetScopesEqual(
        { type: 'grade', schoolYear: 2026, grade: 2 },
        { type: 'grade', schoolYear: 2026, grade: 3 },
      ),
    ).toBe(false)
    expect(
      targetScopesEqual(
        { type: 'grade', schoolYear: 2026, grade: 2 },
        { type: 'class', schoolYear: 2026, classId: '2' },
      ),
    ).toBe(false)
  })

  it.each<{ targetScope: TargetScope; expected: string }>([
    {
      targetScope: { type: 'grade', schoolYear: 2026, grade: 2 },
      expected: '2',
    },
    {
      targetScope: { type: 'class', schoolYear: 2026, classId: 'class-1' },
      expected: 'class-1',
    },
    {
      targetScope: { type: 'track', schoolYear: 2026, trackId: 'track-1' },
      expected: 'track-1',
    },
    {
      targetScope: {
        type: 'student',
        schoolYear: 2026,
        studentAccountId: 'student-1',
      },
      expected: 'student-1',
    },
  ])('maps the $targetScope.type Target Scope to its external value', ({
    targetScope,
    expected,
  }) => {
    expect(targetScopeValue(targetScope)).toBe(expected)
  })
})
