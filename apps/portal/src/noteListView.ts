import type { DailyPlanNoteForCache } from './dailyPlanCache'
import type { NoteDraft } from './sharedInformationEditorClient'

export type VisibleNoteListItem =
  | { type: 'active'; note: DailyPlanNoteForCache }
  | { type: 'cascade-removal'; note: DailyPlanNoteForCache }
  | {
      type: 'draft'
      draft: NoteDraft & { conflicted?: boolean }
      activeNote?: DailyPlanNoteForCache
    }

export function buildVisibleNoteList(
  activeNotes: readonly DailyPlanNoteForCache[],
  noteDrafts: readonly (NoteDraft & { conflicted?: boolean })[],
  selectedSchoolDate: string,
): VisibleNoteListItem[] {
  const generalNoteDrafts = noteDrafts.filter(
    (draft) => draft.relatedTaskItemId == null && draft.periodNumber == null,
  )
  const replacementByNoteId = new Map(
    generalNoteDrafts
      .filter((draft) => draft.changeKind !== 'add')
      .map((draft) => [draft.sharedInformationItemId, draft] as const),
  )
  const projectActive = (notes: readonly DailyPlanNoteForCache[]) =>
    notes.map((note): VisibleNoteListItem => {
      const replacement = replacementByNoteId.get(note.noteId)
      return replacement
        ? { type: 'draft', draft: replacement, activeNote: note }
        : { type: 'active', note }
    })
  const activeIds = new Set(activeNotes.map((note) => note.noteId))
  const orphanedChanges = generalNoteDrafts.filter(
    (draft) =>
      draft.changeKind !== 'add' &&
      !activeIds.has(draft.sharedInformationItemId),
  )
  const additions = [...generalNoteDrafts]
    .filter((draft) => draft.changeKind === 'add')
    .reverse()
  const datedAdditions = additions
    .filter((draft) => draft.schoolDate === selectedSchoolDate)
    .map((draft): VisibleNoteListItem => ({ type: 'draft', draft }))
  const unrelatedAdditions = additions
    .filter((draft) => draft.schoolDate === null)
    .map((draft): VisibleNoteListItem => ({ type: 'draft', draft }))
  const datedActive = activeNotes.filter(
    (note) =>
      note.relatedContext?.type === 'school-date' &&
      note.relatedContext.schoolDate === selectedSchoolDate,
  )
  const unrelatedActive = activeNotes.filter(
    (note) => note.relatedContext === null,
  )
  return [
    ...datedAdditions,
    ...orphanedChanges
      .filter((draft) => draft.schoolDate === selectedSchoolDate)
      .map((draft): VisibleNoteListItem => ({ type: 'draft', draft })),
    ...projectActive(datedActive),
    ...unrelatedAdditions,
    ...orphanedChanges
      .filter((draft) => draft.schoolDate === null)
      .map((draft): VisibleNoteListItem => ({ type: 'draft', draft })),
    ...projectActive(unrelatedActive),
  ]
}

export function buildVisibleTaskNoteList(
  activeNotes: readonly DailyPlanNoteForCache[],
  noteDrafts: readonly (NoteDraft & { conflicted?: boolean })[],
  taskId: string,
  { taskRemovalPlanned = false }: { taskRemovalPlanned?: boolean } = {},
): VisibleNoteListItem[] {
  if (taskRemovalPlanned) {
    return activeNotes.map((note) => ({ type: 'cascade-removal', note }))
  }
  const relatedDrafts = noteDrafts.filter(
    (draft) => draft.relatedTaskItemId === taskId,
  )
  const replacementByNoteId = new Map(
    relatedDrafts
      .filter((draft) => draft.changeKind !== 'add')
      .map((draft) => [draft.sharedInformationItemId, draft] as const),
  )
  const activeIds = new Set(activeNotes.map((note) => note.noteId))
  const additions = [...relatedDrafts]
    .filter((draft) => draft.changeKind === 'add')
    .reverse()
    .map((draft): VisibleNoteListItem => ({ type: 'draft', draft }))
  const orphanedChanges = relatedDrafts
    .filter((draft) =>
      draft.changeKind !== 'add' && !activeIds.has(draft.sharedInformationItemId))
    .map((draft): VisibleNoteListItem => ({ type: 'draft', draft }))
  const projectedActive = activeNotes.map((note): VisibleNoteListItem => {
    const replacement = replacementByNoteId.get(note.noteId)
    return replacement
      ? { type: 'draft', draft: replacement, activeNote: note }
      : { type: 'active', note }
  })
  return [...additions, ...orphanedChanges, ...projectedActive]
}

const dailyLessonScopeOrder = [
  'grade',
  'class',
  'track',
  'student',
] as const

export function buildVisibleDailyLessonNoteList(
  activeNotes: readonly DailyPlanNoteForCache[],
  noteDrafts: readonly (NoteDraft & { conflicted?: boolean })[],
  schoolDate: string,
  periodNumber: number,
  targetScopeType?: NoteDraft['targetScopeType'],
): VisibleNoteListItem[] {
  const matchingActive = activeNotes.filter((note) =>
    note.relatedContext?.type === 'daily-lesson' &&
    note.relatedContext.schoolDate === schoolDate &&
    note.relatedContext.periodNumber === periodNumber &&
    (targetScopeType === undefined || note.targetScopeType === targetScopeType))
  const matchingDrafts = noteDrafts.filter((draft) =>
    draft.schoolDate === schoolDate &&
    draft.periodNumber === periodNumber &&
    (targetScopeType === undefined || draft.targetScopeType === targetScopeType))
  const replacementByNoteId = new Map(
    matchingDrafts
      .filter((draft) => draft.changeKind !== 'add')
      .map((draft) => [draft.sharedInformationItemId, draft] as const),
  )
  const activeIds = new Set(matchingActive.map((note) => note.noteId))

  return dailyLessonScopeOrder.flatMap((scope) => {
    if (targetScopeType !== undefined && scope !== targetScopeType) return []
    const additions = [...matchingDrafts]
      .filter((draft) =>
        draft.targetScopeType === scope && draft.changeKind === 'add')
      .reverse()
      .map((draft): VisibleNoteListItem => ({ type: 'draft', draft }))
    const orphanedChanges = matchingDrafts
      .filter((draft) =>
        draft.targetScopeType === scope && draft.changeKind !== 'add' &&
        !activeIds.has(draft.sharedInformationItemId))
      .map((draft): VisibleNoteListItem => ({ type: 'draft', draft }))
    const projectedActive = matchingActive
      .filter((note) => note.targetScopeType === scope)
      .map((note): VisibleNoteListItem => {
        const replacement = replacementByNoteId.get(note.noteId)
        return replacement
          ? { type: 'draft', draft: replacement, activeNote: note }
          : { type: 'active', note }
      })
    return [...additions, ...orphanedChanges, ...projectedActive]
  })
}
