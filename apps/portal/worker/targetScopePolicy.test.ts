import { describe, expect, it } from 'vitest'
import type { StudentAffiliation } from './persistence'
import {
  createTargetScopePolicy,
  isTargetScopeType,
  targetScopeReadAccessIncludes,
  targetScopeValue,
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

const schoolStructure = {
  async listClassesForSchoolYear() {
    return [
      { classId: 'class-1', schoolYear: 2026, grade: 2, classNumber: 1 },
      { classId: 'class-2', schoolYear: 2026, grade: 2, classNumber: 2 },
      { classId: 'class-3', schoolYear: 2026, grade: 3, classNumber: 1 },
    ]
  },
  async listTracksForSchoolYear() {
    return [
      { trackId: 'track-1', classId: 'class-1', trackName: '文系' },
      { trackId: 'track-2', classId: 'class-1', trackName: '理系' },
      { trackId: 'track-3', classId: 'class-2', trackName: '文系' },
    ]
  },
}

describe('Target Scope policy', () => {
  it('materialises the current Student own Target Scopes once', () => {
    const policy = createTargetScopePolicy(affiliation)

    expect(policy.ownReadAccess.targetScopes).toEqual([
      { type: 'grade', schoolYear: 2026, grade: 2 },
      { type: 'class', schoolYear: 2026, classId: 'class-1' },
      { type: 'track', schoolYear: 2026, trackId: 'track-1' },
      {
        type: 'student',
        schoolYear: 2026,
        studentAccountId: 'student-1',
      },
    ])
  })

  it('lists only selectable Reference Scopes from the current School Year', async () => {
    const choices = await createTargetScopePolicy(affiliation)
      .listReferenceScopes(schoolStructure)

    expect(choices).toEqual([
      {
        targetScope: { type: 'grade', schoolYear: 2026, grade: 3 },
      },
      {
        targetScope: { type: 'class', schoolYear: 2026, classId: 'class-2' },
        grade: 2,
        classNumber: 2,
      },
      {
        targetScope: { type: 'class', schoolYear: 2026, classId: 'class-3' },
        grade: 3,
        classNumber: 1,
      },
      {
        targetScope: { type: 'track', schoolYear: 2026, trackId: 'track-2' },
        grade: 2,
        classNumber: 1,
        trackName: '理系',
      },
      {
        targetScope: { type: 'track', schoolYear: 2026, trackId: 'track-3' },
        grade: 2,
        classNumber: 2,
        trackName: '文系',
      },
    ])
  })

  it('resolves only an exact selectable Reference Scope', async () => {
    const policy = createTargetScopePolicy(affiliation)
    const selected = await policy.resolveReferenceScope(
      { type: 'class', value: 'class-2' },
      schoolStructure,
    )

    expect(selected).toMatchObject({
      kind: 'reference',
      targetScope: {
        type: 'class',
        schoolYear: 2026,
        classId: 'class-2',
      },
    })
    await expect(Promise.all([
      policy.resolveReferenceScope({ type: 'class', value: 'class-1' }, schoolStructure),
      policy.resolveReferenceScope({ type: 'student', value: 'student-2' }, schoolStructure),
      policy.resolveReferenceScope({ type: 'track', value: 'missing' }, schoolStructure),
      policy.resolveReferenceScope({ type: null, value: null }, schoolStructure),
    ])).resolves.toEqual([null, null, null, null])
  })

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
    expect(
      createTargetScopePolicy(affiliation).creatorTargetScope(type),
    ).toEqual(expected)
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
      targetScopeReadAccessIncludes(
        createTargetScopePolicy(affiliation).ownReadAccess,
        targetScope,
      ),
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
      targetScopeReadAccessIncludes(
        createTargetScopePolicy(affiliation).ownReadAccess,
        targetScope,
      ),
    ).toBe(false)
  })

  it('makes current membership available to Named Attribution reads', () => {
    expect(
      targetScopeReadAccessIncludes(
        createTargetScopePolicy(affiliation).ownReadAccess,
        { type: 'track', schoolYear: 2026, trackId: 'track-1' },
      ),
    ).toBe(true)
    expect(
      targetScopeReadAccessIncludes(
        createTargetScopePolicy(affiliation).ownReadAccess,
        { type: 'track', schoolYear: 2026, trackId: 'track-2' },
      ),
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
