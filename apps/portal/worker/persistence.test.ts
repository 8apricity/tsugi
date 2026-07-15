import { describe, expect, it } from 'vitest'
import { InMemoryPersistenceAdapters } from './persistence'

async function saveRegisteredLessonName(
  store: InMemoryPersistenceAdapters,
  registeredLessonNameId: string,
  shortLessonName: string,
) {
  await store.saveRegisteredLessonName({
    registeredLessonNameId,
    fullLessonName: shortLessonName,
    shortLessonName,
    normalizedFullLessonName: shortLessonName,
  })
}

describe('Registered Lesson Name persistence', () => {
  it('enforces normalized Full Lesson Name uniqueness and allows duplicate Short Lesson Names', async () => {
    const store = new InMemoryPersistenceAdapters()

    await store.saveRegisteredLessonName({
      registeredLessonNameId: 'geography-integrated',
      fullLessonName: '地理総合',
      shortLessonName: '地理',
      normalizedFullLessonName: '地理総合',
    })
    await expect(store.saveRegisteredLessonName({
      registeredLessonNameId: 'advanced-geography',
      fullLessonName: '地理探究',
      shortLessonName: '地理',
      normalizedFullLessonName: '地理探究',
    })).resolves.toBeUndefined()
    await expect(store.saveRegisteredLessonName({
      registeredLessonNameId: 'duplicate-geography-integrated',
      fullLessonName: '  地理総合  ',
      shortLessonName: '別名',
      normalizedFullLessonName: '地理総合',
    })).rejects.toThrow('normalized Full Lesson Name must be unique')
  })

  it('renders the current Short Lesson Name for a stored Registered identity', async () => {
    const store = new InMemoryPersistenceAdapters()
    await saveRegisteredLessonName(store, 'geography', '地理')
    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'monday-1',
      classId: 'class-1',
      trackId: null,
      referenceType: 'period',
      weekday: 1,
      periodNumber: 1,
      registeredLessonNameId: 'geography',
    })

    await saveRegisteredLessonName(store, 'geography', '地理新名')

    await expect(store.findStandardTimetableEntryForPeriodReference(
      'class-1',
      'track-1',
      1,
      1,
    )).resolves.toMatchObject({ lessonName: '地理新名' })
  })
})

describe('Floating Lesson Reference resolution', () => {
  it('resolves the class-common value when the track has no override', async () => {
    const store = new InMemoryPersistenceAdapters()

    await saveRegisteredLessonName(store, 'class-common', '共通授業')

    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-common',
      classId: 'class-1',
      trackId: null,
      referenceType: 'floating',
      referenceLabel: '★',
      floatingLessonReferenceLabelId: 'label-star',
      registeredLessonNameId: 'class-common',
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

    await saveRegisteredLessonName(store, 'class-common', '共通授業')
    await saveRegisteredLessonName(store, 'self-directed-study', '自走')

    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-common',
      classId: '2026-grade-2-class-3',
      trackId: null,
      referenceType: 'floating',
      referenceLabel: '★',
      floatingLessonReferenceLabelId: '2026:2:★',
      registeredLessonNameId: 'class-common',
    })
    await store.saveStandardTimetableEntry({
      standardTimetableEntryId: 'floating-star-humanities',
      classId: '2026-grade-2-class-3',
      trackId: '2026-grade-2-class-3-humanities',
      referenceType: 'floating',
      referenceLabel: '★',
      floatingLessonReferenceLabelId: '2026:2:★',
      registeredLessonNameId: 'self-directed-study',
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
