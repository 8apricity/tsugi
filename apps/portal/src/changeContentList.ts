import type {
  DailyPlanNoteForCache,
  DailyPlanTaskForCache,
} from './dailyPlanCache'
import type {
  NoteDraft,
  TargetScopeType,
  TaskDraft,
  TimetableChangeDraft,
  TimetableReplacement,
} from './sharedInformationEditorClient'

type DraftConflict = { conflicted?: boolean }

export type ChangeContentNoteItem = {
  kind: 'note'
  id: string
  sourceId: string
  changeKind: NoteDraft['changeKind']
  body: string
  schoolDate: string | null
  periodNumber?: number | null
  targetScopeType: TargetScopeType
  conflicted: boolean
  draft: NoteDraft & DraftConflict
  beforeBody: string | null
  afterBody: string | null
  relatedTask: ChangeContentTaskValue | null
}

export type ChangeContentTaskValue = {
  taskId: string
  title: string
  dueDate: string | null
  relatedLessonName?: string
  targetScopeType: TargetScopeType
}

export type ChangeContentTaskItem = {
  kind: 'task'
  id: string
  sourceId: string | null
  changeKind: TaskDraft['changeKind'] | null
  draft: TaskDraft & DraftConflict | null
  task: ChangeContentTaskValue
  beforeTask: ChangeContentTaskValue | null
  conflicted: boolean
  children: ChangeContentNoteItem[]
}

export type ChangeContentTimetableItem = {
  kind: 'timetable'
  id: string
  sourceId: string
  changeKind: TimetableChangeDraft['changeKind']
  changeDate: string
  periodNumber: number
  targetScopeType: TargetScopeType
  replacement?: TimetableReplacement
  serverReplacement?: TimetableReplacement
  beforeReplacement: TimetableReplacement | null
  afterReplacement: TimetableReplacement | null
  conflicted: boolean
  draft: TimetableChangeDraft & DraftConflict
}

export type ChangeContentItem =
  | ChangeContentTimetableItem
  | ChangeContentTaskItem
  | ChangeContentNoteItem

export type ChangeContentListInput = {
  selectedSchoolDate: string
  timetableDrafts: readonly (TimetableChangeDraft & DraftConflict)[]
  taskDrafts: readonly (TaskDraft & DraftConflict)[]
  noteDrafts: readonly (NoteDraft & DraftConflict)[]
  activeTasks?: readonly DailyPlanTaskForCache[]
  activeNotes?: readonly DailyPlanNoteForCache[]
}

export function countChangeContentDrafts({
  timetableDrafts,
  taskDrafts,
  noteDrafts,
}: Pick<ChangeContentListInput, 'timetableDrafts' | 'taskDrafts' | 'noteDrafts'>) {
  return timetableDrafts.length + taskDrafts.length + noteDrafts.length
}

export function changeContentControlState({
  editing,
  draftCount,
}: {
  editing: boolean
  draftCount: number
}) {
  return {
    reviewVisible: editing,
    badgeVisible: draftCount > 0,
    badgeLabel: draftCount > 0 ? `下書き${draftCount}件` : null,
  }
}

export function buildChangeContentList({
  selectedSchoolDate,
  timetableDrafts,
  taskDrafts,
  noteDrafts,
  activeTasks = [],
  activeNotes = [],
}: ChangeContentListInput): ChangeContentItem[] {
  const taskById = new Map<string, ChangeContentTaskItem>()

  for (const draft of taskDrafts) {
    const taskId = taskIdentity(draft)
    taskById.set(taskId, {
      kind: 'task',
      id: `task:${taskId}`,
      sourceId: draft.sourceId,
      changeKind: draft.changeKind,
      draft,
      task: taskValueFromDraft(draft),
      beforeTask: draft.changeKind === 'add'
        ? null
        : draft.baseTask
          ? taskValueFromBaseTask(draft.baseTask)
          : null,
      conflicted: draft.conflicted === true,
      children: [],
    })
  }

  const activeTaskById = new Map<string, DailyPlanTaskForCache>()
  for (const task of activeTasks) {
    if (!activeTaskById.has(task.taskId)) activeTaskById.set(task.taskId, task)
  }

  const activeNoteById = new Map<string, DailyPlanNoteForCache>()
  for (const note of activeNotes) {
    if (!activeNoteById.has(note.noteId)) activeNoteById.set(note.noteId, note)
  }

  const topLevelNotes: ChangeContentNoteItem[] = []
  for (const draft of noteDrafts) {
    const relatedTask = draft.relatedTaskItemId
      ? taskById.get(draft.relatedTaskItemId) ??
        activeTaskById.get(draft.relatedTaskItemId)
      : undefined
    const note = noteValueFromDraft(
      draft,
      relatedTask,
      activeNoteById.get(
        draft.changeKind === 'add' ? '' : draft.sharedInformationItemId,
      ),
    )
    if (draft.relatedTaskItemId) {
      const parent = taskById.get(draft.relatedTaskItemId)
      if (parent) {
        parent.children.push(note)
        continue
      }
      const activeTask = activeTaskById.get(draft.relatedTaskItemId)
      if (activeTask) {
        const parentItem: ChangeContentTaskItem = {
          kind: 'task',
          id: `task:${activeTask.taskId}`,
          sourceId: null,
          changeKind: null,
          draft: null,
          task: taskValueFromActiveTask(activeTask),
          beforeTask: null,
          conflicted: false,
          children: [note],
        }
        taskById.set(activeTask.taskId, parentItem)
        continue
      }
      const fallbackParent: ChangeContentTaskItem = {
        kind: 'task',
        id: `task:${draft.relatedTaskItemId}`,
        sourceId: null,
        changeKind: null,
        draft: null,
        task: {
          taskId: draft.relatedTaskItemId,
          title: '関連するタスク',
          dueDate: null,
          targetScopeType: draft.targetScopeType,
        },
        beforeTask: null,
        conflicted: false,
        children: [note],
      }
      taskById.set(draft.relatedTaskItemId, fallbackParent)
      continue
    }
    topLevelNotes.push(note)
  }

  const timetableItems: ChangeContentTimetableItem[] = timetableDrafts.map(
    (draft) => ({
      kind: 'timetable',
      id: `timetable:${draft.sourceId}`,
      sourceId: draft.sourceId,
      changeKind: draft.changeKind,
      changeDate: draft.changeDate,
      periodNumber: draft.periodNumber,
      targetScopeType: draft.targetScopeType,
      ...(draft.changeKind === 'remove'
        ? { serverReplacement: draft.serverReplacement }
        : { replacement: draft.replacement }),
      ...(draft.changeKind === 'update'
        ? { serverReplacement: draft.serverReplacement }
        : {}),
      beforeReplacement: draft.changeKind === 'add'
        ? null
        : draft.serverReplacement,
      afterReplacement: draft.changeKind === 'remove'
        ? null
        : draft.replacement,
      conflicted: draft.conflicted === true,
      draft,
    }),
  )

  return [
    ...timetableItems,
    ...[...taskById.values()],
    ...topLevelNotes,
  ].sort((left, right) => compareChangeContentItems(
    left,
    right,
    selectedSchoolDate,
  ))
}

function taskIdentity(draft: TaskDraft) {
  return draft.changeKind === 'add'
    ? draft.sourceId
    : draft.sharedInformationItemId
}

function taskValueFromDraft(draft: TaskDraft): ChangeContentTaskValue {
  return {
    taskId: taskIdentity(draft),
    title: draft.title,
    dueDate: draft.dueDate,
    ...(draft.relatedLessonName
      ? { relatedLessonName: draft.relatedLessonName.lessonName }
      : {}),
    targetScopeType: draft.targetScopeType,
  }
}

function taskValueFromActiveTask(
  task: DailyPlanTaskForCache,
): ChangeContentTaskValue {
  return {
    taskId: task.taskId,
    title: task.title,
    dueDate: task.dueDate,
    ...(task.relatedLessonName
      ? { relatedLessonName: task.relatedLessonName }
      : {}),
    targetScopeType: task.targetScopeType,
  }
}

function taskValueFromBaseTask(
  task: NonNullable<Extract<TaskDraft, { changeKind: 'update' | 'remove' }>['baseTask']>,
): ChangeContentTaskValue {
  return {
    taskId: task.taskId,
    title: task.title,
    dueDate: task.dueDate,
    ...(task.relatedLessonName
      ? { relatedLessonName: task.relatedLessonName.lessonName }
      : {}),
    targetScopeType: task.targetScopeType,
  }
}

function noteValueFromDraft(
  draft: NoteDraft & DraftConflict,
  relatedTask: ChangeContentTaskItem | DailyPlanTaskForCache | undefined,
  activeNote: DailyPlanNoteForCache | undefined,
): ChangeContentNoteItem {
  return {
    kind: 'note',
    id: `note:${draft.sourceId}`,
    sourceId: draft.sourceId,
    changeKind: draft.changeKind,
    body: draft.body,
    schoolDate: draft.schoolDate,
    periodNumber: draft.periodNumber,
    targetScopeType: draft.targetScopeType,
    conflicted: draft.conflicted === true,
    draft,
    beforeBody: draft.changeKind === 'add'
      ? null
      : activeNote?.body ?? (draft.changeKind === 'remove' ? draft.body : null),
    afterBody: draft.changeKind === 'remove' ? null : draft.body,
    relatedTask: relatedTask
      ? 'task' in relatedTask
        ? relatedTask.task
        : taskValueFromActiveTask(relatedTask)
      : draft.relatedTaskItemId
        ? {
            taskId: draft.relatedTaskItemId,
            title: '関連するタスク',
            dueDate: null,
            targetScopeType: draft.targetScopeType,
          }
        : null,
  }
}

function compareChangeContentItems(
  left: ChangeContentItem,
  right: ChangeContentItem,
  selectedSchoolDate: string,
) {
  const dateComparison = compareItemDates(
    itemDate(left),
    itemDate(right),
    selectedSchoolDate,
  )
  if (dateComparison !== 0) return dateComparison

  const kindComparison = itemKindOrder(left) - itemKindOrder(right)
  if (kindComparison !== 0) return kindComparison

  if (left.kind === 'timetable' && right.kind === 'timetable') {
    return left.periodNumber - right.periodNumber ||
      left.targetScopeType.localeCompare(right.targetScopeType)
  }
  if (left.kind === 'task' && right.kind === 'task') {
    return left.task.title.localeCompare(right.task.title) ||
      left.id.localeCompare(right.id)
  }
  return left.id.localeCompare(right.id)
}

function itemDate(item: ChangeContentItem) {
  if (item.kind === 'timetable') return item.changeDate
  if (item.kind === 'task') return item.task.dueDate
  return item.relatedTask?.dueDate ?? item.schoolDate
}

function compareItemDates(
  left: string | null,
  right: string | null,
  selectedSchoolDate: string,
) {
  const leftRank = left === null ? 2 : left === selectedSchoolDate ? 0 : 1
  const rightRank = right === null ? 2 : right === selectedSchoolDate ? 0 : 1
  return leftRank - rightRank ||
    (leftRank === 1 && rightRank === 1
      ? (left ?? '').localeCompare(right ?? '')
      : 0)
}

function itemKindOrder(item: ChangeContentItem) {
  return item.kind === 'timetable' ? 0 : item.kind === 'task' ? 1 : 2
}
