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

  it('shows textual lifecycle states and keeps history outside editing mode', () => {
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
    expect(removed).toContain('削除予定')
    expect(removed).toContain('要確認')
    expect(removed).toContain('削除を取り消す')
    expect(removed).toContain('削除前\n全文')

    const viewMode = renderToStaticMarkup(
      <NoteCard
        noteId="note-active"
        body="本文"
        targetScopeLabel="文科"
        onOpenHistory={() => undefined}
      />,
    )
    expect(viewMode).toContain('編集履歴')
    expect(viewMode).not.toContain('>編集<')
    expect(viewMode).not.toContain('>削除<')
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

    try {
      await act(async () => {
        root.render(
          <NoteCard
            noteId="note-1"
            body={'1行目\n2行目\n3行目\n4行目\n5行目\n6行目'}
            targetScopeLabel="3組"
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
