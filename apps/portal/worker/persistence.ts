// Domain-local seams share storage implementations without sharing caller interfaces.
import type { StudentOperationalContextStore } from './studentOperationalContext'
import type {
  TimetableReplacement as ProjectionTimetableReplacement,
} from '../shared/timetableProjection'
import { normalizeLessonName } from '../shared/lessonNames'
import type { TaskHistorySnapshot } from '../shared/taskEditHistory'
import type { NoteHistorySnapshot } from '../shared/noteEditHistory'
import {
  targetScopeReadAccessIncludes,
  targetScopesForReadAccess,
  targetScopeValue,
  targetScopesEqual,
  type TargetScopeReadAccess,
  type OwnTargetScopeAccess,
  type TargetScope,
  type TargetScopeType,
} from './targetScopePolicy'
import {
  persistenceIds as createPersistenceIds,
  sourceId,
  type AtomicChangeExecutor,
  type ChangeSource,
  type DirectChangeCatalog,
  type StudentAffiliationAssertion,
} from './sharedInformationChange/atomicProgram'
import type {
  MaterializedSharedInformationChange,
} from './sharedInformationChange/materializedChange'
import {
  createInMemoryAtomicChangeState,
  createInMemoryAtomicChangeExecutor,
  applyMaterializedChangesToInMemoryState,
} from './sharedInformationChange/inMemoryAtomicChangeExecutor'
import {
  applyMaterializedChangesToD1Backend,
  createD1AtomicChangeExecutor,
  createD1DirectChangeCatalog,
} from './sharedInformationChange/d1AtomicChangeExecutor'
import {
  changeSourceKey,
  studentAffiliationSatisfiesAssertion,
  timetableChangeSlotKey,
} from './sharedInformationChange/executionPolicy'
import {
  findInvalidReferenceSourceKeys,
} from './sharedInformationChange/referenceValidation'

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

export type InteractiveTestLoginTicket = {
  ticketTokenHash: string
  studentAccountId: string
  createdAt: number
  expiresAt: number
  consumedAt: number | null
  consumptionNonce: string | null
}

export type ConsumeInteractiveTestLoginTicketInput = {
  ticketTokenHash: string
  consumptionNonce: string
  sessionTokenHash: string
  enabled: boolean
  allowedStudentAccountIds: readonly string[]
  now: number
  sessionExpiresAt: number
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
  & {
    persistenceIds?: DirectChangePersistenceIds
  }

type DirectChangePersistenceIds = {
  snapshotId: string
  targetScopeId: string
  targetScopePartId: string
}

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
  persistenceIds?: DirectChangePersistenceIds
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

type DirectTaskUpdateOperation = DirectTaskOperationBase &
  DirectTaskSnapshot & {
    changeKind: 'update'
    expectedLatestChangeId: string
  }

type DirectTaskRemoveOperation = DirectTaskOperationBase & {
  changeKind: 'remove'
  expectedLatestChangeId: string
}

export type DirectTaskOperation =
  | DirectTaskAddOperation
  | DirectTaskUpdateOperation
  | DirectTaskRemoveOperation

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
> & {
  persistenceIds?: DirectChangePersistenceIds
}

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

type HistoricalNoteChangeBase = {
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changeKind: 'add' | 'update' | 'remove'
  targetScope: TargetScope
  changedAt: number
  precedingChangeId: string | null
  snapshot: NoteHistorySnapshot | null
  relatedContext:
    | { type: 'none' }
    | { type: 'school_date'; schoolDate: string }
    | {
        type: 'daily_lesson'
        schoolDate: string
        periodNumber: number
      }
    | { type: 'task'; taskItemId: string }
    | null
  removalReason: 'student' | 'task_cascade' | null
}

export type HistoricalNoteChange = HistoricalNoteChangeBase & (
  | { sourceType: 'direct'; primaryActorDisplayName: string }
  | { sourceType: 'proposal'; primaryActorDisplayName?: never }
)

export type CompleteInitialSetupTransactionInput = {
  setupSessionTokenHash: string
  schoolEmail: string
  studentAccountId: string
  studentAffiliationId: string
  displayName: string
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
  cleanupInteractiveTestLoginTickets(now: number): Promise<void>
  saveInteractiveTestLoginTicket(
    record: InteractiveTestLoginTicket,
  ): Promise<boolean>
  consumeInteractiveTestLoginTicket(
    input: ConsumeInteractiveTestLoginTicketInput,
  ): Promise<boolean>
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
  listActiveTimetableChanges(
    scopeAccess: TargetScopeReadAccess,
    start: string,
    end: string,
  ): Promise<ActiveTimetableChange[]>
  listActiveTasks(
    scopeAccess: TargetScopeReadAccess,
    start: string,
    end: string,
  ): Promise<ActiveTask[]>
  listActiveNotes(
    scopeAccess: TargetScopeReadAccess,
    start: string,
    end: string,
  ): Promise<ActiveNote[]>
}

export type DirectChangeOptionsStore = StudentOperationalContextStore & {
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

export type TimetableChangeHistoryStore = {
  listTimetableChangeHistory(input: {
    targetScope: TargetScope
    changeDate: string
    periodNumber: number
  }, scopeAccess: OwnTargetScopeAccess): Promise<HistoricalTimetableChange[]>
  listTimetableChangeItemHistory(
    sharedInformationItemId: string,
    scopeAccess: OwnTargetScopeAccess,
  ): Promise<HistoricalTimetableChange[]>
}

export type TaskEditHistoryStore = {
  listTaskEditHistory(
    sharedInformationItemId: string,
    scopeAccess: OwnTargetScopeAccess,
  ): Promise<HistoricalTaskChange[]>
}

export type NoteEditHistoryStore = {
  listNoteEditHistory(
    sharedInformationItemId: string,
    scopeAccess: OwnTargetScopeAccess,
  ): Promise<HistoricalNoteChange[]>
}

export type EditHistoryStore =
  & TaskEditHistoryStore
  & NoteEditHistoryStore
  & TimetableChangeHistoryStore
  & {
    findSharedInformationChange(
      sharedInformationChangeId: string,
      scopeAccess: OwnTargetScopeAccess,
    ): Promise<{
      kind: 'timetable_change' | 'task' | 'note'
      sharedInformationItemId: string
    } | null>
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
  directChangeOptions: DirectChangeOptionsStore
  directChangeCatalog: DirectChangeCatalog
  atomicChangeExecutor: AtomicChangeExecutor
  editHistory: EditHistoryStore
  seed: PersistenceSeedStore
}

export class InMemoryPersistenceAdapters
  implements
    StudentAccountAccessStore,
    StudentAffiliationSetupStore,
    DailyPlanStore,
    DirectChangeOptionsStore,
    TimetableChangeHistoryStore,
    TaskEditHistoryStore,
    NoteEditHistoryStore,
    EditHistoryStore
{
  private records: VerificationCodeRequestRecord[] = []
  private studentAccounts: StudentAccount[] = []
  private studentSessions: StudentSession[] = []
  private setupSessions: SetupSession[] = []
  private interactiveTestLoginTickets: InteractiveTestLoginTicket[] = []
  private schoolYears: SchoolYearRecord[] = []
  private schoolYearClasses: SchoolYearClassRecord[] = []
  private tracks: TrackRecord[] = []
  private registeredLessonNames: RegisteredLessonName[] = []
  private standardTimetableEntries: StandardTimetableEntrySeed[] = []
  readonly atomicChangeState = createInMemoryAtomicChangeState()
  private initialSetupDrafts = new Map<string, InitialSetupDraft>()
  private failNextAffiliationSave = false

  private get studentAffiliations() {
    return this.atomicChangeState.studentAffiliations
  }

  private set studentAffiliations(affiliations) {
    this.atomicChangeState.studentAffiliations = affiliations
  }

  private get activeTimetableChanges() {
    return this.atomicChangeState.activeTimetableChanges
  }

  private set activeTimetableChanges(changes) {
    this.atomicChangeState.activeTimetableChanges = changes
  }

  private get activeTasks() {
    return this.atomicChangeState.activeTasks
  }

  private set activeTasks(tasks) {
    this.atomicChangeState.activeTasks = tasks
  }

  private get activeNotes() {
    return this.atomicChangeState.activeNotes
  }

  private set activeNotes(notes) {
    this.atomicChangeState.activeNotes = notes
  }

  private get directTimetableChangeOperations() {
    return this.atomicChangeState.timetableOperations
  }

  private get directTaskOperations() {
    return this.atomicChangeState.taskOperations
  }

  private get directNoteOperations() {
    return this.atomicChangeState.noteOperations
  }

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

  async cleanupInteractiveTestLoginTickets(now: number) {
    this.interactiveTestLoginTickets = this.interactiveTestLoginTickets.filter(
      (ticket) => ticket.expiresAt > now && ticket.consumedAt === null,
    )
  }

  async saveInteractiveTestLoginTicket(record: InteractiveTestLoginTicket) {
    const studentExists = this.studentAccounts.some(
      (studentAccount) =>
        studentAccount.studentAccountId === record.studentAccountId,
    )

    if (!studentExists) return false

    this.interactiveTestLoginTickets.push(record)
    return true
  }

  async consumeInteractiveTestLoginTicket(
    input: ConsumeInteractiveTestLoginTicketInput,
  ) {
    const ticket = this.interactiveTestLoginTickets.find(
      (candidate) =>
        input.enabled &&
        input.allowedStudentAccountIds.includes(candidate.studentAccountId) &&
        candidate.ticketTokenHash === input.ticketTokenHash &&
        candidate.consumedAt === null &&
        candidate.expiresAt > input.now,
    )

    if (!ticket) return false

    ticket.consumedAt = input.now
    ticket.consumptionNonce = input.consumptionNonce
    this.studentSessions.push({
      sessionTokenHash: input.sessionTokenHash,
      studentAccountId: ticket.studentAccountId,
      createdAt: input.now,
      expiresAt: input.sessionExpiresAt,
      invalidatedAt: null,
    })
    return true
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
    const existingIndex = this.studentAffiliations.findIndex(
      (candidate) =>
        candidate.studentAffiliationId === record.studentAffiliationId,
    )
    if (existingIndex === -1) {
      this.studentAffiliations.push(record)
    } else {
      this.studentAffiliations[existingIndex] = record
    }
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

  async listActiveTimetableChanges(
    scopeAccess: TargetScopeReadAccess,
    start: string,
    end: string,
  ) {
    return this.activeTimetableChanges.filter((change) => {
      if (change.changeDate < start || change.changeDate > end) return false
      return targetScopeReadAccessIncludes(scopeAccess, change.targetScope)
    }).map((change) => ({
      ...change,
      replacement: change.replacement.type === 'lesson_name'
        ? this.resolveLessonNameReplacement(change.replacement)
        : change.replacement,
    }))
  }

  async listActiveTasks(
    scopeAccess: TargetScopeReadAccess,
    start: string,
    end: string,
  ) {
    return this.activeTasks
      .filter((task) =>
        (task.dueDate === null ||
          (task.dueDate >= start && task.dueDate <= end)) &&
        targetScopeReadAccessIncludes(scopeAccess, task.targetScope),
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

  async listActiveNotes(
    scopeAccess: TargetScopeReadAccess,
    start: string,
    end: string,
  ) {
    return this.activeNotes
      .filter((note) =>
        (note.relatedTaskItemId !== undefined ||
          note.schoolDate === null ||
          (note.schoolDate >= start && note.schoolDate <= end)) &&
        targetScopeReadAccessIncludes(scopeAccess, note.targetScope),
      )
      .sort(compareActiveNotes)
  }

  /** @internal Low-level storage contract hook; production uses the executor. */
  async commitDirectChangesForTest(
    changes: DirectChangeOperation[],
    affiliation?: StudentAffiliationAssertion,
  ) {
    const result = await applyMaterializedChangesToInMemoryState(
      this.atomicChangeState,
      changes.map(materializeDirectChange),
      affiliation,
      this,
    )
    return result.status === 'applied'
      ? { status: 'applied' as const, changes }
      : result
  }

  async listTimetableChangeHistory(input: {
    targetScope: TargetScope
    changeDate: string
    periodNumber: number
  }, scopeAccess: OwnTargetScopeAccess) {
    if (!targetScopeReadAccessIncludes(scopeAccess, input.targetScope)) return []
    return [...this.directTimetableChangeOperations.values()]
      .filter((change) =>
        targetScopesEqual(change.targetScope, input.targetScope) &&
        change.changeDate === input.changeDate &&
        change.periodNumber === input.periodNumber)
      .map((change) => this.mapHistoricalTimetableChange(change))
  }

  async listTimetableChangeItemHistory(
    sharedInformationItemId: string,
    scopeAccess: OwnTargetScopeAccess,
  ) {
    return [...this.directTimetableChangeOperations.values()]
      .filter((change) =>
        change.sharedInformationItemId === sharedInformationItemId &&
        targetScopeReadAccessIncludes(scopeAccess, change.targetScope))
      .map((change) => this.mapHistoricalTimetableChange(change))
  }

  async findSharedInformationChange(
    sharedInformationChangeId: string,
    scopeAccess: OwnTargetScopeAccess,
  ) {
    for (const [kind, changes] of [
      ['timetable_change', this.directTimetableChangeOperations],
      ['task', this.directTaskOperations],
      ['note', this.directNoteOperations],
    ] as const) {
      const selected = [...changes.values()].find(
        (change) =>
          change.latestChangeId === sharedInformationChangeId &&
          targetScopeReadAccessIncludes(scopeAccess, change.targetScope),
      )
      if (selected) {
        return {
          kind,
          sharedInformationItemId: selected.sharedInformationItemId,
        }
      }
    }
    return null
  }

  async listTaskEditHistory(
    sharedInformationItemId: string,
    scopeAccess: OwnTargetScopeAccess,
  ) {
    return [...this.directTaskOperations.values()]
      .filter((change) =>
        change.sharedInformationItemId === sharedInformationItemId &&
        targetScopeReadAccessIncludes(scopeAccess, change.targetScope))
      .map((change): HistoricalTaskChange => ({
        sharedInformationChangeId: change.latestChangeId,
        sharedInformationItemId: change.sharedInformationItemId,
        changeKind: change.changeKind,
        ...this.historicalChangeSource(change),
        targetScope: change.targetScope,
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

  async listNoteEditHistory(
    sharedInformationItemId: string,
    scopeAccess: OwnTargetScopeAccess,
  ) {
    const initial = [...this.directNoteOperations.values()].find(
      (
        change,
      ): change is Extract<
        MaterializedSharedInformationChange,
        { kind: 'note'; changeKind: 'add' }
      > =>
        change.sharedInformationItemId === sharedInformationItemId &&
        targetScopeReadAccessIncludes(scopeAccess, change.targetScope) &&
        change.changeKind === 'add',
    )
    const relatedContext = initial
      ? directNoteRelatedContext(initial)
      : null
    return [...this.directNoteOperations.values()]
      .filter((change) =>
        change.sharedInformationItemId === sharedInformationItemId &&
        targetScopeReadAccessIncludes(scopeAccess, change.targetScope))
      .map((change): HistoricalNoteChange => ({
        sharedInformationChangeId: change.latestChangeId,
        sharedInformationItemId: change.sharedInformationItemId,
        changeKind: change.changeKind,
        ...this.historicalChangeSource(change),
        targetScope: change.targetScope,
        changedAt: change.changedAt,
        precedingChangeId: change.changeKind === 'add'
          ? null
          : change.expectedLatestChangeId,
        snapshot: change.changeKind === 'remove'
          ? null
          : { body: change.body },
        relatedContext,
        removalReason: change.changeKind === 'remove'
          ? change.removalReason
          : null,
      }))
  }

  private mapHistoricalTimetableChange(
    change: Extract<
      MaterializedSharedInformationChange,
      { kind: 'timetable_change' }
    >,
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
      sourceType: change.source.type,
      targetScope: change.targetScope,
      changeDate: change.changeDate,
      periodNumber: change.periodNumber,
      primaryActorDisplayName: this.studentAccounts.find(
        (student) =>
          student.studentAccountId === change.changedByStudentAccountId,
      )?.displayName ?? '',
      changedAt: change.changedAt,
      precedingChangeId: change.changeKind === 'add'
        ? null
        : change.expectedLatestChangeId,
      replacement,
    }
  }

  private historicalChangeSource(change: {
    source: ChangeSource
    changedByStudentAccountId: string
  }):
    | { sourceType: 'direct'; primaryActorDisplayName: string }
    | { sourceType: 'proposal' } {
    if (change.source.type === 'proposal') {
      return { sourceType: 'proposal' }
    }
    return {
      sourceType: 'direct',
      primaryActorDisplayName: this.studentAccounts.find(
        (student) =>
          student.studentAccountId === change.changedByStudentAccountId,
      )?.displayName ?? '',
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
  source_type?: 'direct' | 'proposal'
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

type StoredNoteOperationRow = Omit<ActiveNoteRow, 'body'> & {
  source_type: 'direct' | 'proposal'
  change_kind: 'add' | 'update' | 'remove'
  preceding_change_id: string | null
  body: string | null
  removal_reason: 'student' | 'task_cascade' | null
}

type StoredTaskOperationRow = Omit<
  ActiveTaskRow,
  'title' | 'due_date' | 'related_lesson_name' |
  'registered_related_lesson_name_id'
> & {
  source_type: 'direct' | 'proposal'
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
  body: string | null
  related_context_type:
    | 'none' | 'school_date' | 'daily_lesson' | 'task' | null
  related_school_date: string | null
  related_period_number: number | null
  related_task_item_id: string | null
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
    DirectChangeOptionsStore,
    TimetableChangeHistoryStore,
    TaskEditHistoryStore,
    NoteEditHistoryStore,
    EditHistoryStore
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

  async cleanupInteractiveTestLoginTickets(now: number) {
    await this.db
      .prepare(
        `delete from interactive_test_login_tickets
         where expires_at <= ? or consumed_at is not null`,
      )
      .bind(now)
      .run()
  }

  async saveInteractiveTestLoginTicket(record: InteractiveTestLoginTicket) {
    await this.db
      .prepare(
        `insert into interactive_test_login_tickets (
          interactive_test_login_ticket_id,
          ticket_token_hash,
          student_account_id,
          created_at,
          expires_at,
          consumed_at,
          consumption_nonce
        )
        select ?, ?, student_account_id, ?, ?, ?, ?
        from student_accounts
        where student_account_id = ? and disabled_at is null`,
      )
      .bind(
        crypto.randomUUID(),
        record.ticketTokenHash,
        record.createdAt,
        record.expiresAt,
        record.consumedAt,
        record.consumptionNonce,
        record.studentAccountId,
      )
      .run()

    const saved = await this.db
      .prepare(
        `select ticket_token_hash
         from interactive_test_login_tickets
         where ticket_token_hash = ?`,
      )
      .bind(record.ticketTokenHash)
      .first<{ ticket_token_hash: string }>()

    return saved !== null
  }

  async consumeInteractiveTestLoginTicket(
    input: ConsumeInteractiveTestLoginTicketInput,
  ) {
    const allowListPlaceholders = input.allowedStudentAccountIds
      .map(() => '?')
      .join(', ')

    if (!allowListPlaceholders) return false

    await this.db.batch([
      this.db
        .prepare(
          `update interactive_test_login_tickets
           set consumed_at = ?, consumption_nonce = ?
           where ticket_token_hash = ?
             and consumed_at is null
             and expires_at > ?
             and ? = 1
             and student_account_id in (${allowListPlaceholders})`,
        )
        .bind(
          input.now,
          input.consumptionNonce,
          input.ticketTokenHash,
          input.now,
          input.enabled ? 1 : 0,
          ...input.allowedStudentAccountIds,
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
          )
          select ?, ?, student_account_id, ?, ?, null
          from interactive_test_login_tickets
          where ticket_token_hash = ?
            and consumption_nonce = ?
            and consumed_at = ?`,
        )
        .bind(
          crypto.randomUUID(),
          input.sessionTokenHash,
          input.now,
          input.sessionExpiresAt,
          input.ticketTokenHash,
          input.consumptionNonce,
          input.now,
        ),
    ])

    const session = await this.findStudentSessionByTokenHash(
      input.sessionTokenHash,
    )
    return session !== null
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
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(student_affiliation_id) do update set
          student_account_id = excluded.student_account_id,
          school_year = excluded.school_year,
          grade = excluded.grade,
          class_id = excluded.class_id,
          track_id = excluded.track_id,
          selected_at = excluded.selected_at,
          ended_at = excluded.ended_at`,
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

  async listActiveTimetableChanges(
    scopeAccess: TargetScopeReadAccess,
    start: string,
    end: string,
  ) {
    const scopeQuery = targetScopeAccessQuery(scopeAccess)
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
           and t.change_date between ? and ?
           and (${scopeQuery.sql})`,
      )
      .bind(start, end, ...scopeQuery.bindings)
      .all<ActiveTimetableChangeRow>()

    return results.map(mapActiveTimetableChangeRow)
  }

  async listActiveTasks(
    scopeAccess: TargetScopeReadAccess,
    start: string,
    end: string,
  ) {
    const scopeQuery = targetScopeAccessQuery(scopeAccess)
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
           and (task.due_date is null or task.due_date between ? and ?)
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1
           and (${scopeQuery.sql})
         order by (task.due_date is null) asc, i.created_at desc,
                  i.shared_information_item_id desc`,
      )
      .bind(
        start,
        end,
        ...scopeQuery.bindings,
      )
      .all<ActiveTaskRow>()
    return results.map(mapActiveTaskRow)
  }

  async listActiveNotes(
    scopeAccess: TargetScopeReadAccess,
    start: string,
    end: string,
  ) {
    const scopeQuery = targetScopeAccessQuery(scopeAccess)
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
               and note.related_school_date between ? and ?))
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1
           and (${scopeQuery.sql})
         order by case when note.related_context_type = 'school_date'
                   then 0 else 1 end,
                  i.created_at desc, i.shared_information_item_id desc`,
      )
      .bind(
        start,
        end,
        ...scopeQuery.bindings,
      )
      .all<ActiveNoteRow>()
    return results.map(mapActiveNoteRow)
  }

  async loadAtomicExecutionSnapshot(
    changes: readonly MaterializedSharedInformationChange[],
    affiliation?: StudentAffiliationAssertion,
  ) {
    const timetableChanges = changes.filter(
      (change): change is Extract<
        MaterializedSharedInformationChange,
        { kind: 'timetable_change' }
      > => change.kind === 'timetable_change',
    )
    const taskChanges = changes.filter(
      (change): change is Extract<
        MaterializedSharedInformationChange,
        { kind: 'task' }
      > => change.kind === 'task',
    )
    const noteChanges = changes.filter(
      (change): change is Extract<
        MaterializedSharedInformationChange,
        { kind: 'note' }
      > => change.kind === 'note',
    )
    const relatedTaskItemIds = noteChanges.flatMap((change) =>
      change.changeKind === 'add' && change.relatedTaskItemId
        ? [change.relatedTaskItemId]
        : [],
    )
    const [
      storedTimetable,
      storedTasks,
      storedNotes,
      activeTimetable,
      activeTasks,
      activeNotes,
      currentAffiliation,
    ] = await Promise.all([
      this.findTimetableChangesBySources(changes),
      this.findTaskOperationsBySources(changes),
      this.findNoteOperationsBySources(changes),
      this.findActiveTimetableChangesByItemIds(
        timetableChanges
          .filter((change) => change.changeKind !== 'add')
          .map((change) => change.sharedInformationItemId),
      ),
      this.findActiveTasksByItemIds([
        ...new Set([
          ...taskChanges
            .filter((change) => change.changeKind !== 'add')
            .map((change) => change.sharedInformationItemId),
          ...relatedTaskItemIds,
        ]),
      ]),
      this.findActiveNotesByItemIds(
        noteChanges
          .filter((change) => change.changeKind !== 'add')
          .map((change) => change.sharedInformationItemId),
      ),
      affiliation
        ? this.findCurrentStudentAffiliation(
            affiliation.studentAccountId,
            affiliation.schoolYear,
          )
        : Promise.resolve(null),
    ])
    const addSlotKeys = timetableChanges
      .filter((change) => change.changeKind === 'add')
      .map(timetableChangeSlotKey)
    const occupiedTimetableSlots = new Set<string>()
    if (addSlotKeys.length > 0) {
      const placeholders = addSlotKeys.map(() => '?').join(', ')
      const { results } = await this.db.prepare(
        `select timetable_change_slot_key
         from active_timetable_change_slots
         where timetable_change_slot_key in (${placeholders})`,
      ).bind(...addSlotKeys).all<{
        timetable_change_slot_key: string
      }>()
      results.forEach((row) =>
        occupiedTimetableSlots.add(row.timetable_change_slot_key))
    }
    const addItemIds = [
      ...new Set(
        changes
          .filter((change) => change.changeKind === 'add')
          .map((change) => change.sharedInformationItemId),
      ),
    ]
    const occupiedItemIds = new Set<string>()
    if (addItemIds.length > 0) {
      const placeholders = addItemIds.map(() => '?').join(', ')
      const { results } = await this.db.prepare(
        `select shared_information_item_id
         from shared_information_items
         where shared_information_item_id in (${placeholders})`,
      ).bind(...addItemIds).all<{
        shared_information_item_id: string
      }>()
      results.forEach((row) =>
        occupiedItemIds.add(row.shared_information_item_id))
    }
    const existingBySource = new Map<string, MaterializedSharedInformationChange>([
      ...storedTimetable.map((change) => [
        changeSourceKey(change),
        { ...change, kind: 'timetable_change' as const },
      ] as const),
      ...storedTasks.map((change) => [
        changeSourceKey(change),
        change,
      ] as const),
      ...storedNotes.map((change) => [
        changeSourceKey(change),
        change,
      ] as const),
    ])
    const pendingReferenceChanges = changes.filter(
      (change) => !existingBySource.has(changeSourceKey(change)),
    )

    return {
      existingBySource,
      activeTimetableByItem: new Map(
        activeTimetable.map((change) => [
          change.sharedInformationItemId,
          change,
        ]),
      ),
      activeTaskByItem: new Map(
        activeTasks.map((change) => [
          change.sharedInformationItemId,
          change,
        ]),
      ),
      activeNoteByItem: new Map(
        activeNotes.map((change) => [
          change.sharedInformationItemId,
          change,
        ]),
      ),
      occupiedItemIds,
      occupiedTimetableSlots,
      invalidReferenceSourceKeys: await findInvalidReferenceSourceKeys(
        pendingReferenceChanges,
        this,
        affiliation,
      ),
      affiliationMatches: !affiliation ||
        (!!currentAffiliation &&
          studentAffiliationSatisfiesAssertion(
            currentAffiliation,
            affiliation,
          )),
    }
  }

  async commitAtomicChanges(
    pending: readonly MaterializedSharedInformationChange[],
    affiliation?: StudentAffiliationAssertion,
  ) {
    const statements: D1PreparedStatement[] = affiliation
      ? [studentAffiliationGuardStatement(this.db, affiliation)]
      : []
    const orderedPending = [
      ...pending.filter((change) =>
        change.kind === 'task' && change.changeKind === 'add'),
      ...pending.filter((change) =>
        !(change.kind === 'task' && change.changeKind === 'add')),
    ]
    for (const change of orderedPending) {
      const sourceType = change.source.type
      const operationSourceId = sourceId(change.source)
      const persistenceSourceNamespace = sourceType === 'direct'
        ? operationSourceId
        : `proposal:${operationSourceId}`
      const targetScopeId =
        change.persistenceIds?.targetScopeId ??
          `${persistenceSourceNamespace}:scope`
      const snapshotId =
        change.persistenceIds?.snapshotId ??
          `${persistenceSourceNamespace}:snapshot`
      const sharedChangeId = change.latestChangeId
      const createdAt = new Date(change.changedAt).toISOString()
      if (
        affiliation &&
        change.kind === 'timetable_change' &&
        change.changeKind !== 'remove' &&
        change.replacement.type === 'floating_lesson_reference'
      ) {
        statements.push(floatingReferenceGuardStatement(
          this.db,
          change.replacement.floatingLessonReferenceLabelId,
          affiliation.schoolYear,
          affiliation.grade,
        ))
      }
      if (change.kind === 'note') {
        if (change.changeKind === 'add') {
          if (change.relatedTaskItemId) {
            statements.push(
              this.db.prepare(`insert into note_snapshots (note_snapshot_id, body, related_context_type, related_school_date, related_period_number, related_task_item_id, created_at) select ?, ?, 'task', null, null, ?, ? from shared_information_items where shared_information_item_id = ? and kind = 'task' and removed_at is null`).bind(snapshotId, change.body, change.relatedTaskItemId, createdAt, change.relatedTaskItemId),
              this.db.prepare(`insert into shared_information_items (shared_information_item_id, kind, target_scope_id, latest_change_id, current_task_snapshot_id, current_timetable_change_snapshot_id, current_note_snapshot_id, created_by_student_account_id, created_at, removed_at) select ?, 'note', target_scope_id, null, null, null, ?, ?, ?, null from shared_information_items where shared_information_item_id = ? and kind = 'task' and removed_at is null`).bind(change.sharedInformationItemId, snapshotId, change.changedByStudentAccountId, createdAt, change.relatedTaskItemId),
              this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id, note_snapshot_id) values (?, ?, 'add', ?, ?, ?, ?, null, null, ?)`).bind(sharedChangeId, change.sharedInformationItemId, sourceType, operationSourceId, change.changedByStudentAccountId, createdAt, snapshotId),
              this.db.prepare(`update shared_information_items set latest_change_id = ? where shared_information_item_id = ?`).bind(sharedChangeId, change.sharedInformationItemId),
            )
          } else {
            const part = targetScopeColumns(change)
            statements.push(
              this.db.prepare(`insert into target_scopes (target_scope_id, school_year, created_at) values (?, ?, ?)`).bind(targetScopeId, change.targetScope.schoolYear, createdAt),
              this.db.prepare(`insert into target_scope_parts (target_scope_part_id, target_scope_id, scope_type, grade, class_id, track_id, student_account_id) values (?, ?, ?, ?, ?, ?, ?)`).bind(change.persistenceIds?.targetScopePartId ?? `${persistenceSourceNamespace}:part`, targetScopeId, change.targetScope.type, part.grade, part.classId, part.trackId, part.studentAccountId),
              this.db.prepare(`insert into note_snapshots (note_snapshot_id, body, related_context_type, related_school_date, related_period_number, related_task_item_id, created_at) values (?, ?, ?, ?, ?, null, ?)`).bind(snapshotId, change.body, change.schoolDate === null ? 'none' : change.periodNumber == null ? 'school_date' : 'daily_lesson', change.schoolDate, change.periodNumber ?? null, createdAt),
              this.db.prepare(`insert into shared_information_items (shared_information_item_id, kind, target_scope_id, latest_change_id, current_task_snapshot_id, current_timetable_change_snapshot_id, current_note_snapshot_id, created_by_student_account_id, created_at, removed_at) values (?, 'note', ?, null, null, null, ?, ?, ?, null)`).bind(change.sharedInformationItemId, targetScopeId, snapshotId, change.changedByStudentAccountId, createdAt),
              this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id, note_snapshot_id) values (?, ?, 'add', ?, ?, ?, ?, null, null, ?)`).bind(sharedChangeId, change.sharedInformationItemId, sourceType, operationSourceId, change.changedByStudentAccountId, createdAt, snapshotId),
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
            this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id, note_snapshot_id, preceding_change_id) values (?, ?, 'update', ?, ?, ?, ?, null, null, ?, ?)`).bind(sharedChangeId, change.sharedInformationItemId, sourceType, operationSourceId, change.changedByStudentAccountId, createdAt, snapshotId, change.expectedLatestChangeId),
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
                 ), 'remove', ?, ?, ?, ?, null, null, null, ?, ?)`,
            ).bind(
              sharedChangeId,
              change.sharedInformationItemId,
              change.expectedLatestChangeId,
              sourceType,
              operationSourceId,
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
            this.db.prepare(`insert into target_scope_parts (target_scope_part_id, target_scope_id, scope_type, grade, class_id, track_id, student_account_id) values (?, ?, ?, ?, ?, ?, ?)`).bind(change.persistenceIds?.targetScopePartId ?? `${persistenceSourceNamespace}:part`, targetScopeId, change.targetScope.type, part.grade, part.classId, part.trackId, part.studentAccountId),
            this.db.prepare(`insert into task_snapshots (task_snapshot_id, title, due_date, registered_related_lesson_name_id, related_lesson_name, normalized_custom_lesson_name, created_at) values (?, ?, ?, ?, ?, ?, ?)`).bind(...taskSnapshotValues!),
            this.db.prepare(`insert into shared_information_items (shared_information_item_id, kind, target_scope_id, latest_change_id, current_task_snapshot_id, current_timetable_change_snapshot_id, created_by_student_account_id, created_at, removed_at) values (?, 'task', ?, null, ?, null, ?, ?, null)`).bind(change.sharedInformationItemId, targetScopeId, snapshotId, change.changedByStudentAccountId, createdAt),
            this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id) values (?, ?, 'add', ?, ?, ?, ?, ?, null)`).bind(sharedChangeId, change.sharedInformationItemId, sourceType, operationSourceId, change.changedByStudentAccountId, createdAt, snapshotId),
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
            this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id, preceding_change_id) values (?, ?, 'update', ?, ?, ?, ?, ?, null, ?)`).bind(sharedChangeId, change.sharedInformationItemId, sourceType, operationSourceId, change.changedByStudentAccountId, createdAt, snapshotId, change.expectedLatestChangeId),
            this.db.prepare(`update shared_information_items set latest_change_id = ?, current_task_snapshot_id = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, snapshotId, change.sharedInformationItemId, change.expectedLatestChangeId),
          )
        } else {
          statements.push(
            taskCascadeCauseGuardStatement(
              this.db,
              change.cascade.cause.causedByChangeId,
              sharedChangeId,
            ),
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
                      'remove', ?,
                      ? || ':task-cascade:' || note_item.shared_information_item_id,
                      ?, ?, null, null, null, note_item.latest_change_id,
                      'task_cascade'
               from shared_information_items note_item
               join note_snapshots note
                 on note.note_snapshot_id = note_item.current_note_snapshot_id
               where note_item.kind = 'note' and note_item.removed_at is null
                 and note.related_task_item_id = ?`,
            ).bind(
              persistenceSourceNamespace,
              sourceType,
              operationSourceId,
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
              persistenceSourceNamespace,
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
                 'remove', ?, ?, ?, ?, null, null, ?
               )`,
            ).bind(
              sharedChangeId,
              change.sharedInformationItemId,
              change.expectedLatestChangeId,
              sourceType,
              operationSourceId,
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
        null,
        replacement?.type === 'floating_lesson_reference'
          ? replacement.floatingLessonReferenceLabelId
          : null,
        createdAt,
      ]
      if (change.changeKind === 'add') {
        const part = targetScopeColumns(change)
        statements.push(
          this.db.prepare(`insert into target_scopes (target_scope_id, school_year, created_at) values (?, ?, ?)`).bind(targetScopeId, change.targetScope.schoolYear, createdAt),
          this.db.prepare(`insert into target_scope_parts (target_scope_part_id, target_scope_id, scope_type, grade, class_id, track_id, student_account_id) values (?, ?, ?, ?, ?, ?, ?)`).bind(change.persistenceIds?.targetScopePartId ?? `${persistenceSourceNamespace}:part`, targetScopeId, change.targetScope.type, part.grade, part.classId, part.trackId, part.studentAccountId),
          this.db.prepare(`insert into timetable_change_snapshots (timetable_change_snapshot_id, change_date, period_number, replacement_type, registered_lesson_name_id, replacement_lesson_name, normalized_custom_lesson_name, reference_weekday, reference_period_number, reference_label, floating_lesson_reference_label_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(...snapshotValues),
          this.db.prepare(`insert into shared_information_items (shared_information_item_id, kind, target_scope_id, latest_change_id, current_task_snapshot_id, current_timetable_change_snapshot_id, created_by_student_account_id, created_at, removed_at) values (?, 'timetable_change', ?, null, null, ?, ?, ?, null)`).bind(change.sharedInformationItemId, targetScopeId, snapshotId, change.changedByStudentAccountId, createdAt),
          this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, task_snapshot_id, timetable_change_snapshot_id) values (?, ?, 'add', ?, ?, ?, ?, null, ?)`).bind(sharedChangeId, change.sharedInformationItemId, sourceType, operationSourceId, change.changedByStudentAccountId, createdAt, snapshotId),
          this.db.prepare(`update shared_information_items set latest_change_id = ? where shared_information_item_id = ?`).bind(sharedChangeId, change.sharedInformationItemId),
          this.db.prepare(`insert into active_timetable_change_slots (timetable_change_slot_key, shared_information_item_id) values (?, ?)`).bind(timetableChangeSlotKey(change), change.sharedInformationItemId),
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
            timetableChangeSlotKey(change),
          ),
          this.db.prepare(`insert into shared_information_changes (shared_information_change_id, shared_information_item_id, change_kind, source_type, source_id, changed_by_student_account_id, changed_at, timetable_change_snapshot_id, preceding_change_id) values (?, ?, 'update', ?, ?, ?, ?, ?, ?)`).bind(sharedChangeId, change.sharedInformationItemId, sourceType, operationSourceId, change.changedByStudentAccountId, createdAt, snapshotId, change.expectedLatestChangeId),
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
               'remove', ?, ?, ?, ?, null, ?
             )`,
          ).bind(
            sharedChangeId,
            change.sharedInformationItemId,
            change.expectedLatestChangeId,
            timetableChangeSlotKey(change),
            sourceType,
            operationSourceId,
            change.changedByStudentAccountId,
            createdAt,
            change.expectedLatestChangeId,
          ),
          this.db.prepare(`update shared_information_items set latest_change_id = ?, removed_at = ? where shared_information_item_id = ? and latest_change_id = ? and removed_at is null`).bind(sharedChangeId, createdAt, change.sharedInformationItemId, change.expectedLatestChangeId),
          this.db.prepare(`delete from active_timetable_change_slots where shared_information_item_id = ? and timetable_change_slot_key = ?`).bind(change.sharedInformationItemId, timetableChangeSlotKey(change)),
        )
      }
    }

    await this.db.batch(statements)
  }

  /** @internal Low-level storage contract hook; production uses the executor. */
  async commitDirectChangesForTest(
    changes: DirectChangeOperation[],
    affiliation?: StudentAffiliationAssertion,
  ) {
    const result = await applyMaterializedChangesToD1Backend(
      {
        loadSnapshot: (input, assertion) =>
          this.loadAtomicExecutionSnapshot(input, assertion),
        commit: (pending, assertion) =>
          this.commitAtomicChanges(pending, assertion),
      },
      changes.map(materializeDirectChange),
      affiliation,
    )
    return result.status === 'applied'
      ? { status: 'applied' as const, changes }
      : result
  }

  async listTimetableChangeHistory(input: {
    targetScope: TargetScope
    changeDate: string
    periodNumber: number
  }, scopeAccess: OwnTargetScopeAccess) {
    if (!targetScopeReadAccessIncludes(scopeAccess, input.targetScope)) return []
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

  async listTimetableChangeItemHistory(
    sharedInformationItemId: string,
    scopeAccess: OwnTargetScopeAccess,
  ) {
    const scopeQuery = targetScopeAccessQuery(scopeAccess)
    return this.queryTimetableChangeHistory(
      `i.shared_information_item_id = ? and (${scopeQuery.sql})`,
      [sharedInformationItemId, ...scopeQuery.bindings],
    )
  }

  async findSharedInformationChange(
    sharedInformationChangeId: string,
    scopeAccess: OwnTargetScopeAccess,
  ) {
    const scopeQuery = targetScopeAccessQuery(scopeAccess)
    const row = await this.db
      .prepare(
        `select i.kind, c.shared_information_item_id
         from shared_information_changes c
         join shared_information_items i
           on i.shared_information_item_id = c.shared_information_item_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         where c.shared_information_change_id = ?
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1
           and (${scopeQuery.sql})`,
      )
      .bind(sharedInformationChangeId, ...scopeQuery.bindings)
      .first<{
        kind: 'timetable_change' | 'task' | 'note'
        shared_information_item_id: string
      }>()
    return row
      ? {
          kind: row.kind,
          sharedInformationItemId: row.shared_information_item_id,
        }
      : null
  }

  async listTaskEditHistory(
    sharedInformationItemId: string,
    scopeAccess: OwnTargetScopeAccess,
  ) {
    const scopeQuery = targetScopeAccessQuery(scopeAccess)
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
                where scope_part_count.target_scope_id = s.target_scope_id) = 1
           and (${scopeQuery.sql})`,
      )
      .bind(sharedInformationItemId, ...scopeQuery.bindings)
      .all<HistoricalTaskChangeRow>()
    return results.map(mapHistoricalTaskChangeRow)
  }

  async listNoteEditHistory(
    sharedInformationItemId: string,
    scopeAccess: OwnTargetScopeAccess,
  ) {
    const scopeQuery = targetScopeAccessQuery(scopeAccess)
    const { results } = await this.db
      .prepare(
        `select c.shared_information_change_id,
                c.shared_information_item_id, c.change_kind, c.source_type,
                s.school_year, p.scope_type, p.grade, p.class_id, p.track_id,
                p.student_account_id, actor.display_name, c.changed_at,
                c.preceding_change_id, note.body, c.removal_reason,
                coalesce(note.related_context_type,
                         initial_note.related_context_type)
                  as related_context_type,
                coalesce(note.related_school_date,
                         initial_note.related_school_date)
                  as related_school_date,
                coalesce(note.related_period_number,
                         initial_note.related_period_number)
                  as related_period_number,
                coalesce(note.related_task_item_id,
                         initial_note.related_task_item_id)
                  as related_task_item_id
         from shared_information_changes c
         join shared_information_items i
           on i.shared_information_item_id = c.shared_information_item_id
         join target_scopes s on s.target_scope_id = i.target_scope_id
         join target_scope_parts p on p.target_scope_id = s.target_scope_id
         join student_accounts actor
           on actor.student_account_id = c.changed_by_student_account_id
         left join note_snapshots note
           on note.note_snapshot_id = c.note_snapshot_id
         join note_snapshots initial_note
           on initial_note.note_snapshot_id = (
             select first_change.note_snapshot_id
             from shared_information_changes first_change
             where first_change.shared_information_item_id =
               i.shared_information_item_id
               and first_change.note_snapshot_id is not null
             order by (first_change.preceding_change_id is not null),
                      first_change.changed_at,
                      first_change.shared_information_change_id
             limit 1
           )
         where i.kind = 'note' and i.shared_information_item_id = ?
           and (select count(*) from target_scope_parts scope_part_count
                where scope_part_count.target_scope_id = s.target_scope_id) = 1
           and (${scopeQuery.sql})`,
      )
      .bind(sharedInformationItemId, ...scopeQuery.bindings)
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
                p.student_account_id,
                coalesce(snapshot.change_date, slot.change_date) as change_date,
                coalesce(snapshot.period_number, slot.period_number)
                  as period_number,
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
           order by (first_change.preceding_change_id is not null),
                    first_change.changed_at,
                    first_change.shared_information_change_id
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

  private async findTimetableChangesBySources(
    changes: readonly MaterializedSharedInformationChange[],
  ) {
    if (changes.length === 0) return []
    const lookup = atomicChangeSourceLookup(changes)
    const { results } = await this.db
      .prepare(
        `select c.change_kind,
                (select previous.shared_information_change_id
                 from shared_information_changes previous
                 where previous.shared_information_item_id = c.shared_information_item_id
                   and previous.rowid < c.rowid
                 order by previous.rowid desc
                 limit 1) as expected_latest_change_id,
                c.source_type, c.source_id,
                c.shared_information_change_id,
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
         where (${lookup.predicate})`,
      )
      .bind(...lookup.bindings)
      .all<ActiveTimetableChangeRow>()
    return results.map(mapStoredTimetableOperation)
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

  private async findTaskOperationsBySources(
    changes: readonly MaterializedSharedInformationChange[],
  ) {
    if (changes.length === 0) return []
    const lookup = atomicChangeSourceLookup(changes)
    const { results } = await this.db
      .prepare(
        `select c.source_type, c.source_id,
                c.shared_information_change_id,
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
         where i.kind = 'task' and (${lookup.predicate})`,
      )
      .bind(...lookup.bindings)
      .all<StoredTaskOperationRow>()
    return results.map(mapStoredTaskOperation)
  }

  private async findNoteOperationsBySources(
    changes: readonly MaterializedSharedInformationChange[],
  ) {
    if (changes.length === 0) return []
    const lookup = atomicChangeSourceLookup(changes)
    const { results } = await this.db
      .prepare(
        `select c.source_type, c.source_id,
                c.shared_information_change_id, c.change_kind,
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
         where i.kind = 'note' and (${lookup.predicate})`,
      )
      .bind(...lookup.bindings)
      .all<StoredNoteOperationRow>()
    return results.map(mapStoredNoteOperation)
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
             school_year = ?,
             grade = ?,
             class_id = ?,
             track_id = ?
         where setup_session_token_hash = ?`,
      )
      .bind(
        draft.displayName,
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
    }

    try {
      await this.db.batch([
        this.db
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
            input.studentAccountId,
            input.schoolEmail,
            input.displayName,
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
    directChangeOptions: implementation,
    directChangeCatalog: implementation,
    atomicChangeExecutor: createInMemoryAtomicChangeExecutor(
      implementation.atomicChangeState,
      implementation,
    ),
    editHistory: implementation,
    seed: implementation,
  }
}

export function createD1PersistenceAdapters(db: D1Database): PersistenceAdapters {
  const implementation = new D1PersistenceAdapters(db)

  return {
    studentAccount: implementation,
    studentAffiliation: implementation,
    dailyPlan: implementation,
    directChangeOptions: implementation,
    directChangeCatalog: createD1DirectChangeCatalog(implementation),
    atomicChangeExecutor: createD1AtomicChangeExecutor({
      loadSnapshot: (changes, affiliation) =>
        implementation.loadAtomicExecutionSnapshot(changes, affiliation),
      commit: (pending, affiliation) =>
        implementation.commitAtomicChanges(pending, affiliation),
    }),
    editHistory: implementation,
    seed: implementation,
  }
}

function mapStudentAccountRow(row: StudentAccountRow): StudentAccount {
  return {
    studentAccountId: row.student_account_id,
    schoolEmail: row.school_email,
    displayName: row.display_name,
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

function mapStoredNoteOperation(
  row: StoredNoteOperationRow,
): Extract<MaterializedSharedInformationChange, { kind: 'note' }> {
  const source = mapAtomicChangeSource(row.source_type, row.source_id)
  const common = {
    kind: 'note' as const,
    source,
    persistenceIds: createPersistenceIds(source),
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

function mapStoredTaskOperation(
  row: StoredTaskOperationRow,
): Extract<MaterializedSharedInformationChange, { kind: 'task' }> {
  const source = mapAtomicChangeSource(row.source_type, row.source_id)
  const base = {
    kind: 'task' as const,
    source,
    persistenceIds: createPersistenceIds(source),
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
      cascade: {
        type: 'remove-active-task-notes',
        cause: {
          type: 'task-cascade',
          causedByChangeId: row.shared_information_change_id,
        },
      },
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
  const change = {
    sharedInformationChangeId: row.shared_information_change_id,
    sharedInformationItemId: row.shared_information_item_id,
    changeKind: row.change_kind,
    targetScope: mapTargetScopeRow(row),
    changedAt: Date.parse(row.changed_at),
    precedingChangeId: row.preceding_change_id,
    snapshot: row.change_kind === 'remove'
      ? null
      : { body: row.body ?? '' },
    relatedContext: mapHistoricalNoteRelatedContext(row),
    removalReason: row.removal_reason,
  }
  return row.source_type === 'direct'
    ? {
        ...change,
        sourceType: 'direct',
        primaryActorDisplayName: row.display_name,
      }
    : { ...change, sourceType: 'proposal' }
}

function mapHistoricalNoteRelatedContext(
  row: Pick<
    HistoricalNoteChangeRow,
    'related_context_type' | 'related_school_date' |
    'related_period_number' | 'related_task_item_id'
  >,
): HistoricalNoteChange['relatedContext'] {
  if (row.related_context_type === 'none') return { type: 'none' }
  if (
    row.related_context_type === 'school_date' &&
    row.related_school_date !== null
  ) {
    return { type: 'school_date', schoolDate: row.related_school_date }
  }
  if (
    row.related_context_type === 'daily_lesson' &&
    row.related_school_date !== null &&
    row.related_period_number !== null
  ) {
    return {
      type: 'daily_lesson',
      schoolDate: row.related_school_date,
      periodNumber: row.related_period_number,
    }
  }
  if (
    row.related_context_type === 'task' &&
    row.related_task_item_id !== null
  ) {
    return { type: 'task', taskItemId: row.related_task_item_id }
  }
  return null
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

function directNoteRelatedContext(
  change: Extract<
    MaterializedSharedInformationChange,
    { kind: 'note'; changeKind: 'add' }
  >,
): NonNullable<HistoricalNoteChange['relatedContext']> {
  if (change.relatedTaskItemId) {
    return { type: 'task', taskItemId: change.relatedTaskItemId }
  }
  if (change.schoolDate === null) return { type: 'none' }
  return change.periodNumber == null
    ? { type: 'school_date', schoolDate: change.schoolDate }
    : {
        type: 'daily_lesson',
        schoolDate: change.schoolDate,
        periodNumber: change.periodNumber,
      }
}

function targetScopeAccessQuery(scopeAccess: TargetScopeReadAccess) {
  const bindings: Array<string | number> = []
  const clauses = targetScopesForReadAccess(scopeAccess).map((targetScope) => {
    bindings.push(
      targetScope.schoolYear,
      targetScope.type,
      targetScopeValue(targetScope),
    )
    const scopeColumn = targetScope.type === 'grade'
      ? 'p.grade'
      : targetScope.type === 'class'
        ? 'p.class_id'
        : targetScope.type === 'track'
          ? 'p.track_id'
          : 'p.student_account_id'
    return `(s.school_year = ? and p.scope_type = ? and ${scopeColumn} = ?)`
  })
  return { sql: clauses.join(' or '), bindings }
}

function atomicChangeSourceLookup(
  changes: readonly MaterializedSharedInformationChange[],
) {
  const uniqueChanges = [
    ...new Map(
      changes.map((change) => [changeSourceKey(change), change]),
    ).values(),
  ]
  return {
    predicate: uniqueChanges
      .map(() => '(c.source_type = ? and c.source_id = ?)')
      .join(' or '),
    bindings: uniqueChanges.flatMap((change) => [
      change.source.type,
      sourceId(change.source),
    ]),
  }
}

function materializeDirectChange(
  change: DirectChangeOperation,
): MaterializedSharedInformationChange {
  const directChangeId = change.sourceId
  const source: ChangeSource = {
    type: 'direct',
    directChangeId,
  }
  const requiredPersistenceIds = change.persistenceIds
    ? {
        sharedInformationChangeId: change.latestChangeId,
        ...change.persistenceIds,
      }
    : createPersistenceIds(source)
  if (change.kind === 'task' && change.changeKind === 'remove') {
    const { sourceId: _sourceId, ...operation } = change
    void _sourceId
    return {
      ...operation,
      kind: 'task',
      changeKind: 'remove',
      source,
      persistenceIds: requiredPersistenceIds,
      cascade: {
        type: 'remove-active-task-notes',
        cause: {
          type: 'task-cascade',
          causedByChangeId: change.latestChangeId,
        },
      },
    }
  }
  const { sourceId: _sourceId, ...operation } = change
  void _sourceId
  return {
    ...operation,
    source,
    persistenceIds: requiredPersistenceIds,
  } as MaterializedSharedInformationChange
}

function mapAtomicChangeSource(
  sourceType: 'direct' | 'proposal',
  id: string,
): ChangeSource {
  return sourceType === 'direct'
    ? { type: 'direct', directChangeId: id }
    : { type: 'proposal', changeProposalId: id }
}

function mapStoredTimetableOperation(
  row: ActiveTimetableChangeRow,
): Extract<
  MaterializedSharedInformationChange,
  { kind: 'timetable_change' }
> {
  const active = mapActiveTimetableChangeRow(row)
  const {
    replacement: activeReplacement,
    sourceId: storedSourceId,
    ...base
  } = active
  const source = mapAtomicChangeSource(
    row.source_type ?? 'direct',
    storedSourceId,
  )
  const requiredPersistenceIds = createPersistenceIds(source)
  return row.change_kind === 'remove'
    ? {
        ...base,
        kind: 'timetable_change',
        source,
        persistenceIds: requiredPersistenceIds,
        changeKind: 'remove',
        expectedLatestChangeId: row.expected_latest_change_id ?? '',
      }
    : row.change_kind === 'update'
    ? {
        ...base,
        kind: 'timetable_change',
        source,
        persistenceIds: requiredPersistenceIds,
        replacement: activeReplacement,
        changeKind: 'update',
        expectedLatestChangeId: row.expected_latest_change_id ?? '',
      }
    : {
        ...base,
        kind: 'timetable_change',
        source,
        persistenceIds: requiredPersistenceIds,
        replacement: activeReplacement,
        changeKind: 'add',
      }
}

function studentAffiliationGuardStatement(
  db: D1Database,
  expected: StudentAffiliationAssertion,
) {
  return db.prepare(
    `select case when exists (
       select 1
       from student_affiliations
       where student_affiliation_id = ?
         and student_account_id = ?
         and school_year = ?
         and grade = ?
         and class_id = ?
         and track_id = ?
         and selected_at = ?
         and ended_at is null
     ) then 1 else json('') end`,
  ).bind(
    expected.studentAffiliationId,
    expected.studentAccountId,
    expected.schoolYear,
    expected.grade,
    expected.classId,
    expected.trackId,
    expected.selectedAt,
  )
}

function floatingReferenceGuardStatement(
  db: D1Database,
  floatingLessonReferenceLabelId: string,
  schoolYear: number,
  grade: number,
) {
  return db.prepare(
    `select case when exists (
       select 1
       from floating_lesson_reference_labels
       where floating_lesson_reference_label_id = ?
         and school_year = ?
         and grade = ?
     ) then 1 else json('') end`,
  ).bind(
    floatingLessonReferenceLabelId,
    schoolYear,
    grade,
  )
}

function taskCascadeCauseGuardStatement(
  db: D1Database,
  causedByChangeId: string,
  taskRemovalChangeId: string,
) {
  return db.prepare(
    `select case when ? = ? then 1 else json('') end`,
  ).bind(causedByChangeId, taskRemovalChangeId)
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
