import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ActionMenuContext,
  markOutsideActionMenuPointer,
  type ActionMenuContextValue,
  type ActionMenuRegistration,
} from './actionMenuContext'

const POINTER_MOVE_THRESHOLD_PX = 6
const COMPATIBILITY_CLICK_TIMEOUT_MS = 1_000

type PendingPointer = {
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  target: Node
  trigger: HTMLButtonElement | null
}

export function ActionMenuProvider({ children }: { children: ReactNode }) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const activeMenuIdRef = useRef<string | null>(null)
  const registrationsRef = useRef(new Map<string, ActionMenuRegistration>())
  const pendingPointerRef = useRef<PendingPointer | null>(null)
  const clickToSuppressRef = useRef<{
    target: Node
    trigger: HTMLButtonElement | null
    timeoutId: number
  } | null>(null)

  const setActiveMenu = useCallback((menuId: string | null) => {
    activeMenuIdRef.current = menuId
    setActiveMenuId(menuId)
  }, [])

  const closeActiveMenu = useCallback(() => {
    setActiveMenu(null)
  }, [setActiveMenu])

  const close = useCallback((menuId: string) => {
    if (activeMenuIdRef.current === menuId) closeActiveMenu()
  }, [closeActiveMenu])

  const toggle = useCallback((menuId: string) => {
    setActiveMenu(activeMenuIdRef.current === menuId ? null : menuId)
  }, [setActiveMenu])

  const register = useCallback((
    menuId: string,
    registration: ActionMenuRegistration,
  ) => {
    registrationsRef.current.set(menuId, registration)
    return () => {
      registrationsRef.current.delete(menuId)
      if (activeMenuIdRef.current === menuId) closeActiveMenu()
    }
  }, [closeActiveMenu])

  useEffect(() => {
    function activeRegistration() {
      const menuId = activeMenuIdRef.current
      return menuId ? registrationsRef.current.get(menuId) : undefined
    }

    function clearSuppressedClick() {
      const pending = clickToSuppressRef.current
      if (!pending) return
      window.clearTimeout(pending.timeoutId)
      clickToSuppressRef.current = null
    }

    function closeWhenPointerStartsOutside(event: PointerEvent) {
      if (
        event.isPrimary &&
        (event.pointerType !== 'mouse' || event.button === 0)
      ) {
        clearSuppressedClick()
      }

      const registration = activeRegistration()
      const target = event.target
      if (!registration || !(target instanceof Node)) return
      if (registration.root()?.contains(target)) return

      closeActiveMenu()
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
        return
      }

      markOutsideActionMenuPointer(event)
      pendingPointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        target,
        trigger: registration.trigger(),
      }
    }

    function observePointerMove(event: PointerEvent) {
      const pending = pendingPointerRef.current
      if (!pending || pending.pointerId !== event.pointerId) return
      if (
        Math.hypot(
          event.clientX - pending.startX,
          event.clientY - pending.startY,
        ) >= POINTER_MOVE_THRESHOLD_PX
      ) {
        pending.moved = true
      }
    }

    function finishOutsidePointer(event: PointerEvent) {
      const pending = pendingPointerRef.current
      if (!pending || pending.pointerId !== event.pointerId) return
      pendingPointerRef.current = null
      if (event.type === 'pointercancel' || pending.moved) return

      const timeoutId = window.setTimeout(() => {
        if (clickToSuppressRef.current?.timeoutId === timeoutId) {
          clickToSuppressRef.current = null
        }
      }, COMPATIBILITY_CLICK_TIMEOUT_MS)
      clickToSuppressRef.current = {
        target: pending.target,
        trigger: pending.trigger,
        timeoutId,
      }
    }

    function suppressOutsideClick(event: MouseEvent) {
      const pending = clickToSuppressRef.current
      if (!pending) return
      const target = event.target
      if (
        !(target instanceof Node) ||
        !(pending.target.contains(target) || target.contains(pending.target))
      ) {
        return
      }
      clearSuppressedClick()
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      pending.trigger?.focus({ preventScroll: true })
    }

    function closeWhenFocusLeaves(event: FocusEvent) {
      const registration = activeRegistration()
      const target = event.target
      if (!registration || !(target instanceof Node)) return
      if (!registration.root()?.contains(target)) closeActiveMenu()
    }

    function handleActionMenuKeyDown(event: KeyboardEvent) {
      const registration = activeRegistration()
      if (!registration) return
      if (event.key === 'Tab') {
        const menuId = activeMenuIdRef.current
        window.setTimeout(() => {
          if (!menuId || activeMenuIdRef.current !== menuId) return
          const focused = document.activeElement
          const root = registration.root()
          if (
            focused === registration.trigger() ||
            !(focused instanceof Node) ||
            !root?.contains(focused)
          ) {
            closeActiveMenu()
          }
        }, 0)
        return
      }
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeActiveMenu()
      registration.trigger()?.focus({ preventScroll: true })
    }

    function closeWhenWheelStartsOutside(event: WheelEvent) {
      const registration = activeRegistration()
      const target = event.target
      if (!registration || !(target instanceof Node)) return
      if (!registration.root()?.contains(target)) closeActiveMenu()
    }

    document.addEventListener('pointerdown', closeWhenPointerStartsOutside, true)
    document.addEventListener('pointermove', observePointerMove, true)
    document.addEventListener('pointerup', finishOutsidePointer, true)
    document.addEventListener('pointercancel', finishOutsidePointer, true)
    document.addEventListener('click', suppressOutsideClick, true)
    document.addEventListener('focusin', closeWhenFocusLeaves, true)
    document.addEventListener('keydown', handleActionMenuKeyDown, true)
    document.addEventListener('wheel', closeWhenWheelStartsOutside, true)
    return () => {
      document.removeEventListener('pointerdown', closeWhenPointerStartsOutside, true)
      document.removeEventListener('pointermove', observePointerMove, true)
      document.removeEventListener('pointerup', finishOutsidePointer, true)
      document.removeEventListener('pointercancel', finishOutsidePointer, true)
      document.removeEventListener('click', suppressOutsideClick, true)
      document.removeEventListener('focusin', closeWhenFocusLeaves, true)
      document.removeEventListener('keydown', handleActionMenuKeyDown, true)
      document.removeEventListener('wheel', closeWhenWheelStartsOutside, true)
      clearSuppressedClick()
    }
  }, [closeActiveMenu])

  const value = useMemo<ActionMenuContextValue>(() => ({
    activeMenuId,
    close,
    register,
    toggle,
  }), [activeMenuId, close, register, toggle])

  return (
    <ActionMenuContext.Provider value={value}>
      {children}
    </ActionMenuContext.Provider>
  )
}
