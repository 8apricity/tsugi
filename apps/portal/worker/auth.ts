const schoolEmailNumberPattern = /^[0-9]{8}$/
const resendCooldownMs = 60_000
const hourlySendWindowMs = 60 * 60_000
const hourlySendLimit = 5
const verificationCodeLifetimeMs = 10 * 60_000
const studentSessionLifetimeMs = 30 * 24 * 60 * 60_000

export type VerificationCodeRequestRecord = {
  emailVerificationCodeId?: string
  schoolEmail: string
  codeHash: string
  requestedAt: number
  invalidatedAt: number | null
}

export type StudentAccount = {
  studentAccountId: string
  schoolEmail: string
  displayName: string
}

export type StudentSession = {
  sessionTokenHash: string
  studentAccountId: string
  createdAt: number
  expiresAt: number
  invalidatedAt: number | null
}

export type VerificationCodeStore = {
  findRequestsBySchoolEmail(
    schoolEmail: string,
  ): Promise<VerificationCodeRequestRecord[]>
  saveRequest(record: VerificationCodeRequestRecord): Promise<void>
  invalidateUnusedRequests(schoolEmail: string, invalidatedAt: number): Promise<void>
  findStudentAccountBySchoolEmail(
    schoolEmail: string,
  ): Promise<StudentAccount | null>
  findStudentAccountById(studentAccountId: string): Promise<StudentAccount | null>
  saveStudentAccount(record: StudentAccount): Promise<void>
  saveStudentSession(record: StudentSession): Promise<void>
  findStudentSessionByTokenHash(
    sessionTokenHash: string,
  ): Promise<StudentSession | null>
  invalidateStudentSession(
    sessionTokenHash: string,
    invalidatedAt: number,
  ): Promise<void>
}

export type SendVerificationCodeEmail = (message: {
  schoolEmail: string
  code: string
}) => Promise<void>

export type RequestVerificationCodeInput = {
  schoolEmailNumber: unknown
  now: number
  code: string
  store: VerificationCodeStore
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
  store: VerificationCodeStore
}

export type VerifyCodeForExistingStudentResult =
  | {
      status: 'logged-in'
      studentAccount: StudentAccount
      sessionToken: string
      expiresAt: number
    }
  | { status: 'new-student' }
  | { status: 'invalid-verification' }

export type ReadStudentSessionResult =
  | { status: 'authenticated'; studentAccount: StudentAccount }
  | { status: 'unauthenticated' }

export class InMemoryVerificationCodeStore implements VerificationCodeStore {
  private records: VerificationCodeRequestRecord[] = []
  private studentAccounts: StudentAccount[] = []
  private studentSessions: StudentSession[] = []

  async findRequestsBySchoolEmail(schoolEmail: string) {
    return this.records.filter((record) => record.schoolEmail === schoolEmail)
  }

  async saveRequest(record: VerificationCodeRequestRecord) {
    this.records.push({
      ...record,
      emailVerificationCodeId:
        record.emailVerificationCodeId ?? crypto.randomUUID(),
    })
  }

  async invalidateUnusedRequests(schoolEmail: string, invalidatedAt: number) {
    this.records = this.records.map((record) => {
      if (record.schoolEmail !== schoolEmail || record.invalidatedAt !== null) {
        return record
      }

      return {
        ...record,
        invalidatedAt,
      }
    })
  }

  async findStudentAccountBySchoolEmail(schoolEmail: string) {
    return (
      this.studentAccounts.find(
        (studentAccount) => studentAccount.schoolEmail === schoolEmail,
      ) ?? null
    )
  }

  async findStudentAccountById(studentAccountId: string) {
    return (
      this.studentAccounts.find(
        (studentAccount) =>
          studentAccount.studentAccountId === studentAccountId,
      ) ?? null
    )
  }

  async saveStudentAccount(record: StudentAccount) {
    this.studentAccounts.push(record)
  }

  async saveStudentSession(record: StudentSession) {
    this.studentSessions.push(record)
  }

  async findStudentSessionByTokenHash(sessionTokenHash: string) {
    return (
      this.studentSessions.find(
        (session) => session.sessionTokenHash === sessionTokenHash,
      ) ?? null
    )
  }

  async invalidateStudentSession(sessionTokenHash: string, invalidatedAt: number) {
    this.studentSessions = this.studentSessions.map((session) => {
      if (session.sessionTokenHash !== sessionTokenHash) {
        return session
      }

      return {
        ...session,
        invalidatedAt,
      }
    })
  }
}

type EmailVerificationCodeRow = {
  email_verification_code_id: string
  school_email: string
  code_hash: string
  requested_at: number
  invalidated_at: number | null
}

type StudentAccountRow = {
  student_account_id: string
  school_email: string
  display_name: string
}

type StudentSessionRow = {
  session_token_hash: string
  student_account_id: string
  created_at: number
  expires_at: number
  invalidated_at: number | null
}

export class D1VerificationCodeStore implements VerificationCodeStore {
  private readonly db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async findRequestsBySchoolEmail(schoolEmail: string) {
    const { results } = await this.db
      .prepare(
        `select email_verification_code_id, school_email, code_hash, requested_at, invalidated_at
         from email_verification_codes
         where school_email = ?
         order by requested_at asc`,
      )
      .bind(schoolEmail)
      .all<EmailVerificationCodeRow>()

    return results.map((row) => ({
      emailVerificationCodeId: row.email_verification_code_id,
      schoolEmail: row.school_email,
      codeHash: row.code_hash,
      requestedAt: row.requested_at,
      invalidatedAt: row.invalidated_at,
    }))
  }

  async saveRequest(record: VerificationCodeRequestRecord) {
    await this.db
      .prepare(
        `insert into email_verification_codes (
          email_verification_code_id,
          school_email,
          code_hash,
          requested_at,
          invalidated_at
        ) values (?, ?, ?, ?, ?)`,
      )
      .bind(
        record.emailVerificationCodeId ?? crypto.randomUUID(),
        record.schoolEmail,
        record.codeHash,
        record.requestedAt,
        record.invalidatedAt,
      )
      .run()
  }

  async invalidateUnusedRequests(schoolEmail: string, invalidatedAt: number) {
    await this.db
      .prepare(
        `update email_verification_codes
         set invalidated_at = ?
         where school_email = ? and invalidated_at is null`,
      )
      .bind(invalidatedAt, schoolEmail)
      .run()
  }

  async findStudentAccountBySchoolEmail(schoolEmail: string) {
    const row = await this.db
      .prepare(
        `select student_account_id, school_email, display_name
         from student_accounts
         where school_email = ?`,
      )
      .bind(schoolEmail)
      .first<StudentAccountRow>()

    return row ? mapStudentAccountRow(row) : null
  }

  async findStudentAccountById(studentAccountId: string) {
    const row = await this.db
      .prepare(
        `select student_account_id, school_email, display_name
         from student_accounts
         where student_account_id = ?`,
      )
      .bind(studentAccountId)
      .first<StudentAccountRow>()

    return row ? mapStudentAccountRow(row) : null
  }

  async saveStudentAccount(record: StudentAccount) {
    const now = new Date().toISOString()

    await this.db
      .prepare(
        `insert into student_accounts (
          student_account_id,
          school_email,
          display_name,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?)`,
      )
      .bind(
        record.studentAccountId,
        record.schoolEmail,
        record.displayName,
        now,
        now,
      )
      .run()
  }

  async saveStudentSession(record: StudentSession) {
    await this.db
      .prepare(
        `insert into student_sessions (
          student_session_id,
          session_token_hash,
          student_account_id,
          created_at,
          expires_at,
          invalidated_at
        ) values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        record.sessionTokenHash,
        record.studentAccountId,
        record.createdAt,
        record.expiresAt,
        record.invalidatedAt,
      )
      .run()
  }

  async findStudentSessionByTokenHash(sessionTokenHash: string) {
    const row = await this.db
      .prepare(
        `select session_token_hash, student_account_id, created_at, expires_at, invalidated_at
         from student_sessions
         where session_token_hash = ?`,
      )
      .bind(sessionTokenHash)
      .first<StudentSessionRow>()

    return row
      ? {
          sessionTokenHash: row.session_token_hash,
          studentAccountId: row.student_account_id,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          invalidatedAt: row.invalidated_at,
        }
      : null
  }

  async invalidateStudentSession(sessionTokenHash: string, invalidatedAt: number) {
    await this.db
      .prepare(
        `update student_sessions
         set invalidated_at = ?
         where session_token_hash = ? and invalidated_at is null`,
      )
      .bind(invalidatedAt, sessionTokenHash)
      .run()
  }
}

function mapStudentAccountRow(row: StudentAccountRow): StudentAccount {
  return {
    studentAccountId: row.student_account_id,
    schoolEmail: row.school_email,
    displayName: row.display_name,
  }
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
  const activeRequests = existingRequests.filter(
    (request) => request.invalidatedAt === null,
  )
  const latestRequest = activeRequests.at(-1)
  const requestsInsideHourlyWindow = existingRequests.filter(
    (request) => now - request.requestedAt < hourlySendWindowMs,
  )

  if (latestRequest && now - latestRequest.requestedAt < resendCooldownMs) {
    return { status: 'rate-limited' }
  }

  if (requestsInsideHourlyWindow.length >= hourlySendLimit) {
    return { status: 'rate-limited' }
  }

  await sendEmail({ schoolEmail, code })
  await store.invalidateUnusedRequests(schoolEmail, now)
  await store.saveRequest({
    schoolEmail,
    codeHash: await hashVerificationCode(code),
    requestedAt: now,
    invalidatedAt: null,
  })

  return { status: 'sent', schoolEmail }
}

export async function verifyCodeForExistingStudent({
  schoolEmailNumber,
  code,
  now,
  sessionToken,
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

  if (
    !latestRequest ||
    now - latestRequest.requestedAt > verificationCodeLifetimeMs ||
    latestRequest.codeHash !== (await hashToken(code))
  ) {
    return { status: 'invalid-verification' }
  }

  const studentAccount = await store.findStudentAccountBySchoolEmail(schoolEmail)

  if (!studentAccount) {
    return { status: 'new-student' }
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

export async function readStudentSession({
  sessionToken,
  now,
  store,
}: {
  sessionToken: string | null
  now: number
  store: VerificationCodeStore
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
  store: VerificationCodeStore
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
