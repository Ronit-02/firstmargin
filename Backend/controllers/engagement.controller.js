const mongoose = require('mongoose');
const Comment = require('../schemas/comment.schema');
const Publication = require('../schemas/publication.schema');
const Save = require('../schemas/save.schema');
const Report = require('../schemas/report.schema');
const { reportReasons } = Report;
const { withTransaction } = require('../utils/transaction');
const { getPostAccessContext, canAccessPost } = require('../services/publication-access.service');
const { setLike, addComment: createCommentWorkflow, presentComments, setCommentAppreciation, visibleCommentStages } = require('../services/engagement.service');

const isValidId = id => mongoose.isValidObjectId(id);

const requirePost = async (publicationId, actorId, select = '_id author publicationStatus publicAt') => {
  if (!isValidId(publicationId)) return { error: 'INVALID_ID' };
  const requiredFields = 'author publicationStatus publicAt';
  const post = await Publication.findById(publicationId).select(`${select} ${requiredFields}`);
  if (!post) return { error: 'NOT_FOUND' };
  const context = await getPostAccessContext(actorId);
  return canAccessPost(post, context) ? { post } : { error: 'NOT_FOUND' };
};

const sendPostLookupError = (res, error) => {
  if (error === 'INVALID_ID') {
    return res.status(400).json({ message: 'Invalid post id' });
  }
  return res.status(404).json({ message: 'Publication not found' });
};

const savePost = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const lookup = await requirePost(publicationId, req.auth.userId);
    if (lookup.error) return sendPostLookupError(res, lookup.error);

    await Save.updateOne(
      { userId: req.auth.userId, publicationId },
      { $setOnInsert: { userId: req.auth.userId, publicationId } },
      { upsert: true }
    );

    return res.status(200).json({ isBookmarked: true });
  } catch (error) {
    console.error(`[${req.requestId}] Save post failed`);
    return res.status(500).json({ message: 'Unable to save post' });
  }
};

const unsavePost = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const lookup = await requirePost(publicationId, req.auth.userId);
    if (lookup.error) return sendPostLookupError(res, lookup.error);

    await Save.deleteOne({ userId: req.auth.userId, publicationId });
    return res.status(200).json({ isBookmarked: false });
  } catch (error) {
    console.error(`[${req.requestId}] Unsave post failed`);
    return res.status(500).json({ message: 'Unable to remove saved post' });
  }
};

const likePost = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const lookup = await requirePost(publicationId, req.auth.userId, '_id appreciationsCount');
    if (lookup.error) return sendPostLookupError(res, lookup.error);

    return res.status(200).json(await setLike({ publicationId, userId: req.auth.userId, liked: true }));
  } catch (error) {
    console.error(`[${req.requestId}] Appreciation post failed`);
    return res.status(500).json({ message: 'Unable to appreciate post' });
  }
};

const unlikePost = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const lookup = await requirePost(publicationId, req.auth.userId, '_id appreciationsCount');
    if (lookup.error) return sendPostLookupError(res, lookup.error);

    return res.status(200).json(await setLike({ publicationId, userId: req.auth.userId, liked: false }));
  } catch (error) {
    console.error(`[${req.requestId}] Unlike post failed`);
    return res.status(500).json({ message: 'Unable to remove appreciation' });
  }
};

const getComments = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const lookup = await requirePost(publicationId, req.auth?.userId);
    if (lookup.error) return sendPostLookupError(res, lookup.error);

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 20;
    const parentCommentId = req.query.parentCommentId || null;
    if (parentCommentId !== null && !isValidId(parentCommentId)) return res.status(400).json({ message: 'Invalid parent comment id' });
    if (parentCommentId && !await Comment.exists({ _id: parentCommentId, publicationId })) return res.status(404).json({ message: 'Comment not found' });
    const filter = { publicationId: new mongoose.Types.ObjectId(publicationId), parentCommentId: parentCommentId ? new mongoose.Types.ObjectId(parentCommentId) : null };

    if (req.query.cursor) {
      if (!isValidId(req.query.cursor)) {
        return res.status(400).json({ message: 'Invalid comment cursor' });
      }
      filter._id = { $lt: new mongoose.Types.ObjectId(req.query.cursor) };
    }

    const comments = await Comment.aggregate([
      { $match: filter },
      { $sort: { _id: -1 } },
      ...visibleCommentStages(filter.publicationId),
      { $limit: limit + 1 },
    ]);
    await Comment.populate(comments, { path: 'userId', select: 'picture username bio' });

    const hasMore = comments.length > limit;
    const page = hasMore ? comments.slice(0, limit) : comments;
    const data = await presentComments(page, req.auth?.userId);

    return res.status(200).json({
      data,
      meta: {
        nextCursor: hasMore ? page[page.length - 1]._id : null,
        totalCount: await Comment.countDocuments({ publicationId, deletedAt: null }),
      },
    });
  } catch (error) {
    console.error(`[${req.requestId}] Comment listing failed`);
    return res.status(500).json({ message: 'Unable to load comments' });
  }
};

const createComment = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const content = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!content) return res.status(400).json({ message: 'Comment text is required' });
    if (content.length > 1000) return res.status(400).json({ message: 'Comment is too long' });

    const lookup = await requirePost(publicationId, req.auth.userId);
    if (lookup.error) return sendPostLookupError(res, lookup.error);

    const parentCommentId = req.body.parentCommentId ?? null;
    if (parentCommentId !== null && !isValidId(parentCommentId)) return res.status(400).json({ message: 'Invalid parent comment id' });
    if (parentCommentId && !await Comment.exists({ _id: parentCommentId, publicationId })) return res.status(404).json({ message: 'Comment not found' });
    return res.status(201).json({ data: await createCommentWorkflow({ publicationId, userId: req.auth.userId, content, parentCommentId }) });
  } catch (error) {
    console.error(`[${req.requestId}] Comment creation failed`);
    return res.status(500).json({ message: 'Unable to add comment' });
  }
};

const requireComment = async (req, res) => {
  const { publicationId, commentId } = req.params;
  if (!isValidId(commentId)) {
    res.status(400).json({ message: 'Invalid comment id' });
    return null;
  }
  const lookup = await requirePost(publicationId, req.auth.userId);
  if (lookup.error) {
    sendPostLookupError(res, lookup.error);
    return null;
  }
  const comment = await Comment.findOne({ _id: commentId, publicationId });
  if (!comment) res.status(404).json({ message: 'Comment not found' });
  return comment;
};

const editComment = async (req, res) => {
  try {
    const content = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!content || content.length > 1000) return res.status(400).json({ message: 'Comment must contain 1–1000 characters' });
    const comment = await requireComment(req, res);
    if (!comment) return;
    if (String(comment.userId) !== req.auth.userId) return res.status(403).json({ message: 'You can only edit your own comments' });
    if (comment.deletedAt) return res.status(409).json({ message: 'Comment has been deleted' });
    const updated = await Comment.findOneAndUpdate({ _id: comment._id, userId: req.auth.userId, deletedAt: null }, { $set: { content } }, { new: true, runValidators: true })
      .populate({ path: 'userId', select: 'picture username bio' });
    if (!updated) return res.status(409).json({ message: 'Comment has been deleted' });
    return res.status(200).json({ data: (await presentComments([updated], req.auth.userId))[0] });
  } catch {
    return res.status(500).json({ message: 'Unable to edit comment' });
  }
};

const likeComment = async (req, res) => {
  try {
    const comment = await requireComment(req, res);
    if (!comment) return;
    if (comment.deletedAt) return res.status(409).json({ message: 'Comment has been deleted' });
    return res.status(200).json({ data: await setCommentAppreciation({ commentId: comment._id, userId: req.auth.userId, liked: req.method === 'PUT' }) });
  } catch {
    return res.status(500).json({ message: 'Unable to update comment like' });
  }
};

const deleteComment = async (req, res) => {
  try {
    const comment = await requireComment(req, res);
    if (!comment) return;
    if (String(comment.userId) !== req.auth.userId) return res.status(403).json({ message: 'You can only delete your own comments' });
    const deleted = await withTransaction(async session => {
      const options = session ? { session } : {};
      // Atomic guard makes repeated deletion decrement the counter only once.
      const result = await Comment.updateOne({ _id: comment._id, userId: req.auth.userId, deletedAt: null }, { $set: { content: '', deletedAt: new Date() } }, options);
      if (result.modifiedCount === 1) await Publication.updateOne({ _id: req.params.publicationId, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } }, options);
      return result.modifiedCount === 1;
    });
    return res.status(200).json({ data: { id: comment._id, deleted, isDeleted: true } });
  } catch {
    return res.status(500).json({ message: 'Unable to delete comment' });
  }
};

const reportPost = async (req, res) => {
  try {
    const { publicationId } = req.params;
    const reason = String(req.body.reason || '').trim().toLowerCase();
    const details = typeof req.body.details === 'string' ? req.body.details.trim() : '';

    if (!reportReasons.includes(reason)) {
      return res.status(400).json({ message: 'Select a valid report reason' });
    }
    if (details.length > 1000) {
      return res.status(400).json({ message: 'Report details are too long' });
    }

    const lookup = await requirePost(publicationId, req.auth.userId);
    if (lookup.error) return sendPostLookupError(res, lookup.error);

    const result = await Report.updateOne(
      {
        reporterId: req.auth.userId,
        subjectType: 'publication',
        subjectId: publicationId,
      },
      {
        $setOnInsert: {
          reporterId: req.auth.userId,
          subjectType: 'publication',
          subjectId: publicationId,
          reason,
          details,
          status: 'pending',
        },
      },
      { upsert: true }
    );

    return res.status(result.upsertedCount === 1 ? 201 : 200).json({
      reported: true,
      alreadyReported: result.upsertedCount !== 1,
    });
  } catch (error) {
    console.error(`[${req.requestId}] Publication report failed`);
    return res.status(500).json({ message: 'Unable to submit report' });
  }
};

module.exports = {
  savePost,
  unsavePost,
  likePost,
  unlikePost,
  getComments,
  createComment,
  editComment,
  likeComment,
  deleteComment,
  reportPost,
};
