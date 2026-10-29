const Profile = require('../schemas/profile.schema');
const Appreciation = require('../schemas/appreciation.schema');
const Save = require('../schemas/save.schema');

const extractText = body => {
  try {
    const blocks = JSON.parse(body);
    if (!Array.isArray(blocks)) return '';
    return blocks
      .filter(block => !['image', 'divider'].includes(block?.type))
      .map(block => String(block.content || '').replace(/<[^>]*>/g, ' '))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
};

const presentDiscoveryPosts = async (posts, viewerId = null) => {
  const authorIds = posts.map(post => post.author?._id).filter(Boolean);
  const publicationIds = posts.map(post => post._id).filter(Boolean);
  const [profiles, likes, saves] = await Promise.all([
    Profile.find({ userId: { $in: authorIds } }).select('userId handle displayName avatarUrl').lean(),
    viewerId ? Appreciation.find({ userId: viewerId, publicationId: { $in: publicationIds } }).select('publicationId').lean() : [],
    viewerId ? Save.find({ userId: viewerId, publicationId: { $in: publicationIds } }).select('publicationId').lean() : [],
  ]);
  const profilesByUser = new Map(
    profiles.map(profile => [profile.userId.toString(), profile])
  );
  const likedPostIds = new Set(likes.map(like => like.publicationId.toString()));
  const savedPostIds = new Set(saves.map(save => save.publicationId.toString()));

  return posts.map(post => {
    const text = extractText(post.body);
    const words = text ? text.split(/\s+/).length : 0;
    const profile = post.author?._id
      ? profilesByUser.get(post.author._id.toString())
      : null;

    const isOwner = Boolean(viewerId && post.author?._id?.toString() === viewerId.toString());
    return {
      id: post._id,
      title: post.title,
      format: post.format || 'story',
      image: post.coverImage || null,
      excerpt: post.format === 'short' ? text.slice(0, 800) : text,
      tags: post.tags || [],
      appreciationsCount: post.appreciationsCount || 0,
      commentsCount: post.commentsCount || 0,
      isAppreciated: likedPostIds.has(post._id.toString()),
      isBookmarked: savedPostIds.has(post._id.toString()),
      isOwner,
      canAddToSeries: Boolean(isOwner && post.publicationStatus !== 'unpublished' && (!post.publicAt || post.publicAt <= new Date())),
      createdAt: post.createdAt,
      readTime: `${Math.max(1, Math.ceil(words / 200))} min read`,
      author: {
        id: post.author?._id || null,
        username: profile?.displayName || post.author?.username || 'Unknown writer',
        picture: profile?.avatarUrl || post.author?.picture || null,
        handle: profile?.handle || null,
      },
    };
  });
};

module.exports = { extractText, presentDiscoveryPosts };
