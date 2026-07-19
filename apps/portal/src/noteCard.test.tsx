// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NoteBodyView, NoteCard } from './noteCard'
import { isNoteBodyOverflowing } from './noteCardLayout'

describe('School Date Note body', () => {
  it('renders the accessible expansion control only for collapsed overflow', () => {
    const collapsed = renderToStaticMarkup(
      <NoteBodyView
        body={'1行目\n2行目\n3行目\n4行目\n5行目\n6行目'}
        bodyId="note-body-1"
        expanded={false}
        overflowing
        onExpand={() => undefined}
      />,
    )
    expect(collapsed).toContain('aria-expanded="false"')
    expect(collapsed).toContain('aria-controls="note-body-1"')
    expect(collapsed).toContain('aria-label="ノートの続きを読む"')
    expect(collapsed).toContain('続きを読む')

    const expanded = renderToStaticMarkup(
      <NoteBodyView
        body={'1行目\n2行目\n3行目\n4行目\n5行目\n6行目'}
        bodyId="note-body-1"
        expanded
        overflowing
        onExpand={() => undefined}
      />,
    )
    expect(expanded).toContain('note-body-expanded')
    expect(expanded).not.toContain('続きを読む')

    const short = renderToStaticMarkup(
      <NoteBodyView
        body="短いノート"
        bodyId="note-body-2"
        expanded={false}
        overflowing={false}
        onExpand={() => undefined}
      />,
    )
    expect(short).not.toContain('続きを読む')
  })

  it('detects real layout overflow rather than character count', () => {
    expect(isNoteBodyOverflowing({ scrollHeight: 101, clientHeight: 100 }))
      .toBe(true)
    expect(isNoteBodyOverflowing({ scrollHeight: 100, clientHeight: 100 }))
      .toBe(false)
  })

  it('shows a semantic trash surface for removal and keeps history in detail', () => {
    const removed = renderToStaticMarkup(
      <NoteCard
        noteId="note-remove"
        body={'削除前\n全文'}
        targetScopeLabel="文科"
        draft
        changeKind="remove"
        conflicted
        onCancelDraft={() => undefined}
      />,
    )
    expect(removed).toContain('role="img"')
    expect(removed).toContain('aria-label="削除予定のノート"')
    expect(removed).toContain('<svg')
    expect(removed).not.toContain('要確認')
    expect(removed).not.toContain('削除を取り消す')
    expect(removed).toContain('削除前\n全文')

    const viewMode = renderToStaticMarkup(
      <NoteCard
        noteId="note-active"
        body="本文"
        targetScopeLabel="文科"
        onOpen={() => undefined}
        showChevron
      />,
    )
    expect(viewMode).toContain('role="button"')
    expect(viewMode).toContain('note-detail-chevron')
    expect(viewMode).toContain('aria-hidden="true"')
    expect(viewMode).toContain('›')
    expect(viewMode).not.toContain('編集履歴')
    expect(viewMode).not.toContain('>編集<')
    expect(viewMode).not.toContain('>削除<')

    const relatedNote = renderToStaticMarkup(
      <NoteCard
        noteId="related-note"
        body="関連ノート"
        onOpen={() => undefined}
      />,
    )
    expect(relatedNote).not.toContain('note-detail-chevron')
  })

  it('orders related Note scope, body, and lifecycle as one quiet block', () => {
    const related = renderToStaticMarkup(
      <NoteCard
        noteId="related-draft"
        body="関連ノート本文"
        targetScopeLabel="3組"
        draft
        changeKind="add"
        presentation="related"
        onOpen={() => undefined}
      />,
    )

    expect(related).toContain('note-related')
    expect(related.indexOf('3組')).toBeLessThan(
      related.indexOf('関連ノート本文'),
    )
    expect(related.indexOf('関連ノート本文')).toBeLessThan(
      related.indexOf('追加予定'),
    )
    expect(related).toContain('role="button"')
    expect(related).not.toContain('note-detail-chevron')
  })

  it('measures NoteCard overflow and expands through its native button', async () => {
    const scrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollHeight',
    )
    const clientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight',
    )
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 101,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 100,
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    let openCount = 0

    try {
      await act(async () => {
        root.render(
          <NoteCard
            noteId="note-1"
            body={'1行目\n2行目\n3行目\n4行目\n5行目\n6行目'}
            targetScopeLabel="3組"
            presentation="related"
            onOpen={() => { openCount += 1 }}
          />,
        )
      })
      const button = container.querySelector<HTMLButtonElement>(
        'button[aria-label="ノートの続きを読む"]',
      )
      expect(button).not.toBeNull()
      expect(button?.tagName).toBe('BUTTON')
      expect(button?.tabIndex).toBe(0)
      expect(button?.getAttribute('aria-expanded')).toBe('false')

      await act(async () => {
        button?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }))
      })
      expect(openCount).toBe(0)

      await act(async () => button?.click())

      expect(container.querySelector('.note-expand-button')).toBeNull()
      expect(container.querySelector('.note-body-expanded')?.textContent)
        .toBe('1行目\n2行目\n3行目\n4行目\n5行目\n6行目')
    } finally {
      await act(async () => root.unmount())
      container.remove()
      if (scrollHeight) {
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeight)
      } else {
        delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight
      }
      if (clientHeight) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight)
      } else {
        delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
      }
    }
  })
})
