import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import temporaryDatabase from '../../Backend/tests/support/temporary-database.js'

const requireBackend = createRequire(new URL('../../Backend/package.json', import.meta.url))
const mongoose = requireBackend('mongoose')

test('seeded API writes reach only the database owned by this E2E run', async ({ request }) => {
  const target = { runId: process.env.FIRSTMARGIN_TEST_RUN_ID, name: process.env.DB_NAME, uri: process.env.MONGO_URI }
  temporaryDatabase.assertTemporaryDatabase(target)
  const connection = await mongoose.createConnection(target.uri, { serverSelectionTimeoutMS: 5000 }).asPromise()
  try {
    expect(await connection.db.collection('_test_run').findOne({ _id: target.runId })).toBeTruthy()
    const login = await request.post(`${process.env.VITE_API_URL}/api/auth/login`, {
      data: { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD },
    })
    expect(login.status()).toBe(200)
    const { token } = await login.json()
    const title = `Isolated E2E draft ${target.runId}`
    const created = await request.post(`${process.env.VITE_API_URL}/api/drafts`, {
      headers: { authorization: `Bearer ${token}` },
      data: { title, blocks: [{ id: 'isolated-block', type: 'text', content: 'Temporary test content.' }], tags: [] },
    })
    expect(created.status()).toBe(201)
    const { data } = await created.json()
    const stored = await connection.db.collection('drafts').findOne({ _id: new mongoose.Types.ObjectId(data.id) })
    expect(stored?.title).toBe(title)
  } finally {
    await connection.close()
  }
})
