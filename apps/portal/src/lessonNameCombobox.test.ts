import { describe, expect, it } from 'vitest'
import { createLessonNameComboboxClient } from './lessonNameCombobox'

const mathematics = {
  registeredLessonNameId: 'mathematics-2-beta',
  fullLessonName: '理数数学Ⅱβ',
  shortLessonName: '数Ⅱβ',
}
const physicalEducation = {
  registeredLessonNameId: 'physical-education',
  fullLessonName: '体育',
  shortLessonName: '体育',
}
const integratedGeography = {
  registeredLessonNameId: 'geography-integrated',
  fullLessonName: '地理総合',
  shortLessonName: '地理',
}
const advancedGeography = {
  registeredLessonNameId: 'advanced-geography',
  fullLessonName: '地理探究',
  shortLessonName: '地理',
}

describe('Lesson Name combobox client', () => {
  it('searches Affiliation-prioritized names before More and preserves the query when expanded', () => {
    const client = createLessonNameComboboxClient({
      prioritizedOptions: [mathematics, physicalEducation],
      allOptions: [mathematics, physicalEducation, integratedGeography],
    })

    client.setQuery(' 地理 ')
    expect(client.getSnapshot()).toMatchObject({
      query: ' 地理 ',
      expandedToAll: false,
      options: [],
      hasAdditionalOptions: true,
    })

    client.expandToAll()
    expect(client.getSnapshot()).toMatchObject({
      query: ' 地理 ',
      expandedToAll: true,
      options: [integratedGeography],
      hasAdditionalOptions: true,
    })
  })

  it('appends matching additional names after prioritized names without duplicates', () => {
    const client = createLessonNameComboboxClient({
      prioritizedOptions: [physicalEducation, mathematics],
      allOptions: [integratedGeography, mathematics, physicalEducation],
    })

    expect(client.getSnapshot()).toMatchObject({
      expandedToAll: false,
      hasAdditionalOptions: true,
      options: [physicalEducation, mathematics],
    })

    client.expandToAll()
    expect(client.getSnapshot()).toMatchObject({
      expandedToAll: true,
      hasAdditionalOptions: true,
      options: [physicalEducation, mathematics, integratedGeography],
    })
  })

  it('keeps expanded ordering when the search query changes', () => {
    const client = createLessonNameComboboxClient({
      prioritizedOptions: [mathematics, physicalEducation],
      allOptions: [integratedGeography, mathematics, physicalEducation],
    })

    client.expandToAll()
    client.setQuery('地理')

    expect(client.getSnapshot()).toMatchObject({
      query: '地理',
      expandedToAll: true,
      hasAdditionalOptions: true,
      options: [integratedGeography],
    })
  })

  it('reports no additional names when every match is already prioritized', () => {
    const client = createLessonNameComboboxClient({
      prioritizedOptions: [mathematics, physicalEducation],
      allOptions: [integratedGeography, mathematics, physicalEducation],
      initialQuery: '体育',
    })

    expect(client.getSnapshot()).toMatchObject({
      hasAdditionalOptions: false,
      options: [physicalEducation],
    })
  })

  it('formats one or two labels and selects the active option by keyboard', () => {
    const client = createLessonNameComboboxClient({
      prioritizedOptions: [mathematics, physicalEducation],
      allOptions: [mathematics, physicalEducation],
    })

    expect(client.getSnapshot().options.map((option) => option.displayLabel)).toEqual([
      '数Ⅱβ（理数数学Ⅱβ）',
      '体育',
    ])
    client.moveActive(1)
    client.moveActive(1)
    expect(client.chooseActive()).toEqual({
      type: 'lesson_name',
      registeredLessonNameId: 'physical-education',
      lessonName: '体育',
    })

    const reverseClient = createLessonNameComboboxClient({
      prioritizedOptions: [mathematics, physicalEducation],
      allOptions: [mathematics, physicalEducation],
    })
    reverseClient.moveActive(-1)
    expect(reverseClient.chooseActive()).toEqual({
      type: 'lesson_name',
      registeredLessonNameId: 'physical-education',
      lessonName: '体育',
    })
  })

  it('resolves normalized Full Names and unique Short Names to Registered identity', () => {
    const client = createLessonNameComboboxClient({
      prioritizedOptions: [mathematics],
      allOptions: [mathematics, physicalEducation],
    })

    expect(client.resolveInput('　理数数学Ⅱβ　')).toEqual({
      replacement: {
        type: 'lesson_name',
        registeredLessonNameId: 'mathematics-2-beta',
        lessonName: '数Ⅱβ',
      },
      custom: false,
    })
    expect(client.resolveInput(' 体育 ')).toEqual({
      replacement: {
        type: 'lesson_name',
        registeredLessonNameId: 'physical-education',
        lessonName: '体育',
      },
      custom: false,
    })
  })

  it('keeps ambiguous and unmatched input as trimmed custom text with normalized search', () => {
    const client = createLessonNameComboboxClient({
      prioritizedOptions: [integratedGeography, advancedGeography],
      allOptions: [integratedGeography, advancedGeography],
    })

    expect(client.resolveInput('  地理  ')).toEqual({
      replacement: { type: 'lesson_name', lessonName: '地理' },
      custom: true,
    })
    expect(client.resolveInput('  Special   LESSON  ')).toEqual({
      replacement: { type: 'lesson_name', lessonName: 'Special   LESSON' },
      custom: true,
    })

    client.setQuery(' 地理総合 ')
    expect(client.getSnapshot().options).toEqual([
      expect.objectContaining({ registeredLessonNameId: 'geography-integrated' }),
    ])
  })
})
