import { createContext } from 'react'

const outsideActionMenuPointers = new WeakSet<PointerEvent>()

export function markOutsideActionMenuPointer(event: PointerEvent) {
  outsideActionMenuPointers.add(event)
}

export function startedOutsideActionMenu(event: PointerEvent) {
  return outsideActionMenuPointers.has(event)
}

export type ActionMenuRegistration = {
  root(): HTMLElement | null
  trigger(): HTMLButtonElement | null
}

export type ActionMenuContextValue = {
  activeMenuId: string | null
  close(menuId: string): void
  register(menuId: string, registration: ActionMenuRegistration): () => void
  toggle(menuId: string): void
}

export const ActionMenuContext = createContext<ActionMenuContextValue | null>(
  null,
)
