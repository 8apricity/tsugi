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
})
