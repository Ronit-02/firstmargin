const { hasCapability } = require('./entitlement.service');

const publicPostClause = (now = new Date()) => ({
  publicationStatus: { $ne: 'unpublished' },
  $or: [
    { publicAt: { $lte: now } },
    { publicAt: null },
    { publicAt: { $exists: false } },
  ],
});

const getPostAccessContext = async userId => ({
  userId: userId ? String(userId) : null,
  canUseEarlyAccess: userId ? await hasCapability(userId, 'early_access') : false,
});

const canAccessPost = (post, context, now = new Date()) => {
  if (!post) return false;
  const authorId = post.author?._id || post.author;
  if (context.userId && authorId?.toString() === context.userId) return true;
  if (post.publicationStatus === 'unpublished') return false;
  return !post.publicAt || post.publicAt <= now || context.canUseEarlyAccess;
};

const accessiblePostClause = (context, now = new Date()) => {
  const clauses = [publicPostClause(now)];
  if (context.canUseEarlyAccess) clauses.push({ publicationStatus: { $ne: 'unpublished' } });
  if (context.userId) clauses.push({ author: context.userId });
  return { $or: clauses };
};

module.exports = { publicPostClause, getPostAccessContext, canAccessPost, accessiblePostClause };
