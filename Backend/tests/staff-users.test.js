const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.FRONTEND_URL ||= 'http://localhost:3000';
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/ink-rider-test';
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');

const mongoose = require('mongoose');
const User = require('../schemas/user.schema');
const RoleChange = require('../schemas/role-change.schema');
const { listUsers, changeUserRole } = require('../controllers/staff-users.controller');

const id = '507f1f77bcf86cd799439011';
const actorId = '507f1f77bcf86cd799439012';
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } });

test('staff list validates role and bounds pagination', async () => {
  assert.equal((await listUsers({ query: { role: 'owner' } }, response())).statusCode, 400);
  assert.equal((await listUsers({ query: { page: '-1' } }, response())).statusCode, 400);
  assert.equal((await listUsers({ query: { page: '1.5' } }, response())).statusCode, 400);
});

test('role-change records accept Member as a source role', async () => {
  const change = new RoleChange({ userId: id, actorId, fromRole: 'premium', toRole: 'moderator' });
  await change.validate();
});

test('staff list returns only account directory fields', async t => {
  const calls = [];
  t.mock.method(User, 'find', filter => {
    calls.push(filter);
    return { select(fields) { calls.push(fields); return this }, sort() { return this }, skip() { return this }, limit() { return this }, async lean() { return [{ _id: id, username: 'Reader', email: 'reader@example.test', role: 'regular', password: 'secret' }] } };
  });
  t.mock.method(User, 'countDocuments', async () => 1);
  const res = response();
  await listUsers({ query: { role: 'regular' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls[0], { role: 'regular' });
  assert.doesNotMatch(calls[1], /password/);
  assert.deepEqual(res.body.data, [{ id, username: 'Reader', email: 'reader@example.test', picture: undefined, role: 'regular', accountStatus: 'active', createdAt: undefined }]);
  assert.equal(res.body.meta.total, 1);
});

test('role changes reject unsupported roles and transitions', async t => {
  const req = { params: { userId: id }, body: { role: 'admin' }, auth: { userId: actorId } };
  assert.equal((await changeUserRole(req, response())).statusCode, 400);
  req.body.role = 'regular';
  t.mock.method(User, 'findById', () => ({ select: async () => ({ role: 'premium', accountStatus: 'active' }) }));
  assert.equal((await changeUserRole(req, response())).statusCode, 409);
  req.params.userId = actorId;
  assert.equal((await changeUserRole(req, response())).statusCode, 403);
});

test('promotion updates the expected role and writes an audit record together', async t => {
  const calls = [];
  t.mock.method(User, 'findById', () => ({ select: async () => ({ role: 'regular', accountStatus: 'active' }) }));
  t.mock.method(mongoose, 'startSession', async () => ({ async withTransaction(callback) { await callback() }, async endSession() {} }));
  t.mock.method(User, 'findOneAndUpdate', async (filter, update) => { calls.push({ filter, update }); return { _id: id, role: update.$set.role } });
  t.mock.method(RoleChange, 'create', async records => { calls.push({ audit: records[0] }) });
  const res = response();
  await changeUserRole({ params: { userId: id }, body: { role: 'moderator' }, auth: { userId: actorId } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls[0].filter, { _id: id, role: 'regular', accountStatus: { $ne: 'suspended' } });
  assert.deepEqual(calls[1].audit, { userId: id, actorId, fromRole: 'regular', toRole: 'moderator' });
  assert.equal(res.body.data.role, 'moderator');
});

for (const [fromRole, toRole] of [
  ['premium', 'exclusive-writer'],
  ['premium', 'moderator'],
  ['exclusive-writer', 'regular'],
  ['moderator', 'exclusive-writer'],
  ['moderator', 'regular'],
]) {
  test(`${fromRole} can change to ${toRole} with an audit record`, async t => {
    let audit;
    t.mock.method(User, 'findById', () => ({ select: async () => ({ role: fromRole, accountStatus: 'active' }) }));
    t.mock.method(mongoose, 'startSession', async () => ({ async withTransaction(callback) { await callback() }, async endSession() {} }));
    t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
      assert.equal(filter.role, fromRole);
      assert.equal(update.$set.role, toRole);
      return { _id: id, role: toRole };
    });
    t.mock.method(RoleChange, 'create', async records => { audit = records[0] });
    const res = response();
    await changeUserRole({ params: { userId: id }, body: { role: toRole }, auth: { userId: actorId } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(audit, { userId: id, actorId, fromRole, toRole });
    assert.equal(res.body.data.role, toRole);
  });
}
