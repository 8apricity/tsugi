import {
  D1VerificationCodeStore,
  InMemoryVerificationCodeStore,
  type SchoolYearClassRecord,
  type SchoolYearRecord,
  type StandardTimetableEntry,
  type StudentAffiliation,
  type StudentAccount,
  type TrackRecord,
  type VerificationCodeStore,
} from "./auth";
import { readDailyPlan, readDailyPlansRange } from "./dailyPlan";
import { createStudentAccountAccess } from "./studentAccountAccess";

const verificationCodeStores = new WeakMap<Env, VerificationCodeStore>();
const sessionCookieName = "tsugi_session";
const setupSessionCookieName = "tsugi_setup";

class EmailDeliveryError extends Error {
  constructor() {
    super("Verification code delivery failed");
  }
}

async function getVerificationCodeStore(env: Env) {
  if (env.DB) {
    return new D1VerificationCodeStore(env.DB);
  }

  const existingStore = verificationCodeStores.get(env);

  if (existingStore) {
    return existingStore;
  }

  const store = new InMemoryVerificationCodeStore();
  const testStudentAccounts = (
    env as Env & { TEST_STUDENT_ACCOUNTS?: StudentAccount[] }
  ).TEST_STUDENT_ACCOUNTS;
  const testSchoolStructure = (
    env as Env & {
      TEST_SCHOOL_STRUCTURE?: {
        schoolYears: SchoolYearRecord[];
        classes: SchoolYearClassRecord[];
        tracks: TrackRecord[];
      };
    }
  ).TEST_SCHOOL_STRUCTURE;
  const testStudentAffiliations = (
    env as Env & { TEST_STUDENT_AFFILIATIONS?: StudentAffiliation[] }
  ).TEST_STUDENT_AFFILIATIONS;
  const testStandardTimetableEntries = (
    env as Env & { TEST_STANDARD_TIMETABLE_ENTRIES?: StandardTimetableEntry[] }
  ).TEST_STANDARD_TIMETABLE_ENTRIES;

  if (testStudentAccounts) {
    await Promise.all(
      testStudentAccounts.map((studentAccount) =>
        store.saveStudentAccount(studentAccount),
      ),
    );
  }

  if (testSchoolStructure) {
    await Promise.all(
      testSchoolStructure.schoolYears.map((schoolYear) =>
        store.saveSchoolYear(schoolYear),
      ),
    );
    await Promise.all(
      testSchoolStructure.classes.map((schoolClass) =>
        store.saveSchoolYearClass(schoolClass),
      ),
    );
    await Promise.all(
      testSchoolStructure.tracks.map((track) => store.saveTrack(track)),
    );
  }

  if (testStudentAffiliations) {
    await Promise.all(
      testStudentAffiliations.map((studentAffiliation) =>
        store.saveStudentAffiliation(studentAffiliation),
      ),
    );
  }

  if (testStandardTimetableEntries) {
    await Promise.all(
      testStandardTimetableEntries.map((standardTimetableEntry) =>
        store.saveStandardTimetableEntry(standardTimetableEntry),
      ),
    );
  }

  verificationCodeStores.set(env, store);

  return store;
}

async function sendVerificationCode(
  env: Env,
  schoolEmail: string,
  code: string,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Tsugi <no-reply@jikanwari.is-a.dev>",
      to: [schoolEmail],
      subject: "Tsugi 認証コード",
      text: `認証コード: ${code}`,
    }),
  });

  if (!response.ok) {
    throw new EmailDeliveryError();
  }
}

async function getStudentAccountAccess(env: Env) {
  return createStudentAccountAccess({
    store: await getVerificationCodeStore(env),
    sendEmail: async ({ schoolEmail, code }) => {
      try {
        await sendVerificationCode(env, schoolEmail, code);
      } catch (error) {
        if (error instanceof EmailDeliveryError) {
          throw error;
        }

        throw new EmailDeliveryError();
      }
    },
  });
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function httpOnlyCookie(
  name: string,
  sessionToken: string,
  maxAgeSeconds: number,
  secure: boolean,
) {
  const secureAttribute = secure ? " Secure;" : "";

  return `${name}=${encodeURIComponent(
    sessionToken,
  )}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly;${secureAttribute} SameSite=Lax`;
}

function sessionCookie(sessionToken: string, maxAgeSeconds: number, secure: boolean) {
  return httpOnlyCookie(sessionCookieName, sessionToken, maxAgeSeconds, secure);
}

function setupSessionCookie(
  setupSessionToken: string,
  maxAgeSeconds: number,
  secure: boolean,
) {
  return httpOnlyCookie(
    setupSessionCookieName,
    setupSessionToken,
    maxAgeSeconds,
    secure,
  );
}

function sessionResponseBody(studentAccount: {
  schoolEmail: string;
  displayName: string;
}) {
  return {
    status: "authenticated",
    studentAccount: {
      schoolEmail: studentAccount.schoolEmail,
      displayName: studentAccount.displayName,
    },
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/test/login" && request.method === "POST") {
      if (
        env.TEST_LOGIN_ENABLED !== "true" ||
        !env.TEST_LOGIN_SECRET ||
        request.headers.get("x-test-login-secret") !== env.TEST_LOGIN_SECRET
      ) {
        return new Response(null, { status: 404 });
      }

      const body = await request.json<{ studentAccountId?: unknown }>();
      const result = await (
        await getStudentAccountAccess(env)
      ).createTestLoginSession({
        studentAccountId: body.studentAccountId,
        now: Date.now(),
      });

      if (result.status === "not-found") {
        return new Response(null, { status: 404 });
      }

      return Response.json(
        {
          ...sessionResponseBody(result.studentAccount),
          testLogin: true,
        },
        {
          headers: {
            "set-cookie": sessionCookie(
              result.sessionToken,
              30 * 24 * 60 * 60,
              url.protocol === "https:",
            ),
          },
        },
      );
    }

    if (
      url.pathname === "/api/auth/verification-code-requests" &&
      request.method === "POST"
    ) {
      const body = await request.json<{ schoolEmailNumber?: unknown }>();
      const schoolEmailNumber = body.schoolEmailNumber;

      const result = await (
        await getStudentAccountAccess(env)
      ).requestVerificationCode({
        schoolEmailNumber,
        now: Date.now(),
      }).catch((error: unknown) => {
        if (error instanceof EmailDeliveryError) {
          return { status: "delivery-failed" } as const;
        }

        throw error;
      });

      if (result.status === "invalid-school-email-number") {
        return Response.json(
          { error: "invalid_school_email_number" },
          { status: 400 },
        );
      }

      if (result.status === "rate-limited") {
        return Response.json(
          { error: "verification_code_rate_limited" },
          { status: 429 },
        );
      }

      if (result.status === "delivery-failed") {
        return Response.json(
          { error: "verification_code_delivery_failed" },
          { status: 502 },
        );
      }

      return Response.json({ schoolEmail: result.schoolEmail });
    }

    if (
      url.pathname === "/api/auth/verification-code-verifications" &&
      request.method === "POST"
    ) {
      const body = await request.json<{
        schoolEmailNumber?: unknown;
        code?: unknown;
      }>();
      const result = await (await getStudentAccountAccess(env)).verifyCode({
        schoolEmailNumber: body.schoolEmailNumber,
        code: body.code,
        now: Date.now(),
      });

      if (result.status === "invalid-verification") {
        return Response.json(
          { error: "invalid_verification_code" },
          { status: 400 },
        );
      }

      if (result.status === "new-student") {
        return Response.json(
          {
            status: "setup-required",
            schoolEmail: result.schoolEmail,
          },
          {
            headers: {
              "set-cookie": setupSessionCookie(
                result.setupSessionToken,
                30 * 60,
                url.protocol === "https:",
              ),
            },
          },
        );
      }

      return Response.json(sessionResponseBody(result.studentAccount), {
        headers: {
          "set-cookie": sessionCookie(
            result.sessionToken,
            30 * 24 * 60 * 60,
            url.protocol === "https:",
          ),
        },
      });
    }

    if (url.pathname === "/api/auth/session" && request.method === "GET") {
      const result = await (
        await getStudentAccountAccess(env)
      ).readStudentSession({
        sessionToken: readCookie(request, sessionCookieName),
        now: Date.now(),
      });

      if (result.status === "unauthenticated") {
        return Response.json({ status: "unauthenticated" });
      }

      return Response.json(sessionResponseBody(result.studentAccount));
    }

    if (url.pathname === "/api/daily-plan" && request.method === "GET") {
      const result = await readDailyPlan({
        sessionToken: readCookie(request, sessionCookieName),
        schoolDate: url.searchParams.get("date"),
        now: Date.now(),
        store: await getVerificationCodeStore(env),
      });

      if (result.status === "unauthenticated") {
        return Response.json({ status: "unauthenticated" }, { status: 401 });
      }

      if (result.status === "invalid-date") {
        return Response.json(result, { status: 400 });
      }

      if (result.status === "affiliation-renewal-needed") {
        return Response.json(result, { status: 409 });
      }

      if (result.status === "daily-plan-unavailable") {
        return Response.json(result, { status: 503 });
      }

      return Response.json(result);
    }

    if (url.pathname === "/api/daily-plans" && request.method === "GET") {
      const result = await readDailyPlansRange({
        sessionToken: readCookie(request, sessionCookieName),
        start: url.searchParams.get("start"),
        end: url.searchParams.get("end"),
        now: Date.now(),
        store: await getVerificationCodeStore(env),
      });

      if (result.status === "unauthenticated") {
        return Response.json({ status: "unauthenticated" }, { status: 401 });
      }

      if (result.status === "invalid-date") {
        return Response.json(result, { status: 400 });
      }

      if (result.status === "date-range-too-large") {
        return Response.json(result, { status: 400 });
      }

      if (result.status === "affiliation-renewal-needed") {
        return Response.json(result, { status: 409 });
      }

      if (result.status === "daily-plan-unavailable") {
        return Response.json(result, { status: 503 });
      }

      return Response.json(result);
    }

    if (url.pathname === "/api/auth/setup-session" && request.method === "GET") {
      const result = await (
        await getStudentAccountAccess(env)
      ).readSetupSession({
        setupSessionToken: readCookie(request, setupSessionCookieName),
        now: Date.now(),
      });

      return Response.json(result);
    }

    if (url.pathname === "/api/auth/initial-setup" && request.method === "GET") {
      const result = await (
        await getStudentAccountAccess(env)
      ).getInitialSetupOptions({
        setupSessionToken: readCookie(request, setupSessionCookieName),
        now: Date.now(),
      });

      return Response.json(result, {
        status: result.status === "ready" ? 200 : 400,
      });
    }

    if (
      url.pathname === "/api/auth/initial-setup" &&
      request.method === "POST"
    ) {
      const body = await request.json<{
        displayName?: unknown;
        realName?: unknown;
        trackId?: unknown;
        confirmed?: unknown;
      }>();
      const result = await (
        await getStudentAccountAccess(env)
      ).completeInitialSetup({
        setupSessionToken: readCookie(request, setupSessionCookieName),
        displayName: body.displayName,
        realName: body.realName,
        trackId: body.trackId,
        confirmed: body.confirmed,
        now: Date.now(),
      });

      if (result.status === "authenticated") {
        const headers = new Headers();
        headers.append(
          "set-cookie",
          sessionCookie(
            result.sessionToken,
            30 * 24 * 60 * 60,
            url.protocol === "https:",
          ),
        );
        headers.append(
          "set-cookie",
          setupSessionCookie("", 0, url.protocol === "https:"),
        );

        return Response.json(sessionResponseBody(result.studentAccount), {
          headers,
        });
      }

      return Response.json(result, { status: 400 });
    }

    if (url.pathname === "/api/auth/session" && request.method === "DELETE") {
      await (await getStudentAccountAccess(env)).logoutStudentSession({
        sessionToken: readCookie(request, sessionCookieName),
        now: Date.now(),
      });

      return new Response(null, {
        status: 204,
        headers: {
          "set-cookie": sessionCookie("", 0, url.protocol === "https:"),
        },
      });
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
