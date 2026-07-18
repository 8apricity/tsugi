type ReferenceScopeEditingSessionOptions = {
  isEditing(): boolean
  pauseEditing(): unknown
  resumeEditing(): unknown
}

export function createReferenceScopeEditingSession({
  isEditing,
  pauseEditing,
  resumeEditing,
}: ReferenceScopeEditingSessionOptions) {
  let referenceScopeOpen = false
  let resumeEditingOnReturn = false

  return {
    enterReferenceScope() {
      if (referenceScopeOpen) return

      referenceScopeOpen = true
      resumeEditingOnReturn = isEditing()
      if (resumeEditingOnReturn) pauseEditing()
      resumeEditingOnReturn &&= !isEditing()
    },
    leaveReferenceScope() {
      if (!referenceScopeOpen) return

      referenceScopeOpen = false
      const shouldResumeEditing = resumeEditingOnReturn
      resumeEditingOnReturn = false
      if (!shouldResumeEditing || isEditing()) return

      resumeEditing()
    },
    reset() {
      referenceScopeOpen = false
      resumeEditingOnReturn = false
    },
  }
}
