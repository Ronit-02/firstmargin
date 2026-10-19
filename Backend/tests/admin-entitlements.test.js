const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../schemas/user.schema');
const Membership = require('../schemas/membership.schema');
const Entitlement = require('../schemas/entitlement.schema');
const { getCapabilities } = require('../services/entitlement.service');

test('admin receives member capabilities without a paid membership', async () => {
  const original = { user: User.findById, membership: Membership.findOne, grants: Entitlement.find };
  User.findById = () => ({ select: async () => ({ role: 'admin' }) });
  Membership.findOne = () => ({ select: async () => null });
  Entitlement.find = () => ({ select: async () => [] });
  try {
    const result = await getCapabilities('admin-user');
    assert.deepEqual(result.capabilities, [...Entitlement.capabilities].sort());
    assert.equal(result.membership.status, 'active');
  } finally {
    User.findById = original.user;
    Membership.findOne = original.membership;
    Entitlement.find = original.grants;
  }
});
