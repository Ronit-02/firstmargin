const Follow = require('../schemas/follow.schema');
const User = require('../schemas/user.schema');
const Save = require('../schemas/save.schema');
const { notify } = require('./notification.service');
const { withTransaction, withOptionalSession } = require('../utils/transaction');

const notifyFollow = ({ followerId, followingId }) => notify({
  recipientId: followingId, actorId: followerId, type: 'user_followed',
  title: 'You have a new follower', body: 'Someone started following you.',
  href: '/profile', entityType: 'user', entityId: followingId,
});

const toggleFollow = async ({ followerId, followingId }) => {
  const result = await withTransaction(async session => {
    const options = session ? { session } : undefined;
    const existing = await withOptionalSession(Follow.findOne({ followerId, followingId }), session);
    if (existing) {
      await Follow.deleteOne({ _id: existing._id }, options);
      await User.updateOne({ _id: followerId, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }, options);
      await User.updateOne({ _id: followingId, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } }, options);
      const target = await withOptionalSession(User.findById(followingId).select('followersCount'), session);
      return { following: false, followersCount: target?.followersCount || 0 };
    }
    await Follow.create([{ followerId, followingId }], options);
    await User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }, options);
    await User.updateOne({ _id: followingId }, { $inc: { followersCount: 1 } }, options);
    const target = await withOptionalSession(User.findById(followingId).select('followersCount'), session);
    return { following: true, followersCount: target?.followersCount || 0 };
  });
  if (result.following) await notifyFollow({ followerId, followingId });
  return result;
};

const toggleSave = ({ userId, publicationId }) => withTransaction(async session => {
  const options = session ? { session } : undefined;
  const existing = await withOptionalSession(Save.findOne({ userId, publicationId }), session);
  if (existing) {
    await Save.deleteOne({ _id: existing._id }, options);
    return { isBookmarked: false };
  }
  await Save.create([{ userId, publicationId }], options);
  return { isBookmarked: true };
});

module.exports = { toggleFollow, toggleSave, notifyFollow };
