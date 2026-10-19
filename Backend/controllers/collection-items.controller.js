const mongoose = require('mongoose');
const { appendCollectionPost } = require('../services/collection-items.service');

const addCollectionPost = async (req, res) => {
  const { collectionId, publicationId } = req.params;
  if (!mongoose.isValidObjectId(collectionId) || !mongoose.isValidObjectId(publicationId)) {
    return res.status(400).json({ message: 'Invalid collection or post id' });
  }
  try {
    const result = await appendCollectionPost({ collectionId, publicationId, actorId: req.auth.userId });
    return res.status(result.status).json(result.data ? { data: result.data } : { message: result.message });
  } catch {
    return res.status(500).json({ message: 'Unable to add story to collection' });
  }
};

module.exports = { addCollectionPost };
