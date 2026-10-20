const mongoose = require('mongoose');
const Follow = require('../schemas/follow.schema');
const Publication = require('../schemas/publication.schema');
const Profile = require('../schemas/profile.schema');
const User = require('../schemas/user.schema');
const Appreciation = require('../schemas/appreciation.schema');
const Save = require('../schemas/save.schema');
const { extractText } = require('../services/publication-presenter.service');
const { notifyFollow } = require('../services/user-relationship.service');

const isValidId = id => mongoose.isValidObjectId(id);

const estimateReadTime = body => {
  try {
    const blocks = JSON.parse(body);
    const words = blocks.reduce((count, block) => (
      count + String(block.content || '').trim().split(/\s+/).filter(Boolean).length
    ), 0);
    return `${Math.max(1, Math.ceil(words / 200))} min read`;
  } catch {
    return '1 min read';
  }
};

const getWriterByHandle = async (req, res) => {
  try {
    const handle = String(req.params.handle || '').trim().toLowerCase();
    if (handle.length < 3 || handle.length > 30 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(handle)) {
      return res.status(400).json({ message: 'Invalid writer handle' });
    }

    const profile = await Profile.findOne({ handle }).populate({
      path: 'userId',
      select: 'followersCount followingCount role createdAt',
    });
    if (!profile?.userId) return res.status(404).json({ message: 'Writer not found' });

    const [posts, following] = await Promise.all([
      Publication.find({ author: profile.userId._id, publicationStatus: { $ne: 'unpublished' }, $or: [{ publicAt: { $lte: new Date() } }, { publicAt: null }, { publicAt: { $exists: false } }] })
        .sort({ createdAt: -1 })
        .select('title format coverImage tags appreciationsCount commentsCount createdAt body'),
      req.auth
        ? Follow.exists({ followerId: req.auth.userId, followingId: profile.userId._id })
        : Promise.resolve(null),
    ]);

    const likes = req.auth
      ? await Appreciation.find({ userId: req.auth.userId, publicationId: { $in: posts.map(post => post._id) } }).select('publicationId').lean()
      : [];
    const likedPostIds = new Set(likes.map(like => like.publicationId.toString()));
    const saves = req.auth
      ? await Save.find({ userId: req.auth.userId, publicationId: { $in: posts.map(post => post._id) } }).select('publicationId').lean()
      : [];
    const savedPostIds = new Set(saves.map(save => save.publicationId.toString()));

    const author = {
      id: profile.userId._id,
      username: profile.displayName,
      picture: profile.avatarUrl,
      handle: profile.handle,
    };

    return res.status(200).json({
      data: {
        id: profile.userId._id,
        handle: profile.handle,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        coverImageUrl: profile.coverImageUrl || null,
        websiteUrl: profile.websiteUrl,
        writerStatus: profile.writerStatus,
        membershipEnabled: profile.membershipEnabled,
        directRequestsEnabled: profile.directRequestsEnabled,
        followersCount: profile.userId.followersCount,
        followingCount: profile.userId.followingCount,
        joinedAt: profile.userId.createdAt,
        isFollowing: Boolean(following),
        isSelf: req.auth?.userId === profile.userId._id.toString(),
        posts: posts.map(post => ({
          id: post._id,
          title: post.title,
          format: post.format || 'story',
          image: post.coverImage,
          excerpt: extractText(post.body),
          tags: post.tags,
          appreciationsCount: post.appreciationsCount,
          isAppreciated: likedPostIds.has(post._id.toString()),
          isBookmarked: savedPostIds.has(post._id.toString()),
          commentsCount: post.commentsCount,
          createdAt: post.createdAt,
          readTime: estimateReadTime(post.body),
          author,
        })),
      },
    });
  } catch (error) {
    console.error(`[${req.requestId}] Writer profile lookup failed`);
    return res.status(500).json({ message: 'Unable to load writer profile' });
  }
};

const followWriter = async (req, res) => {
  try {
    const followerId = req.auth.userId;
    const followingId = req.params.writerId;
    if (!isValidId(followingId)) return res.status(400).json({ message: 'Invalid writer id' });
    if (followerId === followingId) return res.status(400).json({ message: 'Cannot follow yourself' });

    const [follower, target] = await Promise.all([
      User.findById(followerId).select('_id'),
      User.findById(followingId).select('_id followersCount'),
    ]);
    if (!follower) return res.status(401).json({ message: 'User not found' });
    if (!target) return res.status(404).json({ message: 'Writer not found' });

    const result = await Follow.updateOne(
      { followerId, followingId },
      { $setOnInsert: { followerId, followingId } },
      { upsert: true }
    );
    if (result.upsertedCount === 1) {
      await Promise.all([
        User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }),
        User.updateOne({ _id: followingId }, { $inc: { followersCount: 1 } }),
      ]);
    }

    const writer = await User.findById(followingId).select('followersCount');
    if (result.upsertedCount === 1) await notifyFollow({ followerId, followingId });
    return res.status(200).json({ isFollowing: true, followersCount: writer.followersCount });
  } catch (error) {
    console.error(`[${req.requestId}] Follow writer failed`);
    return res.status(500).json({ message: 'Unable to follow writer' });
  }
};

const unfollowWriter = async (req, res) => {
  try {
    const followerId = req.auth.userId;
    const followingId = req.params.writerId;
    if (!isValidId(followingId)) return res.status(400).json({ message: 'Invalid writer id' });

    const target = await User.findById(followingId).select('_id followersCount');
    if (!target) return res.status(404).json({ message: 'Writer not found' });

    const result = await Follow.deleteOne({ followerId, followingId });
    if (result.deletedCount === 1) {
      await Promise.all([
        User.updateOne({ _id: followerId, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
        User.updateOne({ _id: followingId, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } }),
      ]);
    }

    const writer = await User.findById(followingId).select('followersCount');
    return res.status(200).json({ isFollowing: false, followersCount: writer.followersCount });
  } catch (error) {
    console.error(`[${req.requestId}] Unfollow writer failed`);
    return res.status(500).json({ message: 'Unable to unfollow writer' });
  }
};

module.exports = { getWriterByHandle, followWriter, unfollowWriter };
