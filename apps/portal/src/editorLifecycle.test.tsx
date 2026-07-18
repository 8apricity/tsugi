import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  editorActionLabel,
  hasUnsavedEditorInput,
  immutableFieldMessage,
  lifecycleLabel,
} from './editorLifecycle'
import {
  DiscardConfirmationDialog,
  ImmutableFieldNotice,
  LifecycleIcon,
} from './editorLifecycleView'

describe('shared editor lifecycle', () => {
  it.each([
    ['add', '追加予定', 'lifecycle-add', '+'],
    ['update', '更新予定', 'lifecycle-update', '鉛筆'],
    ['remove', '削除予定', 'lifecycle-remove', 'ごみ箱'],
  ] as const)('renders an accessible %s icon', (kind, label, className, glyphLabel) => {
    const html = renderToStaticMarkup(<LifecycleIcon kind={kind} />)

    expect(lifecycleLabel(kind, false)).toBe(label)
    expect(html).toContain(className)
    expect(html).toContain(`aria-label="${label}"`)
    expect(html).toContain(`title="${label}の下書き"`)
    expect(html).toContain(`data-glyph="${glyphLabel}"`)
  })

  it('uses one amber warning meaning when any lifecycle state conflicts', () => {
    const html = renderToStaticMarkup(
      <LifecycleIcon kind="remove" conflicted />,
    )

    expect(lifecycleLabel('remove', true)).toBe('削除予定・要確認')
    expect(html).toContain('lifecycle-conflict')
    expect(html).toContain('aria-label="削除予定・要確認"')
    expect(html).toContain('title="ほかの変更と重なっています"')
    expect(html).toContain('data-glyph="警告"')
  })

  it('uses consistent add, update, and removal action copy', () => {
    expect(editorActionLabel('add')).toBe('下書きを保存')
    expect(editorActionLabel('update')).toBe('下書きを更新')
    expect(editorActionLabel('remove')).toBe('削除予定にする')
  })

  it('detects unsaved form input without treating an unchanged form as dirty', () => {
    const initial = { title: '課題', dueDate: null, scope: 'class' }

    expect(hasUnsavedEditorInput(initial, { ...initial })).toBe(false)
    expect(hasUnsavedEditorInput(initial, { ...initial, title: '課題2' })).toBe(true)
  })

  it('renders an in-app dirty-form confirmation that preserves saved drafts', () => {
    const html = renderToStaticMarkup(
      <DiscardConfirmationDialog
        onContinue={() => undefined}
        onDiscard={() => undefined}
      />,
    )

    expect(html).toContain('role="alertdialog"')
    expect(html).toContain('入力内容を破棄しますか？')
    expect(html).toContain('保存済みの下書きは変更されません。')
    expect(html).toContain('編集を続ける')
    expect(html).toContain('入力内容を破棄')
  })

  it.each([
    ['timetable', '時間割変更の日付・時限・変更適用範囲は変更できません。削除予定にしてから追加し直してください。'],
    ['note', 'ノートの日付と変更適用範囲は変更できません。削除予定にしてから追加し直してください。'],
    ['task', 'タスクの変更適用範囲は変更できません。削除予定にしてから追加し直してください。'],
  ] as const)('provides a context-specific immutable %s notice', (kind, message) => {
    const html = renderToStaticMarkup(
      <ImmutableFieldNotice kind={kind} onNotify={() => undefined}>
        <input value="固定値" readOnly />
      </ImmutableFieldNotice>,
    )

    expect(immutableFieldMessage(kind)).toBe(message)
    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain(`aria-label="${message}"`)
    expect(html).toContain(`title="${message}"`)
  })

  it('tailors immutable Note copy to its placement', () => {
    expect(immutableFieldMessage('note', 'task')).toBe(
      'ノートを関連付けるタスクは変更できません。削除予定にしてから追加し直してください。',
    )
    expect(immutableFieldMessage('note', 'daily-lesson')).toBe(
      'ノートの日付・時限・変更適用範囲は変更できません。削除予定にしてから追加し直してください。',
    )
  })
})
