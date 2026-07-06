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
    new Request('https://jikanwari.test/api/auth/verification-code-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schoolEmailNumber }),
    }),
    env,
  )
}

function verifyCode(env: Env, code: string, schoolEmailNumber = '12345678') {
  return worker.fetch(
    new Request('https://jikanwari.test/api/auth/verification-code-verifications', {
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
    new Request('https://jikanwari.test/api/test/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ studentAccountId }),
    }),
    env,
  )
}

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
    expect(cookie).toContain('jikanwari_session=')
    expect(cookie).toContain('Max-Age=2592000')

    const sessionResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/session', {
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
      new Request('https://jikanwari.test/api/auth/verification-code-requests', {
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
      from: 'Jikanwari <no-reply@jikanwari.is-a.dev>',
      to: ['110-12345678mkn@e.osakamanabi.jp'],
      subject: 'Jikanwari 認証コード',
    })
    expect(resendBody.text).toMatch(/[0-9]{6}/)
  })

  it('rejects invalid School Email numbers without sending email', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/verification-code-requests', {
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
        new Request('https://jikanwari.test/api/auth/verification-code-requests', {
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
        new Request('https://jikanwari.test/api/auth/verification-code-requests', {
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
      new Request('https://jikanwari.test/api/auth/verification-code-requests', {
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
      new Request('https://jikanwari.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      env,
    )
    expect(sendResponse.status).toBe(200)

    const loginResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/verification-code-verifications', {
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
    expect(cookie).toContain('jikanwari_session=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')

    const sessionResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/session', {
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
      new Request('https://jikanwari.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      env,
    )

    const loginResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/verification-code-verifications', {
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
      new Request('https://jikanwari.test/api/auth/session', {
        method: 'DELETE',
        headers: { cookie },
      }),
      env,
    )

    expect(logoutResponse.status).toBe(204)
    expect(logoutResponse.headers.get('set-cookie')).toContain(
      'jikanwari_session=; Max-Age=0',
    )

    const sessionResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/session', {
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
      new Request('https://jikanwari.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      env,
    )

    const verifyResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/verification-code-verifications', {
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
    expect(cookie).toContain('jikanwari_setup=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')

    const setupSessionResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/setup-session', {
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
      new Request('https://jikanwari.test/api/auth/initial-setup', {
        headers: { cookie: staleSetupCookie },
      }),
      env,
    )
    const latestOptionsResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/initial-setup', {
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
      new Request('https://jikanwari.test/api/auth/verification-code-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schoolEmailNumber: '12345678' }),
      }),
      env,
    )
    const verifyResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/verification-code-verifications', {
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
      new Request('https://jikanwari.test/api/auth/initial-setup', {
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
      new Request('https://jikanwari.test/api/auth/initial-setup', {
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
    expect(sessionCookie).toContain('jikanwari_session=')

    const sessionResponse = await worker.fetch(
      new Request('https://jikanwari.test/api/auth/session', {
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
        new Request('https://jikanwari.test/api/auth/initial-setup', {
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
