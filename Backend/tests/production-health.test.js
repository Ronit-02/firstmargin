const test = require('node:test');
const assert = require('node:assert/strict');
const { configuredChecks, checkService, runChecks } = require('../../.github/scripts/check-production-health.ts');

const checks = configuredChecks({
  PRODUCTION_FRONTEND_URL: 'https://frontend.example/',
  PRODUCTION_BACKEND_URL: 'https://backend.example',
});
const quiet = { log: () => {} };
const healthy = () => new Response('{"status":"ok"}');

test('production monitor validates origins and uses separate existing health endpoints', () => {
  assert.deepEqual(checks.map(check => check.url), [
    'https://frontend.example/', 'https://backend.example/health', 'https://backend.example/database-status',
  ]);
  for (const value of [undefined, '', 'http://frontend.example', 'https://user:password@frontend.example',
    'https://frontend.example/path', 'https://frontend.example/?secret=value', 'https://frontend.example/#hash']) {
    assert.throws(() => configuredChecks({ PRODUCTION_FRONTEND_URL: value, PRODUCTION_BACKEND_URL: 'https://backend.example' }));
  }
  assert.throws(() => configuredChecks({ PRODUCTION_FRONTEND_URL: 'https://frontend.example' }));
});

test('production monitor uses a one-minute deadline and stops after first healthy response', async () => {
  let deadline;
  const originalTimeout = AbortSignal.timeout;
  // Record the production default without waiting a real minute.
  AbortSignal.timeout = milliseconds => {
    deadline = milliseconds;
    return originalTimeout(milliseconds);
  };
  try {
    const result = await checkService(checks[1], {
      ...quiet,
      fetchImpl: async (_url, options) => {
        assert.equal(options.redirect, 'error');
        assert.equal(options.headers['cache-control'], 'no-cache');
        return healthy();
      },
      wait: () => assert.fail('healthy checks do not retry'),
    });
    assert.equal(deadline, 60_000);
    assert.deepEqual(result, { name: 'Backend', ok: true, attempts: 1 });
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test('production monitor retries network, HTTP and payload failures twice for every component', async () => {
  const failures = [
    async () => { throw new Error('private upstream detail'); },
    async () => new Response('Unavailable', { status: 503 }),
    async () => new Response('not json'),
    async () => new Response('{"status":"error"}'),
    async () => new Response('null'),
    async () => new Response('{}'),
    async () => new Response('redirect', { status: 302 }),
  ];
  for (const check of checks) {
    for (const fetchImpl of failures) {
      const delays = [];
      const logs = [];
      const result = await checkService(check, {
        fetchImpl, wait: async delay => delays.push(delay), log: line => logs.push(line),
      });
      assert.deepEqual(result, { name: check.name, ok: false, attempts: 3 });
      assert.deepEqual(delays, [5000, 5000]);
      assert.equal(logs.length, 3);
      assert.equal(logs.join('').includes('private upstream detail'), false);
      assert.equal(logs.join('').includes(check.url), false);
    }
  }
});

test('production monitor can recover on the second retry', async () => {
  let calls = 0;
  const result = await checkService(checks[2], {
    ...quiet, wait: async () => {},
    fetchImpl: async () => ++calls === 3 ? healthy() : new Response('', { status: 500 }),
  });
  assert.deepEqual(result, { name: 'Database', ok: true, attempts: 3 });
  assert.equal(calls, 3);
});

test('production frontend check rejects generic hosting pages and accepts the app shell', async () => {
  const options = { ...quiet, wait: async () => {} };
  for (const body of ['<html>Welcome</html>', '<title>firstmargin</title>', '<div id="root"></div>']) {
    const result = await checkService(checks[0], {
      ...options, fetchImpl: async () => new Response(body, { headers: { 'content-type': 'text/html' } }),
    });
    assert.equal(result.ok, false);
  }
  const result = await checkService(checks[0], {
    ...options,
    fetchImpl: async () => new Response('<title>firstmargin</title><div id="root"></div>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
  });
  assert.equal(result.ok, true);
});

test('production checks still report backend and database when frontend fails', async () => {
  const results = await runChecks(checks, {
    ...quiet, wait: async () => {}, fetchImpl: async url => url === checks[0].url ? new Response('', { status: 502 }) : healthy(),
  });
  assert.deepEqual(results.map(result => result.ok), [false, true, true]);
});

test('production deadline aborts stalled response headers and bodies before retrying', async () => {
  for (const stalledBody of [false, true]) {
    let calls = 0;
    const result = await checkService(checks[1], {
      ...quiet, timeoutMs: 5, wait: async () => {},
      fetchImpl: async (_url, { signal }) => {
        calls += 1;
        const stalled = () => new Promise((_resolve, reject) => {
          // Keep the test alive while AbortSignal uses an unreferenced deadline timer.
          const keepAlive = setTimeout(() => reject(new Error('deadline did not abort')), 1000);
          signal.addEventListener('abort', () => {
            clearTimeout(keepAlive);
            reject(signal.reason);
          }, { once: true });
        });
        return stalledBody ? { ok: true, text: stalled } : stalled();
      },
    });
    assert.equal(result.ok, false);
    assert.equal(calls, 3);
  }
});
