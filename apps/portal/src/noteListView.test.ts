import { describe, expect, it } from 'vitest'
import type { DailyPlanNoteForCache } from './dailyPlanCache'
import type { NoteDraft } from './sharedInformationEditorClient'
import { buildVisibleNoteList } from './noteListView'

describe('Daily Plan Note list projection', () => {
  it('keeps dated then unrelated groups and replaces removals in place', () => {
    const active = [
      activeNote('dated-new', '2026-07-10'),
      activeNote('dated-old', '2026-07-10'),
      activeNote('unrelated-new', null),
      activeNote('unrelated-old', null),
    ]
    const drafts = [
      addDraft('draft-unrelated', null),
      {
        ...addDraft('remove-dated-old', '2026-07-10'),
        changeKind: 'remove' as const,
        sharedInformationItemId: 'dated-old',
        expectedLatestChangeId: 'dated-old:change',
      },
      addDraft('draft-dated', '2026-07-10'),
      {
        ...addDraft('orphan-update', '2026-07-10'),
        changeKind: 'update' as const,
        sharedInformationItemId: 'removed-on-server',
        expectedLatestChangeId: 'removed-on-server:change',
      },
    ] satisfies NoteDraft[]

    expect(buildVisibleNoteList(active, drafts, '2026-07-10').map((item) =>
      item.type === 'active' ? item.note.noteId : item.draft.sourceId,
    )).toEqual([
      'draft-dated',
      'orphan-update',
      'dated-new',
      'remove-dated-old',
      'draft-unrelated',
      'unrelated-new',
      'unrelated-old',
    ])
  })
})

function activeNote(noteId: string, schoolDate: string | null): DailyPlanNoteForCache {
  return {
    noteId,
    latestChangeId: `${noteId}:change`,
    body: noteId,
    targetScopeType: 'track',
    relatedContext: schoolDate
      ? { type: 'school-date', schoolDate }
      : null,
  }
}

function addDraft(sourceId: string, schoolDate: string | null): NoteDraft {
  return {
    kind: 'note',
    changeKind: 'add',
    sourceId,
    body: sourceId,
    schoolDate,
    targetScopeType: 'track',
  }
}
