const schoolEmailNumberPattern = /^[0-9]{8}$/
const resendCooldownMs = 60_000
const hourlySendWindowMs = 60 * 60_000
const hourlySendLimit = 5
const verificationCodeLifetimeMs = 10 * 60_000
const maxFailedVerificationAttempts = 5
const studentSessionLifetimeMs = 30 * 24 * 60 * 60_000
const setupSessionLifetimeMs = 30 * 60_000
const verificationCodeRateLimitExemptSchoolEmails = new Set([
  '110-00802117mkn@e.osakamanabi.jp',
])
const seededTestStudentAccountIds = new Set([
  'test-student-2026-2-3-humanities-1',
  'test-student-2026-2-3-humanities-2',
  'test-student-2026-2-3-humanities-3',
  'test-student-2026-2-3-science-1',
  'test-student-2026-2-3-science-2',
  'test-student-2026-2-3-science-3',
  'test-student-2026-2-4-humanities-1',
  'test-student-2026-2-4-humanities-2',
  'test-student-2025-2-3-humanities-1',
])

export type VerificationCodeRequestRecord = {
  emailVerificationCodeId?: string
  schoolEmail: string
  codeHash: string
  requestedAt: number
  invalidatedAt: number | null
  failedAttempts: number
}

export type StudentAccount = {
  studentAccountId: string
  schoolEmail: string
  displayName: string
  realName?: string
}

export type StudentSession = {
  sessionTokenHash: string
  studentAccountId: string
  createdAt: number
  expiresAt: number
  invalidatedAt: number | null
}

export type SetupSession = {
  setupSessionTokenHash: string
  schoolEmail: string
  createdAt: number
  expiresAt: number
  invalidatedAt: number | null
}

export type SchoolYearRecord = {
  schoolYear: number
  startsOn: string
  endsOn: string
  isCurrent: boolean
}

export type SchoolYearClassRecord = {
  classId: string
  schoolYear: number
  grade: number
  classNumber: number
}

export type TrackRecord = {
  trackId: string
  classId: string
  trackName: string
}

export type InitialSetupDraft = {
  displayName: string
  realName: string
  schoolYear: number
  grade: number
  classId: string
  trackId: string
}

export type StudentAffiliation = {
  studentAffiliationId: string
  studentAccountId: string
  schoolYear: number
  grade: number
  classId: string
  trackId: string
  selectedAt: number
  endedAt: number | null
}

type StandardTimetableEntryBase = {
  standardTimetableEntryId: string
  classId: string
  trackId: string | null
  lessonName: string
}

export type PeriodStandardTimetableEntry = StandardTimetableEntryBase & {
  referenceType: 'period'
  weekday: number
  periodNumber: number
}

export type FloatingStandardTimetableEntry = StandardTimetableEntryBase & {
  referenceType: 'floating'
  referenceLabel: string
}

export type StandardTimetableEntry =
  | PeriodStandardTimetableEntry
  | FloatingStandardTimetableEntry

export type CompleteInitialSetupTransactionInput = {
  setupSessionTokenHash: string
  schoolEmail: string
  studentAccountId: string
  studentAffiliationId: string
  displayName: string
  realName: string
  schoolYear: number
  grade: number
  classId: string
  trackId: string
  sessionTokenHash: string
  now: number
  expiresAt: number
}

export type VerificationCodeStore = {
  findRequestsBySchoolEmail(
    schoolEmail: string,
  ): Promise<VerificationCodeRequestRecord[]>
  saveRequest(record: VerificationCodeRequestRecord): Promise<void>
  invalidateUnusedRequests(schoolEmail: string, invalidatedAt: number): Promise<void>
  recordFailedVerificationAttempt(
    emailVerificationCodeId: string,
    failedAttempts: number,
    invalidatedAt: number | null,
  ): Promise<void>
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
  saveSetupSession(record: SetupSession): Promise<void>
  findSetupSessionByTokenHash(
    setupSessionTokenHash: string,
  ): Promise<SetupSession | null>
  invalidateSetupSessionsBySchoolEmail(
    schoolEmail: string,
    invalidatedAt: number,
  ): Promise<void>
  saveSchoolYear(record: SchoolYearRecord): Promise<void>
  saveSchoolYearClass(record: SchoolYearClassRecord): Promise<void>
  saveTrack(record: TrackRecord): Promise<void>
  findCurrentSchoolYear(): Promise<SchoolYearRecord | null>
  listClassesForSchoolYear(schoolYear: number): Promise<SchoolYearClassRecord[]>
  listTracksForSchoolYear(schoolYear: number): Promise<TrackRecord[]>
  findTrackWithClass(
    trackId: string,
    schoolYear: number,
  ): Promise<{ track: TrackRecord; schoolClass: SchoolYearClassRecord } | null>
  findSchoolYearClassById(
    classId: string,
    schoolYear: number,
  ): Promise<SchoolYearClassRecord | null>
  findTrackById(trackId: string): Promise<TrackRecord | null>
  findCurrentStudentAffiliation(
    studentAccountId: string,
    schoolYear: number,
  ): Promise<StudentAffiliation | null>
  saveStudentAffiliation(record: StudentAffiliation): Promise<void>
  saveStandardTimetableEntry(record: StandardTimetableEntry): Promise<void>
  listStandardTimetableEntriesForWeekday(
    classId: string,
    trackId: string,
    weekday: number,
  ): Promise<PeriodStandardTimetableEntry[]>
  findStandardTimetableEntryForFloatingReference(
    classId: string,
    trackId: string,
    referenceLabel: string,
  ): Promise<FloatingStandardTimetableEntry | null>
  saveInitialSetupDraft(
    setupSessionTokenHash: string,
    draft: InitialSetupDraft,
  ): Promise<void>
  completeInitialSetupTransaction(
    input: CompleteInitialSetupTransactionInput,
  ): Promise<StudentAccount>
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
  setupSessionToken: string
  store: VerificationCodeStore
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

export class InMemoryVerificationCodeStore implements VerificationCodeStore {
  private records: VerificationCodeRequestRecord[] = []
  private studentAccounts: StudentAccount[] = []
  private studentSessions: StudentSession[] = []
  private setupSessions: SetupSession[] = []
  private schoolYears: SchoolYearRecord[] = []
  private schoolYearClasses: SchoolYearClassRecord[] = []
  private tracks: TrackRecord[] = []
  private studentAffiliations: StudentAffiliation[] = []
  private standardTimetableEntries: StandardTimetableEntry[] = []
  private initialSetupDrafts = new Map<string, InitialSetupDraft>()
  private failNextAffiliationSave = false

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

  async recordFailedVerificationAttempt(
    emailVerificationCodeId: string,
    failedAttempts: number,
    invalidatedAt: number | null,
  ) {
    this.records = this.records.map((record) => {
      if (record.emailVerificationCodeId !== emailVerificationCodeId) {
        return record
      }

      return {
        ...record,
        failedAttempts,
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

  async saveSetupSession(record: SetupSession) {
    this.setupSessions.push(record)
  }

  async findSetupSessionByTokenHash(setupSessionTokenHash: string) {
    return (
      this.setupSessions.find(
        (session) => session.setupSessionTokenHash === setupSessionTokenHash,
      ) ?? null
    )
  }

  async invalidateSetupSessionsBySchoolEmail(
    schoolEmail: string,
    invalidatedAt: number,
  ) {
    this.setupSessions = this.setupSessions.map((session) => {
      if (session.schoolEmail !== schoolEmail || session.invalidatedAt !== null) {
        return session
      }

      return {
        ...session,
        invalidatedAt,
      }
    })
  }

  async saveSchoolYear(record: SchoolYearRecord) {
    this.schoolYears.push(record)
  }

  async saveSchoolYearClass(record: SchoolYearClassRecord) {
    this.schoolYearClasses.push(record)
  }

  async saveTrack(record: TrackRecord) {
    this.tracks.push(record)
  }

  async findCurrentSchoolYear() {
    return this.schoolYears.find((schoolYear) => schoolYear.isCurrent) ?? null
  }

  async listClassesForSchoolYear(schoolYear: number) {
    return this.schoolYearClasses.filter(
      (schoolClass) => schoolClass.schoolYear === schoolYear,
    )
  }

  async listTracksForSchoolYear(schoolYear: number) {
    const classIds = new Set(
      this.schoolYearClasses
        .filter((schoolClass) => schoolClass.schoolYear === schoolYear)
        .map((schoolClass) => schoolClass.classId),
    )

    return this.tracks.filter((track) => classIds.has(track.classId))
  }

  async findTrackWithClass(trackId: string, schoolYear: number) {
    const track = this.tracks.find((candidate) => candidate.trackId === trackId)

    if (!track) {
      return null
    }

    const schoolClass = this.schoolYearClasses.find(
      (candidate) =>
        candidate.classId === track.classId &&
        candidate.schoolYear === schoolYear,
    )

    return schoolClass ? { track, schoolClass } : null
  }

  async findSchoolYearClassById(classId: string, schoolYear: number) {
    return (
      this.schoolYearClasses.find(
        (schoolClass) =>
          schoolClass.classId === classId && schoolClass.schoolYear === schoolYear,
      ) ?? null
    )
  }

  async findTrackById(trackId: string) {
    return this.tracks.find((track) => track.trackId === trackId) ?? null
  }

  async saveStudentAffiliation(record: StudentAffiliation) {
    this.studentAffiliations.push(record)
  }

  async saveStandardTimetableEntry(record: StandardTimetableEntry) {
    this.standardTimetableEntries.push(record)
  }

  async saveInitialSetupDraft(
    setupSessionTokenHash: string,
    draft: InitialSetupDraft,
  ) {
    this.initialSetupDrafts.set(setupSessionTokenHash, draft)
  }

  failNextStudentAffiliationSaveForTest() {
    this.failNextAffiliationSave = true
  }

  async findCurrentStudentAffiliation(studentAccountId: string, schoolYear: number) {
    return (
      this.studentAffiliations.find(
        (affiliation) =>
          affiliation.studentAccountId === studentAccountId &&
          affiliation.schoolYear === schoolYear &&
          affiliation.endedAt === null,
      ) ?? null
    )
  }

  async listStandardTimetableEntriesForWeekday(
    classId: string,
    trackId: string,
    weekday: number,
  ) {
    return this.standardTimetableEntries.filter(
      (entry): entry is PeriodStandardTimetableEntry =>
        entry.referenceType === 'period' &&
        entry.classId === classId &&
        entry.weekday === weekday &&
        (entry.trackId === null || entry.trackId === trackId),
    )
  }

  async findStandardTimetableEntryForFloatingReference(
    classId: string,
    trackId: string,
    referenceLabel: string,
  ) {
    const entries = this.standardTimetableEntries.filter(
      (entry): entry is FloatingStandardTimetableEntry =>
        entry.referenceType === 'floating' &&
        entry.classId === classId &&
        (entry.trackId === null || entry.trackId === trackId) &&
        entry.referenceLabel === referenceLabel,
    )

    return entries.find((entry) => entry.trackId === trackId) ?? entries[0] ?? null
  }

  async completeInitialSetupTransaction(
    input: CompleteInitialSetupTransactionInput,
  ) {
    const existingStudentAccount = await this.findStudentAccountBySchoolEmail(
      input.schoolEmail,
    )
    const studentAccount =
      existingStudentAccount ??
      {
        studentAccountId: input.studentAccountId,
        schoolEmail: input.schoolEmail,
        displayName: input.displayName,
        realName: input.realName,
      }

    const previousStudentAccounts = [...this.studentAccounts]
    const previousStudentAffiliations = [...this.studentAffiliations]
    const previousStudentSessions = [...this.studentSessions]
    const previousSetupSessions = [...this.setupSessions]

    try {
      if (!existingStudentAccount) {
        this.studentAccounts.push(studentAccount)

        if (this.failNextAffiliationSave) {
          this.failNextAffiliationSave = false
          throw new Error('student affiliation save failed')
        }

        this.studentAffiliations.push({
          studentAffiliationId: input.studentAffiliationId,
          studentAccountId: studentAccount.studentAccountId,
          schoolYear: input.schoolYear,
          grade: input.grade,
          classId: input.classId,
          trackId: input.trackId,
          selectedAt: input.now,
          endedAt: null,
        })
      }

      this.studentSessions.push({
        sessionTokenHash: input.sessionTokenHash,
        studentAccountId: studentAccount.studentAccountId,
        createdAt: input.now,
        expiresAt: input.expiresAt,
        invalidatedAt: null,
      })
      this.setupSessions = this.setupSessions.map((session) =>
        session.setupSessionTokenHash === input.setupSessionTokenHash
          ? { ...session, invalidatedAt: input.now }
          : session,
      )

      return studentAccount
    } catch (error) {
      this.studentAccounts = previousStudentAccounts
      this.studentAffiliations = previousStudentAffiliations
      this.studentSessions = previousStudentSessions
      this.setupSessions = previousSetupSessions
      throw error
    }
  }
}

type EmailVerificationCodeRow = {
  email_verification_code_id: string
  school_email: string
  code_hash: string
  requested_at: number
  invalidated_at: number | null
  failed_attempts: number
}

type StudentAccountRow = {
  student_account_id: string
  school_email: string
  display_name: string
  real_name: string | null
}

type StudentSessionRow = {
  session_token_hash: string
  student_account_id: string
  created_at: number
  expires_at: number
  invalidated_at: number | null
}

type SetupSessionRow = {
  setup_session_token_hash: string
  school_email: string
  created_at: number
  expires_at: number
  invalidated_at: number | null
}

type SchoolYearRow = {
  school_year: number
  starts_on: string
  ends_on: string
  is_current: number
}

type SchoolYearClassRow = {
  class_id: string
  school_year: number
  grade: number
  class_number: number
}

type TrackRow = {
  track_id: string
  class_id: string
  track_name: string
}

type StudentAffiliationRow = {
  student_affiliation_id: string
  student_account_id: string
  school_year: number
  grade: number
  class_id: string
  track_id: string
  selected_at: number
  ended_at: number | null
}

type StandardTimetableEntryRow = {
  standard_timetable_entry_id: string
  class_id: string
  track_id: string | null
  reference_type: 'period' | 'floating'
  weekday: number | null
  period_number: number | null
  reference_label: string | null
  lesson_name: string
}

export class D1VerificationCodeStore implements VerificationCodeStore {
  private readonly db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async findRequestsBySchoolEmail(schoolEmail: string) {
    const { results } = await this.db
      .prepare(
        `select email_verification_code_id, school_email, code_hash, requested_at, invalidated_at, failed_attempts
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
      failedAttempts: row.failed_attempts,
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
          invalidated_at,
          failed_attempts
        ) values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.emailVerificationCodeId ?? crypto.randomUUID(),
        record.schoolEmail,
        record.codeHash,
        record.requestedAt,
        record.invalidatedAt,
        record.failedAttempts,
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

  async recordFailedVerificationAttempt(
    emailVerificationCodeId: string,
    failedAttempts: number,
    invalidatedAt: number | null,
  ) {
    await this.db
      .prepare(
        `update email_verification_codes
         set failed_attempts = ?,
             invalidated_at = ?
         where email_verification_code_id = ?`,
      )
      .bind(failedAttempts, invalidatedAt, emailVerificationCodeId)
      .run()
  }

  async findStudentAccountBySchoolEmail(schoolEmail: string) {
    const row = await this.db
      .prepare(
        `select student_account_id, school_email, display_name, real_name
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
        `select student_account_id, school_email, display_name, real_name
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
          real_name,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.studentAccountId,
        record.schoolEmail,
        record.displayName,
        record.realName ?? null,
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

  async saveSetupSession(record: SetupSession) {
    await this.db
      .prepare(
        `insert into student_account_setup_sessions (
          student_account_setup_session_id,
          setup_session_token_hash,
          school_email,
          created_at,
          expires_at,
          invalidated_at
        ) values (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        record.setupSessionTokenHash,
        record.schoolEmail,
        record.createdAt,
        record.expiresAt,
        record.invalidatedAt,
      )
      .run()
  }

  async findSetupSessionByTokenHash(setupSessionTokenHash: string) {
    const row = await this.db
      .prepare(
        `select setup_session_token_hash, school_email, created_at, expires_at, invalidated_at
         from student_account_setup_sessions
         where setup_session_token_hash = ?`,
      )
      .bind(setupSessionTokenHash)
      .first<SetupSessionRow>()

    return row
      ? {
          setupSessionTokenHash: row.setup_session_token_hash,
          schoolEmail: row.school_email,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          invalidatedAt: row.invalidated_at,
        }
      : null
  }

  async invalidateSetupSessionsBySchoolEmail(
    schoolEmail: string,
    invalidatedAt: number,
  ) {
    await this.db
      .prepare(
        `update student_account_setup_sessions
         set invalidated_at = ?
         where school_email = ? and invalidated_at is null`,
      )
      .bind(invalidatedAt, schoolEmail)
      .run()
  }

  async saveSchoolYear(record: SchoolYearRecord) {
    await this.db
      .prepare(
        `insert into school_years (school_year, starts_on, ends_on, is_current)
         values (?, ?, ?, ?)`,
      )
      .bind(
        record.schoolYear,
        record.startsOn,
        record.endsOn,
        record.isCurrent ? 1 : 0,
      )
      .run()
  }

  async saveSchoolYearClass(record: SchoolYearClassRecord) {
    await this.db
      .prepare(
        `insert into school_year_classes (class_id, school_year, grade, class_number)
         values (?, ?, ?, ?)`,
      )
      .bind(record.classId, record.schoolYear, record.grade, record.classNumber)
      .run()
  }

  async saveTrack(record: TrackRecord) {
    await this.db
      .prepare(
        `insert into tracks (track_id, class_id, track_name)
         values (?, ?, ?)`,
      )
      .bind(record.trackId, record.classId, record.trackName)
      .run()
  }

  async findCurrentSchoolYear() {
    const row = await this.db
      .prepare(
        `select school_year, starts_on, ends_on, is_current
         from school_years
         where is_current = 1
         order by school_year desc
         limit 1`,
      )
      .first<SchoolYearRow>()

    return row ? mapSchoolYearRow(row) : null
  }

  async listClassesForSchoolYear(schoolYear: number) {
    const { results } = await this.db
      .prepare(
        `select class_id, school_year, grade, class_number
         from school_year_classes
         where school_year = ?
         order by grade asc, class_number asc`,
      )
      .bind(schoolYear)
      .all<SchoolYearClassRow>()

    return results.map(mapSchoolYearClassRow)
  }

  async listTracksForSchoolYear(schoolYear: number) {
    const { results } = await this.db
      .prepare(
        `select tracks.track_id, tracks.class_id, tracks.track_name
         from tracks
         join school_year_classes on school_year_classes.class_id = tracks.class_id
         where school_year_classes.school_year = ?
         order by tracks.track_name asc`,
      )
      .bind(schoolYear)
      .all<TrackRow>()

    return results.map(mapTrackRow)
  }

  async findTrackWithClass(trackId: string, schoolYear: number) {
    const row = await this.db
      .prepare(
        `select
          tracks.track_id,
          tracks.class_id,
          tracks.track_name,
          school_year_classes.school_year,
          school_year_classes.grade,
          school_year_classes.class_number
         from tracks
         join school_year_classes on school_year_classes.class_id = tracks.class_id
         where tracks.track_id = ? and school_year_classes.school_year = ?`,
      )
      .bind(trackId, schoolYear)
      .first<
        TrackRow & {
          school_year: number
          grade: number
          class_number: number
        }
      >()

    return row
      ? {
          track: mapTrackRow(row),
          schoolClass: mapSchoolYearClassRow({
            class_id: row.class_id,
            school_year: row.school_year,
            grade: row.grade,
            class_number: row.class_number,
          }),
        }
      : null
  }

  async findSchoolYearClassById(classId: string, schoolYear: number) {
    const row = await this.db
      .prepare(
        `select class_id, school_year, grade, class_number
         from school_year_classes
         where class_id = ? and school_year = ?`,
      )
      .bind(classId, schoolYear)
      .first<SchoolYearClassRow>()

    return row ? mapSchoolYearClassRow(row) : null
  }

  async findTrackById(trackId: string) {
    const row = await this.db
      .prepare(
        `select track_id, class_id, track_name
         from tracks
         where track_id = ?`,
      )
      .bind(trackId)
      .first<TrackRow>()

    return row ? mapTrackRow(row) : null
  }

  async findCurrentStudentAffiliation(studentAccountId: string, schoolYear: number) {
    const row = await this.db
      .prepare(
        `select student_affiliation_id, student_account_id, school_year, grade, class_id, track_id, selected_at, ended_at
         from student_affiliations
         where student_account_id = ?
           and school_year = ?
           and ended_at is null
         limit 1`,
      )
      .bind(studentAccountId, schoolYear)
      .first<StudentAffiliationRow>()

    return row ? mapStudentAffiliationRow(row) : null
  }

  async saveStudentAffiliation(record: StudentAffiliation) {
    await this.db
      .prepare(
        `insert into student_affiliations (
          student_affiliation_id,
          student_account_id,
          school_year,
          grade,
          class_id,
          track_id,
          selected_at,
          ended_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.studentAffiliationId,
        record.studentAccountId,
        record.schoolYear,
        record.grade,
        record.classId,
        record.trackId,
        record.selectedAt,
        record.endedAt,
      )
      .run()
  }

  async saveStandardTimetableEntry(record: StandardTimetableEntry) {
    await this.db
      .prepare(
        `insert into standard_timetable_entries (
          standard_timetable_entry_id,
          class_id,
          track_id,
          reference_type,
          weekday,
          period_number,
          reference_label,
          lesson_name
        ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.standardTimetableEntryId,
        record.classId,
        record.trackId,
        record.referenceType,
        record.referenceType === 'period' ? record.weekday : null,
        record.referenceType === 'period' ? record.periodNumber : null,
        record.referenceType === 'floating' ? record.referenceLabel : null,
        record.lessonName,
      )
      .run()
  }

  async listStandardTimetableEntriesForWeekday(
    classId: string,
    trackId: string,
    weekday: number,
  ) {
    const { results } = await this.db
      .prepare(
        `select standard_timetable_entry_id, class_id, track_id, reference_type,
                weekday, period_number, reference_label, lesson_name
         from standard_timetable_entries
         where class_id = ?
           and reference_type = 'period'
           and weekday = ?
           and (track_id is null or track_id = ?)
         order by period_number asc, track_id is not null asc`,
      )
      .bind(classId, weekday, trackId)
      .all<StandardTimetableEntryRow>()

    return results.map(mapPeriodStandardTimetableEntryRow)
  }

  async findStandardTimetableEntryForFloatingReference(
    classId: string,
    trackId: string,
    referenceLabel: string,
  ) {
    const row = await this.db
      .prepare(
        `select standard_timetable_entry_id, class_id, track_id, reference_type,
                weekday, period_number, reference_label, lesson_name
         from standard_timetable_entries
         where class_id = ?
           and reference_type = 'floating'
           and reference_label = ?
           and (track_id is null or track_id = ?)
         order by track_id is not null desc
         limit 1`,
      )
      .bind(classId, referenceLabel, trackId)
      .first<StandardTimetableEntryRow>()

    return row ? mapFloatingStandardTimetableEntryRow(row) : null
  }

  async saveInitialSetupDraft(
    setupSessionTokenHash: string,
    draft: InitialSetupDraft,
  ) {
    await this.db
      .prepare(
        `update student_account_setup_sessions
         set display_name = ?,
             real_name = ?,
             school_year = ?,
             grade = ?,
             class_id = ?,
             track_id = ?
         where setup_session_token_hash = ?`,
      )
      .bind(
        draft.displayName,
        draft.realName,
        draft.schoolYear,
        draft.grade,
        draft.classId,
        draft.trackId,
        setupSessionTokenHash,
      )
      .run()
  }

  async completeInitialSetupTransaction(
    input: CompleteInitialSetupTransactionInput,
  ) {
    const existingStudentAccount = await this.findStudentAccountBySchoolEmail(
      input.schoolEmail,
    )

    if (existingStudentAccount) {
      await this.db.batch([
        this.db
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
            input.sessionTokenHash,
            existingStudentAccount.studentAccountId,
            input.now,
            input.expiresAt,
            null,
          ),
        this.db
          .prepare(
            `update student_account_setup_sessions
             set invalidated_at = ?
             where setup_session_token_hash = ? and invalidated_at is null`,
          )
          .bind(input.now, input.setupSessionTokenHash),
      ])

      return existingStudentAccount
    }

    const createdAt = new Date(input.now).toISOString()
    const studentAccount: StudentAccount = {
      studentAccountId: input.studentAccountId,
      schoolEmail: input.schoolEmail,
      displayName: input.displayName,
      realName: input.realName,
    }

    try {
      await this.db.batch([
        this.db
          .prepare(
            `insert into student_accounts (
              student_account_id,
              school_email,
              display_name,
              real_name,
              created_at,
              updated_at
            ) values (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            input.studentAccountId,
            input.schoolEmail,
            input.displayName,
            input.realName,
            createdAt,
            createdAt,
          ),
        this.db
          .prepare(
            `insert into student_affiliations (
              student_affiliation_id,
              student_account_id,
              school_year,
              grade,
              class_id,
              track_id,
              selected_at,
              ended_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            input.studentAffiliationId,
            input.studentAccountId,
            input.schoolYear,
            input.grade,
            input.classId,
            input.trackId,
            input.now,
            null,
          ),
        this.db
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
            input.sessionTokenHash,
            input.studentAccountId,
            input.now,
            input.expiresAt,
            null,
          ),
        this.db
          .prepare(
            `update student_account_setup_sessions
             set invalidated_at = ?
             where setup_session_token_hash = ? and invalidated_at is null`,
          )
          .bind(input.now, input.setupSessionTokenHash),
      ])

      return studentAccount
    } catch (error) {
      const recoveredStudentAccount = await this.findStudentAccountBySchoolEmail(
        input.schoolEmail,
      )

      if (!recoveredStudentAccount) {
        throw error
      }

      await this.db.batch([
        this.db
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
            input.sessionTokenHash,
            recoveredStudentAccount.studentAccountId,
            input.now,
            input.expiresAt,
            null,
          ),
        this.db
          .prepare(
            `update student_account_setup_sessions
             set invalidated_at = ?
             where setup_session_token_hash = ? and invalidated_at is null`,
          )
          .bind(input.now, input.setupSessionTokenHash),
      ])

      return recoveredStudentAccount
    }
  }
}

function mapStudentAccountRow(row: StudentAccountRow): StudentAccount {
  return {
    studentAccountId: row.student_account_id,
    schoolEmail: row.school_email,
    displayName: row.display_name,
    realName: row.real_name ?? undefined,
  }
}

function mapSchoolYearRow(row: SchoolYearRow): SchoolYearRecord {
  return {
    schoolYear: row.school_year,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isCurrent: row.is_current === 1,
  }
}

function mapSchoolYearClassRow(row: SchoolYearClassRow): SchoolYearClassRecord {
  return {
    classId: row.class_id,
    schoolYear: row.school_year,
    grade: row.grade,
    classNumber: row.class_number,
  }
}

function mapTrackRow(row: TrackRow): TrackRecord {
  return {
    trackId: row.track_id,
    classId: row.class_id,
    trackName: row.track_name,
  }
}

function mapStudentAffiliationRow(row: StudentAffiliationRow): StudentAffiliation {
  return {
    studentAffiliationId: row.student_affiliation_id,
    studentAccountId: row.student_account_id,
    schoolYear: row.school_year,
    grade: row.grade,
    classId: row.class_id,
    trackId: row.track_id,
    selectedAt: row.selected_at,
    endedAt: row.ended_at,
  }
}

function mapPeriodStandardTimetableEntryRow(
  row: StandardTimetableEntryRow,
): PeriodStandardTimetableEntry {
  if (
    row.reference_type !== 'period' ||
    row.weekday === null ||
    row.period_number === null
  ) {
    throw new Error('invalid period Standard Timetable entry')
  }

  return {
    standardTimetableEntryId: row.standard_timetable_entry_id,
    classId: row.class_id,
    trackId: row.track_id,
    referenceType: 'period',
    weekday: row.weekday,
    periodNumber: row.period_number,
    lessonName: row.lesson_name,
  }
}

function mapFloatingStandardTimetableEntryRow(
  row: StandardTimetableEntryRow,
): FloatingStandardTimetableEntry {
  if (row.reference_type !== 'floating' || row.reference_label === null) {
    throw new Error('invalid floating Standard Timetable entry')
  }

  return {
    standardTimetableEntryId: row.standard_timetable_entry_id,
    classId: row.class_id,
    trackId: row.track_id,
    referenceType: 'floating',
    referenceLabel: row.reference_label,
    lessonName: row.lesson_name,
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
  store: VerificationCodeStore
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
  store,
}: {
  setupSessionToken: string | null
  now: number
  store: VerificationCodeStore
}): Promise<InitialSetupOptionsResult> {
  const setupSession = await readSetupSession({ setupSessionToken, now, store })

  if (setupSession.status === 'invalid') {
    return { status: 'invalid-setup-session' }
  }

  const currentSchoolYear = await store.findCurrentSchoolYear()

  if (!currentSchoolYear) {
    return { status: 'setup-unavailable' }
  }

  const classes = await store.listClassesForSchoolYear(
    currentSchoolYear.schoolYear,
  )
  const tracks = await store.listTracksForSchoolYear(currentSchoolYear.schoolYear)

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
  store,
}: {
  setupSessionToken: string | null
  displayName: unknown
  realName: unknown
  trackId: unknown
  confirmed: unknown
  now: number
  store: VerificationCodeStore
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

  const setupSession = await readSetupSession({ setupSessionToken, now, store })

  if (setupSession.status === 'invalid') {
    return { status: 'invalid-setup-session' }
  }

  const currentSchoolYear = await store.findCurrentSchoolYear()

  if (!currentSchoolYear) {
    return { status: 'setup-unavailable' }
  }

  const resolvedTrack = await store.findTrackWithClass(
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

  await store.saveInitialSetupDraft(
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
  store,
}: {
  setupSessionToken: string | null
  draft: InitialSetupDraft
  now: number
  sessionToken: string
  store: VerificationCodeStore
}): Promise<CompleteInitialSetupResult> {
  if (!setupSessionToken) {
    return { status: 'invalid-setup-session' }
  }

  const setupSessionTokenHash = await hashToken(setupSessionToken)
  const setupSession = await store.findSetupSessionByTokenHash(
    setupSessionTokenHash,
  )

  if (!setupSession || setupSession.invalidatedAt !== null || setupSession.expiresAt <= now) {
    return { status: 'invalid-setup-session' }
  }

  const expiresAt = now + studentSessionLifetimeMs
  const studentAccount = await store.completeInitialSetupTransaction({
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
  store: VerificationCodeStore
}): Promise<CreateTestLoginSessionResult> {
  if (
    typeof studentAccountId !== 'string' ||
    !seededTestStudentAccountIds.has(studentAccountId)
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
