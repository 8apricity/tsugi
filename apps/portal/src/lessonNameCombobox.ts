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

  function matchingOptions() {
    const prioritized = filterRegisteredLessonNames(prioritizedOptions, query)
    const prioritizedIds = new Set(
      prioritizedOptions.map((option) => option.registeredLessonNameId),
    )
    const additional = filterRegisteredLessonNames(allOptions, query).filter(
      (option) => !prioritizedIds.has(option.registeredLessonNameId),
    )

    return { prioritized, additional }
  }

  function visibleOptions(): LessonNameComboboxOption[] {
    const { prioritized, additional } = matchingOptions()
    return (expandedToAll ? [...prioritized, ...additional] : prioritized).map((option) => ({
      ...option,
      displayLabel: registeredLessonNameDisplayLabel(option),
    }))
  }

  return {
    getSnapshot() {
      const options = visibleOptions()
      const { additional } = matchingOptions()
      return {
        query,
        normalizedQuery: normalizeLessonName(query),
        expandedToAll,
        hasAdditionalOptions: additional.length > 0,
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
