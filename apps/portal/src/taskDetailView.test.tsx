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

  it('uses the Task detail surface for direct editing and repeatable new Notes', () => {
    const markup = renderToStaticMarkup(
      <TaskDetailDialog
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
        mode="edit"
        editForm={{
          noteBodies: ['', '補足'],
        }}
        editorFields={
          <>
            <label><span>タイトル</span><input defaultValue="編集するタスク" /></label>
            <label><span>関連する授業（原則設定する）</span><input role="combobox" defaultValue="数学" /></label>
            <dl className="detail-list task-edit-context">
              <div><dt>変更適用範囲</dt><dd>文科</dd></div>
            </dl>
          </>
        }
        notes={
          <TaskNoteList
            presentation="detail"
            notes={[{
              noteId: 'note-2',
              body: '既存ノート',
              onOpen: () => undefined,
            }]}
          />
        }
        onClose={() => undefined}
        onSave={() => undefined}
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
    expect(markup).toContain('task-note-detail-list')
    expect(markup).toContain('note-detail-chevron')
    expect(markup).not.toContain('task-scope-badge')
    expect(markup).toContain('編集履歴')
    expect(markup).not.toContain('>編集</button>')
    expect(markup).not.toContain('削除予定にする')
  })
})
