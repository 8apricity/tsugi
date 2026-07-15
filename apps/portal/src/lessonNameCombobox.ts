import {
  filterRegisteredLessonNames,
  normalizeLessonName,
  registeredLessonNameDisplayLabel,
  resolveDirectLessonName,
  type RegisteredLessonNameOption,
} from '../shared/lessonNames'

export type LessonNameComboboxOption = RegisteredLessonNameOption & {
  displayLabel: string
}

export function createLessonNameComboboxClient({
  prioritizedOptions,
  allOptions,
  initialQuery = '',
  initialExpandedToAll = false,
  initialActiveIndex = -1,
}: {
  prioritizedOptions: readonly RegisteredLessonNameOption[]
  allOptions: readonly RegisteredLessonNameOption[]
  initialQuery?: string
  initialExpandedToAll?: boolean
  initialActiveIndex?: number
}) {
  let query = initialQuery
  let expandedToAll = initialExpandedToAll
  let activeIndex = initialActiveIndex

  function visibleOptions(): LessonNameComboboxOption[] {
    return filterRegisteredLessonNames(
      expandedToAll ? allOptions : prioritizedOptions,
      query,
    ).map((option) => ({
      ...option,
      displayLabel: registeredLessonNameDisplayLabel(option),
    }))
  }

  return {
    getSnapshot() {
      const options = visibleOptions()
      return {
        query,
        normalizedQuery: normalizeLessonName(query),
        expandedToAll,
        activeIndex,
        options,
      }
    },
    setQuery(nextQuery: string) {
      query = nextQuery
      activeIndex = -1
    },
    expandToAll() {
      expandedToAll = true
      activeIndex = -1
    },
    moveActive(delta: -1 | 1) {
      const count = visibleOptions().length
      if (count === 0) {
        activeIndex = -1
        return
      }
      activeIndex = activeIndex < 0
        ? delta === 1 ? 0 : count - 1
        : (activeIndex + delta + count) % count
    },
    setActiveIndex(index: number) {
      activeIndex = visibleOptions()[index] ? index : -1
    },
    chooseActive() {
      const option = visibleOptions()[activeIndex]
      return option
        ? {
            type: 'lesson_name' as const,
            registeredLessonNameId: option.registeredLessonNameId,
            lessonName: option.shortLessonName,
          }
        : null
    },
    resolveInput(input = query) {
      return resolveDirectLessonName(input, allOptions)
    },
  }
}
