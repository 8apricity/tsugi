const schoolEmailNumberPattern = /^[0-9]{8}$/
const resendCooldownMs = 60_000
const hourlySendWindowMs = 60 * 60_000
const hourlySendLimit = 5

export type VerificationCodeRequestRecord = {
  schoolEmail: string
  codeHash: string
  requestedAt: number
  invalidatedAt: number | null
}

export type VerificationCodeStore = {
  findRequestsBySchoolEmail(
    schoolEmail: string,
  ): Promise<VerificationCodeRequestRecord[]>
  saveRequest(record: VerificationCodeRequestRecord): Promise<void>
  invalidateUnusedRequests(schoolEmail: string, invalidatedAt: number): Promise<void>
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

export class InMemoryVerificationCodeStore implements VerificationCodeStore {
  private records: VerificationCodeRequestRecord[] = []

  async findRequestsBySchoolEmail(schoolEmail: string) {
    return this.records.filter((record) => record.schoolEmail === schoolEmail)
  }

  async saveRequest(record: VerificationCodeRequestRecord) {
    this.records.push(record)
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
}

type EmailVerificationCodeRow = {
  school_email: string
  code_hash: string
  requested_at: number
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
        `select school_email, code_hash, requested_at, invalidated_at
         from email_verification_codes
         where school_email = ?
         order by requested_at asc`,
      )
      .bind(schoolEmail)
      .all<EmailVerificationCodeRow>()

    return results.map((row) => ({
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
        crypto.randomUUID(),
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

async function hashVerificationCode(code: string) {
  const encodedCode = new TextEncoder().encode(code)
  const digest = await crypto.subtle.digest('SHA-256', encodedCode)

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
