import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DailyLessonNoteList } from './dailyLessonNoteView'

describe('Daily Lesson Note view', () => {
  it('renders scope badges and semantic removal without attribution or time', () => {
    const html = renderToStaticMarkup(<DailyLessonNoteList notes={[
      {
        noteId: 'grade-note',
        body: '学年のノート',
        targetScopeLabel: '2年',
        onOpen: () => undefined,
      },
      {
        noteId: 'track-draft',
        body: '文科の下書き',
        targetScopeLabel: '文科',
        draft: true,
        changeKind: 'remove',
        conflicted: true,
        onOpen: () => undefined,
      },
    ]} />)

    expect(html.indexOf('学年のノート')).toBeLessThan(
      html.indexOf('文科の下書き'),
    )
    expect(html).toContain('2年')
    expect(html).toContain('文科')
    expect(html).toContain('note-related')
    expect(html.indexOf('2年')).toBeLessThan(html.indexOf('学年のノート'))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="削除予定のノート"')
    expect(html).toContain('<svg')
    expect(html).not.toContain('削除予定・要確認')
    expect(html).not.toContain('編集履歴')
    expect(html).toContain('role="button"')
    expect(html).not.toContain('note-detail-chevron')
    expect(html).not.toContain('<time')
    expect(html).not.toContain('投稿者')
  })

  it('keeps layer-dialog Notes as independent detail targets', () => {
    const html = renderToStaticMarkup(
      <DailyLessonNoteList
        presentation="detail"
        notes={[{
          noteId: 'layer-note',
          body: 'レイヤー内ノート',
          onOpen: () => undefined,
        }]}
      />,
    )

    expect(html).not.toContain('note-related')
    expect(html).toContain('note-detail-chevron')
  })
})
