import { describe, expect, it } from 'vitest'
import {
  buildChangeContentList,
  changeContentControlState,
  countChangeContentDrafts,
} from './changeContentList'

describe('change-content list projection', () => {
  it('orders dated drafts chronologically instead of prioritising the selected date', () => {
    const items = buildChangeContentList({
      timetableDrafts: [{
        sourceId: 'timetable-selected',
        targetScopeType: 'track',
        changeDate: '2026-07-12',
        periodNumber: 1,
        changeKind: 'add',
        replacement: { type: 'lesson_name', lessonName: '英語' },
      }, {
        sourceId: 'timetable-earlier',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 1,
        changeKind: 'add',
        replacement: { type: 'lesson_name', lessonName: '数学' },
      }],
      taskDrafts: [],
      noteDrafts: [],
    })

    expect(items.map((item) => item.id)).toEqual([
      'daily-lesson:2026-07-10:1',
      'daily-lesson:2026-07-12:1',
    ])
  })

  it('orders mixed drafts chronologically and by context', () => {
    const items = buildChangeContentList({
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
      'daily-lesson:2026-07-10:2',
      'task:task-selected',
      'daily-lesson:2026-07-11:1',
      'note:note-later',
      'task:task-no-date',
      'note:note-no-date',
    ])
  })

  it('groups daily-lesson Notes beneath range-ordered timetable previews', () => {
    const items = buildChangeContentList({
      timetableDrafts: [{
        sourceId: 'timetable-track',
        targetScopeType: 'track',
        changeDate: '2026-07-12',
        periodNumber: 3,
        changeKind: 'add',
        replacement: { type: 'lesson_name', lessonName: '英語' },
      }, {
        sourceId: 'timetable-grade',
        targetScopeType: 'grade',
        changeDate: '2026-07-12',
        periodNumber: 3,
        changeKind: 'add',
        replacement: { type: 'lesson_name', lessonName: '数学' },
      }, {
        sourceId: 'timetable-class',
        targetScopeType: 'class',
        changeDate: '2026-07-12',
        periodNumber: 3,
        changeKind: 'add',
        replacement: { type: 'cancelled' },
      }],
      taskDrafts: [],
      noteDrafts: [{
        kind: 'note',
        sourceId: 'lesson-note',
        targetScopeType: 'class',
        changeKind: 'add',
        body: '教室変更',
        schoolDate: '2026-07-12',
        periodNumber: 3,
      }],
      dailyLessons: [{
        schoolDate: '2026-07-12',
        periodNumber: 3,
        lessonName: '現代文',
      }],
    })

    expect(items).toMatchObject([{
      kind: 'daily-lesson',
      id: 'daily-lesson:2026-07-12:3',
      schoolDate: '2026-07-12',
      periodNumber: 3,
      resolvedLessonName: '現代文',
      timetableChanges: [
        { sourceId: 'timetable-grade', targetScopeType: 'grade' },
        { sourceId: 'timetable-class', targetScopeType: 'class' },
        { sourceId: 'timetable-track', targetScopeType: 'track' },
      ],
      children: [{ sourceId: 'lesson-note' }],
    }])
  })

  it('creates one grey-parent lesson context when only its Note changes', () => {
    const items = buildChangeContentList({
      timetableDrafts: [],
      taskDrafts: [],
      noteDrafts: [{
        kind: 'note',
        sourceId: 'lesson-note',
        targetScopeType: 'track',
        changeKind: 'add',
        body: '持ち物を確認',
        schoolDate: '2026-07-11',
        periodNumber: 2,
      }],
      dailyLessons: [{
        schoolDate: '2026-07-11',
        periodNumber: 2,
        lessonName: '地理',
      }],
    })

    expect(items).toMatchObject([{
      kind: 'daily-lesson',
      resolvedLessonName: '地理',
      timetableChanges: [],
      children: [{ sourceId: 'lesson-note' }],
    }])
  })

  it('restores a Daily Lesson parent from the persisted Note context', () => {
    const items = buildChangeContentList({
      timetableDrafts: [],
      taskDrafts: [],
      noteDrafts: [{
        kind: 'note',
        sourceId: 'restored-lesson-note',
        targetScopeType: 'student',
        changeKind: 'add',
        body: '復元した連絡',
        schoolDate: '2026-06-01',
        periodNumber: 4,
        contextSnapshot: {
          type: 'daily-lesson',
          lessonName: '物理',
        },
      }],
    })

    expect(items).toMatchObject([{
      kind: 'daily-lesson',
      resolvedLessonName: '物理',
    }])
  })

  it('keeps a cached empty lesson over an older Note context', () => {
    const items = buildChangeContentList({
      timetableDrafts: [],
      taskDrafts: [],
      noteDrafts: [{
        kind: 'note',
        sourceId: 'cancelled-lesson-note',
        targetScopeType: 'class',
        changeKind: 'add',
        body: '休講です',
        schoolDate: '2026-06-02',
        periodNumber: 5,
        contextSnapshot: {
          type: 'daily-lesson',
          lessonName: '古い授業名',
        },
      }],
      dailyLessons: [{
        schoolDate: '2026-06-02',
        periodNumber: 5,
        lessonName: '',
      }],
    })

    expect(items).toMatchObject([{
      kind: 'daily-lesson',
      resolvedLessonName: '',
    }])
  })

  it('restores a Task parent from the persisted Note context', () => {
    const items = buildChangeContentList({
      timetableDrafts: [],
      taskDrafts: [],
      noteDrafts: [{
        kind: 'note',
        sourceId: 'restored-task-note',
        targetScopeType: 'class',
        changeKind: 'add',
        body: '復元した補足',
        schoolDate: null,
        relatedTaskItemId: 'task-outside-cache',
        contextSnapshot: {
          type: 'task',
          task: {
            taskId: 'task-outside-cache',
            title: '夏休みの課題',
            dueDate: '2026-08-20',
            relatedLessonName: '数学',
            targetScopeType: 'class',
          },
        },
      }],
    })

    expect(items).toMatchObject([{
      kind: 'task',
      task: {
        taskId: 'task-outside-cache',
        title: '夏休みの課題',
        dueDate: '2026-08-20',
        relatedLessonName: '数学',
        targetScopeType: 'class',
      },
    }])
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
        kind: 'daily-lesson',
        timetableChanges: [{
          beforeReplacement: { lessonName: '数学' },
          afterReplacement: { lessonName: '英語' },
        }],
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
