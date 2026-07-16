import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReferenceDailyPlanNotes } from './referenceDailyPlanNoteView'

describe('Reference Scope Daily Plan Note view', () => {
  it('renders every context in its ordinary position without edit, history, or identity UI', () => {
    const html = renderToStaticMarkup(
      <ReferenceDailyPlanNotes
        schoolDate="2026-07-10"
        targetScopeLabel="4組"
        basePeriods={[
          { periodNumber: 1, lessonName: '英語' },
          { periodNumber: 2, lessonName: '数学' },
        ]}
        periods={[
          { periodNumber: 1, notes: [] },
          {
            periodNumber: 2,
            notes: [{
              noteId: 'period-note',
              body: '2限のノート\n2行目\n3行目\n4行目\n5行目\n6行目',
              targetScopeType: 'class',
              relatedContext: {
                type: 'daily-lesson',
                schoolDate: '2026-07-10',
                periodNumber: 2,
              },
            }],
          },
        ]}
        tasks={[{
          taskId: 'task-1',
          title: '提出物',
          dueDate: '2026-07-10',
          targetScopeType: 'class',
          createdAt: 1,
          notes: [{
            noteId: 'task-note',
            body: 'タスク内のノート',
            targetScopeType: 'class',
            relatedContext: { type: 'task', taskId: 'task-1' },
          }],
        }]}
        notes={[
          {
            noteId: 'date-note',
            body: '当日のノート',
            targetScopeType: 'class',
            relatedContext: {
              type: 'school-date',
              schoolDate: '2026-07-10',
            },
          },
          {
            noteId: 'unrelated-note',
            body: '常設ノート',
            targetScopeType: 'class',
            relatedContext: null,
          },
        ]}
      />,
    )

    expect(html).toContain('aria-label="2限 数学"')
    expect(html).toContain('class="lesson-name">数学</span>')
    expect(html).toContain('2限のノート')
    expect(html).toContain('class="panel timetable-panel"')
    expect(html).toContain('class="period-row"')
    expect(html).toContain('class="panel daily-section"')
    expect(html).toContain('task-note-list')
    expect(html).toContain('タスク内のノート')
    expect(html.indexOf('当日のノート')).toBeLessThan(
      html.indexOf('常設ノート'),
    )
    expect(html).toContain('note-body-clamped')
    expect(html).toContain('4組')
    expect(html).not.toContain('編集履歴')
    expect(html).not.toContain('>編集<')
    expect(html).not.toContain('>削除<')
    expect(html).not.toContain('投稿者')
    expect(html).not.toContain('<time')
  })
})
