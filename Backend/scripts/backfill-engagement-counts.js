const mongoose = require('mongoose');
const { connectToMongoDB } = require('../utils/mongoConnect');
const Comment = require('../schemas/comment.schema');
const Appreciation = require('../schemas/appreciation.schema');
const Publication = require('../schemas/publication.schema');

const toCountMap = rows => new Map(
  rows.map(row => [row._id.toString(), row.count])
);

const run = async () => {
  await connectToMongoDB();

  const [likeRows, commentRows, posts] = await Promise.all([
    Appreciation.aggregate([
      { $group: { _id: '$publicationId', count: { $sum: 1 } } },
    ]),
    Comment.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$publicationId', count: { $sum: 1 } } },
    ]),
    Publication.find().select('_id').lean(),
  ]);

  const likesByPost = toCountMap(likeRows);
  const commentsByPost = toCountMap(commentRows);
  const operations = posts.map(post => {
    const publicationId = post._id.toString();
    return {
      updateOne: {
        filter: { _id: post._id },
        update: {
          $set: {
            appreciationsCount: likesByPost.get(publicationId) || 0,
            commentsCount: commentsByPost.get(publicationId) || 0,
          },
        },
      },
    };
  });

  if (operations.length > 0) {
    await Publication.bulkWrite(operations, { ordered: false });
  }

  console.log(`Recalculated engagement counters for ${operations.length} posts`);
};

run()
  .catch(() => {
    console.error('Engagement counter backfill failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
