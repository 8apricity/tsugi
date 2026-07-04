import {
  D1VerificationCodeStore,
  InMemoryVerificationCodeStore,
  requestVerificationCode,
  type VerificationCodeStore,
} from './auth'

const verificationCodeStores = new WeakMap<Env, VerificationCodeStore>()

function getVerificationCodeStore(env: Env) {
  if (env.DB) {
    return new D1VerificationCodeStore(env.DB)
  }

  const existingStore = verificationCodeStores.get(env)

  if (existingStore) {
    return existingStore
  }

  const store = new InMemoryVerificationCodeStore()
  verificationCodeStores.set(env, store)

  return store
}

function generateVerificationCode() {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)

  return String(values[0] % 1_000_000).padStart(6, '0')
}

async function sendVerificationCode(env: Env, schoolEmail: string, code: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Jikanwari <no-reply@jikanwari.is-a.dev>',
      to: [schoolEmail],
      subject: 'Jikanwari 確認コード',
      text: `確認コード: ${code}`,
    }),
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (
      url.pathname === '/api/auth/verification-code-requests' &&
      request.method === 'POST'
    ) {
      const body = await request.json<{ schoolEmailNumber?: unknown }>()
      const schoolEmailNumber = body.schoolEmailNumber

      const result = await requestVerificationCode({
        schoolEmailNumber,
        now: Date.now(),
        code: generateVerificationCode(),
        store: getVerificationCodeStore(env),
        sendEmail: ({ schoolEmail, code }) =>
          sendVerificationCode(env, schoolEmail, code),
      })

      if (result.status === 'invalid-school-email-number') {
        return Response.json({ error: "invalid_school_email_number" }, { status: 400 })
      }

      if (result.status === 'rate-limited') {
        return Response.json({ error: "verification_code_rate_limited" }, { status: 429 })
      }

      return Response.json({ schoolEmail: result.schoolEmail })
    }
    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>;
