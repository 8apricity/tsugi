import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'

function createTestEnv() {
  return {
    RESEND_API_KEY: 'test-resend-key',
    TEST_STUDENT_ACCOUNTS: [
      {
        studentAccountId: 'student-account-1',
        schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
        displayName: 'Sora',
      },
    ],
  } as unknown as Env
}

function createNewStudentTestEnv() {
  return {
    RESEND_API_KEY: 'test-resend-key',
    TEST_SCHOOL_STRUCTURE: {
      schoolYears: [
        {
          schoolYear: 2026,
          startsOn: '2026-04-01',
          endsOn: '2027-03-31',
          isCurrent: true,
        },
      ],
      classes: [
        {
          classId: 'class-1-1',
          schoolYear: 2026,
          grade: 1,
          classNumber: 1,
        },
      ],
      tracks: [
        {
          trackId: 'track-1-1-a',
          classId: 'class-1-1',
          trackName: 'A',
        },
      ],
    },
  } as unknown as Env
}

function createTestLoginEnv() {
  return {
    RESEND_API_KEY: 'test-resend-key',
    TEST_LOGIN_ENABLED: 'true',
    TEST_LOGIN_SECRET: 'test-secret',
    TEST_STUDENT_ACCOUNTS: [
      {
        studentAccountId: 'test-student-2026-2-3-humanities-1',
        schoolEmail: 'test-student-2026-2-3-humanities-1@example.invalid',
        displayName: 'Test Humanities 1',
      },
      {
        studentAccountId: 'student-account-1',
        schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
        displayName: 'Sora',
      },
    ],
  } as unknown as Env
}

function createDailyPlanTestEnv() {
  return {
    RESEND_API_KEY: 'test-resend-key',
    TEST_LOGIN_ENABLED: 'true',
    TEST_LOGIN_SECRET: 'test-secret',
    TEST_STUDENT_ACCOUNTS: [
      {
        studentAccountId: 'test-student-2026-2-3-humanities-1',
        schoolEmail: 'test-student-2026-2-3-humanities-1@example.invalid',
        displayName: 'Test Humanities 1',
      },
      {
        studentAccountId: 'test-student-2026-2-3-science-1',
        schoolEmail: 'test-student-2026-2-3-science-1@example.invalid',
        displayName: 'Test Science 1',
      },
      {
        studentAccountId: 'test-student-2025-2-3-humanities-1',
        schoolEmail: 'test-student-2025-2-3-humanities-1@example.invalid',
        displayName: 'Test 2025 Humanities 1',
      },
      {
        studentAccountId: 'test-student-2026-2-4-humanities-1',
        schoolEmail: 'test-student-2026-2-4-humanities-1@example.invalid',
        displayName: 'Test Class 4 Humanities 1',
      },
    ],
    TEST_SCHOOL_STRUCTURE: {
      schoolYears: [
        {
          schoolYear: 2025,
          startsOn: '2025-04-01',
          endsOn: '2026-03-31',
          isCurrent: false,
        },
        {
          schoolYear: 2026,
          startsOn: '2026-04-01',
          endsOn: '2027-03-31',
          isCurrent: true,
        },
      ],
      classes: [
        {
          classId: '2025-grade-2-class-3',
          schoolYear: 2025,
          grade: 2,
          classNumber: 3,
        },
        {
          classId: '2026-grade-2-class-3',
          schoolYear: 2026,
          grade: 2,
          classNumber: 3,
        },
        {
          classId: '2026-grade-2-class-4',
          schoolYear: 2026,
          grade: 2,
          classNumber: 4,
        },
      ],
      tracks: [
        {
          trackId: '2025-grade-2-class-3-humanities',
          classId: '2025-grade-2-class-3',
          trackName: '文科',
        },
        {
          trackId: '2026-grade-2-class-3-humanities',
          classId: '2026-grade-2-class-3',
          trackName: '文科',
        },
        {
          trackId: '2026-grade-2-class-3-science',
          classId: '2026-grade-2-class-3',
          trackName: '理科',
        },
        {
          trackId: '2026-grade-2-class-4-humanities',
          classId: '2026-grade-2-class-4',
          trackName: '文科',
        },
      ],
    },
    TEST_STUDENT_AFFILIATIONS: [
      {
        studentAffiliationId: 'test-affiliation-2026-humanities',
        studentAccountId: 'test-student-2026-2-3-humanities-1',
        schoolYear: 2026,
        grade: 2,
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-humanities',
        selectedAt: 1775001600000,
        endedAt: null,
      },
      {
        studentAffiliationId: 'test-affiliation-2026-science',
        studentAccountId: 'test-student-2026-2-3-science-1',
        schoolYear: 2026,
        grade: 2,
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-science',
        selectedAt: 1775001600000,
        endedAt: null,
      },
      {
        studentAffiliationId: 'test-affiliation-2025-humanities',
        studentAccountId: 'test-student-2025-2-3-humanities-1',
        schoolYear: 2025,
        grade: 2,
        classId: '2025-grade-2-class-3',
        trackId: '2025-grade-2-class-3-humanities',
        selectedAt: 1743465600000,
        endedAt: null,
      },
      {
        studentAffiliationId: 'test-affiliation-2026-class-4-humanities',
        studentAccountId: 'test-student-2026-2-4-humanities-1',
        schoolYear: 2026,
        grade: 2,
        classId: '2026-grade-2-class-4',
        trackId: '2026-grade-2-class-4-humanities',
        selectedAt: 1775001600000,
        endedAt: null,
      },
    ],
    TEST_STANDARD_TIMETABLE_ENTRIES: [
      {
        standardTimetableEntryId: 'mon-1-common',
        classId: '2026-grade-2-class-3',
        trackId: null,
        referenceType: 'period',
        weekday: 1,
        periodNumber: 1,
        lessonName: '数Ⅱβ',
      },
      {
        standardTimetableEntryId: 'tue-2-humanities',
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-humanities',
        referenceType: 'period',
        weekday: 2,
        periodNumber: 2,
        lessonName: '古典',
      },
      {
        standardTimetableEntryId: 'tue-2-science',
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-science',
        referenceType: 'period',
        weekday: 2,
        periodNumber: 2,
        lessonName: '生物',
      },
      {
        standardTimetableEntryId: 'fri-1-common',
        classId: '2026-grade-2-class-3',
        trackId: null,
        referenceType: 'period',
        weekday: 5,
        periodNumber: 1,
        lessonName: '地理',
      },
      {
        standardTimetableEntryId: 'fri-4-common',
        classId: '2026-grade-2-class-3',
        trackId: null,
        referenceType: 'period',
        weekday: 5,
        periodNumber: 4,
        lessonName: 'class-common fallback',
      },
      {
        standardTimetableEntryId: 'fri-4-humanities',
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-humanities',
        referenceType: 'period',
        weekday: 5,
        periodNumber: 4,
        lessonName: '現代文',
      },
      {
        standardTimetableEntryId: 'sat-1-common',
        classId: '2026-grade-2-class-3',
        trackId: null,
        referenceType: 'period',
        weekday: 6,
        periodNumber: 1,
        lessonName: '三丘SHSP',
      },
      {
        standardTimetableEntryId: 'floating-star-humanities',
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-humanities',
        referenceType: 'floating',
        referenceLabel: '★',
        lessonName: '自走',
      },
    ],
  } as unknown as Env
}

function getLastSentCode(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  const [, resendRequest] = fetchMock.mock.calls.at(-1) ?? []
  const resendBody = JSON.parse(String(resendRequest?.body)) as { text: string }
  const code = resendBody.text.match(/[0-9]{6}/)?.[0]

  if (!code) {
    throw new Error('expected verification code')
  }

  return code
}

function requestVerificationCode(env: Env, schoolEmailNumber = '12345678') {
  return worker.fetch(
    new Request('https://tsugi.test/api/auth/verification-code-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schoolEmailNumber }),
    }),
    env,
  )
}

function verifyCode(env: Env, code: string, schoolEmailNumber = '12345678') {
  return worker.fetch(
    new Request('https://tsugi.test/api/auth/verification-code-verifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schoolEmailNumber, code }),
    }),
    env,
  )
}

function testLogin(
  env: Env,
  studentAccountId: string,
  secret: string | null = 'test-secret',
) {
  const headers = new Headers({ 'content-type': 'application/json' })

  if (secret !== null) {
    headers.set('x-test-login-secret', secret)
  }

  return worker.fetch(
    new Request('https://tsugi.test/api/test/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ studentAccountId }),
    }),
    env,
  )
}

async function testLoginCookie(env: Env, studentAccountId: string) {
  const response = await testLogin(env, studentAccountId)

  if (response.status !== 200) {
    throw new Error(`expected test login success, got ${response.status}`)
  }

  return response.headers.get('set-cookie') ?? ''
}

function readDailyPlan(env: Env, cookie = '', date?: string) {
  const url = new URL('https://tsugi.test/api/daily-plan')

  if (date !== undefined) {
    url.searchParams.set('date', date)
  }

  return worker.fetch(
    new Request(url, {
      headers: cookie ? { cookie } : {},
    }),
    env,
  )
}

function readDailyPlans(env: Env, cookie = '', start?: string, end?: string) {
  const url = new URL('https://tsugi.test/api/daily-plans')

  if (start !== undefined) {
    url.searchParams.set('start', start)
  }

  if (end !== undefined) {
    url.searchParams.set('end', end)
  }

  return worker.fetch(
    new Request(url, {
      headers: cookie ? { cookie } : {},
    }),
    env,
  )
}

function addDirectTimetableChanges(
  env: Env,
  cookie: string,
  changes: Array<Record<string, unknown>>,
) {
  return worker.fetch(
    new Request('https://tsugi.test/api/timetable-changes/direct', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ changes }),
    }),
    env,
  )
}

function readDirectTimetableChangeOptions(env: Env, cookie = '') {
  return worker.fetch(
    new Request('https://tsugi.test/api/timetable-changes/direct/options', {
      headers: cookie ? { cookie } : {},
    }),
    env,
  )
}

function readTimetableChangeLayers(
  env: Env,
  cookie = '',
  date = '2026-07-10',
  periodNumber = 1,
) {
  const url = new URL('https://tsugi.test/api/timetable-changes/layers')
  url.searchParams.set('date', date)
  url.searchParams.set('period', String(periodNumber))

  return worker.fetch(
    new Request(url, {
      headers: cookie ? { cookie } : {},
    }),
    env,
  )
}

function readTimetableChangeLayerRange(
  env: Env,
  cookie = '',
  startDate = '2026-07-08',
  endDate = '2026-07-12',
) {
  const url = new URL('https://tsugi.test/api/timetable-changes/layers/batch')
  url.searchParams.set('start', startDate)
  url.searchParams.set('end', endDate)

  return worker.fetch(
    new Request(url, {
      headers: cookie ? { cookie } : {},
    }),
    env,
  )
}

function readTimetableChangeHistory(
  env: Env,
  cookie = '',
  targetScopeType = 'track',
  date = '2026-07-10',
  periodNumber = 1,
) {
  const url = new URL('https://tsugi.test/api/timetable-changes/history')
  url.searchParams.set('scope', targetScopeType)
  url.searchParams.set('date', date)
  url.searchParams.set('period', String(periodNumber))

  return worker.fetch(new Request(url, { headers: cookie ? { cookie } : {} }), env)
}

function readDirectTimetableChangeDetail(
  env: Env,
  cookie: string,
  sharedInformationChangeId: string,
) {
  return worker.fetch(
    new Request(
      `https://tsugi.test/api/timetable-changes/direct/${encodeURIComponent(sharedInformationChangeId)}`,
      { headers: cookie ? { cookie } : {} },
    ),
    env,
  )
}

describe('Timetable Direct Add API', () => {
  it('updates an Active Timetable Change when its expected latest change matches', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const addSourceId = '04111111-1111-4111-8111-111111111111'
    const updateSourceId = '04222222-2222-4222-8222-222222222222'

    expect((await addDirectTimetableChanges(env, cookie, [{
      sourceId: addSourceId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'lesson_name', lessonName: '変更前' },
    }])).status).toBe(201)
    const before = (await (await readTimetableChangeLayers(
      env,
      cookie,
      '2026-07-10',
      1,
    )).json()) as {
      layers: Array<{
        targetScopeType: string
        state: string
        sharedInformationItemId?: string
        latestChangeId?: string
      }>
    }
    const track = before.layers.find((layer) => layer.targetScopeType === 'track')

    const response = await addDirectTimetableChanges(env, cookie, [{
      changeKind: 'update',
      sourceId: updateSourceId,
      sharedInformationItemId: track?.sharedInformationItemId,
      expectedLatestChangeId: track?.latestChangeId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'lesson_name', lessonName: '変更後' },
    }])

    expect(response.status).toBe(201)
    const after = (await (await readTimetableChangeLayers(
      env,
      cookie,
      '2026-07-10',
      1,
    )).json()) as {
      layers: Array<Record<string, unknown>>
    }
    expect(after.layers.find((layer) => layer.targetScopeType === 'track')).toMatchObject({
      sharedInformationItemId: addSourceId,
      latestChangeId: `${updateSourceId}:change`,
      replacement: { type: 'lesson_name', lessonName: '変更後' },
    })
    const plan = (await (await readDailyPlan(env, cookie, '2026-07-10')).json()) as {
      periods: Array<{ lessonName: string }>
    }
    expect(plan.periods[0].lessonName).toBe('変更後')
  })

  it('removes an active layer, preserves cancelled distinction, retries safely, and reuses the slot with a new item', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const gradeId = '04333333-3333-4333-8333-333333333333'
    const trackId = '04444444-4444-4444-8444-444444444444'
    const removeId = '04555555-5555-4555-8555-555555555555'
    expect((await addDirectTimetableChanges(env, cookie, [
      {
        sourceId: gradeId,
        targetScopeType: 'grade',
        changeDate: '2026-07-10',
        periodNumber: 1,
        replacement: { type: 'lesson_name', lessonName: '学年変更' },
      },
      {
        sourceId: trackId,
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 1,
        replacement: { type: 'cancelled' },
      },
    ])).status).toBe(201)

    const cancelled = (await (await readTimetableChangeLayers(
      env, cookie, '2026-07-10', 1,
    )).json()) as { finalDailyLesson: { timetableChangeState: string } }
    expect(cancelled.finalDailyLesson.timetableChangeState).toBe('cancelled')

    const remove = {
      changeKind: 'remove',
      sourceId: removeId,
      sharedInformationItemId: trackId,
      expectedLatestChangeId: `${trackId}:change`,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
    }
    expect((await addDirectTimetableChanges(env, cookie, [remove])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [remove])).status).toBe(201)

    const removed = (await (await readTimetableChangeLayers(
      env, cookie, '2026-07-10', 1,
    )).json()) as {
      layers: Array<{ targetScopeType: string; state: string }>
      finalDailyLesson: { lessonName: string; timetableChangeState: string }
    }
    expect(removed.layers.find(({ targetScopeType }) => targetScopeType === 'track')).toEqual({
      targetScopeType: 'track',
      state: 'unchanged',
    })
    expect(removed.finalDailyLesson).toEqual({
      lessonName: '学年変更',
      timetableChangeState: 'resolved',
    })
    const plan = (await (await readDailyPlan(env, cookie, '2026-07-10')).json()) as {
      periods: Array<{ lessonName: string }>
    }
    expect(plan.periods[0].lessonName).toBe('学年変更')

    const stale = await addDirectTimetableChanges(env, cookie, [{
      ...remove,
      sourceId: '04666666-6666-4666-8666-666666666666',
    }])
    expect(stale.status).toBe(409)

    const replacementItemId = '04777777-7777-4777-8777-777777777777'
    expect((await addDirectTimetableChanges(env, cookie, [{
      sourceId: replacementItemId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'lesson_name', lessonName: '再追加' },
    }])).status).toBe(201)
    const reused = (await (await readTimetableChangeLayers(
      env, cookie, '2026-07-10', 1,
    )).json()) as { layers: Array<Record<string, unknown>> }
    expect(reused.layers.find((layer) => layer.targetScopeType === 'track')).toMatchObject({
      sharedInformationItemId: replacementItemId,
      replacement: { type: 'lesson_name', lessonName: '再追加' },
    })

    const standardFallbackItemId = '24111111-1111-4111-8111-111111111111'
    expect((await addDirectTimetableChanges(env, cookie, [{
      sourceId: standardFallbackItemId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 4,
      replacement: { type: 'lesson_name', lessonName: '標準を上書き' },
    }])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [{
      changeKind: 'remove',
      sourceId: '24222222-2222-4222-8222-222222222222',
      sharedInformationItemId: standardFallbackItemId,
      expectedLatestChangeId: `${standardFallbackItemId}:change`,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 4,
    }])).status).toBe(201)
    const standardFallback = (await (await readTimetableChangeLayers(
      env, cookie, '2026-07-10', 4,
    )).json()) as { finalDailyLesson: { lessonName: string; timetableChangeState: string } }
    expect(standardFallback.finalDailyLesson).toEqual({
      lessonName: '現代文',
      timetableChangeState: 'unchanged',
    })
    const fallbackPlan = (await (await readDailyPlan(
      env, cookie, '2026-07-10',
    )).json()) as { periods: Array<{ lessonName: string }> }
    expect(fallbackPlan.periods[3].lessonName).toBe('現代文')
  })

  it('rejects a stale remove while the item remains active at its newer change', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const itemId = '24333333-3333-4333-8333-333333333333'
    const updateId = '24444444-4444-4444-8444-444444444444'
    expect((await addDirectTimetableChanges(env, cookie, [{
      sourceId: itemId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 6,
      replacement: { type: 'lesson_name', lessonName: '変更前' },
    }])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [{
      changeKind: 'update',
      sourceId: updateId,
      sharedInformationItemId: itemId,
      expectedLatestChangeId: `${itemId}:change`,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 6,
      replacement: { type: 'lesson_name', lessonName: '変更後' },
    }])).status).toBe(201)

    const stale = await addDirectTimetableChanges(env, cookie, [{
      changeKind: 'remove',
      sourceId: '24555555-5555-4555-8555-555555555555',
      sharedInformationItemId: itemId,
      expectedLatestChangeId: `${itemId}:change`,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 6,
    }])
    expect(stale.status).toBe(409)
    const layers = (await (await readTimetableChangeLayers(
      env, cookie, '2026-07-10', 6,
    )).json()) as { layers: Array<Record<string, unknown>> }
    expect(layers.layers.find((layer) => layer.targetScopeType === 'track')).toMatchObject({
      sharedInformationItemId: itemId,
      latestChangeId: `${updateId}:change`,
      replacement: { type: 'lesson_name', lessonName: '変更後' },
    })
  })

  it('applies mixed add, update, and remove atomically and rolls all back on a remove conflict', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const removeItemId = '04888888-8888-4888-8888-888888888888'
    const updateItemId = '04999999-9999-4999-8999-999999999999'
    expect((await addDirectTimetableChanges(env, cookie, [
      {
        sourceId: removeItemId,
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
        replacement: { type: 'lesson_name', lessonName: '削除元' },
      },
      {
        sourceId: updateItemId,
        targetScopeType: 'class',
        changeDate: '2026-07-10',
        periodNumber: 3,
        replacement: { type: 'lesson_name', lessonName: '更新元' },
      },
    ])).status).toBe(201)

    expect((await addDirectTimetableChanges(env, cookie, [
      {
        changeKind: 'remove',
        sourceId: '14111111-1111-4111-8111-111111111111',
        sharedInformationItemId: removeItemId,
        expectedLatestChangeId: `${removeItemId}:change`,
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
      },
      {
        changeKind: 'update',
        sourceId: '14222222-2222-4222-8222-222222222222',
        sharedInformationItemId: updateItemId,
        expectedLatestChangeId: `${updateItemId}:change`,
        targetScopeType: 'class',
        changeDate: '2026-07-10',
        periodNumber: 3,
        replacement: { type: 'lesson_name', lessonName: '更新後' },
      },
      {
        sourceId: '14333333-3333-4333-8333-333333333333',
        targetScopeType: 'student',
        changeDate: '2026-07-10',
        periodNumber: 4,
        replacement: { type: 'lesson_name', lessonName: '追加' },
      },
    ])).status).toBe(201)

    const conflict = await addDirectTimetableChanges(env, cookie, [
      {
        changeKind: 'remove',
        sourceId: '14444444-4444-4444-8444-444444444444',
        sharedInformationItemId: removeItemId,
        expectedLatestChangeId: `${removeItemId}:change`,
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
      },
      {
        sourceId: '14555555-5555-4555-8555-555555555555',
        targetScopeType: 'student',
        changeDate: '2026-07-10',
        periodNumber: 5,
        replacement: { type: 'lesson_name', lessonName: '保存されない' },
      },
    ])
    expect(conflict.status).toBe(409)
    const plan = (await (await readDailyPlan(env, cookie, '2026-07-10')).json()) as {
      periods: Array<{ lessonName: string }>
    }
    expect(plan.periods[4].lessonName).toBe('')
  })

  it('applies mixed add/update atomically and rolls every operation back on stale update', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const originalSourceId = '05111111-1111-4111-8111-111111111111'
    expect((await addDirectTimetableChanges(env, cookie, [{
      sourceId: originalSourceId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'lesson_name', lessonName: '最初' },
    }])).status).toBe(201)
    const originalLatestChangeId = `${originalSourceId}:change`

    const mixed = await addDirectTimetableChanges(env, cookie, [
      {
        changeKind: 'update',
        sourceId: '05222222-2222-4222-8222-222222222222',
        sharedInformationItemId: originalSourceId,
        expectedLatestChangeId: originalLatestChangeId,
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 1,
        replacement: { type: 'lesson_name', lessonName: '更新済み' },
      },
      {
        changeKind: 'add',
        sourceId: '05333333-3333-4333-8333-333333333333',
        targetScopeType: 'class',
        changeDate: '2026-07-10',
        periodNumber: 2,
        replacement: { type: 'cancelled' },
      },
    ])
    expect(mixed.status).toBe(201)

    const stale = await addDirectTimetableChanges(env, cookie, [
      {
        changeKind: 'update',
        sourceId: '05444444-4444-4444-8444-444444444444',
        sharedInformationItemId: originalSourceId,
        expectedLatestChangeId: originalLatestChangeId,
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 1,
        replacement: { type: 'lesson_name', lessonName: '古い上書き' },
      },
      {
        changeKind: 'add',
        sourceId: '05555555-5555-4555-8555-555555555555',
        targetScopeType: 'student',
        changeDate: '2026-07-10',
        periodNumber: 3,
        replacement: { type: 'lesson_name', lessonName: '保存されない' },
      },
      {
        changeKind: 'update',
        sourceId: '05666666-6666-4666-8666-666666666666',
        sharedInformationItemId: '05333333-3333-4333-8333-333333333333',
        expectedLatestChangeId: '古い変更',
        targetScopeType: 'class',
        changeDate: '2026-07-10',
        periodNumber: 2,
        replacement: { type: 'lesson_name', lessonName: '古いクラス更新' },
      },
    ])
    expect(stale.status).toBe(409)
    await expect(stale.json()).resolves.toEqual({
      status: 'timetable-change-conflict',
      conflictingKeys: [
        { targetScopeType: 'track', changeDate: '2026-07-10', periodNumber: 1 },
        { targetScopeType: 'class', changeDate: '2026-07-10', periodNumber: 2 },
      ],
    })

    const plan = (await (await readDailyPlan(env, cookie, '2026-07-10')).json()) as {
      periods: Array<{ lessonName: string }>
    }
    expect(plan.periods.map(({ lessonName }) => lessonName).slice(0, 3)).toEqual([
      '更新済み',
      '',
      '',
    ])
  })

  it('updates through every replacement kind and keeps update retries idempotent', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const itemId = '06111111-1111-4111-8111-111111111111'
    expect((await addDirectTimetableChanges(env, cookie, [{
      sourceId: itemId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 4,
      replacement: { type: 'cancelled' },
    }])).status).toBe(201)

    const updates = [
      {
        sourceId: '06222222-2222-4222-8222-222222222222',
        replacement: { type: 'lesson_name', lessonName: '直接名' },
      },
      {
        sourceId: '06333333-3333-4333-8333-333333333333',
        replacement: { type: 'period_reference', weekday: 1, periodNumber: 1 },
      },
      {
        sourceId: '06444444-4444-4444-8444-444444444444',
        replacement: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: '2026:2:★',
        },
      },
      {
        sourceId: '06555555-5555-4555-8555-555555555555',
        replacement: { type: 'cancelled' },
      },
    ] as const
    let expectedLatestChangeId = `${itemId}:change`
    let finalPayload: Record<string, unknown> | null = null

    for (const update of updates) {
      const payload = {
        changeKind: 'update',
        sourceId: update.sourceId,
        sharedInformationItemId: itemId,
        expectedLatestChangeId,
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 4,
        replacement: update.replacement,
      }
      expect((await addDirectTimetableChanges(env, cookie, [payload])).status).toBe(201)
      const layers = (await (await readTimetableChangeLayers(
        env,
        cookie,
        '2026-07-10',
        4,
      )).json()) as { layers: Array<Record<string, unknown>> }
      expect(layers.layers.find((layer) => layer.targetScopeType === 'track')).toMatchObject({
        sharedInformationItemId: itemId,
        latestChangeId: `${update.sourceId}:change`,
        replacement: update.replacement,
      })
      expectedLatestChangeId = `${update.sourceId}:change`
      finalPayload = payload
    }

    expect((await addDirectTimetableChanges(env, cookie, [finalPayload!])).status).toBe(201)
    const changedExpectedRetry = await addDirectTimetableChanges(env, cookie, [{
      ...finalPayload!,
      expectedLatestChangeId: `${itemId}:change`,
    }])
    expect(changedExpectedRetry.status).toBe(409)
    await expect(changedExpectedRetry.json()).resolves.toEqual({
      status: 'idempotency-conflict',
      conflictingKeys: [
        { targetScopeType: 'track', changeDate: '2026-07-10', periodNumber: 4 },
      ],
    })
    const changedRetry = await addDirectTimetableChanges(env, cookie, [{
      ...finalPayload!,
      replacement: { type: 'lesson_name', lessonName: '異なる再試行' },
    }])
    expect(changedRetry.status).toBe(409)
    await expect(changedRetry.json()).resolves.toEqual({
      status: 'idempotency-conflict',
      conflictingKeys: [
        { targetScopeType: 'track', changeDate: '2026-07-10', periodNumber: 4 },
      ],
    })
  })

  it('returns resolved Period and Floating Lesson References for previews', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readDirectTimetableChangeOptions(env, cookie)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      periodReferences: expect.arrayContaining([
        { weekday: 1, periodNumber: 1, lessonName: '数Ⅱβ' },
        { weekday: 2, periodNumber: 2, lessonName: '古典' },
      ]),
      floatingLessonReferenceLabels: expect.arrayContaining([
        expect.objectContaining({ referenceLabel: '★', lessonName: '自走' }),
      ]),
    })
  })

  it('rejects unauthenticated and invalid Direct Add requests', async () => {
    const env = createDailyPlanTestEnv()
    const unauthenticated = await addDirectTimetableChanges(env, '', [])
    expect(unauthenticated.status).toBe(401)

    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const invalid = await addDirectTimetableChanges(env, cookie, [
      { sourceId: '10111111-1111-4111-8111-111111111111', targetScopeType: 'track', changeDate: '2027-04-01', periodNumber: 8, replacement: { type: 'cancelled' } },
    ])
    expect(invalid.status).toBe(400)
  })

  it('makes a Track Timetable Change active in the Daily Plan immediately', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await addDirectTimetableChanges(env, cookie, [
      {
        sourceId: '11111111-1111-4111-8111-111111111111',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 1,
        replacement: { type: 'lesson_name', lessonName: '特別授業' },
      },
    ])

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      status: 'applied',
      changes: [
        { sourceId: '11111111-1111-4111-8111-111111111111' },
      ],
    })

    const dailyPlanResponse = await readDailyPlan(
      env,
      cookie,
      '2026-07-10',
    )

    expect(dailyPlanResponse.status).toBe(200)
    const dailyPlan = (await dailyPlanResponse.json()) as {
      periods: Array<{ periodNumber: number; lessonName: string }>
    }
    expect(dailyPlan.periods[0]).toMatchObject({
      periodNumber: 1,
      lessonName: '特別授業',
    })
  })

  it('uses the narrowest Timetable Layer and resolves every replacement kind', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const ids = [
      '21111111-1111-4111-8111-111111111111',
      '31111111-1111-4111-8111-111111111111',
      '41111111-1111-4111-8111-111111111111',
      '51111111-1111-4111-8111-111111111111',
      '61111111-1111-4111-8111-111111111111',
      '63111111-1111-4111-8111-111111111111',
    ]

    const response = await addDirectTimetableChanges(env, cookie, [
      { sourceId: ids[0], targetScopeType: 'grade', changeDate: '2026-07-10', periodNumber: 1, replacement: { type: 'lesson_name', lessonName: '学年' } },
      { sourceId: ids[1], targetScopeType: 'class', changeDate: '2026-07-10', periodNumber: 1, replacement: { type: 'lesson_name', lessonName: 'クラス' } },
      { sourceId: ids[2], targetScopeType: 'track', changeDate: '2026-07-10', periodNumber: 1, replacement: { type: 'period_reference', weekday: 1, periodNumber: 1 } },
      { sourceId: ids[3], targetScopeType: 'student', changeDate: '2026-07-10', periodNumber: 2, replacement: { type: 'floating_lesson_reference', floatingLessonReferenceLabelId: '2026:2:★' } },
      { sourceId: ids[4], targetScopeType: 'student', changeDate: '2026-07-10', periodNumber: 4, replacement: { type: 'cancelled' } },
      { sourceId: ids[5], targetScopeType: 'student', changeDate: '2026-07-10', periodNumber: 3, replacement: { type: 'period_reference', weekday: 6, periodNumber: 7 } },
    ])

    expect(response.status).toBe(201)
    const planResponse = await readDailyPlan(env, cookie, '2026-07-10')
    const plan = (await planResponse.json()) as { periods: Array<{ lessonName: string }> }
    expect(plan.periods.map((period) => period.lessonName)).toEqual([
      '数Ⅱβ',
      '自走',
      '',
      '',
      '',
      '',
      '',
    ])
    expect(
      (plan as unknown as { periods: Array<{ timetableChangeState?: string }> })
        .periods[2].timetableChangeState,
    ).toBe('cancelled')

    const scienceCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-science-1',
    )
    const unresolved = await addDirectTimetableChanges(env, scienceCookie, [
      {
        sourceId: '62111111-1111-4111-8111-111111111111',
        targetScopeType: 'student',
        changeDate: '2026-07-10',
        periodNumber: 2,
        replacement: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: '2026:2:★',
        },
      },
    ])
    expect(unresolved.status).toBe(201)
    const sciencePlanResponse = await readDailyPlan(env, scienceCookie, '2026-07-10')
    const sciencePlan = (await sciencePlanResponse.json()) as {
      periods: Array<{ lessonName: string; timetableChangeState?: string }>
    }
    expect(sciencePlan.periods[1]).toMatchObject({
      lessonName: 'エラー',
      timetableChangeState: 'unresolved-reference',
    })
  })

  it('keeps a conflicting batch atomic and accepts an identical retry', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const original = {
      sourceId: '71111111-1111-4111-8111-111111111111',
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'lesson_name', lessonName: '適用済み' },
    }

    expect((await addDirectTimetableChanges(env, cookie, [original])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [original])).status).toBe(201)

    const conflict = await addDirectTimetableChanges(env, cookie, [
      { sourceId: '81111111-1111-4111-8111-111111111111', targetScopeType: 'class', changeDate: '2026-07-10', periodNumber: 2, replacement: { type: 'lesson_name', lessonName: '保存されない' } },
      { sourceId: '91111111-1111-4111-8111-111111111111', targetScopeType: 'track', changeDate: '2026-07-10', periodNumber: 1, replacement: { type: 'lesson_name', lessonName: '競合' } },
    ])
    expect(conflict.status).toBe(409)

    const planResponse = await readDailyPlan(env, cookie, '2026-07-10')
    const plan = (await planResponse.json()) as { periods: Array<{ lessonName: string }> }
    expect(plan.periods[0].lessonName).toBe('適用済み')
    expect(plan.periods[1].lessonName).toBe('')
  })

  it('rejects a changed idempotency payload and duplicate slots within one batch', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const sourceId = 'b1111111-1111-4111-8111-111111111111'
    const base = { sourceId, targetScopeType: 'class', changeDate: '2026-07-10', periodNumber: 6 }
    expect((await addDirectTimetableChanges(env, cookie, [
      { ...base, replacement: { type: 'lesson_name', lessonName: '最初' } },
    ])).status).toBe(201)
    const mismatch = await addDirectTimetableChanges(env, cookie, [
      { ...base, replacement: { type: 'lesson_name', lessonName: '変更' } },
    ])
    expect(mismatch.status).toBe(409)
    await expect(mismatch.json()).resolves.toEqual({
      status: 'idempotency-conflict',
      conflictingKeys: [
        { targetScopeType: 'class', changeDate: '2026-07-10', periodNumber: 6 },
      ],
    })

    const duplicateSlots = await addDirectTimetableChanges(env, cookie, [
      { sourceId: 'c1111111-1111-4111-8111-111111111111', targetScopeType: 'student', changeDate: '2026-07-11', periodNumber: 1, replacement: { type: 'cancelled' } },
      { sourceId: 'd1111111-1111-4111-8111-111111111111', targetScopeType: 'student', changeDate: '2026-07-11', periodNumber: 1, replacement: { type: 'lesson_name', lessonName: '重複' } },
    ])
    expect(duplicateSlots.status).toBe(400)
  })
})

describe('Timetable Change Edit History API', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns cross-item slot history newest first and reconstructs every Direct Change transition', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T00:00:00.000Z'))
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const firstItemId = '28111111-1111-4111-8111-111111111111'
    const updateId = '28222222-2222-4222-8222-222222222222'
    const removeId = '28333333-3333-4333-8333-333333333333'
    const secondItemId = '28999999-9999-4999-8999-999999999999'

    expect((await addDirectTimetableChanges(env, cookie, [{
      sourceId: firstItemId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'period_reference', weekday: 2, periodNumber: 2 },
    }])).status).toBe(201)
    vi.setSystemTime(new Date('2026-07-10T00:01:00.000Z'))
    expect((await addDirectTimetableChanges(env, cookie, [{
      changeKind: 'update',
      sourceId: updateId,
      sharedInformationItemId: firstItemId,
      expectedLatestChangeId: `${firstItemId}:change`,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: {
        type: 'floating_lesson_reference',
        floatingLessonReferenceLabelId: '2026:2:★',
      },
    }])).status).toBe(201)
    vi.setSystemTime(new Date('2026-07-10T00:02:00.000Z'))
    expect((await addDirectTimetableChanges(env, cookie, [{
      changeKind: 'remove',
      sourceId: removeId,
      sharedInformationItemId: firstItemId,
      expectedLatestChangeId: `${updateId}:change`,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
    }])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [{
      sourceId: secondItemId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'cancelled' },
    }])).status).toBe(201)

    const response = await readTimetableChangeHistory(env, cookie)
    expect(response.status).toBe(200)
    const history = await response.json() as {
      entries: Array<Record<string, unknown>>
      [key: string]: unknown
    }
    expect(history).toMatchObject({
      status: 'ready',
      targetScope: { type: 'track', value: '2026-grade-2-class-3-humanities' },
      changeDate: '2026-07-10',
      periodNumber: 1,
    })
    expect(history.entries).toEqual([
      expect.objectContaining({
        sharedInformationChangeId: `${secondItemId}:change`,
        sharedInformationItemId: secondItemId,
        changeKind: 'add',
        sourceType: 'direct',
        primaryActorDisplayName: 'Test Humanities 1',
        before: null,
        after: { type: 'cancelled' },
      }),
      expect.objectContaining({
        sharedInformationChangeId: `${removeId}:change`,
        sharedInformationItemId: firstItemId,
        changeKind: 'remove',
        before: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: '2026:2:★',
          referenceLabel: '★',
        },
        after: null,
      }),
      expect.objectContaining({
        sharedInformationChangeId: `${updateId}:change`,
        sharedInformationItemId: firstItemId,
        changeKind: 'update',
        before: { type: 'period_reference', weekday: 2, periodNumber: 2 },
        after: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: '2026:2:★',
          referenceLabel: '★',
        },
      }),
      expect.objectContaining({
        sharedInformationChangeId: `${firstItemId}:change`,
        sharedInformationItemId: firstItemId,
        changeKind: 'add',
        before: null,
        after: { type: 'period_reference', weekday: 2, periodNumber: 2 },
      }),
    ])

    const detailResponse = await readDirectTimetableChangeDetail(
      env,
      cookie,
      `${updateId}:change`,
    )
    expect(detailResponse.status).toBe(200)
    expect(await detailResponse.json()).toMatchObject({
      status: 'ready',
      sharedInformationChangeId: `${updateId}:change`,
      sharedInformationItemId: firstItemId,
      changeKind: 'update',
      sourceType: 'direct',
      primaryActorDisplayName: 'Test Humanities 1',
      changedAt: Date.parse('2026-07-10T00:01:00.000Z'),
      targetScope: { type: 'track', value: '2026-grade-2-class-3-humanities' },
      changeDate: '2026-07-10',
      periodNumber: 1,
      before: { type: 'period_reference', weekday: 2, periodNumber: 2 },
      after: {
        type: 'floating_lesson_reference',
        floatingLessonReferenceLabelId: '2026:2:★',
        referenceLabel: '★',
      },
    })

    const layers = await (await readTimetableChangeLayers(env, cookie)).json()
    expect(JSON.stringify(layers)).not.toContain('primaryActorDisplayName')
  })

  it('does not expose history attribution outside the Target Scope', async () => {
    const env = createDailyPlanTestEnv()
    const humanitiesCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const scienceCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-science-1',
    )
    const itemId = '28888888-8888-4888-8888-888888888888'
    expect((await addDirectTimetableChanges(env, humanitiesCookie, [{
      sourceId: itemId,
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'lesson_name', lessonName: '文科のみ' },
    }])).status).toBe(201)

    expect((await readTimetableChangeHistory(env)).status).toBe(401)
    const otherTrackHistory = await readTimetableChangeHistory(env, scienceCookie)
    expect(otherTrackHistory.status).toBe(200)
    expect(await otherTrackHistory.json()).toMatchObject({ entries: [] })
    expect((await readDirectTimetableChangeDetail(
      env,
      scienceCookie,
      `${itemId}:change`,
    )).status).toBe(404)
    expect((await readDirectTimetableChangeDetail(
      env,
      '',
      `${itemId}:change`,
    )).status).toBe(401)
  })

  it('uses the applied predecessor when same-item timestamps tie', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T00:00:00.000Z'))
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const addId = '28f99999-9999-4999-8999-999999999999'
    const updateId = '28011111-1111-4111-8111-111111111111'
    expect((await addDirectTimetableChanges(env, cookie, [{
      sourceId: addId,
      targetScopeType: 'student',
      changeDate: '2026-07-10',
      periodNumber: 6,
      replacement: { type: 'lesson_name', lessonName: '前' },
    }])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [{
      changeKind: 'update',
      sourceId: updateId,
      sharedInformationItemId: addId,
      expectedLatestChangeId: `${addId}:change`,
      targetScopeType: 'student',
      changeDate: '2026-07-10',
      periodNumber: 6,
      replacement: { type: 'lesson_name', lessonName: '後' },
    }])).status).toBe(201)

    const history = await (await readTimetableChangeHistory(
      env,
      cookie,
      'student',
      '2026-07-10',
      6,
    )).json() as { entries: Array<Record<string, unknown>> }
    expect(history.entries).toEqual([
      expect.objectContaining({
        sharedInformationChangeId: `${updateId}:change`,
        before: { type: 'lesson_name', lessonName: '前' },
        after: { type: 'lesson_name', lessonName: '後' },
      }),
      expect.objectContaining({
        sharedInformationChangeId: `${addId}:change`,
        before: null,
        after: { type: 'lesson_name', lessonName: '前' },
      }),
    ])
  })
})

describe('Timetable Layer read API', () => {
  it('returns every period for a five-day selection window', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readTimetableChangeLayerRange(env, cookie)

    expect(response.status).toBe(200)
    const body = await response.json() as {
      status: string
      states: Array<{ schoolDate: string; periodNumber: number }>
    }
    expect(body.status).toBe('ready')
    expect(body.states).toHaveLength(35)
    expect(body.states[0]).toMatchObject({
      schoolDate: '2026-07-08',
      periodNumber: 1,
    })
    expect(body.states[34]).toMatchObject({
      schoolDate: '2026-07-12',
      periodNumber: 7,
    })
  })

  it('returns the Standard Timetable, every applicable layer, and the final Daily Lesson', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const ids = [
      '21111111-1111-4111-8111-111111111111',
      '31111111-1111-4111-8111-111111111111',
      '41111111-1111-4111-8111-111111111111',
      '51111111-1111-4111-8111-111111111111',
    ]

    expect(
      (
        await addDirectTimetableChanges(env, cookie, [
          {
            sourceId: ids[0],
            targetScopeType: 'grade',
            changeDate: '2026-07-10',
            periodNumber: 1,
            replacement: { type: 'lesson_name', lessonName: '学年行事' },
          },
          {
            sourceId: ids[1],
            targetScopeType: 'class',
            changeDate: '2026-07-10',
            periodNumber: 1,
            replacement: { type: 'cancelled' },
          },
          {
            sourceId: ids[2],
            targetScopeType: 'track',
            changeDate: '2026-07-10',
            periodNumber: 1,
            replacement: {
              type: 'period_reference',
              weekday: 2,
              periodNumber: 2,
            },
          },
          {
            sourceId: ids[3],
            targetScopeType: 'student',
            changeDate: '2026-07-10',
            periodNumber: 1,
            replacement: {
              type: 'floating_lesson_reference',
              floatingLessonReferenceLabelId: '2026:2:★',
            },
          },
        ])
      ).status,
    ).toBe(201)

    const response = await readTimetableChangeLayers(env, cookie)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ready',
      schoolDate: '2026-07-10',
      periodNumber: 1,
      standardTimetable: {
        periodReference: { weekday: 5, periodNumber: 1 },
        lessonName: '地理',
      },
      layers: [
        {
          targetScopeType: 'grade',
          state: 'active',
          sharedInformationItemId: ids[0],
          latestChangeId: `${ids[0]}:change`,
          replacement: { type: 'lesson_name', lessonName: '学年行事' },
          changedAt: expect.any(Number),
        },
        {
          targetScopeType: 'class',
          state: 'active',
          sharedInformationItemId: ids[1],
          latestChangeId: `${ids[1]}:change`,
          replacement: { type: 'cancelled' },
          changedAt: expect.any(Number),
        },
        {
          targetScopeType: 'track',
          state: 'active',
          sharedInformationItemId: ids[2],
          latestChangeId: `${ids[2]}:change`,
          replacement: {
            type: 'period_reference',
            weekday: 2,
            periodNumber: 2,
          },
          changedAt: expect.any(Number),
        },
        {
          targetScopeType: 'student',
          state: 'active',
          sharedInformationItemId: ids[3],
          latestChangeId: `${ids[3]}:change`,
          replacement: {
            type: 'floating_lesson_reference',
            floatingLessonReferenceLabelId: '2026:2:★',
            referenceLabel: '★',
          },
          changedAt: expect.any(Number),
        },
      ],
      finalDailyLesson: {
        lessonName: '自走',
        timetableChangeState: 'resolved',
      },
    })
  })

  it('represents missing Standard Timetable and inactive layers without attribution', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )

    const response = await readTimetableChangeLayers(
      env,
      cookie,
      '2026-07-10',
      2,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ready',
      schoolDate: '2026-07-10',
      periodNumber: 2,
      standardTimetable: null,
      layers: [
        { targetScopeType: 'grade', state: 'unchanged' },
        { targetScopeType: 'class', state: 'unchanged' },
        { targetScopeType: 'track', state: 'unchanged' },
        { targetScopeType: 'student', state: 'unchanged' },
      ],
      finalDailyLesson: {
        lessonName: '',
        timetableChangeState: 'unchanged',
      },
    })
  })

  it('resolves the final Daily Lesson for every replacement kind', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const changes = [
      {
        sourceId: '61111111-1111-4111-8111-111111111111',
        targetScopeType: 'grade',
        changeDate: '2026-07-10',
        periodNumber: 1,
        replacement: { type: 'lesson_name', lessonName: '学年行事' },
      },
      {
        sourceId: '71111111-1111-4111-8111-111111111111',
        targetScopeType: 'class',
        changeDate: '2026-07-10',
        periodNumber: 2,
        replacement: { type: 'cancelled' },
      },
      {
        sourceId: '81111111-1111-4111-8111-111111111111',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 3,
        replacement: {
          type: 'period_reference',
          weekday: 2,
          periodNumber: 2,
        },
      },
      {
        sourceId: '91111111-1111-4111-8111-111111111111',
        targetScopeType: 'student',
        changeDate: '2026-07-10',
        periodNumber: 4,
        replacement: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: '2026:2:★',
        },
      },
    ]
    expect((await addDirectTimetableChanges(env, cookie, changes)).status).toBe(
      201,
    )

    const lessonName = await readTimetableChangeLayers(env, cookie, '2026-07-10', 1)
    const cancelled = await readTimetableChangeLayers(env, cookie, '2026-07-10', 2)
    const periodReference = await readTimetableChangeLayers(
      env,
      cookie,
      '2026-07-10',
      3,
    )
    const floatingReference = await readTimetableChangeLayers(
      env,
      cookie,
      '2026-07-10',
      4,
    )

    const finalDailyLesson = async (response: Response) =>
      (
        (await response.json()) as {
          finalDailyLesson: {
            lessonName: string
            timetableChangeState: string
          }
        }
      ).finalDailyLesson

    expect(await finalDailyLesson(lessonName)).toEqual({
      lessonName: '学年行事',
      timetableChangeState: 'resolved',
    })
    expect(await finalDailyLesson(cancelled)).toEqual({
      lessonName: '',
      timetableChangeState: 'cancelled',
    })
    expect(await finalDailyLesson(periodReference)).toEqual({
      lessonName: '古典',
      timetableChangeState: 'resolved',
    })
    expect(await finalDailyLesson(floatingReference)).toEqual({
      lessonName: '自走',
      timetableChangeState: 'resolved',
    })
  })

  it('returns only Timetable Layers applicable to the current Student Affiliation', async () => {
    const env = createDailyPlanTestEnv()
    const humanitiesCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const scienceCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-science-1',
    )
    const otherClassCookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )
    const priorYearCookie = await testLoginCookie(
      env,
      'test-student-2025-2-3-humanities-1',
    )
    expect(
      (
        await addDirectTimetableChanges(env, humanitiesCookie, [
          {
            sourceId: 'a2111111-1111-4111-8111-111111111111',
            targetScopeType: 'grade',
            changeDate: '2026-07-10',
            periodNumber: 5,
            replacement: { type: 'lesson_name', lessonName: '学年' },
          },
          {
            sourceId: 'a3111111-1111-4111-8111-111111111111',
            targetScopeType: 'class',
            changeDate: '2026-07-10',
            periodNumber: 5,
            replacement: { type: 'lesson_name', lessonName: 'クラス' },
          },
          {
            sourceId: 'a4111111-1111-4111-8111-111111111111',
            targetScopeType: 'track',
            changeDate: '2026-07-10',
            periodNumber: 5,
            replacement: { type: 'lesson_name', lessonName: '文科' },
          },
          {
            sourceId: 'a5111111-1111-4111-8111-111111111111',
            targetScopeType: 'student',
            changeDate: '2026-07-10',
            periodNumber: 5,
            replacement: { type: 'lesson_name', lessonName: '個人' },
          },
        ])
      ).status,
    ).toBe(201)

    const science = (await (
      await readTimetableChangeLayers(env, scienceCookie, '2026-07-10', 5)
    ).json()) as { layers: Array<{ targetScopeType: string; state: string }> }
    expect(science.layers.map(({ targetScopeType, state }) => [targetScopeType, state])).toEqual([
      ['grade', 'active'],
      ['class', 'active'],
      ['track', 'unchanged'],
      ['student', 'unchanged'],
    ])

    const otherClass = (await (
      await readTimetableChangeLayers(env, otherClassCookie, '2026-07-10', 5)
    ).json()) as { layers: Array<{ targetScopeType: string; state: string }> }
    expect(
      otherClass.layers.map(({ targetScopeType, state }) => [targetScopeType, state]),
    ).toEqual([
      ['grade', 'active'],
      ['class', 'unchanged'],
      ['track', 'unchanged'],
      ['student', 'unchanged'],
    ])
    expect(
      (
        await readTimetableChangeLayers(
          env,
          priorYearCookie,
          '2026-07-10',
          5,
        )
      ).status,
    ).toBe(409)
  })

  it('rejects unauthenticated and invalid layer requests', async () => {
    const env = createDailyPlanTestEnv()
    expect((await readTimetableChangeLayers(env)).status).toBe(401)
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    expect(
      (await readTimetableChangeLayers(env, cookie, '2026-02-30', 1)).status,
    ).toBe(400)
    expect(
      (await readTimetableChangeLayers(env, cookie, '2027-04-01', 1)).status,
    ).toBe(400)
    expect(
      (await readTimetableChangeLayers(env, cookie, '2026-07-10', 8)).status,
    ).toBe(400)
  })
})

describe('Daily Plan read API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('rejects unauthenticated Student Session requests', async () => {
    const response = await readDailyPlan(createDailyPlanTestEnv())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      status: 'unauthenticated',
    })
  })

  it('defaults to the current JST School Date and returns class-common and Track-specific Lessons', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T16:30:00.000Z'))
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readDailyPlan(env, cookie)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      schoolDate: '2026-07-10',
      weekday: 5,
      studentAffiliation: {
        schoolYear: 2026,
        grade: 2,
        classNumber: 3,
        trackName: '文科',
      },
      periods: [
        { periodNumber: 1, lessonName: '地理' },
        { periodNumber: 2, lessonName: '' },
        { periodNumber: 3, lessonName: '' },
        { periodNumber: 4, lessonName: '現代文' },
        { periodNumber: 5, lessonName: '' },
        { periodNumber: 6, lessonName: '' },
        { periodNumber: 7, lessonName: '' },
      ],
    })
  })

  it('returns the selected valid School Date and applies Science Track overrides', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-science-1',
    )

    const response = await readDailyPlan(env, cookie, '2026-07-07')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      schoolDate: '2026-07-07',
      weekday: 2,
      studentAffiliation: {
        trackName: '理科',
      },
      periods: [
        { periodNumber: 1, lessonName: '' },
        { periodNumber: 2, lessonName: '生物' },
        { periodNumber: 3, lessonName: '' },
        { periodNumber: 4, lessonName: '' },
        { periodNumber: 5, lessonName: '' },
        { periodNumber: 6, lessonName: '' },
        { periodNumber: 7, lessonName: '' },
      ],
    })
  })

  it('keeps Humanities and Science split Lessons distinct for the same Lesson Slot', async () => {
    const env = createDailyPlanTestEnv()
    const humanitiesCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const scienceCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-science-1',
    )

    const humanitiesResponse = await readDailyPlan(
      env,
      humanitiesCookie,
      '2026-07-07',
    )
    const scienceResponse = await readDailyPlan(
      env,
      scienceCookie,
      '2026-07-07',
    )
    const humanitiesBody = (await humanitiesResponse.json()) as {
      periods: Array<{ periodNumber: number; lessonName: string }>
    }
    const scienceBody = (await scienceResponse.json()) as {
      periods: Array<{ periodNumber: number; lessonName: string }>
    }

    expect(humanitiesBody.periods[1]).toEqual({
      periodNumber: 2,
      lessonName: '古典',
      hasTasks: false,
      notes: [],
    })
    expect(scienceBody.periods[1]).toEqual({
      periodNumber: 2,
      lessonName: '生物',
      hasTasks: false,
      notes: [],
    })
  })

  it('keeps 2026 Grade 2 Class 4 Lesson Slots blank while placeholder Tasks and Notes remain visible', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )

    const response = await readDailyPlan(env, cookie, '2026-07-10')
    const body = (await response.json()) as {
      periods: Array<{
        lessonName: string
        hasTasks: boolean
        notes: Array<unknown>
      }>
      tasks: Array<unknown>
      notes: Array<unknown>
    }

    expect(response.status).toBe(200)
    expect(body.periods).toEqual(
      Array.from({ length: 7 }, (_, index) => ({
        periodNumber: index + 1,
        lessonName: '',
        hasTasks: false,
        notes:
          index === 1
            ? [
                {
                  noteId: 'placeholder-daily-lesson-note-2026-07-10-period-2',
                  body: 'Placeholder: Bring dictionary for second period.',
                  relatedContext: {
                    type: 'daily-lesson',
                    schoolDate: '2026-07-10',
                    periodNumber: 2,
                  },
                },
              ]
            : [],
      })),
    )
    expect(body.tasks.length).toBeGreaterThan(0)
    expect(body.notes.length).toBeGreaterThan(0)
  })

  it('keeps blank Lesson Slots empty instead of returning a rest label', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readDailyPlan(env, cookie, '2026-07-11')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      schoolDate: '2026-07-11',
      weekday: 6,
      periods: [
        { periodNumber: 1, lessonName: '三丘SHSP' },
        { periodNumber: 2, lessonName: '' },
        { periodNumber: 3, lessonName: '' },
        { periodNumber: 4, lessonName: '' },
        { periodNumber: 5, lessonName: '' },
        { periodNumber: 6, lessonName: '' },
        { periodNumber: 7, lessonName: '' },
      ],
    })
  })

  it('does not turn a Floating Lesson Reference into a Daily Lesson without a Timetable Change', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readDailyPlan(env, cookie, '2026-07-10')
    const body = (await response.json()) as {
      periods: Array<{ lessonName: string }>
    }

    expect(response.status).toBe(200)
    expect(body.periods.map((period) => period.lessonName)).not.toContain('自走')
  })

  it('fails cleanly for invalid date query values', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readDailyPlan(env, cookie, '2026-02-31')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      status: 'invalid-date',
    })
  })

  it('reports Affiliation Renewal needed when no current Student Affiliation exists', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2025-2-3-humanities-1',
    )

    const response = await readDailyPlan(env, cookie, '2026-07-10')

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      status: 'affiliation-renewal-needed',
      schoolYear: 2026,
    })
  })

  it('returns placeholder Tasks and derives Lesson task markers from related Lesson and Lesson Name', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readDailyPlan(env, cookie, '2026-07-10')
    const body = (await response.json()) as {
      tasks: Array<Record<string, unknown>>
      periods: Array<Record<string, unknown>>
    }

    expect(response.status).toBe(200)
    expect(body.tasks).toMatchObject([
      {
        title: 'Placeholder: Bring geography worksheet',
        dueDate: '2026-07-10',
        relatedLesson: {
          schoolDate: '2026-07-10',
          periodNumber: 1,
          lessonName: '地理',
        },
        completed: false,
      },
      {
        title: 'Placeholder: Modern Japanese reading',
        dueLabel: '今日',
        relatedLessonName: '現代文',
        completed: false,
      },
    ])
    expect(body.tasks[0]).not.toHaveProperty('dueReference')
    expect(body.tasks[0]).not.toHaveProperty('duePeriodNumber')
    expect(body.tasks[1]).not.toHaveProperty('dueReference')
    expect(body.tasks[1]).not.toHaveProperty('duePeriodNumber')
    expect(body.periods).toMatchObject([
      { periodNumber: 1, lessonName: '地理', hasTasks: true },
      { periodNumber: 2, lessonName: '', hasTasks: false },
      { periodNumber: 3, lessonName: '', hasTasks: false },
      { periodNumber: 4, lessonName: '現代文', hasTasks: true },
      { periodNumber: 5, lessonName: '', hasTasks: false },
      { periodNumber: 6, lessonName: '', hasTasks: false },
      { periodNumber: 7, lessonName: '', hasTasks: false },
    ])
  })

  it('returns placeholder Notes for Daily Lessons, School Date, and no-context only when visible for the selected Daily Plan', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readDailyPlan(env, cookie, '2026-07-10')
    const body = (await response.json()) as {
      notes: Array<Record<string, unknown>>
      periods: Array<Record<string, unknown>>
    }

    expect(response.status).toBe(200)
    expect(body.periods[0]).toMatchObject({ periodNumber: 1, notes: [] })
    expect(body.periods[1]).toMatchObject({
      periodNumber: 2,
      notes: [
        {
          noteId: 'placeholder-daily-lesson-note-2026-07-10-period-2',
          body: 'Placeholder: Bring dictionary for second period.',
          relatedContext: {
            type: 'daily-lesson',
            schoolDate: '2026-07-10',
            periodNumber: 2,
          },
        },
      ],
    })
    expect(body.notes).toEqual([
      {
        noteId: 'placeholder-school-date-note-2026-07-10',
        body: 'Placeholder: Submit library form today.',
        relatedContext: {
          type: 'school-date',
          schoolDate: '2026-07-10',
        },
      },
      {
        noteId: 'placeholder-no-context-note',
        body: 'Placeholder: Student council announcement.',
        relatedContext: null,
      },
    ])
  })

  it('returns a School Date keyed range of Daily Plans for prefetching', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readDailyPlans(
      env,
      cookie,
      '2026-07-09',
      '2026-07-11',
    )
    const body = (await response.json()) as {
      dailyPlans: Record<string, { schoolDate: string; weekday: number }>
    }

    expect(response.status).toBe(200)
    expect(Object.keys(body.dailyPlans)).toEqual([
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
    ])
    expect(body.dailyPlans['2026-07-10']).toMatchObject({
      schoolDate: '2026-07-10',
      weekday: 5,
    })
  })
})

describe('test login', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns not found when disabled or when the secret is missing or wrong', async () => {
    expect(
      (
        await testLogin(
          createTestEnv(),
          'test-student-2026-2-3-humanities-1',
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await testLogin(
          createTestLoginEnv(),
          'test-student-2026-2-3-humanities-1',
          null,
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await testLogin(
          createTestLoginEnv(),
          'test-student-2026-2-3-humanities-1',
          'wrong-secret',
        )
      ).status,
    ).toBe(404)
  })

  it('refuses missing and non-test Student Accounts', async () => {
    const env = createTestLoginEnv()

    expect((await testLogin(env, 'test-student-missing')).status).toBe(404)
    expect((await testLogin(env, 'test-student-custom')).status).toBe(404)
    expect((await testLogin(env, 'student-account-1')).status).toBe(404)
  })

  it('creates a normal Student Session for a fixed test Student Account', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'))
    const env = createTestLoginEnv()

    const loginResponse = await testLogin(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    expect(loginResponse.status).toBe(200)
    await expect(loginResponse.json()).resolves.toMatchObject({
      status: 'authenticated',
      testLogin: true,
      studentAccount: {
        schoolEmail: 'test-student-2026-2-3-humanities-1@example.invalid',
        displayName: 'Test Humanities 1',
      },
    })

    const cookie = loginResponse.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('tsugi_session=')
    expect(cookie).toContain('Max-Age=2592000')

    const sessionResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/session', {
        headers: { cookie },
      }),
      env,
    )

    await expect(sessionResponse.json()).resolves.toMatchObject({
      status: 'authenticated',
      studentAccount: {
        schoolEmail: 'test-student-2026-2-3-humanities-1@example.invalid',
      },
    })
  })
})

describe('verification code requests', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('sends a verification code to the normalized School Email', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      createTestEnv(),
    )

    await expect(response.json()).resolves.toEqual({
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
    })
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    const [, resendRequest] = fetchMock.mock.calls[0]
    const resendBody = JSON.parse(String(resendRequest?.body)) as {
      from: string
      to: string[]
      subject: string
      text: string
    }
    expect(resendBody).toMatchObject({
      from: 'Tsugi <no-reply@jikanwari.is-a.dev>',
      to: ['110-12345678mkn@e.osakamanabi.jp'],
      subject: 'Tsugi 認証コード',
    })
    expect(resendBody.text).toMatch(/[0-9]{6}/)
  })

  it('rejects invalid School Email numbers without sending email', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '１２３４５６７８' }),
      }),
      createTestEnv(),
    )

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rate limits verification code requests inside the resend cooldown', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const env = createTestEnv()

    const request = () =>
      worker.fetch(
        new Request('https://tsugi.test/api/auth/verification-code-requests', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ schoolEmailNumber: '12345678' }),
        }),
        env,
      )

    const firstResponse = await request()
    const secondResponse = await request()

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rate limits verification code requests after five sends in one hour', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'))

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const env = createTestEnv()

    const request = () =>
      worker.fetch(
        new Request('https://tsugi.test/api/auth/verification-code-requests', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ schoolEmailNumber: '12345678' }),
        }),
        env,
      )

    for (let index = 0; index < 5; index += 1) {
      const response = await request()
      expect(response.status).toBe(200)
      vi.advanceTimersByTime(61_000)
    }

    const rateLimitedResponse = await request()

    expect(rateLimitedResponse.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('returns a recoverable error when the email provider cannot send', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('unauthorized', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      createTestEnv(),
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'verification_code_delivery_failed',
    })
  })
})

describe('existing Student Account login', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('verifies a code, creates a session cookie, and exposes current session state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'))

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const env = createTestEnv()

    const sendResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      env,
    )
    expect(sendResponse.status).toBe(200)

    const loginResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-verifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schoolEmailNumber: '12345678',
          code: getLastSentCode(fetchMock),
        }),
      }),
      env,
    )

    expect(loginResponse.status).toBe(200)
    await expect(loginResponse.json()).resolves.toMatchObject({
      status: 'authenticated',
      studentAccount: {
        schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      },
    })

    const cookie = loginResponse.headers.get('set-cookie')
    expect(cookie).toContain('tsugi_session=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')

    const sessionResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/session', {
        headers: { cookie: cookie ?? '' },
      }),
      env,
    )

    expect(sessionResponse.status).toBe(200)
    await expect(sessionResponse.json()).resolves.toMatchObject({
      status: 'authenticated',
      studentAccount: {
        schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      },
    })
  })

  it('returns unauthenticated after logout invalidates the server session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'))

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const env = createTestEnv()

    await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      env,
    )

    const loginResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-verifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schoolEmailNumber: '12345678',
          code: getLastSentCode(fetchMock),
        }),
      }),
      env,
    )
    const cookie = loginResponse.headers.get('set-cookie') ?? ''

    const logoutResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/session', {
        method: 'DELETE',
        headers: { cookie },
      }),
      env,
    )

    expect(logoutResponse.status).toBe(204)
    expect(logoutResponse.headers.get('set-cookie')).toContain(
      'tsugi_session=; Max-Age=0',
    )

    const sessionResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/session', {
        headers: { cookie },
      }),
      env,
    )

    await expect(sessionResponse.json()).resolves.toEqual({
      status: 'unauthenticated',
    })
  })

  it('rejects expired, stale, and exhausted verification codes with a retryable error', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'))

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const env = createTestEnv()

    await requestVerificationCode(env)
    const expiredCode = getLastSentCode(fetchMock)
    vi.advanceTimersByTime(10 * 60_000 + 1)

    const expiredResponse = await verifyCode(env, expiredCode)
    expect(expiredResponse.status).toBe(400)
    await expect(expiredResponse.json()).resolves.toEqual({
      error: 'invalid_verification_code',
    })

    await requestVerificationCode(env)
    const staleCode = getLastSentCode(fetchMock)
    vi.advanceTimersByTime(61_000)
    await requestVerificationCode(env)
    const latestCode = getLastSentCode(fetchMock)

    expect((await verifyCode(env, staleCode)).status).toBe(400)
    expect((await verifyCode(env, latestCode)).status).toBe(200)

    vi.advanceTimersByTime(61_000)
    await requestVerificationCode(env)
    const exhaustedCode = getLastSentCode(fetchMock)

    for (let index = 0; index < 5; index += 1) {
      expect((await verifyCode(env, '000000')).status).toBe(400)
    }

    expect((await verifyCode(env, exhaustedCode)).status).toBe(400)
  })
})

describe('new Student Account setup session', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('verifies a code for a new Student and creates a setup session cookie', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'))

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const env = createNewStudentTestEnv()

    await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      env,
    )

    const verifyResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-verifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schoolEmailNumber: '12345678',
          code: getLastSentCode(fetchMock),
        }),
      }),
      env,
    )

    expect(verifyResponse.status).toBe(200)
    await expect(verifyResponse.json()).resolves.toEqual({
      status: 'setup-required',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
    })

    const cookie = verifyResponse.headers.get('set-cookie')
    expect(cookie).toContain('tsugi_setup=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')

    const setupSessionResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/setup-session', {
        headers: { cookie: cookie ?? '' },
      }),
      env,
    )

    expect(setupSessionResponse.status).toBe(200)
    await expect(setupSessionResponse.json()).resolves.toEqual({
      status: 'valid',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
    })
  })

  it('invalidates stale setup sessions when a new verification code is sent', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'))

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const env = createNewStudentTestEnv()

    await requestVerificationCode(env)
    const firstVerifyResponse = await verifyCode(env, getLastSentCode(fetchMock))
    const staleSetupCookie = firstVerifyResponse.headers.get('set-cookie') ?? ''

    vi.advanceTimersByTime(61_000)
    await requestVerificationCode(env)
    const latestVerifyResponse = await verifyCode(env, getLastSentCode(fetchMock))
    const latestSetupCookie = latestVerifyResponse.headers.get('set-cookie') ?? ''

    const staleOptionsResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/initial-setup', {
        headers: { cookie: staleSetupCookie },
      }),
      env,
    )
    const latestOptionsResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/initial-setup', {
        headers: { cookie: latestSetupCookie },
      }),
      env,
    )

    expect(staleOptionsResponse.status).toBe(400)
    await expect(staleOptionsResponse.json()).resolves.toEqual({
      status: 'invalid-setup-session',
    })
    expect(latestOptionsResponse.status).toBe(200)
  })
})

describe('initial Student Affiliation setup API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns setup choices and completes confirmed initial setup', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'))

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const env = createNewStudentTestEnv()

    await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      env,
    )
    const verifyResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/verification-code-verifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schoolEmailNumber: '12345678',
          code: getLastSentCode(fetchMock),
        }),
      }),
      env,
    )
    const cookie = verifyResponse.headers.get('set-cookie') ?? ''

    const optionsResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/initial-setup', {
        headers: { cookie },
      }),
      env,
    )

    expect(optionsResponse.status).toBe(200)
    await expect(optionsResponse.json()).resolves.toMatchObject({
      status: 'ready',
      schoolYear: 2026,
      grades: [
        {
          grade: 1,
          classes: [
            {
              classId: 'class-1-1',
              classNumber: 1,
              tracks: [{ trackId: 'track-1-1-a', trackName: 'A' }],
            },
          ],
        },
      ],
    })

    const submitResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/initial-setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          displayName: '  Sora  ',
          realName: '  空  ',
          trackId: 'track-1-1-a',
          confirmed: true,
        }),
      }),
      env,
    )

    expect(submitResponse.status).toBe(200)
    await expect(submitResponse.json()).resolves.toMatchObject({
      status: 'authenticated',
      studentAccount: {
        schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
        displayName: 'Sora',
      },
    })

    const sessionCookie = submitResponse.headers.get('set-cookie') ?? ''
    expect(sessionCookie).toContain('tsugi_session=')

    const sessionResponse = await worker.fetch(
      new Request('https://tsugi.test/api/auth/session', {
        headers: { cookie: sessionCookie },
      }),
      env,
    )

    await expect(sessionResponse.json()).resolves.toMatchObject({
      status: 'authenticated',
      studentAccount: {
        schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      },
    })
  })

  it('does not create duplicate Student Accounts when setup completion is retried', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'))

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const env = createNewStudentTestEnv()

    await requestVerificationCode(env)
    const verifyResponse = await verifyCode(env, getLastSentCode(fetchMock))
    const cookie = verifyResponse.headers.get('set-cookie') ?? ''
    const setupRequest = () =>
      worker.fetch(
        new Request('https://tsugi.test/api/auth/initial-setup', {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({
            displayName: 'Sora',
            realName: '空',
            trackId: 'track-1-1-a',
            confirmed: true,
          }),
        }),
        env,
      )

    const firstResponse = await setupRequest()
    const secondResponse = await setupRequest()

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(400)
    await expect(secondResponse.json()).resolves.toEqual({
      status: 'invalid-setup-session',
    })
  })
})
