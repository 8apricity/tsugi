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
