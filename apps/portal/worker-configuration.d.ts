/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB?: D1Database
  RESEND_API_KEY: string
}
