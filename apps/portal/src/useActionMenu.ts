import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react'
import { ActionMenuContext } from './actionMenuContext'

export function useActionMenu(): {
  close(): void
  open: boolean
  rootRef: RefObject<HTMLDivElement | null>
  toggle(): void
  triggerRef: RefObject<HTMLButtonElement | null>
} {
  const context = useContext(ActionMenuContext)
  if (!context) {
    throw new Error('useActionMenu must be used inside ActionMenuProvider')
  }

  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { register } = context

  useLayoutEffect(() => register(menuId, {
    root: () => rootRef.current,
    trigger: () => triggerRef.current,
  }), [menuId, register])

  return {
    close: () => context.close(menuId),
    open: context.activeMenuId === menuId,
    rootRef,
    toggle: () => context.toggle(menuId),
    triggerRef,
  }
}
