import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TaskNoteList } from './taskNoteView'
import { TaskDetailDialog } from './taskDetailView'

describe('Task detail dialog', () => {
  it('renders projected update values, attached Notes, and a re-edit action', () => {
    const markup = renderToStaticMarkup(
      <TaskDetailDialog
        task={{
          taskId: 'task-1',
          title: '変更後のタスク',
          dueDate: '2026-07-11',
          relatedLessonName: '地理',
          targetScopeType: 'track',
          notes: [],
        }}
        taskScopeLabel="文科"
        referenceSchoolDate="2026-07-10"
        draftLifecycle={{ kind: 'update', conflicted: false }}
        notes={<TaskNoteList notes={[{ noteId: 'note-1', body: '関連ノート' }]} />}
        onClose={() => undefined}
        onEdit={() => undefined}
        onCancelDraft={() => undefined}
      />,
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('変更後のタスク')
    expect(markup).toContain('7月11日まで')
    expect(markup).toContain('地理')
    expect(markup).toContain('文科')
    expect(markup).toContain('更新予定')
    expect(markup).toContain('関連ノート')
    expect(markup).toContain('編集')
    expect(markup).toContain('下書きを取り消す')
  })

  it('uses the same detail surface for direct Task editing with repeatable Notes', () => {
    const markup = renderToStaticMarkup(
      <TaskDetailDialog
        mode="edit"
        task={{
          taskId: 'task-2',
          title: '編集するタスク',
          dueDate: null,
          relatedLessonName: '数学',
          targetScopeType: 'track',
          notes: [],
        }}
        taskScopeLabel="文科"
        referenceSchoolDate="2026-07-10"
        editForm={{
          title: '編集するタスク',
          dueDate: null,
          relatedLessonInput: '数学',
          noteBodies: ['', '補足'],
          removalPlanned: false,
        }}
        notes={
          <TaskNoteList
            notes={[{
              noteId: 'note-2',
              body: '関連ノート',
              onOpenDetail: () => undefined,
              wholeCardDetailTarget: true,
            }]}
          />
        }
        onClose={() => undefined}
        onSave={() => undefined}
        onTitleChange={() => undefined}
        onDueDateChange={() => undefined}
        onRelatedLessonNameChange={() => undefined}
        onNoteBodyChange={() => undefined}
        onAddNote={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    expect(markup).toContain('タスクを編集')
    expect(markup).toContain('ノート本文 1')
    expect(markup).toContain('ノート本文 2')
    expect(markup).toContain('＋ノートを追加')
    expect(markup).toContain('変更適用範囲')
    expect(markup).toContain('文科')
    expect(markup).not.toContain('<select')
    expect(markup).toContain('note-detail-card-whole')
    expect(markup).toContain('編集履歴')
    expect(markup).not.toContain('>編集</button>')
    expect(markup).not.toContain('削除予定にする')
  })

  it('shows the removal checkbox only for reflected Tasks and disables every editable field while checked', () => {
    const markup = renderToStaticMarkup(
      <TaskDetailDialog
        mode="edit"
        task={{
          taskId: 'task-3',
          title: '削除するタスク',
          dueDate: '2026-07-10',
          relatedLessonName: '数学',
          targetScopeType: 'track',
          notes: [],
        }}
        taskScopeLabel="文科"
        referenceSchoolDate="2026-07-10"
        editForm={{
          title: '削除するタスク',
          dueDate: '2026-07-10',
          relatedLessonInput: '数学',
          noteBodies: ['新規ノート'],
          removalPlanned: true,
        }}
        notes={<TaskNoteList notes={[{ noteId: 'note-3', body: '既存ノート' }]} />}
        onClose={() => undefined}
        onSave={() => undefined}
        onTitleChange={() => undefined}
        onDueDateChange={() => undefined}
        onRelatedLessonNameChange={() => undefined}
        onNoteBodyChange={() => undefined}
        onAddNote={() => undefined}
        onRemovalChange={() => undefined}
      />,
    )

    expect(markup).toContain('削除予定にする')
    expect(markup.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(5)
    expect(markup).toContain('既存ノート')
  })
})
