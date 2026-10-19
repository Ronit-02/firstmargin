const Comment = require('../schemas/comment.schema');
const Appreciation = require('../schemas/appreciation.schema');
const CommentAppreciation = require('../schemas/comment-appreciation.schema');
const Publication = require('../schemas/publication.schema');
const { notify } = require('./notification.service');
const { withTransaction, withOptionalSession } = require('../utils/transaction');

// Only deleted branches need traversal. A placeholder connects readers to live
// descendants; a branch made entirely of deletion markers has nothing to show.
const visibleCommentStages = (publicationId) => [
  { $graphLookup: {
    from: Comment.collection.name,
    startWith: { $cond: [{ $ifNull: ['$deletedAt', false] }, '$_id', []] },
    connectFromField: '_id',
    connectToField: 'parentCommentId',
    restrictSearchWithMatch: { publicationId },
    as: 'commentDescendants',
  } },
  { $match: { $or: [{ deletedAt: null }, { commentDescendants: { $elemMatch: { deletedAt: null } } }] } },
  { $project: { commentDescendants: 0 } },
];

const setLike = async ({ publicationId, userId, liked }) => {
  const { post, created } = await withTransaction(async session => {
    const options = session ? { session } : undefined;
    let created = false;
    if (liked) {
      const result = await Appreciation.updateOne({ userId, publicationId }, { $setOnInsert: { userId, publicationId } }, { upsert: true, ...options });
      created = result.upsertedCount === 1;
      if (result.upsertedCount === 1) await Publication.updateOne({ _id: publicationId }, { $inc: { appreciationsCount: 1 } }, options);
    } else {
      const result = await Appreciation.deleteOne({ userId, publicationId }, options);
      if (result.deletedCount === 1) await Publication.updateOne({ _id: publicationId, appreciationsCount: { $gt: 0 } }, { $inc: { appreciationsCount: -1 } }, options);
    }
    const post = await withOptionalSession(Publication.findById(publicationId).select('appreciationsCount author title'), session);
    return { post, created };
  });
  if (created && post) await notify({
    recipientId: post.author, actorId: userId, type: 'publication_appreciated',
    title: 'Someone appreciated your post', body: (post.title || '').slice(0, 180),
    href: `/post/${publicationId}`, entityType: 'publication', entityId: publicationId,
  });
  return { isAppreciated: liked, appreciationsCount: post?.appreciationsCount || 0 };
};

const addComment = async ({ publicationId, userId, content, parentCommentId = null }) => {
  const result = await withTransaction(async session => {
    const options = session ? { session } : undefined;
    const [comment] = await Comment.create([{ publicationId, userId, content, parentCommentId }], options);
    await Publication.updateOne({ _id: publicationId }, { $inc: { commentsCount: 1 } }, options);
    const populated = await withOptionalSession(
      Comment.findById(comment._id).populate({ path: 'userId', select: 'picture username bio' }),
      session,
    );
    const post = await withOptionalSession(Publication.findById(publicationId).select('author'), session);
    return { publication: post, comment: {
      id: populated._id,
      content: populated.content,
      createdAt: populated.createdAt,
      parentCommentId: populated.parentCommentId,
      canEdit: true,
      canDelete: true,
      isAppreciated: false,
      appreciationsCount: 0,
      repliesCount: 0,
      author: { id: populated.userId._id, name: populated.userId.username, avatar: populated.userId.picture, bio: populated.userId.bio },
    } };
  });
  if (result.publication) await notify({
    recipientId: result.publication.author, actorId: userId, type: 'publication_commented',
    title: 'Someone commented on your post', body: content.slice(0, 180),
    href: `/post/${publicationId}`, entityType: 'publication', entityId: publicationId,
  });
  return result.comment;
};

const presentComments = async (comments, userId) => {
  const ids = comments.map(comment => comment._id);
  const [likes, replies, viewerLikes] = ids.length ? await Promise.all([
    CommentAppreciation.aggregate([
      { $match: { commentId: { $in: ids } } },
      { $group: { _id: '$commentId', count: { $sum: 1 } } },
    ]),
    Comment.aggregate([
      { $match: { publicationId: comments[0].publicationId, parentCommentId: { $in: ids } } },
      ...visibleCommentStages(comments[0].publicationId),
      { $group: { _id: '$parentCommentId', count: { $sum: 1 } } },
    ]),
    userId ? CommentAppreciation.find({ commentId: { $in: ids }, userId }).select('commentId').lean() : [],
  ]) : [[], [], []];
  const likeCounts = new Map(likes.map(row => [String(row._id), row.count]));
  const replyCounts = new Map(replies.map(row => [String(row._id), row.count]));
  const likedIds = new Set(viewerLikes.map(row => String(row.commentId)));
  return comments.map(comment => ({
    id: comment._id,
    content: comment.deletedAt ? '' : comment.content,
    isDeleted: Boolean(comment.deletedAt),
    createdAt: comment.createdAt,
    parentCommentId: comment.parentCommentId,
    canEdit: Boolean(!comment.deletedAt && userId && String(comment.userId?._id) === String(userId)),
    canDelete: Boolean(!comment.deletedAt && userId && String(comment.userId?._id) === String(userId)),
    appreciationsCount: comment.deletedAt ? 0 : likeCounts.get(String(comment._id)) || 0,
    isAppreciated: !comment.deletedAt && likedIds.has(String(comment._id)),
    repliesCount: replyCounts.get(String(comment._id)) || 0,
    author: !comment.deletedAt && comment.userId ? {
      id: comment.userId._id, name: comment.userId.username,
      avatar: comment.userId.picture, bio: comment.userId.bio,
    } : null,
  }));
};

const setCommentAppreciation = async ({ commentId, userId, liked }) => {
  if (liked) {
    try {
      await CommentAppreciation.updateOne({ commentId, userId }, { $setOnInsert: { commentId, userId } }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  } else {
    await CommentAppreciation.deleteOne({ commentId, userId });
  }
  return { id: commentId, isAppreciated: liked, appreciationsCount: await CommentAppreciation.countDocuments({ commentId }) };
};

module.exports = { setLike, addComment, presentComments, setCommentAppreciation, visibleCommentStages };
