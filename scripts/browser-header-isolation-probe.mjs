import { createServer } from 'node:http'

const HOST = '127.0.0.1'
const PORT = 41783
const HEADER_NAME = 'x-test-login-secret'
const SENTINEL = 'TSUGI_DUMMY_HEADER_SENTINEL_45_20260717'

let receipt = {
  headerMatched: false,
  requestCount: 0,
  userAgent: null,
}

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="referrer" content="no-referrer">
    <title>Tsugi Browser header isolation probe</title>
  </head>
  <body>
    <h1>Tsugi Browser header isolation probe</h1>
    <pre id="result">Running…</pre>
    <script>
      const headerName = ${JSON.stringify(HEADER_NAME)};
      const sentinel = ${JSON.stringify(SENTINEL)};
      const result = document.querySelector('#result');

      const inspectStorageSignals = async () => {
        const containsSentinel = (storage) =>
          Object.keys(storage).some((key) =>
            key.includes(sentinel) || String(storage.getItem(key)).includes(sentinel));

        const indexedDatabaseNames = 'databases' in indexedDB
          ? (await indexedDB.databases()).map((database) => database.name ?? '')
          : [];
        const cacheNames = 'caches' in window ? await caches.keys() : [];

        return {
          cacheStorageNameContainsSentinel:
            cacheNames.some((name) => name.includes(sentinel)),
          pageVisibleCookieContainsSentinel: document.cookie.includes(sentinel),
          indexedDbNameContainsSentinel:
            indexedDatabaseNames.some((name) => name.includes(sentinel)),
          localStorageKeyOrValueContainsSentinel: containsSentinel(localStorage),
          sessionStorageKeyOrValueContainsSentinel:
            containsSentinel(sessionStorage),
        };
      };

      fetch('/receive', {
        headers: { [headerName]: sentinel },
        cache: 'no-store',
      })
        .then((response) => response.json())
        .then(async (receiver) => {
          result.textContent = JSON.stringify({
            receiver,
            pageJavaScriptCanReadSentinel: sentinel.length > 0,
            domSourceContainsSentinel:
              document.documentElement.innerHTML.includes(sentinel),
            urlContainsSentinel: location.href.includes(sentinel),
            storageSignals: await inspectStorageSignals(),
          }, null, 2);
        })
        .catch((error) => {
          result.textContent = JSON.stringify({ error: error.message });
        });
    </script>
  </body>
</html>`

const server = createServer((request, response) => {
  response.setHeader('cache-control', 'no-store')
  response.setHeader('referrer-policy', 'no-referrer')

  if (request.url === '/') {
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end(page)
    return
  }

  if (request.url === '/receive') {
    receipt = {
      headerMatched: request.headers[HEADER_NAME] === SENTINEL,
      requestCount: receipt.requestCount + 1,
      userAgent: request.headers['user-agent'] ?? null,
    }
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(receipt))
    return
  }

  if (request.url === '/evidence') {
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({
      headerName: HEADER_NAME,
      ...receipt,
    }))
    return
  }

  response.statusCode = 404
  response.end('Not found')
})

server.listen(PORT, HOST, () => {
  console.log(`Dummy-only receiver: http://${HOST}:${PORT}/`)
  console.log(`Machine-readable evidence: http://${HOST}:${PORT}/evidence`)
  console.log('Press Ctrl+C to stop.')
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
