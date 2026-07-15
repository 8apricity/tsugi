import type { TargetScopeType } from '../shared/targetScope'
import type {
  TaskEditHistoryEntry,
  TaskEditHistoryResponse,
  TaskHistorySnapshot,
} from '../shared/taskEditHistory'

export type TaskEditHistoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | TaskEditHistoryResponse

export function TaskEditHistoryDialog({
  taskTitle,
  state,
  onClose,
  onRetry,
}: {
  taskTitle: string
  state: TaskEditHistoryState
  onClose: () => void
  onRetry: () => void
}) {
  return (
    <div className="editor-dialog-backdrop" role="presentation">
      <section
        className="timetable-editor-dialog task-history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-history-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <header className="editor-dialog-header">
          <div className="timetable-dialog-heading">
            <h2 id="task-history-title">Task Edit History</h2>
            <p className="layer-dialog-selection">{taskTitle}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="閉じる"
            autoFocus
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {state.status === 'loading' ? (
          <p className="layer-dialog-status" aria-live="polite">
            Task Edit Historyを読み込んでいます。
          </p>
        ) : state.status === 'error' ? (
          <div className="layer-dialog-status" role="alert">
            <p>Task Edit Historyを読み込めませんでした。</p>
            <button className="button-secondary" type="button" onClick={onRetry}>
              再読み込み
            </button>
          </div>
        ) : (
          <>
            <p className="task-history-scope">
              Target Scope: {scopeLabel(state.targetScope.type)}
              （{state.targetScope.value}）
            </p>
            <ol className="task-history-list" aria-label="Task Edit History entries">
              {state.entries.map((entry) => (
                <li key={entry.sharedInformationChangeId}>
                  <article className="task-history-entry">
                    <header>
                      <span className={`history-kind history-kind-${entry.changeKind}`}>
                        {changeKindLabel(entry.changeKind)}
                      </span>
                      {entry.sourceType === 'direct' ? (
                        <span className="task-history-actor">
                          <small>Direct Change・Display Name</small>
                          <strong>{entry.primaryActorDisplayName}</strong>
                        </span>
                      ) : (
                        <span className="task-history-actor">
                          <small>Change Proposal</small>
                        </span>
                      )}
                      <time dateTime={new Date(entry.changedAt).toISOString()}>
                        {formatExactTimestamp(entry.changedAt)}
                      </time>
                    </header>
                    <div className="task-history-transition">
                      <TaskSnapshotPanel
                        label={entry.changeKind === 'add' ? '追加前' :
                          entry.changeKind === 'remove' ? '削除前' : '変更前'}
                        snapshot={entry.before}
                        emptyLabel="値なし"
                      />
                      <span className="transition-arrow" aria-hidden="true">→</span>
                      <TaskSnapshotPanel
                        label={entry.changeKind === 'add' ? '追加後' :
                          entry.changeKind === 'remove' ? '削除後' : '変更後'}
                        snapshot={entry.after}
                        emptyLabel={entry.changeKind === 'remove' ? '削除' : '値なし'}
                      />
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  )
}

function TaskSnapshotPanel({
  label,
  snapshot,
  emptyLabel,
}: {
  label: string
  snapshot: TaskHistorySnapshot | null
  emptyLabel: string
}) {
  return (
    <section className="task-history-snapshot">
      <h3>{label}</h3>
      {snapshot ? (
        <dl>
          <div><dt>Title</dt><dd>{snapshot.title}</dd></div>
          <div><dt>Due Date</dt><dd>{snapshot.dueDate ?? '期限なし'}</dd></div>
          <div>
            <dt>Related Lesson Name</dt>
            <dd>{snapshot.relatedLessonName ?? 'なし'}</dd>
          </div>
        </dl>
      ) : (
        <p className="task-history-empty-snapshot">{emptyLabel}</p>
      )}
    </section>
  )
}

function changeKindLabel(changeKind: TaskEditHistoryEntry['changeKind']) {
  return { add: '追加', update: '更新', remove: '削除' }[changeKind]
}

function formatExactTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp))
}

function scopeLabel(scopeType: TargetScopeType) {
  return {
    grade: 'Grade',
    class: 'Class',
    track: 'Track',
    student: 'Student',
  }[scopeType]
}
