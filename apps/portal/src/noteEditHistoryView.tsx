import type {
  NoteEditHistoryEntry,
  NoteEditHistoryResponse,
  NoteHistorySnapshot,
} from '../shared/noteEditHistory'
import { targetScopeLabel, type TargetScopeDisplayContext } from './uiCopy'
import { ReadOnlyDialog } from './dialogFoundation'

export type NoteEditHistoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | NoteEditHistoryResponse

export function NoteEditHistoryDialog({
  state,
  targetScopeContext,
  active,
  onBack,
  onClose,
  onRetry,
}: {
  state: NoteEditHistoryState
  targetScopeContext?: TargetScopeDisplayContext
  active: boolean
  onBack: () => void
  onClose: () => void
  onRetry: () => void
}) {
  return (
    <ReadOnlyDialog
      active={active}
      title="ノートの編集履歴"
      size="standard"
      bodyLayout="compact"
      backLabel="ノートの詳細に戻る"
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
            <ol className="task-history-list" aria-label="ノートの編集履歴">
              {state.entries.map((entry) => (
                <li key={entry.sharedInformationChangeId}>
                  <article className="task-history-entry">
                    <header>
                      <span className={`history-kind history-kind-${entry.changeKind}`}>
                        {changeKindLabel(entry.changeKind)}
                      </span>
                      <span className="task-history-actor">
                        <small>強制変更・変更者</small>
                        <strong>{entry.primaryActorDisplayName}</strong>
                      </span>
                      <time dateTime={new Date(entry.changedAt).toISOString()}>
                        {formatExactTimestamp(entry.changedAt)}
                      </time>
                    </header>
                    {entry.removalReason === 'task_cascade' ? (
                      <p className="note-removal-reason">Task削除に伴う削除</p>
                    ) : null}
                    <div className="task-history-transition">
                      <NoteSnapshotPanel
                        label={entry.changeKind === 'add' ? '追加前' :
                          entry.changeKind === 'remove' ? '削除前' : '変更前'}
                        snapshot={entry.before}
                        emptyLabel="なし"
                      />
                      <span className="transition-arrow" aria-hidden="true">→</span>
                      <NoteSnapshotPanel
                        label={entry.changeKind === 'add' ? '追加後' :
                          entry.changeKind === 'remove' ? '削除後' : '変更後'}
                        snapshot={entry.after}
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

function NoteSnapshotPanel({
  label,
  snapshot,
  emptyLabel,
}: {
  label: string
  snapshot: NoteHistorySnapshot | null
  emptyLabel: string
}) {
  return (
    <section className="task-history-snapshot note-history-snapshot">
      <h3>{label}</h3>
      {snapshot ? (
        <p className="note-history-body">{snapshot.body}</p>
      ) : (
        <p className="task-history-empty-snapshot">{emptyLabel}</p>
      )}
    </section>
  )
}

function changeKindLabel(changeKind: NoteEditHistoryEntry['changeKind']) {
  return { add: '追加', update: '更新', remove: '削除' }[changeKind]
}

function formatExactTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp))
}
