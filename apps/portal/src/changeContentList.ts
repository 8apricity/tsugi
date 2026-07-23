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

type ChangeContentNoteItemBase = {
  kind: 'note'
  id: string
  sourceId: string
  changeKind: NoteDraft['changeKind']
  body: string
  schoolDate: string | null
  periodNumber?: number | null
  targetScopeType: TargetScopeType
  conflicted: boolean
  beforeBody: string | null
  afterBody: string | null
  relatedTask: ChangeContentTaskValue | null
}

export type ChangeContentNoteItem =
  | (ChangeContentNoteItemBase & {
      source: 'draft'
      draft: NoteDraft & DraftConflict
    })
  | (ChangeContentNoteItemBase & {
      source: 'task-cascade'
    })

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

export type ChangeContentDailyLessonItem = {
  kind: 'daily-lesson'
  id: string
  schoolDate: string
  periodNumber: number
  resolvedLessonName: string
  timetableChanges: ChangeContentTimetableItem[]
  children: ChangeContentNoteItem[]
}

export type ChangeContentItem =
  | ChangeContentDailyLessonItem
  | ChangeContentTaskItem
  | ChangeContentNoteItem

export type ChangeContentListInput = {
  timetableDrafts: readonly (TimetableChangeDraft & DraftConflict)[]
  taskDrafts: readonly (TaskDraft & DraftConflict)[]
  noteDrafts: readonly (NoteDraft & DraftConflict)[]
  activeTasks?: readonly DailyPlanTaskForCache[]
  activeNotes?: readonly DailyPlanNoteForCache[]
  dailyLessons?: readonly {
    schoolDate: string
    periodNumber: number
    lessonName: string
  }[]
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
  referenceScopeActive = false,
}: {
  editing: boolean
  draftCount: number
  referenceScopeActive?: boolean
}) {
  return {
    editModeVisible: !referenceScopeActive,
    reviewVisible: editing && !referenceScopeActive,
    badgeVisible: draftCount > 0 && !referenceScopeActive,
    badgeLabel: draftCount > 0 && !referenceScopeActive
      ? `下書き${draftCount}件`
      : null,
  }
}

export function buildChangeContentList({
  timetableDrafts,
  taskDrafts,
  noteDrafts,
  activeTasks = [],
  activeNotes = [],
  dailyLessons = [],
}: ChangeContentListInput): ChangeContentItem[] {
  const taskById = new Map<string, ChangeContentTaskItem>()
  const resolvedLessonNameByKey = new Map(
    dailyLessons.map((lesson) => [
      dailyLessonKey(lesson.schoolDate, lesson.periodNumber),
      lesson.lessonName,
    ]),
  )
  const dailyLessonByKey = new Map<string, ChangeContentDailyLessonItem>()
  const ensureDailyLesson = (schoolDate: string, periodNumber: number) => {
    const key = dailyLessonKey(schoolDate, periodNumber)
    const existing = dailyLessonByKey.get(key)
    if (existing) return existing
    const dailyLesson: ChangeContentDailyLessonItem = {
      kind: 'daily-lesson',
      id: `daily-lesson:${key}`,
      schoolDate,
      periodNumber,
      resolvedLessonName: resolvedLessonNameByKey.get(key) ?? '',
      timetableChanges: [],
      children: [],
    }
    dailyLessonByKey.set(key, dailyLesson)
    return dailyLesson
  }

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

  for (const draft of timetableDrafts) {
    ensureDailyLesson(draft.changeDate, draft.periodNumber)
      .timetableChanges.push(timetableItemFromDraft(draft))
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
      const contextTask = draft.contextSnapshot?.type === 'task'
        ? draft.contextSnapshot.task
        : null
      const fallbackParent: ChangeContentTaskItem = {
        kind: 'task',
        id: `task:${draft.relatedTaskItemId}`,
        sourceId: null,
        changeKind: null,
        draft: null,
        task: contextTask ?? {
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
    if (draft.schoolDate && draft.periodNumber != null) {
      const key = dailyLessonKey(draft.schoolDate, draft.periodNumber)
      const dailyLesson = ensureDailyLesson(
        draft.schoolDate,
        draft.periodNumber,
      )
      if (
        !resolvedLessonNameByKey.has(key) &&
        draft.contextSnapshot?.type === 'daily-lesson'
      ) {
        dailyLesson.resolvedLessonName = draft.contextSnapshot.lessonName
      }
      dailyLesson.children.push(note)
      continue
    }
    topLevelNotes.push(note)
  }

  for (const task of taskById.values()) {
    if (task.draft?.changeKind !== 'remove') continue
    for (const note of task.draft.baseTask?.notes ?? []) {
      if (task.children.some((child) => child.sourceId === note.noteId)) continue
      task.children.push({
        kind: 'note',
        source: 'task-cascade',
        id: `note:${note.noteId}`,
        sourceId: note.noteId,
        changeKind: 'remove',
        body: note.body,
        schoolDate: null,
        targetScopeType: note.targetScopeType,
        conflicted: false,
        beforeBody: note.body,
        afterBody: null,
        relatedTask: task.task,
      })
    }
  }

  for (const dailyLesson of dailyLessonByKey.values()) {
    dailyLesson.timetableChanges.sort(
      (left, right) =>
        targetScopeOrder(left.targetScopeType) -
        targetScopeOrder(right.targetScopeType),
    )
  }

  return [
    ...dailyLessonByKey.values(),
    ...[...taskById.values()],
    ...topLevelNotes,
  ].sort((left, right) => compareChangeContentItems(
    left,
    right,
  ))
}

function timetableItemFromDraft(
  draft: TimetableChangeDraft & DraftConflict,
): ChangeContentTimetableItem {
  return {
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
  }
}

function dailyLessonKey(schoolDate: string, periodNumber: number) {
  return `${schoolDate}:${periodNumber}`
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
    source: 'draft',
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
) {
  const dateComparison = compareItemDates(
    itemDate(left),
    itemDate(right),
  )
  if (dateComparison !== 0) return dateComparison

  const kindComparison = itemKindOrder(left) - itemKindOrder(right)
  if (kindComparison !== 0) return kindComparison

  if (left.kind === 'daily-lesson' && right.kind === 'daily-lesson') {
    return left.periodNumber - right.periodNumber ||
      left.id.localeCompare(right.id)
  }
  if (left.kind === 'task' && right.kind === 'task') {
    return left.task.title.localeCompare(right.task.title) ||
      left.id.localeCompare(right.id)
  }
  return left.id.localeCompare(right.id)
}

function itemDate(item: ChangeContentItem) {
  if (item.kind === 'daily-lesson') return item.schoolDate
  if (item.kind === 'task') return item.task.dueDate
  return item.relatedTask?.dueDate ?? item.schoolDate
}

function compareItemDates(
  left: string | null,
  right: string | null,
) {
  const leftRank = left === null ? 1 : 0
  const rightRank = right === null ? 1 : 0
  return leftRank - rightRank ||
    (leftRank === 0 && rightRank === 0
      ? (left ?? '').localeCompare(right ?? '')
      : 0)
}

function itemKindOrder(item: ChangeContentItem) {
  return item.kind === 'daily-lesson' ? 0 : item.kind === 'task' ? 1 : 2
}

function targetScopeOrder(targetScopeType: TargetScopeType) {
  return {
    grade: 0,
    class: 1,
    track: 2,
    student: 3,
  }[targetScopeType]
}
