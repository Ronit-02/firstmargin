const { appendFile } = require('node:fs/promises');
const { setTimeout: sleep } = require('node:timers/promises');

type Check = Readonly<{ name: string; url: string; format: 'html' | 'json' }>;
type Result = Readonly<{ name: string; ok: boolean; attempts: number }>;
type Options = Readonly<{
  fetchImpl?: typeof fetch;
  wait?: (milliseconds: number) => Promise<unknown>;
  timeoutMs?: number;
  log?: (message: string) => void;
}>;

function productionOrigin(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Set the ${name} repository variable.`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query or fragment.`);
  }
  return url.origin;
}

function configuredChecks(env: Readonly<Record<string, string | undefined>>): Check[] {
  const frontend = productionOrigin(env.PRODUCTION_FRONTEND_URL, 'PRODUCTION_FRONTEND_URL');
  const backend = productionOrigin(env.PRODUCTION_BACKEND_URL, 'PRODUCTION_BACKEND_URL');
  return [
    { name: 'Frontend', url: `${frontend}/`, format: 'html' },
    { name: 'Backend', url: `${backend}/health`, format: 'json' },
    { name: 'Database', url: `${backend}/database-status`, format: 'json' },
  ];
}

async function checkService(check: Check, options: Options = {}): Promise<Result> {
  const { fetchImpl = fetch, wait = sleep, timeoutMs = 60_000, log = console.log } = options;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(check.url, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
        headers: { 'cache-control': 'no-cache', 'user-agent': 'firstmargin-production-health' },
      });
      // Reading the body shares the request deadline, including a stalled body.
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error('Unhealthy HTTP status');
      }
      const body = await response.text();
      if (check.format === 'html') {
        if (!response.headers.get('content-type')?.includes('text/html') ||
            !/<title>firstmargin<\/title>/i.test(body) || !/id=["']root["']/.test(body)) {
          throw new Error('Unexpected frontend document');
        }
      } else {
        const payload: unknown = JSON.parse(body);
        if (typeof payload !== 'object' || payload === null || !('status' in payload) || payload.status !== 'ok') {
          throw new Error('Unhealthy response');
        }
      }
      log(`${check.name}: healthy (attempt ${attempt}/3)`);
      return { name: check.name, ok: true, attempts: attempt };
    } catch {
      // Never print response bodies, configured URLs or raw provider errors.
      log(`${check.name}: failed (attempt ${attempt}/3)`);
      if (attempt < 3) await wait(5_000);
    }
  }
  return { name: check.name, ok: false, attempts: 3 };
}

async function runChecks(checks: ReadonlyArray<Check>, options: Options = {}): Promise<Result[]> {
  // Every component gets a result even when another component is down.
  return Promise.all(checks.map(check => checkService(check, options)));
}

async function main(): Promise<void> {
  const results = await runChecks(configuredChecks(process.env));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = results.map(result => `| ${result.name} | ${result.ok ? 'Healthy' : 'Failed'} | ${result.attempts} |`);
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `## Production health\n\n| Component | Status | Attempts |\n| --- | --- | --- |\n${rows.join('\n')}\n`);
  }
  if (results.some(result => !result.ok)) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(() => {
    console.error('Production health monitor could not run. Check both production URL repository variables and the workflow configuration.');
    process.exitCode = 1;
  });
}

module.exports = { configuredChecks, checkService, runChecks };
