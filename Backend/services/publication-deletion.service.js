const Publication = require('../schemas/publication.schema');
const Comment = require('../schemas/comment.schema');
const CommentAppreciation = require('../schemas/comment-appreciation.schema');
const Save = require('../schemas/save.schema');
const Appreciation = require('../schemas/appreciation.schema');
const Report = require('../schemas/report.schema');
const { withTransaction, withOptionalSession } = require('../utils/transaction');

const deleteOwnedPost = ({ publicationId, userId }) => withTransaction(async session => {
  const options = session ? { session } : undefined;
  const post = await withOptionalSession(Publication.findOne({ _id: publicationId, author: userId }).select('_id'), session);
  if (!post) return false;

  // Keep the owned post until cleanup succeeds, so standalone failures can be retried.
  // Retain immutable revisions and completed moderation history.
  await Report.deleteMany({ subjectType: 'publication', subjectId: publicationId, status: 'pending' }, options);
  // Bound memory and $in payloads even for posts with large discussions.
  while (true) {
    const comments = await withOptionalSession(Comment.find({ publicationId }).select('_id').limit(500).lean(), session);
    if (!comments.length) break;
    const commentIds = comments.map(comment => comment._id);
    await Report.deleteMany({ subjectType: 'comment', subjectId: { $in: commentIds }, status: 'pending' }, options);
    await CommentAppreciation.deleteMany({ commentId: { $in: commentIds } }, options);
    await Comment.deleteMany({ publicationId, _id: { $in: commentIds } }, options);
  }
  await Appreciation.deleteMany({ publicationId }, options);
  await Save.deleteMany({ publicationId }, options);
  await Publication.deleteOne({ _id: publicationId, author: userId }, options);
  return true;
});

module.exports = { deleteOwnedPost };
