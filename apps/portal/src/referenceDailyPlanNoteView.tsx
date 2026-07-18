import type { ReferenceDailyPlanContent } from '../shared/referenceDailyPlan'
import { DailyLessonNoteList } from './dailyLessonNoteView'
import { NoteCard } from './noteCard'
import { TaskNoteList } from './taskNoteView'
import { formatTaskDueLabel } from './uiCopy'

export function ReferenceDailyPlanNotes({
  schoolDate,
  targetScopeLabel,
  basePeriods,
  periods,
  tasks,
  notes,
}: ReferenceDailyPlanContent & {
  targetScopeLabel: string
  basePeriods: Array<{ periodNumber: number; lessonName: string }>
}) {
  return (
    <div className="reference-daily-plan-notes" aria-label="参照中のノート">
      <section className="panel timetable-panel" aria-label="時間割">
        <div className="period-list">
          {basePeriods.map((basePeriod) => {
            const period = periods.find(
              (candidate) => candidate.periodNumber === basePeriod.periodNumber,
            )
            return (
              <article
                className="period-row"
                key={basePeriod.periodNumber}
                aria-label={`${basePeriod.periodNumber}限 ${basePeriod.lessonName || '空欄'}`}
              >
                <div className="period-inspect-button reference-period-heading">
                  <span className="period-number">
                    {basePeriod.periodNumber}
                  </span>
                  <span className="period-main">
                    <span className="lesson-line">
                      <span className="lesson-name">
                        {basePeriod.lessonName}
                      </span>
                      {basePeriod.lessonName && tasks.some(
                        (task) =>
                          task.relatedLessonName === basePeriod.lessonName,
                      ) ? <span className="task-pill">タスク</span> : null}
                    </span>
                  </span>
                </div>
                <DailyLessonNoteList
                  notes={(period?.notes ?? []).map((note) => ({
                    noteId: note.noteId,
                    body: note.body,
                    targetScopeLabel,
                    related: true,
                  }))}
                />
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel daily-section" aria-labelledby="reference-tasks-title">
        <div className="daily-section-heading">
          <h2 id="reference-tasks-title">タスク</h2>
        </div>
        <div className="task-list">
          {tasks.length > 0
            ? tasks.map((task) => (
                <article className="task-entry" key={task.taskId}>
                  <div className="task-item reference-task-item">
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {formatTaskDueLabel(task.dueDate, schoolDate)}
                        {task.relatedLessonName
                          ? ` · ${task.relatedLessonName}`
                          : ''}
                      </small>
                      <span className="task-scope-badge">
                        {targetScopeLabel}
                      </span>
                    </span>
                  </div>
                  <TaskNoteList
                    notes={task.notes.map((note) => ({
                      noteId: note.noteId,
                      body: note.body,
                      related: true,
                    }))}
                  />
                </article>
              ))
            : <p className="empty-state">タスクはありません。</p>}
        </div>
      </section>

      <section className="panel daily-section" aria-labelledby="reference-notes-title">
        <div className="daily-section-heading">
          <h2 id="reference-notes-title">ノート</h2>
        </div>
        <div className="note-list">
          {notes.length > 0
            ? notes.map((note) => (
                <NoteCard
                  key={note.noteId}
                  noteId={note.noteId}
                  body={note.body}
                  targetScopeLabel={targetScopeLabel}
                />
              ))
            : <p className="empty-state">ノートはありません。</p>}
        </div>
      </section>
    </div>
  )
}
