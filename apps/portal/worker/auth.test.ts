import { describe, expect, it, vi } from 'vitest'
import { InMemoryVerificationCodeStore } from './auth'
import {
  completeInitialSetup,
  getInitialSetupOptions,
  submitInitialSetupDraft,
  readStudentSession,
  logoutStudentSession,
  readSetupSession,
  requestVerificationCode,
  verifyCodeForExistingStudent,
} from './studentAccountAccess'

async function createSetupSession(store: InMemoryVerificationCodeStore) {
  await requestVerificationCode({
    schoolEmailNumber: '12345678',
    now: 1_000,
    code: '123456',
    store,
    sendEmail: vi.fn().mockResolvedValue(undefined),
  })
  await verifyCodeForExistingStudent({
    schoolEmailNumber: '12345678',
    code: '123456',
    now: 2_000,
    sessionToken: 'student-session-token',
    setupSessionToken: 'setup-session-token',
    store,
  })
}

describe('Floating Lesson Reference resolution', () => {
  it('resolves the class-common value when the track has no override', async () => {
    const store = new InMemoryVerificationCodeStore()

    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-common',
      classId: 'class-1',
      trackId: null,
      referenceType: 'floating',
      referenceLabel: '★',
      lessonName: '共通授業',
    })

    await expect(
      store.findStandardTimetableEntryForFloatingReference(
        'class-1',
        'track-1',
        '★',
      ),
    ).resolves.toMatchObject({
      referenceType: 'floating',
      referenceLabel: '★',
      lessonName: '共通授業',
    })
  })

  it('prefers the track-specific value over the class-common value', async () => {
    const store = new InMemoryVerificationCodeStore()

    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-common',
      classId: '2026-grade-2-class-3',
      trackId: null,
      referenceType: 'floating',
      referenceLabel: '★',
      lessonName: '共通授業',
    })
    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-humanities',
      classId: '2026-grade-2-class-3',
      trackId: '2026-grade-2-class-3-humanities',
      referenceType: 'floating',
      referenceLabel: '★',
      lessonName: '自走',
    })

    await expect(
      store.findStandardTimetableEntryForFloatingReference(
        '2026-grade-2-class-3',
        '2026-grade-2-class-3-humanities',
        '★',
      ),
    ).resolves.toMatchObject({
      trackId: '2026-grade-2-class-3-humanities',
      lessonName: '自走',
    })
  })
})

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

  it('always sends a verification code to the configured development School Email even inside rate limits', async () => {
    const store = new InMemoryVerificationCodeStore()
    const sendEmail = vi.fn().mockResolvedValue(undefined)

    for (let index = 0; index < 6; index += 1) {
      await expect(
        requestVerificationCode({
          schoolEmailNumber: '00802117',
          now: 1_000,
          code: String(index).padStart(6, '0'),
          store,
          sendEmail,
        }),
      ).resolves.toEqual({
        status: 'sent',
        schoolEmail: '110-00802117mkn@e.osakamanabi.jp',
      })
    }

    expect(sendEmail).toHaveBeenCalledTimes(6)
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

describe('initial Student Affiliation setup', () => {
  it('returns current School Year Grade/Class/Track choices for a valid setup session', async () => {
    const store = new InMemoryVerificationCodeStore()
    await createSetupSession(store)
    await store.saveSchoolYear({
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    })
    await store.saveSchoolYearClass({
      classId: 'class-1-1',
      schoolYear: 2026,
      grade: 1,
      classNumber: 1,
    })
    await store.saveTrack({
      trackId: 'track-1-1-a',
      classId: 'class-1-1',
      trackName: 'A',
    })

    await expect(
      getInitialSetupOptions({
        setupSessionToken: 'setup-session-token',
        now: 2_000,
        store,
      }),
    ).resolves.toEqual({
      status: 'ready',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
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
  })

  it('validates trimmed names and selected Track before saving initial setup draft', async () => {
    const store = new InMemoryVerificationCodeStore()
    await createSetupSession(store)
    await store.saveSchoolYear({
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    })
    await store.saveSchoolYearClass({
      classId: 'class-2-3',
      schoolYear: 2026,
      grade: 2,
      classNumber: 3,
    })
    await store.saveTrack({
      trackId: 'track-2-3-science',
      classId: 'class-2-3',
      trackName: '理系',
    })

    await expect(
      submitInitialSetupDraft({
        setupSessionToken: 'setup-session-token',
        displayName: '  Sora  ',
        realName: '  空  ',
        trackId: 'track-2-3-science',
        confirmed: true,
        now: 2_000,
        store,
      }),
    ).resolves.toEqual({
      status: 'saved',
      draft: {
        displayName: 'Sora',
        realName: '空',
        schoolYear: 2026,
        grade: 2,
        classId: 'class-2-3',
        trackId: 'track-2-3-science',
      },
    })
  })

  it('completes initial setup by creating Student Account, current affiliation, and Student Session', async () => {
    const store = new InMemoryVerificationCodeStore()
    await createSetupSession(store)
    await store.saveSchoolYear({
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    })
    await store.saveSchoolYearClass({
      classId: 'class-2-3',
      schoolYear: 2026,
      grade: 2,
      classNumber: 3,
    })
    await store.saveTrack({
      trackId: 'track-2-3-science',
      classId: 'class-2-3',
      trackName: '理系',
    })
    const draftResult = await submitInitialSetupDraft({
      setupSessionToken: 'setup-session-token',
      displayName: 'Sora',
      realName: '空',
      trackId: 'track-2-3-science',
      confirmed: true,
      now: 2_000,
      store,
    })

    if (draftResult.status !== 'saved') {
      throw new Error('expected saved draft')
    }

    const result = await completeInitialSetup({
      setupSessionToken: 'setup-session-token',
      draft: draftResult.draft,
      now: 3_000,
      sessionToken: 'created-session-token',
      store,
    })

    expect(result).toMatchObject({
      status: 'authenticated',
      studentAccount: {
        schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
        displayName: 'Sora',
      },
    })
    if (result.status !== 'authenticated') {
      throw new Error('expected authenticated')
    }
    await expect(
      readStudentSession({
        sessionToken: 'created-session-token',
        now: 3_000,
        store,
      }),
    ).resolves.toMatchObject({ status: 'authenticated' })
    await expect(
      readSetupSession({
        setupSessionToken: 'setup-session-token',
        now: 3_000,
        store,
      }),
    ).resolves.toEqual({ status: 'invalid' })
    await expect(
      store.findCurrentStudentAffiliation(
        result.studentAccount.studentAccountId,
        2026,
      ),
    ).resolves.toMatchObject({
      schoolYear: 2026,
      grade: 2,
      classId: 'class-2-3',
      trackId: 'track-2-3-science',
      endedAt: null,
    })
  })

  it('rolls back Student Account creation when affiliation creation fails', async () => {
    const store = new InMemoryVerificationCodeStore()
    await createSetupSession(store)
    const draft = {
      displayName: 'Sora',
      realName: '空',
      schoolYear: 2026,
      grade: 2,
      classId: 'class-2-3',
      trackId: 'track-2-3-science',
    }
    store.failNextStudentAffiliationSaveForTest()

    await expect(
      completeInitialSetup({
        setupSessionToken: 'setup-session-token',
        draft,
        now: 3_000,
        sessionToken: 'created-session-token',
        store,
      }),
    ).rejects.toThrow('student affiliation save failed')
    await expect(
      store.findStudentAccountBySchoolEmail(
        '110-12345678mkn@e.osakamanabi.jp',
      ),
    ).resolves.toBeNull()
    await expect(
      readSetupSession({
        setupSessionToken: 'setup-session-token',
        now: 3_000,
        store,
      }),
    ).resolves.toMatchObject({ status: 'valid' })
  })

  it('recovers a duplicate School Email race by issuing a session for existing Student Account', async () => {
    const store = new InMemoryVerificationCodeStore()
    await createSetupSession(store)
    await store.saveStudentAccount({
      studentAccountId: 'existing-student-account',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      displayName: 'Existing',
    })

    await expect(
      completeInitialSetup({
        setupSessionToken: 'setup-session-token',
        draft: {
          displayName: 'Sora',
          realName: '空',
          schoolYear: 2026,
          grade: 2,
          classId: 'class-2-3',
          trackId: 'track-2-3-science',
        },
        now: 3_000,
        sessionToken: 'race-session-token',
        store,
      }),
    ).resolves.toMatchObject({
      status: 'authenticated',
      studentAccount: {
        studentAccountId: 'existing-student-account',
        displayName: 'Existing',
      },
    })
    await expect(
      readStudentSession({
        sessionToken: 'race-session-token',
        now: 3_000,
        store,
      }),
    ).resolves.toMatchObject({ status: 'authenticated' })
  })

  it('rejects missing master data, invalid names, missing Track, and unconfirmed submission', async () => {
    const store = new InMemoryVerificationCodeStore()
    await createSetupSession(store)

    await expect(
      getInitialSetupOptions({
        setupSessionToken: 'setup-session-token',
        now: 2_000,
        store,
      }),
    ).resolves.toEqual({ status: 'setup-unavailable' })

    await store.saveSchoolYear({
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    })

    await expect(
      submitInitialSetupDraft({
        setupSessionToken: 'setup-session-token',
        displayName: '   ',
        realName: 'Name',
        trackId: 'track-missing',
        confirmed: true,
        now: 2_000,
        store,
      }),
    ).resolves.toEqual({ status: 'invalid-name' })

    await expect(
      submitInitialSetupDraft({
        setupSessionToken: 'setup-session-token',
        displayName: 'Sora',
        realName: 'Name',
        trackId: null,
        confirmed: true,
        now: 2_000,
        store,
      }),
    ).resolves.toEqual({ status: 'invalid-affiliation' })

    await expect(
      submitInitialSetupDraft({
        setupSessionToken: 'setup-session-token',
        displayName: 'Sora',
        realName: 'Name',
        trackId: 'track-missing',
        confirmed: false,
        now: 2_000,
        store,
      }),
    ).resolves.toEqual({ status: 'confirmation-required' })
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
