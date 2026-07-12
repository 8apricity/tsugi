// @ts-expect-error Node-only D1 test harness; Worker production types exclude Node.
import { readdirSync, readFileSync } from 'node:fs'
// @ts-expect-error Node-only D1 test harness; Worker production types exclude Node.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
// @ts-expect-error Node-only D1 test harness; Worker production types exclude Node.
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createD1PersistenceAdapters,
  type DirectTimetableChangeOperation,
  type StudentAffiliation,
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
      replacement: { type: 'lesson_name', lessonName: '変更前' },
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
      schoolYear: 2026,
      targetScopeType: 'track',
      targetScopeValue: 'track-1',
      changeDate: '2026-07-10',
      periodNumber: 1,
    })).resolves.toEqual([
      expect.objectContaining({
        sharedInformationChangeId: add.latestChangeId,
        changeKind: 'add',
        primaryActorDisplayName: 'Student',
        replacement: { type: 'lesson_name', lessonName: '変更前' },
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
      targetScopeType: 'student',
      targetScopeValue: 'student-1',
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
})

type OperationOverrides =
  | {
      sourceId: string
      changeKind: 'add'
      replacement: TimetableChangeReplacement
      targetScopeType?: 'track' | 'student'
      targetScopeValue?: string
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
    schoolYear: 2026,
    targetScopeType:
      'targetScopeType' in overrides ? overrides.targetScopeType ?? 'track' : 'track',
    targetScopeValue:
      'targetScopeValue' in overrides ? overrides.targetScopeValue ?? 'track-1' : 'track-1',
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
