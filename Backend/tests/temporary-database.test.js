const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createTemporaryDatabase, assertTemporaryDatabase, createTestEnvironment, prepareTemporaryDatabase, dropTemporaryDatabase } = require('./support/temporary-database');

test('temporary targets are unique and never inherit the application database', () => {
  const first = createTemporaryDatabase();
  const second = createTemporaryDatabase();
  assert.notEqual(first.name, second.name);
  assert.ok(first.name.includes('-test-'));
  const env = createTestEnvironment(first, {
    MONGO_URI: 'mongodb://example.invalid/development', DB_NAME: 'development',
    NODE_ENV: 'production', EMAIL_PASSWORD: 'unused-fixture', E2E_PASSWORD: 'old-fixture',
  });
  assert.equal(env.MONGO_URI, first.uri);
  assert.equal(env.DB_NAME, first.name);
  assert.equal(env.NODE_ENV, 'test');
  assert.equal(env.EMAIL_PASSWORD, '');
  assert.equal(env.E2E_PASSWORD, env.SEED_PASSWORD);
  assert.notEqual(env.E2E_PASSWORD, 'old-fixture');
});

test('database selection rejects development paths, remote hosts, credentials and URI options', () => {
  for (const server of [
    'mongodb://127.0.0.1:27017/development', 'mongodb://127.0.0.1:27017/test',
    'mongodb+srv://example.invalid', 'mongodb://example.invalid:27017',
    'mongodb://user:password@127.0.0.1:27017', 'mongodb://127.0.0.1:27017/?authSource=development',
    'mongodb://127.0.0.1:99999', 'mongodb://127.0.0.1:27017,example.invalid:27017',
  ]) assert.throws(() => createTemporaryDatabase('e2e', server), /loopback/);
  assert.doesNotThrow(() => createTemporaryDatabase('e2e', 'mongodb://[::1]:27018/'));
});

function fakeConnection(target, { existing = false, owner = target.runId } = {}) {
  const calls = [];
  return {
    name: target.name, calls,
    db: {
      listCollections: () => ({ toArray: async () => existing ? [{ name: 'users' }] : [] }),
      collection: name => {
        assert.equal(name, '_test_run');
        return {
          insertOne: async record => { calls.push(['claim', record._id]); },
          findOne: async filter => owner === filter._id ? { _id: owner } : null,
        };
      },
    },
    dropDatabase: async () => { calls.push(['drop']); },
  };
}

test('preflight refuses a populated database before seeding or claiming ownership', async () => {
  const target = createTemporaryDatabase();
  const connection = fakeConnection(target, { existing: true });
  await assert.rejects(prepareTemporaryDatabase(connection, target), /existing database/);
  assert.deepEqual(connection.calls, []);
});

test('cleanup drops only the exact owned database and rejects changed identities', async () => {
  const target = createTemporaryDatabase();
  const connection = fakeConnection(target);
  await prepareTemporaryDatabase(connection, target);
  await dropTemporaryDatabase(connection, target);
  assert.deepEqual(connection.calls, [['claim', target.runId], ['drop']]);
  for (const name of ['development', 'production', createTemporaryDatabase().name]) {
    const wrongConnection = fakeConnection(target);
    wrongConnection.name = name;
    await assert.rejects(dropTemporaryDatabase(wrongConnection, target), /does not match/);
    assert.deepEqual(wrongConnection.calls, []);
  }
  const unowned = fakeConnection(target, { owner: 'another-run' });
  await assert.rejects(dropTemporaryDatabase(unowned, target), /ownership marker/);
  assert.deepEqual(unowned.calls, []);
  assert.throws(() => assertTemporaryDatabase({ ...target, uri: `mongodb://example.invalid:27017/${target.name}` }), /non-loopback/);
  assert.throws(() => assertTemporaryDatabase({ ...target, name: 'development' }), /not generated/);
});

test('direct Playwright invocation cannot attach to an ambient development database', () => {
  const config = path.resolve(__dirname, '../../Frontend/playwright.config.js');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', 'await import(process.argv[1])', pathToFileURL(config).href], {
    env: { ...process.env, FIRSTMARGIN_TEST_RUN_ID: '', E2E_BASE_URL: '', DB_NAME: 'development', MONGO_URI: 'mongodb://127.0.0.1:27017/development' },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not generated for this test run/);
});

test('existing-server shortcut is rejected even with a valid temporary target', () => {
  const target = createTemporaryDatabase();
  const runner = path.resolve(__dirname, '../../Frontend/scripts/run-e2e.js');
  const result = spawnSync(process.execPath, [runner], {
    env: { ...createTestEnvironment(target), E2E_BASE_URL: 'http://127.0.0.1:3000' }, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /E2E_BASE_URL is disabled/);
});

test('an unavailable test service fails without seeding or falling back to the application database', () => {
  const runner = path.resolve(__dirname, '../../Frontend/scripts/run-e2e.js');
  const result = spawnSync(process.execPath, [runner], {
    env: { ...process.env, E2E_BASE_URL: '', E2E_MONGO_SERVER: 'mongodb://127.0.0.1:1', MONGO_URI: 'mongodb://example.invalid/development', DB_NAME: 'development' },
    encoding: 'utf8', timeout: 15000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E2E run failed/);
  assert.doesNotMatch(result.stdout, /Development catalog validated|E2E temporary database:/);
  assert.doesNotMatch(result.stderr, /example\.invalid/);
});
