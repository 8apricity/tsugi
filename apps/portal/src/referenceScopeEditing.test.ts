import { describe, expect, it } from 'vitest'
import {
  createReferenceScopeEditingSession,
} from './referenceScopeEditing'
import { createSharedInformationEditorClient } from './sharedInformationEditorClient'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('Reference Scope editing session', () => {
  it('pauses the draft workspace, preserves drafts, and resumes without submission', () => {
    const submittedBatches: unknown[] = []
    const editor = createSharedInformationEditorClient({
      storage: memoryStorage(),
      submitDirectChanges: async (batch) => {
        submittedBatches.push(batch)
        return { status: 'rejected' }
      },
    })
    const session = createReferenceScopeEditingSession({
      isEditing: () => editor.getSnapshot().editing,
      pauseEditing: () => editor.exitEditing(),
      resumeEditing: () => editor.enterEditing(),
    })

    editor.saveTaskDraft({
      title: '持ち越す下書き',
      dueDate: '2026-07-10',
      relatedLessonName: null,
      targetScopeType: 'track',
    })

    session.enterReferenceScope()

    expect(editor.getSnapshot()).toMatchObject({
      editing: false,
      draftCount: 1,
      taskDrafts: [{ title: '持ち越す下書き' }],
    })
    expect(submittedBatches).toEqual([])

    session.leaveReferenceScope()

    expect(editor.getSnapshot()).toMatchObject({
      editing: true,
      draftCount: 1,
      taskDrafts: [{ title: '持ち越す下書き' }],
    })
    expect(submittedBatches).toEqual([])
  })

  it('does not enter edit mode on return when it was already paused', () => {
    let editing = false
    const session = createReferenceScopeEditingSession({
      isEditing: () => editing,
      pauseEditing: () => {
        editing = false
      },
      resumeEditing: () => {
        editing = true
      },
    })

    session.enterReferenceScope()
    session.leaveReferenceScope()

    expect(editing).toBe(false)
  })
})
