const [targetArgument, studentAccountId] = process.argv.slice(2)
const target = targetArgument ?? process.env.TSUGI_TARGET_URL
const testLoginSecret = process.env.TEST_LOGIN_SECRET

if (!target || !studentAccountId || !testLoginSecret) {
  console.error(
    'Usage: TEST_LOGIN_SECRET=<secret> node scripts/issue-interactive-test-login-ticket.mjs <target-url> <test-student-account-id>',
  )
  process.exitCode = 1
} else {
  const targetUrl = new URL(target)
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(
    targetUrl.hostname,
  )

  if (targetUrl.protocol !== 'https:' && !isLoopback) {
    throw new Error('Non-loopback ticket issuance requires HTTPS')
  }

  const response = await fetch(new URL('/api/test/login-tickets', targetUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-test-login-secret': testLoginSecret,
    },
    body: JSON.stringify({ studentAccountId }),
    redirect: 'error',
  })

  if (response.status !== 201) {
    throw new Error(`Ticket issuance failed with HTTP ${response.status}`)
  }

  const result = await response.json()

  if (
    typeof result !== 'object' ||
    result === null ||
    typeof result.exchangeUrl !== 'string' ||
    typeof result.expiresAt !== 'number'
  ) {
    throw new Error('Ticket issuer returned an invalid response')
  }

  console.log(`Ticket expires at ${new Date(result.expiresAt).toISOString()}`)
  console.log(result.exchangeUrl)
}
