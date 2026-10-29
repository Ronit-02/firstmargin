const { randomUUID, randomBytes } = require('node:crypto');

const serverPattern = /^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\]):([1-9]\d{0,4})\/?$/;
const runPattern = /^[a-f0-9]{32}$/;

function createTemporaryDatabase(kind = 'e2e', server = process.env.E2E_MONGO_SERVER || 'mongodb://127.0.0.1:27017') {
  const match = serverPattern.exec(server);
  if (!match || Number(match[2]) > 65535 || !['e2e', 'integration'].includes(kind)) {
    throw new Error('Tests require E2E_MONGO_SERVER to be a loopback MongoDB server with a port and no database, credentials, or options');
  }
  const runId = randomUUID().replaceAll('-', '');
  const name = `firstmargin-${kind}-test-${runId}`;
  return Object.freeze({ runId, name, uri: `${server.replace(/\/$/, '')}/${name}` });
}

function assertTemporaryDatabase(target, connection) {
  if (!runPattern.test(target.runId) || !['e2e', 'integration'].some(kind => target.name === `firstmargin-${kind}-test-${target.runId}`)) {
    throw new Error('Refusing a database not generated for this test run');
  }
  const server = target.uri.slice(0, -(target.name.length + 1));
  if (!serverPattern.test(server) || Number(serverPattern.exec(server)[2]) > 65535 || target.uri !== `${server}/${target.name}`) {
    throw new Error('Refusing a non-loopback or mismatched test database URI');
  }
  if (connection && connection.name !== target.name) throw new Error('Connected database does not match this test run');
}

function createTestEnvironment(target, inherited = process.env) {
  assertTemporaryDatabase(target);
  const env = {
    ...inherited,
    NODE_ENV: 'test',
    MONGO_URI: target.uri,
    DB_NAME: target.name,
    MONGO_HOST: '', MONGO_USERNAME: '', MONGO_PASSWORD: '',
    FIRSTMARGIN_TEST_RUN_ID: target.runId,
    PORT: '8000',
    FRONTEND_URL: 'http://127.0.0.1:3000',
    VITE_API_URL: 'http://127.0.0.1:8000',
    JWT_SECRET: randomBytes(32).toString('hex'),
    COOKIE_SECURE: 'false', COOKIE_SAME_SITE: 'lax', TRUST_PROXY: '', RATE_LIMIT_BACKEND: 'memory',
  };
  // Empty values also prevent dotenv from filling these from Backend/.env.
  for (const key of [
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
    'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_SECURE', 'EMAIL', 'EMAIL_PASSWORD',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_MEMBERSHIP_PRICE_ID',
    'OPENAI_API_KEY', 'ERROR_MONITOR_URL', 'PUSH_PROVIDER_URL', 'PUSH_PROVIDER_TOKEN',
    'VITE_GOOGLE_CLIENT_ID',
  ]) env[key] = '';
  // The seeded account and the browser must always use the same run-owned password.
  env.SEED_PASSWORD = randomBytes(24).toString('hex');
  env.E2E_PASSWORD = env.SEED_PASSWORD;
  env.E2E_EMAIL = 'noah@inkrider.local';
  return env;
}

async function prepareTemporaryDatabase(connection, target) {
  assertTemporaryDatabase(target, connection);
  if ((await connection.db.listCollections({}, { nameOnly: true }).toArray()).length) {
    throw new Error('Refusing to seed an existing database');
  }
  await connection.db.collection('_test_run').insertOne({ _id: target.runId });
}

async function dropTemporaryDatabase(connection, target) {
  assertTemporaryDatabase(target, connection);
  const owner = await connection.db.collection('_test_run').findOne({ _id: target.runId });
  if (!owner) throw new Error('Refusing to drop a database without this test run ownership marker');
  await connection.dropDatabase();
}

module.exports = { createTemporaryDatabase, assertTemporaryDatabase, createTestEnvironment, prepareTemporaryDatabase, dropTemporaryDatabase };
