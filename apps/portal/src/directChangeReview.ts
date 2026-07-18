export type DirectChangeReviewSummary = {
  timetable: number
  task: number
  note: number
  total: number
}

export function buildDirectChangeReviewSummary({
  timetableDraftCount,
  taskDraftCount,
  noteDraftCount,
}: {
  timetableDraftCount: number
  taskDraftCount: number
  noteDraftCount: number
}): DirectChangeReviewSummary {
  return {
    timetable: timetableDraftCount,
    task: taskDraftCount,
    note: noteDraftCount,
    total: timetableDraftCount + taskDraftCount + noteDraftCount,
  }
}
