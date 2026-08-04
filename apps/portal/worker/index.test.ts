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
    TEST_REGISTERED_LESSON_NAMES: [
      { registeredLessonNameId: 'mathematics-2-beta', fullLessonName: '理数数学Ⅱβ', shortLessonName: '数Ⅱβ', normalizedFullLessonName: '理数数学iiβ' },
      { registeredLessonNameId: 'classics', fullLessonName: '古典探究', shortLessonName: '古典', normalizedFullLessonName: '古典探究' },
      { registeredLessonNameId: 'biology', fullLessonName: '理数生物特講Ⅰ', shortLessonName: '生物', normalizedFullLessonName: '理数生物特講i' },
      { registeredLessonNameId: 'geography', fullLessonName: '地理総合', shortLessonName: '地理', normalizedFullLessonName: '地理総合' },
      { registeredLessonNameId: 'class-common-fallback', fullLessonName: 'class-common fallback', shortLessonName: 'class-common fallback', normalizedFullLessonName: 'class-common fallback' },
      { registeredLessonNameId: 'modern-japanese', fullLessonName: '現代文探究', shortLessonName: '現代文', normalizedFullLessonName: '現代文探究' },
      { registeredLessonNameId: 'mioka-shsp', fullLessonName: '三丘SHSP', shortLessonName: '三丘SHSP', normalizedFullLessonName: '三丘shsp' },
      { registeredLessonNameId: 'self-directed-study', fullLessonName: '自走', shortLessonName: '自走', normalizedFullLessonName: '自走' },
    ],
    TEST_STANDARD_TIMETABLE_ENTRIES: [
      {
        standardTimetableEntryId: 'mon-1-common',
        classId: '2026-grade-2-class-3',
        trackId: null,
        referenceType: 'period',
        weekday: 1,
        periodNumber: 1,
        registeredLessonNameId: 'mathematics-2-beta',
      },
      {
        standardTimetableEntryId: 'tue-2-humanities',
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-humanities',
        referenceType: 'period',
        weekday: 2,
        periodNumber: 2,
        registeredLessonNameId: 'classics',
      },
      {
        standardTimetableEntryId: 'tue-2-science',
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-science',
        referenceType: 'period',
        weekday: 2,
        periodNumber: 2,
        registeredLessonNameId: 'biology',
      },
      {
        standardTimetableEntryId: 'fri-1-common',
        classId: '2026-grade-2-class-3',
        trackId: null,
        referenceType: 'period',
        weekday: 5,
        periodNumber: 1,
        registeredLessonNameId: 'geography',
      },
      {
        standardTimetableEntryId: 'fri-4-common',
        classId: '2026-grade-2-class-3',
        trackId: null,
        referenceType: 'period',
        weekday: 5,
        periodNumber: 4,
        registeredLessonNameId: 'class-common-fallback',
      },
      {
        standardTimetableEntryId: 'fri-4-humanities',
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-humanities',
        referenceType: 'period',
        weekday: 5,
        periodNumber: 4,
        registeredLessonNameId: 'modern-japanese',
      },
      {
        standardTimetableEntryId: 'sat-1-common',
        classId: '2026-grade-2-class-3',
        trackId: null,
        referenceType: 'period',
        weekday: 6,
        periodNumber: 1,
        registeredLessonNameId: 'mioka-shsp',
      },
      {
        standardTimetableEntryId: 'floating-star-humanities',
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-humanities',
        referenceType: 'floating',
        referenceLabel: '★',
        floatingLessonReferenceLabelId: '2026:2:★',
        registeredLessonNameId: 'self-directed-study',
      },
      {
        standardTimetableEntryId: 'floating-star-science',
        classId: '2026-grade-2-class-3',
        trackId: '2026-grade-2-class-3-science',
        referenceType: 'floating',
        referenceLabel: '★',
        floatingLessonReferenceLabelId: '2026:2:★',
        registeredLessonNameId: 'biology',
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

function addDirectChanges(
  env: Env,
  cookie: string,
  changes: Array<Record<string, unknown>>,
) {
  return worker.fetch(
    new Request('https://tsugi.test/api/shared-information/direct-changes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ changes }),
    }),
    env,
  )
}

function readNoteEditHistory(env: Env, cookie: string, noteId: string) {
  return worker.fetch(
    new Request(
      `https://tsugi.test/api/notes/${encodeURIComponent(noteId)}/history`,
      { headers: cookie ? { cookie } : {} },
    ),
    env,
  )
}

function readReferenceTasks(
  env: Env,
  cookie = '',
  date?: string,
  scope?: string,
  value?: string,
) {
  return readReferenceContent(
    '/api/tasks/reference', env, cookie, date, scope, value,
  )
}

function issueInteractiveTestLoginTicket(
  env: Env,
  studentAccountId: string,
  secret: string | null = 'test-secret',
) {
  const headers = new Headers({ 'content-type': 'application/json' })

  if (secret !== null) {
    headers.set('x-test-login-secret', secret)
  }

  return worker.fetch(
    new Request('https://tsugi.test/api/test/login-tickets', {
      method: 'POST',
      headers,
      body: JSON.stringify({ studentAccountId }),
    }),
    env,
  )
}

function exchangeInteractiveTestLoginTicket(env: Env, ticket: string) {
  return worker.fetch(
    new Request(
      `https://tsugi.test/api/test/login-tickets/${encodeURIComponent(ticket)}`,
    ),
    env,
  )
}

function readReferenceDailyPlan(
  env: Env,
  cookie = '',
  date?: string,
  scope?: string,
  value?: string,
) {
  return readReferenceContent(
    '/api/daily-plans/reference', env, cookie, date, scope, value,
  )
}

function readReferenceContent(
  pathname: '/api/tasks/reference' | '/api/daily-plans/reference',
  env: Env,
  cookie = '',
  date?: string,
  scope?: string,
  value?: string,
) {
  const url = new URL(`https://tsugi.test${pathname}`)
  if (date !== undefined) url.searchParams.set('date', date)
  if (scope !== undefined) url.searchParams.set('scope', scope)
  if (value !== undefined) url.searchParams.set('value', value)

  return worker.fetch(new Request(url, {
    headers: cookie ? { cookie } : {},
  }), env)
}

function readReferenceScopeOptions(env: Env, cookie = '') {
  return worker.fetch(
    new Request('https://tsugi.test/api/daily-plans/reference/options', {
      headers: cookie ? { cookie } : {},
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

function readSharedInformationChangeDetail(
  env: Env,
  cookie: string,
  sharedInformationChangeId: string,
) {
  return worker.fetch(
    new Request(
      `https://tsugi.test/api/shared-information-changes/${
        encodeURIComponent(sharedInformationChangeId)
      }`,
      { headers: cookie ? { cookie } : {} },
    ),
    env,
  )
}

function readTaskEditHistory(env: Env, cookie: string, taskId: string) {
  return worker.fetch(
    new Request(
      `https://tsugi.test/api/tasks/${encodeURIComponent(taskId)}/history`,
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
      lessonReference: {
        type: 'period_reference',
        weekday: 5,
        periodNumber: 4,
      },
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
    const body = await response.json() as {
      registeredLessonNames: Array<{ registeredLessonNameId: string }>
      [key: string]: unknown
    }
    expect(body).toMatchObject({
      periodReferences: expect.arrayContaining([
        { weekday: 1, periodNumber: 1, lessonName: '数Ⅱβ' },
        { weekday: 2, periodNumber: 2, lessonName: '古典' },
      ]),
      floatingLessonReferenceLabels: expect.arrayContaining([
        expect.objectContaining({ referenceLabel: '★', lessonName: '自走' }),
      ]),
      registeredLessonNames: expect.arrayContaining([
        expect.objectContaining({ registeredLessonNameId: 'mathematics-2-beta' }),
        expect.objectContaining({ registeredLessonNameId: 'classics' }),
        expect.objectContaining({ registeredLessonNameId: 'self-directed-study' }),
      ]),
      allRegisteredLessonNames: expect.arrayContaining([
        expect.objectContaining({ registeredLessonNameId: 'geography' }),
        expect.objectContaining({ registeredLessonNameId: 'biology' }),
      ]),
    })
    const prioritizedIds = body.registeredLessonNames.map(
      ({ registeredLessonNameId }) => registeredLessonNameId,
    )
    expect(prioritizedIds).not.toContain('class-common-fallback')
    expect(prioritizedIds).not.toContain('biology')
  })

  it('persists Registered and custom direct Lesson Names through projection, history, and retries', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(env, 'test-student-2026-2-3-humanities-1')
    const registeredId = '12111111-1111-4111-8111-111111111111'
    const customId = '13111111-1111-4111-8111-111111111111'
    const changes = [
      {
        sourceId: registeredId,
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
        replacement: {
          type: 'lesson_name',
          registeredLessonNameId: 'mathematics-2-beta',
        },
      },
      {
        sourceId: customId,
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 3,
        replacement: { type: 'lesson_name', lessonName: '  特別   LESSON  ' },
      },
    ]

    expect((await addDirectTimetableChanges(env, cookie, changes)).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, changes)).status).toBe(201)

    const plan = await (await readDailyPlan(env, cookie, '2026-07-10')).json() as {
      periods: Array<{ lessonName: string }>
    }
    expect(plan.periods[1].lessonName).toBe('数Ⅱβ')
    expect(plan.periods[2].lessonName).toBe('特別   LESSON')

    const registeredHistory = await (await readTimetableChangeHistory(
      env,
      cookie,
      'track',
      '2026-07-10',
      2,
    )).json() as { entries: Array<{ after: unknown }> }
    expect(registeredHistory.entries[0].after).toEqual({
      type: 'lesson_name',
      registeredLessonNameId: 'mathematics-2-beta',
      lessonName: '数Ⅱβ',
    })

    const customHistory = await (await readTimetableChangeHistory(
      env,
      cookie,
      'track',
      '2026-07-10',
      3,
    )).json() as { entries: Array<{ after: unknown }> }
    expect(customHistory.entries[0].after).toEqual({
      type: 'lesson_name',
      lessonName: '特別   LESSON',
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
    const scienceResponse = await addDirectTimetableChanges(env, scienceCookie, [
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
    expect(scienceResponse.status).toBe(201)
    const sciencePlanResponse = await readDailyPlan(env, scienceCookie, '2026-07-10')
    const sciencePlan = (await sciencePlanResponse.json()) as {
      periods: Array<{ lessonName: string; timetableChangeState?: string }>
    }
    expect(sciencePlan.periods[1]).toMatchObject({
      lessonName: '生物',
      timetableChangeState: 'resolved',
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

    const detailResponse = await readSharedInformationChangeDetail(
      env,
      cookie,
      `${updateId}:change`,
    )
    expect(detailResponse.status).toBe(200)
    expect(await detailResponse.json()).toMatchObject({
      status: 'ready',
      kind: 'timetable_change',
      sharedInformationChangeId: `${updateId}:change`,
      sharedInformationItemId: firstItemId,
      changeKind: 'update',
      source: {
        type: 'direct',
        primaryActorDisplayName: 'Test Humanities 1',
      },
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
    expect((await worker.fetch(
      new Request(
        `https://tsugi.test/api/timetable-changes/direct/${
          encodeURIComponent(`${updateId}:change`)
        }`,
        { headers: { cookie } },
      ),
      env,
    )).status).toBe(404)

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
    expect((await readSharedInformationChangeDetail(
      env,
      scienceCookie,
      `${itemId}:change`,
    )).status).toBe(404)
    expect((await readSharedInformationChangeDetail(
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

describe('Task Edit History API', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reconstructs tied add, update, and remove transitions with current Short Lesson Names and Named Attribution', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T00:00:00.000Z'))
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const taskId = '28a11111-1111-4111-8111-111111111111'
    const updateId = '28a22222-2222-4222-8222-222222222222'
    const removeId = '28a33333-3333-4333-8333-333333333333'

    expect((await addDirectTimetableChanges(env, cookie, [{
      kind: 'task',
      sourceId: taskId,
      changeKind: 'add',
      targetScopeType: 'track',
      title: '地理の準備',
      dueDate: '2026-07-10',
      relatedLessonName: { lessonName: '地理総合' },
    }])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [{
      kind: 'task',
      sourceId: updateId,
      changeKind: 'update',
      sharedInformationItemId: taskId,
      expectedLatestChangeId: `${taskId}:change`,
      targetScopeType: 'track',
      title: '地理ワークを提出',
      dueDate: '2026-07-11',
      relatedLessonName: { registeredLessonNameId: 'geography' },
    }])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [{
      kind: 'task',
      sourceId: removeId,
      changeKind: 'remove',
      sharedInformationItemId: taskId,
      expectedLatestChangeId: `${updateId}:change`,
      targetScopeType: 'track',
    }])).status).toBe(201)

    const response = await readTaskEditHistory(env, cookie, taskId)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: 'ready',
      taskId,
      targetScope: {
        type: 'track',
        value: '2026-grade-2-class-3-humanities',
      },
      entries: [
        {
          sharedInformationChangeId: `${removeId}:change`,
          changeKind: 'remove',
          sourceType: 'direct',
          primaryActorDisplayName: 'Test Humanities 1',
          changedAt: Date.parse('2026-07-10T00:00:00.000Z'),
          before: {
            title: '地理ワークを提出',
            dueDate: '2026-07-11',
            relatedLessonName: '地理',
          },
          after: null,
        },
        {
          sharedInformationChangeId: `${updateId}:change`,
          changeKind: 'update',
          sourceType: 'direct',
          primaryActorDisplayName: 'Test Humanities 1',
          changedAt: Date.parse('2026-07-10T00:00:00.000Z'),
          before: {
            title: '地理の準備',
            dueDate: '2026-07-10',
            relatedLessonName: '地理総合',
          },
          after: {
            title: '地理ワークを提出',
            dueDate: '2026-07-11',
            relatedLessonName: '地理',
          },
        },
        {
          sharedInformationChangeId: `${taskId}:change`,
          changeKind: 'add',
          sourceType: 'direct',
          primaryActorDisplayName: 'Test Humanities 1',
          changedAt: Date.parse('2026-07-10T00:00:00.000Z'),
          before: null,
          after: {
            title: '地理の準備',
            dueDate: '2026-07-10',
            relatedLessonName: '地理総合',
          },
        },
      ],
    })

    const detail = await readSharedInformationChangeDetail(
      env,
      cookie,
      `${updateId}:change`,
    )
    expect(detail.status).toBe(200)
    await expect(detail.json()).resolves.toEqual({
      status: 'ready',
      kind: 'task',
      sharedInformationChangeId: `${updateId}:change`,
      sharedInformationItemId: taskId,
      changeKind: 'update',
      source: {
        type: 'direct',
        primaryActorDisplayName: 'Test Humanities 1',
      },
      changedAt: Date.parse('2026-07-10T00:00:00.000Z'),
      targetScope: {
        type: 'track',
        value: '2026-grade-2-class-3-humanities',
      },
      before: {
        title: '地理の準備',
        dueDate: '2026-07-10',
        relatedLessonName: '地理総合',
      },
      after: {
        title: '地理ワークを提出',
        dueDate: '2026-07-11',
        relatedLessonName: '地理',
      },
    })
  })

  it('retains removed history while hiding identifiers and participant names from non-members', async () => {
    const env = createDailyPlanTestEnv()
    const creatorCookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )
    const referenceViewerCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const taskId = '28b11111-1111-4111-8111-111111111111'
    const removeId = '28b22222-2222-4222-8222-222222222222'

    expect((await addDirectTimetableChanges(env, creatorCookie, [{
      kind: 'task',
      sourceId: taskId,
      changeKind: 'add',
      targetScopeType: 'class',
      title: '4組だけのTask',
      dueDate: '2026-07-10',
    }])).status).toBe(201)

    const referenceTasks = await readReferenceTasks(
      env,
      referenceViewerCookie,
      '2026-07-10',
      'class',
      '2026-grade-2-class-4',
    )
    expect(referenceTasks.status).toBe(200)
    await expect(referenceTasks.json()).resolves.toMatchObject({
      tasks: [expect.objectContaining({ taskId })],
    })
    expect((await readTaskEditHistory(
      env,
      referenceViewerCookie,
      taskId,
    )).status).toBe(404)

    expect((await addDirectTimetableChanges(env, creatorCookie, [{
      kind: 'task',
      sourceId: removeId,
      changeKind: 'remove',
      sharedInformationItemId: taskId,
      expectedLatestChangeId: `${taskId}:change`,
      targetScopeType: 'class',
    }])).status).toBe(201)

    const retained = await readTaskEditHistory(
      env,
      creatorCookie,
      taskId,
    )
    expect(retained.status).toBe(200)
    await expect(retained.json()).resolves.toMatchObject({
      taskId,
      entries: [
        { changeKind: 'remove', primaryActorDisplayName: 'Test Class 4 Humanities 1' },
        { changeKind: 'add', primaryActorDisplayName: 'Test Class 4 Humanities 1' },
      ],
    })

    expect((await readTaskEditHistory(env, '', taskId)).status).toBe(401)
    expect((await readTaskEditHistory(
      env,
      creatorCookie,
      'unknown-task',
    )).status).toBe(404)
  })
})

describe('Timetable Layer read API', () => {
  it('keeps invalid selection precedence over Affiliation Renewal', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2025-2-3-humanities-1',
    )

    const response = await readTimetableChangeLayers(
      env,
      cookie,
      '2026-02-31',
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      status: 'invalid-selection',
    })
  })

  it('keeps invalid range precedence over Affiliation Renewal', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2025-2-3-humanities-1',
    )

    const response = await readTimetableChangeLayerRange(
      env,
      cookie,
      '2026-02-31',
      '2026-03-01',
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      status: 'invalid-selection',
    })
  })

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
        lessonReference: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: '2026:2:★',
          referenceLabel: '★',
        },
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
      lessonReference: {
        type: 'period_reference',
        weekday: 2,
        periodNumber: 2,
      },
      timetableChangeState: 'resolved',
    })
    expect(await finalDailyLesson(floatingReference)).toEqual({
      lessonName: '自走',
      lessonReference: {
        type: 'floating_lesson_reference',
        floatingLessonReferenceLabelId: '2026:2:★',
        referenceLabel: '★',
      },
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

describe('Unified Direct Change API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns 503 when D1 is unavailable before context resolution', async () => {
    const env = {
      ...createTestEnv(),
      DB: {
        prepare() {
          throw new Error('D1_ERROR: Network connection lost.')
        },
      },
    } as unknown as Env

    const response = await addDirectChanges(env, '', [{
      kind: 'note',
      sourceId: '32000000-0000-4000-8000-000000000000',
      changeKind: 'add',
      targetScopeType: 'student',
      schoolDate: null,
      body: 'Storage must be available',
    }])

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      status: 'storage-unavailable',
    })
  })

  it('atomically adds every Shared Information Kind through the common endpoint', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const response = await addDirectChanges(env, cookie, [
      {
        kind: 'timetable_change',
        sourceId: '32000000-0000-4000-8000-000000000001',
        changeKind: 'add',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 3,
        replacement: { type: 'lesson_name', lessonName: '総合' },
      },
      {
        kind: 'task',
        sourceId: '32000000-0000-4000-8000-000000000002',
        changeKind: 'add',
        targetScopeType: 'track',
        title: '地理ワークを提出',
        dueDate: '2026-07-10',
      },
      {
        kind: 'note',
        sourceId: '32000000-0000-4000-8000-000000000003',
        changeKind: 'add',
        targetScopeType: 'track',
        schoolDate: '2026-07-10',
        body: '  集合場所は視聴覚室です。\n上履きを持参してください。  ',
      },
    ])

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      status: 'applied',
      changes: [
        { sourceId: '32000000-0000-4000-8000-000000000001' },
        { sourceId: '32000000-0000-4000-8000-000000000002' },
        { sourceId: '32000000-0000-4000-8000-000000000003' },
      ],
    })

    const plan = await readDailyPlan(env, cookie, '2026-07-10')
    expect(plan.status).toBe(200)
    await expect(plan.json()).resolves.toMatchObject({
      notes: [{
        noteId: '32000000-0000-4000-8000-000000000003',
        body: '集合場所は視聴覚室です。\n上履きを持参してください。',
        relatedContext: { type: 'school-date', schoolDate: '2026-07-10' },
        targetScopeType: 'track',
      }],
    })
    const otherDate = await readDailyPlan(env, cookie, '2026-07-11')
    await expect(otherDate.json()).resolves.toMatchObject({ notes: [] })
  })

  it('adds independent Daily Lesson Notes to the selected period and exact Target Scope layer', async () => {
    vi.useFakeTimers()
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const addNote = async (
      sourceId: string,
      targetScopeType: 'grade' | 'class' | 'track' | 'student',
      body: string,
      now: string,
    ) => {
      vi.setSystemTime(new Date(now))
      return addDirectChanges(env, cookie, [{
        kind: 'note',
        sourceId,
        changeKind: 'add',
        targetScopeType,
        schoolDate: '2026-07-10',
        periodNumber: 2,
        body,
      }])
    }

    expect((await addNote(
      '32000000-0000-4000-8000-000000000101',
      'track',
      '文科の先のノート',
      '2026-07-09T01:00:00.000Z',
    )).status).toBe(201)
    expect((await addNote(
      '32000000-0000-4000-8000-000000000102',
      'grade',
      '学年のノート',
      '2026-07-09T02:00:00.000Z',
    )).status).toBe(201)
    expect((await addNote(
      '32000000-0000-4000-8000-000000000103',
      'track',
      '文科の後のノート',
      '2026-07-09T03:00:00.000Z',
    )).status).toBe(201)

    const planResponse = await readDailyPlan(env, cookie, '2026-07-10')
    const plan = await planResponse.json() as {
      periods: Array<{ notes: Array<Record<string, unknown>> }>
      notes: Array<unknown>
    }
    expect(plan.periods[1].notes.map((note) => note.body)).toEqual([
      '学年のノート',
      '文科の後のノート',
      '文科の先のノート',
    ])
    expect(plan.periods[1].notes[0]).toMatchObject({
      targetScopeType: 'grade',
      relatedContext: {
        type: 'daily-lesson',
        schoolDate: '2026-07-10',
        periodNumber: 2,
      },
    })
    expect(plan.periods[1].notes[0]).not.toHaveProperty(
      'changedByStudentAccountId',
    )
    expect(plan.periods[1].notes[0]).not.toHaveProperty('changedAt')
    expect(plan.notes).toEqual([])

    const layerResponse = await readTimetableChangeLayers(
      env,
      cookie,
      '2026-07-10',
      2,
    )
    const layerState = await layerResponse.json() as {
      layers: Array<{
        targetScopeType: string
        notes: Array<{ body: string }>
      }>
    }
    expect(layerState.layers.find(
      (layer) => layer.targetScopeType === 'grade',
    )?.notes.map((note) => note.body)).toEqual(['学年のノート'])
    expect(layerState.layers.find(
      (layer) => layer.targetScopeType === 'track',
    )?.notes.map((note) => note.body)).toEqual([
      '文科の後のノート',
      '文科の先のノート',
    ])
  })

  it('keeps a Daily Lesson Note attached when Timetable Changes change or disappear', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const noteId = '32000000-0000-4000-8000-000000000111'
    const timetableId = '32000000-0000-4000-8000-000000000112'
    expect((await addDirectChanges(env, cookie, [
      {
        kind: 'timetable_change', sourceId: timetableId, changeKind: 'add',
        targetScopeType: 'track', changeDate: '2026-07-10', periodNumber: 2,
        replacement: { type: 'cancelled' },
      },
      {
        kind: 'note', sourceId: noteId, changeKind: 'add',
        targetScopeType: 'track', schoolDate: '2026-07-10', periodNumber: 2,
        body: '休講でも残るノート',
      },
    ])).status).toBe(201)

    const removeId = '32000000-0000-4000-8000-000000000113'
    expect((await addDirectChanges(env, cookie, [{
      kind: 'timetable_change', sourceId: removeId, changeKind: 'remove',
      targetScopeType: 'track', changeDate: '2026-07-10', periodNumber: 2,
      sharedInformationItemId: timetableId,
      expectedLatestChangeId: `${timetableId}:change`,
    }])).status).toBe(201)

    const plan = await readDailyPlan(env, cookie, '2026-07-10')
    const body = await plan.json() as {
      periods: Array<{ lessonName: string; notes: Array<Record<string, unknown>> }>
    }
    expect(body.periods[1]).toMatchObject({
      lessonName: '',
      notes: [expect.objectContaining({
        noteId,
        body: '休講でも残るノート',
      })],
    })

    const rejectedNoteId = '32000000-0000-4000-8000-000000000114'
    const rejected = await addDirectChanges(env, cookie, [
      {
        kind: 'timetable_change',
        sourceId: '32000000-0000-4000-8000-000000000115',
        changeKind: 'update',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
        sharedInformationItemId: timetableId,
        expectedLatestChangeId: `${timetableId}:change`,
        replacement: { type: 'lesson_name', lessonName: '数学' },
      },
      {
        kind: 'note', sourceId: rejectedNoteId, changeKind: 'add',
        targetScopeType: 'track', schoolDate: '2026-07-10', periodNumber: 2,
        body: '競合時は追加されないノート',
      },
    ])
    expect(rejected.status).toBe(409)
    const afterRejected = await readDailyPlan(env, cookie, '2026-07-10')
    const rejectedBody = await afterRejected.json() as {
      periods: Array<{ notes: Array<{ noteId: string }> }>
    }
    expect(rejectedBody.periods[1].notes.map((note) => note.noteId))
      .toEqual([noteId])
  })

  it('atomically adds a Task with its dependent Note and nests it in every applicable Daily Plan', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const taskId = '32000000-0000-4000-8000-000000000011'
    const noteId = '32000000-0000-4000-8000-000000000012'

    const response = await addDirectChanges(env, cookie, [
      {
        kind: 'task',
        sourceId: taskId,
        changeKind: 'add',
        targetScopeType: 'track',
        title: '期限なしの持ち物',
        dueDate: null,
      },
      {
        kind: 'note',
        sourceId: noteId,
        changeKind: 'add',
        targetScopeType: 'track',
        relatedTaskItemId: taskId,
        body: '一行目の注意\n二行目の詳細',
      },
    ])

    expect(response.status).toBe(201)
    for (const schoolDate of ['2026-07-10', '2026-07-11']) {
      const plan = await readDailyPlan(env, cookie, schoolDate)
      await expect(plan.json()).resolves.toMatchObject({
        tasks: [{
          taskId,
          notes: [{
            noteId,
            body: '一行目の注意\n二行目の詳細',
            relatedContext: { type: 'task', taskId },
            targetScopeType: 'track',
          }],
        }],
        notes: [],
      })
    }
  })

  it('cascades every active Task Note beyond the explicit draft cap and makes retries idempotent', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const taskId = '32000000-0000-4000-8000-000000000021'
    const firstNoteId = '32000000-0000-4000-8000-000000000022'
    const secondNoteId = '32000000-0000-4000-8000-000000000023'
    expect((await addDirectChanges(env, cookie, [
      {
        kind: 'task', sourceId: taskId, changeKind: 'add',
        targetScopeType: 'track', title: '連鎖削除するタスク', dueDate: null,
      },
      {
        kind: 'note', sourceId: firstNoteId, changeKind: 'add',
        targetScopeType: 'track', relatedTaskItemId: taskId, body: '最初のノート',
      },
      {
        kind: 'note', sourceId: secondNoteId, changeKind: 'add',
        targetScopeType: 'track', relatedTaskItemId: taskId, body: '次のノート',
      },
    ])).status).toBe(201)
    expect((await addDirectChanges(
      env,
      cookie,
      Array.from({ length: 48 }, (_, index) => ({
        kind: 'note',
        sourceId: `32000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
        changeKind: 'add',
        targetScopeType: 'track',
        relatedTaskItemId: taskId,
        body: `追加ノート${index + 1}`,
      })),
    )).status).toBe(201)

    const removal = {
      kind: 'task',
      sourceId: '32000000-0000-4000-8000-000000000024',
      changeKind: 'remove',
      targetScopeType: 'track',
      sharedInformationItemId: taskId,
      expectedLatestChangeId: `${taskId}:change`,
    }
    expect((await addDirectChanges(env, cookie, [
      removal,
      {
        kind: 'note',
        sourceId: '32000000-0000-4000-8000-000000000025',
        changeKind: 'update',
        targetScopeType: 'track',
        sharedInformationItemId: firstNoteId,
        expectedLatestChangeId: `${firstNoteId}:change`,
        body: 'Task削除と同時に明示更新しない',
      },
    ])).status).toBe(400)
    const afterRejectedMixedRemoval = await readDailyPlan(
      env,
      cookie,
      '2026-07-10',
    )
    await expect(afterRejectedMixedRemoval.json()).resolves.toMatchObject({
      tasks: [expect.objectContaining({ taskId })],
    })
    expect((await addDirectChanges(env, cookie, [removal])).status).toBe(201)
    expect((await addDirectChanges(env, cookie, [removal])).status).toBe(201)

    const plan = await readDailyPlan(env, cookie, '2026-07-10')
    await expect(plan.json()).resolves.toMatchObject({ tasks: [], notes: [] })
    for (const noteId of [firstNoteId, secondNoteId]) {
      const history = await readNoteEditHistory(env, cookie, noteId)
      await expect(history.json()).resolves.toMatchObject({
        entries: [
          {
            changeKind: 'remove',
            removalReason: 'task_cascade',
            primaryActorDisplayName: 'Test Humanities 1',
          },
          { changeKind: 'add' },
        ],
      })
    }
  })

  it('rejects a Task Note unless its related item is an active Task with the exact Target Scope', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const taskId = '32000000-0000-4000-8000-000000000031'
    expect((await addDirectChanges(env, cookie, [{
      kind: 'task', sourceId: taskId, changeKind: 'add',
      targetScopeType: 'track', title: '対象タスク', dueDate: null,
    }])).status).toBe(201)

    expect((await addDirectChanges(env, cookie, [{
      kind: 'note', sourceId: '32000000-0000-4000-8000-000000000032',
      changeKind: 'add', targetScopeType: 'class', relatedTaskItemId: taskId,
      body: '範囲が違うノート',
    }])).status).toBe(400)

    expect((await addDirectChanges(env, cookie, [{
      kind: 'task', sourceId: '32000000-0000-4000-8000-000000000033',
      changeKind: 'remove', targetScopeType: 'track',
      sharedInformationItemId: taskId,
      expectedLatestChangeId: `${taskId}:change`,
    }])).status).toBe(201)
    expect((await addDirectChanges(env, cookie, [{
      kind: 'note', sourceId: '32000000-0000-4000-8000-000000000034',
      changeKind: 'add', targetScopeType: 'track', relatedTaskItemId: taskId,
      body: '削除後のノート',
    }])).status).toBe(400)
  })

  it('applies parent updates together with their Daily Lesson and Task Notes', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const timetableId = '32000000-0000-4000-8000-000000000041'
    const taskId = '32000000-0000-4000-8000-000000000042'
    expect((await addDirectChanges(env, cookie, [
      {
        sourceId: timetableId,
        changeKind: 'add',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
        replacement: { type: 'cancelled' },
      },
      {
        kind: 'task',
        sourceId: taskId,
        changeKind: 'add',
        targetScopeType: 'track',
        title: '更新前のタスク',
        dueDate: '2026-07-10',
      },
    ])).status).toBe(201)

    const timetableUpdateId = '32000000-0000-4000-8000-000000000043'
    const dailyLessonNoteId = '32000000-0000-4000-8000-000000000044'
    const taskUpdateId = '32000000-0000-4000-8000-000000000045'
    const taskNoteId = '32000000-0000-4000-8000-000000000046'
    const response = await addDirectChanges(env, cookie, [
      {
        sourceId: timetableUpdateId,
        changeKind: 'update',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
        replacement: { type: 'lesson_name', lessonName: '現代文' },
        sharedInformationItemId: timetableId,
        expectedLatestChangeId: `${timetableId}:change`,
      },
      {
        kind: 'task',
        sourceId: taskUpdateId,
        changeKind: 'update',
        targetScopeType: 'track',
        sharedInformationItemId: taskId,
        expectedLatestChangeId: `${taskId}:change`,
        title: '更新後のタスク',
        dueDate: '2026-07-10',
        relatedLessonName: null,
      },
      {
        kind: 'note',
        sourceId: dailyLessonNoteId,
        changeKind: 'add',
        targetScopeType: 'track',
        schoolDate: '2026-07-10',
        periodNumber: 2,
        body: '授業変更と同時に追加するノート',
      },
      {
        kind: 'note',
        sourceId: taskNoteId,
        changeKind: 'add',
        targetScopeType: 'track',
        relatedTaskItemId: taskId,
        body: 'タスク変更と同時に追加するノート',
      },
    ])

    expect(response.status).toBe(201)
    await expect((await readDailyPlan(env, cookie, '2026-07-10')).json())
      .resolves.toMatchObject({
        periods: expect.arrayContaining([
          expect.objectContaining({
            periodNumber: 2,
            lessonName: '現代文',
            notes: [expect.objectContaining({ noteId: dailyLessonNoteId })],
          }),
        ]),
        tasks: [expect.objectContaining({
          taskId,
          title: '更新後のタスク',
          notes: [expect.objectContaining({ noteId: taskNoteId })],
        })],
      })
  })

  it('validates School Date Notes and keeps the legacy endpoint as an alias', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const note = {
      kind: 'note',
      sourceId: '32111111-1111-4111-8111-111111111111',
      changeKind: 'add',
      targetScopeType: 'student',
      schoolDate: '2026-07-10',
      body: '本文',
    }

    expect((await addDirectChanges(env, cookie, [note])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [note])).status)
      .toBe(201)
    const changedRetry = await addDirectChanges(env, cookie, [{
      ...note,
      body: '変更された本文',
    }])
    expect(changedRetry.status).toBe(409)
    await expect(changedRetry.json()).resolves.toMatchObject({
      status: 'idempotency-conflict',
      conflictingSourceIds: [note.sourceId],
    })

    const invalidNotes = [
      { ...note, sourceId: '32111111-1111-4111-8111-111111111112', body: '   ' },
      { ...note, sourceId: '32111111-1111-4111-8111-111111111113', body: 'x'.repeat(1001) },
      { ...note, sourceId: '32111111-1111-4111-8111-111111111114', schoolDate: '2027-04-01' },
      { ...note, sourceId: '32111111-1111-4111-8111-111111111115', targetScopeType: undefined },
      { ...note, sourceId: '32111111-1111-4111-8111-111111111116', changeKind: 'update' },
      { ...note, sourceId: '32111111-1111-4111-8111-111111111117', periodNumber: 8 },
    ]
    for (const invalidNote of invalidNotes) {
      expect((await addDirectChanges(env, cookie, [invalidNote])).status)
        .toBe(400)
    }
  })

  it('orders School Date Notes newest first without exposing attribution or time', async () => {
    vi.useFakeTimers()
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const addNote = async (sourceId: string, body: string, now: string) => {
      vi.setSystemTime(new Date(now))
      expect((await addDirectChanges(env, cookie, [{
        kind: 'note',
        sourceId,
        changeKind: 'add',
        targetScopeType: 'track',
        schoolDate: '2026-07-10',
        body,
      }])).status).toBe(201)
    }
    await addNote(
      '32222222-2222-4222-8222-222222222221',
      '先に追加したノート',
      '2026-07-09T01:00:00.000Z',
    )
    await addNote(
      '32222222-2222-4222-8222-222222222222',
      '後に追加したノート',
      '2026-07-09T02:00:00.000Z',
    )
    vi.setSystemTime(new Date('2026-07-09T03:00:00.000Z'))
    expect((await addDirectChanges(env, cookie, [{
      kind: 'note',
      sourceId: '32222222-2222-4222-8222-222222222223',
      changeKind: 'add',
      targetScopeType: 'track',
      schoolDate: null,
      body: '日付なしノート',
    }])).status).toBe(201)

    const response = await readDailyPlan(env, cookie, '2026-07-10')
    const body = await response.json() as { notes: Array<Record<string, unknown>> }
    expect(body.notes.map((note) => note.body)).toEqual([
      '後に追加したノート',
      '先に追加したノート',
      '日付なしノート',
    ])
    expect(body.notes[0]).not.toHaveProperty('changedByStudentAccountId')
    expect(body.notes[0]).not.toHaveProperty('changedAt')
  })

  it('applies unrelated Note add, update, and remove with atomic stale rejection', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const noteId = '32333333-3333-4333-8333-333333333331'
    expect((await addDirectChanges(env, cookie, [{
      kind: 'note',
      sourceId: noteId,
      changeKind: 'add',
      targetScopeType: 'track',
      schoolDate: null,
      body: '毎日確認するノート',
    }])).status).toBe(201)

    const initialChangeId = `${noteId}:change`
    for (const schoolDate of ['2026-07-10', '2026-07-11']) {
      const plan = await readDailyPlan(env, cookie, schoolDate)
      await expect(plan.json()).resolves.toMatchObject({
        notes: [{
          noteId,
          latestChangeId: initialChangeId,
          body: '毎日確認するノート',
          relatedContext: null,
        }],
      })
    }

    const staleUpdateId = '32333333-3333-4333-8333-333333333332'
    const rejected = await addDirectChanges(env, cookie, [
      {
        kind: 'task',
        sourceId: '32333333-3333-4333-8333-333333333333',
        changeKind: 'add',
        targetScopeType: 'track',
        title: '適用されないタスク',
        dueDate: '2026-07-10',
      },
      {
        kind: 'note',
        sourceId: staleUpdateId,
        changeKind: 'update',
        targetScopeType: 'track',
        sharedInformationItemId: noteId,
        expectedLatestChangeId: 'stale-change',
        body: '上書きしてはいけない本文',
      },
    ])
    expect(rejected.status).toBe(409)
    await expect(rejected.json()).resolves.toMatchObject({
      status: 'timetable-change-conflict',
      conflictingSourceIds: [staleUpdateId],
    })
    const afterRejected = await readDailyPlan(env, cookie, '2026-07-10')
    await expect(afterRejected.json()).resolves.toMatchObject({
      tasks: expect.not.arrayContaining([
        expect.objectContaining({ title: '適用されないタスク' }),
      ]),
      notes: [expect.objectContaining({ body: '毎日確認するノート' })],
    })

    const updateId = '32333333-3333-4333-8333-333333333334'
    expect((await addDirectChanges(env, cookie, [{
      kind: 'note',
      sourceId: updateId,
      changeKind: 'update',
      targetScopeType: 'track',
      sharedInformationItemId: noteId,
      expectedLatestChangeId: initialChangeId,
      body: '更新後\n全文',
    }])).status).toBe(201)

    const removeId = '32333333-3333-4333-8333-333333333335'
    expect((await addDirectChanges(env, cookie, [{
      kind: 'note',
      sourceId: removeId,
      changeKind: 'remove',
      targetScopeType: 'track',
      sharedInformationItemId: noteId,
      expectedLatestChangeId: `${updateId}:change`,
    }])).status).toBe(201)
    const removedPlan = await readDailyPlan(env, cookie, '2026-07-10')
    await expect(removedPlan.json()).resolves.toMatchObject({ notes: [] })
  })

  it('retains causal Note Edit History for Target Scope Students only', async () => {
    vi.useFakeTimers()
    const env = createDailyPlanTestEnv()
    const trackCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const outsideCookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )
    const noteId = '32444444-4444-4444-8444-444444444441'
    vi.setSystemTime(new Date('2026-07-09T01:02:03.000Z'))
    await addDirectChanges(env, trackCookie, [{
      kind: 'note', sourceId: noteId, changeKind: 'add',
      targetScopeType: 'track', schoolDate: '2026-07-10', body: '追加時\n全文',
    }])
    const updateId = '32444444-4444-4444-8444-444444444442'
    vi.setSystemTime(new Date('2026-07-09T01:02:03.000Z'))
    await addDirectChanges(env, trackCookie, [{
      kind: 'note', sourceId: updateId, changeKind: 'update',
      targetScopeType: 'track', sharedInformationItemId: noteId,
      expectedLatestChangeId: `${noteId}:change`, body: '更新時\n全文',
    }])
    const removeId = '32444444-4444-4444-8444-444444444443'
    await addDirectChanges(env, trackCookie, [{
      kind: 'note', sourceId: removeId, changeKind: 'remove',
      targetScopeType: 'track', sharedInformationItemId: noteId,
      expectedLatestChangeId: `${updateId}:change`,
    }])

    const history = await readNoteEditHistory(env, trackCookie, noteId)
    expect(history.status).toBe(200)
    await expect(history.json()).resolves.toMatchObject({
      status: 'ready',
      noteId,
      entries: [
        {
          changeKind: 'remove', before: { body: '更新時\n全文' }, after: null,
          removalReason: 'student', primaryActorDisplayName: 'Test Humanities 1',
        },
        {
          changeKind: 'update', before: { body: '追加時\n全文' },
          after: { body: '更新時\n全文' },
        },
        { changeKind: 'add', before: null, after: { body: '追加時\n全文' } },
      ],
    })
    const detail = await readSharedInformationChangeDetail(
      env,
      trackCookie,
      `${removeId}:change`,
    )
    expect(detail.status).toBe(200)
    await expect(detail.json()).resolves.toEqual({
      status: 'ready',
      kind: 'note',
      sharedInformationChangeId: `${removeId}:change`,
      sharedInformationItemId: noteId,
      changeKind: 'remove',
      source: {
        type: 'direct',
        primaryActorDisplayName: 'Test Humanities 1',
      },
      changedAt: Date.parse('2026-07-09T01:02:03.000Z'),
      targetScope: {
        type: 'track',
        value: '2026-grade-2-class-3-humanities',
      },
      before: { body: '更新時\n全文' },
      after: null,
      removalReason: 'student',
    })
    expect((await readNoteEditHistory(env, outsideCookie, noteId)).status)
      .toBe(404)
    expect((await readNoteEditHistory(env, '', noteId)).status).toBe(401)
    expect((await readNoteEditHistory(env, trackCookie, 'unknown')).status)
      .toBe(404)
  })

  it('atomically adds a Timetable Change and Task to the selected-date Daily Plan', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const response = await addDirectTimetableChanges(env, cookie, [
      {
        kind: 'timetable_change',
        sourceId: '33000000-0000-4000-8000-000000000001',
        changeKind: 'add',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 3,
        replacement: { type: 'lesson_name', lessonName: '総合' },
      },
      {
        kind: 'task',
        sourceId: '33000000-0000-4000-8000-000000000002',
        changeKind: 'add',
        targetScopeType: 'track',
        title: '地理ワークを提出',
        dueDate: '2026-07-10',
        relatedLessonName: { registeredLessonNameId: 'geography' },
      },
    ])

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      status: 'applied',
      changes: [
        { sourceId: '33000000-0000-4000-8000-000000000001' },
        { sourceId: '33000000-0000-4000-8000-000000000002' },
      ],
    })

    const plan = await readDailyPlan(env, cookie, '2026-07-10')
    expect(plan.status).toBe(200)
    const body = await plan.json() as {
      periods: Array<Record<string, unknown>>
      tasks: Array<Record<string, unknown>>
    }
    expect(body.periods[2]).toMatchObject({
      periodNumber: 3,
      lessonName: '総合',
      hasTasks: false,
    })
    expect(body.periods.every((period) => period.hasTasks === false)).toBe(true)
    expect(body.tasks).toMatchObject([
        {
          taskId: '33000000-0000-4000-8000-000000000002',
          title: '地理ワークを提出',
          dueDate: '2026-07-10',
          relatedLessonName: '地理',
          targetScopeType: 'track',
        },
      ])
  })

  it('validates Task fields and retries the same Task add idempotently', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const validTask = {
      kind: 'task',
      sourceId: '33555555-5555-4555-8555-555555555555',
      changeKind: 'add',
      targetScopeType: 'student',
      title: '  英語の準備  ',
      dueDate: null,
      relatedLessonName: { lessonName: '特別活動' },
    }

    expect((await addDirectTimetableChanges(env, cookie, [validTask])).status)
      .toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [validTask])).status)
      .toBe(201)
    const changedRetry = await addDirectTimetableChanges(env, cookie, [
      { ...validTask, title: '別の内容' },
    ])
    expect(changedRetry.status).toBe(409)
    await expect(changedRetry.json()).resolves.toMatchObject({
      status: 'idempotency-conflict',
    })

    const crossKindReuse = await addDirectTimetableChanges(env, cookie, [{
      kind: 'timetable_change',
      sourceId: validTask.sourceId,
      changeKind: 'add',
      targetScopeType: 'student',
      changeDate: '2026-07-12',
      periodNumber: 7,
      replacement: { type: 'cancelled' },
    }])
    expect(crossKindReuse.status).toBe(409)
    await expect(crossKindReuse.json()).resolves.toMatchObject({
      status: 'idempotency-conflict',
    })

    const invalidTasks = [
      { ...validTask, sourceId: '33600000-0000-4000-8000-000000000001', title: '' },
      { ...validTask, sourceId: '33600000-0000-4000-8000-000000000002', title: 'x'.repeat(121) },
      { ...validTask, sourceId: '33600000-0000-4000-8000-000000000003', dueDate: '2027-04-01' },
      { ...validTask, sourceId: '33600000-0000-4000-8000-000000000004', targetScopeType: undefined },
      {
        ...validTask,
        sourceId: '33600000-0000-4000-8000-000000000005',
        relatedLesson: {
          schoolDate: '2026-07-10',
          periodNumber: 1,
        },
      },
    ]
    for (const invalidTask of invalidTasks) {
      const response = await addDirectTimetableChanges(env, cookie, [invalidTask])
      expect(response.status).toBe(400)
    }
  })

  it('shows selected-date Tasks before undated Tasks and hides other dates', async () => {
    vi.useFakeTimers()
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const addTask = async (
      sourceId: string,
      title: string,
      dueDate: string | null,
      targetScopeType: 'grade' | 'class' | 'track' | 'student',
      now: string,
    ) => {
      vi.setSystemTime(new Date(now))
      const response = await addDirectTimetableChanges(env, cookie, [{
        kind: 'task',
        sourceId,
        changeKind: 'add',
        targetScopeType,
        title,
        dueDate,
      }])
      expect(response.status).toBe(201)
    }

    await addTask(
      '33700000-0000-4000-8000-000000000001',
      '古い当日',
      '2026-07-10',
      'grade',
      '2026-07-08T00:00:00.000Z',
    )
    await addTask(
      '33700000-0000-4000-8000-000000000002',
      '期限なし',
      null,
      'student',
      '2026-07-09T00:00:00.000Z',
    )
    await addTask(
      '33700000-0000-4000-8000-000000000003',
      '新しい当日',
      '2026-07-10',
      'class',
      '2026-07-10T00:00:00.000Z',
    )
    await addTask(
      '33700000-0000-4000-8000-000000000004',
      '別の日',
      '2026-07-11',
      'track',
      '2026-07-10T01:00:00.000Z',
    )

    const response = await readDailyPlan(env, cookie, '2026-07-10')
    const body = await response.json() as {
      tasks: Array<Record<string, unknown>>
    }
    expect(body.tasks.map((task) => task.title)).toEqual([
      '新しい当日',
      '古い当日',
      '期限なし',
    ])
    expect(body.tasks.map((task) => task.targetScopeType)).toEqual([
      'class',
      'grade',
      'student',
    ])
    expect(body.tasks.every((task) =>
      !('changedByStudentAccountId' in task) &&
      !('primaryActorDisplayName' in task),
    )).toBe(true)
  })

  it('updates and removes a Task with stale protection and safe retries', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const taskId = '33900000-0000-4000-8000-000000000001'
    const updateId = '33900000-0000-4000-8000-000000000002'
    const removeId = '33900000-0000-4000-8000-000000000003'
    const update = {
      kind: 'task',
      sourceId: updateId,
      changeKind: 'update',
      sharedInformationItemId: taskId,
      expectedLatestChangeId: `${taskId}:change`,
      targetScopeType: 'track',
      title: '更新後のTask',
      dueDate: '2026-07-11',
      relatedLessonName: { registeredLessonNameId: 'geography' },
    }

    expect((await addDirectTimetableChanges(env, cookie, [{
      kind: 'task',
      sourceId: taskId,
      changeKind: 'add',
      targetScopeType: 'track',
      title: '更新前のTask',
      dueDate: '2026-07-10',
    }])).status).toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [update])).status)
      .toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [update])).status)
      .toBe(201)

    const oldDate = await readDailyPlan(env, cookie, '2026-07-10')
    const newDate = await readDailyPlan(env, cookie, '2026-07-11')
    expect((await oldDate.json() as { tasks: unknown[] }).tasks).toEqual([])
    expect((await newDate.json() as { tasks: Array<Record<string, unknown>> }).tasks)
      .toEqual([expect.objectContaining({
        taskId,
        latestChangeId: `${updateId}:change`,
        title: '更新後のTask',
        dueDate: '2026-07-11',
        relatedLessonName: '地理',
        targetScopeType: 'track',
      })])

    const changedRetry = await addDirectTimetableChanges(env, cookie, [{
      ...update,
      title: 'operation IDを再利用',
    }])
    expect(changedRetry.status).toBe(409)
    await expect(changedRetry.json()).resolves.toMatchObject({
      status: 'idempotency-conflict',
      conflictingSourceIds: [updateId],
    })

    const immutableScope = await addDirectTimetableChanges(env, cookie, [{
      ...update,
      sourceId: '33900000-0000-4000-8000-000000000004',
      expectedLatestChangeId: `${updateId}:change`,
      targetScopeType: 'class',
    }])
    expect(immutableScope.status).toBe(409)

    const remove = {
      kind: 'task',
      sourceId: removeId,
      changeKind: 'remove',
      sharedInformationItemId: taskId,
      expectedLatestChangeId: `${updateId}:change`,
      targetScopeType: 'track',
    }
    expect((await addDirectTimetableChanges(env, cookie, [remove])).status)
      .toBe(201)
    expect((await addDirectTimetableChanges(env, cookie, [remove])).status)
      .toBe(201)
    expect(((await (await readDailyPlan(env, cookie, '2026-07-11')).json()) as {
      tasks: unknown[]
    }).tasks).toEqual([])
  })

  it('rolls back every mixed draft when a Task is stale and re-adds as a new item', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const taskId = '33910000-0000-4000-8000-000000000001'
    expect((await addDirectTimetableChanges(env, cookie, [{
      kind: 'task',
      sourceId: taskId,
      changeKind: 'add',
      targetScopeType: 'student',
      title: '同じ内容',
      dueDate: null,
    }])).status).toBe(201)

    const conflict = await addDirectTimetableChanges(env, cookie, [
      {
        kind: 'timetable_change',
        sourceId: '33910000-0000-4000-8000-000000000002',
        changeKind: 'add',
        targetScopeType: 'student',
        changeDate: '2026-07-10',
        periodNumber: 7,
        replacement: { type: 'cancelled' },
      },
      {
        kind: 'task',
        sourceId: '33910000-0000-4000-8000-000000000003',
        changeKind: 'remove',
        sharedInformationItemId: taskId,
        expectedLatestChangeId: 'stale-change',
        targetScopeType: 'student',
      },
    ])
    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toMatchObject({
      status: 'timetable-change-conflict',
      conflictingSourceIds: ['33910000-0000-4000-8000-000000000003'],
    })
    const afterConflict = await readDailyPlan(env, cookie, '2026-07-10')
    const conflictPlan = await afterConflict.json() as {
      periods: Array<{ periodNumber: number; lessonName: string }>
      tasks: Array<{ taskId: string }>
    }
    expect(conflictPlan.periods[6].lessonName).toBe('')
    expect(conflictPlan.tasks).toEqual([
      expect.objectContaining({ taskId }),
    ])

    expect((await addDirectTimetableChanges(env, cookie, [{
      kind: 'task',
      sourceId: '33910000-0000-4000-8000-000000000004',
      changeKind: 'remove',
      sharedInformationItemId: taskId,
      expectedLatestChangeId: `${taskId}:change`,
      targetScopeType: 'student',
    }])).status).toBe(201)
    const readdId = '33910000-0000-4000-8000-000000000005'
    expect((await addDirectTimetableChanges(env, cookie, [{
      kind: 'task',
      sourceId: readdId,
      changeKind: 'add',
      targetScopeType: 'student',
      title: '同じ内容',
      dueDate: null,
    }])).status).toBe(201)
    const afterReadd = await readDailyPlan(env, cookie, '2026-07-10')
    expect(((await afterReadd.json()) as { tasks: Array<{ taskId: string }> }).tasks)
      .toEqual([expect.objectContaining({ taskId: readdId })])
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
      lessonReference: {
        type: 'period_reference',
        weekday: 2,
        periodNumber: 2,
      },
      hasTasks: false,
      notes: [],
    })
    expect(scienceBody.periods[1]).toEqual({
      periodNumber: 2,
      lessonName: '生物',
      lessonReference: {
        type: 'period_reference',
        weekday: 2,
        periodNumber: 2,
      },
      hasTasks: false,
      notes: [],
    })
  })

  it('keeps 2026 Grade 2 Class 4 Lesson Slots and unimplemented Notes blank', async () => {
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
        notes: [],
      })),
    )
    expect(body.tasks).toEqual([])
    expect(body.notes).toEqual([])
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

  it('keeps invalid date precedence over Affiliation Renewal', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2025-2-3-humanities-1',
    )

    const response = await readDailyPlan(env, cookie, '2026-02-31')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      status: 'invalid-date',
    })
  })

  it('keeps invalid date range precedence over Affiliation Renewal', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2025-2-3-humanities-1',
    )

    const response = await readDailyPlans(
      env,
      cookie,
      '2026-02-31',
      '2026-03-01',
    )

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

  it('returns no placeholder Tasks or Daily Lesson task markers', async () => {
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
    expect(body.tasks).toEqual([])
    expect(body.periods).toMatchObject([
      { periodNumber: 1, lessonName: '地理', hasTasks: false },
      { periodNumber: 2, lessonName: '', hasTasks: false },
      { periodNumber: 3, lessonName: '', hasTasks: false },
      { periodNumber: 4, lessonName: '現代文', hasTasks: false },
      { periodNumber: 5, lessonName: '', hasTasks: false },
      { periodNumber: 6, lessonName: '', hasTasks: false },
      { periodNumber: 7, lessonName: '', hasTasks: false },
    ])
  })

  it('does not return placeholder Notes while Notes are unimplemented', async () => {
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
    expect(body.periods[1]).toMatchObject({ periodNumber: 2, notes: [] })
    expect(body.notes).toEqual([])
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

describe('Reference Scope Task read API', () => {
  it('exposes applicable Active Tasks outside the Student scopes without identity', async () => {
    const env = createDailyPlanTestEnv()
    const classFourCookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )
    const viewerCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    expect((await addDirectTimetableChanges(env, classFourCookie, [{
      kind: 'task',
      sourceId: '33800000-0000-4000-8000-000000000001',
      changeKind: 'add',
      targetScopeType: 'class',
      title: '4組の提出物',
      dueDate: '2026-07-10',
    }])).status).toBe(201)

    const response = await readReferenceTasks(
      env,
      viewerCookie,
      '2026-07-10',
      'class',
      '2026-grade-2-class-4',
    )
    expect(response.status).toBe(200)
    const body = await response.json() as {
      referenceScope: Record<string, unknown>
      tasks: Array<Record<string, unknown>>
    }
    expect(body.referenceScope).toEqual({
      type: 'class',
      value: '2026-grade-2-class-4',
    })
    expect(body.tasks).toEqual([expect.objectContaining({
      taskId: '33800000-0000-4000-8000-000000000001',
      title: '4組の提出物',
      dueDate: '2026-07-10',
      targetScopeType: 'class',
    })])
    expect(body.tasks.every((task) =>
      !('changedByStudentAccountId' in task) &&
      !('primaryActorDisplayName' in task) &&
      !('studentAccountId' in task),
    )).toBe(true)
  })

  it('rejects invalid and individual Reference Scopes', async () => {
    const env = createDailyPlanTestEnv()
    const cookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    expect((await readReferenceTasks(
      env,
      cookie,
      '2026-07-10',
      'student',
      'test-student-2026-2-4-humanities-1',
    )).status).toBe(400)
    expect((await readReferenceTasks(
      env,
      cookie,
      '2026-07-10',
      'class',
      'missing-class',
    )).status).toBe(400)
  })
})

describe('Reference Scope Daily Plan read API', () => {
  it('lists only selectable grade, class, and track scopes', async () => {
    const env = createDailyPlanTestEnv()
    const viewerCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    const response = await readReferenceScopeOptions(env, viewerCookie)
    expect(response.status).toBe(200)
    const body = await response.json() as {
      options: Array<{ type: string; value: string; label: string }>
    }
    expect(body.options).toContainEqual({
      type: 'class',
      value: '2026-grade-2-class-4',
      label: '2年4組',
    })
    expect(body.options).not.toContainEqual(expect.objectContaining({
      type: 'class',
      value: '2026-grade-2-class-3',
    }))
    expect(body.options.every((option) => option.type !== 'student')).toBe(true)
    expect((await readReferenceScopeOptions(env)).status).toBe(401)
  })

  it('projects only exact-scope School Date and unrelated Active Notes without identity', async () => {
    const env = createDailyPlanTestEnv()
    const classFourCookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )
    const viewerCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )

    expect((await addDirectTimetableChanges(env, classFourCookie, [
      {
        kind: 'note',
        sourceId: '41900000-0000-4000-8000-000000000001',
        changeKind: 'add',
        targetScopeType: 'class',
        schoolDate: '2026-07-10',
        body: '4組の当日ノート',
      },
      {
        kind: 'note',
        sourceId: '41900000-0000-4000-8000-000000000002',
        changeKind: 'add',
        targetScopeType: 'class',
        schoolDate: null,
        body: '4組の常設ノート',
      },
      {
        kind: 'note',
        sourceId: '41900000-0000-4000-8000-000000000003',
        changeKind: 'add',
        targetScopeType: 'grade',
        schoolDate: '2026-07-10',
        body: '学年ノート',
      },
      {
        kind: 'note',
        sourceId: '41900000-0000-4000-8000-000000000004',
        changeKind: 'add',
        targetScopeType: 'student',
        schoolDate: '2026-07-10',
        body: '別Studentのノート',
      },
    ])).status).toBe(201)

    const response = await readReferenceDailyPlan(
      env,
      viewerCookie,
      '2026-07-10',
      'class',
      '2026-grade-2-class-4',
    )
    expect(response.status).toBe(200)
    const body = await response.json() as {
      referenceScope: Record<string, unknown>
      notes: Array<Record<string, unknown>>
    }
    expect(body.referenceScope).toEqual({
      type: 'class',
      value: '2026-grade-2-class-4',
    })
    expect(body.notes).toEqual([
      expect.objectContaining({ body: '4組の当日ノート' }),
      expect.objectContaining({ body: '4組の常設ノート' }),
    ])
    expect(JSON.stringify(body)).not.toContain('学年ノート')
    expect(JSON.stringify(body)).not.toContain('別Studentのノート')
    expect(JSON.stringify(body)).not.toContain('changedByStudentAccountId')
    expect(JSON.stringify(body)).not.toContain('primaryActorDisplayName')
  })

  it('places Daily Lesson and visible Task Notes while hiding Notes for Tasks absent that day', async () => {
    const env = createDailyPlanTestEnv()
    const classFourCookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )
    const viewerCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const visibleTaskId = '41910000-0000-4000-8000-000000000001'
    const hiddenTaskId = '41910000-0000-4000-8000-000000000002'

    expect((await addDirectTimetableChanges(env, classFourCookie, [
      {
        kind: 'task',
        sourceId: visibleTaskId,
        changeKind: 'add',
        targetScopeType: 'class',
        title: '今日のタスク',
        dueDate: '2026-07-10',
      },
      {
        kind: 'task',
        sourceId: hiddenTaskId,
        changeKind: 'add',
        targetScopeType: 'class',
        title: '別日のタスク',
        dueDate: '2026-07-11',
      },
      {
        kind: 'note',
        sourceId: '41910000-0000-4000-8000-000000000003',
        changeKind: 'add',
        targetScopeType: 'class',
        schoolDate: '2026-07-10',
        periodNumber: 2,
        body: '2限のノート',
      },
      {
        kind: 'note',
        sourceId: '41910000-0000-4000-8000-000000000004',
        changeKind: 'add',
        targetScopeType: 'class',
        relatedTaskItemId: visibleTaskId,
        body: '見えるタスクのノート',
      },
      {
        kind: 'note',
        sourceId: '41910000-0000-4000-8000-000000000005',
        changeKind: 'add',
        targetScopeType: 'class',
        relatedTaskItemId: hiddenTaskId,
        body: '別日のタスクのノート',
      },
    ])).status).toBe(201)

    const response = await readReferenceDailyPlan(
      env,
      viewerCookie,
      '2026-07-10',
      'class',
      '2026-grade-2-class-4',
    )
    expect(response.status).toBe(200)
    const body = await response.json() as {
      periods: Array<{ periodNumber: number; notes: Array<{ body: string }> }>
      tasks: Array<{ title: string; notes: Array<{ body: string }> }>
    }
    expect(body.periods.find((period) => period.periodNumber === 2)?.notes)
      .toEqual([expect.objectContaining({ body: '2限のノート' })])
    expect(body.tasks).toEqual([
      expect.objectContaining({
        title: '今日のタスク',
        notes: [expect.objectContaining({ body: '見えるタスクのノート' })],
      }),
    ])
    expect(JSON.stringify(body)).not.toContain('別日のタスクのノート')
  })

  it('keeps a Task Note attached after its visible Task is updated', async () => {
    const env = createDailyPlanTestEnv()
    const classFourCookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )
    const viewerCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const taskId = '41915000-0000-4000-8000-000000000001'
    expect((await addDirectTimetableChanges(env, classFourCookie, [
      {
        kind: 'task', sourceId: taskId, changeKind: 'add',
        targetScopeType: 'class', title: '更新前', dueDate: '2026-07-10',
      },
      {
        kind: 'note', sourceId: '41915000-0000-4000-8000-000000000002',
        changeKind: 'add', targetScopeType: 'class',
        relatedTaskItemId: taskId, body: '引き継ぐノート',
      },
    ])).status).toBe(201)
    const updateSourceId = '41915000-0000-4000-8000-000000000003'
    expect((await addDirectTimetableChanges(env, classFourCookie, [{
      kind: 'task', sourceId: updateSourceId, changeKind: 'update',
      targetScopeType: 'class', sharedInformationItemId: taskId,
      expectedLatestChangeId: `${taskId}:change`, title: '更新後',
      dueDate: '2026-07-10', relatedLessonName: null,
    }])).status).toBe(201)

    const response = await readReferenceDailyPlan(
      env, viewerCookie, '2026-07-10', 'class', '2026-grade-2-class-4',
    )
    await expect(response.json()).resolves.toMatchObject({
      tasks: [{
        taskId,
        title: '更新後',
        notes: [{
          body: '引き継ぐノート',
          relatedContext: { type: 'task', taskId },
        }],
      }],
    })

    const legacy = await readReferenceTasks(
      env, viewerCookie, '2026-07-10', 'class', '2026-grade-2-class-4',
    )
    const legacyBody = await legacy.json() as Record<string, unknown> & {
      tasks: Array<{ taskId: string }>
    }
    expect(legacyBody.tasks[0].taskId).toBe(updateSourceId)
    expect(legacyBody).not.toHaveProperty('notes')
    expect(legacyBody).not.toHaveProperty('periods')
  })

  it('rejects individual and own scopes, denies history, and does not expand Creator Scope', async () => {
    const env = createDailyPlanTestEnv()
    const classFourCookie = await testLoginCookie(
      env,
      'test-student-2026-2-4-humanities-1',
    )
    const viewerCookie = await testLoginCookie(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const referenceNoteId = '41920000-0000-4000-8000-000000000001'
    expect((await addDirectTimetableChanges(env, classFourCookie, [{
      kind: 'note',
      sourceId: referenceNoteId,
      changeKind: 'add',
      targetScopeType: 'class',
      schoolDate: '2026-07-10',
      body: '参照だけのノート',
    }])).status).toBe(201)

    expect((await readReferenceDailyPlan(
      env,
      viewerCookie,
      '2026-07-10',
      'student',
      'test-student-2026-2-4-humanities-1',
    )).status).toBe(400)
    expect((await readReferenceDailyPlan(
      env,
      viewerCookie,
      '2026-07-10',
      'class',
      '2026-grade-2-class-3',
    )).status).toBe(400)
    expect((await readNoteEditHistory(
      env,
      viewerCookie,
      referenceNoteId,
    )).status).toBe(404)

    expect((await readReferenceDailyPlan(
      env,
      viewerCookie,
      '2026-07-10',
      'class',
      '2026-grade-2-class-4',
    )).status).toBe(200)
    expect((await addDirectTimetableChanges(env, viewerCookie, [{
      kind: 'note',
      sourceId: '41920000-0000-4000-8000-000000000002',
      changeKind: 'add',
      targetScopeType: 'class',
      schoolDate: '2026-07-10',
      body: '自分のクラスにだけ作成',
    }])).status).toBe(201)
    const reread = await readReferenceDailyPlan(
      env,
      viewerCookie,
      '2026-07-10',
      'class',
      '2026-grade-2-class-4',
    )
    expect(JSON.stringify(await reread.json())).not.toContain('自分のクラスにだけ作成')
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

describe('interactive test login tickets', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('issues one short-lived ticket for an allow-listed fixed test Student', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T00:00:00.000Z'))

    const response = await issueInteractiveTestLoginTicket(
      createTestLoginEnv(),
      'test-student-2026-2-3-humanities-1',
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toBeNull()
    await expect(response.json()).resolves.toEqual({
      ticket: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: Date.parse('2026-07-17T00:02:00.000Z'),
      exchangeUrl: expect.stringMatching(
        /^https:\/\/tsugi\.test\/api\/test\/login-tickets\/[a-f0-9]{64}$/,
      ),
    })
  })

  it('exchanges a ticket for one normal Student Session and redirects without referrer or caching', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T00:00:00.000Z'))
    const env = createTestLoginEnv()
    const issueResponse = await issueInteractiveTestLoginTicket(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const { ticket } = await issueResponse.json<{ ticket: string }>()

    const exchangeResponse = await exchangeInteractiveTestLoginTicket(env, ticket)

    expect(exchangeResponse.status).toBe(303)
    expect(exchangeResponse.headers.get('location')).toBe('https://tsugi.test/')
    expect(exchangeResponse.headers.get('cache-control')).toBe('no-store')
    expect(exchangeResponse.headers.get('referrer-policy')).toBe('no-referrer')
    const cookie = exchangeResponse.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('tsugi_session=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')

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

  it('returns generic not found for disabled, unauthorized, missing, and non-allow-listed issuance', async () => {
    const responses = await Promise.all([
      issueInteractiveTestLoginTicket(
        createTestEnv(),
        'test-student-2026-2-3-humanities-1',
      ),
      issueInteractiveTestLoginTicket(
        createTestLoginEnv(),
        'test-student-2026-2-3-humanities-1',
        null,
      ),
      issueInteractiveTestLoginTicket(
        createTestLoginEnv(),
        'test-student-2026-2-3-humanities-1',
        'wrong-secret',
      ),
      issueInteractiveTestLoginTicket(createTestLoginEnv(), 'student-account-1'),
      issueInteractiveTestLoginTicket(
        createTestLoginEnv(),
        'test-student-2026-2-3-science-1',
      ),
    ])

    for (const response of responses) {
      expect(response.status).toBe(404)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('referrer-policy')).toBe('no-referrer')
      expect(await response.text()).toBe('')
    }
  })

  it('makes invalid, expired, consumed, and disabled exchanges indistinguishable', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T00:00:00.000Z'))
    const env = createTestLoginEnv()
    const issuedTickets: string[] = []
    for (let index = 0; index < 3; index += 1) {
      const response = await issueInteractiveTestLoginTicket(
        env,
        'test-student-2026-2-3-humanities-1',
      )
      issuedTickets.push((await response.json<{ ticket: string }>()).ticket)
    }
    expect((await exchangeInteractiveTestLoginTicket(env, issuedTickets[0])).status)
      .toBe(303)

    vi.advanceTimersByTime(2 * 60_000)
    const invalidResponse = await exchangeInteractiveTestLoginTicket(
      env,
      'a'.repeat(64),
    )
    const expiredResponse = await exchangeInteractiveTestLoginTicket(
      env,
      issuedTickets[1],
    )
    const consumedResponse = await exchangeInteractiveTestLoginTicket(
      env,
      issuedTickets[0],
    )
    env.TEST_LOGIN_ENABLED = 'false'
    const disabledResponse = await exchangeInteractiveTestLoginTicket(
      env,
      issuedTickets[2],
    )

    const signatures = await Promise.all(
      [invalidResponse, expiredResponse, consumedResponse, disabledResponse].map(
        async (response) => ({
          status: response.status,
          cacheControl: response.headers.get('cache-control'),
          referrerPolicy: response.headers.get('referrer-policy'),
          location: response.headers.get('location'),
          setCookie: response.headers.get('set-cookie'),
          body: await response.text(),
        }),
      ),
    )
    expect(new Set(signatures.map((signature) => JSON.stringify(signature))).size)
      .toBe(1)
    expect(signatures[0]).toEqual({
      status: 404,
      cacheControl: 'no-store',
      referrerPolicy: 'no-referrer',
      location: null,
      setCookie: null,
      body: '',
    })
  })

  it('allows exactly one concurrent exchange of the same ticket', async () => {
    const env = createTestLoginEnv()
    const issueResponse = await issueInteractiveTestLoginTicket(
      env,
      'test-student-2026-2-3-humanities-1',
    )
    const { ticket } = await issueResponse.json<{ ticket: string }>()

    const responses = await Promise.all([
      exchangeInteractiveTestLoginTicket(env, ticket),
      exchangeInteractiveTestLoginTicket(env, ticket),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([303, 404])
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
      html: string
    }
    expect(resendBody).toMatchObject({
      from: 'Tsugi <no-reply@jikanwari.is-a.dev>',
      to: ['110-12345678mkn@e.osakamanabi.jp'],
      subject: 'Tsugi 認証コード',
    })
    const verificationCode = resendBody.text.match(/\b[0-9]{6}\b/)?.[0]

    expect(verificationCode).toBeDefined()
    expect(resendBody.text).toContain('学校のメールを確認するため')
    expect(resendBody.text).toContain('10分間有効')
    expect(resendBody.text).toContain('誰にも共有しないでください')
    expect(resendBody.text).toContain(
      '心当たりがなければ、このメールを無視してください',
    )
    expect(resendBody.html).toContain('Tsugi')
    expect(resendBody.html).toContain('確認コード')
    expect(resendBody.html).toContain('学校のメールを確認するため')
    expect(resendBody.html).toContain(verificationCode)
    expect(resendBody.html).toContain('10分間有効')
    expect(resendBody.html).toContain('誰にも共有しないでください')
    expect(resendBody.html).toContain(
      '心当たりがなければ、このメールを無視してください',
    )
    expect(resendBody.html).not.toMatch(/<(?:a|button)\b/)
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

  it('completes confirmed initial setup without a Real Name', async () => {
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

  it('ignores legacy Real Name input and does not create duplicate Student Accounts when retried', async () => {
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
    const firstBody = await firstResponse.json()
    expect(firstBody).toMatchObject({
      status: 'authenticated',
      studentAccount: { displayName: 'Sora' },
    })
    expect(JSON.stringify(firstBody)).not.toContain('realName')
    expect(secondResponse.status).toBe(400)
    await expect(secondResponse.json()).resolves.toEqual({
      status: 'invalid-setup-session',
    })
  })
})
