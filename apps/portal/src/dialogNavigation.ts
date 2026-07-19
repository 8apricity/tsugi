import { useEffect, useLayoutEffect, useRef } from 'react'

const DIALOG_HISTORY_KEY = 'tsugiDialogEntry'
let nextDialogEntry = 0

export function useDialogBrowserBack(active: boolean, onBack: () => void) {
  const activeRef = useRef(active)
  const onBackRef = useRef(onBack)

  useLayoutEffect(() => {
    activeRef.current = active
    onBackRef.current = onBack
  }, [active, onBack])

  useEffect(() => {
    if (!active) return

    const entry = `${Date.now()}-${nextDialogEntry += 1}`
    const state = { ...window.history.state, [DIALOG_HISTORY_KEY]: entry }
    window.history.pushState(state, '')

    const handlePopState = () => {
      if (!activeRef.current) return
      window.history.pushState(state, '')
      onBackRef.current()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      activeRef.current = false
      window.removeEventListener('popstate', handlePopState)
      if (window.history.state?.[DIALOG_HISTORY_KEY] === entry) {
        window.history.back()
      }
    }
  }, [active])
}
