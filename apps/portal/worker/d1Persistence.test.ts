// @ts-expect-error Node-only D1 test harness; Worker production types exclude Node.
import { readdirSync, readFileSync } from 'node:fs'
// @ts-expect-error Node-only D1 test harness; Worker production types exclude Node.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
// @ts-expect-error Node-only D1 test harness; Worker production types exclude Node.
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  backfillLegacyCustomLessonNameNormalization,
  createD1PersistenceAdapters,
  createInMemoryPersistenceAdapters,
  type DirectChangeOperation,
  type DirectTimetableChangeOperation,
  type PersistenceAdapters,
  type StudentAffiliation,
  type TargetScope,
  type TimetableChangeReplacement,
} from './persistence'

class SqliteD1Statement {
  private readonly database: DatabaseSync
  private readonly sql: string
  private readonly values: SQLInputValue[]

  constructor(
    database: DatabaseSync,
    sql: string,
    values: SQLInputValue[] = [],
  ) {
    this.database = database
    this.sql = sql
    this.values = values
  }

  bind(...values: unknown[]) {
    return new SqliteD1Statement(
      this.database,
      this.sql,
      values as SQLInputValue[],
    )
  }

  async first<T>(columnName?: string) {
    const row = this.database.prepare(this.sql).get(...this.values) as
      | Record<string, unknown>
      | undefined
    if (!row) return null
    return (columnName ? row[columnName] : row) as T
  }

  async all<T>() {
    return {
      results: this.database.prepare(this.sql).all(...this.values) as T[],
      success: true,
      meta: {},
    }
  }

  runSynchronously() {
    return this.database.prepare(this.sql).run(...this.values)
  }

  async run() {
    this.runSynchronously()
    return { results: [], success: true, meta: {} }
  }
}

class SqliteD1Database {
  readonly database: DatabaseSync

  constructor(database: DatabaseSync) {
    this.database = database
  }

  prepare(sql: string) {
    return new SqliteD1Statement(this.database, sql)
  }

  async batch(statements: SqliteD1Statement[]) {
    this.database.exec('begin immediate')
    try {
      const results = statements.map((statement) => {
        statement.runSynchronously()
        return { results: [], success: true, meta: {} }
      })
      this.database.exec('commit')
      return results
    } catch (error) {
      this.database.exec('rollback')
      throw error
    }
  }
}

function createTestDatabase(maximumMigration?: string) {
  const database = new DatabaseSync(':memory:')
  database.exec('pragma foreign_keys = on')
  const migrationsDirectory = fileURLToPath(
    new URL('../db/migrations/', import.meta.url),
  )
  for (const migration of readdirSync(migrationsDirectory).sort()) {
    if (maximumMigration && migration > maximumMigration) break
    database.exec(readFileSync(`${migrationsDirectory}/${migration}`, 'utf8'))
  }
  return database
}

describe('D1 Direct Timetable Change persistence', () => {
  it('migrates Standard Timetable values to the approved Registered Lesson Names', () => {
    const database = createTestDatabase()

    const registeredLessonNames = database.prepare(`
      select short_lesson_name, full_lesson_name
      from registered_lesson_names
    `).all()
    expect(registeredLessonNames).toHaveLength(20)
    expect(registeredLessonNames).toEqual(expect.arrayContaining([
      { short_lesson_name: 'CSⅡ', full_lesson_name: 'Creative SolutionsⅡ' },
      { short_lesson_name: 'DD', full_lesson_name: 'ディベート・ディスカッションⅠ' },
      { short_lesson_name: 'HR', full_lesson_name: 'ホームルーム活動' },
      { short_lesson_name: '三丘SHSP', full_lesson_name: '三丘SHSP' },
      { short_lesson_name: '保健', full_lesson_name: '保健' },
      { short_lesson_name: '古典', full_lesson_name: '古典探究' },
      { short_lesson_name: '地理', full_lesson_name: '地理総合' },
      { short_lesson_name: '家庭', full_lesson_name: '家庭基礎' },
      { short_lesson_name: '数Ⅱα', full_lesson_name: '理数数学Ⅱα' },
      { short_lesson_name: '数Ⅱβ', full_lesson_name: '理数数学Ⅱβ' },
      { short_lesson_name: '歴史α', full_lesson_name: '歴史総合α' },
      { short_lesson_name: '歴史β', full_lesson_name: '歴史総合β' },
      { short_lesson_name: '現代文', full_lesson_name: '現代文探究' },
      { short_lesson_name: '理科', full_lesson_name: '理数理科特講' },
      { short_lesson_name: '生物', full_lesson_name: '理数生物特講Ⅰ' },
      { short_lesson_name: '自走', full_lesson_name: '自走' },
      { short_lesson_name: '英語G', full_lesson_name: '総合英語ⅡG' },
      { short_lesson_name: '英語R', full_lesson_name: '総合英語ⅡR' },
      { short_lesson_name: '化学', full_lesson_name: '理数化学特講Ⅰ' },
      { short_lesson_name: '体育', full_lesson_name: '体育' },
    ]))

    expect(() => database.prepare(`
      insert into registered_lesson_names (
        registered_lesson_name_id, full_lesson_name, short_lesson_name,
        normalized_full_lesson_name
      ) values (
        'duplicate-full', char(12288) || '理数数学Ⅱβ' || char(12288),
        '別名', '理数数学iiβ'
      )
    `).run()).toThrow()
    expect(() => database.prepare(`
      insert into registered_lesson_names (
        registered_lesson_name_id, full_lesson_name, short_lesson_name,
        normalized_full_lesson_name
      ) values ('duplicate-short', '別の体育', '体育', '別の体育')
    `).run()).not.toThrow()

    const physicalEducationIds = database.prepare(`
      select distinct registered_lesson_name_id
      from standard_timetable_entries
      where standard_timetable_entry_id in (
        '2026-grade-2-class-3-common-mon-7',
        '2026-grade-2-class-3-common-wed-2',
        '2026-grade-2-class-3-common-thu-1'
      )
    `).all()
    expect(physicalEducationIds).toEqual([
      { registered_lesson_name_id: 'physical-education' },
    ])

    const standardColumns = database.prepare(
      'pragma table_info(standard_timetable_entries)',
    ).all() as Array<{ name: string }>
    expect(standardColumns.map(({ name }) => name)).toContain(
      'registered_lesson_name_id',
    )
    expect(standardColumns.map(({ name }) => name)).not.toContain('lesson_name')
    expect(() => database.prepare(`
      insert into standard_timetable_entries (
        standard_timetable_entry_id, class_id, track_id, reference_type,
        weekday, period_number, reference_label, registered_lesson_name_id
      ) values (
        'custom-text-is-not-an-identity', '2026-grade-2-class-3', null,
        'period', 7, 1, null, '未登録授業'
      )
    `).run()).toThrow()
  })

  it('reads current Short Lesson Names for Period and Floating Lesson References', async () => {
    const adapters = createD1PersistenceAdapters(
      new SqliteD1Database(createTestDatabase()) as unknown as D1Database,
    )

    await expect(
      adapters.dailyPlan.findStandardTimetableEntryForPeriodReference(
        '2026-grade-2-class-3',
        '2026-grade-2-class-3-humanities',
        1,
        7,
      ),
    ).resolves.toMatchObject({
      registeredLessonNameId: 'physical-education',
      lessonName: '体育',
    })
    await expect(
      adapters.dailyPlan.findStandardTimetableEntryForFloatingReference(
        '2026-grade-2-class-3',
        '2026-grade-2-class-3-humanities',
        '★',
      ),
    ).resolves.toMatchObject({
      registeredLessonNameId: 'self-directed-study',
      lessonName: '自走',
    })
    await expect(
      adapters.dailyPlan.findStandardTimetableEntryForFloatingReference(
        '2026-grade-2-class-3',
        '2026-grade-2-class-3-science',
        '★',
      ),
    ).resolves.toMatchObject({
      registeredLessonNameId: 'biology',
      lessonName: '生物',
    })

    await adapters.seed.saveRegisteredLessonName({
      registeredLessonNameId: 'geography',
      fullLessonName: '地理総合',
      shortLessonName: '地理新名',
      normalizedFullLessonName: '地理総合',
    })
    await adapters.seed.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-common-test',
      classId: '2026-grade-2-class-3',
      trackId: null,
      referenceType: 'floating',
      referenceLabel: '★',
      floatingLessonReferenceLabelId: '2026-grade-2-floating-e29885',
      registeredLessonNameId: 'geography',
    })
    await expect(
      adapters.dailyPlan.findStandardTimetableEntryForFloatingReference(
        '2026-grade-2-class-3',
        'unconfigured-track',
        '★',
      ),
    ).resolves.toMatchObject({
      registeredLessonNameId: 'geography',
      lessonName: '地理新名',
    })
  })

  it('stores Registered identity separately from normalized custom Lesson Name text', () => {
    const database = createTestDatabase()
    const columns = database.prepare(
      'pragma table_info(timetable_change_snapshots)',
    ).all() as Array<{ name: string }>

    expect(columns.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'registered_lesson_name_id',
      'normalized_custom_lesson_name',
    ]))
  })

  it('atomically stores mixed Timetable Change and Task adds with idempotent retries', async () => {
    const database = createTestDatabase()
    const adapters = createD1PersistenceAdapters(
      new SqliteD1Database(database) as unknown as D1Database,
    )
    const affiliation: StudentAffiliation = {
      studentAffiliationId: 'task-affiliation-1',
      studentAccountId: 'task-student-1',
      schoolYear: 2026,
      grade: 2,
      classId: 'task-class-1',
      trackId: 'task-track-1',
      selectedAt: 1,
      endedAt: null,
    }
    await adapters.seed.saveStudentAccount({
      studentAccountId: 'task-student-1',
      schoolEmail: 'task-student@example.invalid',
      displayName: 'Task Student',
    })
    await adapters.seed.saveSchoolYearClass({
      classId: 'task-class-1',
      schoolYear: 2026,
      grade: 2,
      classNumber: 1,
    })
    await adapters.seed.saveTrack({
      trackId: 'task-track-1',
      classId: 'task-class-1',
      trackName: 'Task Track',
    })
    await adapters.seed.saveStudentAffiliation(affiliation)

    const timetable = {
      ...operation({
        sourceId: '33111111-1111-4111-8111-111111111111',
        changeKind: 'add',
        targetScope: {
          type: 'track',
          schoolYear: 2026,
          trackId: 'task-track-1',
        },
        replacement: { type: 'cancelled' },
      }),
      changedByStudentAccountId: 'task-student-1',
      kind: 'timetable_change',
    } satisfies DirectChangeOperation
    const task = {
      kind: 'task',
      changeKind: 'add',
      sourceId: '33222222-2222-4222-8222-222222222222',
      sharedInformationItemId: '33222222-2222-4222-8222-222222222222',
      latestChangeId: '33222222-2222-4222-8222-222222222222:change',
      targetScope: {
        type: 'track',
        schoolYear: 2026,
        trackId: 'task-track-1',
      },
      title: '地理ワークを提出',
      dueDate: '2026-07-10',
      relatedLessonName: {
        registeredLessonNameId: 'geography',
        lessonName: '地理',
      },
      changedByStudentAccountId: 'task-student-1',
      changedAt: Date.parse('2026-07-09T03:00:00.000Z'),
      createdAt: Date.parse('2026-07-09T03:00:00.000Z'),
    } satisfies DirectChangeOperation

    await expect(
      adapters.directTimetableChange.commitDirectChanges([timetable, task]),
    ).resolves.toMatchObject({ status: 'applied' })
    await expect(
      adapters.directTimetableChange.commitDirectChanges([timetable, task]),
    ).resolves.toMatchObject({ status: 'applied' })
    await expect(
      adapters.dailyPlan.listActiveTasksForStudent(affiliation, '2026-07-10'),
    ).resolves.toEqual([
      expect.objectContaining({
        title: '地理ワークを提出',
        dueDate: '2026-07-10',
        relatedLessonName: {
          registeredLessonNameId: 'geography',
          lessonName: '地理',
        },
      }),
    ])
    await expect(
      adapters.dailyPlan.listActiveTasksForTargetScope(
        {
          type: 'track',
          schoolYear: 2026,
          trackId: 'task-track-1',
        },
        '2026-07-10',
      ),
    ).resolves.toEqual([
      expect.objectContaining({ title: '地理ワークを提出' }),
    ])
    expect(database.prepare(
      'select count(*) as count from task_snapshots',
    ).get()).toEqual({ count: 1 })

    const taskUpdate = {
      kind: 'task',
      changeKind: 'update',
      sourceId: '33222222-2222-4222-8222-222222222225',
      sharedInformationItemId: task.sharedInformationItemId,
      latestChangeId: '33222222-2222-4222-8222-222222222225:change',
      expectedLatestChangeId: task.latestChangeId,
      targetScope: task.targetScope,
      title: '更新されたTask',
      dueDate: null,
      relatedLessonName: { lessonName: '特別活動' },
      changedByStudentAccountId: task.changedByStudentAccountId,
      changedAt: Date.parse('2026-07-09T04:00:00.000Z'),
    } satisfies DirectChangeOperation
    await expect(
      adapters.directTimetableChange.commitDirectChanges([taskUpdate]),
    ).resolves.toMatchObject({ status: 'applied' })
    await expect(
      adapters.directTimetableChange.commitDirectChanges([taskUpdate]),
    ).resolves.toMatchObject({ status: 'applied' })
    await expect(
      adapters.dailyPlan.listActiveTasksForStudent(affiliation, '2026-07-11'),
    ).resolves.toEqual([
      expect.objectContaining({
        sharedInformationItemId: task.sharedInformationItemId,
        latestChangeId: taskUpdate.latestChangeId,
        title: '更新されたTask',
        dueDate: null,
      }),
    ])
    expect(database.prepare(
      'select count(*) as count from task_snapshots',
    ).get()).toEqual({ count: 2 })
    expect(database.prepare(
      `select preceding_change_id from shared_information_changes
       where shared_information_change_id = ?`,
    ).get(taskUpdate.latestChangeId)).toEqual({
      preceding_change_id: task.latestChangeId,
    })

    const taskRemove = {
      kind: 'task',
      changeKind: 'remove',
      sourceId: '33222222-2222-4222-8222-222222222226',
      sharedInformationItemId: task.sharedInformationItemId,
      latestChangeId: '33222222-2222-4222-8222-222222222226:change',
      expectedLatestChangeId: taskUpdate.latestChangeId,
      targetScope: task.targetScope,
      changedByStudentAccountId: task.changedByStudentAccountId,
      changedAt: Date.parse('2026-07-09T05:00:00.000Z'),
    } satisfies DirectChangeOperation
    await expect(
      adapters.directTimetableChange.commitDirectChanges([taskRemove]),
    ).resolves.toMatchObject({ status: 'applied' })
    await expect(
      adapters.directTimetableChange.commitDirectChanges([taskRemove]),
    ).resolves.toMatchObject({ status: 'applied' })
    await expect(
      adapters.dailyPlan.listActiveTasksForStudent(affiliation, '2026-07-11'),
    ).resolves.toEqual([])
    expect(database.prepare(
      `select latest_change_id, current_task_snapshot_id,
              removed_at is not null as removed
       from shared_information_items
       where shared_information_item_id = ?`,
    ).get(task.sharedInformationItemId)).toEqual({
      latest_change_id: taskRemove.latestChangeId,
      current_task_snapshot_id: `${taskUpdate.sourceId}:snapshot`,
      removed: 1,
    })
    expect(database.prepare(
      `select change_kind, preceding_change_id, task_snapshot_id
       from shared_information_changes
       where shared_information_change_id = ?`,
    ).get(taskRemove.latestChangeId)).toEqual({
      change_kind: 'remove',
      preceding_change_id: taskUpdate.latestChangeId,
      task_snapshot_id: null,
    })

    const mixedRollbackTimetable = {
      ...operation({
        sourceId: '33222222-2222-4222-8222-222222222227',
        changeKind: 'add',
        targetScope: task.targetScope,
        replacement: { type: 'cancelled' },
      }),
      periodNumber: 7,
      changedByStudentAccountId: task.changedByStudentAccountId,
      kind: 'timetable_change',
    } satisfies DirectChangeOperation
    const staleTaskRemove = {
      ...taskRemove,
      sourceId: '33222222-2222-4222-8222-222222222228',
      latestChangeId: '33222222-2222-4222-8222-222222222228:change',
      expectedLatestChangeId: taskUpdate.latestChangeId,
    } satisfies DirectChangeOperation
    await expect(
      adapters.directTimetableChange.commitDirectChanges([
        mixedRollbackTimetable,
        staleTaskRemove,
      ]),
    ).resolves.toEqual({
      status: 'conflict',
      conflictingSourceIds: [staleTaskRemove.sourceId],
    })
    expect(database.prepare(
      `select count(*) as count from shared_information_items
       where shared_information_item_id = ?`,
    ).get(mixedRollbackTimetable.sharedInformationItemId)).toEqual({ count: 0 })

    const updateTimetable = {
      ...timetable,
      sourceId: '33222222-2222-4222-8222-222222222223',
      latestChangeId: '33222222-2222-4222-8222-222222222223:change',
      changeKind: 'update',
      sharedInformationItemId: timetable.sharedInformationItemId,
      expectedLatestChangeId: timetable.latestChangeId,
      replacement: { type: 'lesson_name', lessonName: '更新後' },
    } satisfies DirectChangeOperation
    const taskBesideUpdate = {
      ...task,
      sourceId: '33222222-2222-4222-8222-222222222224',
      sharedInformationItemId: '33222222-2222-4222-8222-222222222224',
      latestChangeId: '33222222-2222-4222-8222-222222222224:change',
      title: '更新と同時のTask',
    } satisfies DirectChangeOperation
    await expect(
      adapters.directTimetableChange.commitDirectChanges([
        updateTimetable,
        taskBesideUpdate,
      ]),
    ).resolves.toMatchObject({ status: 'applied' })
    await expect(
      adapters.dailyPlan.listActiveTimetableChangesForStudent(
        affiliation,
        '2026-07-10',
        '2026-07-10',
      ),
    ).resolves.toEqual([
      expect.objectContaining({ replacement: { type: 'lesson_name', lessonName: '更新後' } }),
    ])

    await expect(
      adapters.directTimetableChange.commitDirectChanges([
        timetable,
        { ...task, title: 'changed payload' },
      ]),
    ).resolves.toEqual({
      status: 'idempotency-conflict',
      conflictingSourceIds: [task.sourceId],
    })

    const rolledBackTask = {
      ...task,
      sourceId: '33333333-3333-4333-8333-333333333333',
      sharedInformationItemId: '33333333-3333-4333-8333-333333333333',
      latestChangeId: '33333333-3333-4333-8333-333333333333:change',
    } satisfies DirectChangeOperation
    const occupiedTimetable = {
      ...timetable,
      sourceId: '33444444-4444-4444-8444-444444444444',
      sharedInformationItemId: '33444444-4444-4444-8444-444444444444',
      latestChangeId: '33444444-4444-4444-8444-444444444444:change',
    } satisfies DirectChangeOperation
    await expect(
      adapters.directTimetableChange.commitDirectChanges([
        occupiedTimetable,
        rolledBackTask,
      ]),
    ).resolves.toMatchObject({ status: 'conflict' })
    expect(database.prepare(
      'select count(*) as count from task_snapshots where task_snapshot_id = ?',
    ).get(`${rolledBackTask.sourceId}:snapshot`)).toEqual({ count: 0 })
  })

  it('retains applied Task proposal changes without exposing proposal participants', async () => {
    const database = createTestDatabase()
    const adapters = createD1PersistenceAdapters(
      new SqliteD1Database(database) as unknown as D1Database,
    )
    await adapters.seed.saveStudentAccount({
      studentAccountId: 'proposal-history-student',
      schoolEmail: 'proposal-history@example.invalid',
      displayName: 'Proposal Student',
    })
    const taskId = '33a11111-1111-4111-8111-111111111111'
    const add = {
      kind: 'task',
      changeKind: 'add',
      sourceId: taskId,
      sharedInformationItemId: taskId,
      latestChangeId: `${taskId}:change`,
      targetScope: {
        type: 'student',
        schoolYear: 2026,
        studentAccountId: 'proposal-history-student',
      },
      title: '提案前',
      dueDate: null,
      relatedLessonName: null,
      changedByStudentAccountId: 'proposal-history-student',
      changedAt: 1,
      createdAt: 1,
    } satisfies DirectChangeOperation
    await adapters.directTimetableChange.commitDirectChanges([add])

    database.prepare(`
      insert into task_snapshots (
        task_snapshot_id, title, due_date,
        registered_related_lesson_name_id, related_lesson_name,
        normalized_custom_lesson_name, created_at
      ) values (?, '提案後', '2026-07-12', null, null, null, ?)
    `).run('proposal-history-snapshot', '1970-01-01T00:00:00.002Z')
    database.prepare(`
      insert into shared_information_changes (
        shared_information_change_id, shared_information_item_id,
        change_kind, source_type, source_id, preceding_change_id,
        changed_by_student_account_id, changed_at, task_snapshot_id,
        timetable_change_snapshot_id
      ) values (?, ?, 'update', 'proposal', null, ?, ?, ?, ?, null)
    `).run(
      'proposal-history-change',
      taskId,
      add.latestChangeId,
      'proposal-history-student',
      '1970-01-01T00:00:00.002Z',
      'proposal-history-snapshot',
    )
    database.prepare(`
      update shared_information_items
      set latest_change_id = ?, current_task_snapshot_id = ?
      where shared_information_item_id = ?
    `).run('proposal-history-change', 'proposal-history-snapshot', taskId)

    const history = await adapters.taskEditHistory.listTaskEditHistory(taskId)
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({
      sourceType: 'direct',
      primaryActorDisplayName: 'Proposal Student',
    })
    expect(history[1]).toMatchObject({
      sourceType: 'proposal',
      precedingChangeId: add.latestChangeId,
      snapshot: {
        title: '提案後',
        dueDate: '2026-07-12',
        relatedLessonName: null,
      },
    })
    expect('primaryActorDisplayName' in history[1]).toBe(false)
  })

  it('backfills applied predecessors for existing Shared Information Changes', () => {
    const database = createTestDatabase('0010_timetable_direct_change_integrity.sql')
    database.exec('pragma foreign_keys = off')
    database.exec(`
      insert into shared_information_items (
        shared_information_item_id, kind, target_scope_id, latest_change_id,
        current_timetable_change_snapshot_id,
        created_by_student_account_id, created_at, removed_at
      ) values ('legacy-item', 'timetable_change', 'legacy-scope', null, null,
                'legacy-student', '2026-07-10T00:00:00.000Z', null);
      insert into shared_information_changes (
        shared_information_change_id, shared_information_item_id, change_kind,
        source_type, source_id, changed_by_student_account_id, changed_at,
        timetable_change_snapshot_id
      ) values
        ('legacy-z-add', 'legacy-item', 'add', 'direct', 'legacy-z',
         'legacy-student', '2026-07-10T00:00:00.000Z', null),
        ('legacy-a-update', 'legacy-item', 'update', 'direct', 'legacy-a',
         'legacy-student', '2026-07-10T00:00:00.000Z', null),
        ('legacy-m-remove', 'legacy-item', 'remove', 'direct', 'legacy-m',
         'legacy-student', '2026-07-10T00:00:00.000Z', null);
    `)
    const migrationPath = fileURLToPath(new URL(
      '../db/migrations/0011_shared_information_change_predecessors.sql',
      import.meta.url,
    ))
    database.exec(readFileSync(migrationPath, 'utf8'))

    expect(database.prepare(`
      select shared_information_change_id, preceding_change_id
      from shared_information_changes order by rowid
    `).all()).toEqual([
      { shared_information_change_id: 'legacy-z-add', preceding_change_id: null },
      {
        shared_information_change_id: 'legacy-a-update',
        preceding_change_id: 'legacy-z-add',
      },
      {
        shared_information_change_id: 'legacy-m-remove',
        preceding_change_id: 'legacy-a-update',
      },
    ])
  })

  it('removes without deleting history, retries safely, reuses the slot, and rolls back mixed conflicts', async () => {
    const database = createTestDatabase()
    const adapters = createD1PersistenceAdapters(
      new SqliteD1Database(database) as unknown as D1Database,
    )
    const affiliation: StudentAffiliation = {
      studentAffiliationId: 'affiliation-1',
      studentAccountId: 'student-1',
      schoolYear: 2026,
      grade: 2,
      classId: 'class-1',
      trackId: 'track-1',
      selectedAt: 1,
      endedAt: null,
    }
    await adapters.seed.saveStudentAccount({
      studentAccountId: 'student-1',
      schoolEmail: 'student@example.invalid',
      displayName: 'Student',
    })
    await adapters.seed.saveSchoolYearClass({
      classId: 'class-1',
      schoolYear: 2026,
      grade: 2,
      classNumber: 1,
    })
    await adapters.seed.saveTrack({
      trackId: 'track-1',
      classId: 'class-1',
      trackName: 'Track',
    })
    await adapters.seed.saveStudentAffiliation(affiliation)

    const add = operation({
      sourceId: '30111111-1111-4111-8111-111111111111',
      changeKind: 'add',
      replacement: { type: 'lesson_name', lessonName: 'Ｓｐｅｃｉａｌ   LESSON' },
    })
    const remove = operation({
      sourceId: '30222222-2222-4222-8222-222222222222',
      changeKind: 'remove',
      sharedInformationItemId: add.sharedInformationItemId,
      expectedLatestChangeId: add.latestChangeId,
    })

    await expect(
      adapters.directTimetableChange.commitDirectTimetableChanges([add]),
    ).resolves.toMatchObject({ status: 'applied' })
    expect(database.prepare(
      `select normalized_custom_lesson_name
       from timetable_change_snapshots
       where timetable_change_snapshot_id = ?`,
    ).get(`${add.sourceId}:snapshot`)).toEqual({
      normalized_custom_lesson_name: 'special lesson',
    })
    database.prepare(
      `update timetable_change_snapshots
       set normalized_custom_lesson_name = null
       where timetable_change_snapshot_id = ?`,
    ).run(`${add.sourceId}:snapshot`)
    await backfillLegacyCustomLessonNameNormalization(
      new SqliteD1Database(database) as unknown as D1Database,
    )
    expect(database.prepare(
      `select normalized_custom_lesson_name
       from timetable_change_snapshots
       where timetable_change_snapshot_id = ?`,
    ).get(`${add.sourceId}:snapshot`)).toEqual({
      normalized_custom_lesson_name: 'special lesson',
    })
    await expect(
      adapters.directTimetableChange.commitDirectTimetableChanges([remove]),
    ).resolves.toMatchObject({ status: 'applied' })
    await expect(
      adapters.directTimetableChange.commitDirectTimetableChanges([remove]),
    ).resolves.toMatchObject({ status: 'applied' })

    expect(database.prepare(
      `select removed_at, latest_change_id, current_timetable_change_snapshot_id
       from shared_information_items where shared_information_item_id = ?`,
    ).get(add.sharedInformationItemId)).toMatchObject({
      removed_at: new Date(remove.changedAt).toISOString(),
      latest_change_id: remove.latestChangeId,
      current_timetable_change_snapshot_id: `${add.sourceId}:snapshot`,
    })
    expect(database.prepare(
      `select change_kind, timetable_change_snapshot_id, preceding_change_id
       from shared_information_changes where shared_information_item_id = ?
       order by rowid`,
    ).all(add.sharedInformationItemId)).toEqual([
      {
        change_kind: 'add',
        timetable_change_snapshot_id: `${add.sourceId}:snapshot`,
        preceding_change_id: null,
      },
      {
        change_kind: 'remove',
        timetable_change_snapshot_id: null,
        preceding_change_id: add.latestChangeId,
      },
    ])
    expect(database.prepare(
      'select count(*) as count from timetable_change_snapshots',
    ).get()).toEqual({ count: 1 })

    await expect(adapters.timetableChangeHistory.listTimetableChangeHistory({
      targetScope: { type: 'track', schoolYear: 2026, trackId: 'track-1' },
      changeDate: '2026-07-10',
      periodNumber: 1,
    })).resolves.toEqual([
      expect.objectContaining({
        sharedInformationChangeId: add.latestChangeId,
        changeKind: 'add',
        primaryActorDisplayName: 'Student',
        replacement: {
          type: 'lesson_name',
          lessonName: 'Ｓｐｅｃｉａｌ   LESSON',
        },
      }),
      expect.objectContaining({
        sharedInformationChangeId: remove.latestChangeId,
        changeKind: 'remove',
        primaryActorDisplayName: 'Student',
        replacement: null,
      }),
    ])

    const replacementAdd = operation({
      sourceId: '30333333-3333-4333-8333-333333333333',
      changeKind: 'add',
      replacement: { type: 'cancelled' },
    })
    await expect(
      adapters.directTimetableChange.commitDirectTimetableChanges([replacementAdd]),
    ).resolves.toMatchObject({ status: 'applied' })
    await expect(
      adapters.dailyPlan.listActiveTimetableChangesForStudent(
        affiliation,
        '2026-07-10',
        '2026-07-10',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        sharedInformationItemId: replacementAdd.sharedInformationItemId,
        replacement: { type: 'cancelled' },
      }),
    ])

    const mixedAdd = operation({
      sourceId: '30444444-4444-4444-8444-444444444444',
      changeKind: 'add',
      targetScope: {
        type: 'student',
        schoolYear: 2026,
        studentAccountId: 'student-1',
      },
      periodNumber: 2,
      replacement: { type: 'lesson_name', lessonName: '保存されない' },
    })
    const staleRemove = operation({
      sourceId: '30555555-5555-4555-8555-555555555555',
      changeKind: 'remove',
      sharedInformationItemId: add.sharedInformationItemId,
      expectedLatestChangeId: add.latestChangeId,
    })
    await expect(
      adapters.directTimetableChange.commitDirectTimetableChanges([
        mixedAdd,
        staleRemove,
      ]),
    ).resolves.toMatchObject({
      status: 'conflict',
      conflictingSourceIds: [staleRemove.sourceId],
    })
    expect(database.prepare(
      'select count(*) as count from shared_information_items where shared_information_item_id = ?',
    ).get(mixedAdd.sharedInformationItemId)).toEqual({ count: 0 })
  })

  it('does not expose an unsupported multi-part Target Scope', async () => {
    const database = createTestDatabase()
    const adapters = createD1PersistenceAdapters(
      new SqliteD1Database(database) as unknown as D1Database,
    )
    const affiliation: StudentAffiliation = {
      studentAffiliationId: 'affiliation-1',
      studentAccountId: 'student-1',
      schoolYear: 2026,
      grade: 2,
      classId: 'class-1',
      trackId: 'track-1',
      selectedAt: 1,
      endedAt: null,
    }
    await adapters.seed.saveStudentAccount({
      studentAccountId: 'student-1',
      schoolEmail: 'student@example.invalid',
      displayName: 'Student',
    })
    await adapters.seed.saveSchoolYearClass({
      classId: 'class-1',
      schoolYear: 2026,
      grade: 2,
      classNumber: 1,
    })
    await adapters.seed.saveTrack({
      trackId: 'track-1',
      classId: 'class-1',
      trackName: 'Track',
    })
    const change = operation({
      sourceId: '30666666-6666-4666-8666-666666666666',
      changeKind: 'add',
      replacement: { type: 'cancelled' },
    })
    await adapters.directTimetableChange.commitDirectTimetableChanges([change])
    database.prepare(`
      insert into target_scope_parts (
        target_scope_part_id, target_scope_id, scope_type, grade,
        class_id, track_id, student_account_id
      ) values (?, ?, 'grade', 2, null, null, null)
    `).run(
      `${change.sourceId}:extra-part`,
      `${change.sourceId}:scope`,
    )

    await expect(
      adapters.dailyPlan.listActiveTimetableChangesForStudent(
        affiliation,
        '2026-07-10',
        '2026-07-10',
      ),
    ).resolves.toEqual([])
  })
})

const targetScopeMembershipAdapterCases: Array<
  [string, () => PersistenceAdapters]
> = [
  ['in-memory', () => createInMemoryPersistenceAdapters()],
  [
    'D1',
    () => createD1PersistenceAdapters(
      new SqliteD1Database(createTestDatabase()) as unknown as D1Database,
    ),
  ],
]

describe.each(targetScopeMembershipAdapterCases)(
  'Registered Timetable Change Lesson Name adapter conformance: %s',
  (_name, createAdapters) => {
    it('renders the current Short Lesson Name in projection and history and retries by identity', async () => {
      const adapters = createAdapters()
      const affiliation: StudentAffiliation = {
        studentAffiliationId: 'affiliation-registered',
        studentAccountId: 'student-1',
        schoolYear: 2026,
        grade: 2,
        classId: 'class-registered',
        trackId: 'track-registered',
        selectedAt: 1,
        endedAt: null,
      }
      await adapters.seed.saveStudentAccount({
        studentAccountId: affiliation.studentAccountId,
        schoolEmail: 'registered@example.invalid',
        displayName: 'Registered Student',
      })
      await adapters.seed.saveSchoolYearClass({
        classId: affiliation.classId,
        schoolYear: 2026,
        grade: 2,
        classNumber: 1,
      })
      await adapters.seed.saveTrack({
        trackId: affiliation.trackId,
        classId: affiliation.classId,
        trackName: 'Track',
      })
      await adapters.seed.saveRegisteredLessonName({
        registeredLessonNameId: 'geography',
        fullLessonName: '地理総合',
        shortLessonName: '地理',
        normalizedFullLessonName: '地理総合',
      })
      const change = operation({
        sourceId: '40666666-6666-4666-8666-666666666666',
        changeKind: 'add',
        targetScope: {
          type: 'track',
          schoolYear: 2026,
          trackId: affiliation.trackId,
        },
        replacement: {
          type: 'lesson_name',
          registeredLessonNameId: 'geography',
          lessonName: '地理',
        },
      })

      await expect(
        adapters.directTimetableChange.commitDirectTimetableChanges([change]),
      ).resolves.toMatchObject({ status: 'applied' })
      await adapters.seed.saveRegisteredLessonName({
        registeredLessonNameId: 'geography',
        fullLessonName: '地理総合',
        shortLessonName: '地理（新）',
        normalizedFullLessonName: '地理総合',
      })
      await expect(
        adapters.directTimetableChange.commitDirectTimetableChanges([change]),
      ).resolves.toMatchObject({ status: 'applied' })

      await expect(
        adapters.dailyPlan.listActiveTimetableChangesForStudent(
          affiliation,
          '2026-07-10',
          '2026-07-10',
        ),
      ).resolves.toEqual([
        expect.objectContaining({
          replacement: {
            type: 'lesson_name',
            registeredLessonNameId: 'geography',
            lessonName: '地理（新）',
          },
        }),
      ])
      await expect(
        adapters.timetableChangeHistory.listTimetableChangeHistory({
          targetScope: change.targetScope,
          changeDate: change.changeDate,
          periodNumber: change.periodNumber,
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          replacement: {
            type: 'lesson_name',
            registeredLessonNameId: 'geography',
            lessonName: '地理（新）',
          },
        }),
      ])
    })
  },
)

describe.each(targetScopeMembershipAdapterCases)(
  'Task Edit History adapter conformance: %s',
  (_name, createAdapters) => {
    it('retains every applied snapshot and resolves current Short Lesson Names', async () => {
      const adapters = createAdapters()
      await adapters.seed.saveStudentAccount({
        studentAccountId: 'task-history-student',
        schoolEmail: 'task-history@example.invalid',
        displayName: 'Task Historian',
      })
      await adapters.seed.saveRegisteredLessonName({
        registeredLessonNameId: 'task-history-geography',
        fullLessonName: '履歴地理総合',
        shortLessonName: '履歴地理',
        normalizedFullLessonName: '履歴地理総合',
      })
      const taskId = '40711111-1111-4111-8111-111111111111'
      const add = {
        kind: 'task',
        changeKind: 'add',
        sourceId: taskId,
        sharedInformationItemId: taskId,
        latestChangeId: `${taskId}:change`,
        targetScope: {
          type: 'student',
          schoolYear: 2026,
          studentAccountId: 'task-history-student',
        },
        title: '地理の準備',
        dueDate: '2026-07-10',
        relatedLessonName: null,
        changedByStudentAccountId: 'task-history-student',
        changedAt: 1,
        createdAt: 1,
      } satisfies DirectChangeOperation
      const updateId = '40722222-2222-4222-8222-222222222222'
      const update = {
        ...add,
        changeKind: 'update',
        sourceId: updateId,
        latestChangeId: `${updateId}:change`,
        expectedLatestChangeId: add.latestChangeId,
        title: '地理ワークを提出',
        dueDate: '2026-07-11',
        relatedLessonName: {
          registeredLessonNameId: 'task-history-geography',
          lessonName: '履歴地理',
        },
        changedAt: 2,
      } satisfies DirectChangeOperation
      const removeId = '40733333-3333-4333-8333-333333333333'
      const remove = {
        kind: 'task',
        changeKind: 'remove',
        sourceId: removeId,
        sharedInformationItemId: taskId,
        latestChangeId: `${removeId}:change`,
        expectedLatestChangeId: update.latestChangeId,
        targetScope: add.targetScope,
        changedByStudentAccountId: 'task-history-student',
        changedAt: 3,
      } satisfies DirectChangeOperation

      await expect(adapters.directTimetableChange.commitDirectChanges([add]))
        .resolves.toMatchObject({ status: 'applied' })
      await expect(adapters.directTimetableChange.commitDirectChanges([update]))
        .resolves.toMatchObject({ status: 'applied' })
      await expect(adapters.directTimetableChange.commitDirectChanges([remove]))
        .resolves.toMatchObject({ status: 'applied' })
      await adapters.seed.saveRegisteredLessonName({
        registeredLessonNameId: 'task-history-geography',
        fullLessonName: '履歴地理総合',
        shortLessonName: '履歴地理（新）',
        normalizedFullLessonName: '履歴地理総合',
      })

      await expect(adapters.taskEditHistory.listTaskEditHistory(taskId))
        .resolves.toEqual([
          expect.objectContaining({
            sharedInformationChangeId: add.latestChangeId,
            precedingChangeId: null,
            primaryActorDisplayName: 'Task Historian',
            snapshot: {
              title: '地理の準備',
              dueDate: '2026-07-10',
              relatedLessonName: null,
            },
          }),
          expect.objectContaining({
            sharedInformationChangeId: update.latestChangeId,
            precedingChangeId: add.latestChangeId,
            primaryActorDisplayName: 'Task Historian',
            snapshot: {
              title: '地理ワークを提出',
              dueDate: '2026-07-11',
              relatedLessonName: '履歴地理（新）',
            },
          }),
          expect.objectContaining({
            sharedInformationChangeId: remove.latestChangeId,
            precedingChangeId: update.latestChangeId,
            primaryActorDisplayName: 'Task Historian',
            snapshot: null,
          }),
        ])
    })
  },
)

describe.each(targetScopeMembershipAdapterCases)(
  'Target Scope membership adapter conformance: %s',
  (_name, createAdapters) => {
    it('returns only active Timetable Changes whose Target Scope includes the Student', async () => {
      const adapters = createAdapters()
      const affiliation: StudentAffiliation = {
        studentAffiliationId: 'affiliation-1',
        studentAccountId: 'student-1',
        schoolYear: 2026,
        grade: 2,
        classId: 'class-1',
        trackId: 'track-1',
        selectedAt: 1,
        endedAt: null,
      }
      await adapters.seed.saveStudentAccount({
        studentAccountId: 'student-1',
        schoolEmail: 'student@example.invalid',
        displayName: 'Student',
      })
      await adapters.seed.saveSchoolYearClass({
        classId: 'class-1',
        schoolYear: 2026,
        grade: 2,
        classNumber: 1,
      })
      await adapters.seed.saveTrack({
        trackId: 'track-1',
        classId: 'class-1',
        trackName: 'Track',
      })
      const changes = [
        operation({
          sourceId: '40111111-1111-4111-8111-111111111111',
          changeKind: 'add',
          targetScope: { type: 'grade', schoolYear: 2026, grade: 2 },
          periodNumber: 1,
          replacement: { type: 'cancelled' },
        }),
        operation({
          sourceId: '40222222-2222-4222-8222-222222222222',
          changeKind: 'add',
          targetScope: { type: 'class', schoolYear: 2026, classId: 'class-1' },
          periodNumber: 2,
          replacement: { type: 'cancelled' },
        }),
        operation({
          sourceId: '40333333-3333-4333-8333-333333333333',
          changeKind: 'add',
          targetScope: { type: 'track', schoolYear: 2026, trackId: 'track-1' },
          periodNumber: 3,
          replacement: { type: 'cancelled' },
        }),
        operation({
          sourceId: '40444444-4444-4444-8444-444444444444',
          changeKind: 'add',
          targetScope: {
            type: 'student',
            schoolYear: 2026,
            studentAccountId: 'student-1',
          },
          periodNumber: 4,
          replacement: { type: 'cancelled' },
        }),
        operation({
          sourceId: '40555555-5555-4555-8555-555555555555',
          changeKind: 'add',
          targetScope: { type: 'grade', schoolYear: 2026, grade: 3 },
          periodNumber: 5,
          replacement: { type: 'cancelled' },
        }),
      ]

      await expect(
        adapters.directTimetableChange.commitDirectTimetableChanges(changes),
      ).resolves.toMatchObject({ status: 'applied' })

      const visible =
        await adapters.dailyPlan.listActiveTimetableChangesForStudent(
          affiliation,
          '2026-07-10',
          '2026-07-10',
        )
      expect(
        visible.map(({ sourceId, targetScope }) => ({ sourceId, targetScope })),
      ).toEqual(
        changes.slice(0, 4).map(({ sourceId, targetScope }) => ({
          sourceId,
          targetScope,
        })),
      )
    })
  },
)

type OperationOverrides =
  | {
      sourceId: string
      changeKind: 'add'
      replacement: TimetableChangeReplacement
      targetScope?: TargetScope
      periodNumber?: number
    }
  | {
      sourceId: string
      changeKind: 'remove'
      sharedInformationItemId: string
      expectedLatestChangeId: string
    }

function operation(overrides: OperationOverrides): DirectTimetableChangeOperation {
  const common = {
    sourceId: overrides.sourceId,
    sharedInformationItemId:
      'sharedInformationItemId' in overrides
        ? overrides.sharedInformationItemId
        : overrides.sourceId,
    latestChangeId: `${overrides.sourceId}:change`,
    targetScope:
      'targetScope' in overrides
        ? overrides.targetScope ?? {
            type: 'track' as const,
            schoolYear: 2026,
            trackId: 'track-1',
          }
        : {
            type: 'track' as const,
            schoolYear: 2026,
            trackId: 'track-1',
          },
    changeDate: '2026-07-10',
    periodNumber: 'periodNumber' in overrides ? overrides.periodNumber ?? 1 : 1,
    changedByStudentAccountId: 'student-1',
    changedAt: 1_800_000_000_000,
  }
  return overrides.changeKind === 'remove'
    ? {
        ...common,
        changeKind: 'remove',
        expectedLatestChangeId: overrides.expectedLatestChangeId,
      }
    : {
        ...common,
        changeKind: 'add',
        replacement: overrides.replacement,
      }
}
