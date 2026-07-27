import { describe, expect, it } from 'vitest'
import { createDialogFlowClient } from './dialogFlow'

describe('Dialog Flow', () => {
  it('returns from a related Note to its Task while close-all leaves the whole flow', () => {
    const flow = createDialogFlowClient()

    flow.openTaskDetail({
      taskId: 'task-1',
      returnFocus: { kind: 'task-item', taskId: 'task-1' },
    })
    flow.openNoteDetail({
      noteId: 'note-1',
      returnFocus: {
        kind: 'task-note',
        taskId: 'task-1',
        noteId: 'note-1',
      },
    })

    const back = flow.back()

    expect(back.status).toBe('changed')
    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'task-detail',
    ])
    expect(back.focusTarget).toEqual({
      kind: 'task-note',
      taskId: 'task-1',
      noteId: 'note-1',
    })

    flow.openNoteDetail({ noteId: 'note-1' })
    const close = flow.closeAll()

    expect(close.status).toBe('changed')
    expect(flow.getSnapshot().routes).toEqual([])
    expect(close.focusTarget).toEqual({
      kind: 'task-item',
      taskId: 'task-1',
    })
  })

  it('keeps a single active root flow', () => {
    const flow = createDialogFlowClient()
    flow.openTaskDetail({ taskId: 'task-1' })

    const result = flow.openReferencePicker()

    expect(result.status).toBe('rejected')
    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'task-detail',
    ])
  })

  it('holds a dirty transition until the student confirms it', () => {
    const flow = createDialogFlowClient()
    flow.openTaskDetail({ taskId: 'task-1' })
    flow.openNoteDetail({ noteId: 'note-1' })

    const blocked = flow.back({ dirty: true })

    expect(blocked.status).toBe('blocked')
    expect(flow.getSnapshot().overlay?.kind).toBe('discard-unsaved')
    expect(flow.getSnapshot().routes).toHaveLength(2)

    flow.cancelOverlay()
    expect(flow.getSnapshot().overlay).toBeNull()
    expect(flow.getSnapshot().routes).toHaveLength(2)

    flow.back({ dirty: true })
    const confirmed = flow.confirmPending()

    expect(confirmed.status).toBe('changed')
    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'task-detail',
    ])
  })

  it('returns semantic focus when a dirty transition is cancelled', () => {
    const flow = createDialogFlowClient()
    flow.openTaskEditor({ taskId: 'task-1' })

    flow.closeAll({
      dirty: true,
      cancelFocus: { kind: 'active-dialog-control', control: 'close' },
    })
    const cancelled = flow.cancelOverlay()

    expect(cancelled).toMatchObject({
      status: 'changed',
      focusTarget: { kind: 'active-dialog-control', control: 'close' },
    })
    expect(flow.getSnapshot().routes).toHaveLength(1)

    flow.back({
      dirty: true,
      cancelFocus: { kind: 'active-dialog-control', control: 'back' },
    })
    const browserBack = flow.back()

    expect(browserBack.focusTarget).toEqual({
      kind: 'active-dialog-control',
      control: 'back',
    })
    expect(flow.getSnapshot().routes).toHaveLength(1)
  })

  it('restores root focus after confirmed close-all', () => {
    const flow = createDialogFlowClient()
    flow.openTaskEditor({
      taskId: 'task-1',
      returnFocus: { kind: 'task-item', taskId: 'task-1' },
    })

    flow.closeAll({ dirty: true })
    const confirmed = flow.confirmPending()

    expect(confirmed.focusTarget).toEqual({
      kind: 'task-item',
      taskId: 'task-1',
    })
    expect(flow.getSnapshot().routes).toEqual([])
  })

  it('cancels a confirmation overlay before navigating its route', () => {
    const flow = createDialogFlowClient()
    flow.openTaskEditor({ taskId: 'task-1' })
    flow.openTaskRemovalConfirmation()

    const result = flow.back()

    expect(result.status).toBe('changed')
    expect(flow.getSnapshot().overlay).toBeNull()
    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'task-editor',
    ])
  })

  it('removes an invalid route and its descendants by route instance', () => {
    const flow = createDialogFlowClient()
    flow.openTaskDetail({ taskId: 'task-1' })
    flow.openNoteDetail({ noteId: 'note-1' })
    const taskInstanceId = flow.getSnapshot().routes[0].instanceId
    const noteInstanceId = flow.getSnapshot().routes[1].instanceId

    const result = flow.invalidate(taskInstanceId)

    expect(result.status).toBe('changed')
    expect(flow.getSnapshot().routes).toEqual([])
    expect(flow.hasInstance(noteInstanceId)).toBe(false)
  })

  it('publishes only observable flow changes to React subscribers', () => {
    const flow = createDialogFlowClient()
    const observedKinds: string[][] = []
    const unsubscribe = flow.subscribe(() => {
      observedKinds.push(flow.getSnapshot().routes.map((route) => route.kind))
    })

    flow.openTaskDetail({ taskId: 'task-1' })
    flow.openReferencePicker()
    flow.back()
    unsubscribe()

    expect(observedKinds).toEqual([['task-detail'], []])
  })

  it('opens the same Shared Information Change Detail from every Edit History', () => {
    const flow = createDialogFlowClient()

    flow.openChangeContent()
    flow.openTimetableLayer({ schoolDate: '2026-07-24', periodNumber: 2 })
    flow.openTimetableHistory({
      schoolDate: '2026-07-24',
      periodNumber: 2,
      targetScopeType: 'class',
    })
    flow.openSharedInformationChangeDetail({
      sharedInformationChangeId: 'timetable-change-1',
      returnFocus: {
        kind: 'shared-information-history-entry',
        sharedInformationChangeId: 'timetable-change-1',
      },
    })

    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'change-content',
      'timetable-layer',
      'timetable-history',
      'shared-information-change-detail',
    ])

    expect(flow.back().focusTarget).toEqual({
      kind: 'shared-information-history-entry',
      sharedInformationChangeId: 'timetable-change-1',
    })
    flow.closeAll()

    flow.openTaskDetail({ taskId: 'task-1' })
    flow.openTaskHistory({ taskId: 'task-1' })
    expect(flow.openSharedInformationChangeDetail({
      sharedInformationChangeId: 'task-change-1',
    }).status).toBe('changed')
    expect(flow.getSnapshot().routes.at(-1)?.kind).toBe(
      'shared-information-change-detail',
    )
    flow.closeAll()

    flow.openNoteDetail({ noteId: 'note-1' })
    flow.openNoteHistory({ noteId: 'note-1' })
    expect(flow.openSharedInformationChangeDetail({
      sharedInformationChangeId: 'note-change-1',
    }).status).toBe('changed')
    expect(flow.getSnapshot().routes.at(-1)?.kind).toBe(
      'shared-information-change-detail',
    )
  })

  it('uses the real parent route as the successful editor destination', () => {
    const flow = createDialogFlowClient()
    flow.openChangeContent()
    flow.openTaskEditor({ taskId: 'task-1' })

    flow.completeCurrent()

    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'change-content',
    ])

    flow.closeAll()
    flow.openNoteEditor({ draftId: 'draft-note-1' })
    flow.completeCurrent()

    expect(flow.getSnapshot().routes).toEqual([])
  })

  it('keeps Task and Note edit histories as read-only children', () => {
    const flow = createDialogFlowClient()
    flow.openTaskDetail({ taskId: 'task-1' })
    flow.openTaskHistory({ taskId: 'task-1' })

    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'task-detail',
      'task-history',
    ])

    flow.closeAll()
    flow.openNoteDetail({ noteId: 'note-1' })
    flow.openNoteHistory({ noteId: 'note-1' })

    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'note-detail',
      'note-history',
    ])
  })

  it('keeps a Timetable editor under its layer context', () => {
    const flow = createDialogFlowClient()
    flow.openTimetableLayer({ schoolDate: '2026-07-24', periodNumber: 2 })
    flow.openTimetableEditor({
      schoolDate: '2026-07-24',
      periodNumber: 2,
      targetScopeType: 'track',
    })

    flow.completeCurrent()

    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'timetable-layer',
    ])
  })

  it('treats standalone confirmations as the active overlay', () => {
    const flow = createDialogFlowClient()

    flow.openLogoutConfirmation()
    expect(flow.getSnapshot().active).toBe(true)

    flow.back()
    flow.openDraftExitConfirmation()

    expect(flow.getSnapshot().overlay?.kind).toBe('draft-exit-confirmation')
    expect(flow.getSnapshot().routes).toEqual([])
  })

  it('resumes an edit-workspace exit after dirty confirmation', () => {
    const flow = createDialogFlowClient()
    flow.openTaskEditor({ taskId: 'task-1' })

    flow.requestExitEditing({ dirty: true })
    const result = flow.confirmPending()

    expect(result.completedAction).toBe('exit-editing')
    expect(flow.getSnapshot().routes).toEqual([])
  })

  it('updates a Timetable Layer context without replacing its route instance', () => {
    const flow = createDialogFlowClient()
    flow.openTimetableLayer({ schoolDate: '2026-07-24', periodNumber: 2 })
    const instanceId = flow.getSnapshot().routes[0].instanceId

    flow.navigateTimetableLayer({
      schoolDate: '2026-07-25',
      periodNumber: 3,
    })

    expect(flow.getSnapshot().routes[0]).toMatchObject({
      kind: 'timetable-layer',
      instanceId,
      schoolDate: '2026-07-25',
      periodNumber: 3,
    })
  })

  it('guards an invalidated route when removing it would discard input', () => {
    const flow = createDialogFlowClient()
    flow.openTaskEditor({ taskId: 'task-1' })
    const instanceId = flow.getSnapshot().routes[0].instanceId

    const blocked = flow.invalidate(instanceId, { dirty: true })
    expect(blocked.status).toBe('blocked')
    expect(flow.getSnapshot().routes).toHaveLength(1)

    flow.confirmPending()
    expect(flow.getSnapshot().routes).toEqual([])
  })

  it('rejects new navigation while a confirmation overlay is active', () => {
    const flow = createDialogFlowClient()
    flow.openLogoutConfirmation()

    const root = flow.openReferencePicker()

    expect(root.status).toBe('rejected')
    expect(flow.getSnapshot().routes).toEqual([])
    expect(flow.getSnapshot().overlay?.kind).toBe('logout-confirmation')
  })

  it('opens a reflected Note from Change Content and returns to the review', () => {
    const flow = createDialogFlowClient()
    flow.openChangeContent()

    const opened = flow.openNoteDetail({ noteId: 'note-1' })
    flow.completeCurrent()

    expect(opened.status).toBe('changed')
    expect(flow.getSnapshot().routes.map((route) => route.kind)).toEqual([
      'change-content',
    ])
  })
})
