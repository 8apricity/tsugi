import { describe, expect, it, vi } from 'vitest'
import { createInMemoryPersistenceAdapters } from './persistence'
import { createStudentAccountAccess } from './studentAccountAccess'

describe('Student Account access module', () => {
  it('creates a Student Account after School Email verification and confirmed initial setup', async () => {
    const persistence = createInMemoryPersistenceAdapters()
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    const sessionTokens = [
      'unused-student-session-token',
      'setup-session-token',
      'student-session-token',
    ]
    const access = createStudentAccountAccess({
      studentAccountStore: persistence.studentAccount,
      studentAffiliationStore: persistence.studentAffiliation,
      sendEmail,
      generateVerificationCode: () => '123456',
      generateSessionToken: () => sessionTokens.shift() ?? 'unexpected-token',
    })

    await persistence.seed.saveSchoolYear({
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    })
    await persistence.seed.saveSchoolYearClass({
      classId: 'class-1-1',
      schoolYear: 2026,
      grade: 1,
      classNumber: 1,
    })
    await persistence.seed.saveTrack({
      trackId: 'track-1-1-a',
      classId: 'class-1-1',
      trackName: 'A',
    })

    await expect(
      access.requestVerificationCode({
        schoolEmailNumber: '12345678',
        now: 1_000,
      }),
    ).resolves.toEqual({
      status: 'sent',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
    })
    expect(sendEmail).toHaveBeenCalledWith({
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      code: '123456',
    })

    const verification = await access.verifyCode({
      schoolEmailNumber: '12345678',
      code: '123456',
      now: 2_000,
    })
    expect(verification).toMatchObject({
      status: 'new-student',
      setupSessionToken: 'setup-session-token',
    })

    const result = await access.completeInitialSetup({
      setupSessionToken:
        verification.status === 'new-student'
          ? verification.setupSessionToken
          : null,
      displayName: ' Sora ',
      trackId: 'track-1-1-a',
      confirmed: true,
      now: 3_000,
    })

    expect(result).toMatchObject({
      status: 'authenticated',
      studentAccount: {
        schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
        displayName: 'Sora',
      },
      sessionToken: 'student-session-token',
    })
  })

  it('logs in an existing Student Account and invalidates its Student Session on logout', async () => {
    const persistence = createInMemoryPersistenceAdapters()
    const access = createStudentAccountAccess({
      studentAccountStore: persistence.studentAccount,
      studentAffiliationStore: persistence.studentAffiliation,
      sendEmail: vi.fn().mockResolvedValue(undefined),
      generateVerificationCode: () => '123456',
      generateSessionToken: () => 'student-session-token',
    })
    await persistence.seed.saveStudentAccount({
      studentAccountId: 'student-account-1',
      schoolEmail: '110-12345678mkn@e.osakamanabi.jp',
      displayName: 'Sora',
    })
    await access.requestVerificationCode({
      schoolEmailNumber: '12345678',
      now: 1_000,
    })

    const login = await access.verifyCode({
      schoolEmailNumber: '12345678',
      code: '123456',
      now: 2_000,
    })
    expect(login).toMatchObject({
      status: 'logged-in',
      studentAccount: { displayName: 'Sora' },
      sessionToken: 'student-session-token',
    })
    await expect(
      access.readStudentSession({
        sessionToken: 'student-session-token',
        now: 3_000,
      }),
    ).resolves.toMatchObject({ status: 'authenticated' })

    await access.logoutStudentSession({
      sessionToken: 'student-session-token',
      now: 4_000,
    })

    await expect(
      access.readStudentSession({
        sessionToken: 'student-session-token',
        now: 5_000,
      }),
    ).resolves.toEqual({ status: 'unauthenticated' })
  })
})
