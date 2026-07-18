import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { taskRemovalConfirmation } from './taskNoteCopy'
import { TaskNoteList } from './taskNoteView'

describe('Task Note view', () => {
  it('renders bodies directly without scope badges and keeps draft conflict state', () => {
    const html = renderToStaticMarkup(<TaskNoteList notes={[
      { noteId: 'new', body: '新しいノート' },
      {
        noteId: 'draft', body: '下書きノート', draft: true,
        changeKind: 'add', conflicted: true,
      },
    ]} />)

    expect(html.indexOf('新しいノート')).toBeLessThan(html.indexOf('下書きノート'))
    expect(html).toContain('note-body-clamped')
    expect(html).toContain('追加予定・要確認')
    expect(html).not.toContain('task-scope-badge')
  })

  it('lists each first line at 80 characters in Task removal confirmation', () => {
    const longFirstLine = 'あ'.repeat(81)
    expect(taskRemovalConfirmation([
      { body: `${longFirstLine}\n二行目` },
      { body: '短いノート\n続き' },
    ])).toBe(
      `このタスクとノート2件を削除予定にします\n\n・${'あ'.repeat(80)}\n・短いノート`,
    )
    expect(taskRemovalConfirmation([])).toBe('このタスクを削除予定にします')
  })
})
