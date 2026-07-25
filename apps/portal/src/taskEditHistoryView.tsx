import type {
  TaskEditHistoryEntry,
  TaskEditHistoryResponse,
  TaskHistorySnapshot,
} from '../shared/taskEditHistory'
import {
  formatDueDate,
  targetScopeLabel,
  type TargetScopeDisplayContext,
} from './uiCopy'
import { ReadOnlyDialog } from './dialogFoundation'

export type TaskEditHistoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | TaskEditHistoryResponse

export function TaskEditHistoryDialog({
  taskTitle,
  targetScopeContext,
  referenceSchoolDate,
  state,
  active,
  onBack,
  onClose,
  onRetry,
}: {
  taskTitle: string
  targetScopeContext?: TargetScopeDisplayContext
  referenceSchoolDate?: string
  state: TaskEditHistoryState
  active: boolean
  onBack: () => void
  onClose: () => void
  onRetry: () => void
}) {
  return (
    <ReadOnlyDialog
      active={active}
      title="タスクの編集履歴"
      subtitle={taskTitle}
      size="standard"
      bodyLayout="compact"
      backLabel="タスクの詳細に戻る"
      onBack={onBack}
      onClose={onClose}
    >
      {state.status === 'loading' ? (
          <p className="layer-dialog-status" aria-live="polite">
            編集履歴を読み込んでいます…
          </p>
        ) : state.status === 'error' ? (
          <div className="layer-dialog-status" role="alert">
            <p>編集履歴を読み込めませんでした。</p>
            <button className="button-secondary" type="button" onClick={onRetry}>
              再読み込み
            </button>
          </div>
        ) : (
          <>
            <p className="task-history-scope">
              変更適用範囲: {targetScopeLabel(
                state.targetScope.type,
                targetScopeContext,
              )}
            </p>
            <ol className="task-history-list" aria-label="タスクの編集履歴">
              {state.entries.map((entry) => (
                <li key={entry.sharedInformationChangeId}>
                  <article className="task-history-entry">
                    <header>
                      <span className={`history-kind history-kind-${entry.changeKind}`}>
                        {changeKindLabel(entry.changeKind)}
                      </span>
                      {entry.sourceType === 'direct' ? (
                        <span className="task-history-actor">
                          <small>強制変更・変更者</small>
                          <strong>{entry.primaryActorDisplayName}</strong>
                        </span>
                      ) : (
                        <span className="task-history-actor">
                          <small>提案による変更</small>
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
                        referenceSchoolDate={referenceSchoolDate}
                        emptyLabel="なし"
                      />
                      <span className="transition-arrow" aria-hidden="true">→</span>
                      <TaskSnapshotPanel
                        label={entry.changeKind === 'add' ? '追加後' :
                          entry.changeKind === 'remove' ? '削除後' : '変更後'}
                        snapshot={entry.after}
                        referenceSchoolDate={referenceSchoolDate}
                        emptyLabel={entry.changeKind === 'remove' ? '削除' : 'なし'}
                      />
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </>
      )}
    </ReadOnlyDialog>
  )
}

function TaskSnapshotPanel({
  label,
  snapshot,
  emptyLabel,
  referenceSchoolDate,
}: {
  label: string
  snapshot: TaskHistorySnapshot | null
  emptyLabel: string
  referenceSchoolDate?: string
}) {
  return (
    <section className="task-history-snapshot">
      <h3>{label}</h3>
      {snapshot ? (
        <dl>
          <div><dt>タイトル</dt><dd>{snapshot.title}</dd></div>
          <div><dt>期限</dt><dd>{snapshot.dueDate ? formatDueDate(snapshot.dueDate, referenceSchoolDate) : '期限なし'}</dd></div>
          <div>
            <dt>関連する授業</dt>
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
