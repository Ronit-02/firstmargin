const mongoose = require('mongoose');
const { deleteOwnedPost } = require('../services/publication-deletion.service');

const deletePost = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.publicationId)) return res.status(400).json({ message: 'Invalid post id' });
  try {
    const deleted = await deleteOwnedPost({ publicationId: req.params.publicationId, userId: req.auth.userId });
    if (!deleted) return res.status(404).json({ message: 'Publication not found' });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Unable to delete post. Please try again.' });
  }
};

module.exports = { deletePost };
