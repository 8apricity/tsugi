import { describe, expect, it } from 'vitest'
import type { DailyPlanTaskForCache } from './dailyPlanCache'
import type { TaskDraft } from './sharedInformationEditorClient'
import { buildVisibleTaskList } from './taskListView'

describe('Daily Plan Task list projection', () => {
  it('shows one projected add Task on its due date', () => {
    const draft = addDraft('add-task', '2026-07-10')

    expect(buildVisibleTaskList([], [draft], '2026-07-10')).toMatchObject([
      {
        type: 'draft',
        task: { taskId: 'add-task', title: 'add-task', dueDate: '2026-07-10' },
        draft: { sourceId: 'add-task', changeKind: 'add' },
      },
    ])
    expect(buildVisibleTaskList([], [draft], '2026-07-11')).toEqual([])
  })

  it('replaces an active Task with its update or removal draft in place', () => {
    const active = activeTask('task-1', '2026-07-10')
    const update = {
      ...addDraft('update-task', '2026-07-10'),
      changeKind: 'update' as const,
      sharedInformationItemId: active.taskId,
      expectedLatestChangeId: active.latestChangeId,
      title: '変更後',
    }
    const removal = { ...update, changeKind: 'remove' as const }

    const updated = buildVisibleTaskList([active], [update], '2026-07-10')
    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({
      type: 'draft',
      task: { taskId: active.taskId, title: '変更後', notes: active.notes },
      activeTask: active,
    })

    const removed = buildVisibleTaskList([active], [removal], '2026-07-10')
    expect(removed).toHaveLength(1)
    expect(removed[0]).toMatchObject({
      type: 'draft',
      task: { taskId: active.taskId, title: '変更後', notes: active.notes },
      draft: { changeKind: 'remove' },
    })
  })

  it('moves a projected due date and shows undated Tasks every day', () => {
    const active = activeTask('task-1', '2026-07-10')
    const moved = {
      ...addDraft('update-task', '2026-07-11'),
      changeKind: 'update' as const,
      sharedInformationItemId: active.taskId,
      expectedLatestChangeId: active.latestChangeId,
      baseTask: taskBaseSnapshot(active),
    }
    const undated = { ...moved, dueDate: null }

    expect(buildVisibleTaskList([active], [moved], '2026-07-10')).toEqual([])
    expect(buildVisibleTaskList([], [moved], '2026-07-11')).toMatchObject([
      {
        type: 'draft',
        task: { taskId: active.taskId, dueDate: '2026-07-11', notes: active.notes },
        editingTask: { taskId: active.taskId, notes: active.notes },
      },
    ])
    expect(buildVisibleTaskList([active], [undated], '2026-07-10')).toHaveLength(1)
    expect(buildVisibleTaskList([active], [undated], '2026-07-11')).toHaveLength(1)
  })
})

function activeTask(taskId: string, dueDate: string | null): DailyPlanTaskForCache {
  return {
    taskId,
    latestChangeId: `${taskId}:change`,
    title: taskId,
    dueDate,
    targetScopeType: 'track',
    createdAt: 1,
    notes: [{
      noteId: `${taskId}:note`,
      latestChangeId: `${taskId}:note-change`,
      body: '関連ノート',
      targetScopeType: 'track',
      relatedContext: { type: 'task', taskId },
    }],
  }
}

function addDraft(sourceId: string, dueDate: string | null): TaskDraft {
  return {
    sourceId,
    changeKind: 'add',
    title: sourceId,
    dueDate,
    relatedLessonName: null,
    targetScopeType: 'track',
  }
}

function taskBaseSnapshot(active: DailyPlanTaskForCache) {
  return {
    taskId: active.taskId,
    latestChangeId: active.latestChangeId,
    title: active.title,
    dueDate: active.dueDate,
    relatedLessonName: null,
    targetScopeType: active.targetScopeType,
    notes: active.notes,
  }
}
