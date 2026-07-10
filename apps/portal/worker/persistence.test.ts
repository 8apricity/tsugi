import { describe, expect, it } from 'vitest'
import { InMemoryPersistenceAdapters } from './persistence'

describe('Floating Lesson Reference resolution', () => {
  it('resolves the class-common value when the track has no override', async () => {
    const store = new InMemoryPersistenceAdapters()

    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-common',
      classId: 'class-1',
      trackId: null,
      referenceType: 'floating',
      referenceLabel: '★',
      lessonName: '共通授業',
    })

    await expect(
      store.findStandardTimetableEntryForFloatingReference(
        'class-1',
        'track-1',
        '★',
      ),
    ).resolves.toMatchObject({
      referenceType: 'floating',
      referenceLabel: '★',
      lessonName: '共通授業',
    })
  })

  it('prefers the track-specific value over the class-common value', async () => {
    const store = new InMemoryPersistenceAdapters()

    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-common',
      classId: '2026-grade-2-class-3',
      trackId: null,
      referenceType: 'floating',
      referenceLabel: '★',
      lessonName: '共通授業',
    })
    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-humanities',
      classId: '2026-grade-2-class-3',
      trackId: '2026-grade-2-class-3-humanities',
      referenceType: 'floating',
      referenceLabel: '★',
      lessonName: '自走',
    })

    await expect(
      store.findStandardTimetableEntryForFloatingReference(
        '2026-grade-2-class-3',
        '2026-grade-2-class-3-humanities',
        '★',
      ),
    ).resolves.toMatchObject({
      trackId: '2026-grade-2-class-3-humanities',
      lessonName: '自走',
    })
  })
})
