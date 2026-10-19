const mongoose = require('mongoose');

// Keep comment relationships separate from the existing post-like contract.
const commentAppreciationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true },
}, { timestamps: true });
commentAppreciationSchema.index({ commentId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('CommentAppreciation', commentAppreciationSchema);
