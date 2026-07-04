import { describe, expect, it, vi } from 'vitest'
import {
  InMemoryVerificationCodeStore,
  requestVerificationCode,
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
})
