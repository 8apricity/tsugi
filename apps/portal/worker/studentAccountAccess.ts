import {
  type InitialSetupDraft,
  type SchoolYearClassRecord,
  type StudentAccountAccessStore,
  type StudentAffiliationSetupStore,
  type StudentAccount,
  type TrackRecord,
} from './persistence'

const schoolEmailNumberPattern = /^[0-9]{8}$/
const resendCooldownMs = 60_000
const hourlySendWindowMs = 60 * 60_000
const hourlySendLimit = 5
const verificationCodeLifetimeMs = 10 * 60_000
const maxFailedVerificationAttempts = 5
const studentSessionLifetimeMs = 30 * 24 * 60 * 60_000
const setupSessionLifetimeMs = 30 * 60_000
const interactiveTestLoginTicketLifetimeMs = 2 * 60_000
const verificationCodeRateLimitExemptSchoolEmails = new Set([
  '110-00802117mkn@e.osakamanabi.jp',
])
const seededTestStudentAccountIds = [
  'test-student-2026-2-3-humanities-1',
  'test-student-2026-2-3-humanities-2',
  'test-student-2026-2-3-humanities-3',
  'test-student-2026-2-3-science-1',
  'test-student-2026-2-3-science-2',
  'test-student-2026-2-3-science-3',
  'test-student-2026-2-4-humanities-1',
  'test-student-2026-2-4-humanities-2',
  'test-student-2025-2-3-humanities-1',
]
const seededTestStudentAccountIdSet = new Set(seededTestStudentAccountIds)


export type SendVerificationCodeEmail = (message: {
  schoolEmail: string
  code: string
}) => Promise<void>

export type RequestVerificationCodeInput = {
  schoolEmailNumber: unknown
  now: number
  code: string
  store: StudentAccountAccessStore
  sendEmail: SendVerificationCodeEmail
}

export type RequestVerificationCodeResult =
  | { status: 'sent'; schoolEmail: string }
  | { status: 'invalid-school-email-number' }
  | { status: 'rate-limited' }

export type VerifyCodeForExistingStudentInput = {
  schoolEmailNumber: unknown
  code: unknown
  now: number
  sessionToken: string
  setupSessionToken: string
  store: StudentAccountAccessStore
}

export type VerifyCodeForExistingStudentResult =
  | {
      status: 'logged-in'
      studentAccount: StudentAccount
      sessionToken: string
      expiresAt: number
    }
  | {
      status: 'new-student'
      schoolEmail: string
      setupSessionToken: string
      expiresAt: number
    }
  | { status: 'invalid-verification' }

export type ReadStudentSessionResult =
  | { status: 'authenticated'; studentAccount: StudentAccount }
  | { status: 'unauthenticated' }

export type ReadSetupSessionResult =
  | { status: 'valid'; schoolEmail: string }
  | { status: 'invalid' }

export type InitialSetupOptionsResult =
  | {
      status: 'ready'
      schoolEmail: string
      schoolYear: number
      grades: Array<{
        grade: number
        classes: Array<{
          classId: string
          classNumber: number
          tracks: Array<{ trackId: string; trackName: string }>
        }>
      }>
    }
  | { status: 'invalid-setup-session' }
  | { status: 'setup-unavailable' }

export type SubmitInitialSetupDraftResult =
  | { status: 'saved'; draft: InitialSetupDraft }
  | { status: 'invalid-setup-session' }
  | { status: 'invalid-name' }
  | { status: 'invalid-affiliation' }
  | { status: 'confirmation-required' }
  | { status: 'setup-unavailable' }

export type CompleteInitialSetupResult =
  | {
      status: 'authenticated'
      studentAccount: StudentAccount
      sessionToken: string
      expiresAt: number
    }
  | { status: 'invalid-setup-session' }

export type CreateTestLoginSessionResult =
  | {
      status: 'authenticated'
      studentAccount: StudentAccount
      sessionToken: string
      expiresAt: number
    }
  | { status: 'not-found' }

export type IssueInteractiveTestLoginTicketResult =
  | {
      status: 'issued'
      ticket: string
      expiresAt: number
    }
  | { status: 'not-found' }

export type ExchangeInteractiveTestLoginTicketResult =
  | {
      status: 'authenticated'
      sessionToken: string
      expiresAt: number
    }
  | { status: 'not-found' }


type StudentAccountAccessDependencies = {
  studentAccountStore: StudentAccountAccessStore
  studentAffiliationStore: StudentAffiliationSetupStore
  sendEmail: SendVerificationCodeEmail
  generateVerificationCode?: () => string
  generateSessionToken?: () => string
}

export function createStudentAccountAccess({
  studentAccountStore,
  studentAffiliationStore,
  sendEmail,
  generateVerificationCode = createVerificationCode,
  generateSessionToken = createSessionToken,
}: StudentAccountAccessDependencies) {
  return {
    requestVerificationCode({
      schoolEmailNumber,
      now,
    }: {
      schoolEmailNumber: unknown
      now: number
    }) {
      return requestVerificationCode({
        schoolEmailNumber,
        now,
        code: generateVerificationCode(),
        store: studentAccountStore,
        sendEmail,
      })
    },

    verifyCode({
      schoolEmailNumber,
      code,
      now,
    }: {
      schoolEmailNumber: unknown
      code: unknown
      now: number
    }) {
      return verifyCodeForExistingStudent({
        schoolEmailNumber,
        code,
        now,
        sessionToken: generateSessionToken(),
        setupSessionToken: generateSessionToken(),
        store: studentAccountStore,
      })
    },

    readStudentSession({
      sessionToken,
      now,
    }: {
      sessionToken: string | null
      now: number
    }) {
      return readStudentSession({
        sessionToken,
        now,
        store: studentAccountStore,
      })
    },

    readSetupSession({
      setupSessionToken,
      now,
    }: {
      setupSessionToken: string | null
      now: number
    }) {
      return readSetupSession({
        setupSessionToken,
        now,
        store: studentAccountStore,
      })
    },

    getInitialSetupOptions({
      setupSessionToken,
      now,
    }: {
      setupSessionToken: string | null
      now: number
    }) {
      return getInitialSetupOptions({
        setupSessionToken,
        now,
        studentAccountStore,
        studentAffiliationStore,
      })
    },

    async completeInitialSetup({
      setupSessionToken,
      displayName,
      realName,
      trackId,
      confirmed,
      now,
    }: {
      setupSessionToken: string | null
      displayName: unknown
      realName: unknown
      trackId: unknown
      confirmed: unknown
      now: number
    }) {
      const draftResult = await submitInitialSetupDraft({
        setupSessionToken,
        displayName,
        realName,
        trackId,
        confirmed,
        now,
        studentAccountStore,
        studentAffiliationStore,
      })

      if (draftResult.status !== 'saved') {
        return draftResult
      }

      return completeInitialSetup({
        setupSessionToken,
        draft: draftResult.draft,
        now,
        sessionToken: generateSessionToken(),
        studentAccountStore,
        studentAffiliationStore,
      })
    },

    createTestLoginSession({
      studentAccountId,
      now,
    }: {
      studentAccountId: unknown
      now: number
    }) {
      return createTestLoginSession({
        studentAccountId,
        now,
        sessionToken: generateSessionToken(),
        store: studentAccountStore,
      })
    },

    issueInteractiveTestLoginTicket({
      studentAccountId,
      now,
    }: {
      studentAccountId: unknown
      now: number
    }) {
      return issueInteractiveTestLoginTicket({
        studentAccountId,
        now,
        ticket: generateSessionToken(),
        store: studentAccountStore,
      })
    },

    exchangeInteractiveTestLoginTicket({
      ticket,
      enabled,
      now,
    }: {
      ticket: unknown
      enabled: boolean
      now: number
    }) {
      return exchangeInteractiveTestLoginTicket({
        ticket,
        enabled,
        now,
        consumptionNonce: generateSessionToken(),
        sessionToken: generateSessionToken(),
        store: studentAccountStore,
      })
    },

    logoutStudentSession({
      sessionToken,
      now,
    }: {
      sessionToken: string | null
      now: number
    }) {
      return logoutStudentSession({
        sessionToken,
        now,
        store: studentAccountStore,
      })
    },
  }
}

function createVerificationCode() {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)

  return String(values[0] % 1_000_000).padStart(6, '0')
}

function createSessionToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)

  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function normalizeSchoolEmail(schoolEmailNumber: string) {
  return `110-${schoolEmailNumber}mkn@e.osakamanabi.jp`
}

export async function requestVerificationCode({
  schoolEmailNumber,
  now,
  code,
  store,
  sendEmail,
}: RequestVerificationCodeInput): Promise<RequestVerificationCodeResult> {
  if (
    typeof schoolEmailNumber !== 'string' ||
    !schoolEmailNumberPattern.test(schoolEmailNumber)
  ) {
    return { status: 'invalid-school-email-number' }
  }

  const schoolEmail = normalizeSchoolEmail(schoolEmailNumber)
  const existingRequests = await store.findRequestsBySchoolEmail(schoolEmail)
  const skipsRateLimit =
    verificationCodeRateLimitExemptSchoolEmails.has(schoolEmail)
  const activeRequests = existingRequests.filter(
    (request) => request.invalidatedAt === null,
  )
  const latestRequest = activeRequests.at(-1)
  const requestsInsideHourlyWindow = existingRequests.filter(
    (request) => now - request.requestedAt < hourlySendWindowMs,
  )

  if (
    !skipsRateLimit &&
    latestRequest &&
    now - latestRequest.requestedAt < resendCooldownMs
  ) {
    return { status: 'rate-limited' }
  }

  if (!skipsRateLimit && requestsInsideHourlyWindow.length >= hourlySendLimit) {
    return { status: 'rate-limited' }
  }

  await store.invalidateUnusedRequests(schoolEmail, now)
  await store.invalidateSetupSessionsBySchoolEmail(schoolEmail, now)
  await store.saveRequest({
    schoolEmail,
    codeHash: await hashVerificationCode(code),
    requestedAt: now,
    invalidatedAt: null,
    failedAttempts: 0,
  })
  try {
    await sendEmail({ schoolEmail, code })
  } catch (error) {
    await store.invalidateUnusedRequests(schoolEmail, now)
    throw error
  }

  return { status: 'sent', schoolEmail }
}

export async function verifyCodeForExistingStudent({
  schoolEmailNumber,
  code,
  now,
  sessionToken,
  setupSessionToken,
  store,
}: VerifyCodeForExistingStudentInput): Promise<VerifyCodeForExistingStudentResult> {
  if (
    typeof schoolEmailNumber !== 'string' ||
    !schoolEmailNumberPattern.test(schoolEmailNumber) ||
    typeof code !== 'string'
  ) {
    return { status: 'invalid-verification' }
  }

  const schoolEmail = normalizeSchoolEmail(schoolEmailNumber)
  const existingRequests = await store.findRequestsBySchoolEmail(schoolEmail)
  const latestRequest = existingRequests
    .filter((request) => request.invalidatedAt === null)
    .at(-1)

  if (!latestRequest || now - latestRequest.requestedAt > verificationCodeLifetimeMs) {
    return { status: 'invalid-verification' }
  }

  if (latestRequest.codeHash !== (await hashToken(code))) {
    if (latestRequest.emailVerificationCodeId) {
      const failedAttempts = latestRequest.failedAttempts + 1
      await store.recordFailedVerificationAttempt(
        latestRequest.emailVerificationCodeId,
        failedAttempts,
        failedAttempts >= maxFailedVerificationAttempts ? now : null,
      )
    }

    return { status: 'invalid-verification' }
  }

  const studentAccount = await store.findStudentAccountBySchoolEmail(schoolEmail)

  if (!studentAccount) {
    await store.invalidateUnusedRequests(schoolEmail, now)
    await store.invalidateSetupSessionsBySchoolEmail(schoolEmail, now)

    const expiresAt = now + setupSessionLifetimeMs
    await store.saveSetupSession({
      setupSessionTokenHash: await hashToken(setupSessionToken),
      schoolEmail,
      createdAt: now,
      expiresAt,
      invalidatedAt: null,
    })

    return {
      status: 'new-student',
      schoolEmail,
      setupSessionToken,
      expiresAt,
    }
  }

  await store.invalidateUnusedRequests(schoolEmail, now)

  const expiresAt = now + studentSessionLifetimeMs
  await store.saveStudentSession({
    sessionTokenHash: await hashToken(sessionToken),
    studentAccountId: studentAccount.studentAccountId,
    createdAt: now,
    expiresAt,
    invalidatedAt: null,
  })

  return {
    status: 'logged-in',
    studentAccount,
    sessionToken,
    expiresAt,
  }
}

export async function readSetupSession({
  setupSessionToken,
  now,
  store,
}: {
  setupSessionToken: string | null
  now: number
  store: StudentAccountAccessStore
}): Promise<ReadSetupSessionResult> {
  if (!setupSessionToken) {
    return { status: 'invalid' }
  }

  const session = await store.findSetupSessionByTokenHash(
    await hashToken(setupSessionToken),
  )

  if (!session || session.invalidatedAt !== null || session.expiresAt <= now) {
    return { status: 'invalid' }
  }

  return { status: 'valid', schoolEmail: session.schoolEmail }
}

export async function getInitialSetupOptions({
  setupSessionToken,
  now,
  studentAccountStore,
  studentAffiliationStore,
}: {
  setupSessionToken: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  studentAffiliationStore: StudentAffiliationSetupStore
}): Promise<InitialSetupOptionsResult> {
  const setupSession = await readSetupSession({
    setupSessionToken,
    now,
    store: studentAccountStore,
  })

  if (setupSession.status === 'invalid') {
    return { status: 'invalid-setup-session' }
  }

  const currentSchoolYear = await studentAffiliationStore.findCurrentSchoolYear()

  if (!currentSchoolYear) {
    return { status: 'setup-unavailable' }
  }

  const classes = await studentAffiliationStore.listClassesForSchoolYear(
    currentSchoolYear.schoolYear,
  )
  const tracks = await studentAffiliationStore.listTracksForSchoolYear(
    currentSchoolYear.schoolYear,
  )

  if (classes.length === 0 || tracks.length === 0) {
    return { status: 'setup-unavailable' }
  }

  const tracksByClassId = new Map<string, TrackRecord[]>()

  for (const track of tracks) {
    tracksByClassId.set(track.classId, [
      ...(tracksByClassId.get(track.classId) ?? []),
      track,
    ])
  }

  const classesByGrade = new Map<number, SchoolYearClassRecord[]>()

  for (const schoolClass of classes) {
    const classTracks = tracksByClassId.get(schoolClass.classId) ?? []

    if (classTracks.length === 0) {
      return { status: 'setup-unavailable' }
    }

    classesByGrade.set(schoolClass.grade, [
      ...(classesByGrade.get(schoolClass.grade) ?? []),
      schoolClass,
    ])
  }

  return {
    status: 'ready',
    schoolEmail: setupSession.schoolEmail,
    schoolYear: currentSchoolYear.schoolYear,
    grades: [...classesByGrade.entries()]
      .sort(([leftGrade], [rightGrade]) => leftGrade - rightGrade)
      .map(([grade, gradeClasses]) => ({
        grade,
        classes: gradeClasses
          .sort((left, right) => left.classNumber - right.classNumber)
          .map((schoolClass) => ({
            classId: schoolClass.classId,
            classNumber: schoolClass.classNumber,
            tracks: (tracksByClassId.get(schoolClass.classId) ?? [])
              .sort((left, right) => left.trackName.localeCompare(right.trackName))
              .map((track) => ({
                trackId: track.trackId,
                trackName: track.trackName,
              })),
          })),
      })),
  }
}

export async function submitInitialSetupDraft({
  setupSessionToken,
  displayName,
  realName,
  trackId,
  confirmed,
  now,
  studentAccountStore,
  studentAffiliationStore,
}: {
  setupSessionToken: string | null
  displayName: unknown
  realName: unknown
  trackId: unknown
  confirmed: unknown
  now: number
  studentAccountStore: StudentAccountAccessStore
  studentAffiliationStore: StudentAffiliationSetupStore
}): Promise<SubmitInitialSetupDraftResult> {
  if (confirmed !== true) {
    return { status: 'confirmation-required' }
  }

  const trimmedDisplayName = trimName(displayName)
  const trimmedRealName = trimName(realName)

  if (
    !trimmedDisplayName ||
    trimmedDisplayName.length > 24 ||
    !trimmedRealName ||
    trimmedRealName.length > 40
  ) {
    return { status: 'invalid-name' }
  }

  if (typeof trackId !== 'string') {
    return { status: 'invalid-affiliation' }
  }

  const setupSession = await readSetupSession({
    setupSessionToken,
    now,
    store: studentAccountStore,
  })

  if (setupSession.status === 'invalid') {
    return { status: 'invalid-setup-session' }
  }

  const currentSchoolYear = await studentAffiliationStore.findCurrentSchoolYear()

  if (!currentSchoolYear) {
    return { status: 'setup-unavailable' }
  }

  const resolvedTrack = await studentAffiliationStore.findTrackWithClass(
    trackId,
    currentSchoolYear.schoolYear,
  )

  if (!resolvedTrack) {
    return { status: 'invalid-affiliation' }
  }

  const draft = {
    displayName: trimmedDisplayName,
    realName: trimmedRealName,
    schoolYear: currentSchoolYear.schoolYear,
    grade: resolvedTrack.schoolClass.grade,
    classId: resolvedTrack.schoolClass.classId,
    trackId: resolvedTrack.track.trackId,
  }

  await studentAffiliationStore.saveInitialSetupDraft(
    await hashToken(setupSessionToken ?? ''),
    draft,
  )

  return { status: 'saved', draft }
}

export async function completeInitialSetup({
  setupSessionToken,
  draft,
  now,
  sessionToken,
  studentAccountStore,
  studentAffiliationStore,
}: {
  setupSessionToken: string | null
  draft: InitialSetupDraft
  now: number
  sessionToken: string
  studentAccountStore: StudentAccountAccessStore
  studentAffiliationStore: StudentAffiliationSetupStore
}): Promise<CompleteInitialSetupResult> {
  if (!setupSessionToken) {
    return { status: 'invalid-setup-session' }
  }

  const setupSessionTokenHash = await hashToken(setupSessionToken)
  const setupSession = await studentAccountStore.findSetupSessionByTokenHash(
    setupSessionTokenHash,
  )

  if (!setupSession || setupSession.invalidatedAt !== null || setupSession.expiresAt <= now) {
    return { status: 'invalid-setup-session' }
  }

  const expiresAt = now + studentSessionLifetimeMs
  const studentAccount =
    await studentAffiliationStore.completeInitialSetupTransaction({
      setupSessionTokenHash,
      schoolEmail: setupSession.schoolEmail,
      studentAccountId: crypto.randomUUID(),
      studentAffiliationId: crypto.randomUUID(),
      displayName: draft.displayName,
      realName: draft.realName,
      schoolYear: draft.schoolYear,
      grade: draft.grade,
      classId: draft.classId,
      trackId: draft.trackId,
      sessionTokenHash: await hashToken(sessionToken),
      now,
      expiresAt,
    })

  return {
    status: 'authenticated',
    studentAccount,
    sessionToken,
    expiresAt,
  }
}

export async function createTestLoginSession({
  studentAccountId,
  now,
  sessionToken,
  store,
}: {
  studentAccountId: unknown
  now: number
  sessionToken: string
  store: StudentAccountAccessStore
}): Promise<CreateTestLoginSessionResult> {
  if (
    typeof studentAccountId !== 'string' ||
    !seededTestStudentAccountIdSet.has(studentAccountId)
  ) {
    return { status: 'not-found' }
  }

  const studentAccount = await store.findStudentAccountById(studentAccountId)

  if (!studentAccount) {
    return { status: 'not-found' }
  }

  const expiresAt = now + studentSessionLifetimeMs
  await store.saveStudentSession({
    sessionTokenHash: await hashToken(sessionToken),
    studentAccountId: studentAccount.studentAccountId,
    createdAt: now,
    expiresAt,
    invalidatedAt: null,
  })

  return {
    status: 'authenticated',
    studentAccount,
    sessionToken,
    expiresAt,
  }
}

export async function issueInteractiveTestLoginTicket({
  studentAccountId,
  now,
  ticket,
  store,
}: {
  studentAccountId: unknown
  now: number
  ticket: string
  store: StudentAccountAccessStore
}): Promise<IssueInteractiveTestLoginTicketResult> {
  if (
    typeof studentAccountId !== 'string' ||
    !seededTestStudentAccountIdSet.has(studentAccountId)
  ) {
    return { status: 'not-found' }
  }

  await store.cleanupInteractiveTestLoginTickets(now)
  const expiresAt = now + interactiveTestLoginTicketLifetimeMs
  const saved = await store.saveInteractiveTestLoginTicket({
    ticketTokenHash: await hashToken(ticket),
    studentAccountId,
    createdAt: now,
    expiresAt,
    consumedAt: null,
    consumptionNonce: null,
  })

  return saved
    ? { status: 'issued', ticket, expiresAt }
    : { status: 'not-found' }
}

export async function exchangeInteractiveTestLoginTicket({
  ticket,
  enabled,
  now,
  consumptionNonce,
  sessionToken,
  store,
}: {
  ticket: unknown
  enabled: boolean
  now: number
  consumptionNonce: string
  sessionToken: string
  store: StudentAccountAccessStore
}): Promise<ExchangeInteractiveTestLoginTicketResult> {
  if (typeof ticket !== 'string' || !/^[a-f0-9]{64}$/.test(ticket)) {
    return { status: 'not-found' }
  }

  const expiresAt = now + studentSessionLifetimeMs
  const consumed = await store.consumeInteractiveTestLoginTicket({
    ticketTokenHash: await hashToken(ticket),
    consumptionNonce,
    sessionTokenHash: await hashToken(sessionToken),
    enabled,
    allowedStudentAccountIds: seededTestStudentAccountIds,
    now,
    sessionExpiresAt: expiresAt,
  })

  return consumed
    ? { status: 'authenticated', sessionToken, expiresAt }
    : { status: 'not-found' }
}

function trimName(value: unknown) {
  return typeof value === 'string' ? value.trim() : null
}

export async function readStudentSession({
  sessionToken,
  now,
  store,
}: {
  sessionToken: string | null
  now: number
  store: StudentAccountAccessStore
}): Promise<ReadStudentSessionResult> {
  if (!sessionToken) {
    return { status: 'unauthenticated' }
  }

  const session = await store.findStudentSessionByTokenHash(
    await hashToken(sessionToken),
  )

  if (!session || session.invalidatedAt !== null || session.expiresAt <= now) {
    return { status: 'unauthenticated' }
  }

  const studentAccount = await store.findStudentAccountById(
    session.studentAccountId,
  )

  return studentAccount
    ? { status: 'authenticated', studentAccount }
    : { status: 'unauthenticated' }
}

export async function logoutStudentSession({
  sessionToken,
  now,
  store,
}: {
  sessionToken: string | null
  now: number
  store: StudentAccountAccessStore
}) {
  if (!sessionToken) {
    return
  }

  await store.invalidateStudentSession(await hashToken(sessionToken), now)
}

async function hashVerificationCode(code: string) {
  return hashToken(code)
}

async function hashToken(token: string) {
  const encodedCode = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', encodedCode)

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
