import type {
  SchoolYearRecord,
  StudentAccount,
  StudentAccountAccessStore,
  StudentAffiliation,
} from './persistence'
import { readStudentSession } from './studentAccountAccess'

export type StudentOperationalContextStore = {
  findCurrentSchoolYear(): Promise<SchoolYearRecord | null>
  findCurrentStudentAffiliation(
    studentAccountId: string,
    schoolYear: number,
  ): Promise<StudentAffiliation | null>
}

export type StudentOperationalContextResult =
  | {
      status: 'ready'
      studentAccount: StudentAccount
      currentSchoolYear: SchoolYearRecord
      studentAffiliation: StudentAffiliation
    }
  | { status: 'unauthenticated' }
  | { status: 'school-year-unavailable' }
  | {
      status: 'affiliation-renewal-needed'
      currentSchoolYear: SchoolYearRecord
    }

export async function resolveStudentOperationalContext({
  sessionToken,
  now,
  studentAccountStore,
  contextStore,
}: {
  sessionToken: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  contextStore: StudentOperationalContextStore
}): Promise<StudentOperationalContextResult> {
  const session = await readStudentSession({
    sessionToken,
    now,
    store: studentAccountStore,
  })
  if (session.status === 'unauthenticated') return session

  const currentSchoolYear = await contextStore.findCurrentSchoolYear()
  if (!currentSchoolYear) return { status: 'school-year-unavailable' }

  const studentAffiliation = await contextStore.findCurrentStudentAffiliation(
    session.studentAccount.studentAccountId,
    currentSchoolYear.schoolYear,
  )
  if (!studentAffiliation) {
    return {
      status: 'affiliation-renewal-needed',
      currentSchoolYear,
    }
  }

  return {
    status: 'ready',
    studentAccount: session.studentAccount,
    currentSchoolYear,
    studentAffiliation,
  }
}
