import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ConfirmationDialog,
  EditorDialog,
  ReadOnlyDialog,
} from './dialogFoundation'

describe('dialog foundation adapters', () => {
  it('renders a root read-only dialog with one close-all action', () => {
    const html = renderToStaticMarkup(
      <ReadOnlyDialog
        active
        title="タスクの詳細"
        size="standard"
        onClose={() => undefined}
      >
        <p>本文</p>
      </ReadOnlyDialog>,
    )

    expect(html).toContain('<dialog')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('タスクの詳細')
    expect(html).toContain('aria-label="閉じる"')
    expect(html).not.toContain('aria-label="戻る"')
  })

  it('renders a child read-only dialog with Back and close-all actions', () => {
    const html = renderToStaticMarkup(
      <ReadOnlyDialog
        active
        title="ノートの詳細"
        size="standard"
        backLabel="タスクの詳細に戻る"
        onBack={() => undefined}
        onClose={() => undefined}
      >
        <p>本文</p>
      </ReadOnlyDialog>,
    )

    expect(html).toContain('aria-label="タスクの詳細に戻る"')
    expect(html).toContain('aria-label="閉じる"')
  })

  it('owns editor Back and submit controls', () => {
    const html = renderToStaticMarkup(
      <EditorDialog
        active
        title="変更を反映"
        size="wide"
        formId="change-content-form"
        submitLabel="確定"
        submitAriaLabel="変更を確定"
        onBack={() => undefined}
      >
        <form id="change-content-form">
          <input aria-label="変更内容" />
        </form>
      </EditorDialog>,
    )

    expect(html).toContain('aria-label="戻る"')
    expect(html).toContain('form="change-content-form"')
    expect(html).toContain('aria-label="変更を確定"')
    expect(html).toContain('>確定</button>')
    expect(html).not.toContain('aria-label="閉じる"')
  })

  it('owns confirmation semantics and safe initial action order', () => {
    const html = renderToStaticMarkup(
      <ConfirmationDialog
        active
        title="入力内容を破棄しますか？"
        description="保存していない入力内容は失われます。"
        tone="danger"
        cancelLabel="編集を続ける"
        confirmLabel="入力内容を破棄"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('role="alertdialog"')
    expect(html).toContain('aria-describedby=')
    expect(html).toContain('編集を続ける')
    expect(html).toContain('入力内容を破棄')
    expect(html.indexOf('>編集を続ける</button>')).toBeLessThan(
      html.indexOf('>入力内容を破棄</button>'),
    )
  })

  it('keeps a retained parent mounted but inaccessible', () => {
    const html = renderToStaticMarkup(
      <ReadOnlyDialog
        active={false}
        title="タスクの詳細"
        size="standard"
        onClose={() => undefined}
      >
        <p>本文</p>
      </ReadOnlyDialog>,
    )

    expect(html).toContain('<dialog')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('inert=""')
  })
})
