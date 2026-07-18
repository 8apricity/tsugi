import { describe, expect, it } from 'vitest'
import {
  buildChangeContentList,
  changeContentControlState,
  countChangeContentDrafts,
} from './changeContentList'

describe('change-content list projection', () => {
  it('orders mixed drafts by selected date, chronological date, and context', () => {
    const items = buildChangeContentList({
      selectedSchoolDate: '2026-07-10',
      timetableDrafts: [{
        sourceId: 'timetable-later',
        targetScopeType: 'track',
        changeDate: '2026-07-11',
        periodNumber: 1,
        changeKind: 'add',
        replacement: { type: 'lesson_name', lessonName: '英語' },
      }, {
        sourceId: 'timetable-selected',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
        changeKind: 'add',
        replacement: { type: 'cancelled' },
      }],
      taskDrafts: [{
        sourceId: 'task-no-date',
        targetScopeType: 'track',
        changeKind: 'add',
        title: '期限なし',
        dueDate: null,
        relatedLessonName: null,
      }, {
        sourceId: 'task-selected',
        targetScopeType: 'track',
        changeKind: 'add',
        title: '提出',
        dueDate: '2026-07-10',
        relatedLessonName: null,
      }],
      noteDrafts: [{
        kind: 'note',
        sourceId: 'note-later',
        targetScopeType: 'track',
        changeKind: 'add',
        body: '後日',
        schoolDate: '2026-07-12',
      }, {
        kind: 'note',
        sourceId: 'note-no-date',
        targetScopeType: 'track',
        changeKind: 'add',
        body: '日付なし',
        schoolDate: null,
      }],
    })

    expect(items.map((item) => item.id)).toEqual([
      'timetable:timetable-selected',
      'task:task-selected',
      'timetable:timetable-later',
      'note:note-later',
      'task:task-no-date',
      'note:note-no-date',
    ])
  })

  it('nests Task Notes under the related Task while counting each draft', () => {
    const taskDraft = {
      sourceId: 'task-draft',
      targetScopeType: 'track' as const,
      changeKind: 'add' as const,
      title: '数学ワーク',
      dueDate: '2026-07-10',
      relatedLessonName: null,
    }
    const noteDraft = {
      kind: 'note' as const,
      sourceId: 'task-note-draft',
      targetScopeType: 'track' as const,
      changeKind: 'add' as const,
      body: '解答用紙も必要',
      schoolDate: null,
      relatedTaskItemId: 'task-draft',
    }
    const items = buildChangeContentList({
      selectedSchoolDate: '2026-07-10',
      timetableDrafts: [],
      taskDrafts: [taskDraft],
      noteDrafts: [noteDraft],
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: 'task',
      sourceId: 'task-draft',
      children: [{
        sourceId: 'task-note-draft',
        relatedTask: { taskId: 'task-draft' },
      }],
    })
    expect(countChangeContentDrafts({
      timetableDrafts: [],
      taskDrafts: [taskDraft],
      noteDrafts: [noteDraft],
    })).toBe(2)
  })

  it('creates a task group for a Task Note attached to a cached active Task', () => {
    const items = buildChangeContentList({
      selectedSchoolDate: '2026-07-11',
      timetableDrafts: [],
      taskDrafts: [],
      noteDrafts: [{
        kind: 'note',
        sourceId: 'note-update',
        targetScopeType: 'track',
        changeKind: 'update',
        sharedInformationItemId: 'task-1',
        expectedLatestChangeId: 'task-note-change',
        body: '追記',
        schoolDate: null,
        relatedTaskItemId: 'task-1',
      }],
      activeTasks: [{
        taskId: 'task-1',
        latestChangeId: 'task-change',
        title: '数学ワーク',
        dueDate: '2026-07-11',
        targetScopeType: 'track',
        createdAt: 1,
        notes: [],
      }],
    })

    expect(items).toMatchObject([{
      kind: 'task',
      draft: null,
      task: { taskId: 'task-1', title: '数学ワーク' },
      children: [{ sourceId: 'note-update' }],
    }])
  })

  it('nests Task-cascade Note removal projections under their parent Task', () => {
    const items = buildChangeContentList({
      selectedSchoolDate: '2026-07-10',
      timetableDrafts: [],
      noteDrafts: [],
      taskDrafts: [{
        sourceId: 'task-remove',
        targetScopeType: 'track',
        changeKind: 'remove',
        sharedInformationItemId: 'task-1',
        expectedLatestChangeId: 'task-change',
        title: '数学ワーク',
        dueDate: '2026-07-10',
        relatedLessonName: null,
        baseTask: {
          taskId: 'task-1',
          latestChangeId: 'task-change',
          title: '数学ワーク',
          dueDate: '2026-07-10',
          relatedLessonName: null,
          targetScopeType: 'track',
          notes: [{
            noteId: 'task-note-1',
            latestChangeId: 'task-note-1:change',
            body: '解答用紙も必要',
            targetScopeType: 'track',
            relatedContext: { type: 'task', taskId: 'task-1' },
          }],
        },
      }],
    })

    expect(items).toMatchObject([{
      kind: 'task',
      changeKind: 'remove',
      children: [{
        sourceId: 'task-note-1',
        changeKind: 'remove',
        source: 'task-cascade',
        beforeBody: '解答用紙も必要',
        afterBody: null,
      }],
    }])
    expect(countChangeContentDrafts({
      timetableDrafts: [],
      taskDrafts: items.filter((item) => item.kind === 'task')
        .flatMap((item) => item.draft ? [item.draft] : []),
      noteDrafts: [],
    })).toBe(1)
  })

  it('exposes review visibility and pencil badge state independently', () => {
    expect(changeContentControlState({ editing: false, draftCount: 2 })).toEqual({
      reviewVisible: false,
      badgeVisible: true,
      badgeLabel: '下書き2件',
      editModeVisible: true,
    })
    expect(changeContentControlState({ editing: true, draftCount: 0 })).toEqual({
      reviewVisible: true,
      badgeVisible: false,
      badgeLabel: null,
      editModeVisible: true,
    })
    expect(changeContentControlState({
      editing: true,
      draftCount: 2,
      referenceScopeActive: true,
    })).toEqual({
      reviewVisible: false,
      badgeVisible: false,
      badgeLabel: null,
      editModeVisible: false,
    })
  })

  it('projects update before/after values for Task, Note, and Timetable rows', () => {
    const items = buildChangeContentList({
      selectedSchoolDate: '2026-07-10',
      timetableDrafts: [{
        sourceId: 'timetable-update',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 1,
        changeKind: 'update',
        serverReplacement: { type: 'lesson_name', lessonName: '数学' },
        replacement: { type: 'lesson_name', lessonName: '英語' },
        sharedInformationItemId: 'timetable-item',
        expectedLatestChangeId: 'timetable-change',
      }],
      taskDrafts: [{
        sourceId: 'task-update',
        targetScopeType: 'track',
        changeKind: 'update',
        title: '英語ワーク',
        dueDate: '2026-07-11',
        relatedLessonName: null,
        sharedInformationItemId: 'task-1',
        expectedLatestChangeId: 'task-change',
        baseTask: {
          taskId: 'task-1',
          latestChangeId: 'task-change',
          title: '数学ワーク',
          dueDate: '2026-07-10',
          relatedLessonName: null,
          targetScopeType: 'track',
          notes: [],
        },
      }],
      noteDrafts: [{
        kind: 'note',
        sourceId: 'note-update',
        targetScopeType: 'track',
        changeKind: 'update',
        body: '変更後',
        schoolDate: '2026-07-10',
        sharedInformationItemId: 'note-1',
        expectedLatestChangeId: 'note-change',
      }],
      activeNotes: [{
        noteId: 'note-1',
        latestChangeId: 'note-change',
        body: '変更前',
        targetScopeType: 'track',
        relatedContext: { type: 'school-date', schoolDate: '2026-07-10' },
      }],
    })

    expect(items).toMatchObject([
      {
        kind: 'timetable',
        beforeReplacement: { lessonName: '数学' },
        afterReplacement: { lessonName: '英語' },
      },
      {
        kind: 'note',
        beforeBody: '変更前',
        afterBody: '変更後',
      },
      {
        kind: 'task',
        beforeTask: { title: '数学ワーク', dueDate: '2026-07-10' },
        task: { title: '英語ワーク', dueDate: '2026-07-11' },
      },
    ])
  })
})
