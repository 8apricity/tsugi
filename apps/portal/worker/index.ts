import {
  D1VerificationCodeStore,
  InMemoryVerificationCodeStore,
  logoutStudentSession,
  readStudentSession,
  requestVerificationCode,
  verifyCodeForExistingStudent,
  type StudentAccount,
  type VerificationCodeStore,
} from "./auth";

const verificationCodeStores = new WeakMap<Env, VerificationCodeStore>();
const sessionCookieName = "jikanwari_session";

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

  if (testStudentAccounts) {
    await Promise.all(
      testStudentAccounts.map((studentAccount) =>
        store.saveStudentAccount(studentAccount),
      ),
    );
  }

  verificationCodeStores.set(env, store);

  return store;
}

function generateVerificationCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);

  return String(values[0] % 1_000_000).padStart(6, "0");
}

function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
      from: "Jikanwari <no-reply@jikanwari.is-a.dev>",
      to: [schoolEmail],
      subject: "Jikanwari 認証コード",
      text: `認証コード: ${code}`,
    }),
  });

  if (!response.ok) {
    throw new EmailDeliveryError();
  }
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

function sessionCookie(
  sessionToken: string,
  maxAgeSeconds: number,
  secure: boolean,
) {
  const secureAttribute = secure ? " Secure;" : "";

  return `${sessionCookieName}=${encodeURIComponent(
    sessionToken,
  )}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly;${secureAttribute} SameSite=Lax`;
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

    if (
      url.pathname === "/api/auth/verification-code-requests" &&
      request.method === "POST"
    ) {
      const body = await request.json<{ schoolEmailNumber?: unknown }>();
      const schoolEmailNumber = body.schoolEmailNumber;

      const result = await requestVerificationCode({
        schoolEmailNumber,
        now: Date.now(),
        code: generateVerificationCode(),
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
      const sessionToken = generateSessionToken();
      const result = await verifyCodeForExistingStudent({
        schoolEmailNumber: body.schoolEmailNumber,
        code: body.code,
        now: Date.now(),
        sessionToken,
        store: await getVerificationCodeStore(env),
      });

      if (result.status === "invalid-verification") {
        return Response.json(
          { error: "invalid_verification_code" },
          { status: 400 },
        );
      }

      if (result.status === "new-student") {
        return Response.json({ status: "setup-required" });
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
      const result = await readStudentSession({
        sessionToken: readCookie(request, sessionCookieName),
        now: Date.now(),
        store: await getVerificationCodeStore(env),
      });

      if (result.status === "unauthenticated") {
        return Response.json({ status: "unauthenticated" });
      }

      return Response.json(sessionResponseBody(result.studentAccount));
    }

    if (url.pathname === "/api/auth/session" && request.method === "DELETE") {
      await logoutStudentSession({
        sessionToken: readCookie(request, sessionCookieName),
        now: Date.now(),
        store: await getVerificationCodeStore(env),
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
