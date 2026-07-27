export type DialogFocusTarget =
  | {
      kind: 'task-note'
      taskId: string
      noteId: string
    }
  | {
      kind: 'daily-lesson-note'
      schoolDate: string
      periodNumber: number
      noteId: string
    }
  | {
      kind: 'task-history-trigger'
      taskId: string
    }
  | {
      kind: 'note-history-trigger'
      noteId: string
    }
  | {
      kind: 'shared-information-history-entry'
      sharedInformationChangeId: string
    }
  | {
      kind: 'task-item'
      taskId: string
    }
  | {
      kind: 'note-item'
      noteId: string
    }
  | {
      kind: 'daily-lesson'
      schoolDate: string
      periodNumber: number
    }
  | {
      kind: 'change-content-item'
      itemId: string
    }
  | {
      kind: 'timetable-layer-action'
      targetScopeType: DialogTargetScopeType
      action: 'edit' | 'history'
    }
  | {
      kind: 'active-dialog-control'
      control: 'back' | 'close'
    }
  | {
      kind: 'flow-trigger'
      control:
        | 'change-content'
        | 'reference-picker'
        | 'task'
        | 'note'
        | 'timetable-layer'
    }

export type DialogTargetScopeType = 'grade' | 'class' | 'track' | 'student'

export type DailyLessonIdentity = {
  schoolDate: string
  periodNumber: number
}

export type DialogRoute =
  | { kind: 'task-detail'; taskId: string }
  | { kind: 'note-detail'; noteId: string }
  | {
      kind: 'task-editor'
      taskId?: string
      draftId?: string
    }
  | {
      kind: 'note-editor'
      noteId?: string
      draftId?: string
    }
  | { kind: 'task-history'; taskId: string }
  | { kind: 'note-history'; noteId: string }
  | { kind: 'reference-picker' }
  | { kind: 'change-content' }
  | ({ kind: 'timetable-layer' } & DailyLessonIdentity)
  | ({
      kind: 'timetable-editor'
      targetScopeType: DialogTargetScopeType
    } & DailyLessonIdentity)
  | ({
      kind: 'timetable-history'
      targetScopeType: DialogTargetScopeType
    } & DailyLessonIdentity)
  | {
      kind: 'shared-information-change-detail'
      sharedInformationChangeId: string
    }

export type DialogRouteEntry = DialogRoute & {
  instanceId: string
  returnFocus?: DialogFocusTarget
}

export type DialogFlowSnapshot = {
  active: boolean
  routes: readonly DialogRouteEntry[]
  overlay:
    | { kind: 'discard-unsaved' }
    | { kind: 'task-removal-confirmation' }
    | { kind: 'draft-exit-confirmation' }
    | { kind: 'logout-confirmation' }
    | null
  pendingTransition:
    | {
        kind: 'back' | 'close-all' | 'exit-editing'
        cancelFocus?: DialogFocusTarget
      }
    | {
        kind: 'invalidate'
        instanceId: string
        cancelFocus?: DialogFocusTarget
      }
    | null
}

type GuardedTransitionOptions = {
  dirty?: boolean
  cancelFocus?: DialogFocusTarget
}

export type DialogFlowResult =
  | {
      status: 'changed'
      removedRoutes: readonly DialogRouteEntry[]
      focusTarget?: DialogFocusTarget
      completedAction?: 'exit-editing'
    }
  | {
      status: 'unchanged'
      removedRoutes: readonly []
      focusTarget?: undefined
      completedAction?: undefined
    }
  | {
      status: 'rejected'
      removedRoutes: readonly []
      focusTarget?: undefined
      completedAction?: undefined
    }
  | {
      status: 'blocked'
      removedRoutes: readonly []
      focusTarget?: undefined
      completedAction?: undefined
    }

export type DialogFlowClient = {
  getSnapshot(): DialogFlowSnapshot
  subscribe(listener: () => void): () => void
  openTaskDetail(input: {
    taskId: string
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openNoteDetail(input: {
    noteId: string
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openTaskEditor(input: {
    taskId?: string
    draftId?: string
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openNoteEditor(input: {
    noteId?: string
    draftId?: string
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openTaskHistory(input: {
    taskId: string
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openNoteHistory(input: {
    noteId: string
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openReferencePicker(input?: {
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openChangeContent(input?: {
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openTimetableLayer(input: {
    schoolDate: string
    periodNumber: number
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  navigateTimetableLayer(input: DailyLessonIdentity): DialogFlowResult
  openTimetableHistory(input: {
    schoolDate: string
    periodNumber: number
    targetScopeType: DialogTargetScopeType
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openTimetableEditor(input: {
    schoolDate: string
    periodNumber: number
    targetScopeType: DialogTargetScopeType
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openSharedInformationChangeDetail(input: {
    sharedInformationChangeId: string
    returnFocus?: DialogFocusTarget
  }): DialogFlowResult
  openTaskRemovalConfirmation(): DialogFlowResult
  openDraftExitConfirmation(): DialogFlowResult
  openLogoutConfirmation(): DialogFlowResult
  requestExitEditing(options?: GuardedTransitionOptions): DialogFlowResult
  back(options?: GuardedTransitionOptions): DialogFlowResult
  closeAll(options?: GuardedTransitionOptions): DialogFlowResult
  cancelOverlay(): DialogFlowResult
  confirmPending(): DialogFlowResult
  completeCurrent(): DialogFlowResult
  invalidate(
    instanceId: string,
    options?: GuardedTransitionOptions,
  ): DialogFlowResult
  hasInstance(instanceId: string): boolean
}

export function createDialogFlowClient(): DialogFlowClient {
  let nextInstanceId = 0
  let routes: DialogRouteEntry[] = []
  let overlay: DialogFlowSnapshot['overlay'] = null
  let pendingTransition: DialogFlowSnapshot['pendingTransition'] = null
  let snapshot: DialogFlowSnapshot = {
    active: false,
    routes,
    overlay,
    pendingTransition,
  }
  const listeners = new Set<() => void>()

  function publish() {
    snapshot = {
      active: routes.length > 0 || overlay !== null,
      routes,
      overlay,
      pendingTransition,
    }
    listeners.forEach((listener) => listener())
  }

  function entry<T extends DialogRoute>(
    route: T,
    returnFocus?: DialogFocusTarget,
  ): DialogRouteEntry {
    nextInstanceId += 1
    return {
      ...route,
      instanceId: `dialog-route-${nextInstanceId}`,
      ...(returnFocus ? { returnFocus } : {}),
    }
  }

  function openRoot(
    route: DialogRoute,
    returnFocus?: DialogFocusTarget,
  ): DialogFlowResult {
    if (routes.length > 0 || overlay) {
      return { status: 'rejected', removedRoutes: [] }
    }
    routes = [entry(route, returnFocus)]
    publish()
    return { status: 'changed', removedRoutes: [] }
  }

  function openChild(
    route: DialogRoute,
    allowedParents: readonly DialogRoute['kind'][],
    returnFocus?: DialogFocusTarget,
  ): DialogFlowResult {
    const parent = routes.at(-1)
    if (overlay || !parent || !allowedParents.includes(parent.kind)) {
      return { status: 'rejected', removedRoutes: [] }
    }
    routes = [...routes, entry(route, returnFocus)]
    publish()
    return { status: 'changed', removedRoutes: [] }
  }

  function openOverlay(
    nextOverlay: NonNullable<DialogFlowSnapshot['overlay']>,
  ): DialogFlowResult {
    if (overlay) return { status: 'rejected', removedRoutes: [] }
    overlay = nextOverlay
    publish()
    return { status: 'changed', removedRoutes: [] }
  }

  function popCurrentRoute(): DialogFlowResult {
    const removed = routes.at(-1)
    if (!removed) return { status: 'unchanged', removedRoutes: [] }
    routes = routes.slice(0, -1)
    publish()
    return {
      status: 'changed',
      removedRoutes: [removed],
      ...(removed.returnFocus ? { focusTarget: removed.returnFocus } : {}),
    }
  }

  function closeAllRoutes(): DialogFlowResult {
    if (routes.length === 0) {
      return { status: 'unchanged', removedRoutes: [] }
    }
    const removedRoutes = routes
    const focusTarget = routes[0].returnFocus
    routes = []
    publish()
    return {
      status: 'changed',
      removedRoutes,
      ...(focusTarget ? { focusTarget } : {}),
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    openTaskDetail: ({ taskId, returnFocus }) => {
      return openRoot({ kind: 'task-detail', taskId }, returnFocus)
    },
    openNoteDetail: ({ noteId, returnFocus }) => {
      if (routes.length === 0) {
        return openRoot({ kind: 'note-detail', noteId }, returnFocus)
      }
      return openChild(
        { kind: 'note-detail', noteId },
        [
          'change-content',
          'task-detail',
          'task-editor',
          'timetable-layer',
        ],
        returnFocus,
      )
    },
    openTaskEditor: ({ taskId, draftId, returnFocus }) => {
      const route: DialogRoute = {
        kind: 'task-editor',
        ...(taskId ? { taskId } : {}),
        ...(draftId ? { draftId } : {}),
      }
      if (routes.length === 0) return openRoot(route, returnFocus)
      return openChild(route, ['change-content', 'task-detail'], returnFocus)
    },
    openNoteEditor: ({ noteId, draftId, returnFocus }) => {
      const route: DialogRoute = {
        kind: 'note-editor',
        ...(noteId ? { noteId } : {}),
        ...(draftId ? { draftId } : {}),
      }
      if (routes.length === 0) return openRoot(route, returnFocus)
      return openChild(route, [
        'change-content',
        'task-detail',
        'task-editor',
        'timetable-layer',
      ], returnFocus)
    },
    openTaskHistory: ({ taskId, returnFocus }) =>
      openChild({ kind: 'task-history', taskId }, [
        'task-detail',
        'task-editor',
      ], returnFocus),
    openNoteHistory: ({ noteId, returnFocus }) =>
      openChild({ kind: 'note-history', noteId }, [
        'note-detail',
        'note-editor',
      ], returnFocus),
    openReferencePicker: (input) => {
      return openRoot({ kind: 'reference-picker' }, input?.returnFocus)
    },
    openChangeContent: (input) =>
      openRoot({ kind: 'change-content' }, input?.returnFocus),
    openTimetableLayer: ({ schoolDate, periodNumber, returnFocus }) => {
      if (routes.length === 0) {
        return openRoot(
          { kind: 'timetable-layer', schoolDate, periodNumber },
          returnFocus,
        )
      }
      return openChild(
        { kind: 'timetable-layer', schoolDate, periodNumber },
        ['change-content'],
        returnFocus,
      )
    },
    navigateTimetableLayer: ({ schoolDate, periodNumber }) => {
      const current = routes.at(-1)
      if (current?.kind !== 'timetable-layer') {
        return { status: 'rejected', removedRoutes: [] }
      }
      routes = [
        ...routes.slice(0, -1),
        { ...current, schoolDate, periodNumber },
      ]
      publish()
      return { status: 'changed', removedRoutes: [] }
    },
    openTimetableHistory: ({
      schoolDate,
      periodNumber,
      targetScopeType,
      returnFocus,
    }) =>
      openChild(
        {
          kind: 'timetable-history',
          schoolDate,
          periodNumber,
          targetScopeType,
        },
        ['timetable-layer'],
        returnFocus,
      ),
    openTimetableEditor: ({
      schoolDate,
      periodNumber,
      targetScopeType,
      returnFocus,
    }) =>
      openChild(
        {
          kind: 'timetable-editor',
          schoolDate,
          periodNumber,
          targetScopeType,
        },
        ['timetable-layer'],
        returnFocus,
      ),
    openSharedInformationChangeDetail: ({
      sharedInformationChangeId,
      returnFocus,
    }) =>
      openChild(
        { kind: 'shared-information-change-detail', sharedInformationChangeId },
        ['timetable-history', 'task-history', 'note-history'],
        returnFocus,
      ),
    openTaskRemovalConfirmation: () => {
      if (routes.at(-1)?.kind !== 'task-editor') {
        return { status: 'rejected', removedRoutes: [] }
      }
      return openOverlay({ kind: 'task-removal-confirmation' })
    },
    openDraftExitConfirmation: () => {
      if (routes.length > 0) {
        return { status: 'rejected', removedRoutes: [] }
      }
      return openOverlay({ kind: 'draft-exit-confirmation' })
    },
    openLogoutConfirmation: () => {
      if (routes.length > 0) {
        return { status: 'rejected', removedRoutes: [] }
      }
      return openOverlay({ kind: 'logout-confirmation' })
    },
    requestExitEditing: (options) => {
      if (overlay) return { status: 'rejected', removedRoutes: [] }
      if (options?.dirty) {
        overlay = { kind: 'discard-unsaved' }
        pendingTransition = {
          kind: 'exit-editing',
          ...(options.cancelFocus
            ? { cancelFocus: options.cancelFocus }
            : {}),
        }
        publish()
        return { status: 'blocked', removedRoutes: [] }
      }
      const removedRoutes = routes
      routes = []
      publish()
      return {
        status: 'changed',
        removedRoutes,
        completedAction: 'exit-editing',
      }
    },
    back: (options) => {
      if (overlay) {
        const focusTarget = pendingTransition?.cancelFocus
        overlay = null
        pendingTransition = null
        publish()
        return {
          status: 'changed',
          removedRoutes: [],
          ...(focusTarget ? { focusTarget } : {}),
        }
      }
      if (options?.dirty) {
        overlay = { kind: 'discard-unsaved' }
        pendingTransition = {
          kind: 'back',
          ...(options.cancelFocus
            ? { cancelFocus: options.cancelFocus }
            : {}),
        }
        publish()
        return { status: 'blocked', removedRoutes: [] }
      }
      return popCurrentRoute()
    },
    closeAll: (options) => {
      if (options?.dirty) {
        overlay = { kind: 'discard-unsaved' }
        pendingTransition = {
          kind: 'close-all',
          ...(options.cancelFocus
            ? { cancelFocus: options.cancelFocus }
            : {}),
        }
        publish()
        return { status: 'blocked', removedRoutes: [] }
      }
      return closeAllRoutes()
    },
    cancelOverlay: () => {
      if (!overlay && !pendingTransition) {
        return { status: 'unchanged', removedRoutes: [] }
      }
      const focusTarget = pendingTransition?.cancelFocus
      overlay = null
      pendingTransition = null
      publish()
      return {
        status: 'changed',
        removedRoutes: [],
        ...(focusTarget ? { focusTarget } : {}),
      }
    },
    confirmPending: () => {
      const pending = pendingTransition
      overlay = null
      pendingTransition = null
      if (!pending) {
        publish()
        return { status: 'unchanged', removedRoutes: [] }
      }
      if (pending.kind === 'exit-editing') {
        const removedRoutes = routes
        routes = []
        publish()
        return {
          status: 'changed',
          removedRoutes,
          completedAction: 'exit-editing',
        }
      }
      if (pending.kind === 'invalidate') {
        const routeIndex = routes.findIndex(
          (route) => route.instanceId === pending.instanceId,
        )
        if (routeIndex < 0) {
          publish()
          return { status: 'unchanged', removedRoutes: [] }
        }
        const removedRoutes = routes.slice(routeIndex)
        routes = routes.slice(0, routeIndex)
        publish()
        return { status: 'changed', removedRoutes }
      }
      if (pending.kind === 'close-all') {
        return closeAllRoutes()
      }
      return popCurrentRoute()
    },
    completeCurrent: () => {
      if (overlay) return { status: 'rejected', removedRoutes: [] }
      return popCurrentRoute()
    },
    invalidate: (instanceId, options) => {
      const routeIndex = routes.findIndex(
        (route) => route.instanceId === instanceId,
      )
      if (routeIndex < 0) {
        return { status: 'unchanged', removedRoutes: [] }
      }
      if (options?.dirty) {
        overlay = { kind: 'discard-unsaved' }
        pendingTransition = {
          kind: 'invalidate',
          instanceId,
          ...(options.cancelFocus
            ? { cancelFocus: options.cancelFocus }
            : {}),
        }
        publish()
        return { status: 'blocked', removedRoutes: [] }
      }
      const removedRoutes = routes.slice(routeIndex)
      routes = routes.slice(0, routeIndex)
      publish()
      return { status: 'changed', removedRoutes }
    },
    hasInstance: (instanceId) =>
      routes.some((route) => route.instanceId === instanceId),
  }
}
