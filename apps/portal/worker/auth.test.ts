import { describe, expect, it, vi } from 'vitest'
import {
  InMemoryVerificationCodeStore,
  readStudentSession,
  logoutStudentSession,
  readSetupSession,
  requestVerificationCode,
  verifyCodeForExistingStudent,
} from './auth'

describe('requestVerificationCode', () => {
  it('invalidates earlier unused verification codes when a new code is sent', async () => {
    const store = new InMemoryVerificationCodeStore()
    const sendEmail = vi.fn().mockResolvedValue(undefined)

    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 1_000,
      code: '111111',
      store,
      sendEmail,
    })

    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 62_000,
      code: '222222',
      store,
      sendEmail,
    })

    const records = await store.findRequestsBySchoolEmail(
      '110-12345678mkn@e.osakamanabi.jp',
    )

    expect(records).toMatchObject([
      { invalidatedAt: 62_000 },
      { invalidatedAt: null },
    ])
  })

  it('stores a hash instead of the plaintext verification code', async () => {
    const store = new InMemoryVerificationCodeStore()

    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 1_000,
      code: '123456',
      store,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    })

    const [record] = await store.findRequestsBySchoolEmail(
      '110-12345678mkn@e.osakamanabi.jp',
    )

    expect(record.codeHash).not.toBe('123456')
    expect(record.codeHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('does not send email when saving the verification code fails', async () => {
    const store = new InMemoryVerificationCodeStore()
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(store, 'saveRequest').mockRejectedValueOnce(
      new Error('database unavailable'),
    )

    await expect(
      requestVerificationCode({
        schoolEmailNumber: '12345678',
        now: 1_000,
        code: '123456',
        store,
        sendEmail,
      }),
    ).rejects.toThrow('database unavailable')

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('invalidates the saved verification code when email delivery fails', async () => {
    const store = new InMemoryVerificationCodeStore()

    await expect(
      requestVerificationCode({
        schoolEmailNumber: '12345678',
        now: 1_000,
        code: '123456',
        store,
        sendEmail: vi.fn().mockRejectedValue(new Error('delivery failed')),
      }),
    ).rejects.toThrow('delivery failed')

    const records = await store.findRequestsBySchoolEmail(
      '110-12345678mkn@e.osakamanabi.jp',
    )

    expect(records).toMatchObject([{ invalidatedAt: 1_000 }])
  })
})

describe('verifyCodeForExistingStudent', () => {
  it('creates a 30-minute setup session for a new Student Account without creating a Student Account', async () => {
    const store = new InMemoryVerificationCodeStore()

    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 1_000,
      code: '123456',
      store,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    })

    const result = await verifyCodeForExistingStudent({
      schoolEmailNumber: '12345678',
      code: '123456',
      now: 2_000,
      sessionToken: 'student-session-token',
      setupSessionToken: 'setup-session-token',
      store,
    })

    expect(result).toMatchObject({
      status: 'new-student',
      setupSessionToken: 'setup-session-token',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
    })

    if (result.status !== 'new-student') {
      throw new Error('expected setup session')
    }

    expect(result.expiresAt).toBe(2_000 + 30 * 60_000)
    await expect(
      readSetupSession({
        setupSessionToken: 'setup-session-token',
        now: 2_000,
        store,
      }),
    ).resolves.toMatchObject({
      status: 'valid',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
    })
    await expect(
      store.findStudentAccountBySchoolEmail(
        '110-12345678mkn@e.osakamanabi.jp',
      ),
    ).resolves.toBeNull()
  })

  it('creates a 30-day Student Session for an existing Student Account', async () => {
    const store = new InMemoryVerificationCodeStore()

    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 1_000,
      code: '123456',
      store,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    })
    await store.saveStudentAccount({
      studentAccountId: 'student-account-1',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      displayName: 'Sora',
    })

    const result = await verifyCodeForExistingStudent({
      schoolEmailNumber: '12345678',
      code: '123456',
      now: 2_000,
      sessionToken: 'session-token',
      setupSessionToken: 'setup-session-token',
      store,
    })

    expect(result).toMatchObject({
      status: 'logged-in',
      sessionToken: 'session-token',
      studentAccount: {
        schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      },
    })

    if (result.status !== 'logged-in') {
      throw new Error('expected login success')
    }

    expect(result.expiresAt).toBe(2_000 + 30 * 24 * 60 * 60_000)
  })

  it('rejects an invalid verification code without creating a Student Session', async () => {
    const store = new InMemoryVerificationCodeStore()

    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 1_000,
      code: '123456',
      store,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    })
    await store.saveStudentAccount({
      studentAccountId: 'student-account-1',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      displayName: 'Sora',
    })

    const result = await verifyCodeForExistingStudent({
      schoolEmailNumber: '12345678',
      code: '654321',
      now: 2_000,
      sessionToken: 'session-token',
      setupSessionToken: 'setup-session-token',
      store,
    })

    expect(result).toEqual({ status: 'invalid-verification' })
    await expect(
      readStudentSession({
        sessionToken: 'session-token',
        now: 2_000,
        store,
      }),
    ).resolves.toEqual({ status: 'unauthenticated' })
  })

  it('treats expired and logged-out Student Sessions as unauthenticated', async () => {
    const store = new InMemoryVerificationCodeStore()
    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 1_000,
      code: '123456',
      store,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    })
    await store.saveStudentAccount({
      studentAccountId: 'student-account-1',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      displayName: 'Sora',
    })
    await verifyCodeForExistingStudent({
      schoolEmailNumber: '12345678',
      code: '123456',
      now: 2_000,
      sessionToken: 'expired-session-token',
      setupSessionToken: 'setup-session-token',
      store,
    })

    await expect(
      readStudentSession({
        sessionToken: 'expired-session-token',
        now: 2_000 + 30 * 24 * 60 * 60_000,
        store,
      }),
    ).resolves.toEqual({ status: 'unauthenticated' })

    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 70_000,
      code: '234567',
      store,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    })
    await verifyCodeForExistingStudent({
      schoolEmailNumber: '12345678',
      code: '234567',
      now: 71_000,
      sessionToken: 'active-session-token',
      setupSessionToken: 'setup-session-token-2',
      store,
    })

    await logoutStudentSession({
      sessionToken: 'active-session-token',
      now: 1_500,
      store,
    })

    await expect(
      readStudentSession({
        sessionToken: 'active-session-token',
        now: 1_600,
        store,
      }),
    ).resolves.toEqual({ status: 'unauthenticated' })
  })

  it('treats expired and superseded setup sessions as invalid', async () => {
    const store = new InMemoryVerificationCodeStore()

    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 1_000,
      code: '111111',
      store,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    })
    await verifyCodeForExistingStudent({
      schoolEmailNumber: '12345678',
      code: '111111',
      now: 2_000,
      sessionToken: 'student-session-token',
      setupSessionToken: 'old-setup-token',
      store,
    })

    await expect(
      readSetupSession({
        setupSessionToken: 'old-setup-token',
        now: 2_000 + 30 * 60_000,
        store,
      }),
    ).resolves.toEqual({ status: 'invalid' })

    await requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 70_000,
      code: '222222',
      store,
      sendEmail: vi.fn().mockResolvedValue(undefined),
    })
    await verifyCodeForExistingStudent({
      schoolEmailNumber: '12345678',
      code: '222222',
      now: 71_000,
      sessionToken: 'student-session-token',
      setupSessionToken: 'new-setup-token',
      store,
    })

    await expect(
      readSetupSession({
        setupSessionToken: 'old-setup-token',
        now: 72_000,
        store,
      }),
    ).resolves.toEqual({ status: 'invalid' })
    await expect(
      readSetupSession({
        setupSessionToken: 'new-setup-token',
        now: 72_000,
        store,
      }),
    ).resolves.toMatchObject({ status: 'valid' })
  })
})
