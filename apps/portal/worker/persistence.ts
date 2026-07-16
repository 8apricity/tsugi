// Domain-local seams share storage implementations without sharing caller interfaces.
import type { StudentOperationalContextStore } from './studentOperationalContext'
import { timetableReplacementsEqual } from '../shared/timetableProjection'
import type {
  TimetableReplacement as ProjectionTimetableReplacement,
} from '../shared/timetableProjection'
import { normalizeLessonName } from '../shared/lessonNames'
import type { TaskHistorySnapshot } from '../shared/taskEditHistory'
import type { NoteHistorySnapshot } from '../shared/noteEditHistory'
import { targetScopeValue } from './targetScopeBoundary'
import {
  studentAffiliationIncludesTargetScope,
  targetScopesEqual,
  type TargetScope,
  type TargetScopeType,
} from './targetScopePolicy'

export type { TargetScope, TargetScopeType } from './targetScopePolicy'

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
  registeredLessonNameId: string
  lessonName: string
}

export type RegisteredLessonName = {
  registeredLessonNameId: string
  fullLessonName: string
  shortLessonName: string
  normalizedFullLessonName: string
}

export type PeriodStandardTimetableEntry = StandardTimetableEntryBase & {
  referenceType: 'period'
  weekday: number
  periodNumber: number
}

export type FloatingStandardTimetableEntry = StandardTimetableEntryBase & {
  referenceType: 'floating'
  referenceLabel: string
  floatingLessonReferenceLabelId: string
}

export type StandardTimetableEntry =
  | PeriodStandardTimetableEntry
  | FloatingStandardTimetableEntry

export type PeriodStandardTimetableEntrySeed = Omit<
  PeriodStandardTimetableEntry,
  'lessonName'
>

export type FloatingStandardTimetableEntrySeed = Omit<
  FloatingStandardTimetableEntry,
  'lessonName'
>

export type StandardTimetableEntrySeed =
  | PeriodStandardTimetableEntrySeed
  | FloatingStandardTimetableEntrySeed

export type FloatingLessonReferenceLabel = {
  floatingLessonReferenceLabelId: string
  schoolYear: number
  grade: number
  referenceLabel: string
  displayOrder: number
}

export type TimetableChangeReplacement = ProjectionTimetableReplacement

export type TimetableLayerKey = {
  targetScopeType: TargetScopeType
  changeDate: string
  periodNumber: number
}

export type ActiveTimetableChange = Omit<TimetableLayerKey, 'targetScopeType'> & {
  sourceId: string
  sharedInformationItemId: string
  latestChangeId: string
  targetScope: TargetScope
  replacement: TimetableChangeReplacement
  changedByStudentAccountId: string
  changedAt: number
}

type DirectTimetableChangeOperationBase = Omit<ActiveTimetableChange, 'replacement'>

export type DirectTimetableChangeOperation = DirectTimetableChangeOperationBase &
  (
    | {
        changeKind: 'add'
        replacement: TimetableChangeReplacement
        expectedLatestChangeId?: never
      }
    | {
        changeKind: 'update'
        replacement: TimetableChangeReplacement
        expectedLatestChangeId: string
      }
    | {
        changeKind: 'remove'
        replacement?: never
        expectedLatestChangeId: string
      }
  )

export type TaskLessonName = {
  lessonName: string
  registeredLessonNameId?: string
}

export type ActiveTask = {
  sourceId: string
  sharedInformationItemId: string
  latestChangeId: string
  targetScope: TargetScope
  title: string
  dueDate: string | null
  relatedLessonName: TaskLessonName | null
  changedByStudentAccountId: string
  changedAt: number
  createdAt: number
}

type DirectTaskOperationBase = {
  sourceId: string
  sharedInformationItemId: string
  latestChangeId: string
  targetScope: TargetScope
  changedByStudentAccountId: string
  changedAt: number
}

type DirectTaskSnapshot = Pick<
  ActiveTask,
  'title' | 'dueDate' | 'relatedLessonName'
>

export type DirectTaskAddOperation = DirectTaskOperationBase &
  DirectTaskSnapshot & {
    changeKind: 'add'
    createdAt: number
    expectedLatestChangeId?: never
  }

export type DirectTaskOperation =
  | DirectTaskAddOperation
  | (DirectTaskOperationBase &
      DirectTaskSnapshot & {
        changeKind: 'update'
        expectedLatestChangeId: string
      })
  | (DirectTaskOperationBase & {
      changeKind: 'remove'
      expectedLatestChangeId: string
    })

export type ActiveNote = {
  sourceId: string
  sharedInformationItemId: string
  latestChangeId: string
  targetScope: TargetScope
  schoolDate: string | null
  periodNumber: number | null
  relatedTaskItemId?: string
  body: string
  changedByStudentAccountId: string
  changedAt: number
  createdAt: number
}

type DirectNoteOperationBase = Pick<
  ActiveNote,
  | 'sourceId' | 'sharedInformationItemId' | 'latestChangeId' | 'targetScope'
  | 'changedByStudentAccountId' | 'changedAt'
>

export type DirectNoteOperation =
  | (DirectNoteOperationBase & Pick<ActiveNote, 'schoolDate' | 'body' | 'createdAt'> & {
      changeKind: 'add'
      periodNumber?: number | null
      relatedTaskItemId?: string
      expectedLatestChangeId?: never
    })
  | (DirectNoteOperationBase & Pick<ActiveNote, 'body'> & {
      changeKind: 'update'
      expectedLatestChangeId: string
    })
  | (DirectNoteOperationBase & {
      changeKind: 'remove'
      expectedLatestChangeId: string
      removalReason: 'student' | 'task_cascade'
    })

export type DirectChangeOperation =
  | ({ kind: 'timetable_change' } & DirectTimetableChangeOperation)
  | ({ kind: 'task' } & DirectTaskOperation)
  | ({ kind: 'note' } & DirectNoteOperation)

export type HistoricalTimetableChangeReplacement =
  | Exclude<TimetableChangeReplacement, { type: 'floating_lesson_reference' }>
  | {
      type: 'floating_lesson_reference'
      floatingLessonReferenceLabelId: string
      referenceLabel: string
    }

export type HistoricalTimetableChange = Omit<TimetableLayerKey, 'targetScopeType'> & {
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changeKind: 'add' | 'update' | 'remove'
  sourceType: 'direct' | 'proposal'
  targetScope: TargetScope
  primaryActorDisplayName: string
  changedAt: number
  precedingChangeId: string | null
  replacement: HistoricalTimetableChangeReplacement | null
}

export type HistoricalTaskSnapshot = TaskHistorySnapshot

type HistoricalTaskChangeBase = {
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changeKind: 'add' | 'update' | 'remove'
  targetScope: TargetScope
  changedAt: number
  precedingChangeId: string | null
  snapshot: HistoricalTaskSnapshot | null
}

export type HistoricalTaskChange = HistoricalTaskChangeBase & (
  | { sourceType: 'direct'; primaryActorDisplayName: string }
  | { sourceType: 'proposal'; primaryActorDisplayName?: never }
)

export type HistoricalNoteChange = {
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changeKind: 'add' | 'update' | 'remove'
  sourceType: 'direct'
  targetScope: TargetScope
  primaryActorDisplayName: string
  changedAt: number
  precedingChangeId: string | null
  snapshot: NoteHistorySnapshot | null
  removalReason: 'student' | 'task_cascade' | null
}

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

export type StudentAccountAccessStore = {
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
}

export type StudentAffiliationSetupStore = {
  findCurrentSchoolYear(): Promise<SchoolYearRecord | null>
  listClassesForSchoolYear(schoolYear: number): Promise<SchoolYearClassRecord[]>
  listTracksForSchoolYear(schoolYear: number): Promise<TrackRecord[]>
  findTrackWithClass(
    trackId: string,
    schoolYear: number,
  ): Promise<{ track: TrackRecord; schoolClass: SchoolYearClassRecord } | null>
  saveInitialSetupDraft(
    setupSessionTokenHash: string,
    draft: InitialSetupDraft,
  ): Promise<void>
  completeInitialSetupTransaction(
    input: CompleteInitialSetupTransactionInput,
  ): Promise<StudentAccount>
}

export type DailyPlanStore = StudentOperationalContextStore & {
  listClassesForSchoolYear(schoolYear: number): Promise<SchoolYearClassRecord[]>
  listTracksForSchoolYear(schoolYear: number): Promise<TrackRecord[]>
  findSchoolYearClassById(
    classId: string,
    schoolYear: number,
  ): Promise<SchoolYearClassRecord | null>
  findTrackById(trackId: string): Promise<TrackRecord | null>
  listStandardTimetableEntriesForWeekday(
    classId: string,
    trackId: string,
    weekday: number,
  ): Promise<PeriodStandardTimetableEntry[]>
  findStandardTimetableEntryForPeriodReference(
    classId: string,
    trackId: string,
    weekday: number,
    periodNumber: number,
  ): Promise<PeriodStandardTimetableEntry | null>
  findStandardTimetableEntryForFloatingReference(
    classId: string,
    trackId: string,
    referenceLabel: string,
  ): Promise<FloatingStandardTimetableEntry | null>
  findStandardTimetableEntryForFloatingReferenceLabelId(
    classId: string,
    trackId: string,
    floatingLessonReferenceLabelId: string,
  ): Promise<FloatingStandardTimetableEntry | null>
  listActiveTimetableChangesForStudent(
    affiliation: StudentAffiliation,
    start: string,
    end: string,
  ): Promise<ActiveTimetableChange[]>
  listActiveTasksForStudent(
    affiliation: StudentAffiliation,
    schoolDate: string,
  ): Promise<ActiveTask[]>
  listActiveTasksForTargetScope(
    targetScope: Exclude<TargetScope, { type: 'student' }>,
    schoolDate: string,
  ): Promise<ActiveTask[]>
  listActiveNotesForStudent(
    affiliation: StudentAffiliation,
    schoolDate: string,
  ): Promise<ActiveNote[]>
  listActiveNotesForTargetScope(
    targetScope: Exclude<TargetScope, { type: 'student' }>,
    schoolDate: string,
  ): Promise<ActiveNote[]>
}

export type DirectChangeStore = StudentOperationalContextStore & {
  commitDirectChanges(
    changes: DirectChangeOperation[],
  ): Promise<
    | { status: 'applied'; changes: DirectChangeOperation[] }
    | { status: 'invalid-change' }
    | { status: 'conflict'; conflictingSourceIds: string[] }
    | { status: 'idempotency-conflict'; conflictingSourceIds: string[] }
  >
  commitDirectTimetableChanges(
    changes: DirectTimetableChangeOperation[],
  ): Promise<
    | { status: 'applied'; changes: DirectTimetableChangeOperation[] }
    | { status: 'invalid-change' }
    | { status: 'conflict'; conflictingSourceIds: string[] }
    | { status: 'idempotency-conflict'; conflictingSourceIds: string[] }
  >
  listFloatingLessonReferenceLabels(
    schoolYear: number,
    grade: number,
  ): Promise<FloatingLessonReferenceLabel[]>
  findFloatingLessonReferenceLabel(
    floatingLessonReferenceLabelId: string,
    schoolYear: number,
    grade: number,
  ): Promise<FloatingLessonReferenceLabel | null>
  listStandardTimetableEntriesForWeekday(
    classId: string,
    trackId: string,
    weekday: number,
  ): Promise<PeriodStandardTimetableEntry[]>
  findStandardTimetableEntryForFloatingReferenceLabelId(
    classId: string,
    trackId: string,
    floatingLessonReferenceLabelId: string,
  ): Promise<FloatingStandardTimetableEntry | null>
  findRegisteredLessonName(
    registeredLessonNameId: string,
  ): Promise<RegisteredLessonName | null>
  listRegisteredLessonNames(): Promise<RegisteredLessonName[]>
}

export type DirectTimetableChangeStore = DirectChangeStore

export type TimetableChangeHistoryStore = {
  listTimetableChangeHistory(input: {
    targetScope: TargetScope
    changeDate: string
    periodNumber: number
  }): Promise<HistoricalTimetableChange[]>
  listTimetableChangeItemHistoryByChangeId(
    sharedInformationChangeId: string,
  ): Promise<HistoricalTimetableChange[]>
}

export type TaskEditHistoryStore = {
  listTaskEditHistory(
    sharedInformationItemId: string,
  ): Promise<HistoricalTaskChange[]>
}

export type NoteEditHistoryStore = {
  listNoteEditHistory(
    sharedInformationItemId: string,
  ): Promise<HistoricalNoteChange[]>
}

export type PersistenceSeedStore = {
  saveStudentAccount(record: StudentAccount): Promise<void>
  saveSchoolYear(record: SchoolYearRecord): Promise<void>
  saveSchoolYearClass(record: SchoolYearClassRecord): Promise<void>
  saveTrack(record: TrackRecord): Promise<void>
  saveStudentAffiliation(record: StudentAffiliation): Promise<void>
  saveRegisteredLessonName(record: RegisteredLessonName): Promise<void>
  saveStandardTimetableEntry(record: StandardTimetableEntrySeed): Promise<void>
}

export type PersistenceAdapters = {
  studentAccount: StudentAccountAccessStore
  studentAffiliation: StudentAffiliationSetupStore
  dailyPlan: DailyPlanStore
  directChange: DirectChangeStore
  directTimetableChange: DirectTimetableChangeStore
  timetableChangeHistory: TimetableChangeHistoryStore
  taskEditHistory: TaskEditHistoryStore
  noteEditHistory: NoteEditHistoryStore
  seed: PersistenceSeedStore
}

export class InMemoryPersistenceAdapters
  implements
    StudentAccountAccessStore,
    StudentAffiliationSetupStore,
    DailyPlanStore,
    DirectChangeStore,
    TimetableChangeHistoryStore,
    TaskEditHistoryStore,
    NoteEditHistoryStore
{
  private records: VerificationCodeRequestRecord[] = []
  private studentAccounts: StudentAccount[] = []
  private studentSessions: StudentSession[] = []
  private setupSessions: SetupSession[] = []
  private schoolYears: SchoolYearRecord[] = []
  private schoolYearClasses: SchoolYearClassRecord[] = []
  private tracks: TrackRecord[] = []
  private studentAffiliations: StudentAffiliation[] = []
  private registeredLessonNames: RegisteredLessonName[] = []
  private standardTimetableEntries: StandardTimetableEntrySeed[] = []
  private activeTimetableChanges: ActiveTimetableChange[] = []
  private activeTasks: ActiveTask[] = []
  private activeNotes: ActiveNote[] = []
  private directTimetableChangeOperations = new Map<
    string,
    DirectTimetableChangeOperation
  >()
  private directTaskOperations = new Map<
    string,
    Extract<DirectChangeOperation, { kind: 'task' }>
  >()
  private directNoteOperations = new Map<
    string,
    Extract<DirectChangeOperation, { kind: 'note' }>
  >()
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

  async saveRegisteredLessonName(record: RegisteredLessonName) {
    const normalizedNameConflict = this.registeredLessonNames.find(
      (candidate) =>
        candidate.registeredLessonNameId !== record.registeredLessonNameId &&
        candidate.normalizedFullLessonName === record.normalizedFullLessonName,
    )
    if (normalizedNameConflict) {
      throw new Error('normalized Full Lesson Name must be unique')
    }
    const existingIndex = this.registeredLessonNames.findIndex(
      (candidate) =>
        candidate.registeredLessonNameId === record.registeredLessonNameId,
    )
    if (existingIndex === -1) {
      this.registeredLessonNames.push(record)
    } else {
      this.registeredLessonNames[existingIndex] = record
    }
  }

  async findRegisteredLessonName(registeredLessonNameId: string) {
    return this.registeredLessonNames.find(
      (candidate) =>
        candidate.registeredLessonNameId === registeredLessonNameId,
    ) ?? null
  }

  async listRegisteredLessonNames() {
    return [...this.registeredLessonNames]
  }

  async saveStandardTimetableEntry(record: StandardTimetableEntrySeed) {
    this.requireRegisteredLessonName(record.registeredLessonNameId)
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
      (entry): entry is PeriodStandardTimetableEntrySeed =>
        entry.referenceType === 'period' &&
        entry.classId === classId &&
        entry.weekday === weekday &&
        (entry.trackId === null || entry.trackId === trackId),
    ).map((entry) => this.resolveStandardTimetableEntry(entry))
  }

  async findStandardTimetableEntryForPeriodReference(
    classId: string,
    trackId: string,
    weekday: number,
    periodNumber: number,
  ) {
    const entries = await this.listStandardTimetableEntriesForWeekday(
      classId,
      trackId,
      weekday,
    )
    const matching = entries.filter((entry) => entry.periodNumber === periodNumber)

    return matching.find((entry) => entry.trackId === trackId) ?? matching[0] ?? null
  }

  async findStandardTimetableEntryForFloatingReference(
    classId: string,
    trackId: string,
    referenceLabel: string,
  ) {
    const entries = this.standardTimetableEntries.filter(
      (entry): entry is FloatingStandardTimetableEntrySeed =>
        entry.referenceType === 'floating' &&
        entry.classId === classId &&
        (entry.trackId === null || entry.trackId === trackId) &&
        entry.referenceLabel === referenceLabel,
    )
    const selected =
      entries.find((entry) => entry.trackId === trackId) ?? entries[0] ?? null
    return selected ? this.resolveStandardTimetableEntry(selected) : null
  }

  async findStandardTimetableEntryForFloatingReferenceLabelId(
    classId: string,
    trackId: string,
    floatingLessonReferenceLabelId: string,
  ) {
    const label = (await this.listFloatingLessonReferenceLabels(
      Number(floatingLessonReferenceLabelId.split(':')[0]),
      Number(floatingLessonReferenceLabelId.split(':')[1]),
    )).find(
      (candidate) =>
        candidate.floatingLessonReferenceLabelId === floatingLessonReferenceLabelId,
    )
    if (!label) return null
    const entries = this.standardTimetableEntries.filter(
      (entry): entry is FloatingStandardTimetableEntrySeed =>
        entry.referenceType === 'floating' &&
        entry.classId === classId &&
        (entry.trackId === null || entry.trackId === trackId) &&
        (entry.floatingLessonReferenceLabelId === floatingLessonReferenceLabelId ||
          entry.referenceLabel === label.referenceLabel),
    )

    const selected =
      entries.find((entry) => entry.trackId === trackId) ?? entries[0] ?? null
    return selected ? this.resolveStandardTimetableEntry(selected) : null
  }

  private resolveStandardTimetableEntry(
    record: PeriodStandardTimetableEntrySeed,
  ): PeriodStandardTimetableEntry
  private resolveStandardTimetableEntry(
    record: FloatingStandardTimetableEntrySeed,
  ): FloatingStandardTimetableEntry
  private resolveStandardTimetableEntry(
    record: StandardTimetableEntrySeed,
  ): StandardTimetableEntry {
    const registeredLessonName = this.requireRegisteredLessonName(
      record.registeredLessonNameId,
    )
    return { ...record, lessonName: registeredLessonName.shortLessonName }
  }

  private requireRegisteredLessonName(registeredLessonNameId: string) {
    const registeredLessonName = this.registeredLessonNames.find(
      (candidate) =>
        candidate.registeredLessonNameId === registeredLessonNameId,
    )
    if (!registeredLessonName) {
      throw new Error('Standard Timetable requires a Registered Lesson Name')
    }
    return registeredLessonName
  }

  async listActiveTimetableChangesForStudent(
    affiliation: StudentAffiliation,
    start: string,
    end: string,
  ) {
    return this.activeTimetableChanges.filter((change) => {
      if (change.changeDate < start || change.changeDate > end) return false
      return studentAffiliationIncludesTargetScope(
        affiliation,
        change.targetScope,
      )
    }).map((change) => ({
      ...change,
      replacement: change.replacement.type === 'lesson_name'
        ? this.resolveLessonNameReplacement(change.replacement)
        : change.replacement,
    }))
  }

  async listActiveTasksForStudent(
    affiliation: StudentAffiliation,
    schoolDate: string,
  ) {
    return this.activeTasks
      .filter((task) =>
        (task.dueDate === null || task.dueDate === schoolDate) &&
        studentAffiliationIncludesTargetScope(affiliation, task.targetScope),
      )
      .map((task) => ({
        ...task,
        relatedLessonName: task.relatedLessonName?.registeredLessonNameId
          ? {
              ...task.relatedLessonName,
              lessonName: this.requireRegisteredLessonName(
                task.relatedLessonName.registeredLessonNameId,
              ).shortLessonName,
            }
          : task.relatedLessonName,
      }))
      .sort(compareActiveTasks)
  }

  async listActiveTasksForTargetScope(
    targetScope: Exclude<TargetScope, { type: 'student' }>,
    schoolDate: string,
  ) {
    return this.activeTasks
      .filter((task) =>
        (task.dueDate === null || task.dueDate === schoolDate) &&
        targetScopesEqual(task.targetScope, targetScope),
      )
      .map((task) => ({
        ...task,
        relatedLessonName: task.relatedLessonName?.registeredLessonNameId
          ? {
              ...task.relatedLessonName,
              lessonName: this.requireRegisteredLessonName(
                task.relatedLessonName.registeredLessonNameId,
              ).shortLessonName,
            }
          : task.relatedLessonName,
      }))
      .sort(compareActiveTasks)
  }

  async listActiveNotesForStudent(
    affiliation: StudentAffiliation,
    schoolDate: string,
  ) {
    return this.activeNotes
      .filter((note) =>
        (note.relatedTaskItemId !== undefined ||
          note.schoolDate === null || note.schoolDate === schoolDate) &&
        studentAffiliationIncludesTargetScope(affiliation, note.targetScope),
      )
      .sort(compareActiveNotes)
  }

  async listActiveNotesForTargetScope(
    targetScope: Exclude<TargetScope, { type: 'student' }>,
    schoolDate: string,
  ) {
    return this.activeNotes
      .filter((note) =>
        (note.relatedTaskItemId !== undefined ||
          note.schoolDate === null || note.schoolDate === schoolDate) &&
        targetScopesEqual(note.targetScope, targetScope),
      )
      .sort(compareActiveNotes)
  }

  async commitDirectTimetableChanges(changes: DirectTimetableChangeOperation[]) {
    const result = await this.commitDirectChanges(
      changes.map((change) => ({ ...change, kind: 'timetable_change' as const })),
    )
    if (result.status !== 'applied') return result
    return {
      status: 'applied' as const,
      changes: result.changes.map((change) => {
        const { kind, ...operation } = change
        void kind
        return operation as DirectTimetableChangeOperation
      }),
    }
  }

  async commitDirectChanges(changes: DirectChangeOperation[]) {
    const pending: DirectChangeOperation[] = []
    const idempotencyConflicts: string[] = []

    for (const change of changes) {
      const existing = this.directTimetableChangeOperations.get(change.sourceId) ??
        this.directTaskOperations.get(change.sourceId) ??
        this.directNoteOperations.get(change.sourceId)

      if (existing) {
        if (!sameDirectChangeOperationPayload(existing, change)) {
          idempotencyConflicts.push(change.sourceId)
        }
        continue
      }

      pending.push(change)
    }
    if (idempotencyConflicts.length > 0) {
      return {
        status: 'idempotency-conflict' as const,
        conflictingSourceIds: idempotencyConflicts,
      }
    }

    const pendingTimetableChanges = pending.filter(
      (change): change is Extract<DirectChangeOperation, { kind: 'timetable_change' }> =>
        change.kind === 'timetable_change',
    )
    const pendingTaskChanges = pending.filter(
      (change): change is Extract<DirectChangeOperation, { kind: 'task' }> =>
        change.kind === 'task',
    )
    const pendingNoteChanges = pending.filter(
      (change): change is Extract<DirectChangeOperation, { kind: 'note' }> =>
        change.kind === 'note',
    )
    const pendingTaskAdds = pendingTaskChanges.filter(
      (change) => change.changeKind === 'add',
    )
    const pendingTaskRemovals = new Set(
      pendingTaskChanges
        .filter((change) => change.changeKind === 'remove')
        .map((change) => change.sharedInformationItemId),
    )
    const invalidTaskNote = pendingNoteChanges.some((change) => {
      if (change.changeKind !== 'add') {
        const activeNote = this.activeNotes.find((note) =>
          note.sharedInformationItemId === change.sharedInformationItemId)
        return !!activeNote?.relatedTaskItemId &&
          pendingTaskRemovals.has(activeNote.relatedTaskItemId)
      }
      if (!change.relatedTaskItemId) return false
      if (pendingTaskRemovals.has(change.relatedTaskItemId)) return true
      const task = pendingTaskAdds.find(
        (candidate) =>
          candidate.sharedInformationItemId === change.relatedTaskItemId,
      ) ?? this.activeTasks.find(
        (candidate) =>
          candidate.sharedInformationItemId === change.relatedTaskItemId,
      )
      return !task || !targetScopesEqual(task.targetScope, change.targetScope)
    })
    if (invalidTaskNote) return { status: 'invalid-change' as const }
    const conflictingSourceIds = [
      ...pendingTimetableChanges
      .filter((change) => {
        const active = change.changeKind !== 'add'
        ? this.activeTimetableChanges.find(
            (candidate) => candidate.sharedInformationItemId === change.sharedInformationItemId,
          )
        : this.activeTimetableChanges.find(
            (candidate) => sameTimetableChangeSlot(candidate, change),
          )
        return change.changeKind === 'add'
          ? !!active
          : !active ||
            active.latestChangeId !== change.expectedLatestChangeId ||
            !sameTimetableChangeSlot(active, change)
      })
      .map((change) => change.sourceId),
      ...pendingTaskChanges
        .filter((change) => {
          if (change.changeKind === 'add') return false
          const active = this.activeTasks.find(
            (candidate) =>
              candidate.sharedInformationItemId ===
              change.sharedInformationItemId,
          )
          return !active ||
            active.latestChangeId !== change.expectedLatestChangeId ||
            !targetScopesEqual(active.targetScope, change.targetScope)
        })
        .map((change) => change.sourceId),
      ...pendingNoteChanges
        .filter((change) => {
          if (change.changeKind === 'add') return false
          const active = this.activeNotes.find(
            (candidate) =>
              candidate.sharedInformationItemId ===
              change.sharedInformationItemId,
          )
          return !active ||
            active.latestChangeId !== change.expectedLatestChangeId ||
            !targetScopesEqual(active.targetScope, change.targetScope)
        })
        .map((change) => change.sourceId),
    ]
    if (conflictingSourceIds.length > 0) {
      return { status: 'conflict' as const, conflictingSourceIds }
    }

    const cascadeRemovals: Array<Extract<
      DirectChangeOperation,
      { kind: 'note'; changeKind: 'remove' }
    >> = pendingTaskChanges
      .filter((change) => change.changeKind === 'remove')
      .flatMap((taskRemoval) =>
        this.activeNotes
          .filter((note) =>
            note.relatedTaskItemId === taskRemoval.sharedInformationItemId)
          .map((note) => {
            const sourceId = `${taskRemoval.sourceId}:task-cascade:${note.sharedInformationItemId}`
            return {
              kind: 'note' as const,
              changeKind: 'remove' as const,
              sourceId,
              sharedInformationItemId: note.sharedInformationItemId,
              latestChangeId: `${sourceId}:change`,
              expectedLatestChangeId: note.latestChangeId,
              targetScope: note.targetScope,
              changedByStudentAccountId: taskRemoval.changedByStudentAccountId,
              changedAt: taskRemoval.changedAt,
              removalReason: 'task_cascade' as const,
            }
          }),
      )

    for (const change of [...cascadeRemovals, ...pending]) {
      if (change.kind === 'note') {
        this.directNoteOperations.set(change.sourceId, change)
        if (change.changeKind === 'add') {
          this.activeNotes.push({ ...change, periodNumber: change.periodNumber ?? null })
        } else if (change.changeKind === 'update') {
          const index = this.activeNotes.findIndex(
            (candidate) =>
              candidate.sharedInformationItemId ===
              change.sharedInformationItemId,
          )
          const previous = this.activeNotes[index]
          this.activeNotes[index] = {
            ...previous,
            sourceId: change.sourceId,
            latestChangeId: change.latestChangeId,
            body: change.body,
            changedByStudentAccountId: change.changedByStudentAccountId,
            changedAt: change.changedAt,
          }
        } else {
          this.activeNotes = this.activeNotes.filter(
            (candidate) =>
              candidate.sharedInformationItemId !==
              change.sharedInformationItemId,
          )
        }
        continue
      }
      if (change.kind === 'task') {
        this.directTaskOperations.set(change.sourceId, change)
        if (change.changeKind === 'add') {
          this.activeTasks.push(change)
        } else if (change.changeKind === 'update') {
          const index = this.activeTasks.findIndex(
            (candidate) =>
              candidate.sharedInformationItemId ===
              change.sharedInformationItemId,
          )
          const previous = this.activeTasks[index]
          this.activeTasks[index] = {
            ...previous,
            sourceId: change.sourceId,
            latestChangeId: change.latestChangeId,
            title: change.title,
            dueDate: change.dueDate,
            relatedLessonName: change.relatedLessonName,
            changedByStudentAccountId: change.changedByStudentAccountId,
            changedAt: change.changedAt,
          }
        } else {
          this.activeTasks = this.activeTasks.filter(
            (candidate) =>
              candidate.sharedInformationItemId !==
              change.sharedInformationItemId,
          )
        }
        continue
      }
      this.directTimetableChangeOperations.set(change.sourceId, change)
      if (change.changeKind === 'add') {
        this.activeTimetableChanges.push(change)
      } else if (change.changeKind === 'update') {
        const index = this.activeTimetableChanges.findIndex(
          (candidate) => candidate.sharedInformationItemId === change.sharedInformationItemId,
        )
        this.activeTimetableChanges[index] = change
      } else {
        this.activeTimetableChanges = this.activeTimetableChanges.filter(
          (candidate) => candidate.sharedInformationItemId !== change.sharedInformationItemId,
        )
      }
    }
    return {
      status: 'applied' as const,
      changes,
    }
  }

  async listTimetableChangeHistory(input: {
    targetScope: TargetScope
    changeDate: string
    periodNumber: number
  }) {
    return [...this.directTimetableChangeOperations.values()]
      .filter((change) =>
        targetScopesEqual(change.targetScope, input.targetScope) &&
        change.changeDate === input.changeDate &&
        change.periodNumber === input.periodNumber)
      .map((change) => this.mapHistoricalTimetableChange(change))
  }

  async listTimetableChangeItemHistoryByChangeId(
    sharedInformationChangeId: string,
  ) {
    const selected = [...this.directTimetableChangeOperations.values()].find(
      (change) => change.latestChangeId === sharedInformationChangeId,
    )
    if (!selected) return []
    return [...this.directTimetableChangeOperations.values()]
      .filter((change) =>
        change.sharedInformationItemId === selected.sharedInformationItemId)
      .map((change) => this.mapHistoricalTimetableChange(change))
  }

  async listTaskEditHistory(sharedInformationItemId: string) {
    return [...this.directTaskOperations.values()]
      .filter((change) =>
        change.sharedInformationItemId === sharedInformationItemId)
      .map((change): HistoricalTaskChange => ({
        sharedInformationChangeId: change.latestChangeId,
        sharedInformationItemId: change.sharedInformationItemId,
        changeKind: change.changeKind,
        sourceType: 'direct',
        targetScope: change.targetScope,
        primaryActorDisplayName: this.studentAccounts.find(
          (student) =>
            student.studentAccountId === change.changedByStudentAccountId,
        )?.displayName ?? '',
        changedAt: change.changedAt,
        precedingChangeId: change.changeKind === 'add'
          ? null
          : change.expectedLatestChangeId,
        snapshot: change.changeKind === 'remove'
          ? null
          : {
              title: change.title,
              dueDate: change.dueDate,
              relatedLessonName: change.relatedLessonName
                ? change.relatedLessonName.registeredLessonNameId
                  ? this.requireRegisteredLessonName(
                      change.relatedLessonName.registeredLessonNameId,
                    ).shortLessonName
                  : change.relatedLessonName.lessonName
                : null,
            },
      }))
  }

  async listNoteEditHistory(sharedInformationItemId: string) {
    return [...this.directNoteOperations.values()]
      .filter((change) =>
        change.sharedInformationItemId === sharedInformationItemId)
      .map((change): HistoricalNoteChange => ({
        sharedInformationChangeId: change.latestChangeId,
        sharedInformationItemId: change.sharedInformationItemId,
        changeKind: change.changeKind,
        sourceType: 'direct',
        targetScope: change.targetScope,
        primaryActorDisplayName: this.studentAccounts.find(
          (student) =>
            student.studentAccountId === change.changedByStudentAccountId,
        )?.displayName ?? '',
        changedAt: change.changedAt,
        precedingChangeId: change.changeKind === 'add'
          ? null
          : change.expectedLatestChangeId,
        snapshot: change.changeKind === 'remove'
          ? null
          : { body: change.body },
        removalReason: change.changeKind === 'remove'
          ? change.removalReason
          : null,
      }))
  }

  private mapHistoricalTimetableChange(
    change: DirectTimetableChangeOperation,
  ): HistoricalTimetableChange {
    let replacement: HistoricalTimetableChangeReplacement | null = null
    if (change.changeKind !== 'remove') {
      if (change.replacement.type === 'floating_lesson_reference') {
        const floatingReferenceId =
          change.replacement.floatingLessonReferenceLabelId
        replacement = {
          ...change.replacement,
          referenceLabel: this.standardTimetableEntries.find(
            (entry): entry is FloatingStandardTimetableEntry =>
              entry.referenceType === 'floating' &&
              (entry.floatingLessonReferenceLabelId === floatingReferenceId ||
               entry.referenceLabel === floatingReferenceId
                 .split(':').slice(2).join(':')),
          )?.referenceLabel ?? floatingReferenceId,
        }
      } else {
        replacement = change.replacement.type === 'lesson_name'
          ? this.resolveLessonNameReplacement(change.replacement)
          : change.replacement
      }
    }
    return {
      sharedInformationChangeId: change.latestChangeId,
      sharedInformationItemId: change.sharedInformationItemId,
      changeKind: change.changeKind,
      sourceType: 'direct',
      targetScope: change.targetScope,
      changeDate: change.changeDate,
      periodNumber: change.periodNumber,
      primaryActorDisplayName: this.studentAccounts.find(
        (student) => student.studentAccountId === change.changedByStudentAccountId,
      )?.displayName ?? '',
      changedAt: change.changedAt,
      precedingChangeId: change.changeKind === 'add'
        ? null
        : change.expectedLatestChangeId,
      replacement,
    }
  }

  private resolveLessonNameReplacement(
    replacement: Extract<TimetableChangeReplacement, { type: 'lesson_name' }>,
  ) {
    if (!replacement.registeredLessonNameId) return replacement
    return {
      ...replacement,
      lessonName: this.requireRegisteredLessonName(
        replacement.registeredLessonNameId,
      ).shortLessonName,
    }
  }

  async listFloatingLessonReferenceLabels(schoolYear: number, grade: number) {
    const classIds = new Set(
      this.schoolYearClasses
        .filter((schoolClass) => schoolClass.schoolYear === schoolYear && schoolClass.grade === grade)
        .map((schoolClass) => schoolClass.classId),
    )
    return [...new Set(
      this.standardTimetableEntries
        .filter((entry): entry is FloatingStandardTimetableEntry =>
          entry.referenceType === 'floating' && classIds.has(entry.classId),
        )
        .map((entry) => entry.referenceLabel),
    )].map((referenceLabel, index) => ({
      floatingLessonReferenceLabelId: `${schoolYear}:${grade}:${referenceLabel}`,
      schoolYear,
      grade,
      referenceLabel,
      displayOrder: index,
    }))
  }

  async findFloatingLessonReferenceLabel(
    floatingLessonReferenceLabelId: string,
    schoolYear: number,
    grade: number,
  ) {
    return (
      (await this.listFloatingLessonReferenceLabels(schoolYear, grade)).find(
        (label) =>
          label.floatingLessonReferenceLabelId === floatingLessonReferenceLabelId,
      ) ?? null
    )
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
  floating_lesson_reference_label_id: string | null
  registered_lesson_name_id: string
  lesson_name: string
}

const standardTimetableEntryReadSql = `
  select entry.standard_timetable_entry_id, entry.class_id, entry.track_id,
         entry.reference_type, entry.weekday, entry.period_number,
         entry.reference_label, entry.floating_lesson_reference_label_id,
         entry.registered_lesson_name_id,
         lesson.short_lesson_name as lesson_name
  from standard_timetable_entries entry
  join registered_lesson_names lesson
    on lesson.registered_lesson_name_id = entry.registered_lesson_name_id
`

type ActiveTimetableChangeRow = {
  change_kind?: 'add' | 'update' | 'remove'
  expected_latest_change_id?: string | null
  source_id: string
  shared_information_change_id: string
  shared_information_item_id: string
  school_year: number
  scope_type: TargetScopeType
  grade: number | null
  class_id: string | null
  track_id: string | null
  student_account_id: string | null
  change_date: string
  period_number: number
  replacement_type: 'lesson_name' | 'period_reference' | 'floating_lesson_reference' | 'cancelled'
  replacement_lesson_name: string | null
  registered_lesson_name_id: string | null
  reference_weekday: number | null
  reference_period_number: number | null
  reference_label: string | null
  floating_lesson_reference_label_id: string | null
  changed_by_student_account_id: string
  changed_at: string
}

type ActiveTaskRow = {
  source_id: string
  shared_information_change_id: string
  shared_information_item_id: string
  school_year: number
  scope_type: TargetScopeType
  grade: number | null
  class_id: string | null
  track_id: string | null
  student_account_id: string | null
  title: string
  due_date: string | null
  related_lesson_name: string | null
  registered_related_lesson_name_id: string | null
  changed_by_student_account_id: string
  changed_at: string
  created_at: string
}

type ActiveNoteRow = {
  source_id: string
  shared_information_change_id: string
  shared_information_item_id: string
  school_year: number
  scope_type: TargetScopeType
  grade: number | null
  class_id: string | null
  track_id: string | null
  student_account_id: string | null
  body: string
  related_school_date: string | null
  related_period_number: number | null
  related_task_item_id: string | null
  changed_by_student_account_id: string
  changed_at: string
  created_at: string
}

type StoredDirectNoteOperationRow = Omit<ActiveNoteRow, 'body'> & {
  change_kind: 'add' | 'update' | 'remove'
  preceding_change_id: string | null
  body: string | null
  removal_reason: 'student' | 'task_cascade' | null
}

type StoredDirectTaskOperationRow = Omit<
  ActiveTaskRow,
  'title' | 'due_date' | 'related_lesson_name' |
  'registered_related_lesson_name_id'
> & {
  change_kind: 'add' | 'update' | 'remove'
  preceding_change_id: string | null
  title: string | null
  due_date: string | null
  related_lesson_name: string | null
  registered_related_lesson_name_id: string | null
}

type HistoricalTimetableChangeRow = {
  shared_information_change_id: string
  shared_information_item_id: string
  change_kind: 'add' | 'update' | 'remove'
  source_type: 'direct' | 'proposal'
  school_year: number
  scope_type: TargetScopeType
  grade: number | null
  class_id: string | null
  track_id: string | null
  student_account_id: string | null
  change_date: string
  period_number: number
  replacement_type: TimetableChangeReplacement['type'] | null
  replacement_lesson_name: string | null
  registered_lesson_name_id: string | null
  reference_weekday: number | null
  reference_period_number: number | null
  reference_label: string | null
  floating_lesson_reference_label_id: string | null
  display_name: string
  changed_at: string
  preceding_change_id: string | null
}

type HistoricalTaskChangeRow = {
  shared_information_change_id: string
  shared_information_item_id: string
  change_kind: 'add' | 'update' | 'remove'
  source_type: 'direct' | 'proposal'
  school_year: number
  scope_type: TargetScopeType
  grade: number | null
  class_id: string | null
  track_id: string | null
  student_account_id: string | null
  display_name: string
  changed_at: string
  preceding_change_id: string | null
  title: string | null
  due_date: string | null
  related_lesson_name: string | null
}

type HistoricalNoteChangeRow = {
  shared_information_change_id: string
  shared_information_item_id: string
  change_kind: 'add' | 'update' | 'remove'
  source_type: 'direct'
  school_year: number
  scope_type: TargetScopeType
  grade: number | null
  class_id: string | null
  track_id: string | null
  student_account_id: string | null
  display_name: string
  changed_at: string
  preceding_change_id: string | null
  body: string | null
  removal_reason: 'student' | 'task_cascade' | null
}

type LegacyCustomLessonNameRow = {
  timetable_change_snapshot_id: string
  replacement_lesson_name: string
}

const lessonNameNormalizationBackfills = new WeakMap<
  D1Database,
  Promise<void>
>()

export function backfillLegacyCustomLessonNameNormalization(db: D1Database) {
  const existing = lessonNameNormalizationBackfills.get(db)
  if (existing) return existing

  const backfill = (async () => {
    while (true) {
      const { results } = await db.prepare(
        `select timetable_change_snapshot_id, replacement_lesson_name
         from timetable_change_snapshots
         where replacement_type = 'lesson_name'
           and registered_lesson_name_id is null
           and normalized_custom_lesson_name is null
         limit 100`,
      ).all<LegacyCustomLessonNameRow>()
      if (results.length === 0) return

      await db.batch(results.map((row) => db.prepare(
        `update timetable_change_snapshots
         set normalized_custom_lesson_name = ?
         where timetable_change_snapshot_id = ?
           and normalized_custom_lesson_name is null`,
      ).bind(
        normalizeLessonName(row.replacement_lesson_name),
        row.timetable_change_snapshot_id,
      )))
    }
  })()
  lessonNameNormalizationBackfills.set(db, backfill)
  backfill.catch(() => lessonNameNormalizationBackfills.delete(db))
  return backfill
}

export class D1PersistenceAdapters
  implements
    StudentAccountAccessStore,
    StudentAffiliationSetupStore,
    DailyPlanStore,
    DirectTimetableChangeStore,
    TimetableChangeHistoryStore,
    TaskEditHistoryStore,
    NoteEditHistoryStore
{
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

  async saveRegisteredLessonName(record: RegisteredLessonName) {
    await this.db
      .prepare(
        `insert into registered_lesson_names (
          registered_lesson_name_id,
          full_lesson_name,
          short_lesson_name,
          normalized_full_lesson_name
        ) values (?, ?, ?, ?)
        on conflict(registered_lesson_name_id) do update set
          full_lesson_name = excluded.full_lesson_name,
          short_lesson_name = excluded.short_lesson_name,
          normalized_full_lesson_name = excluded.normalized_full_lesson_name`,
      )
      .bind(
        record.registeredLessonNameId,
        record.fullLessonName,
        record.shortLessonName,
        record.normalizedFullLessonName,
      )
      .run()
  }

  async findRegisteredLessonName(registeredLessonNameId: string) {
    const row = await this.db
      .prepare(
        `select registered_lesson_name_id, full_lesson_name,
                short_lesson_name, normalized_full_lesson_name
         from registered_lesson_names
         where registered_lesson_name_id = ?`,
      )
      .bind(registeredLessonNameId)
      .first<{
        registered_lesson_name_id: string
        full_lesson_name: string
        short_lesson_name: string
        normalized_full_lesson_name: string
      }>()
    return row ? mapRegisteredLessonNameRow(row) : null
  }

  async listRegisteredLessonNames() {
    const { results } = await this.db
      .prepare(
        `select registered_lesson_name_id, full_lesson_name,
                short_lesson_name, normalized_full_lesson_name
         from registered_lesson_names
         order by rowid`,
      )
      .all<{
        registered_lesson_name_id: string
        full_lesson_name: string
        short_lesson_name: string
        normalized_full_lesson_name: string
      }>()
    return results.map(mapRegisteredLessonNameRow)
  }

  async saveStandardTimetableEntry(record: StandardTimetableEntrySeed) {
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
          floating_lesson_reference_label_id,
          registered_lesson_name_id
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.standardTimetableEntryId,
        record.classId,
        record.trackId,
        record.referenceType,
        record.referenceType === 'period' ? record.weekday : null,
        record.referenceType === 'period' ? record.periodNumber : null,
        record.referenceType === 'floating' ? record.referenceLabel : null,
        record.referenceType === 'floating'
          ? record.floatingLessonReferenceLabelId
          : null,
        record.registeredLessonNameId,
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
        `${standardTimetableEntryReadSql}
         where entry.class_id = ?
           and entry.reference_type = 'period'
           and entry.weekday = ?
           and (entry.track_id is null or entry.track_id = ?)
         order by entry.period_number asc, entry.track_id is not null asc`,
      )
      .bind(classId, weekday, trackId)
      .all<StandardTimetableEntryRow>()

    return results.map(mapPeriodStandardTimetableEntryRow)
  }

  async findStandardTimetableEntryForPeriodReference(
    classId: string,
    trackId: string,
    weekday: number,
    periodNumber: number,
  ) {
    const row = await this.db
      .prepare(
        `${standardTimetableEntryReadSql}
         where entry.class_id = ? and entry.reference_type = 'period'
           and entry.weekday = ? and entry.period_number = ?
           and (entry.track_id is null or entry.track_id = ?)
         order by entry.track_id is not null desc
         limit 1`,
      )
      .bind(classId, weekday, periodNumber, trackId)
      .first<StandardTimetableEntryRow>()

    return row ? mapPeriodStandardTimetableEntryRow(row) : null
  }

  async findStandardTimetableEntryForFloatingReference(
    classId: string,
    trackId: string,
    referenceLabel: string,
  ) {
    const row = await this.db
      .prepare(
        `${standardTimetableEntryReadSql}
         where entry.class_id = ? and entry.reference_type = 'floating'
           and entry.reference_label = ?
           and (entry.track_id is null or entry.track_id = ?)
         order by entry.track_id is not null desc limit 1`,
      )
      .bind(classId, referenceLabel, trackId)
      .first<StandardTimetableEntryRow>()
    return row ? mapFloatingStandardTimetableEntryRow(row) : null
  }

  async findStandardTimetableEntryForFloatingReferenceLabelId(
    classId: string,
    trackId: string,
    floatingLessonReferenceLabelId: string,
  ) {
    const row = await this.db
      .prepare(
        `${standardTimetableEntryReadSql}
         where entry.class_id = ?
           and entry.reference_type = 'floating'
           and entry.floating_lesson_reference_label_id = ?
           and (entry.track_id is null or entry.track_id = ?)
         order by entry.track_id is not null desc
         limit 1`,
      )
      .bind(classId, floatingLessonReferenceLabelId, trackId)
      .first<StandardTimetableEntryRow>()

    return row ? mapFloatingStandardTimetableEntryRow(row) : null
  }

  async listActiveTimetableChangesForStudent(
    affiliation: StudentAffiliation,
    start: string,
    end: string,
  ) {
    const { results } = await this.db
      .prepare(
        `select c.source_id, c.shared_information_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id, p.student_account_id,
                t.change_date, t.period_number, t.replacement_type,
                t.registered_lesson_name_id,
                coalesce(registered_lesson.short_lesson_name,
                         t.replacement_lesson_name) as replacement_lesson_name,
                t.reference_weekday,
                t.reference_period_number, t.reference_label,
                t.floating_lesson_reference_label_id,
                c.changed_by_student_account_id, c.changed_at
         from shared_information_items i
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join timetable_change_snapshots t
           on t.timetable_change_snapshot_id = i.current_timetable_change_snapshot_id
         left join registered_lesson_names registered_lesson
           on registered_lesson.registered_lesson_name_id =
             t.registered_lesson_name_id
          join shared_information_changes c
            on c.shared_information_change_id = i.latest_change_id
          where i.kind = 'timetable_change' and i.removed_at is null
            and (select count(*) from target_scope_parts scope_part_count
                 where scope_part_count.target_scope_id = s.target_scope_id) = 1
            and s.school_year = ? and t.change_date between ? and ?
           and ((p.scope_type = 'grade' and p.grade = ?)
             or (p.scope_type = 'class' and p.class_id = ?)
             or (p.scope_type = 'track' and p.track_id = ?)
             or (p.scope_type = 'student' and p.student_account_id = ?))`,
      )
      .bind(
        affiliation.schoolYear,
        start,
        end,
        affiliation.grade,
        affiliation.classId,
        affiliation.trackId,
        affiliation.studentAccountId,
      )
      .all<ActiveTimetableChangeRow>()

    return results.map(mapActiveTimetableChangeRow)
  }

  async listActiveTasksForStudent(
    affiliation: StudentAffiliation,
    schoolDate: string,
  ) {
    const { results } = await this.db
      .prepare(
        `select c.source_id, c.shared_information_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, task.title, task.due_date,
                task.registered_related_lesson_name_id,
                coalesce(registered_lesson.short_lesson_name,
                         task.related_lesson_name) as related_lesson_name,
                c.changed_by_student_account_id, c.changed_at, i.created_at
         from shared_information_items i
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join task_snapshots task
           on task.task_snapshot_id = i.current_task_snapshot_id
         left join registered_lesson_names registered_lesson
           on registered_lesson.registered_lesson_name_id =
              task.registered_related_lesson_name_id
         join shared_information_changes c
           on c.shared_information_change_id = i.latest_change_id
         where i.kind = 'task' and i.removed_at is null
           and (task.due_date is null or task.due_date = ?)
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1
           and s.school_year = ?
           and ((p.scope_type = 'grade' and p.grade = ?)
             or (p.scope_type = 'class' and p.class_id = ?)
             or (p.scope_type = 'track' and p.track_id = ?)
             or (p.scope_type = 'student' and p.student_account_id = ?))
         order by (task.due_date is null) asc, i.created_at desc,
                  i.shared_information_item_id desc`,
      )
      .bind(
        schoolDate,
        affiliation.schoolYear,
        affiliation.grade,
        affiliation.classId,
        affiliation.trackId,
        affiliation.studentAccountId,
      )
      .all<ActiveTaskRow>()
    return results.map(mapActiveTaskRow)
  }

  async listActiveTasksForTargetScope(
    targetScope: Exclude<TargetScope, { type: 'student' }>,
    schoolDate: string,
  ) {
    const { scopeColumn, scopeValue } = exactTargetScopeQuery(targetScope)
    const { results } = await this.db
      .prepare(
        `select c.source_id, c.shared_information_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, task.title, task.due_date,
                task.registered_related_lesson_name_id,
                coalesce(registered_lesson.short_lesson_name,
                         task.related_lesson_name) as related_lesson_name,
                c.changed_by_student_account_id, c.changed_at, i.created_at
         from shared_information_items i
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join task_snapshots task
           on task.task_snapshot_id = i.current_task_snapshot_id
         left join registered_lesson_names registered_lesson
           on registered_lesson.registered_lesson_name_id =
              task.registered_related_lesson_name_id
         join shared_information_changes c
           on c.shared_information_change_id = i.latest_change_id
         where i.kind = 'task' and i.removed_at is null
           and (task.due_date is null or task.due_date = ?)
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1
           and s.school_year = ? and p.scope_type = ? and ${scopeColumn} = ?
         order by (task.due_date is null) asc, i.created_at desc,
                  i.shared_information_item_id desc`,
      )
      .bind(
        schoolDate,
        targetScope.schoolYear,
        targetScope.type,
        scopeValue,
      )
      .all<ActiveTaskRow>()
    return results.map(mapActiveTaskRow)
  }

  async listActiveNotesForStudent(
    affiliation: StudentAffiliation,
    schoolDate: string,
  ) {
    const { results } = await this.db
      .prepare(
        `select latest.source_id, latest.shared_information_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, note.body, note.related_school_date,
                note.related_period_number, note.related_task_item_id,
                latest.changed_by_student_account_id, latest.changed_at,
                i.created_at
         from shared_information_items i
         join shared_information_changes latest
           on latest.shared_information_change_id = i.latest_change_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join note_snapshots note
           on note.note_snapshot_id = i.current_note_snapshot_id
         where i.kind = 'note' and i.removed_at is null
           and (note.related_context_type in ('none', 'task')
             or (note.related_context_type in ('school_date', 'daily_lesson')
               and note.related_school_date = ?))
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1
           and s.school_year = ?
           and ((p.scope_type = 'grade' and p.grade = ?)
             or (p.scope_type = 'class' and p.class_id = ?)
             or (p.scope_type = 'track' and p.track_id = ?)
             or (p.scope_type = 'student' and p.student_account_id = ?))
         order by case when note.related_context_type = 'school_date'
                   then 0 else 1 end,
                  i.created_at desc, i.shared_information_item_id desc`,
      )
      .bind(
        schoolDate,
        affiliation.schoolYear,
        affiliation.grade,
        affiliation.classId,
        affiliation.trackId,
        affiliation.studentAccountId,
      )
      .all<ActiveNoteRow>()
    return results.map(mapActiveNoteRow)
  }

  async listActiveNotesForTargetScope(
    targetScope: Exclude<TargetScope, { type: 'student' }>,
    schoolDate: string,
  ) {
    const { scopeColumn, scopeValue } = exactTargetScopeQuery(targetScope)
    const { results } = await this.db
      .prepare(
        `select latest.source_id, latest.shared_information_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, note.body, note.related_school_date,
                note.related_period_number, note.related_task_item_id,
                latest.changed_by_student_account_id, latest.changed_at,
                i.created_at
         from shared_information_items i
         join shared_information_changes latest
           on latest.shared_information_change_id = i.latest_change_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join note_snapshots note
           on note.note_snapshot_id = i.current_note_snapshot_id
         where i.kind = 'note' and i.removed_at is null
           and (note.related_context_type in ('none', 'task')
             or (note.related_context_type in ('school_date', 'daily_lesson')
               and note.related_school_date = ?))
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1
           and s.school_year = ? and p.scope_type = ? and ${scopeColumn} = ?
         order by case when note.related_context_type = 'school_date'
                   then 0 else 1 end,
                  i.created_at desc, i.shared_information_item_id desc`,
      )
      .bind(
        schoolDate,
        targetScope.schoolYear,
        targetScope.type,
        scopeValue,
      )
      .all<ActiveNoteRow>()
    return results.map(mapActiveNoteRow)
  }

  async commitDirectChanges(changes: DirectChangeOperation[]) {
    const timetableChanges = changes.filter(
      (change): change is Extract<DirectChangeOperation, { kind: 'timetable_change' }> =>
        change.kind === 'timetable_change',
    )
    const taskChanges = changes.filter(
      (change): change is Extract<DirectChangeOperation, { kind: 'task' }> =>
        change.kind === 'task',
    )
    const noteChanges = changes.filter(
      (change): change is Extract<DirectChangeOperation, { kind: 'note' }> =>
        change.kind === 'note',
    )
    if (taskChanges.length > 0 || noteChanges.length > 0) {
      return this.commitMixedDirectChanges(
        timetableChanges,
        taskChanges,
        noteChanges,
      )
    }
    const result = await this.commitDirectTimetableChanges(timetableChanges)
    return result.status === 'applied'
      ? {
          status: 'applied' as const,
          changes: result.changes.map((change) => ({
            ...change,
            kind: 'timetable_change' as const,
          })),
        }
      : result
  }

  private async commitMixedDirectChanges(
    timetableChanges: Array<Extract<DirectChangeOperation, { kind: 'timetable_change' }>>,
    taskChanges: Array<Extract<DirectChangeOperation, { kind: 'task' }>>,
    noteChanges: Array<Extract<DirectChangeOperation, { kind: 'note' }>>,
  ) {
    const changes: DirectChangeOperation[] = [
      ...timetableChanges,
      ...taskChanges,
      ...noteChanges,
    ]
    const [storedTimetable, storedTasks, storedNotes] = await Promise.all([
      this.findDirectChangesBySourceIds(changes.map((change) => change.sourceId)),
      this.findDirectTaskOperationsBySourceIds(changes.map((change) => change.sourceId)),
      this.findDirectNoteOperationsBySourceIds(changes.map((change) => change.sourceId)),
    ])
    const existingBySource = new Map<string, DirectChangeOperation>([
      ...storedTimetable.map((change) => [
        change.sourceId,
        { ...change, kind: 'timetable_change' as const },
      ] as const),
      ...storedTasks.map((change) => [change.sourceId, change] as const),
      ...storedNotes.map((change) => [change.sourceId, change] as const),
    ])
    const idempotencyConflicts = changes
      .filter((change) => {
        const previous = existingBySource.get(change.sourceId)
        return previous && !sameDirectChangeOperationPayload(previous, change)
      })
      .map((change) => change.sourceId)
    if (idempotencyConflicts.length > 0) {
      return {
        status: 'idempotency-conflict' as const,
        conflictingSourceIds: idempotencyConflicts,
      }
    }

    const pending = changes.filter(
      (change) => !existingBySource.has(change.sourceId),
    )
    if (pending.length === 0) {
      return {
        status: 'applied' as const,
        changes: changes.map((change) => existingBySource.get(change.sourceId)!),
      }
    }
    const pendingTimetable = pending.filter(
      (change): change is Extract<DirectChangeOperation, { kind: 'timetable_change' }> =>
        change.kind === 'timetable_change',
    )
    const itemChanges = pendingTimetable.filter(
      (change) => change.changeKind !== 'add',
    )
    const activeUpdates = await this.findActiveTimetableChangesByItemIds(
      itemChanges.map((change) => change.sharedInformationItemId),
    )
    const activeByItem = new Map(
      activeUpdates.map((change) => [change.sharedInformationItemId, change]),
    )
    const pendingTasks = pending.filter(
      (change): change is Extract<DirectChangeOperation, { kind: 'task' }> =>
        change.kind === 'task',
    )
    const taskItemChanges = pendingTasks.filter(
      (change) => change.changeKind !== 'add',
    )
    const relatedTaskItemIds = pending
      .filter(
        (change): change is Extract<
          DirectChangeOperation,
          { kind: 'note'; changeKind: 'add' }
        > => change.kind === 'note' && change.changeKind === 'add',
      )
      .flatMap((change) => change.relatedTaskItemId
        ? [change.relatedTaskItemId]
        : [])
    const activeTasks = await this.findActiveTasksByItemIds(
      [...new Set([
        ...taskItemChanges.map((change) => change.sharedInformationItemId),
        ...relatedTaskItemIds,
      ])],
    )
    const activeTaskByItem = new Map(
      activeTasks.map((task) => [task.sharedInformationItemId, task]),
    )
    const pendingNotes = pending.filter(
      (change): change is Extract<DirectChangeOperation, { kind: 'note' }> =>
        change.kind === 'note',
    )
    const pendingTaskAdds = pendingTasks.filter(
      (change) => change.changeKind === 'add',
    )
    const pendingTaskRemovals = new Set(
      pendingTasks
        .filter((change) => change.changeKind === 'remove')
        .map((change) => change.sharedInformationItemId),
    )
    const invalidTaskNoteAdd = pendingNotes.some((change) => {
      if (change.changeKind !== 'add' || !change.relatedTaskItemId) return false
      if (pendingTaskRemovals.has(change.relatedTaskItemId)) return true
      const task = pendingTaskAdds.find(
        (candidate) =>
          candidate.sharedInformationItemId === change.relatedTaskItemId,
      ) ?? activeTaskByItem.get(change.relatedTaskItemId)
      return !task || !targetScopesEqual(task.targetScope, change.targetScope)
    })
    if (invalidTaskNoteAdd) return { status: 'invalid-change' as const }
    const noteItemChanges = pendingNotes.filter(
      (change) => change.changeKind !== 'add',
    )
    const activeNotes = await this.findActiveNotesByItemIds(
      noteItemChanges.map((change) => change.sharedInformationItemId),
    )
    const activeNoteByItem = new Map(
      activeNotes.map((note) => [note.sharedInformationItemId, note]),
    )
    const invalidTaskNoteChange = noteItemChanges.some((change) => {
      const activeNote = activeNoteByItem.get(change.sharedInformationItemId)
      return !!activeNote?.relatedTaskItemId &&
        pendingTaskRemovals.has(activeNote.relatedTaskItemId)
    })
    if (invalidTaskNoteChange) return { status: 'invalid-change' as const }
    const addSlotKeys = pendingTimetable
      .filter((change) => change.changeKind === 'add')
      .map(activeTimetableChangeSlotKey)
    const occupied = new Set<string>()
    if (addSlotKeys.length > 0) {
      const placeholders = addSlotKeys.map(() => '?').join(', ')
      const { results } = await this.db
        .prepare(
          `select timetable_change_slot_key from active_timetable_change_slots
           where timetable_change_slot_key in (${placeholders})`,
        )
        .bind(...addSlotKeys)
        .all<{ timetable_change_slot_key: string }>()
      results.forEach((row) => occupied.add(row.timetable_change_slot_key))
    }
    const conflictingSourceIds = [
      ...pendingTimetable
      .filter((change) => {
        if (change.changeKind === 'add') {
          return occupied.has(activeTimetableChangeSlotKey(change))
        }
        const active = activeByItem.get(change.sharedInformationItemId)
        return !active ||
          active.latestChangeId !== change.expectedLatestChangeId ||
          activeTimetableChangeSlotKey(active) !==
            activeTimetableChangeSlotKey(change)
      })
      .map((change) => change.sourceId),
      ...taskItemChanges
        .filter((change) => {
          const active = activeTaskByItem.get(change.sharedInformationItemId)
          return !active ||
            active.latestChangeId !== change.expectedLatestChangeId ||
            !targetScopesEqual(active.targetScope, change.targetScope)
        })
        .map((change) => change.sourceId),
      ...noteItemChanges
        .filter((change) => {
          const active = activeNoteByItem.get(change.sharedInformationItemId)
          return !active ||
            active.latestChangeId !== change.expectedLatestChangeId ||
            !targetScopesEqual(active.targetScope, change.targetScope)
        })
        .map((change) => change.sourceId),
    ]
    if (conflictingSourceIds.length > 0) {
      return { status: 'conflict' as const, conflictingSourceIds }
    }

    const statements: D1PreparedStatement[] = []
    const orderedPending = [
      ...pending.filter((change) =>
        change.kind === 'task' && change.changeKind === 'add'),
      ...pending.filter((change) =>
        !(change.kind === 'task' && change.changeKind === 'add')),
    ]
    for (const change of orderedPending) {
      const targetScopeId = `${change.sourceId}:scope`
      const snapshotId = `${change.sourceId}:snapshot`
      const sharedChangeId = `${change.sourceId}:change`
      const createdAt = new Date(change.changedAt).toISOString()
      if (change.kind === 'note') {
        if (change.changeKind === 'add') {
          if (change.relatedTaskItemId) {
            statements.push(
              this.db.prepare(`insert into note_snapshots (note_snapshot_id, body, related_context_type, related_school_date, related_period_number, related_task_item_id, created_at) select ?, ?, 'task', null, null, ?, ? from shared_information_items where shared_information_item_id = ? and kind = 'task' and removed_at is null`).bind(snapshotId, change.body, change.relatedTaskItemId, createdAt, change.relatedTaskItemId),
              this.db.prepare(`insert into shared_information_items (shared_information_item_id, kind, target_scope_id, latest_change_id, current_task_snapshot_id, current_timetable_change_snapshot_id, current_note_snapshot_id, created_by_student_account_id, created_at, removed_at) select ?, 'note', target_scope_id, null, null, null, ?, ?, ?, null from shared_information_items where shared_information_item_id = ? and kind = 'task' and removed_at is null`).bind(change.sharedInformationItemId, snapshotId, change.changedByStudentAccountId, createdAt, change.relatedTaskItemId),
              this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id, note_snapshot_id) values (?, ?, 'add', 'direct', ?, ?, ?, null, null, ?)`).bind(sharedChangeId, change.sharedInformationItemId, change.sourceId, change.changedByStudentAccountId, createdAt, snapshotId),
              this.db.prepare(`update shared_information_items set latest_change_id = ? where shared_information_item_id = ?`).bind(sharedChangeId, change.sharedInformationItemId),
            )
          } else {
            const part = targetScopeColumns(change)
            statements.push(
              this.db.prepare(`insert into target_scopes (target_scope_id, school_year, created_at) values (?, ?, ?)`).bind(targetScopeId, change.targetScope.schoolYear, createdAt),
              this.db.prepare(`insert into target_scope_parts (target_scope_part_id, target_scope_id, scope_type, grade, class_id, track_id, student_account_id) values (?, ?, ?, ?, ?, ?, ?)`).bind(`${change.sourceId}:part`, targetScopeId, change.targetScope.type, part.grade, part.classId, part.trackId, part.studentAccountId),
              this.db.prepare(`insert into note_snapshots (note_snapshot_id, body, related_context_type, related_school_date, related_period_number, related_task_item_id, created_at) values (?, ?, ?, ?, ?, null, ?)`).bind(snapshotId, change.body, change.schoolDate === null ? 'none' : change.periodNumber == null ? 'school_date' : 'daily_lesson', change.schoolDate, change.periodNumber ?? null, createdAt),
              this.db.prepare(`insert into shared_information_items (shared_information_item_id, kind, target_scope_id, latest_change_id, current_task_snapshot_id, current_timetable_change_snapshot_id, current_note_snapshot_id, created_by_student_account_id, created_at, removed_at) values (?, 'note', ?, null, null, null, ?, ?, ?, null)`).bind(change.sharedInformationItemId, targetScopeId, snapshotId, change.changedByStudentAccountId, createdAt),
              this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id, note_snapshot_id) values (?, ?, 'add', 'direct', ?, ?, ?, null, null, ?)`).bind(sharedChangeId, change.sharedInformationItemId, change.sourceId, change.changedByStudentAccountId, createdAt, snapshotId),
              this.db.prepare(`update shared_information_items set latest_change_id = ? where shared_information_item_id = ?`).bind(sharedChangeId, change.sharedInformationItemId),
            )
          }
        } else if (change.changeKind === 'update') {
          statements.push(
            this.db.prepare(
              `insert into note_snapshots (
                 note_snapshot_id, body, related_context_type,
                 related_school_date, related_period_number,
                 related_task_item_id, created_at
               )
               select ?, ?, previous.related_context_type,
                      previous.related_school_date,
                      previous.related_period_number,
                      previous.related_task_item_id, ?
               from shared_information_items item
               join note_snapshots previous
                 on previous.note_snapshot_id = item.current_note_snapshot_id
               where item.shared_information_item_id = ? and item.kind = 'note'
                 and item.latest_change_id = ? and item.removed_at is null`,
            ).bind(
              snapshotId,
              change.body,
              createdAt,
              change.sharedInformationItemId,
              change.expectedLatestChangeId,
            ),
            this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id, note_snapshot_id, preceding_change_id) values (?, ?, 'update', 'direct', ?, ?, ?, null, null, ?, ?)`).bind(sharedChangeId, change.sharedInformationItemId, change.sourceId, change.changedByStudentAccountId, createdAt, snapshotId, change.expectedLatestChangeId),
            this.db.prepare(`update shared_information_items set latest_change_id = ?, current_note_snapshot_id = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, snapshotId, change.sharedInformationItemId, change.expectedLatestChangeId),
          )
        } else {
          statements.push(
            this.db.prepare(
              `insert into shared_information_changes (
                 shared_information_change_id, shared_information_item_id,
                 change_kind, source_type, source_id,
                 changed_by_student_account_id, changed_at,
                 task_snapshot_id, timetable_change_snapshot_id,
                 note_snapshot_id, preceding_change_id, removal_reason
               ) values (?, (
                   select shared_information_item_id
                   from shared_information_items
                   where shared_information_item_id = ? and kind = 'note'
                     and latest_change_id = ? and removed_at is null
                 ), 'remove', 'direct', ?, ?, ?, null, null, null, ?, ?)`,
            ).bind(
              sharedChangeId,
              change.sharedInformationItemId,
              change.expectedLatestChangeId,
              change.sourceId,
              change.changedByStudentAccountId,
              createdAt,
              change.expectedLatestChangeId,
              change.removalReason,
            ),
            this.db.prepare(`update shared_information_items set latest_change_id = ?, removed_at = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, createdAt, change.sharedInformationItemId, change.expectedLatestChangeId),
          )
        }
        continue
      }
      if (change.kind === 'task') {
        const taskSnapshotValues = change.changeKind === 'remove'
          ? null
          : [
            snapshotId,
            change.title,
            change.dueDate,
            change.relatedLessonName?.registeredLessonNameId ?? null,
            change.relatedLessonName?.registeredLessonNameId
              ? null
              : change.relatedLessonName?.lessonName ?? null,
            change.relatedLessonName && !change.relatedLessonName.registeredLessonNameId
              ? normalizeLessonName(change.relatedLessonName.lessonName)
              : null,
            createdAt,
          ]
        if (change.changeKind === 'add') {
          const part = targetScopeColumns(change)
          statements.push(
            this.db.prepare(`insert into target_scopes (target_scope_id, school_year, created_at) values (?, ?, ?)`).bind(targetScopeId, change.targetScope.schoolYear, createdAt),
            this.db.prepare(`insert into target_scope_parts (target_scope_part_id, target_scope_id, scope_type, grade, class_id, track_id, student_account_id) values (?, ?, ?, ?, ?, ?, ?)`).bind(`${change.sourceId}:part`, targetScopeId, change.targetScope.type, part.grade, part.classId, part.trackId, part.studentAccountId),
            this.db.prepare(`insert into task_snapshots (task_snapshot_id, title, due_date, registered_related_lesson_name_id, related_lesson_name, normalized_custom_lesson_name, created_at) values (?, ?, ?, ?, ?, ?, ?)`).bind(...taskSnapshotValues!),
            this.db.prepare(`insert into shared_information_items (shared_information_item_id, kind, target_scope_id, latest_change_id, current_task_snapshot_id, current_timetable_change_snapshot_id, created_by_student_account_id, created_at, removed_at) values (?, 'task', ?, null, ?, null, ?, ?, null)`).bind(change.sharedInformationItemId, targetScopeId, snapshotId, change.changedByStudentAccountId, createdAt),
            this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id) values (?, ?, 'add', 'direct', ?, ?, ?, ?, null)`).bind(sharedChangeId, change.sharedInformationItemId, change.sourceId, change.changedByStudentAccountId, createdAt, snapshotId),
            this.db.prepare(`update shared_information_items set latest_change_id = ? where shared_information_item_id = ?`).bind(sharedChangeId, change.sharedInformationItemId),
          )
        } else if (change.changeKind === 'update') {
          statements.push(
            this.db.prepare(
              `insert into task_snapshots (
                 task_snapshot_id, title, due_date,
                 registered_related_lesson_name_id, related_lesson_name,
                 normalized_custom_lesson_name, created_at
               )
               select ?, ?, ?, ?, ?, ?, ?
               from shared_information_items
               where shared_information_item_id = ? and kind = 'task'
                 and latest_change_id = ? and removed_at is null`,
            ).bind(
              ...taskSnapshotValues!,
              change.sharedInformationItemId,
              change.expectedLatestChangeId,
            ),
            this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id, preceding_change_id) values (?, ?, 'update', 'direct', ?, ?, ?, ?, null, ?)`).bind(sharedChangeId, change.sharedInformationItemId, change.sourceId, change.changedByStudentAccountId, createdAt, snapshotId, change.expectedLatestChangeId),
            this.db.prepare(`update shared_information_items set latest_change_id = ?, current_task_snapshot_id = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, snapshotId, change.sharedInformationItemId, change.expectedLatestChangeId),
          )
        } else {
          statements.push(
            this.db.prepare(
              `insert into shared_information_changes (
                 shared_information_change_id, shared_information_item_id,
                 change_kind, source_type, source_id,
                 changed_by_student_account_id, changed_at,
                 task_snapshot_id, timetable_change_snapshot_id,
                 note_snapshot_id, preceding_change_id, removal_reason
               )
               select ? || ':task-cascade:' || note_item.shared_information_item_id || ':change',
                      note_item.shared_information_item_id,
                      'remove', 'direct',
                      ? || ':task-cascade:' || note_item.shared_information_item_id,
                      ?, ?, null, null, null, note_item.latest_change_id,
                      'task_cascade'
               from shared_information_items note_item
               join note_snapshots note
                 on note.note_snapshot_id = note_item.current_note_snapshot_id
               where note_item.kind = 'note' and note_item.removed_at is null
                 and note.related_task_item_id = ?`,
            ).bind(
              change.sourceId,
              change.sourceId,
              change.changedByStudentAccountId,
              createdAt,
              change.sharedInformationItemId,
            ),
            this.db.prepare(
              `update shared_information_items
               set latest_change_id = ? || ':task-cascade:' || shared_information_item_id || ':change',
                   removed_at = ?
               where kind = 'note' and removed_at is null
                 and current_note_snapshot_id in (
                   select note_snapshot_id from note_snapshots
                   where related_task_item_id = ?
                 )`,
            ).bind(
              change.sourceId,
              createdAt,
              change.sharedInformationItemId,
            ),
            this.db.prepare(
              `insert into shared_information_changes (
                 shared_information_change_id, shared_information_item_id,
                 change_kind, source_type, source_id,
                 changed_by_student_account_id, changed_at,
                 task_snapshot_id, timetable_change_snapshot_id,
                 preceding_change_id
               ) values (
                 ?,
                 (select shared_information_item_id
                  from shared_information_items
                  where shared_information_item_id = ? and kind = 'task'
                    and latest_change_id = ? and removed_at is null),
                 'remove', 'direct', ?, ?, ?, null, null, ?
               )`,
            ).bind(
              sharedChangeId,
              change.sharedInformationItemId,
              change.expectedLatestChangeId,
              change.sourceId,
              change.changedByStudentAccountId,
              createdAt,
              change.expectedLatestChangeId,
            ),
            this.db.prepare(`update shared_information_items set latest_change_id = ?, removed_at = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, createdAt, change.sharedInformationItemId, change.expectedLatestChangeId),
          )
        }
        continue
      }
      const replacement = change.changeKind === 'remove'
        ? null
        : change.replacement
      const snapshotValues = [
        snapshotId,
        change.changeDate,
        change.periodNumber,
        replacement?.type,
        replacement?.type === 'lesson_name'
          ? replacement.registeredLessonNameId ?? null
          : null,
        replacement?.type === 'lesson_name' ? replacement.lessonName : null,
        replacement?.type === 'lesson_name' &&
            !replacement.registeredLessonNameId
          ? normalizeLessonName(replacement.lessonName)
          : null,
        replacement?.type === 'period_reference' ? replacement.weekday : null,
        replacement?.type === 'period_reference' ? replacement.periodNumber : null,
        replacement?.type === 'floating_lesson_reference'
          ? replacement.floatingLessonReferenceLabelId
          : null,
        replacement?.type === 'floating_lesson_reference'
          ? replacement.floatingLessonReferenceLabelId
          : null,
        createdAt,
      ]
      if (change.changeKind === 'add') {
        const part = targetScopeColumns(change)
        statements.push(
          this.db.prepare(`insert into target_scopes (target_scope_id, school_year, created_at) values (?, ?, ?)`).bind(targetScopeId, change.targetScope.schoolYear, createdAt),
          this.db.prepare(`insert into target_scope_parts (target_scope_part_id, target_scope_id, scope_type, grade, class_id, track_id, student_account_id) values (?, ?, ?, ?, ?, ?, ?)`).bind(`${change.sourceId}:part`, targetScopeId, change.targetScope.type, part.grade, part.classId, part.trackId, part.studentAccountId),
          this.db.prepare(`insert into timetable_change_snapshots (timetable_change_snapshot_id, change_date, period_number, replacement_type, registered_lesson_name_id, replacement_lesson_name, normalized_custom_lesson_name, reference_weekday, reference_period_number, reference_label, floating_lesson_reference_label_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(...snapshotValues),
          this.db.prepare(`insert into shared_information_items (shared_information_item_id, kind, target_scope_id, latest_change_id, current_task_snapshot_id, current_timetable_change_snapshot_id, created_by_student_account_id, created_at, removed_at) values (?, 'timetable_change', ?, null, null, ?, ?, ?, null)`).bind(change.sharedInformationItemId, targetScopeId, snapshotId, change.changedByStudentAccountId, createdAt),
          this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id) values (?, ?, 'add', 'direct', ?, ?, ?, null, ?)`).bind(sharedChangeId, change.sharedInformationItemId, change.sourceId, change.changedByStudentAccountId, createdAt, snapshotId),
          this.db.prepare(`update shared_information_items set latest_change_id = ? where shared_information_item_id = ?`).bind(sharedChangeId, change.sharedInformationItemId),
          this.db.prepare(`insert into active_timetable_change_slots (timetable_change_slot_key, shared_information_item_id) values (?, ?)`).bind(activeTimetableChangeSlotKey(change), change.sharedInformationItemId),
        )
      } else if (change.changeKind === 'update') {
        statements.push(
          this.db.prepare(
            `insert into timetable_change_snapshots (
               timetable_change_snapshot_id, change_date, period_number,
               replacement_type, registered_lesson_name_id,
               replacement_lesson_name, normalized_custom_lesson_name,
               reference_weekday, reference_period_number, reference_label,
               floating_lesson_reference_label_id, created_at
             )
             select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
             from shared_information_items i
             join active_timetable_change_slots a
               on a.shared_information_item_id = i.shared_information_item_id
             where i.shared_information_item_id = ?
               and i.kind = 'timetable_change'
               and i.removed_at is null
               and i.latest_change_id = ?
               and a.timetable_change_slot_key = ?`,
          ).bind(
            ...snapshotValues,
            change.sharedInformationItemId,
            change.expectedLatestChangeId,
            activeTimetableChangeSlotKey(change),
          ),
          this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, timetable_change_snapshot_id, preceding_change_id) values (?, ?, 'update', 'direct', ?, ?, ?, ?, ?)`).bind(sharedChangeId, change.sharedInformationItemId, change.sourceId, change.changedByStudentAccountId, createdAt, snapshotId, change.expectedLatestChangeId),
          this.db.prepare(`update shared_information_items set latest_change_id = ?, current_timetable_change_snapshot_id = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, snapshotId, change.sharedInformationItemId, change.expectedLatestChangeId),
        )
      } else {
        statements.push(
          this.db.prepare(
            `insert into shared_information_changes (
               shared_information_change_id, shared_information_item_id,
               change_kind, source_type, source_id,
               changed_by_student_account_id, changed_at,
               timetable_change_snapshot_id, preceding_change_id
             ) values (
               ?,
               (select i.shared_information_item_id
                from shared_information_items i
                join active_timetable_change_slots a
                  on a.shared_information_item_id = i.shared_information_item_id
                where i.shared_information_item_id = ?
                  and i.kind = 'timetable_change'
                  and i.latest_change_id = ?
                  and i.removed_at is null
                  and a.timetable_change_slot_key = ?),
               'remove', 'direct', ?, ?, ?, null, ?
             )`,
          ).bind(
            sharedChangeId,
            change.sharedInformationItemId,
            change.expectedLatestChangeId,
            activeTimetableChangeSlotKey(change),
            change.sourceId,
            change.changedByStudentAccountId,
            createdAt,
            change.expectedLatestChangeId,
          ),
          this.db.prepare(`update shared_information_items set latest_change_id = ?, removed_at = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, createdAt, change.sharedInformationItemId, change.expectedLatestChangeId),
          this.db.prepare(`delete from active_timetable_change_slots where shared_information_item_id = ? and timetable_change_slot_key = ?`).bind(change.sharedInformationItemId, activeTimetableChangeSlotKey(change)),
        )
      }
    }

    try {
      await this.db.batch(statements)
    } catch {
      const [retriedTimetable, retriedTasks, retriedNotes] = await Promise.all([
        this.findDirectChangesBySourceIds(changes.map((change) => change.sourceId)),
        this.findDirectTaskOperationsBySourceIds(changes.map((change) => change.sourceId)),
        this.findDirectNoteOperationsBySourceIds(changes.map((change) => change.sourceId)),
      ])
      const retried = new Map<string, DirectChangeOperation>([
        ...retriedTimetable.map((change) => [
          change.sourceId,
          { ...change, kind: 'timetable_change' as const },
        ] as const),
        ...retriedTasks.map((change) => [change.sourceId, change] as const),
        ...retriedNotes.map((change) => [change.sourceId, change] as const),
      ])
      if (
        retried.size === changes.length &&
        changes.every((change) => {
          const previous = retried.get(change.sourceId)
          return previous
            ? sameDirectChangeOperationPayload(previous, change)
            : false
        })
      ) {
        return {
          status: 'applied' as const,
          changes: changes.map((change) => retried.get(change.sourceId)!),
        }
      }
      return {
        status: 'conflict' as const,
        conflictingSourceIds: pending.map((change) => change.sourceId),
      }
    }
    return { status: 'applied' as const, changes }
  }

  async commitDirectTimetableChanges(changes: DirectTimetableChangeOperation[]) {
    const existing = await this.findDirectChangesBySourceIds(
      changes.map((change) => change.sourceId),
    )
    const existingBySource = new Map(existing.map((change) => [change.sourceId, change]))
    const idempotencyConflicts: string[] = []
    for (const change of changes) {
      const previous = existingBySource.get(change.sourceId)
      if (previous && !sameDirectOperationPayload(previous, change)) {
        idempotencyConflicts.push(change.sourceId)
      }
    }
    if (idempotencyConflicts.length > 0) {
      return {
        status: 'idempotency-conflict' as const,
        conflictingSourceIds: idempotencyConflicts,
      }
    }

    const pending = changes.filter((change) => !existingBySource.has(change.sourceId))
    if (pending.length === 0) return { status: 'applied' as const, changes: existing }

    const itemChanges = pending.filter((change) => change.changeKind !== 'add')
    const activeUpdates = await this.findActiveTimetableChangesByItemIds(
      itemChanges.map((change) => change.sharedInformationItemId),
    )
    const activeByItem = new Map(
      activeUpdates.map((change) => [change.sharedInformationItemId, change]),
    )
    const addSlotKeys = pending
      .filter((change) => change.changeKind === 'add')
      .map(activeTimetableChangeSlotKey)
    const occupiedAddSlots = new Set<string>()
    if (addSlotKeys.length > 0) {
      const placeholders = addSlotKeys.map(() => '?').join(', ')
      const { results } = await this.db
        .prepare(
          `select timetable_change_slot_key from active_timetable_change_slots
           where timetable_change_slot_key in (${placeholders})`,
        )
        .bind(...addSlotKeys)
        .all<{ timetable_change_slot_key: string }>()
      results.forEach((row) => occupiedAddSlots.add(row.timetable_change_slot_key))
    }
    const conflictingSourceIds = pending
      .filter((change) => {
        if (change.changeKind === 'add') {
          return occupiedAddSlots.has(activeTimetableChangeSlotKey(change))
        }
        const active = activeByItem.get(change.sharedInformationItemId)
        return !active ||
          active.latestChangeId !== change.expectedLatestChangeId ||
          activeTimetableChangeSlotKey(active) !== activeTimetableChangeSlotKey(change)
      })
      .map((change) => change.sourceId)
    if (conflictingSourceIds.length > 0) {
      return { status: 'conflict' as const, conflictingSourceIds }
    }

    const statements: D1PreparedStatement[] = []
    for (const change of pending) {
      const snapshotId = `${change.sourceId}:snapshot`
      const sharedChangeId = `${change.sourceId}:change`
      const createdAt = new Date(change.changedAt).toISOString()
      const replacement = change.changeKind === 'remove' ? null : change.replacement
      const snapshotValues = [
        snapshotId,
        change.changeDate,
        change.periodNumber,
        replacement?.type,
        replacement?.type === 'lesson_name'
          ? replacement.registeredLessonNameId ?? null
          : null,
        replacement?.type === 'lesson_name' ? replacement.lessonName : null,
        replacement?.type === 'lesson_name' &&
            !replacement.registeredLessonNameId
          ? normalizeLessonName(replacement.lessonName)
          : null,
        replacement?.type === 'period_reference' ? replacement.weekday : null,
        replacement?.type === 'period_reference' ? replacement.periodNumber : null,
        replacement?.type === 'floating_lesson_reference'
          ? replacement.floatingLessonReferenceLabelId
          : null,
        replacement?.type === 'floating_lesson_reference'
          ? replacement.floatingLessonReferenceLabelId
          : null,
        createdAt,
      ]

      if (change.changeKind === 'add') {
        const targetScopeId = `${change.sourceId}:scope`
        const part = targetScopeColumns(change)
        statements.push(
          this.db.prepare(`insert into target_scopes (target_scope_id, school_year, created_at) values (?, ?, ?)`).bind(targetScopeId, change.targetScope.schoolYear, createdAt),
          this.db.prepare(`insert into target_scope_parts (target_scope_part_id, target_scope_id, scope_type, grade, class_id, track_id, student_account_id) values (?, ?, ?, ?, ?, ?, ?)`).bind(`${change.sourceId}:part`, targetScopeId, change.targetScope.type, part.grade, part.classId, part.trackId, part.studentAccountId),
          this.db.prepare(`insert into timetable_change_snapshots (timetable_change_snapshot_id, change_date, period_number, replacement_type, registered_lesson_name_id, replacement_lesson_name, normalized_custom_lesson_name, reference_weekday, reference_period_number, reference_label, floating_lesson_reference_label_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(...snapshotValues),
          this.db.prepare(`insert into shared_information_items (shared_information_item_id, kind, target_scope_id, latest_change_id, current_timetable_change_snapshot_id, created_by_student_account_id, created_at, removed_at) values (?, 'timetable_change', ?, null, ?, ?, ?, null)`).bind(change.sharedInformationItemId, targetScopeId, snapshotId, change.changedByStudentAccountId, createdAt),
          this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, timetable_change_snapshot_id) values (?, ?, 'add', 'direct', ?, ?, ?, ?)`).bind(sharedChangeId, change.sharedInformationItemId, change.sourceId, change.changedByStudentAccountId, createdAt, snapshotId),
          this.db.prepare(`update shared_information_items set latest_change_id = ? where shared_information_item_id = ?`).bind(sharedChangeId, change.sharedInformationItemId),
          this.db.prepare(`insert into active_timetable_change_slots (timetable_change_slot_key, shared_information_item_id) values (?, ?)`).bind(activeTimetableChangeSlotKey(change), change.sharedInformationItemId),
        )
      } else if (change.changeKind === 'update') {
        statements.push(
          this.db.prepare(
            `insert into timetable_change_snapshots (
               timetable_change_snapshot_id, change_date, period_number,
               replacement_type, registered_lesson_name_id,
               replacement_lesson_name, normalized_custom_lesson_name,
               reference_weekday, reference_period_number, reference_label,
               floating_lesson_reference_label_id, created_at
             )
             select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
             from shared_information_items i
             join active_timetable_change_slots a
               on a.shared_information_item_id = i.shared_information_item_id
             where i.shared_information_item_id = ?
               and i.kind = 'timetable_change'
               and i.removed_at is null
               and i.latest_change_id = ?
               and a.timetable_change_slot_key = ?`,
          ).bind(
            ...snapshotValues,
            change.sharedInformationItemId,
            change.expectedLatestChangeId,
            activeTimetableChangeSlotKey(change),
          ),
          this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, timetable_change_snapshot_id, preceding_change_id) values (?, ?, 'update', 'direct', ?, ?, ?, ?, ?)`).bind(sharedChangeId, change.sharedInformationItemId, change.sourceId, change.changedByStudentAccountId, createdAt, snapshotId, change.expectedLatestChangeId),
          this.db.prepare(`update shared_information_items set latest_change_id = ?, current_timetable_change_snapshot_id = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, snapshotId, change.sharedInformationItemId, change.expectedLatestChangeId),
        )
      } else {
        statements.push(
          this.db.prepare(
            `insert into shared_information_changes (
               shared_information_change_id, shared_information_item_id,
               change_kind, source_type, source_id,
               changed_by_student_account_id, changed_at,
               timetable_change_snapshot_id, preceding_change_id
             ) values (
               ?,
               (select i.shared_information_item_id
                from shared_information_items i
                join active_timetable_change_slots a
                  on a.shared_information_item_id = i.shared_information_item_id
                where i.shared_information_item_id = ?
                  and i.kind = 'timetable_change'
                  and i.latest_change_id = ?
                  and i.removed_at is null
                  and a.timetable_change_slot_key = ?),
               'remove', 'direct', ?, ?, ?, null, ?
             )`,
          ).bind(
            sharedChangeId,
            change.sharedInformationItemId,
            change.expectedLatestChangeId,
            activeTimetableChangeSlotKey(change),
            change.sourceId,
            change.changedByStudentAccountId,
            createdAt,
            change.expectedLatestChangeId,
          ),
          this.db.prepare(`update shared_information_items set latest_change_id = ?, removed_at = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, createdAt, change.sharedInformationItemId, change.expectedLatestChangeId),
          this.db.prepare(`delete from active_timetable_change_slots where shared_information_item_id = ? and timetable_change_slot_key = ?`).bind(change.sharedInformationItemId, activeTimetableChangeSlotKey(change)),
        )
      }
    }

    try {
      await this.db.batch(statements)
    } catch {
      const retried = await this.findDirectChangesBySourceIds(
        changes.map((change) => change.sourceId),
      )
      if (
        retried.length === changes.length &&
        changes.every((change) => {
          const previous = retried.find((item) => item.sourceId === change.sourceId)
          return previous ? sameDirectOperationPayload(previous, change) : false
        })
      ) {
        return { status: 'applied' as const, changes: retried }
      }
      return {
        status: 'conflict' as const,
        conflictingSourceIds: pending.map((change) => change.sourceId),
      }
    }

    return { status: 'applied' as const, changes }
  }

  async listTimetableChangeHistory(input: {
    targetScope: TargetScope
    changeDate: string
    periodNumber: number
  }) {
    return this.queryTimetableChangeHistory(
      `s.school_year = ? and p.scope_type = ?
       and coalesce(cast(p.grade as text), p.class_id, p.track_id,
                    p.student_account_id) = ?
       and slot.change_date = ? and slot.period_number = ?`,
      [
        input.targetScope.schoolYear,
        input.targetScope.type,
        targetScopeValue(input.targetScope),
        input.changeDate,
        input.periodNumber,
      ],
    )
  }

  async listTimetableChangeItemHistoryByChangeId(
    sharedInformationChangeId: string,
  ) {
    return this.queryTimetableChangeHistory(
      `i.shared_information_item_id = (
         select selected.shared_information_item_id
         from shared_information_changes selected
         where selected.shared_information_change_id = ?
       )`,
      [sharedInformationChangeId],
    )
  }

  async listTaskEditHistory(sharedInformationItemId: string) {
    const { results } = await this.db
      .prepare(
        `select c.shared_information_change_id,
                c.shared_information_item_id, c.change_kind, c.source_type,
                s.school_year, p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, actor.display_name, c.changed_at,
                c.preceding_change_id, task.title, task.due_date,
                coalesce(registered_lesson.short_lesson_name,
                         task.related_lesson_name) as related_lesson_name
         from shared_information_changes c
         join shared_information_items i
           on i.shared_information_item_id = c.shared_information_item_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join student_accounts actor
           on actor.student_account_id = c.changed_by_student_account_id
         left join task_snapshots task
           on task.task_snapshot_id = c.task_snapshot_id
         left join registered_lesson_names registered_lesson
           on registered_lesson.registered_lesson_name_id =
             task.registered_related_lesson_name_id
         where i.kind = 'task' and i.shared_information_item_id = ?
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1`,
      )
      .bind(sharedInformationItemId)
      .all<HistoricalTaskChangeRow>()
    return results.map(mapHistoricalTaskChangeRow)
  }

  async listNoteEditHistory(sharedInformationItemId: string) {
    const { results } = await this.db
      .prepare(
        `select c.shared_information_change_id,
                c.shared_information_item_id, c.change_kind, c.source_type,
                s.school_year, p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, actor.display_name, c.changed_at,
                c.preceding_change_id, note.body, c.removal_reason
         from shared_information_changes c
         join shared_information_items i
           on i.shared_information_item_id = c.shared_information_item_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join student_accounts actor
           on actor.student_account_id = c.changed_by_student_account_id
         left join note_snapshots note
           on note.note_snapshot_id = c.note_snapshot_id
         where i.kind = 'note' and i.shared_information_item_id = ?
           and c.source_type = 'direct'
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1`,
      )
      .bind(sharedInformationItemId)
      .all<HistoricalNoteChangeRow>()
    return results.map(mapHistoricalNoteChangeRow)
  }

  private async queryTimetableChangeHistory(
    predicate: string,
    values: unknown[],
  ) {
    const { results } = await this.db
      .prepare(
        `select c.shared_information_change_id,
                c.shared_information_item_id, c.change_kind, c.source_type,
                s.school_year, p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, slot.change_date, slot.period_number,
                snapshot.replacement_type,
                snapshot.registered_lesson_name_id,
                coalesce(registered_lesson.short_lesson_name,
                         snapshot.replacement_lesson_name) as replacement_lesson_name,
                snapshot.reference_weekday, snapshot.reference_period_number,
                coalesce(label.reference_label, snapshot.reference_label) as reference_label,
                snapshot.floating_lesson_reference_label_id,
                actor.display_name, c.changed_at, c.preceding_change_id
         from shared_information_changes c
         join shared_information_items i
           on i.shared_information_item_id = c.shared_information_item_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join student_accounts actor
           on actor.student_account_id = c.changed_by_student_account_id
         join timetable_change_snapshots slot on slot.timetable_change_snapshot_id = (
           select first_change.timetable_change_snapshot_id
           from shared_information_changes first_change
           where first_change.shared_information_item_id = i.shared_information_item_id
             and first_change.timetable_change_snapshot_id is not null
           order by first_change.changed_at, first_change.shared_information_change_id
           limit 1
         )
         left join timetable_change_snapshots snapshot
           on snapshot.timetable_change_snapshot_id = c.timetable_change_snapshot_id
         left join registered_lesson_names registered_lesson
           on registered_lesson.registered_lesson_name_id =
             snapshot.registered_lesson_name_id
         left join floating_lesson_reference_labels label
           on label.floating_lesson_reference_label_id =
             snapshot.floating_lesson_reference_label_id
          where i.kind = 'timetable_change'
            and (select count(*) from target_scope_parts scope_part_count
                 where scope_part_count.target_scope_id = s.target_scope_id) = 1
            and ${predicate}`,
      )
      .bind(...values)
      .all<HistoricalTimetableChangeRow>()
    return results.map(mapHistoricalTimetableChangeRow)
  }

  private async findActiveTimetableChangesByItemIds(itemIds: string[]) {
    if (itemIds.length === 0) return []
    const placeholders = itemIds.map(() => '?').join(', ')
    const { results } = await this.db
      .prepare(
        `select c.source_id, c.shared_information_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id, p.student_account_id,
                t.change_date, t.period_number, t.replacement_type,
                t.registered_lesson_name_id,
                coalesce(registered_lesson.short_lesson_name,
                         t.replacement_lesson_name) as replacement_lesson_name,
                t.reference_weekday,
                t.reference_period_number, t.reference_label,
                t.floating_lesson_reference_label_id,
                c.changed_by_student_account_id, c.changed_at
         from shared_information_items i
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join timetable_change_snapshots t
           on t.timetable_change_snapshot_id = i.current_timetable_change_snapshot_id
         left join registered_lesson_names registered_lesson
           on registered_lesson.registered_lesson_name_id =
             t.registered_lesson_name_id
         join shared_information_changes c
           on c.shared_information_change_id = i.latest_change_id
         join active_timetable_change_slots a
           on a.shared_information_item_id = i.shared_information_item_id
         where i.kind = 'timetable_change' and i.removed_at is null
           and i.shared_information_item_id in (${placeholders})`,
      )
      .bind(...itemIds)
      .all<ActiveTimetableChangeRow>()
    return results.map(mapActiveTimetableChangeRow)
  }

  private async findDirectChangesBySourceIds(sourceIds: string[]) {
    if (sourceIds.length === 0) return []
    const placeholders = sourceIds.map(() => '?').join(', ')
    const { results } = await this.db
      .prepare(
        `select c.change_kind,
                (select previous.shared_information_change_id
                 from shared_information_changes previous
                 where previous.shared_information_item_id = c.shared_information_item_id
                   and previous.rowid < c.rowid
                 order by previous.rowid desc
                 limit 1) as expected_latest_change_id,
                c.source_id, c.shared_information_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id, p.student_account_id,
                t.change_date, t.period_number, t.replacement_type,
                t.registered_lesson_name_id,
                coalesce(registered_lesson.short_lesson_name,
                         t.replacement_lesson_name) as replacement_lesson_name,
                t.reference_weekday,
                t.reference_period_number, t.reference_label,
                t.floating_lesson_reference_label_id,
                c.changed_by_student_account_id, c.changed_at
         from shared_information_changes c
         join shared_information_items i on i.shared_information_item_id = c.shared_information_item_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join timetable_change_snapshots t on t.timetable_change_snapshot_id = coalesce(c.timetable_change_snapshot_id, i.current_timetable_change_snapshot_id)
         left join registered_lesson_names registered_lesson
           on registered_lesson.registered_lesson_name_id =
             t.registered_lesson_name_id
         where c.source_type = 'direct' and c.source_id in (${placeholders})`,
      )
      .bind(...sourceIds)
      .all<ActiveTimetableChangeRow>()
    return results.map(mapStoredDirectOperation)
  }

  private async findActiveTasksByItemIds(itemIds: string[]) {
    if (itemIds.length === 0) return []
    const placeholders = itemIds.map(() => '?').join(', ')
    const { results } = await this.db
      .prepare(
        `select latest.source_id, latest.shared_information_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, task.title, task.due_date,
                task.registered_related_lesson_name_id,
                coalesce(registered_lesson.short_lesson_name,
                         task.related_lesson_name) as related_lesson_name,
                latest.changed_by_student_account_id, latest.changed_at,
                i.created_at
         from shared_information_items i
         join shared_information_changes latest
           on latest.shared_information_change_id = i.latest_change_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join task_snapshots task
           on task.task_snapshot_id = i.current_task_snapshot_id
         left join registered_lesson_names registered_lesson
           on registered_lesson.registered_lesson_name_id =
              task.registered_related_lesson_name_id
         where i.kind = 'task' and i.removed_at is null
           and i.shared_information_item_id in (${placeholders})`,
      )
      .bind(...itemIds)
      .all<ActiveTaskRow>()
    return results.map(mapActiveTaskRow)
  }

  private async findDirectTaskOperationsBySourceIds(sourceIds: string[]) {
    if (sourceIds.length === 0) return []
    const placeholders = sourceIds.map(() => '?').join(', ')
    const { results } = await this.db
      .prepare(
        `select c.source_id, c.shared_information_change_id,
                c.change_kind, c.preceding_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, task.title, task.due_date,
                task.registered_related_lesson_name_id,
                coalesce(registered_lesson.short_lesson_name,
                         task.related_lesson_name) as related_lesson_name,
                c.changed_by_student_account_id, c.changed_at, i.created_at
         from shared_information_changes c
         join shared_information_items i
           on i.shared_information_item_id = c.shared_information_item_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         left join task_snapshots task
           on task.task_snapshot_id = c.task_snapshot_id
         left join registered_lesson_names registered_lesson
           on registered_lesson.registered_lesson_name_id =
              task.registered_related_lesson_name_id
         where c.source_type = 'direct' and i.kind = 'task'
           and c.source_id in (${placeholders})`,
      )
      .bind(...sourceIds)
      .all<StoredDirectTaskOperationRow>()
    return results.map(mapStoredDirectTaskOperation)
  }

  private async findDirectNoteOperationsBySourceIds(sourceIds: string[]) {
    if (sourceIds.length === 0) return []
    const placeholders = sourceIds.map(() => '?').join(', ')
    const { results } = await this.db
      .prepare(
        `select c.source_id, c.shared_information_change_id, c.change_kind,
                c.preceding_change_id, c.removal_reason,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, note.body, note.related_school_date,
                note.related_period_number, note.related_task_item_id,
                c.changed_by_student_account_id, c.changed_at, i.created_at
         from shared_information_changes c
         join shared_information_items i
           on i.shared_information_item_id = c.shared_information_item_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         left join note_snapshots note on note.note_snapshot_id = c.note_snapshot_id
         where c.source_type = 'direct' and i.kind = 'note'
           and c.source_id in (${placeholders})`,
      )
      .bind(...sourceIds)
      .all<StoredDirectNoteOperationRow>()
    return results.map(mapStoredDirectNoteOperation)
  }

  private async findActiveNotesByItemIds(itemIds: string[]) {
    if (itemIds.length === 0) return []
    const placeholders = itemIds.map(() => '?').join(', ')
    const { results } = await this.db
      .prepare(
        `select latest.source_id, latest.shared_information_change_id,
                i.shared_information_item_id, s.school_year,
                p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, note.body, note.related_school_date,
                note.related_period_number, note.related_task_item_id,
                latest.changed_by_student_account_id, latest.changed_at,
                i.created_at
         from shared_information_items i
         join shared_information_changes latest
           on latest.shared_information_change_id = i.latest_change_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join note_snapshots note
           on note.note_snapshot_id = i.current_note_snapshot_id
         where i.kind = 'note' and i.removed_at is null
           and i.shared_information_item_id in (${placeholders})`,
      )
      .bind(...itemIds)
      .all<ActiveNoteRow>()
    return results.map(mapActiveNoteRow)
  }

  async listFloatingLessonReferenceLabels(schoolYear: number, grade: number) {
    const { results } = await this.db
      .prepare(
        `select floating_lesson_reference_label_id, school_year, grade,
                reference_label, display_order
         from floating_lesson_reference_labels
         where school_year = ? and grade = ?
         order by display_order asc, reference_label asc`,
      )
      .bind(schoolYear, grade)
      .all<{
        floating_lesson_reference_label_id: string
        school_year: number
        grade: number
        reference_label: string
        display_order: number
      }>()
    return results.map((row) => ({
      floatingLessonReferenceLabelId: row.floating_lesson_reference_label_id,
      schoolYear: row.school_year,
      grade: row.grade,
      referenceLabel: row.reference_label,
      displayOrder: row.display_order,
    }))
  }

  async findFloatingLessonReferenceLabel(
    floatingLessonReferenceLabelId: string,
    schoolYear: number,
    grade: number,
  ) {
    const row = await this.db
      .prepare(
        `select floating_lesson_reference_label_id, school_year, grade,
                reference_label, display_order
         from floating_lesson_reference_labels
         where floating_lesson_reference_label_id = ? and school_year = ? and grade = ?`,
      )
      .bind(floatingLessonReferenceLabelId, schoolYear, grade)
      .first<{
        floating_lesson_reference_label_id: string
        school_year: number
        grade: number
        reference_label: string
        display_order: number
      }>()
    return row
      ? {
          floatingLessonReferenceLabelId: row.floating_lesson_reference_label_id,
          schoolYear: row.school_year,
          grade: row.grade,
          referenceLabel: row.reference_label,
          displayOrder: row.display_order,
        }
      : null
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

export function createInMemoryPersistenceAdapters(): PersistenceAdapters {
  const implementation = new InMemoryPersistenceAdapters()

  return {
    studentAccount: implementation,
    studentAffiliation: implementation,
    dailyPlan: implementation,
    directChange: implementation,
    directTimetableChange: implementation,
    timetableChangeHistory: implementation,
    taskEditHistory: implementation,
    noteEditHistory: implementation,
    seed: implementation,
  }
}

export function createD1PersistenceAdapters(db: D1Database): PersistenceAdapters {
  const implementation = new D1PersistenceAdapters(db)

  return {
    studentAccount: implementation,
    studentAffiliation: implementation,
    dailyPlan: implementation,
    directChange: implementation,
    directTimetableChange: implementation,
    timetableChangeHistory: implementation,
    taskEditHistory: implementation,
    noteEditHistory: implementation,
    seed: implementation,
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
    registeredLessonNameId: row.registered_lesson_name_id,
    lessonName: row.lesson_name,
  }
}

function mapFloatingStandardTimetableEntryRow(
  row: StandardTimetableEntryRow,
): FloatingStandardTimetableEntry {
  if (
    row.reference_type !== 'floating' ||
    row.reference_label === null ||
    row.floating_lesson_reference_label_id === null
  ) {
    throw new Error('invalid floating Standard Timetable entry')
  }

  return {
    standardTimetableEntryId: row.standard_timetable_entry_id,
    classId: row.class_id,
    trackId: row.track_id,
    referenceType: 'floating',
    referenceLabel: row.reference_label,
    floatingLessonReferenceLabelId: row.floating_lesson_reference_label_id,
    registeredLessonNameId: row.registered_lesson_name_id,
    lessonName: row.lesson_name,
  }
}

function mapTargetScopeRow(
  row: Pick<
    ActiveTimetableChangeRow,
    | 'school_year'
    | 'scope_type'
    | 'grade'
    | 'class_id'
    | 'track_id'
    | 'student_account_id'
  >,
): TargetScope {
  if (row.scope_type === 'grade' && row.grade !== null) {
    return { type: 'grade', schoolYear: row.school_year, grade: row.grade }
  }
  if (row.scope_type === 'class' && row.class_id !== null) {
    return { type: 'class', schoolYear: row.school_year, classId: row.class_id }
  }
  if (row.scope_type === 'track' && row.track_id !== null) {
    return { type: 'track', schoolYear: row.school_year, trackId: row.track_id }
  }
  if (row.scope_type === 'student' && row.student_account_id !== null) {
    return {
      type: 'student',
      schoolYear: row.school_year,
      studentAccountId: row.student_account_id,
    }
  }
  throw new Error('invalid single-part Target Scope')
}

function mapActiveTimetableChangeRow(
  row: ActiveTimetableChangeRow,
): ActiveTimetableChange {
  let replacement: TimetableChangeReplacement

  if (row.replacement_type === 'lesson_name') {
    replacement = {
      type: 'lesson_name',
      lessonName: row.replacement_lesson_name ?? '',
      ...(row.registered_lesson_name_id
        ? { registeredLessonNameId: row.registered_lesson_name_id }
        : {}),
    }
  } else if (row.replacement_type === 'period_reference') {
    replacement = {
      type: 'period_reference',
      weekday: row.reference_weekday ?? 0,
      periodNumber: row.reference_period_number ?? 0,
    }
  } else if (row.replacement_type === 'floating_lesson_reference') {
    replacement = {
      type: 'floating_lesson_reference',
      floatingLessonReferenceLabelId:
        row.floating_lesson_reference_label_id ?? row.reference_label ?? '',
    }
  } else {
    replacement = { type: 'cancelled' }
  }

  return {
    sourceId: row.source_id,
    sharedInformationItemId: row.shared_information_item_id,
    latestChangeId: row.shared_information_change_id,
    targetScope: mapTargetScopeRow(row),
    changeDate: row.change_date,
    periodNumber: row.period_number,
    replacement,
    changedByStudentAccountId: row.changed_by_student_account_id,
    changedAt: Date.parse(row.changed_at),
  }
}

function mapActiveTaskRow(row: ActiveTaskRow): ActiveTask {
  return {
    sourceId: row.source_id,
    sharedInformationItemId: row.shared_information_item_id,
    latestChangeId: row.shared_information_change_id,
    targetScope: mapTargetScopeRow(row),
    title: row.title,
    dueDate: row.due_date,
    relatedLessonName: row.related_lesson_name
      ? {
          lessonName: row.related_lesson_name,
          ...(row.registered_related_lesson_name_id
            ? {
                registeredLessonNameId:
                  row.registered_related_lesson_name_id,
              }
            : {}),
        }
      : null,
    changedByStudentAccountId: row.changed_by_student_account_id,
    changedAt: Date.parse(row.changed_at),
    createdAt: Date.parse(row.created_at),
  }
}

function mapActiveNoteRow(row: ActiveNoteRow): ActiveNote {
  return {
    sourceId: row.source_id,
    sharedInformationItemId: row.shared_information_item_id,
    latestChangeId: row.shared_information_change_id,
    targetScope: mapTargetScopeRow(row),
    schoolDate: row.related_school_date,
    periodNumber: row.related_period_number,
    ...(row.related_task_item_id
      ? { relatedTaskItemId: row.related_task_item_id }
      : {}),
    body: row.body,
    changedByStudentAccountId: row.changed_by_student_account_id,
    changedAt: Date.parse(row.changed_at),
    createdAt: Date.parse(row.created_at),
  }
}

function mapStoredDirectNoteOperation(
  row: StoredDirectNoteOperationRow,
): Extract<DirectChangeOperation, { kind: 'note' }> {
  const common = {
    kind: 'note' as const,
    sourceId: row.source_id,
    sharedInformationItemId: row.shared_information_item_id,
    latestChangeId: row.shared_information_change_id,
    targetScope: mapTargetScopeRow(row),
    changedByStudentAccountId: row.changed_by_student_account_id,
    changedAt: Date.parse(row.changed_at),
  }
  if (row.change_kind === 'remove') {
    return {
      ...common,
      changeKind: 'remove',
      expectedLatestChangeId: row.preceding_change_id ?? '',
      removalReason: row.removal_reason ?? 'student',
    }
  }
  if (row.change_kind === 'update') {
    return {
      ...common,
      changeKind: 'update',
      expectedLatestChangeId: row.preceding_change_id ?? '',
      body: row.body ?? '',
    }
  }
  return {
    ...common,
    changeKind: 'add',
    schoolDate: row.related_school_date,
    periodNumber: row.related_period_number,
    ...(row.related_task_item_id
      ? { relatedTaskItemId: row.related_task_item_id }
      : {}),
    body: row.body ?? '',
    createdAt: Date.parse(row.created_at),
  }
}

function mapStoredDirectTaskOperation(
  row: StoredDirectTaskOperationRow,
): Extract<DirectChangeOperation, { kind: 'task' }> {
  const base = {
    kind: 'task' as const,
    sourceId: row.source_id,
    sharedInformationItemId: row.shared_information_item_id,
    latestChangeId: row.shared_information_change_id,
    targetScope: mapTargetScopeRow(row),
    changedByStudentAccountId: row.changed_by_student_account_id,
    changedAt: Date.parse(row.changed_at),
  }
  if (row.change_kind === 'remove') {
    return {
      ...base,
      changeKind: 'remove',
      expectedLatestChangeId: row.preceding_change_id ?? '',
    }
  }
  const snapshot = {
    title: row.title ?? '',
    dueDate: row.due_date,
    relatedLessonName: row.related_lesson_name
      ? {
          lessonName: row.related_lesson_name,
          ...(row.registered_related_lesson_name_id
            ? {
                registeredLessonNameId:
                  row.registered_related_lesson_name_id,
              }
            : {}),
        }
      : null,
  }
  return row.change_kind === 'update'
    ? {
        ...base,
        ...snapshot,
        changeKind: 'update',
        expectedLatestChangeId: row.preceding_change_id ?? '',
      }
    : {
        ...base,
        ...snapshot,
        changeKind: 'add',
        createdAt: Date.parse(row.created_at),
      }
}

function mapHistoricalTimetableChangeRow(
  row: HistoricalTimetableChangeRow,
): HistoricalTimetableChange {
  let replacement: HistoricalTimetableChangeReplacement | null = null
  if (row.replacement_type === 'lesson_name') {
    replacement = {
      type: 'lesson_name',
      lessonName: row.replacement_lesson_name ?? '',
      ...(row.registered_lesson_name_id
        ? { registeredLessonNameId: row.registered_lesson_name_id }
        : {}),
    }
  } else if (row.replacement_type === 'period_reference') {
    replacement = {
      type: 'period_reference',
      weekday: row.reference_weekday ?? 0,
      periodNumber: row.reference_period_number ?? 0,
    }
  } else if (row.replacement_type === 'floating_lesson_reference') {
    replacement = {
      type: 'floating_lesson_reference',
      floatingLessonReferenceLabelId:
        row.floating_lesson_reference_label_id ?? row.reference_label ?? '',
      referenceLabel: row.reference_label ?? '',
    }
  } else if (row.replacement_type === 'cancelled') {
    replacement = { type: 'cancelled' }
  }
  return {
    sharedInformationChangeId: row.shared_information_change_id,
    sharedInformationItemId: row.shared_information_item_id,
    changeKind: row.change_kind,
    sourceType: row.source_type,
    targetScope: mapTargetScopeRow(row),
    changeDate: row.change_date,
    periodNumber: row.period_number,
    primaryActorDisplayName: row.display_name,
    changedAt: Date.parse(row.changed_at),
    precedingChangeId: row.preceding_change_id,
    replacement,
  }
}

function mapHistoricalTaskChangeRow(
  row: HistoricalTaskChangeRow,
): HistoricalTaskChange {
  const change = {
    sharedInformationChangeId: row.shared_information_change_id,
    sharedInformationItemId: row.shared_information_item_id,
    changeKind: row.change_kind,
    targetScope: mapTargetScopeRow(row),
    changedAt: Date.parse(row.changed_at),
    precedingChangeId: row.preceding_change_id,
    snapshot: row.change_kind === 'remove'
      ? null
      : {
          title: row.title ?? '',
          dueDate: row.due_date,
          relatedLessonName: row.related_lesson_name,
        },
  }
  return row.source_type === 'direct'
    ? {
        ...change,
        sourceType: 'direct',
        primaryActorDisplayName: row.display_name,
      }
    : { ...change, sourceType: 'proposal' }
}

function mapHistoricalNoteChangeRow(
  row: HistoricalNoteChangeRow,
): HistoricalNoteChange {
  return {
    sharedInformationChangeId: row.shared_information_change_id,
    sharedInformationItemId: row.shared_information_item_id,
    changeKind: row.change_kind,
    sourceType: 'direct',
    targetScope: mapTargetScopeRow(row),
    primaryActorDisplayName: row.display_name,
    changedAt: Date.parse(row.changed_at),
    precedingChangeId: row.preceding_change_id,
    snapshot: row.change_kind === 'remove'
      ? null
      : { body: row.body ?? '' },
    removalReason: row.removal_reason,
  }
}

function mapRegisteredLessonNameRow(row: {
  registered_lesson_name_id: string
  full_lesson_name: string
  short_lesson_name: string
  normalized_full_lesson_name: string
}): RegisteredLessonName {
  return {
    registeredLessonNameId: row.registered_lesson_name_id,
    fullLessonName: row.full_lesson_name,
    shortLessonName: row.short_lesson_name,
    normalizedFullLessonName: row.normalized_full_lesson_name,
  }
}

function targetScopeColumns(change: Pick<ActiveTimetableChange | ActiveTask | ActiveNote, 'targetScope'>) {
  const { targetScope } = change
  return {
    grade: targetScope.type === 'grade' ? targetScope.grade : null,
    classId: targetScope.type === 'class' ? targetScope.classId : null,
    trackId: targetScope.type === 'track' ? targetScope.trackId : null,
    studentAccountId:
      targetScope.type === 'student' ? targetScope.studentAccountId : null,
  }
}

function exactTargetScopeQuery(
  targetScope: Exclude<TargetScope, { type: 'student' }>,
) {
  if (targetScope.type === 'grade') {
    return { scopeColumn: 'p.grade', scopeValue: targetScope.grade }
  }
  if (targetScope.type === 'class') {
    return { scopeColumn: 'p.class_id', scopeValue: targetScope.classId }
  }
  return { scopeColumn: 'p.track_id', scopeValue: targetScope.trackId }
}

function activeTimetableChangeSlotKey(change: Pick<
  ActiveTimetableChange,
  'targetScope' | 'changeDate' | 'periodNumber'
>) {
  return [
    change.targetScope.schoolYear,
    change.targetScope.type,
    targetScopeValue(change.targetScope),
    change.changeDate,
    change.periodNumber,
  ].join(':')
}

function sameTimetableChangeSlot(
  left: Pick<ActiveTimetableChange, 'targetScope' | 'changeDate' | 'periodNumber'>,
  right: Pick<ActiveTimetableChange, 'targetScope' | 'changeDate' | 'periodNumber'>,
) {
  return targetScopesEqual(left.targetScope, right.targetScope) &&
    left.changeDate === right.changeDate &&
    left.periodNumber === right.periodNumber
}

function sameDirectChangeBase(
  left: Omit<ActiveTimetableChange, 'replacement'>,
  right: Omit<ActiveTimetableChange, 'replacement'>,
) {
  return (
    left.sourceId === right.sourceId &&
    targetScopesEqual(left.targetScope, right.targetScope) &&
    left.changeDate === right.changeDate &&
    left.periodNumber === right.periodNumber &&
    left.changedByStudentAccountId === right.changedByStudentAccountId
  )
}

function mapStoredDirectOperation(
  row: ActiveTimetableChangeRow,
): DirectTimetableChangeOperation {
  const active = mapActiveTimetableChangeRow(row)
  const { replacement: activeReplacement, ...base } = active
  return row.change_kind === 'remove'
    ? {
        ...base,
        changeKind: 'remove',
        expectedLatestChangeId: row.expected_latest_change_id ?? '',
      }
    : row.change_kind === 'update'
    ? {
        ...base,
        replacement: activeReplacement,
        changeKind: 'update',
        expectedLatestChangeId: row.expected_latest_change_id ?? '',
      }
    : {
        ...base,
        replacement: activeReplacement,
        changeKind: 'add',
      }
}

function sameDirectOperationPayload(
  left: DirectTimetableChangeOperation,
  right: DirectTimetableChangeOperation,
) {
  return (
    left.changeKind === right.changeKind &&
    left.sharedInformationItemId === right.sharedInformationItemId &&
    left.expectedLatestChangeId === right.expectedLatestChangeId &&
    sameDirectChangeBase(left, right) &&
    (left.changeKind === 'remove' || right.changeKind === 'remove'
      ? left.changeKind === right.changeKind
      : timetableReplacementsEqual(left.replacement, right.replacement))
  )
}

function sameDirectChangeOperationPayload(
  left: DirectChangeOperation | DirectTimetableChangeOperation,
  right: DirectChangeOperation,
) {
  const leftKind = 'kind' in left ? left.kind : 'timetable_change'
  if (leftKind !== right.kind) return false
  if (right.kind === 'timetable_change') {
    const leftTimetable = ('kind' in left ? left : { ...left, kind: leftKind }) as
      Extract<DirectChangeOperation, { kind: 'timetable_change' }>
    return sameDirectOperationPayload(leftTimetable, right)
  }
  if (right.kind === 'note') {
    if (!('kind' in left) || left.kind !== 'note') return false
    const sameBase =
      left.changeKind === right.changeKind &&
      left.sourceId === right.sourceId &&
      left.sharedInformationItemId === right.sharedInformationItemId &&
      targetScopesEqual(left.targetScope, right.targetScope) &&
      left.changedByStudentAccountId === right.changedByStudentAccountId
    if (!sameBase || left.changeKind !== right.changeKind) return false
    if (left.changeKind === 'add' && right.changeKind === 'add') {
      return left.schoolDate === right.schoolDate &&
        left.periodNumber === right.periodNumber &&
        left.relatedTaskItemId === right.relatedTaskItemId &&
        left.body === right.body
    }
    if (left.changeKind === 'update' && right.changeKind === 'update') {
      return left.expectedLatestChangeId === right.expectedLatestChangeId &&
        left.body === right.body
    }
    return left.changeKind === 'remove' && right.changeKind === 'remove' &&
      left.expectedLatestChangeId === right.expectedLatestChangeId &&
      left.removalReason === right.removalReason
  }
  if (!('kind' in left) || left.kind !== 'task') return false
  return left.changeKind === right.changeKind &&
    left.sourceId === right.sourceId &&
    left.sharedInformationItemId === right.sharedInformationItemId &&
    left.expectedLatestChangeId === right.expectedLatestChangeId &&
    targetScopesEqual(left.targetScope, right.targetScope) &&
    left.changedByStudentAccountId === right.changedByStudentAccountId &&
    (left.changeKind === 'remove' || right.changeKind === 'remove'
      ? left.changeKind === right.changeKind
      : left.title === right.title &&
        left.dueDate === right.dueDate &&
        left.relatedLessonName?.registeredLessonNameId ===
          right.relatedLessonName?.registeredLessonNameId &&
        left.relatedLessonName?.lessonName === right.relatedLessonName?.lessonName)
}

function compareActiveTasks(left: ActiveTask, right: ActiveTask) {
  if ((left.dueDate === null) !== (right.dueDate === null)) {
    return left.dueDate === null ? 1 : -1
  }
  if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt
  return right.sharedInformationItemId.localeCompare(left.sharedInformationItemId)
}

function compareActiveNotes(left: ActiveNote, right: ActiveNote) {
  if ((left.schoolDate === null) !== (right.schoolDate === null)) {
    return left.schoolDate === null ? 1 : -1
  }
  if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt
  return right.sharedInformationItemId.localeCompare(left.sharedInformationItemId)
}
