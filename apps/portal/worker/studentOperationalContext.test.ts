import { describe, expect, it } from 'vitest'
import { InMemoryPersistenceAdapters } from './persistence'
import { resolveStudentOperationalContext } from './studentOperationalContext'

const now = 1_800_000_000_000
const sessionToken = 'session-token'

describe('Student operational context', () => {
  it('reports an unauthenticated Student', async () => {
    const store = new InMemoryPersistenceAdapters()

    await expect(resolve(store, null)).resolves.toEqual({
      status: 'unauthenticated',
    })
  })

  it('reports when the current School Year is unavailable', async () => {
    const store = await authenticatedStore()

    await expect(resolve(store)).resolves.toEqual({
      status: 'school-year-unavailable',
    })
  })

  it('reports when the Student needs Affiliation Renewal', async () => {
    const store = await authenticatedStore()
    const currentSchoolYear = {
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    }
    await store.saveSchoolYear(currentSchoolYear)

    await expect(resolve(store)).resolves.toEqual({
      status: 'affiliation-renewal-needed',
      currentSchoolYear,
    })
  })

  it('returns the authenticated Student, current School Year, and Student Affiliation', async () => {
    const store = await authenticatedStore()
    const currentSchoolYear = {
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    }
    const studentAffiliation = {
      studentAffiliationId: 'affiliation-1',
      studentAccountId: 'student-1',
      schoolYear: 2026,
      grade: 2,
      classId: 'class-1',
      trackId: 'track-1',
      selectedAt: now,
      endedAt: null,
    }
    await store.saveSchoolYear(currentSchoolYear)
    await store.saveStudentAffiliation(studentAffiliation)

    await expect(resolve(store)).resolves.toEqual({
      status: 'ready',
      studentAccount: {
        studentAccountId: 'student-1',
        schoolEmail: 'student@example.invalid',
        displayName: 'Student',
      },
      currentSchoolYear,
      studentAffiliation,
    })
  })
})

function resolve(
  store: InMemoryPersistenceAdapters,
  token: string | null = sessionToken,
) {
  return resolveStudentOperationalContext({
    sessionToken: token,
    now,
    studentAccountStore: store,
    contextStore: store,
  })
}

async function authenticatedStore() {
  const store = new InMemoryPersistenceAdapters()
  await store.saveStudentAccount({
    studentAccountId: 'student-1',
    schoolEmail: 'student@example.invalid',
    displayName: 'Student',
  })
  await store.saveStudentSession({
    sessionTokenHash: await hashToken(sessionToken),
    studentAccountId: 'student-1',
    createdAt: now - 1,
    expiresAt: now + 1,
    invalidatedAt: null,
  })
  return store
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
