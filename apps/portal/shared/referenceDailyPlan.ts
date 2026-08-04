export type ReferenceTargetScopeType = 'grade' | 'class' | 'track'

export type ReferenceScopeOption = {
  type: ReferenceTargetScopeType
  value: string
  label: string
}

export type ReferenceScopeSelection = Pick<
  ReferenceScopeOption,
  'type' | 'value'
>

export type ReferenceScopeOptions = {
  status: 'ready'
  options: ReferenceScopeOption[]
}

export type ReferenceDailyPlanNote = {
  noteId: string
  body: string
  targetScopeType: ReferenceTargetScopeType
  relatedContext:
    | { type: 'daily-lesson'; schoolDate: string; periodNumber: number }
    | { type: 'school-date'; schoolDate: string }
    | { type: 'task'; taskId: string }
    | null
}

export type ReferenceDailyPlanTask = {
  taskId: string
  title: string
  dueDate: string | null
  relatedLessonName?: string
  targetScopeType: ReferenceTargetScopeType
  createdAt: number
  notes: ReferenceDailyPlanNote[]
}

export type ReferenceDailyPlanContent = {
  schoolDate: string
  tasks: ReferenceDailyPlanTask[]
  periods: Array<{
    periodNumber: number
    notes: ReferenceDailyPlanNote[]
  }>
  notes: ReferenceDailyPlanNote[]
}

export type ReferenceDailyPlanReadyResponse = ReferenceDailyPlanContent & {
  status: 'ready'
  referenceScope: ReferenceScopeSelection
}
