const mongoose = require('mongoose');
const Collection = require('../schemas/collection.schema');
const Publication = require('../schemas/publication.schema');

// Keep legacy publication arrays readable while converting only the collection being edited.
const orderedItems = { $cond: [
  { $gt: [{ $size: { $ifNull: ['$items', []] } }, 0] },
  '$items',
  { $map: { input: { $range: [0, { $size: { $ifNull: ['$publications', []] } }] }, as: 'index', in: {
    publication: { $arrayElemAt: ['$publications', '$$index'] }, position: '$$index', addedAt: '$createdAt',
  } } },
] };

const appendCollectionPost = async ({ collectionId, publicationId, actorId }) => {
  const post = await Publication.exists({ _id: publicationId, publicationStatus: { $ne: 'unpublished' },
    $or: [{ publicAt: { $lte: new Date() } }, { publicAt: null }, { publicAt: { $exists: false } }],
  });
  if (!post) return { status: 404, message: 'This story is not publicly available' };
  const postObjectId = new mongoose.Types.ObjectId(publicationId);
  const updated = await Collection.findOneAndUpdate({
    _id: collectionId, author: actorId,
    $expr: { $and: [
      { $lt: [{ $size: orderedItems }, 100] },
      { $not: [{ $in: [postObjectId, { $map: { input: orderedItems, as: 'item', in: '$$item.publication' } }] }] },
    ] },
  }, [
    { $set: { items: orderedItems } },
    { $set: { items: { $concatArrays: ['$items', [{
      publication: { $literal: postObjectId },
      position: { $add: [{ $ifNull: [{ $max: '$items.position' }, -1] }, 1] },
      addedAt: '$$NOW',
    }]] }, publications: [] } },
  ], { returnDocument: 'after', updatePipeline: true }).select('_id');
  if (updated) return { status: 200, data: { added: true } };
  const collection = await Collection.findOne({ _id: collectionId, author: actorId }).select('items publications');
  if (!collection) return { status: 404, message: 'Collection not found' };
  const ids = collection.items?.length ? collection.items.map(item => String(item.publication)) : (collection.publications || []).map(String);
  if (ids.includes(postObjectId.toHexString())) return { status: 200, data: { added: false } };
  return { status: 400, message: 'A collection can contain up to 100 stories' };
};

module.exports = { appendCollectionPost };
