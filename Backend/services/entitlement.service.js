const Entitlement = require('../schemas/entitlement.schema');
const Membership = require('../schemas/membership.schema');
const User = require('../schemas/user.schema');

const membershipCapabilities = new Set(Entitlement.capabilities);

const getCapabilities = async userId => {
  const now = new Date();
  const [membership, grants, user] = await Promise.all([
    Membership.findOne({ userId }).select('plan status currentPeriodEnd cancelAtPeriodEnd'),
    Entitlement.find({
      userId,
      startsAt: { $lte: now },
      revokedAt: null,
      $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
    }).select('capability endsAt source'),
    User.findById(userId).select('role'),
  ]);
  const membershipActive = membership
    && ['active', 'trialing'].includes(membership.status)
    && (!membership.currentPeriodEnd || membership.currentPeriodEnd > now);
  const legacyPremium = ['premium', 'exclusive-writer', 'admin'].includes(user?.role);
  const capabilities = new Set(grants.map(grant => grant.capability));
  if (membershipActive || legacyPremium) {
    for (const capability of membershipCapabilities) capabilities.add(capability);
  }
  return {
    capabilities: [...capabilities].sort(),
    membership: membership ? {
      plan: membership.plan,
      status: membership.status,
      currentPeriodEnd: membership.currentPeriodEnd,
      cancelAtPeriodEnd: membership.cancelAtPeriodEnd,
    } : { plan: legacyPremium ? 'member' : 'free', status: legacyPremium ? 'active' : 'inactive', currentPeriodEnd: null, cancelAtPeriodEnd: false },
  };
};

const hasCapability = async (userId, capability) => {
  if (!Entitlement.capabilities.includes(capability)) return false;
  const result = await getCapabilities(userId);
  return result.capabilities.includes(capability);
};

module.exports = { getCapabilities, hasCapability, membershipCapabilities };
