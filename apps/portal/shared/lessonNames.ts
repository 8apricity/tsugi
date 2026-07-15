export type RegisteredLessonNameOption = {
  registeredLessonNameId: string
  fullLessonName: string
  shortLessonName: string
}

export type DirectLessonNameReplacement =
  | {
      type: 'lesson_name'
      registeredLessonNameId: string
      lessonName: string
    }
  | { type: 'lesson_name'; lessonName: string; registeredLessonNameId?: never }

export function normalizeLessonName(value: string) {
  return value
    .trim()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US')
}

export function registeredLessonNameDisplayLabel(
  option: RegisteredLessonNameOption,
) {
  return option.shortLessonName === option.fullLessonName
    ? option.shortLessonName
    : `${option.shortLessonName}（${option.fullLessonName}）`
}

export function filterRegisteredLessonNames(
  options: readonly RegisteredLessonNameOption[],
  query: string,
) {
  const normalizedQuery = normalizeLessonName(query)
  if (!normalizedQuery) return [...options]
  return options.filter((option) =>
    normalizeLessonName(option.fullLessonName).includes(normalizedQuery) ||
    normalizeLessonName(option.shortLessonName).includes(normalizedQuery)
  )
}

export function resolveDirectLessonName(
  input: string,
  options: readonly RegisteredLessonNameOption[],
): { replacement: DirectLessonNameReplacement; custom: boolean } {
  const lessonName = input.trim()
  const normalizedInput = normalizeLessonName(input)
  const fullMatch = options.find(
    (option) => normalizeLessonName(option.fullLessonName) === normalizedInput,
  )
  const shortMatches = options.filter(
    (option) => normalizeLessonName(option.shortLessonName) === normalizedInput,
  )
  const registered = fullMatch ?? (shortMatches.length === 1 ? shortMatches[0] : null)

  return registered
    ? {
        replacement: {
          type: 'lesson_name',
          registeredLessonNameId: registered.registeredLessonNameId,
          lessonName: registered.shortLessonName,
        },
        custom: false,
      }
    : { replacement: { type: 'lesson_name', lessonName }, custom: true }
}
