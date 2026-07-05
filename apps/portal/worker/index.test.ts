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

function getLastSentCode(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  const [, resendRequest] = fetchMock.mock.calls.at(-1) ?? []
  const resendBody = JSON.parse(String(resendRequest?.body)) as { text: string }
  const code = resendBody.text.match(/[0-9]{6}/)?.[0]

  if (!code) {
    throw new Error('expected verification code')
  }

  return code
}

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
})
