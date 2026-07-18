import type { DailyPlanNoteForCache, DailyPlanTaskForCache } from './dailyPlanCache'
import type {
  ActiveTaskForEditing,
  TaskDraft,
} from './sharedInformationEditorClient'

export type VisibleTask = {
  taskId: string
  title: string
  dueDate: string | null
  relatedLessonName?: string
  registeredRelatedLessonNameId?: string
  targetScopeType: DailyPlanTaskForCache['targetScopeType']
  notes: DailyPlanNoteForCache[]
}

type ProjectedTaskDraft = TaskDraft & { conflicted?: boolean }

export type VisibleTaskListItem =
  | { type: 'active'; task: DailyPlanTaskForCache }
  | {
      type: 'draft'
      task: VisibleTask
      draft: ProjectedTaskDraft
      activeTask?: DailyPlanTaskForCache
      editingTask?: ActiveTaskForEditing
    }

export function buildVisibleTaskList(
  activeTasks: readonly DailyPlanTaskForCache[],
  taskDrafts: readonly ProjectedTaskDraft[],
  selectedSchoolDate: string,
  knownActiveTasks: readonly DailyPlanTaskForCache[] = activeTasks,
): VisibleTaskListItem[] {
  const replacementByTaskId = new Map(
    taskDrafts
      .filter((draft) => draft.changeKind !== 'add')
      .map((draft) => [draft.sharedInformationItemId, draft] as const),
  )
  const activeById = new Map(
    knownActiveTasks.map((task) => [task.taskId, task]),
  )
  for (const task of activeTasks) activeById.set(task.taskId, task)
  const activeIdsOnSelectedDate = new Set(activeTasks.map((task) => task.taskId))
  const isVisibleOnSelectedDate = (task: { dueDate: string | null }) =>
    task.dueDate === null || task.dueDate === selectedSchoolDate
  const projectedActive: VisibleTaskListItem[] = activeTasks.flatMap(
    (activeTask): VisibleTaskListItem[] => {
    const replacement = replacementByTaskId.get(activeTask.taskId)
    if (!replacement) {
      return isVisibleOnSelectedDate(activeTask)
        ? [{ type: 'active' as const, task: activeTask }]
        : []
    }
    return isVisibleOnSelectedDate(replacement)
      ? [{
          type: 'draft' as const,
          task: projectTask(replacement, activeTask),
          draft: replacement,
          activeTask,
          editingTask: taskEditingSnapshot(activeTask),
        }]
      : []
    },
  )
  const additions: VisibleTaskListItem[] = [...taskDrafts]
    .filter((draft) =>
      draft.changeKind === 'add' && isVisibleOnSelectedDate(draft))
    .reverse()
    .map((draft) => ({
      type: 'draft' as const,
      task: projectTask(draft),
      draft,
    }))
  const orphanedChanges: VisibleTaskListItem[] = taskDrafts.flatMap((draft) => {
    if (
      draft.changeKind === 'add' ||
      activeIdsOnSelectedDate.has(draft.sharedInformationItemId) ||
      !isVisibleOnSelectedDate(draft)
    ) return []
    const activeTask = activeById.get(draft.sharedInformationItemId)
    const editingTask = activeTask
      ? taskEditingSnapshot(activeTask)
      : taskBaseSnapshot(draft)
    return [{
      type: 'draft' as const,
      task: projectTask(draft, activeTask),
      draft,
      ...(activeTask ? { activeTask } : {}),
      ...(editingTask ? { editingTask } : {}),
    }]
  })

  return [...additions, ...orphanedChanges, ...projectedActive]
}

function projectTask(
  draft: ProjectedTaskDraft,
  activeTask?: DailyPlanTaskForCache,
): VisibleTask {
  const baseTask = taskBaseSnapshot(draft)
  return {
    taskId: draft.changeKind === 'add'
      ? draft.sourceId
      : draft.sharedInformationItemId,
    title: draft.title,
    dueDate: draft.dueDate,
    ...(draft.relatedLessonName
      ? {
          relatedLessonName: draft.relatedLessonName.lessonName,
          ...(draft.relatedLessonName.registeredLessonNameId
            ? {
                registeredRelatedLessonNameId:
                  draft.relatedLessonName.registeredLessonNameId,
              }
            : {}),
        }
      : {}),
    targetScopeType: draft.targetScopeType,
    notes: activeTask?.notes ?? baseTask?.notes ?? [],
  }
}

function taskBaseSnapshot(draft: TaskDraft) {
  return draft.changeKind === 'add' ? undefined : draft.baseTask
}

function taskEditingSnapshot(
  task: DailyPlanTaskForCache,
): ActiveTaskForEditing {
  return {
    taskId: task.taskId,
    latestChangeId: task.latestChangeId,
    title: task.title,
    dueDate: task.dueDate,
    relatedLessonName: task.relatedLessonName
      ? {
          lessonName: task.relatedLessonName,
          ...(task.registeredRelatedLessonNameId
            ? { registeredLessonNameId: task.registeredRelatedLessonNameId }
            : {}),
        }
      : null,
    targetScopeType: task.targetScopeType,
    notes: task.notes,
  }
}
