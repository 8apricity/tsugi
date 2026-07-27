import type {
  NoteHistorySnapshot,
} from '../shared/noteEditHistory'
import type {
  TaskHistorySnapshot,
} from '../shared/taskEditHistory'
import type {
  TimetableHistorySnapshot,
} from '../shared/editHistory'
import { formatDueDate } from './uiCopy'

type ChangeKind = 'add' | 'update' | 'remove'

export type SharedInformationComparison =
  | {
      kind: 'timetable_change'
      changeKind: ChangeKind
      before: TimetableHistorySnapshot | null
      after: TimetableHistorySnapshot | null
    }
  | {
      kind: 'task'
      changeKind: ChangeKind
      before: TaskHistorySnapshot | null
      after: TaskHistorySnapshot | null
    }
  | {
      kind: 'note'
      changeKind: ChangeKind
      before: NoteHistorySnapshot | null
      after: NoteHistorySnapshot | null
      removalReason?: 'student' | 'task_cascade'
    }

export function SharedInformationDifference({
  comparison,
  mode,
}: {
  comparison: SharedInformationComparison
  mode: 'summary' | 'complete'
}) {
  switch (comparison.kind) {
    case 'timetable_change':
      return <TimetableDifference comparison={comparison} />
    case 'task':
      return <TaskDifference comparison={comparison} mode={mode} />
    case 'note':
      return <NoteDifference comparison={comparison} mode={mode} />
  }
}

function TimetableDifference({
  comparison,
}: {
  comparison: Extract<
    SharedInformationComparison,
    { kind: 'timetable_change' }
  >
}) {
  return (
    <div className="stored-transition-detail shared-difference-timetable">
      {comparison.before ? (
        <TimetableValue
          label={comparison.changeKind === 'remove' ? '削除前' : '変更前'}
          value={comparison.before}
        />
      ) : null}
      {comparison.before && comparison.after ? (
        <span className="transition-arrow" aria-hidden="true">→</span>
      ) : null}
      {comparison.after ? (
        <TimetableValue
          label={comparison.changeKind === 'add' ? '追加後' : '変更後'}
          value={comparison.after}
        />
      ) : null}
    </div>
  )
}

function TimetableValue({
  label,
  value,
}: {
  label: string
  value: TimetableHistorySnapshot
}) {
  const storedReference = value.type === 'period_reference' ||
    value.type === 'floating_lesson_reference'
  return (
    <section>
      <span>{label}</span>
      <strong>{timetableValueLabel(value)}</strong>
      {storedReference ? <small>保存時の時間割参照</small> : null}
    </section>
  )
}

function timetableValueLabel(value: TimetableHistorySnapshot) {
  if (value.type === 'lesson_name') return value.lessonName
  if (value.type === 'period_reference') {
    return `${'月火水木金土'[value.weekday - 1] ?? '?'}${value.periodNumber}`
  }
  if (value.type === 'floating_lesson_reference') {
    return value.referenceLabel
  }
  return '休講'
}

type TaskField = {
  key: keyof TaskHistorySnapshot
  label: string
  before: string
  after: string
  changed: boolean
  textDifference: boolean
}

function TaskDifference({
  comparison,
  mode,
}: {
  comparison: Extract<SharedInformationComparison, { kind: 'task' }>
  mode: 'summary' | 'complete'
}) {
  const fields = taskFields(comparison.before, comparison.after)
  const visibleFields = mode === 'summary'
    ? fields.filter((field) => field.changed)
    : fields
  return (
    <div className={`task-difference task-difference-${mode}`}>
      {visibleFields.map((field) => (
        <TaskFieldDifference
          key={field.key}
          field={field}
          changeKind={comparison.changeKind}
        />
      ))}
    </div>
  )
}

function taskFields(
  before: TaskHistorySnapshot | null,
  after: TaskHistorySnapshot | null,
): TaskField[] {
  return [
    {
      key: 'title',
      label: 'タイトル',
      before: before?.title ?? '',
      after: after?.title ?? '',
      changed: before?.title !== after?.title,
      textDifference: true,
    },
    {
      key: 'dueDate',
      label: '期限',
      before: before?.dueDate ? formatDueDate(before.dueDate) : '期限なし',
      after: after?.dueDate ? formatDueDate(after.dueDate) : '期限なし',
      changed: before?.dueDate !== after?.dueDate,
      textDifference: false,
    },
    {
      key: 'relatedLessonName',
      label: '関連する授業',
      before: before?.relatedLessonName ?? 'なし',
      after: after?.relatedLessonName ?? 'なし',
      changed: before?.relatedLessonName !== after?.relatedLessonName,
      textDifference: false,
    },
  ]
}

function TaskFieldDifference({
  field,
  changeKind,
}: {
  field: TaskField
  changeKind: ChangeKind
}) {
  const beforeExists = changeKind !== 'add'
  const afterExists = changeKind !== 'remove'
  return (
    <section className={`task-difference-field${
      field.changed ? '' : ' task-difference-field-unchanged'
    }`}>
      <header>
        <h3>{field.label}</h3>
        {!field.changed ? <span>変更なし</span> : null}
      </header>
      {!field.changed ? (
        <p>{field.after}</p>
      ) : (
        <div className="task-difference-values">
          {beforeExists ? (
            <DifferenceValue
              kind="remove"
              label="変更前"
              value={field.before}
              otherValue={field.after}
              highlightText={field.textDifference && afterExists}
            />
          ) : null}
          {afterExists ? (
            <DifferenceValue
              kind="add"
              label="変更後"
              value={field.after}
              otherValue={field.before}
              highlightText={field.textDifference && beforeExists}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}

function DifferenceValue({
  kind,
  label,
  value,
  otherValue,
  highlightText,
}: {
  kind: 'add' | 'remove'
  label: string
  value: string
  otherValue: string
  highlightText: boolean
}) {
  return (
    <div className={`difference-value difference-value-${kind}`}>
      <span className="difference-value-label">{label}</span>
      <p>
        <span className="difference-prefix" aria-hidden="true">
          {kind === 'remove' ? '−' : '+'}
        </span>
        {highlightText
          ? renderTextDifference(value, otherValue, kind)
          : value}
      </p>
    </div>
  )
}

type DiffOperation<T> = {
  type: 'equal' | 'add' | 'remove'
  value: T
}

type TextSegment = {
  type: DiffOperation<string>['type']
  text: string
}

function renderTextDifference(
  value: string,
  otherValue: string,
  side: 'add' | 'remove',
) {
  const operations = side === 'remove'
    ? sequenceDifference(Array.from(value), Array.from(otherValue))
    : sequenceDifference(Array.from(otherValue), Array.from(value))
  const segments = combineTextOperations(operations)
    .filter((segment) => segment.type === 'equal' || segment.type === side)
  return segments.map((segment, index) =>
    segment.type === 'equal' ? (
      <span key={index}>{segment.text}</span>
    ) : (
      <mark
        className={side === 'remove' ? 'diff-text-removed' : 'diff-text-added'}
        key={index}
      >
        {segment.text}
      </mark>
    )
  )
}

function combineTextOperations(operations: DiffOperation<string>[]) {
  const result: TextSegment[] = []
  for (const operation of operations) {
    const previous = result.at(-1)
    if (previous?.type === operation.type) {
      previous.text += operation.value
    } else {
      result.push({ type: operation.type, text: operation.value })
    }
  }
  return result
}

type NoteDiffLine = {
  kind: 'equal' | 'add' | 'remove'
  text: string
  otherText?: string
}

function NoteDifference({
  comparison,
  mode,
}: {
  comparison: Extract<SharedInformationComparison, { kind: 'note' }>
  mode: 'summary' | 'complete'
}) {
  const lines = noteDifferenceLines(
    comparison.before?.body ?? null,
    comparison.after?.body ?? null,
  )
  const candidateLines = mode === 'summary'
    ? lines.filter((line) => line.kind !== 'equal')
    : lines
  const visibleLines = mode === 'summary'
    ? candidateLines.slice(0, 6)
    : candidateLines
  const omittedCount = candidateLines.length - visibleLines.length
  return (
    <div className={`note-difference note-difference-${mode}`}>
      {comparison.removalReason === 'task_cascade' ? (
        <p className="note-removal-reason">
          {mode === 'summary'
            ? '関連タスクの削除に伴う削除'
            : '関連するタスクが削除されたため、このノートも削除されました。'}
        </p>
      ) : null}
      <div className="note-difference-lines">
        {visibleLines.map((line, index) => (
          <NoteDifferenceLine key={`${line.kind}-${index}`} line={line} />
        ))}
      </div>
      {mode === 'summary' ? (
        <div className="note-difference-more">
          {omittedCount > 0 ? <span>ほか{omittedCount}行の変更</span> : null}
          <span>変更の詳細を見る</span>
        </div>
      ) : null}
    </div>
  )
}

function NoteDifferenceLine({ line }: { line: NoteDiffLine }) {
  const label = line.kind === 'remove'
    ? '削除された行'
    : line.kind === 'add'
      ? '追加された行'
      : undefined
  return (
    <div className={`note-diff-line note-diff-line-${line.kind}`}>
      {label ? (
        <span className="visually-hidden">{label}: </span>
      ) : null}
      <span className="note-diff-prefix" aria-hidden="true">
        {line.kind === 'remove' ? '−' : line.kind === 'add' ? '+' : ' '}
      </span>
      <span className="note-diff-content">
        {line.kind === 'equal' || line.otherText === undefined
          ? line.text || '\u00a0'
          : renderTextDifference(
              line.text,
              line.otherText,
              line.kind,
            )}
      </span>
    </div>
  )
}

function noteDifferenceLines(
  before: string | null,
  after: string | null,
): NoteDiffLine[] {
  const operations = sequenceDifference(
    before === null ? [] : before.split('\n'),
    after === null ? [] : after.split('\n'),
  )
  const result: NoteDiffLine[] = []
  let removed: string[] = []
  let added: string[] = []

  function flushChangedLines() {
    const lineCount = Math.max(removed.length, added.length)
    for (let index = 0; index < lineCount; index += 1) {
      const removedText = removed[index]
      const addedText = added[index]
      if (removedText !== undefined) {
        result.push({
          kind: 'remove',
          text: removedText,
          ...(addedText !== undefined ? { otherText: addedText } : {}),
        })
      }
      if (addedText !== undefined) {
        result.push({
          kind: 'add',
          text: addedText,
          ...(removedText !== undefined ? { otherText: removedText } : {}),
        })
      }
    }
    removed = []
    added = []
  }

  for (const operation of operations) {
    if (operation.type === 'equal') {
      flushChangedLines()
      result.push({ kind: 'equal', text: operation.value })
    } else if (operation.type === 'remove') {
      removed.push(operation.value)
    } else {
      added.push(operation.value)
    }
  }
  flushChangedLines()
  return result
}

function sequenceDifference<T>(
  before: readonly T[],
  after: readonly T[],
): DiffOperation<T>[] {
  const lengths = Array.from(
    { length: before.length + 1 },
    () => new Uint16Array(after.length + 1),
  )
  for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      lengths[beforeIndex][afterIndex] =
        before[beforeIndex] === after[afterIndex]
          ? lengths[beforeIndex + 1][afterIndex + 1] + 1
          : Math.max(
              lengths[beforeIndex + 1][afterIndex],
              lengths[beforeIndex][afterIndex + 1],
            )
    }
  }

  const operations: DiffOperation<T>[] = []
  let beforeIndex = 0
  let afterIndex = 0
  while (beforeIndex < before.length || afterIndex < after.length) {
    if (
      beforeIndex < before.length &&
      afterIndex < after.length &&
      before[beforeIndex] === after[afterIndex]
    ) {
      operations.push({ type: 'equal', value: before[beforeIndex] })
      beforeIndex += 1
      afterIndex += 1
    } else if (
      beforeIndex < before.length &&
      (
        afterIndex >= after.length ||
        lengths[beforeIndex + 1][afterIndex] >=
          lengths[beforeIndex][afterIndex + 1]
      )
    ) {
      operations.push({ type: 'remove', value: before[beforeIndex] })
      beforeIndex += 1
    } else {
      operations.push({ type: 'add', value: after[afterIndex] })
      afterIndex += 1
    }
  }
  return operations
}
