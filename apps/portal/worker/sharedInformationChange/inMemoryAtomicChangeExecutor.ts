import type {
  ActiveNote,
  ActiveTask,
  ActiveTimetableChange,
  StudentAffiliation,
} from '../persistence'
import type {
  MaterializedSharedInformationChange,
} from './materializedChange'
import {
  persistenceIds,
  persistentId,
  sourceId,
  taskCascadeSource,
  type AtomicChangeExecutor,
  type DirectChangeCatalog,
  type StudentAffiliationAssertion,
} from './atomicProgram'
import {
  changeSourceKey,
  evaluateAtomicExecution,
  studentAffiliationSatisfiesAssertion,
  timetableChangeSlotKey,
} from './executionPolicy'
import { executeAtomicProgram } from './executor'
import { findInvalidReferenceSourceKeys } from './referenceValidation'

export type InMemoryAtomicChangeState = {
  studentAffiliations: StudentAffiliation[]
  activeTimetableChanges: ActiveTimetableChange[]
  activeTasks: ActiveTask[]
  activeNotes: ActiveNote[]
  timetableOperations: Map<
    string,
    Extract<
      MaterializedSharedInformationChange,
      { kind: 'timetable_change' }
    >
  >
  taskOperations: Map<
    string,
    Extract<MaterializedSharedInformationChange, { kind: 'task' }>
  >
  noteOperations: Map<
    string,
    Extract<MaterializedSharedInformationChange, { kind: 'note' }>
  >
}

export function createInMemoryAtomicChangeState(): InMemoryAtomicChangeState {
  return {
    studentAffiliations: [],
    activeTimetableChanges: [],
    activeTasks: [],
    activeNotes: [],
    timetableOperations: new Map(),
    taskOperations: new Map(),
    noteOperations: new Map(),
  }
}

export function createInMemoryAtomicChangeExecutor(
  state: InMemoryAtomicChangeState,
  catalog: DirectChangeCatalog,
): AtomicChangeExecutor {
  let previousExecution: Promise<void> = Promise.resolve()
  return {
    execute(program) {
      const execution = previousExecution.then(() =>
        executeAtomicProgram({
          apply: (changes, affiliation) =>
            applyMaterializedChangesToInMemoryState(
              state,
              changes,
              affiliation,
              catalog,
            ),
        }, program)
      )
      previousExecution = execution.then(
        () => undefined,
        () => undefined,
      )
      return execution
    },
  }
}

export async function applyMaterializedChangesToInMemoryState(
  state: InMemoryAtomicChangeState,
  changes: MaterializedSharedInformationChange[],
  affiliation?: StudentAffiliationAssertion,
  catalog?: DirectChangeCatalog,
) {
  const existingBySource = new Map<string, MaterializedSharedInformationChange>([
    ...[...state.timetableOperations.values()].map((change) => [
      changeSourceKey(change),
      { ...change, kind: 'timetable_change' as const },
    ] as const),
    ...[...state.taskOperations.values()].map((change) => [
      changeSourceKey(change),
      change,
    ] as const),
    ...[...state.noteOperations.values()].map((change) => [
      changeSourceKey(change),
      change,
    ] as const),
  ])
  const currentAffiliation = affiliation
    ? state.studentAffiliations.find((candidate) =>
        candidate.studentAccountId === affiliation.studentAccountId &&
        candidate.schoolYear === affiliation.schoolYear &&
        candidate.endedAt === null)
    : null
  const pendingReferenceChanges = changes.filter(
    (change) => !existingBySource.has(changeSourceKey(change)),
  )
  const decision = evaluateAtomicExecution(changes, {
    existingBySource,
    activeTimetableByItem: new Map(
      state.activeTimetableChanges.map((change) => [
        change.sharedInformationItemId,
        change,
      ]),
    ),
    activeTaskByItem: new Map(
      state.activeTasks.map((change) => [
        change.sharedInformationItemId,
        change,
      ]),
    ),
    activeNoteByItem: new Map(
      state.activeNotes.map((change) => [
        change.sharedInformationItemId,
        change,
      ]),
    ),
    occupiedItemIds: new Set([
      ...[...state.timetableOperations.values()].map(
        (change) => change.sharedInformationItemId,
      ),
      ...[...state.taskOperations.values()].map(
        (change) => change.sharedInformationItemId,
      ),
      ...[...state.noteOperations.values()].map(
        (change) => change.sharedInformationItemId,
      ),
    ]),
    occupiedTimetableSlots: new Set(
      state.activeTimetableChanges.map(timetableChangeSlotKey),
    ),
    invalidReferenceSourceKeys: catalog
      ? await findInvalidReferenceSourceKeys(
          pendingReferenceChanges,
          catalog,
          affiliation,
        )
      : new Set(),
    affiliationMatches: !affiliation ||
      (!!currentAffiliation &&
        studentAffiliationSatisfiesAssertion(
          currentAffiliation,
          affiliation,
        )),
  })
  if (decision.status === 'applied') {
    return { status: 'applied' as const, changes }
  }
  if (decision.status !== 'ready') {
    return decision.status === 'invalid-change'
      ? { status: 'invalid-change' as const }
      : {
          status: decision.status,
          conflictingSourceIds: decision.sourceIds,
        }
  }

  const next = cloneState(state)
  const cascadeRemovals = decision.pending
    .filter(
      (
        change,
      ): change is Extract<
        MaterializedSharedInformationChange,
        { kind: 'task'; changeKind: 'remove' }
      > => change.kind === 'task' && change.changeKind === 'remove',
    )
    .flatMap((taskRemoval) =>
      next.activeNotes
        .filter((note) =>
          note.relatedTaskItemId === taskRemoval.sharedInformationItemId)
        .map((note) => {
          const changeSource = taskCascadeSource(
            taskRemoval.source,
            note.sharedInformationItemId,
          )
          return {
            kind: 'note' as const,
            changeKind: 'remove' as const,
            source: changeSource,
            sharedInformationItemId: note.sharedInformationItemId,
            latestChangeId: persistentId(changeSource, 'change'),
            persistenceIds: persistenceIds(changeSource),
            expectedLatestChangeId: note.latestChangeId,
            targetScope: note.targetScope,
            changedByStudentAccountId: taskRemoval.changedByStudentAccountId,
            changedAt: taskRemoval.changedAt,
            removalReason: 'task_cascade' as const,
            causedByChangeId:
              taskRemoval.cascade.cause.causedByChangeId,
          }
        }),
    )

  for (const change of [...cascadeRemovals, ...decision.pending]) {
    applyMaterializedChange(next, change)
  }
  state.activeTimetableChanges = next.activeTimetableChanges
  state.activeTasks = next.activeTasks
  state.activeNotes = next.activeNotes
  state.timetableOperations = next.timetableOperations
  state.taskOperations = next.taskOperations
  state.noteOperations = next.noteOperations
  return { status: 'applied' as const, changes }
}

function applyMaterializedChange(
  state: InMemoryAtomicChangeState,
  change: MaterializedSharedInformationChange,
) {
  const operationSourceId = sourceId(change.source)
  if (change.kind === 'note') {
    state.noteOperations.set(changeSourceKey(change), change)
    if (change.changeKind === 'add') {
      state.activeNotes.push({
        ...change,
        sourceId: operationSourceId,
        periodNumber: change.periodNumber ?? null,
      })
    } else if (change.changeKind === 'update') {
      const index = state.activeNotes.findIndex((candidate) =>
        candidate.sharedInformationItemId === change.sharedInformationItemId)
      const previous = state.activeNotes[index]
      state.activeNotes[index] = {
        ...previous,
        sourceId: operationSourceId,
        latestChangeId: change.latestChangeId,
        body: change.body,
        changedByStudentAccountId: change.changedByStudentAccountId,
        changedAt: change.changedAt,
      }
    } else {
      state.activeNotes = state.activeNotes.filter((candidate) =>
        candidate.sharedInformationItemId !== change.sharedInformationItemId)
    }
    return
  }
  if (change.kind === 'task') {
    state.taskOperations.set(changeSourceKey(change), change)
    if (change.changeKind === 'add') {
      state.activeTasks.push({
        ...change,
        sourceId: operationSourceId,
      })
    } else if (change.changeKind === 'update') {
      const index = state.activeTasks.findIndex((candidate) =>
        candidate.sharedInformationItemId === change.sharedInformationItemId)
      const previous = state.activeTasks[index]
      state.activeTasks[index] = {
        ...previous,
        sourceId: operationSourceId,
        latestChangeId: change.latestChangeId,
        title: change.title,
        dueDate: change.dueDate,
        relatedLessonName: change.relatedLessonName,
        changedByStudentAccountId: change.changedByStudentAccountId,
        changedAt: change.changedAt,
      }
    } else {
      state.activeTasks = state.activeTasks.filter((candidate) =>
        candidate.sharedInformationItemId !== change.sharedInformationItemId)
    }
    return
  }
  state.timetableOperations.set(changeSourceKey(change), change)
  if (change.changeKind === 'add') {
    state.activeTimetableChanges.push({
      ...change,
      sourceId: operationSourceId,
    })
  } else if (change.changeKind === 'update') {
    const index = state.activeTimetableChanges.findIndex((candidate) =>
      candidate.sharedInformationItemId === change.sharedInformationItemId)
    state.activeTimetableChanges[index] = {
      ...change,
      sourceId: operationSourceId,
    }
  } else {
    state.activeTimetableChanges = state.activeTimetableChanges.filter(
      (candidate) =>
        candidate.sharedInformationItemId !== change.sharedInformationItemId,
    )
  }
}

function cloneState(
  state: InMemoryAtomicChangeState,
): InMemoryAtomicChangeState {
  return {
    studentAffiliations: state.studentAffiliations,
    activeTimetableChanges: [...state.activeTimetableChanges],
    activeTasks: [...state.activeTasks],
    activeNotes: [...state.activeNotes],
    timetableOperations: new Map(state.timetableOperations),
    taskOperations: new Map(state.taskOperations),
    noteOperations: new Map(state.noteOperations),
  }
}
