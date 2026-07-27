import type {
  NoteEditHistoryEntry,
} from '../shared/noteEditHistory'
import type { TaskEditHistoryResponse } from '../shared/taskEditHistory'
import type { SharedInformationChangeDetail } from '../shared/editHistory'
import type {
  NoteEditHistoryResourceResult,
  TaskEditHistoryResourceResult,
  TimetableChangeHistoryEntry,
  TimetableEditHistoryResourceResult,
} from './editHistoryResource'
import type { AsyncResourceState } from './asyncResource'
import { ReadOnlyDialog } from './dialogFoundation'
import { SharedInformationDifference } from './sharedInformationDifference'
import {
  formatSchoolDate,
  formatRelativeTime,
  targetScopeLabel,
  type TargetScopeDisplayContext,
} from './uiCopy'

type HistoryEntryCommon = {
  sharedInformationChangeId: string
  changeKind: 'add' | 'update' | 'remove'
  sourceType: 'direct' | 'proposal'
  primaryActorDisplayName?: string
  changedAt: number
}

type HistoryDialogProps = {
  active: boolean
  targetScopeContext?: TargetScopeDisplayContext
  onBack: () => void
  onClose: () => void
  onRetry: () => void
  onOpenChange: (sharedInformationChangeId: string) => void
}

export function TaskEditHistoryDialog({
  taskTitle,
  state,
  ...props
}: HistoryDialogProps & {
  taskTitle: string
  state: TaskEditHistoryResourceResult['state']
}) {
  return (
    <EditHistoryDialog
      {...props}
      title="タスクの編集履歴"
      subtitle={taskTitle}
      backLabel="タスクの詳細に戻る"
      ariaLabel="タスクの編集履歴"
      emptyMessage="このタスクには編集履歴がありません。"
      state={state}
      comparison={(entry: TaskEditHistoryResponse['entries'][number]) => ({
        kind: 'task',
        changeKind: entry.changeKind,
        before: entry.before,
        after: entry.after,
      })}
    />
  )
}

export function NoteEditHistoryDialog({
  state,
  ...props
}: HistoryDialogProps & {
  state: NoteEditHistoryResourceResult['state']
}) {
  return (
    <EditHistoryDialog
      {...props}
      title="ノートの編集履歴"
      backLabel="ノートの詳細に戻る"
      ariaLabel="ノートの編集履歴"
      emptyMessage="このノートには編集履歴がありません。"
      state={state}
      comparison={(entry: NoteEditHistoryEntry) => ({
        kind: 'note',
        changeKind: entry.changeKind,
        before: entry.before,
        after: entry.after,
        ...(entry.removalReason
          ? { removalReason: entry.removalReason }
          : {}),
      })}
    />
  )
}

export function TimetableEditHistoryDialog({
  state,
  subtitle,
  ...props
}: HistoryDialogProps & {
  state: TimetableEditHistoryResourceResult['state']
  subtitle: string
}) {
  return (
    <EditHistoryDialog
      {...props}
      title="編集履歴"
      subtitle={subtitle}
      backLabel="変更状況に戻る"
      ariaLabel="編集履歴"
      emptyMessage="この日・時限・変更適用範囲には編集履歴がありません。"
      showScope={false}
      state={state}
      comparison={(entry: TimetableChangeHistoryEntry) => ({
        kind: 'timetable_change',
        changeKind: entry.changeKind,
        before: entry.before,
        after: entry.after,
      })}
    />
  )
}

type HistoryResponse<TEntry> = {
  targetScope: TaskEditHistoryResponse['targetScope']
  entries: TEntry[]
}

function EditHistoryDialog<TEntry extends HistoryEntryCommon>({
  title,
  subtitle,
  backLabel,
  ariaLabel,
  emptyMessage,
  showScope = true,
  state,
  active,
  targetScopeContext,
  onBack,
  onClose,
  onRetry,
  onOpenChange,
  comparison,
}: HistoryDialogProps & {
  title: string
  subtitle?: string
  backLabel: string
  ariaLabel: string
  emptyMessage: string
  showScope?: boolean
  state: AsyncResourceState<HistoryResponse<TEntry>>
  comparison(
    entry: TEntry,
  ): Parameters<typeof SharedInformationDifference>[0]['comparison']
}) {
  return (
    <ReadOnlyDialog
      active={active}
      title={title}
      subtitle={subtitle}
      size="standard"
      bodyLayout="compact"
      backLabel={backLabel}
      onBack={onBack}
      onClose={onClose}
    >
      {state.status === 'idle' || state.status === 'loading' ? (
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
      ) : state.value.entries.length === 0 ? (
        <p className="history-empty-state">{emptyMessage}</p>
      ) : (
        <>
          {showScope ? (
            <p className="shared-history-scope">
              変更適用範囲: {targetScopeLabel(
                state.value.targetScope.type,
                targetScopeContext,
              )}
          </p>
          ) : null}
          <ol className="shared-history-list" aria-label={ariaLabel}>
            {state.value.entries.map((entry) => {
              const sourceLabel = entry.sourceType === 'direct'
                ? `直接反映${
                  entry.primaryActorDisplayName
                    ? `・${entry.primaryActorDisplayName}`
                    : ''
                }`
                : '提案による変更'
              const relativeTime = formatRelativeTime(entry.changedAt)
              return (
              <li
                className="shared-history-card"
                key={entry.sharedInformationChangeId}
              >
                <span className="shared-history-row-heading">
                  <span
                    className={`history-kind history-kind-${entry.changeKind}`}
                  >
                    {changeKindLabel(entry.changeKind)}
                  </span>
                  <span className="shared-history-source">{sourceLabel}</span>
                  <time dateTime={new Date(entry.changedAt).toISOString()}>
                    {relativeTime}
                  </time>
                </span>
                <SharedInformationDifference
                  mode="summary"
                  comparison={comparison(entry)}
                />
                <span className="shared-history-chevron" aria-hidden="true">
                  ›
                </span>
                <button
                  className="shared-history-row"
                  type="button"
                  data-change-id={entry.sharedInformationChangeId}
                  aria-label={`${
                    changeKindLabel(entry.changeKind)
                  }、${sourceLabel}、${relativeTime}、変更の詳細を開く`}
                  onClick={() =>
                    onOpenChange(entry.sharedInformationChangeId)}
                >
                  <span className="visually-hidden">変更の詳細を開く</span>
                </button>
              </li>
              )
            })}
          </ol>
        </>
      )}
    </ReadOnlyDialog>
  )
}

export function SharedInformationChangeDetailDialog({
  state,
  active,
  targetScopeContext,
  onBack,
  onClose,
  onRetry,
}: {
  state: AsyncResourceState<SharedInformationChangeDetail>
  active: boolean
  targetScopeContext?: TargetScopeDisplayContext
  onBack: () => void
  onClose: () => void
  onRetry: () => void
}) {
  return (
    <ReadOnlyDialog
      active={active}
      title="変更の詳細"
      size="standard"
      bodyLayout="compact"
      backLabel="編集履歴に戻る"
      onBack={onBack}
      onClose={onClose}
    >
      {state.status === 'idle' || state.status === 'loading' ? (
        <p className="layer-dialog-status" aria-live="polite">
          変更内容を読み込んでいます…
        </p>
      ) : state.status === 'error' ? (
        <div className="layer-dialog-status" role="alert">
          <p>変更内容を読み込めませんでした。</p>
          <button className="button-secondary" type="button" onClick={onRetry}>
            再読み込み
          </button>
        </div>
      ) : (
        <SharedInformationChangeDetailView
          detail={state.value}
          targetScopeContext={targetScopeContext}
        />
      )}
    </ReadOnlyDialog>
  )
}

function SharedInformationChangeDetailView({
  detail,
  targetScopeContext,
}: {
  detail: SharedInformationChangeDetail
  targetScopeContext?: TargetScopeDisplayContext
}) {
  return (
    <div className="shared-information-change-detail">
      <dl className="history-detail-grid">
        <div>
          <dt>情報の種類</dt>
          <dd>{informationKindLabel(detail.kind)}</dd>
        </div>
        <div>
          <dt>変更内容</dt>
          <dd>{changeKindLabel(detail.changeKind)}</dd>
        </div>
        <div>
          <dt>反映方法</dt>
          <dd>
            {detail.source.type === 'direct'
              ? '直接反映'
              : '提案による変更'}
          </dd>
        </div>
        {detail.source.type === 'direct' ? (
          <div>
            <dt>変更者</dt>
            <dd>{detail.source.primaryActorDisplayName}</dd>
          </div>
        ) : null}
        <div>
          <dt>日時</dt>
          <dd>
            <time dateTime={new Date(detail.changedAt).toISOString()}>
              {formatExactTimestamp(detail.changedAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>変更対象</dt>
          <dd>
            {targetScopeLabel(detail.targetScope.type, targetScopeContext)}
          </dd>
        </div>
        {detail.kind === 'timetable_change' ? (
          <>
            <div>
              <dt>変更対象日</dt>
              <dd>{formatSchoolDate(detail.changeDate)}</dd>
            </div>
            <div>
              <dt>時限</dt>
              <dd>{detail.periodNumber}限</dd>
            </div>
          </>
        ) : null}
      </dl>
      <SharedInformationDifference mode="complete" comparison={detail} />
    </div>
  )
}

function informationKindLabel(kind: SharedInformationChangeDetail['kind']) {
  return {
    timetable_change: '時間割',
    task: 'タスク',
    note: 'ノート',
  }[kind]
}

function changeKindLabel(changeKind: HistoryEntryCommon['changeKind']) {
  return { add: '追加', update: '更新', remove: '削除' }[changeKind]
}

function formatExactTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  }).format(new Date(timestamp))
}
