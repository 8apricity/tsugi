import type { DailyPlanForCache } from './dailyPlanCache'
import { formatTaskDueLabel } from './uiCopy'

export function DailyPlanSwipePreview({
  plan,
}: {
  plan: DailyPlanForCache | null
}) {
  if (!plan) {
    return (
      <div className="panel state-panel">
        この日の予定を読み込んでいます…
      </div>
    )
  }

  return (
    <>
      <section className="panel timetable-panel">
        <div className="period-list">
          {plan.periods.map((period) => (
            <article className="period-row" key={period.periodNumber}>
              <span className="period-number">{period.periodNumber}</span>
              <div className="period-content">
                <span className="period-main">
                  <span className="lesson-line">
                    <span className="lesson-name">{period.lessonName}</span>
                    {period.hasTasks ? (
                      <span className="task-pill">タスク</span>
                    ) : null}
                  </span>
                </span>
                {period.notes.map((note) => (
                  <div className="note-related" key={note.noteId}>
                    <p>{note.body}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel daily-section">
        <div className="daily-section-heading">
          <h2>タスク</h2>
        </div>
        <div className="task-list">
          {plan.tasks.map((task) => (
            <article className="task-entry" key={task.taskId}>
              <div className="task-item">
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {formatTaskDueLabel(task.dueDate, plan.schoolDate)}
                    {task.relatedLessonName
                      ? ` · ${task.relatedLessonName}`
                      : ''}
                  </small>
                </span>
              </div>
            </article>
          ))}
          {plan.tasks.length === 0 ? (
            <p className="empty-state">タスクはありません。</p>
          ) : null}
        </div>
      </section>

      <section className="panel daily-section">
        <div className="daily-section-heading">
          <h2>ノート</h2>
        </div>
        <div className="note-list">
          {plan.notes.map((note) => (
            <article className="note-card" key={note.noteId}>
              <p>{note.body}</p>
            </article>
          ))}
          {plan.notes.length === 0 ? (
            <p className="empty-state">ノートはありません。</p>
          ) : null}
        </div>
      </section>
    </>
  )
}
